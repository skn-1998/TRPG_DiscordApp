/**
 * Reports how independent every function-like declaration is: what it reaches for beyond its
 * own parameters and locals. That is the question behind "what do I have to build before I
 * can call this?", which decides whether a unit test is cheap or needs a fixture first.
 *
 * Everything below is counted from the syntax tree. Nothing is inferred from names or types,
 * and every count carries up to three source occurrences so a reviewer can check it.
 *
 * `independence`, `extractable` and `testabilityGrade` are advisory heuristics. They narrow
 * the reading list; they decide nothing. The call belongs to a human, or to this repo's
 * refactor-for-testability / test-expansion skills, whose green/yellow/red testability
 * grading `testabilityGrade` is named after.
 *
 * Measured per function:
 * - thisAccessCount        every `this` in the body
 * - injectedDependencies   the `this.<name>` accesses matching a constructor parameter
 *                          property of the owning class or one of its base classes, i.e. the
 *                          NestJS `constructor(private readonly foo: Foo)` dependencies, plus
 *                          -- for a constructor -- the parameter properties it declares itself
 * - freeVariableWrites     assignments whose target is not declared inside the function
 * - capturedVariableReads  reads of a name bound by an enclosing function scope, or of a
 *                          module-scope `let`/`var`; the value comes from somewhere the
 *                          caller cannot reach through the argument list
 * - nondeterministicCalls  clock and randomness sources
 * - ioIndicators           console/process/fs/fetch/axios use, `await`, and a Promise-typed
 *                          signature
 * - globalAccess           globalThis/window/document, and `process.env`
 * - importedCallCount      calls to imported symbols; on its own this says nothing about
 *                          purity, because pure utilities are imported too
 * - moduleConstantReads    reads of a module-scope `const`/`enum`/`class`/`function` or of an
 *                          import; the binding is the same on every call, so this is reported
 *                          for context and does not affect `independence`
 *
 * What it cannot see:
 * - Measurements cover the whole body, nested functions included. A `this` inside a nested
 *   `function` expression binds to that expression rather than to the enclosing method, and
 *   is attributed one level too high. The error direction is conservative: it over-reports
 *   impurity, it never invents purity.
 * - Mutating an argument (`function f(acc) { acc.total += 1 }`) is a side effect but not a
 *   free-variable write, so such a function is still reported `pure`.
 * - Imported callees are counted, not followed. `near-pure` means "pure unless one of the
 *   imported callees is impure".
 * - Only imported callees are counted. A call to a module-scope function declared in the same
 *   file is not measured at all, so a function that delegates to an impure same-file helper
 *   is still reported `pure`.
 * - `moduleConstantReads` classifies the binding, not the value behind it. `const rows = []`
 *   cannot be reassigned, so reading `rows` lands there even when another module pushes into
 *   it on every request. Telling those apart needs alias analysis across files, which this
 *   syntactic pass does not do, so shared mutable state reached through a `const` binding is
 *   the one place where `pure` is claimed too readily.
 * - A name the file does not bind at all -- a host builtin such as `Object` or `JSON`, an
 *   ambient declaration, a namespace, a type parameter -- lands in neither read tally, the
 *   same way the other measurements already pass over it.
 * - Block scoping is not modelled when looking outward: a `const` declared inside an `if`
 *   block of an enclosing function counts as bound by that whole function. The error
 *   direction is conservative -- it can only over-report a capture.
 * - A name that is both read and written (`total += 1` on a module-scope `let`) is counted in
 *   `freeVariableWrites` and in `capturedVariableReads`. The two answer different questions
 *   and both make the function impure, so the verdict is unaffected.
 * - Impurity arriving as a value has no name to match: a callback parameter, a client passed
 *   as an argument, `handlers[key]()`.
 * - Identifiers are matched by text against the function's own bindings, so a module-scope
 *   declaration shadowing `document` or an import name is read as the global or the import.
 * - Destructuring assignment (`[a, b] = pair`) is not counted as a write.
 */
import {
  Node,
  SyntaxKind,
  VariableDeclarationKind,
  type Identifier,
  type SourceFile,
} from 'ts-morph';
import { SHARED_CLI_HELP_LINES, parseSharedCliOptions, rejectUnknownArgs } from './shared/cli';
import {
  functionLikeName,
  isClassLikeNode,
  isFunctionLikeNode,
  isMemberFunctionLike,
  type ClassLikeNode,
  type FunctionLikeNode,
} from './shared/function-like';
import { createAnalysisTarget, toRelativePath } from './shared/project';
import { createReportHeader, writeReport, type ReportHeader } from './shared/report';

