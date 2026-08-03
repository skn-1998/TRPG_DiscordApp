import { Node, SyntaxKind, ts, type ExportSpecifier, type SourceFile } from 'ts-morph';
import { SHARED_CLI_HELP_LINES, parseSharedCliOptions, rejectUnknownArgs } from './shared/cli';
import { createAnalysisTarget, toRelativePath } from './shared/project';
import { createReportHeader, writeReport, type ReportHeader } from './shared/report';

type Mode = 'import-graph' | 'precise';

/** A single exported symbol, owned by the file that declares it. */
type ExportEntry = {
  filePath: string;
  name: string;
  kind: string;
  line: number;
  isTypeDeclaration: boolean;
  hasFrameworkDecorator: boolean;
};

type ExportReference = {
  typeOnly: boolean;
  viaNamespace: boolean;
};

type NamedReExport = {
  exportedName: string;
  sourceName: string;
  targetFilePath: string;
};

type FileImportState = {
  /** internal target file -> whether at least one edge carries a value (runtime) dependency */
  imports: Map<string, boolean>;
  externalSpecifiers: Set<string>;
  unresolvedSpecifiers: Set<string>;
};

type FileEdge = {
  filePath: string;
  importsOnlyTypes: boolean;
};

type FileReport = {
  filePath: string;
  fanOut: number;
  fanOutTypeOnly: number;
  fanIn: number;
  fanInTypeOnly: number;
  externalImportCount: number;
  unresolvedImportCount: number;
  imports: FileEdge[];
  importedBy: FileEdge[];
};

type ExportReport = ExportEntry & {
  referenceCount: number;
  valueReferenceCount: number;
  typeOnlyReferenceCount: number;
  namespaceReferenceCount: number;
  /** Uses inside the declaring file, excluding the declaration itself. See `countSameFileReferences`. */
  sameFileReferenceCount: number;
  typeOnlyUsage: boolean;
  testOnlyReferenced: boolean;
  referencedBy: string[];
  reExportedBy: string[];
};

type UnusedExportReport = {
  filePath: string;
  name: string;
  kind: string;
  line: number;
  /**
   * Separates the two candidates that otherwise look identical here: 0 means nothing in the repo
   * references the symbol (a deletion candidate), >0 means only the declaring file does (the
   * `export` keyword can go, the declaration cannot).
   */
  sameFileReferenceCount: number;
  /** null means "no known false-positive source"; otherwise why the finding is unreliable. */
  reason: string | null;
};

type DependencyReport = ReportHeader & {
  mode: Mode;
  analyzedFileCount: number;
  internalEdgeCount: number;
  externalImportCount: number;
  unresolvedImportCount: number;
  exportCount: number;
  unusedExportCount: number;
  likelyUnusedExportCount: number;
  /** Subset of `likelyUnusedExportCount` with no reference from any file, the declaring one included. */
  likelyUnreferencedExportCount: number;
  files: FileReport[];
  exports: ExportReport[];
  unusedExports: UnusedExportReport[];
};

const HELP_TEXT = [
  'Usage: pnpm run static:deps -- [options]',
  '',
  'Reports per-file fan-in/fan-out and per-export reference counts for one tsconfig.',
  'This command is advisory and always exits successfully unless the analysis itself fails.',
  '',
  'Options:',
  ...SHARED_CLI_HELP_LINES,
  '  --precise                    count cross-file export references with the type checker instead',
  '                               of import declarations (much slower; exports without a name',
  '                               node keep their import-based count). sameFileReferenceCount is',
  '                               syntactic in both modes and is unaffected by this flag.',
  '',
  'Paths in the report are cwd-relative and use "/". When --out is used, the output path',
  'must stay under .tmp/.',
  '',
].join('\n');

/** Decorators that let a framework discover a declaration at runtime, without an import. */
const FRAMEWORK_DECORATOR_NAMES = new Set([
  'Catch',
  'Controller',
  'Entity',
  'EventsHandler',
  'Global',
  'Injectable',
  'Module',
  'Processor',
  'Resolver',
  'Schema',
  'ValidatorConstraint',
  'WebSocketGateway',
]);

/** File names a framework loads directly, so their exports have no in-repo importer. */
const ENTRY_POINT_FILE_NAMES = new Set([
  'entry.client.tsx',
  'entry.server.tsx',
  'main.ts',
  'root.tsx',
]);

