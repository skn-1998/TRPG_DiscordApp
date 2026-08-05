import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Node, Project, SyntaxKind, type Node as TsMorphNode, type SourceFile, type Statement } from 'ts-morph'

type CliOptions = {
  out: string | null
  includeGeneratedAt: boolean
  includeGlobs: string[]
  fileWarningLineThreshold: number
  functionWarningLineThreshold: number
}

type WarningReport = {
  ruleId: 'large-file' | 'large-function'
  severity: 'warning'
  message: string
  filePath: string
  startLine: number
  endLine: number
  lineCount: number
  threshold: number
  symbolName: string | null
  kind: string
}

type FileReport = {
  filePath: string
  lineCount: number
  nonEmptyLineCount: number
  importCount: number
  topLevelDeclarationCount: number
  maxFunctionLineCount: number
  warnings: WarningReport[]
}

type AnalysisReport = {
  schemaVersion: 1
  kind: 'large-file-static-analysis'
  generatedAt: string | null
  thresholds: {
    fileWarningLineThreshold: number
    functionWarningLineThreshold: number
  }
  includeGlobs: string[]
  analyzedFileCount: number
  warningCount: number
  warnings: WarningReport[]
  files: FileReport[]
}

const DEFAULT_INCLUDE_GLOBS = ['src/**/*.ts', 'test/**/*.ts']
const DEFAULT_FILE_WARNING_LINE_THRESHOLD = 800
const DEFAULT_FUNCTION_WARNING_LINE_THRESHOLD = 200
const EXCLUDED_PATH_SEGMENTS = new Set(['.temp', '.tmp', 'coverage', 'dist', 'logs', 'node_modules', 'outputs'])

const options = parseArgs(process.argv.slice(2))
const cwd = process.cwd()
const project = new Project({
  tsConfigFilePath: path.join(cwd, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true
})

project.addSourceFilesAtPaths(options.includeGlobs)

const sourceFiles = project
  .getSourceFiles()
  .filter((sourceFile) => isAnalyzableSourceFile(cwd, sourceFile))
  .sort((left, right) => relativePath(cwd, left.getFilePath()).localeCompare(relativePath(cwd, right.getFilePath())))

const files = sourceFiles.map((sourceFile) => analyzeSourceFile(sourceFile, cwd, options))
const warnings = files
  .flatMap((file) => file.warnings)
  .sort((left, right) => {
    const pathOrder = left.filePath.localeCompare(right.filePath)
    return pathOrder || left.startLine - right.startLine || left.ruleId.localeCompare(right.ruleId)
  })

const report: AnalysisReport = {
  schemaVersion: 1,
  kind: 'large-file-static-analysis',
  generatedAt: options.includeGeneratedAt ? new Date().toISOString() : null,
  thresholds: {
    fileWarningLineThreshold: options.fileWarningLineThreshold,
    functionWarningLineThreshold: options.functionWarningLineThreshold
  },
  includeGlobs: options.includeGlobs,
  analyzedFileCount: files.length,
  warningCount: warnings.length,
  warnings,
  files: files.sort((left, right) => right.lineCount - left.lineCount || left.filePath.localeCompare(right.filePath))
}

const content = `${JSON.stringify(report, null, 2)}\n`
if (options.out) {
  const outPath = safeTmpOutputPath(cwd, options.out)
  mkdirSync(path.dirname(outPath), { recursive: true })
  writeFileSync(outPath, content, 'utf8')
} else {
  process.stdout.write(content)
}

function parseArgs(args: string[]): CliOptions {
  let out: string | null = null
  let includeGeneratedAt = false
  let includeGlobs = [...DEFAULT_INCLUDE_GLOBS]
  let fileWarningLineThreshold = DEFAULT_FILE_WARNING_LINE_THRESHOLD
  let functionWarningLineThreshold = DEFAULT_FUNCTION_WARNING_LINE_THRESHOLD

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--') {
      continue
    }
    if (arg === '--out') {
      out = requireArgValue(args, index, '--out')
      index += 1
      continue
    }
    if (arg === '--include') {
      includeGlobs = requireArgValue(args, index, '--include')
        .split(',')
        .map((glob) => glob.trim())
        .filter(Boolean)
      index += 1
      continue
    }
    if (arg === '--file-warning-lines') {
      fileWarningLineThreshold = parsePositiveInteger(
        requireArgValue(args, index, '--file-warning-lines'),
        '--file-warning-lines'
      )
      index += 1
      continue
    }
    if (arg === '--function-warning-lines') {
      functionWarningLineThreshold = parsePositiveInteger(
        requireArgValue(args, index, '--function-warning-lines'),
        '--function-warning-lines'
      )
      index += 1
      continue
    }
    if (arg === '--include-generated-at') {
      includeGeneratedAt = true
      continue
    }
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        [
          'Usage: pnpm run refactor:large-files:analyze -- [options]',
          '',
          'Reports large TypeScript files and large function-like declarations as warnings.',
          'This command is advisory and always exits successfully unless the script itself fails.',
          '',
          'Options:',
          '  --out .tmp/refactor/large-files.json',
          '  --include "src/discord/**/*.ts,src/domains/**/*.ts"',
          `  --file-warning-lines ${DEFAULT_FILE_WARNING_LINE_THRESHOLD}`,
          `  --function-warning-lines ${DEFAULT_FUNCTION_WARNING_LINE_THRESHOLD}`,
          '  --include-generated-at',
          '',
          'When --out is used, the output path must stay under .tmp/.',
          ''
        ].join('\n')
      )
      process.exit(0)
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return {
    out,
    includeGeneratedAt,
    includeGlobs,
    fileWarningLineThreshold,
    functionWarningLineThreshold
  }
}