type Independence = 'pure' | 'near-pure' | 'impure';

type TestabilityGrade = 'green' | 'yellow' | 'red';

/** One source position backing a count, so a reviewer can verify it instead of trusting it. */
type Occurrence = {
  line: number;
  text: string;
};

/** A running count plus its first few occurrences. */
type Tally = {
  count: number;
  samples: Occurrence[];
};

type Tallies = {
  thisAccess: Tally;
  freeVariableWrites: Tally;
  capturedVariableReads: Tally;
  nondeterministicCalls: Tally;
  ioIndicators: Tally;
  globalAccess: Tally;
  importedCalls: Tally;
  moduleConstantReads: Tally;
};

type Evidence = Record<keyof Tallies, Occurrence[]>;

/**
 * The names a file binds outside every function body, split by whether the binding itself can
 * be reassigned. A `let` can hold a different value by the time the function runs, so reading
 * one is a dependency on module state; a `const`, `enum`, `class`, `function` or import
 * binding cannot be reassigned, so reading one asks nothing of the caller.
 */
type ModuleScopeBindings = {
  constantNames: Set<string>;
  mutableNames: Set<string>;
};

/** What the function's own scope binds, what encloses it, and what its file binds at module scope. */
type FunctionContext = {
  /** Parameters, locals, and anything declared inside a nested function. */
  localNames: Set<string>;
  /** Names bound by the enclosing function scopes, i.e. what this function can close over. */
  enclosingFunctionNames: Set<string>;
  moduleScope: ModuleScopeBindings;
  /** Local import name -> module specifier. */
  importedValues: Map<string, string>;
};

type FunctionReport = {
  filePath: string;
  symbolName: string | null;
  kind: string;
  startLine: number;
  endLine: number;
  thisAccessCount: number;
  injectedDependencies: string[];
  freeVariableWrites: number;
  capturedVariableReads: number;
  nondeterministicCalls: number;
  ioIndicators: number;
  globalAccess: number;
  importedCallCount: number;
  moduleConstantReads: number;
  independence: Independence;
  /** True when this method or accessor reads no `this`, so it can move out of its class as-is. */
  extractable: boolean;
  testabilityGrade: TestabilityGrade;
  evidence: Evidence;
};

type IndependenceReport = ReportHeader & {
  analyzedFunctionCount: number;
  byIndependence: Record<Independence, number>;
  byTestabilityGrade: Record<TestabilityGrade, number>;
  functions: FunctionReport[];
};

const HELP_TEXT = [
  'Usage: pnpm run static:independence -- [options]',
  '',
  'Reports, for every function-like declaration in one tsconfig, what it touches beyond its',
  'own parameters and locals: `this`, injected dependencies, free-variable writes, captured',
  'variables, clock and randomness, I/O, globals, and calls to imported symbols. Each count',
  'carries up to three source occurrences.',
  '',
  'The independence, extractable and testabilityGrade fields are advisory heuristics meant to',
  'narrow a reading list. They are not a verdict: a human, or the refactor-for-testability /',
  'test-expansion skills, decide. See the header comment in this file for what the heuristics',
  'cannot see.',
  '',
  'This command is advisory and always exits successfully unless the analysis itself fails.',
  '',
  'Options:',
  ...SHARED_CLI_HELP_LINES,
  '',
  'Paths in the report are cwd-relative and use "/". When --out is used, the output path',
  'must stay under .tmp/.',
  '',
].join('\n');

const MAX_OCCURRENCE_SAMPLES = 3;
const MAX_OCCURRENCE_TEXT_LENGTH = 120;

/** Callees whose result depends on the clock or on a random source, written as they read. */
const NONDETERMINISTIC_CALLEE_TEXTS = new Set([
  'Date.now',
  'Math.random',
  'crypto.getRandomValues',
  'crypto.randomBytes',
  'crypto.randomUUID',
  'performance.now',
  'process.hrtime',
  'process.hrtime.bigint',
]);

/** The same sources reached through a bare import, e.g. `import { randomUUID } from 'crypto'`. */
const NONDETERMINISTIC_IMPORT_NAMES = new Set([
  'randomBytes',
  'randomFillSync',
  'randomInt',
  'randomUUID',
]);
const NONDETERMINISTIC_MODULE_SPECIFIERS = new Set(['crypto', 'node:crypto']);

/** Modules whose exports do I/O by definition, so importing one is the evidence. */
const IO_MODULE_SPECIFIERS = new Set([
  'axios',
  'fs',
  'fs/promises',
  'node:fs',
  'node:fs/promises',
]);