const cwd = process.cwd();
const { options, rest } = parseSharedCliOptions(cwd, process.argv.slice(2), HELP_TEXT);
const mode: Mode = consumeFlag(rest, '--precise') ? 'precise' : 'import-graph';
rejectUnknownArgs(rest);

const target = createAnalysisTarget(cwd, options);

const sourceFilesByPath = new Map<string, SourceFile>();
const exportEntries = new Map<string, ExportEntry>();
const exportNameNodes = new Map<string, Node>();
/** export key -> the identifier the declaring file binds locally, when the export has one. */
const exportLocalNames = new Map<string, string>();
const sameFileReferenceCounts = new Map<string, number>();
const localExportKeysByFile = new Map<string, Map<string, string>>();
const namedReExportsByFile = new Map<string, NamedReExport[]>();
const starReExportTargetsByFile = new Map<string, string[]>();
const fileImportStates = new Map<string, FileImportState>();
const referencesByExport = new Map<string, Map<string, ExportReference>>();
const reExportersByExport = new Map<string, Set<string>>();
const resolvedExportKeyCache = new Map<string, string | null>();
const reachableExportKeysCache = new Map<string, string[]>();

for (const sourceFile of target.sourceFiles) {
  const filePath = toRelativePath(cwd, sourceFile.getFilePath());
  sourceFilesByPath.set(filePath, sourceFile);
  fileImportStates.set(filePath, { imports: new Map(), externalSpecifiers: new Set(), unresolvedSpecifiers: new Set() });
  localExportKeysByFile.set(filePath, new Map());
  namedReExportsByFile.set(filePath, []);
  starReExportTargetsByFile.set(filePath, []);
}

// Pass 1: every export symbol each file declares itself.
for (const [filePath, sourceFile] of sourceFilesByPath) {
  collectLocalExports(filePath, sourceFile);
}

// Pass 2: the module graph, including the re-export edges name resolution needs.
for (const [filePath, sourceFile] of sourceFilesByPath) {
  collectModuleGraph(filePath, sourceFile);
}

// Pass 3: who references which export. Needs the complete graph from pass 2.
for (const [filePath, sourceFile] of sourceFilesByPath) {
  collectExportReferences(filePath, sourceFile);
}

// Pass 4: uses inside the declaring file. Needs every export entry, including the ones
// pass 2 adds for `export { X }` statements that forward a non-internal import.
for (const [filePath, sourceFile] of sourceFilesByPath) {
  countSameFileReferences(filePath, sourceFile);
}

if (mode === 'precise') {
  recountReferencesWithTypeChecker();
}

writeReport(cwd, options.out, buildReport());