function requireArgValue(args: string[], index: number, name: string): string {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`)
  }
  return value
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}

function analyzeSourceFile(sourceFile: SourceFile, cwd: string, options: CliOptions): FileReport {
  const filePath = relativePath(cwd, sourceFile.getFilePath())
  const lines = sourceFile.getFullText().split(/\r\n|\r|\n/)
  const lineCount = countLines(sourceFile.getFullText())
  const nonEmptyLineCount = lines.filter((line) => line.trim().length > 0).length
  const functionReports = functionLikeNodes(sourceFile).map((node) => functionWarningReport(filePath, node, options))
  const warnings = [largeFileWarningReport(filePath, lineCount, options), ...functionReports].filter(
    (warning): warning is WarningReport => warning !== null
  )

  return {
    filePath,
    lineCount,
    nonEmptyLineCount,
    importCount: sourceFile.getImportDeclarations().length,
    topLevelDeclarationCount: topLevelDeclarationCount(sourceFile),
    maxFunctionLineCount: Math.max(0, ...functionReports.map((warning) => warning?.lineCount ?? 0)),
    warnings
  }
}

function largeFileWarningReport(filePath: string, lineCount: number, options: CliOptions): WarningReport | null {
  if (lineCount < options.fileWarningLineThreshold) return null
  return {
    ruleId: 'large-file',
    severity: 'warning',
    message: `File has ${lineCount} lines; consider splitting when touching it.`,
    filePath,
    startLine: 1,
    endLine: lineCount,
    lineCount,
    threshold: options.fileWarningLineThreshold,
    symbolName: null,
    kind: 'SourceFile'
  }
}

function functionWarningReport(filePath: string, node: TsMorphNode, options: CliOptions): WarningReport | null {
  const startLine = node.getStartLineNumber()
  const endLine = node.getEndLineNumber()
  const lineCount = endLine - startLine + 1
  if (lineCount < options.functionWarningLineThreshold) return null
  const symbolName = functionLikeName(node)
  const kind = node.getKindName()
  return {
    ruleId: 'large-function',
    severity: 'warning',
    message: `${symbolName ?? kind} has ${lineCount} lines; consider extracting focused helpers when changing it.`,
    filePath,
    startLine,
    endLine,
    lineCount,
    threshold: options.functionWarningLineThreshold,
    symbolName,
    kind
  }
}

function functionLikeNodes(sourceFile: SourceFile): TsMorphNode[] {
  const nodes: TsMorphNode[] = []
  sourceFile.forEachDescendant((node) => {
    if (isFunctionLikeNode(node)) {
      nodes.push(node)
    }
  })
  return nodes
}

function isFunctionLikeNode(node: TsMorphNode): boolean {
  return (
    Node.isFunctionDeclaration(node) ||
    Node.isFunctionExpression(node) ||
    Node.isArrowFunction(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isConstructorDeclaration(node) ||
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node)
  )
}

function functionLikeName(node: TsMorphNode): string | null {
  if (
    Node.isFunctionDeclaration(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node)
  ) {
    return node.getName() ?? null
  }
  if (Node.isConstructorDeclaration(node)) {
    const classDeclaration = node.getParentIfKind(SyntaxKind.ClassDeclaration)
    return classDeclaration?.getName() ? `${classDeclaration.getName()}.constructor` : 'constructor'
  }
  const parent = node.getParent()
  if (parent && Node.isVariableDeclaration(parent)) {
    return parent.getName()
  }
  if (parent && Node.isPropertyAssignment(parent)) {
    return parent.getName()
  }
  if (parent && Node.isCallExpression(parent)) {
    // A callee written as a chained builder spans lines, and a name is one field of a report.
    return parent.getExpression().getText().replace(/\s+/g, ' ').trim()
  }
  return null
}

function topLevelDeclarationCount(sourceFile: SourceFile): number {
  return sourceFile.getStatements().reduce((count, statement) => count + statementDeclarationCount(statement), 0)
}

function statementDeclarationCount(statement: Statement): number {
  if (Node.isVariableStatement(statement)) {
    return statement.getDeclarations().length
  }
  if (
    Node.isFunctionDeclaration(statement) ||
    Node.isClassDeclaration(statement) ||
    Node.isInterfaceDeclaration(statement) ||
    Node.isTypeAliasDeclaration(statement) ||
    Node.isEnumDeclaration(statement) ||
    Node.isModuleDeclaration(statement)
  ) {
    return 1
  }
  return 0
}

function countLines(text: string): number {
  if (text.length === 0) return 0
  const lines = text.split(/\r\n|\r|\n/)
  const hasTrailingNewline = /\r\n$|\r$|\n$/.test(text)
  return lines.length - (hasTrailingNewline ? 1 : 0)
}

function isAnalyzableSourceFile(cwd: string, sourceFile: SourceFile): boolean {
  const filePath = sourceFile.getFilePath()
  if (!existsSync(filePath) || filePath.endsWith('.d.ts')) return false
  const relative = relativePath(cwd, filePath)
  return relative.split('/').every((segment) => !EXCLUDED_PATH_SEGMENTS.has(segment))
}

function relativePath(cwd: string, filePath: string): string {
  return path.relative(cwd, filePath).replace(/\\/g, '/')
}

function safeTmpOutputPath(cwd: string, out: string): string {
  const resolved = path.resolve(cwd, out)
  const tmpRoot = path.resolve(cwd, '.tmp')
  const relative = path.relative(tmpRoot, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('--out must resolve inside .tmp/')
  }
  return resolved
}