/** Objects that exist because of the host rather than the argument list. */
const GLOBAL_OBJECT_NAMES = new Set(['document', 'globalThis', 'window']);

const cwd = process.cwd();
const { options, rest } = parseSharedCliOptions(cwd, process.argv.slice(2), HELP_TEXT);
rejectUnknownArgs(rest);

const target = createAnalysisTarget(cwd, options);

/** `getBaseClass()` consults the type checker, so each class is resolved once. */
const parameterPropertyCache = new Map<ClassLikeNode, Set<string>>();

/** Every nested function asks its ancestors what they bind, so each answer is computed once. */
const functionScopeNameCache = new Map<FunctionLikeNode, Set<string>>();

// Source order is already the required order: `createAnalysisTarget` sorts files by path, and
// `forEachDescendant` visits in ascending start position. No sort can express that as
// unambiguously, because two nested arrows can share a start line.
const functions = target.sourceFiles.flatMap(analyzeSourceFile);

writeReport(cwd, options.out, buildReport(functions));

// ---------------------------------------------------------------------------
// collection
// ---------------------------------------------------------------------------

function analyzeSourceFile(sourceFile: SourceFile): FunctionReport[] {
  const filePath = toRelativePath(cwd, sourceFile.getFilePath());
  const importedValues = collectImportedValueNames(sourceFile);
  const moduleScope = collectModuleScopeBindings(sourceFile, importedValues);
  const reports: FunctionReport[] = [];

  sourceFile.forEachDescendant((node) => {
    if (!isAnalyzableFunction(node)) return;
    reports.push(analyzeFunction(filePath, node, importedValues, moduleScope));
  });

  return reports;
}

function isAnalyzableFunction(node: Node): node is FunctionLikeNode {
  if (!isFunctionLikeNode(node)) return false;
  // Overload signatures and abstract members have no body. There is nothing to measure, and
  // an all-zero measurement would read as `pure`.
  return node.getBody() !== undefined;
}

/** Import bindings that exist at runtime, so a type-only import never counts as a dependency. */
function collectImportedValueNames(sourceFile: SourceFile): Map<string, string> {
  const importedValues = new Map<string, string>();

  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.isTypeOnly()) continue;
    const clause = declaration.getImportClause();
    if (clause === undefined) continue;
    const moduleSpecifier = declaration.getModuleSpecifierValue();

    const defaultImport = clause.getDefaultImport();
    if (defaultImport !== undefined) importedValues.set(defaultImport.getText(), moduleSpecifier);
    const namespaceImport = clause.getNamespaceImport();
    if (namespaceImport !== undefined) importedValues.set(namespaceImport.getText(), moduleSpecifier);
    for (const named of clause.getNamedImports()) {
      if (named.isTypeOnly()) continue;
      importedValues.set(named.getAliasNode()?.getText() ?? named.getName(), moduleSpecifier);
    }
  }

  return importedValues;
}

/**
 * The names that are in scope outside every function body of the file. Imports are constant
 * bindings, and starting from them keeps `moduleConstantReads` describing the same set of
 * names that `importedCallCount` already counts calls to.
 */
function collectModuleScopeBindings(
  sourceFile: SourceFile,
  importedValues: Map<string, string>,
): ModuleScopeBindings {
  const constantNames = new Set<string>(importedValues.keys());
  const mutableNames = new Set<string>();

  sourceFile.forEachDescendant((node, traversal) => {
    if (Node.isVariableStatement(node)) {
      const isConstant = node.getDeclarationKind() === VariableDeclarationKind.Const;
      for (const declaration of node.getDeclarations()) {
        addBindingNames(declaration.getNameNode(), isConstant ? constantNames : mutableNames);
      }
      // An initializer can only bind names inside itself, never at module scope.
      traversal.skip();
      return;
    }
    if (Node.isClassDeclaration(node) || Node.isEnumDeclaration(node) || Node.isFunctionDeclaration(node)) {
      // The name binds here; the body is another scope. A class member is always reached
      // through an instance or the class name, never as a bare identifier.
      const name = node.getName();
      if (name !== undefined) constantNames.add(name);
      traversal.skip();
      return;
    }
    if (isFunctionLikeNode(node) || Node.isClassExpression(node)) traversal.skip();
  });

  return { constantNames, mutableNames };
}

/**
 * The names bound by the function scopes this function sits inside. Reading one of them is a
 * closure capture: the value belongs to one particular invocation of the outer function, so a
 * caller of this function has no way to supply it.
 */
