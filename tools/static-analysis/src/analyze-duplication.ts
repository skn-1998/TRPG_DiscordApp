import { createHash } from 'node:crypto';
import { Node, ts, type SourceFile } from 'ts-morph';
import { SHARED_CLI_HELP_LINES, parseSharedCliOptions, rejectUnknownArgs, requireArgValue } from './shared/cli';
import { functionLikeName, isFunctionLikeNode, type FunctionLikeNode } from './shared/function-like';
import { createAnalysisTarget, toRelativePath } from './shared/project';
import { createReportHeader, writeReport, type ReportHeader } from './shared/report';

/** One analyzed function-like declaration, with everything grouping and reporting need. */
type FunctionEntry = {
  filePath: string;
  symbolName: string | null;
  kind: string;
  startLine: number;
  endLine: number;
  structureHash: string;
  /** AST nodes in the body, i.e. how much logic the hash covers. */
  nodeCount: number;
  /** Written parameter and return type annotations, whitespace-normalized. */
  signature: string;
  /** Whole declaration text, whitespace-normalized. */
  normalizedText: string;
};

type DuplicateMember = {
  filePath: string;
  symbolName: string | null;
  kind: string;
  startLine: number;
  endLine: number;
};

type DuplicateGroup = {
  structureHash: string;
  occurrenceCount: number;
  nodeCount: number;
  /** How many files the members are spread over; duplication inside one file is a smaller problem. */
  distinctFileCount: number;
  /** Whether the written parameter and return types also agree, a strong sign of real duplication. */
  signatureMatch: boolean;
  /** Whether the sources agree once whitespace is normalized, i.e. a plain copy-paste. */
  identicalText: boolean;
  members: DuplicateMember[];
};

type DuplicationReport = ReportHeader & {
  minNodes: number;
  analyzedFunctionCount: number;
  skippedSmallFunctionCount: number;
  duplicateGroupCount: number;
  duplicatedFunctionCount: number;
  duplicateGroups: DuplicateGroup[];
};

const DEFAULT_MIN_NODES = 20;

const HELP_TEXT = [
  'Usage: pnpm run static:duplication -- [options]',
  '',
  'Reports groups of function-like declarations whose bodies have the same AST shape.',
  'Identifier names and literal values are dropped from the comparison, so a copy that',
  'only renames variables still matches.',
  'This command is advisory and always exits successfully unless the analysis itself fails.',
  '',
  'Options:',
  ...SHARED_CLI_HELP_LINES,
  `  --min-nodes <count>          skip functions whose body has fewer AST nodes (default: ${DEFAULT_MIN_NODES});`,
  '                               bodies such as `x => x.id` match each other by the dozen',
  '                               without being duplication worth reporting',
  '',
  'Paths in the report are cwd-relative and use "/". When --out is used, the output path',
  'must stay under .tmp/.',
  '',
].join('\n');

/** SyntaxKind number to name. Alias members share a value, so the first declared name wins. */
const SYNTAX_KIND_NAMES = buildSyntaxKindNames();

const cwd = process.cwd();
const { options, rest } = parseSharedCliOptions(cwd, process.argv.slice(2), HELP_TEXT);
const minNodesArg = consumeOptionValue(rest, '--min-nodes');
const minNodes = minNodesArg === null ? DEFAULT_MIN_NODES : parsePositiveInteger(minNodesArg, '--min-nodes');
rejectUnknownArgs(rest);

const target = createAnalysisTarget(cwd, options);

const entries: FunctionEntry[] = [];
let analyzedFunctionCount = 0;
let skippedSmallFunctionCount = 0;

for (const sourceFile of target.sourceFiles) {
  collectFunctionEntries(sourceFile);
}

writeReport(cwd, options.out, buildReport());

function consumeOptionValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = requireArgValue(args, index, flag);
  args.splice(index, 2);
  return value;
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// collection
// ---------------------------------------------------------------------------

function collectFunctionEntries(sourceFile: SourceFile): void {
  const filePath = toRelativePath(cwd, sourceFile.getFilePath());
  sourceFile.forEachDescendant((node) => {
    if (!isFunctionLikeNode(node)) return;
    // Overload signatures and abstract or ambient members hold no logic to compare.
    const body = node.getBody();
    if (body === undefined) return;

    analyzedFunctionCount += 1;
    const structure = hashBodyStructure(body.compilerNode);
    if (structure.nodeCount < minNodes) {
      skippedSmallFunctionCount += 1;
      return;
    }

    entries.push({
      filePath,
      symbolName: functionLikeName(node),
      kind: node.getKindName(),
      startLine: node.getStartLineNumber(),
      endLine: node.getEndLineNumber(),
      structureHash: structure.structureHash,
      nodeCount: structure.nodeCount,
      signature: typeSignatureText(node),
      normalizedText: normalizeWhitespace(node.getText()),
    });
  });
}