function consumeFlag(args: string[], flag: string): boolean {
  const index = args.indexOf(flag);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

// ---------------------------------------------------------------------------
// pass 1: local exports
// ---------------------------------------------------------------------------

function collectLocalExports(filePath: string, sourceFile: SourceFile): void {
  for (const statement of sourceFile.getStatements()) {
    if (Node.isVariableStatement(statement)) {
      if (!statement.hasExportKeyword()) continue;
      for (const declaration of statement.getDeclarations()) {
        const nameNode = declaration.getNameNode();
        if (!Node.isIdentifier(nameNode)) continue;
        addExportEntry(filePath, nameNode.getText(), {
          kind: 'VariableDeclaration',
          line: declaration.getStartLineNumber(),
          isTypeDeclaration: false,
          hasFrameworkDecorator: false,
          nameNode,
        });
      }
      continue;
    }

    if (
      Node.isFunctionDeclaration(statement)
      || Node.isClassDeclaration(statement)
      || Node.isInterfaceDeclaration(statement)
      || Node.isTypeAliasDeclaration(statement)
      || Node.isEnumDeclaration(statement)
      || Node.isModuleDeclaration(statement)
    ) {
      if (!statement.hasExportKeyword()) continue;
      const nameNode: Node | undefined = statement.getNameNode();
      const exportedName = statement.hasDefaultKeyword() ? 'default' : nameNode?.getText();
      if (exportedName === undefined) continue;
      addExportEntry(filePath, exportedName, {
        kind: statement.getKindName(),
        line: statement.getStartLineNumber(),
        isTypeDeclaration: Node.isInterfaceDeclaration(statement) || Node.isTypeAliasDeclaration(statement),
        hasFrameworkDecorator: Node.isClassDeclaration(statement) && hasFrameworkDecorator(statement),
        nameNode: nameNode !== undefined && Node.isIdentifier(nameNode) ? nameNode : undefined,
      });
      continue;
    }

    if (Node.isExportAssignment(statement)) {
      addExportEntry(filePath, 'default', {
        kind: 'ExportAssignment',
        line: statement.getStartLineNumber(),
        isTypeDeclaration: false,
        hasFrameworkDecorator: false,
        nameNode: undefined,
      });
      continue;
    }

    if (!Node.isExportDeclaration(statement)) continue;

    // `export * as ns from './x'` publishes a new symbol owned by this file.
    const namespaceExport = statement.getNamespaceExport();
    if (namespaceExport !== undefined) {
      addExportEntry(filePath, namespaceExport.getName(), {
        kind: 'NamespaceExport',
        line: statement.getStartLineNumber(),
        isTypeDeclaration: false,
        hasFrameworkDecorator: false,
        nameNode: undefined,
      });
      continue;
    }

    // `export { a as b }` without a module specifier re-publishes a local declaration.
    // When the local name is an import binding instead, the statement is a re-export and
    // pass 2 resolves it against the module graph.
    if (statement.getModuleSpecifierValue() !== undefined) continue;
    for (const specifier of statement.getNamedExports()) {
      const declaration = findLocalDeclaration(sourceFile, specifier.getName());
      if (declaration === undefined) continue;
      addExportEntry(filePath, specifier.getAliasNode()?.getText() ?? specifier.getName(), {
        kind: declaration.getKindName(),
        line: declaration.getStartLineNumber(),
        isTypeDeclaration: Node.isInterfaceDeclaration(declaration) || Node.isTypeAliasDeclaration(declaration),
        hasFrameworkDecorator: hasFrameworkDecorator(declaration),
        // The specifier's own name node resolves to the imported symbol when the local name
        // is an import alias, so precise mode would otherwise measure the wrong symbol.
        nameNode: declarationNameNode(declaration),
      });
    }
  }
}

function addExportEntry(
  filePath: string,
  name: string,
  details: {
    kind: string;
    line: number;
    isTypeDeclaration: boolean;
    hasFrameworkDecorator: boolean;
    nameNode: Node | undefined;
    /** Only needed when the local binding has no name node, e.g. a forwarded import binding. */
    localName?: string;
  },
): void {
  const key = exportKey(filePath, name);
  localExportKeysByFile.get(filePath)?.set(name, key);
  if (exportEntries.has(key)) return;
  exportEntries.set(key, {
    filePath,
    name,
    kind: details.kind,
    line: details.line,
    isTypeDeclaration: details.isTypeDeclaration,
    hasFrameworkDecorator: details.hasFrameworkDecorator,
  });
  if (details.nameNode !== undefined) {
    exportNameNodes.set(key, details.nameNode);
  }
  // `export default <expr>` and `export * as ns from './x'` bind nothing locally, so they
  // stay out of this map and keep a same-file reference count of 0.
  const localName = details.localName ?? details.nameNode?.getText();
  if (localName !== undefined) {
    exportLocalNames.set(key, localName);
  }
}

function findLocalDeclaration(sourceFile: SourceFile, name: string): Node | undefined {
  return sourceFile.getFunction(name)
    ?? sourceFile.getClass(name)
    ?? sourceFile.getInterface(name)
    ?? sourceFile.getTypeAlias(name)
    ?? sourceFile.getEnum(name)
    ?? sourceFile.getVariableDeclaration(name);
}

function declarationNameNode(declaration: Node): Node | undefined {
  if (
    !Node.isVariableDeclaration(declaration)
    && !Node.isFunctionDeclaration(declaration)
    && !Node.isClassDeclaration(declaration)
    && !Node.isInterfaceDeclaration(declaration)
    && !Node.isTypeAliasDeclaration(declaration)
    && !Node.isEnumDeclaration(declaration)
  ) {
    return undefined;
  }
  const nameNode: Node | undefined = declaration.getNameNode();
  return nameNode !== undefined && Node.isIdentifier(nameNode) ? nameNode : undefined;
}

function hasFrameworkDecorator(declaration: Node | undefined): boolean {
  if (declaration === undefined || !Node.isClassDeclaration(declaration)) return false;
  return declaration.getDecorators().some((decorator) => FRAMEWORK_DECORATOR_NAMES.has(decorator.getName()));
}

function exportKey(filePath: string, name: string): string {
  return `${filePath}::${name}`;
}

// ---------------------------------------------------------------------------
// pass 2: module graph
// ---------------------------------------------------------------------------

function collectModuleGraph(filePath: string, sourceFile: SourceFile): void {
  const state = fileImportStates.get(filePath);
  if (state === undefined) return;

  for (const declaration of sourceFile.getImportDeclarations()) {
    const targetPath = recordModuleSpecifier(state, declaration.getModuleSpecifierValue(), sourceFile);
    if (targetPath === null) continue;
    // `import './x'` has no import clause and is a runtime-only dependency.
    const carriesValue = declaration.getImportClause() === undefined || !declaration.isTypeOnly();
    state.imports.set(targetPath, (state.imports.get(targetPath) ?? false) || carriesValue);
  }

  for (const declaration of sourceFile.getExportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    if (specifier === undefined) {
      collectLocalAliasReExports(filePath, sourceFile, declaration.getNamedExports());
      continue;
    }
    const targetPath = recordModuleSpecifier(state, specifier, sourceFile);
    if (targetPath === null) continue;
    state.imports.set(targetPath, (state.imports.get(targetPath) ?? false) || !declaration.isTypeOnly());

    if (declaration.getNamespaceExport() !== undefined) continue;

    const namedExports = declaration.getNamedExports();
    if (namedExports.length === 0) {
      starReExportTargetsByFile.get(filePath)?.push(targetPath);
      continue;
    }
    for (const named of namedExports) {
      const sourceName = named.getName();
      namedReExportsByFile.get(filePath)?.push({
        exportedName: named.getAliasNode()?.getText() ?? sourceName,
        sourceName,
        targetFilePath: targetPath,
      });
    }
  }
}

/**
 * Handles `export { X }` where `X` is an import binding rather than a local declaration.
 * Forwarding an in-repo symbol is a re-export, so references land on the declaring file.
 * Forwarding anything else leaves this file as the only in-repo owner of the name.
 */
function collectLocalAliasReExports(filePath: string, sourceFile: SourceFile, namedExports: ExportSpecifier[]): void {
  for (const specifier of namedExports) {
    const localName = specifier.getName();
    const exportedName = specifier.getAliasNode()?.getText() ?? localName;
    if (localExportKeysByFile.get(filePath)?.has(exportedName)) continue;

    const origin = findImportOrigin(sourceFile, localName);
    const resolution = origin === null
      ? null
      : target.resolveImport(origin.moduleSpecifier, sourceFile.getFilePath());
    if (origin !== null && resolution !== null && resolution.kind === 'internal') {
      namedReExportsByFile.get(filePath)?.push({
        exportedName,
        sourceName: origin.sourceName,
        targetFilePath: resolution.filePath,
      });
      continue;
    }

    addExportEntry(filePath, exportedName, {
      kind: 'ExportSpecifier',
      line: specifier.getStartLineNumber(),
      isTypeDeclaration: false,
      hasFrameworkDecorator: false,
      nameNode: undefined,
      localName,
    });
  }
}

function findImportOrigin(sourceFile: SourceFile, localName: string): { sourceName: string; moduleSpecifier: string } | null {
  for (const declaration of sourceFile.getImportDeclarations()) {
    const clause = declaration.getImportClause();
    if (clause === undefined) continue;
    const moduleSpecifier = declaration.getModuleSpecifierValue();
    if (clause.getDefaultImport()?.getText() === localName) {
      return { sourceName: 'default', moduleSpecifier };
    }
    for (const named of clause.getNamedImports()) {
      if ((named.getAliasNode()?.getText() ?? named.getName()) === localName) {
        return { sourceName: named.getName(), moduleSpecifier };
      }
    }
  }
  // A namespace import binds a module object rather than one export, so it has no origin name.
  return null;
}

/** Records the specifier against the file's counters and returns the internal target, if any. */
function recordModuleSpecifier(state: FileImportState, specifier: string, sourceFile: SourceFile): string | null {
  const resolution = target.resolveImport(specifier, sourceFile.getFilePath());
  if (resolution.kind === 'unresolved') {
    state.unresolvedSpecifiers.add(specifier);
    return null;
  }
  if (resolution.kind === 'external') {
    state.externalSpecifiers.add(specifier);
    return null;
  }
  if (!state.imports.has(resolution.filePath)) {
    state.imports.set(resolution.filePath, false);
  }
  return resolution.filePath;
}

// ---------------------------------------------------------------------------
// pass 3: export references
// ---------------------------------------------------------------------------

function collectExportReferences(filePath: string, sourceFile: SourceFile): void {
  const state = fileImportStates.get(filePath);
  if (state === undefined) return;

  for (const declaration of sourceFile.getImportDeclarations()) {
    const clause = declaration.getImportClause();
    if (clause === undefined) continue;
    const resolution = target.resolveImport(declaration.getModuleSpecifierValue(), sourceFile.getFilePath());
    if (resolution.kind !== 'internal') continue;

    const clauseIsTypeOnly = declaration.isTypeOnly();
    if (clause.getDefaultImport() !== undefined) {
      recordNamedReference(resolution.filePath, 'default', filePath, clauseIsTypeOnly);
    }
    if (clause.getNamespaceImport() !== undefined) {
      for (const key of reachableExportKeys(resolution.filePath)) {
        recordReference(key, filePath, { typeOnly: clauseIsTypeOnly, viaNamespace: true });
      }
    }
    for (const named of clause.getNamedImports()) {
      recordNamedReference(resolution.filePath, named.getName(), filePath, clauseIsTypeOnly || named.isTypeOnly());
    }
  }

  // A re-export forwards a name rather than using it, so it is tracked separately
  // from references: it explains why an export with no importer may still be public.
  for (const declaration of sourceFile.getExportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    if (specifier === undefined) continue;
    const resolution = target.resolveImport(specifier, sourceFile.getFilePath());
    if (resolution.kind !== 'internal') continue;

    const namedExports = declaration.getNamedExports();
    if (declaration.getNamespaceExport() !== undefined || namedExports.length === 0) {
      for (const key of reachableExportKeys(resolution.filePath)) {
        recordReExporter(key, filePath);
      }
      continue;
    }
    for (const named of namedExports) {
      const key = resolveExportKey(resolution.filePath, named.getName());
      if (key !== null) recordReExporter(key, filePath);
    }
  }
}

function recordNamedReference(targetPath: string, name: string, referencingFile: string, typeOnly: boolean): void {
  const key = resolveExportKey(targetPath, name);
  if (key === null) return;
  recordReference(key, referencingFile, { typeOnly, viaNamespace: false });
}

function recordReference(key: string, referencingFile: string, reference: ExportReference): void {
  const entry = exportEntries.get(key);
  if (entry === undefined || entry.filePath === referencingFile) return;
  let references = referencesByExport.get(key);
  if (references === undefined) {
    references = new Map();
    referencesByExport.set(key, references);
  }
  const existing = references.get(referencingFile);
  references.set(referencingFile, {
    typeOnly: (existing?.typeOnly ?? true) && reference.typeOnly,
    viaNamespace: (existing?.viaNamespace ?? true) && reference.viaNamespace,
  });
}

function recordReExporter(key: string, reExportingFile: string): void {
  const entry = exportEntries.get(key);
  if (entry === undefined || entry.filePath === reExportingFile) return;
  let reExporters = reExportersByExport.get(key);
  if (reExporters === undefined) {
    reExporters = new Set();
    reExportersByExport.set(key, reExporters);
  }
  reExporters.add(reExportingFile);
}

// ---------------------------------------------------------------------------
// export name resolution through re-export chains
// ---------------------------------------------------------------------------

/**
 * Resolves `name` as seen by an importer of `filePath` to the key of the declaring export.
 * Only the outermost call is cached: a nested lookup can be cut short by the cycle guard
 * and would then cache an incomplete answer.
 */
function resolveExportKey(filePath: string, name: string): string | null {
  const cacheKey = exportKey(filePath, name);
  const cached = resolvedExportKeyCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const resolved = resolveExportKeyWithin(filePath, name, new Set());
  resolvedExportKeyCache.set(cacheKey, resolved);
  return resolved;
}

function resolveExportKeyWithin(filePath: string, name: string, visited: Set<string>): string | null {
  const cacheKey = exportKey(filePath, name);
  if (visited.has(cacheKey)) return null;
  visited.add(cacheKey);

  const local = localExportKeysByFile.get(filePath)?.get(name);
  if (local !== undefined) return local;

  for (const reExport of namedReExportsByFile.get(filePath) ?? []) {
    if (reExport.exportedName !== name) continue;
    const resolved = resolveExportKeyWithin(reExport.targetFilePath, reExport.sourceName, visited);
    if (resolved !== null) return resolved;
  }

  for (const targetPath of starReExportTargetsByFile.get(filePath) ?? []) {
    const resolved = resolveExportKeyWithin(targetPath, name, visited);
    if (resolved !== null) return resolved;
  }

  return null;
}

/** Every export key an importer can reach through `filePath`, following re-export chains. */
function reachableExportKeys(filePath: string): string[] {
  const cached = reachableExportKeysCache.get(filePath);
  if (cached !== undefined) return cached;
  const keys = collectReachableExportKeys(filePath, new Set());
  reachableExportKeysCache.set(filePath, keys);
  return keys;
}

function collectReachableExportKeys(filePath: string, visited: Set<string>): string[] {
  if (visited.has(filePath)) return [];
  visited.add(filePath);

  const keys = new Set(localExportKeysByFile.get(filePath)?.values() ?? []);
  for (const reExport of namedReExportsByFile.get(filePath) ?? []) {
    const resolved = resolveExportKey(reExport.targetFilePath, reExport.sourceName);
    if (resolved !== null) keys.add(resolved);
  }
  for (const targetPath of starReExportTargetsByFile.get(filePath) ?? []) {
    for (const key of collectReachableExportKeys(targetPath, visited)) keys.add(key);
  }
  return [...keys];
}

// ---------------------------------------------------------------------------
// pass 4: same-file references
// ---------------------------------------------------------------------------

/**
 * Counts uses of each export inside its own file, so a candidate with no importer can be split
 * into "nothing references it" and "only this file references it, so just drop the `export`".
 *
 * The count is syntactic, matching the default mode's checker-free stance, so it cannot tell a
 * shadowing local or a merged declaration apart from a real use. Every such call is resolved
 * towards counting: over-counting only hides a deletion candidate, while under-counting invites
 * deleting a declaration the file still needs. Positions the grammar guarantees cannot denote the
 * module-scope binding (member names, property keys, import/export specifiers) are the exception --
 * counting those would drown the signal in unrelated same-spelled identifiers.
 */
function countSameFileReferences(filePath: string, sourceFile: SourceFile): void {
  const keysByLocalName = new Map<string, string[]>();
  const ownDeclarationNames = new Set<ts.Node>();
  for (const key of localExportKeysByFile.get(filePath)?.values() ?? []) {
    const localName = exportLocalNames.get(key);
    if (localName === undefined) continue;
    const keys = keysByLocalName.get(localName);
    if (keys === undefined) keysByLocalName.set(localName, [key]);
    else keys.push(key);
    const nameNode = exportNameNodes.get(key);
    // Only the recorded declaration is excluded. A second declaration of the same name (a merged
    // interface, a shadowing local) stays counted, on the "do not claim it is unused" side.
    if (nameNode !== undefined) ownDeclarationNames.add(nameNode.compilerNode);
  }
  if (keysByLocalName.size === 0) return;

  const countsByLocalName = new Map<string, number>();
  const visit = (node: ts.Node, parent: ts.Node | undefined): void => {
    if (ts.isIdentifier(node) && keysByLocalName.has(node.text) && isSameFileReference(node, parent, ownDeclarationNames)) {
      countsByLocalName.set(node.text, (countsByLocalName.get(node.text) ?? 0) + 1);
    }
    node.forEachChild((child) => {
      visit(child, node);
    });
  };
  visit(sourceFile.compilerNode, undefined);

  for (const [localName, keys] of keysByLocalName) {
    const count = countsByLocalName.get(localName) ?? 0;
    for (const key of keys) sameFileReferenceCounts.set(key, count);
  }
}

/** Whether an identifier spelled like an export can denote that export's module-scope binding. */
function isSameFileReference(node: ts.Identifier, parent: ts.Node | undefined, ownDeclarationNames: Set<ts.Node>): boolean {
  if (parent === undefined || ownDeclarationNames.has(node)) return false;
  // `obj.name`, `Namespace.Name` in a type: the identifier names a member of something else.
  if (ts.isPropertyAccessExpression(parent)) return parent.name !== node;
  if (ts.isQualifiedName(parent)) return parent.right !== node;
  // Keys, not values. `{ name }` shorthand is a real read and is deliberately not listed here.
  if (ts.isPropertyAssignment(parent)) return parent.name !== node;
  if (ts.isBindingElement(parent)) return parent.propertyName !== node;
  if (ts.isJsxAttribute(parent)) return parent.name !== node;
  if (ts.isMetaProperty(parent)) return false;
  if (isMemberDeclarationName(parent, node)) return false;
  // An import binds the name and an export publishes it; neither uses what the file already has.
  // `export { X }` therefore leaves X's count at 0 even though removing X breaks the statement --
  // an omission the compiler reports loudly, unlike deleting a declaration another line reads.
  return !ts.isImportSpecifier(parent)
    && !ts.isExportSpecifier(parent)
    && !ts.isImportClause(parent)
    && !ts.isNamespaceImport(parent)
    && !ts.isNamespaceExport(parent);
}

function isMemberDeclarationName(parent: ts.Node, node: ts.Identifier): boolean {
  if (
    ts.isPropertyDeclaration(parent)
    || ts.isPropertySignature(parent)
    || ts.isMethodDeclaration(parent)
    || ts.isMethodSignature(parent)
    || ts.isGetAccessorDeclaration(parent)
    || ts.isSetAccessorDeclaration(parent)
    || ts.isEnumMember(parent)
  ) {
    return parent.name === node;
  }
  return false;
}

// ---------------------------------------------------------------------------
// precise mode
// ---------------------------------------------------------------------------

/** Recounts cross-file references only; same-file counts stay as pass 4 measured them. */
function recountReferencesWithTypeChecker(): void {
  const languageService = target.project.getLanguageService();
  for (const [key, nameNode] of exportNameNodes) {
    const entry = exportEntries.get(key);
    if (entry === undefined) continue;
    const references = new Map<string, ExportReference>();
    for (const node of languageService.findReferencesAsNodes(nameNode)) {
      const referencingFile = toRelativePath(cwd, node.getSourceFile().getFilePath());
      if (!sourceFilesByPath.has(referencingFile) || referencingFile === entry.filePath) continue;
      // A re-export forwards the name rather than using it. The language service can report
      // the whole `export { ... }` list as one node, so match on the declaration, not the
      // individual specifier.
      if (node.getFirstAncestorByKind(SyntaxKind.ExportDeclaration) !== undefined) continue;
      const typeOnly = isTypeOnlyReferenceNode(node);
      const existing = references.get(referencingFile);
      references.set(referencingFile, {
        typeOnly: (existing?.typeOnly ?? true) && typeOnly,
        viaNamespace: false,
      });
    }
    referencesByExport.set(key, references);
  }
}

function isTypeOnlyReferenceNode(node: Node): boolean {
  for (let current: Node | undefined = node; current !== undefined; current = current.getParent()) {
    if (Node.isTypeNode(current)) return true;
    if (Node.isImportSpecifier(current) && current.isTypeOnly()) return true;
    if (Node.isImportDeclaration(current)) return current.isTypeOnly();
    if (Node.isSourceFile(current)) return false;
  }
  return false;
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

function buildReport(): DependencyReport {
  const files = buildFileReports();
  const exports = buildExportReports();
  const unusedExports = buildUnusedExportReports(exports);

  return {
    ...createReportHeader(cwd, 'dependency-static-analysis', options),
    mode,
    analyzedFileCount: files.length,
    internalEdgeCount: files.reduce((total, file) => total + file.fanOut, 0),
    externalImportCount: files.reduce((total, file) => total + file.externalImportCount, 0),
    unresolvedImportCount: files.reduce((total, file) => total + file.unresolvedImportCount, 0),
    exportCount: exports.length,
    unusedExportCount: unusedExports.length,
    likelyUnusedExportCount: unusedExports.filter((unused) => unused.reason === null).length,
    // `reason === null` already rules out the test-only case, so it implies zero cross-file
    // references; adding the same-file count leaves the exports nothing in the repo reads.
    likelyUnreferencedExportCount: unusedExports
      .filter((unused) => unused.reason === null && unused.sameFileReferenceCount === 0).length,
    files,
    exports,
    unusedExports,
  };
}

function buildFileReports(): FileReport[] {
  const importedBy = new Map<string, FileEdge[]>();
  for (const filePath of fileImportStates.keys()) {
    importedBy.set(filePath, []);
  }
  for (const [filePath, state] of fileImportStates) {
    for (const [targetPath, hasValue] of state.imports) {
      importedBy.get(targetPath)?.push({ filePath, importsOnlyTypes: !hasValue });
    }
  }

  return [...fileImportStates].map(([filePath, state]) => {
    const imports = [...state.imports]
      .map(([targetPath, hasValue]) => ({ filePath: targetPath, importsOnlyTypes: !hasValue }))
      .sort(byFilePath);
    const importers = (importedBy.get(filePath) ?? []).sort(byFilePath);
    return {
      filePath,
      fanOut: imports.length,
      fanOutTypeOnly: imports.filter((edge) => edge.importsOnlyTypes).length,
      fanIn: importers.length,
      fanInTypeOnly: importers.filter((edge) => edge.importsOnlyTypes).length,
      externalImportCount: state.externalSpecifiers.size,
      unresolvedImportCount: state.unresolvedSpecifiers.size,
      imports,
      importedBy: importers,
    };
  }).sort(byFilePath);
}

function buildExportReports(): ExportReport[] {
  return [...exportEntries].map(([key, entry]) => {
    const references = [...(referencesByExport.get(key) ?? new Map<string, ExportReference>())];
    const referencedBy = references.map(([filePath]) => filePath).sort(compareStrings);
    const valueReferenceCount = references.filter(([, reference]) => !reference.typeOnly).length;
    return {
      ...entry,
      referenceCount: references.length,
      valueReferenceCount,
      typeOnlyReferenceCount: references.length - valueReferenceCount,
      namespaceReferenceCount: references.filter(([, reference]) => reference.viaNamespace).length,
      sameFileReferenceCount: sameFileReferenceCounts.get(key) ?? 0,
      typeOnlyUsage: references.length > 0 && valueReferenceCount === 0,
      testOnlyReferenced: references.length > 0 && referencedBy.every(isTestFile),
      referencedBy,
      reExportedBy: [...(reExportersByExport.get(key) ?? new Set<string>())].sort(compareStrings),
    };
  }).sort(byExportOrder);
}

function buildUnusedExportReports(exports: ExportReport[]): UnusedExportReport[] {
  return exports
    .filter((entry) => entry.referenceCount === 0 || entry.testOnlyReferenced)
    .map((entry) => ({
      filePath: entry.filePath,
      name: entry.name,
      kind: entry.kind,
      line: entry.line,
      sameFileReferenceCount: entry.sameFileReferenceCount,
      reason: unusedExportReason(entry),
    }))
    .sort(byExportOrder);
}

function unusedExportReason(entry: ExportReport): string | null {
  if (entry.testOnlyReferenced) return 'referenced-only-from-tests';
  if (isEntryPointFile(entry.filePath)) return 'declared-in-entry-point';
  if (entry.hasFrameworkDecorator) return 'framework-decorated';
  if (entry.reExportedBy.length > 0) return 're-exported-by-another-module';
  return null;
}

function isEntryPointFile(filePath: string): boolean {
  const segments = filePath.split('/');
  const fileName = segments[segments.length - 1] ?? '';
  return ENTRY_POINT_FILE_NAMES.has(fileName) || segments.includes('routes');
}

function isTestFile(filePath: string): boolean {
  if (/\.(spec|test)\.tsx?$/.test(filePath)) return true;
  return filePath.split('/').some((segment) => segment === '__tests__' || segment === 'test' || segment === 'tests');
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function byFilePath(left: { filePath: string }, right: { filePath: string }): number {
  return left.filePath.localeCompare(right.filePath);
}

function byExportOrder(
  left: { filePath: string; line: number; name: string },
  right: { filePath: string; line: number; name: string },
): number {
  return left.filePath.localeCompare(right.filePath) || left.line - right.line || left.name.localeCompare(right.name);
}