function collectEnclosingFunctionNames(node: FunctionLikeNode): Set<string> {
  const names = new Set<string>();
  for (
    let ancestor = node.getFirstAncestor(isFunctionLikeNode);
    ancestor !== undefined;
    ancestor = ancestor.getFirstAncestor(isFunctionLikeNode)
  ) {
    for (const name of functionScopeNames(ancestor)) names.add(name);
  }
  return names;
}

function functionScopeNames(node: FunctionLikeNode): Set<string> {
  const cached = functionScopeNameCache.get(node);
  if (cached !== undefined) return cached;
  const names = collectFunctionScopeNames(node);
  functionScopeNameCache.set(node, names);
  return names;
}

/**
 * What one function scope binds: its parameters, plus the declarations in its body that are
 * not inside a nested function. Unlike `collectLocalNames` this stops at nested functions, so
 * a name that only exists inside a sibling closure is not mistaken for one in scope here.
 */
function collectFunctionScopeNames(node: FunctionLikeNode): Set<string> {
  const names = new Set<string>();
  for (const parameter of node.getParameters()) addBindingNames(parameter.getNameNode(), names);

  const body = node.getBody();
  if (body === undefined) return names;

  body.forEachDescendant((descendant, traversal) => {
    if (isFunctionLikeNode(descendant)) {
      // A named nested function declares its name in this scope; everything else it binds
      // belongs to itself.
      if (Node.isFunctionDeclaration(descendant)) {
        const name = descendant.getName();
        if (name !== undefined) names.add(name);
      }
      traversal.skip();
      return;
    }
    if (Node.isClassDeclaration(descendant)) {
      const name = descendant.getName();
      if (name !== undefined) names.add(name);
      traversal.skip();
      return;
    }
    if (Node.isVariableDeclaration(descendant)) {
      addBindingNames(descendant.getNameNode(), names);
      return;
    }
    if (Node.isCatchClause(descendant)) {
      const variable = descendant.getVariableDeclaration();
      if (variable !== undefined) addBindingNames(variable.getNameNode(), names);
    }
  });

  return names;
}

/**
 * Every name the function itself binds. A name outside this set resolves to something the
 * caller cannot pass in, which is what makes reading or writing it a dependency.
 */
function collectLocalNames(node: FunctionLikeNode): Set<string> {
  const localNames = new Set<string>();

  node.forEachDescendant((descendant) => {
    if (Node.isParameterDeclaration(descendant) || Node.isVariableDeclaration(descendant)) {
      addBindingNames(descendant.getNameNode(), localNames);
      return;
    }
    if (Node.isFunctionDeclaration(descendant) || Node.isClassDeclaration(descendant)) {
      const name = descendant.getName();
      if (name !== undefined) localNames.add(name);
      return;
    }
    if (Node.isCatchClause(descendant)) {
      const variable = descendant.getVariableDeclaration();
      if (variable !== undefined) addBindingNames(variable.getNameNode(), localNames);
    }
  });

  return localNames;
}

function addBindingNames(nameNode: Node, localNames: Set<string>): void {
  if (Node.isIdentifier(nameNode)) {
    localNames.add(nameNode.getText());
    return;
  }
  // A destructuring pattern binds one name per element, including nested ones.
  for (const element of nameNode.getDescendantsOfKind(SyntaxKind.BindingElement)) {
    const elementName = element.getNameNode();
    if (Node.isIdentifier(elementName)) localNames.add(elementName.getText());
  }
}

// ---------------------------------------------------------------------------
// measurement
// ---------------------------------------------------------------------------