/**
 * Written parameter and return type annotations. Inferred types would need the type
 * checker on every function, which costs far more than the extra signal is worth here.
 */
function typeSignatureText(node: FunctionLikeNode): string {
  const parameterTypes = node.getParameters()
    .map((parameter) => normalizeWhitespace(parameter.getTypeNode()?.getText() ?? ''));
  const returnType = Node.isReturnTyped(node) ? normalizeWhitespace(node.getReturnTypeNode()?.getText() ?? '') : '';
  return `(${parameterTypes.join(', ')}) => ${returnType}`;
}

// ---------------------------------------------------------------------------
// structure hash
// ---------------------------------------------------------------------------

/**
 * Hashes the body as a pre-order sequence of SyntaxKind names, with `(`/`)` markers so
 * the flat sequence still encodes the tree shape. Only kind names are emitted, so
 * identifier names and literal values drop out: `Identifier`, `StringLiteral` and
 * `NumericLiteral` survive as kinds while `userId`, `'slot'` and `42` do not. Operator
 * tokens are real AST nodes and do survive, so `a + b` stays distinct from `a - b`.
 * The walk runs on compiler nodes because wrapping every descendant in a ts-morph node
 * costs several times more for the same answer.
 */
function hashBodyStructure(body: ts.Node): { structureHash: string; nodeCount: number } {
  const tokens: string[] = [];
  let nodeCount = 0;

  const visit = (node: ts.Node): void => {
    nodeCount += 1;
    tokens.push(syntaxKindName(node.kind), '(');
    node.forEachChild(visit);
    tokens.push(')');
  };
  visit(body);

  return { structureHash: createHash('sha1').update(tokens.join('')).digest('hex'), nodeCount };
}

function syntaxKindName(kind: ts.SyntaxKind): string {
  return SYNTAX_KIND_NAMES.get(kind) ?? String(kind);
}

function buildSyntaxKindNames(): Map<number, string> {
  const names = new Map<number, string>();
  for (const [name, value] of Object.entries(ts.SyntaxKind)) {
    if (typeof value === 'number' && !names.has(value)) names.set(value, name);
  }
  return names;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

function buildReport(): DuplicationReport {
  const duplicateGroups = buildDuplicateGroups();

  return {
    ...createReportHeader(cwd, 'structural-duplication-static-analysis', options),
    minNodes,
    analyzedFunctionCount,
    skippedSmallFunctionCount,
    duplicateGroupCount: duplicateGroups.length,
    duplicatedFunctionCount: duplicateGroups.reduce((total, group) => total + group.occurrenceCount, 0),
    duplicateGroups,
  };
}

function buildDuplicateGroups(): DuplicateGroup[] {
  const entriesByHash = new Map<string, FunctionEntry[]>();
  for (const entry of entries) {
    const group = entriesByHash.get(entry.structureHash);
    if (group === undefined) entriesByHash.set(entry.structureHash, [entry]);
    else group.push(entry);
  }

  const groups: DuplicateGroup[] = [];
  for (const [structureHash, members] of entriesByHash) {
    if (members.length < 2) continue;
    const sorted = [...members].sort(byMemberOrder);
    const first = sorted[0];
    groups.push({
      structureHash,
      occurrenceCount: sorted.length,
      // Equal hashes mean equal token sequences, so every member has the same node count.
      nodeCount: first.nodeCount,
      distinctFileCount: new Set(sorted.map((member) => member.filePath)).size,
      signatureMatch: sorted.every((member) => member.signature === first.signature),
      identicalText: sorted.every((member) => member.normalizedText === first.normalizedText),
      members: sorted.map(toDuplicateMember),
    });
  }
  return groups.sort(byDuplicateGroupOrder);
}

function toDuplicateMember(entry: FunctionEntry): DuplicateMember {
  return {
    filePath: entry.filePath,
    symbolName: entry.symbolName,
    kind: entry.kind,
    startLine: entry.startLine,
    endLine: entry.endLine,
  };
}

function byMemberOrder(left: FunctionEntry, right: FunctionEntry): number {
  return left.filePath.localeCompare(right.filePath) || left.startLine - right.startLine;
}

/** Spread across files first, then size of the cluster, then how much logic it covers. */
function byDuplicateGroupOrder(left: DuplicateGroup, right: DuplicateGroup): number {
  return right.distinctFileCount - left.distinctFileCount
    || right.occurrenceCount - left.occurrenceCount
    || right.nodeCount - left.nodeCount
    || left.members[0].filePath.localeCompare(right.members[0].filePath)
    || left.members[0].startLine - right.members[0].startLine
    || left.structureHash.localeCompare(right.structureHash);
}