function analyzeFunction(
  filePath: string,
  node: FunctionLikeNode,
  importedValues: Map<string, string>,
  moduleScope: ModuleScopeBindings,
): FunctionReport {
  const context: FunctionContext = {
    localNames: collectLocalNames(node),
    enclosingFunctionNames: collectEnclosingFunctionNames(node),
    moduleScope,
    importedValues,
  };
  const tallies = createTallies();
  const thisPropertyNames = new Set<string>();

  measure(node, context, tallies, thisPropertyNames);

  const thisAccessCount = tallies.thisAccess.count;
  const freeVariableWrites = tallies.freeVariableWrites.count;
  const capturedVariableReads = tallies.capturedVariableReads.count;
  const globalAccess = tallies.globalAccess.count;
  const injectedDependencies = collectInjectedDependencies(node, thisPropertyNames);
  const independence = classifyIndependence(tallies, injectedDependencies.length);

  return {
    filePath,
    symbolName: functionLikeName(node),
    kind: node.getKindName(),
    startLine: node.getStartLineNumber(),
    endLine: node.getEndLineNumber(),
    thisAccessCount,
    injectedDependencies,
    freeVariableWrites,
    capturedVariableReads,
    nondeterministicCalls: tallies.nondeterministicCalls.count,
    ioIndicators: tallies.ioIndicators.count,
    globalAccess,
    importedCallCount: tallies.importedCalls.count,
    moduleConstantReads: tallies.moduleConstantReads.count,
    independence,
    extractable: isMemberFunctionLike(node) && thisAccessCount === 0,
    testabilityGrade: classifyTestability(independence, {
      injectedDependencyCount: injectedDependencies.length,
      freeVariableWrites,
      capturedVariableReads,
      globalAccess,
    }),
    evidence: {
      thisAccess: tallies.thisAccess.samples,
      freeVariableWrites: tallies.freeVariableWrites.samples,
      capturedVariableReads: tallies.capturedVariableReads.samples,
      nondeterministicCalls: tallies.nondeterministicCalls.samples,
      ioIndicators: tallies.ioIndicators.samples,
      globalAccess: tallies.globalAccess.samples,
      importedCalls: tallies.importedCalls.samples,
      moduleConstantReads: tallies.moduleConstantReads.samples,
    },
  };
}

function measure(
  node: FunctionLikeNode,
  context: FunctionContext,
  tallies: Tallies,
  thisPropertyNames: Set<string>,
): void {
  // A Promise-typed signature is the one indicator carried by the declaration rather than by
  // a node inside the body, so it is recorded against the signature line.
  if (returnsPromise(node)) {
    record(tallies.ioIndicators, node, declarationHeaderText(node));
  }

  node.forEachDescendant((descendant) => {
    if (Node.isThisExpression(descendant)) {
      measureThisExpression(descendant, tallies, thisPropertyNames);
      return;
    }
    if (Node.isIdentifier(descendant)) {
      measureIdentifier(descendant, context, tallies);
      return;
    }
    if (Node.isCallExpression(descendant)) {
      measureCall(descendant, context, tallies);
      return;
    }
    if (Node.isNewExpression(descendant)) {
      // `new Date(value)` is deterministic; only the zero-argument form reads the clock.
      if (descendant.getExpression().getText() === 'Date' && descendant.getArguments().length === 0) {
        record(tallies.nondeterministicCalls, descendant, 'new Date()');
      }
      return;
    }
    if (Node.isAwaitExpression(descendant)) {
      record(tallies.ioIndicators, descendant, `await ${descendant.getExpression().getText()}`);
      return;
    }
    measureWrite(descendant, context, tallies);
  });
}

function measureThisExpression(node: Node, tallies: Tallies, thisPropertyNames: Set<string>): void {
  const parent = node.getParent();
  const accessesProperty = parent !== undefined
    && Node.isPropertyAccessExpression(parent)
    && parent.getExpression() === node;
  if (accessesProperty && Node.isPropertyAccessExpression(parent)) {
    thisPropertyNames.add(parent.getName());
  }
  record(tallies.thisAccess, node, accessesProperty ? parent.getText() : 'this');
}

/**
 * Host objects and I/O modules are recognised by the name they are reached through. Only the
 * identifier is inspected, never the surrounding access chain, so `process.env.NODE_ENV`
 * counts once rather than once per property in the chain.
 */
function measureIdentifier(node: Identifier, context: FunctionContext, tallies: Tallies): void {
  const name = node.getText();
  if (context.localNames.has(name) || !isValueReference(node)) return;

  if (name === 'process') {
    // `process.env` is configuration read from the host, so it lands in globalAccess rather
    // than in ioIndicators. Every occurrence is counted exactly once, in one category.
    record(isProcessEnvAccess(node) ? tallies.globalAccess : tallies.ioIndicators, node, accessText(node));
    return;
  }
  if (name === 'console') {
    record(tallies.ioIndicators, node, accessText(node));
    return;
  }
  if (GLOBAL_OBJECT_NAMES.has(name)) {
    record(tallies.globalAccess, node, accessText(node));
    return;
  }

  const moduleSpecifier = context.importedValues.get(name);
  if (moduleSpecifier !== undefined && IO_MODULE_SPECIFIERS.has(moduleSpecifier)) {
    record(tallies.ioIndicators, node, accessText(node));
    return;
  }

  measureFreeVariableRead(node, name, context, tallies);
}

/**
 * Where a free name is bound decides whether reading it costs the caller anything. A name from
 * an enclosing function scope is closure state, so the function cannot be called without first
 * reproducing the invocation that created it; a module-scope `let` can hold anything by the
 * time the call happens. Both make the function impure. A module-scope constant binding is the
 * same value on every call, so reading one is recorded for context only -- this is what keeps
 * a helper that consults a module-level lookup table `pure`.
 */
function measureFreeVariableRead(
  node: Identifier,
  name: string,
  context: FunctionContext,
  tallies: Tallies,
): void {
  // A type annotation is erased before the code runs, so a name used only there reads nothing.
  if (isInTypePosition(node)) return;

  if (context.enclosingFunctionNames.has(name) || context.moduleScope.mutableNames.has(name)) {
    record(tallies.capturedVariableReads, node, accessText(node));
    return;
  }
  if (!context.moduleScope.constantNames.has(name)) return;
  // `format(value)` is already one occurrence in importedCalls. Recording the callee here as
  // well would report a single fact under two headings.
  if (isImportedCalleeRoot(node, context)) return;
  record(tallies.moduleConstantReads, node, accessText(node));
}

function measureCall(node: Node, context: FunctionContext, tallies: Tallies): void {
  if (!Node.isCallExpression(node)) return;
  const callee = node.getExpression();
  const calleeText = callee.getText();

  if (NONDETERMINISTIC_CALLEE_TEXTS.has(calleeText) || isNondeterministicImport(callee, context)) {
    record(tallies.nondeterministicCalls, node, `${calleeText}(...)`);
  }
  if (calleeText === 'fetch' && !context.localNames.has('fetch')) {
    record(tallies.ioIndicators, node, 'fetch(...)');
  }

  const root = rootIdentifier(callee);
  if (
    root !== undefined
    && Node.isIdentifier(root)
    && !context.localNames.has(root.getText())
    && context.importedValues.has(root.getText())
  ) {
    record(tallies.importedCalls, node, `${calleeText}(...)`);
  }
}

/** Assignments and `++`/`--` are the only ways to write through a name. */
function measureWrite(node: Node, context: FunctionContext, tallies: Tallies): void {
  if (Node.isBinaryExpression(node)) {
    if (!isAssignmentOperator(node.getOperatorToken().getKind())) return;
    recordWriteTarget(node.getLeft(), node, context, tallies);
    return;
  }
  if (Node.isPrefixUnaryExpression(node) || Node.isPostfixUnaryExpression(node)) {
    const operator = node.getOperatorToken();
    if (operator !== SyntaxKind.PlusPlusToken && operator !== SyntaxKind.MinusMinusToken) return;
    recordWriteTarget(node.getOperand(), node, context, tallies);
  }
}

function recordWriteTarget(
  targetExpression: Node,
  occurrence: Node,
  context: FunctionContext,
  tallies: Tallies,
): void {
  const root = rootIdentifier(targetExpression);
  // `this.x = ...` is already counted as a `this` access.
  if (root === undefined || !Node.isIdentifier(root)) return;
  if (context.localNames.has(root.getText())) return;
  record(tallies.freeVariableWrites, occurrence);
}

// ---------------------------------------------------------------------------
// classification
// ---------------------------------------------------------------------------

/**
 * `pure` means the function is complete with its arguments and locals. `near-pure` allows the
 * one dependency that a caller does not have to build: a call to an imported symbol.
 *
 * Injected dependencies count as external use so that a constructor whose whole job is to
 * store collaborators is not reported `pure`. `moduleConstantReads` is deliberately absent:
 * a constant binding is the same on every call, so reading one asks nothing of the caller.
 */
function classifyIndependence(tallies: Tallies, injectedDependencyCount: number): Independence {
  const externalUse = tallies.thisAccess.count
    + tallies.freeVariableWrites.count
    + tallies.capturedVariableReads.count
    + tallies.nondeterministicCalls.count
    + tallies.ioIndicators.count
    + tallies.globalAccess.count
    + injectedDependencyCount;
  if (externalUse > 0) return 'impure';
  return tallies.importedCalls.count === 0 ? 'pure' : 'near-pure';
}

/**
 * Mirrors the green/yellow/red testability grading the refactor-for-testability and
 * test-expansion skills use: green needs no setup, yellow needs a small number of injectable
 * collaborators, red needs state the test cannot reach through the constructor. A captured
 * variable is exactly such state, so it grades the same way a free-variable write does.
 */
function classifyTestability(
  independence: Independence,
  counts: {
    injectedDependencyCount: number;
    freeVariableWrites: number;
    capturedVariableReads: number;
    globalAccess: number;
  },
): TestabilityGrade {
  if (independence !== 'impure') return 'green';
  const mockableThroughConstructor = counts.injectedDependencyCount <= 2
    && counts.freeVariableWrites === 0
    && counts.capturedVariableReads === 0
    && counts.globalAccess === 0;
  return mockableThroughConstructor ? 'yellow' : 'red';
}

/**
 * The `this.<name>` accesses that name a constructor parameter property, i.e. the NestJS
 * `constructor(private readonly foo: Foo)` dependencies. Base classes are included because a
 * subclass reaches an inherited dependency through the same `this.foo`.
 *
 * A constructor also reports the parameter properties it declares itself. `private readonly
 * foo: Foo` is an assignment to `this.foo` that the syntax tree never spells out, so a
 * constructor that does nothing else has an empty body and would otherwise measure as `pure`
 * while in fact requiring every one of those collaborators to exist first.
 */
function collectInjectedDependencies(node: FunctionLikeNode, thisPropertyNames: Set<string>): string[] {
  const names = new Set<string>();

  if (Node.isConstructorDeclaration(node)) {
    for (const parameter of node.getParameters()) {
      if (parameter.isParameterProperty()) names.add(parameter.getName());
    }
  }

  if (thisPropertyNames.size > 0) {
    const owner = node.getFirstAncestor(isClassLikeNode);
    const parameterProperties = owner === undefined ? undefined : constructorParameterProperties(owner);
    if (parameterProperties !== undefined) {
      for (const name of thisPropertyNames) {
        if (parameterProperties.has(name)) names.add(name);
      }
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

function constructorParameterProperties(classNode: ClassLikeNode): Set<string> {
  const cached = parameterPropertyCache.get(classNode);
  if (cached !== undefined) return cached;

  const names = new Set<string>();
  const visited = new Set<ClassLikeNode>();
  for (
    let current: ClassLikeNode | undefined = classNode;
    current !== undefined && !visited.has(current);
    current = current.getBaseClass()
  ) {
    visited.add(current);
    for (const constructor of current.getConstructors()) {
      for (const parameter of constructor.getParameters()) {
        if (parameter.isParameterProperty()) names.add(parameter.getName());
      }
    }
  }

  parameterPropertyCache.set(classNode, names);
  return names;
}

// ---------------------------------------------------------------------------
// node inspection helpers
// ---------------------------------------------------------------------------

/** True when the identifier stands for a value here, rather than naming a property or a type. */
function isValueReference(node: Identifier): boolean {
  const parent = node.getParent();
  if (parent === undefined) return false;
  // `foo.window` names a property of `foo`, not the host object.
  if (Node.isPropertyAccessExpression(parent)) return parent.getExpression() === node;
  // `ns.Type` in a type position.
  if (Node.isQualifiedName(parent)) return parent.getLeft() === node;
  // `{ window: value }` and `readonly document: string` declare a member.
  if (
    Node.isPropertyAssignment(parent)
    || Node.isPropertyDeclaration(parent)
    || Node.isPropertySignature(parent)
  ) {
    return parent.getNameNode() !== node;
  }
  return true;
}

/**
 * True when the identifier stands inside a type annotation. A qualified name (`ns.Type`) is
 * the only wrapper that can sit between the identifier and the type node holding it, so the
 * walk stops as soon as it meets anything else.
 */
function isInTypePosition(node: Identifier): boolean {
  for (let current: Node | undefined = node.getParent(); current !== undefined; current = current.getParent()) {
    if (Node.isTypeNode(current)) return true;
    if (!Node.isQualifiedName(current)) return false;
  }
  return false;
}

/** True when this identifier heads the access chain an imported call is made through. */
function isImportedCalleeRoot(node: Identifier, context: FunctionContext): boolean {
  if (!context.importedValues.has(node.getText())) return false;

  let current: Node = node;
  for (let parent = current.getParent(); parent !== undefined; parent = current.getParent()) {
    if (Node.isCallExpression(parent)) return parent.getExpression() === current;
    if (
      !Node.isAsExpression(parent)
      && !Node.isElementAccessExpression(parent)
      && !Node.isNonNullExpression(parent)
      && !Node.isParenthesizedExpression(parent)
      && !Node.isPropertyAccessExpression(parent)
    ) {
      return false;
    }
    // `map[key]()` is a call through `map`, but `map[key]` is not a call through `key`.
    if (parent.getExpression() !== current) return false;
    current = parent;
  }
  return false;
}

function isProcessEnvAccess(node: Identifier): boolean {
  const parent = node.getParent();
  return parent !== undefined && Node.isPropertyAccessExpression(parent) && parent.getName() === 'env';
}

function isNondeterministicImport(callee: Node, context: FunctionContext): boolean {
  if (!Node.isIdentifier(callee)) return false;
  const name = callee.getText();
  if (!NONDETERMINISTIC_IMPORT_NAMES.has(name) || context.localNames.has(name)) return false;
  const moduleSpecifier = context.importedValues.get(name);
  return moduleSpecifier !== undefined && NONDETERMINISTIC_MODULE_SPECIFIERS.has(moduleSpecifier);
}

/** TypeScript keeps `=` and every compound assignment operator in one contiguous kind range. */
function isAssignmentOperator(kind: SyntaxKind): boolean {
  return kind >= SyntaxKind.FirstAssignment && kind <= SyntaxKind.LastAssignment;
}

/** The identifier or `this` that an access chain such as `a.b[c].d` starts from. */
function rootIdentifier(expression: Node): Node | undefined {
  let current: Node | undefined = expression;
  while (current !== undefined) {
    if (Node.isIdentifier(current) || Node.isThisExpression(current)) return current;
    if (
      Node.isAsExpression(current)
      || Node.isElementAccessExpression(current)
      || Node.isNonNullExpression(current)
      || Node.isParenthesizedExpression(current)
      || Node.isPropertyAccessExpression(current)
    ) {
      current = current.getExpression();
      continue;
    }
    return undefined;
  }
  return undefined;
}

function returnsPromise(node: FunctionLikeNode): boolean {
  if (Node.isAsyncable(node) && node.isAsync()) return true;
  const returnTypeNode = node.getReturnTypeNode();
  return returnTypeNode !== undefined && /^Promise\s*</.test(returnTypeNode.getText());
}

/** The declaration up to its body, so a Promise-typed signature can be shown as evidence. */
function declarationHeaderText(node: FunctionLikeNode): string {
  const body = node.getBody();
  const text = node.getText();
  return body === undefined ? text : text.slice(0, body.getStart() - node.getStart());
}

/** The whole access an identifier heads, e.g. `console.warn` rather than `console`. */
function accessText(node: Identifier): string {
  const parent = node.getParent();
  return parent !== undefined && Node.isPropertyAccessExpression(parent) && parent.getExpression() === node
    ? parent.getText()
    : node.getText();
}

// ---------------------------------------------------------------------------
// tallies and report
// ---------------------------------------------------------------------------

function createTallies(): Tallies {
  return {
    thisAccess: { count: 0, samples: [] },
    freeVariableWrites: { count: 0, samples: [] },
    capturedVariableReads: { count: 0, samples: [] },
    nondeterministicCalls: { count: 0, samples: [] },
    ioIndicators: { count: 0, samples: [] },
    globalAccess: { count: 0, samples: [] },
    importedCalls: { count: 0, samples: [] },
    moduleConstantReads: { count: 0, samples: [] },
  };
}

function record(tally: Tally, node: Node, text?: string): void {
  tally.count += 1;
  if (tally.samples.length >= MAX_OCCURRENCE_SAMPLES) return;
  tally.samples.push({ line: node.getStartLineNumber(), text: truncate(text ?? node.getText()) });
}

function truncate(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length <= MAX_OCCURRENCE_TEXT_LENGTH
    ? collapsed
    : `${collapsed.slice(0, MAX_OCCURRENCE_TEXT_LENGTH)}...`;
}

function buildReport(functionReports: FunctionReport[]): IndependenceReport {
  return {
    ...createReportHeader(cwd, 'function-independence-static-analysis', options),
    analyzedFunctionCount: functionReports.length,
    byIndependence: {
      pure: countWhere(functionReports, (entry) => entry.independence === 'pure'),
      'near-pure': countWhere(functionReports, (entry) => entry.independence === 'near-pure'),
      impure: countWhere(functionReports, (entry) => entry.independence === 'impure'),
    },
    byTestabilityGrade: {
      green: countWhere(functionReports, (entry) => entry.testabilityGrade === 'green'),
      yellow: countWhere(functionReports, (entry) => entry.testabilityGrade === 'yellow'),
      red: countWhere(functionReports, (entry) => entry.testabilityGrade === 'red'),
    },
    functions: functionReports,
  };
}

function countWhere(functionReports: FunctionReport[], predicate: (entry: FunctionReport) => boolean): number {
  return functionReports.filter(predicate).length;
}
