import { existsSync } from 'node:fs';
import path from 'node:path';
import { Project, ts, type SourceFile } from 'ts-morph';

/** Directory names that never hold analyzable first-party sources. */
const EXCLUDED_PATH_SEGMENTS = new Set([
  '.temp',
  '.tmp',
  'coverage',
  'dist',
  'logs',
  'node_modules',
  'outputs',
]);

export type ImportResolution =
  | { kind: 'internal'; filePath: string }
  | { kind: 'external' }
  | { kind: 'unresolved' };

export type AnalysisTarget = {
  project: Project;
  /** Analyzable source files, sorted by cwd-relative path. */
  sourceFiles: SourceFile[];
  /**
   * Resolves a module specifier the way the tsconfig does (baseUrl/paths aware).
   * Anything resolving outside the analyzed file set (npm packages, `.d.ts`, sibling
   * workspace packages) is reported as `external`.
   */
  resolveImport(specifier: string, containingFilePath: string): ImportResolution;
};

export type AnalysisTargetOptions = {
  projectPath: string;
  includeGlobs: string[] | null;
};

export function createAnalysisTarget(cwd: string, options: AnalysisTargetOptions): AnalysisTarget {
  const project = new Project({
    tsConfigFilePath: options.projectPath,
    skipAddingFilesFromTsConfig: options.includeGlobs !== null,
    skipFileDependencyResolution: true,
  });
  if (options.includeGlobs !== null) {
    project.addSourceFilesAtPaths(options.includeGlobs);
  }

  const sourceFiles = project.getSourceFiles()
    .filter((sourceFile) => isAnalyzableSourceFile(cwd, sourceFile))
    .sort((left, right) => toRelativePath(cwd, left.getFilePath()).localeCompare(toRelativePath(cwd, right.getFilePath())));

  const toCanonicalPath = ts.sys.useCaseSensitiveFileNames
    ? (filePath: string) => normalizeSlashes(filePath)
    : (filePath: string) => normalizeSlashes(filePath).toLowerCase();

  const analyzedPathsByCanonical = new Map<string, string>();
  for (const sourceFile of sourceFiles) {
    analyzedPathsByCanonical.set(toCanonicalPath(sourceFile.getFilePath()), toRelativePath(cwd, sourceFile.getFilePath()));
  }

  const compilerOptions = project.getCompilerOptions();
  const resolutionCache = ts.createModuleResolutionCache(cwd, toCanonicalPath, compilerOptions);

  const resolveImport = (specifier: string, containingFilePath: string): ImportResolution => {
    const resolved = ts.resolveModuleName(specifier, containingFilePath, compilerOptions, ts.sys, resolutionCache);
    const resolvedFileName = resolved.resolvedModule?.resolvedFileName;
    if (resolvedFileName === undefined) {
      // Ambient module declarations (`declare module 'crypto'`) have no file to resolve to,
      // so a bare specifier without a file is external rather than broken. A bare specifier
      // that should have matched a tsconfig path alias lands here too, but `tsc` already
      // rejects those, so the repo cannot hold one.
      return isRelativeSpecifier(specifier) ? { kind: 'unresolved' } : { kind: 'external' };
    }
    const filePath = analyzedPathsByCanonical.get(toCanonicalPath(resolvedFileName));
    return filePath === undefined ? { kind: 'external' } : { kind: 'internal', filePath };
  };

  return { project, sourceFiles, resolveImport };
}

function isAnalyzableSourceFile(cwd: string, sourceFile: SourceFile): boolean {
  const filePath = sourceFile.getFilePath();
  if (!existsSync(filePath) || filePath.endsWith('.d.ts')) return false;
  const relative = toRelativePath(cwd, filePath);
  return relative.split('/').every((segment) => !EXCLUDED_PATH_SEGMENTS.has(segment));
}

export function toRelativePath(cwd: string, filePath: string): string {
  return normalizeSlashes(path.relative(cwd, filePath));
}

function normalizeSlashes(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function isRelativeSpecifier(specifier: string): boolean {
  return specifier === '.' || specifier === '..' || /^\.\.?[/\\]/.test(specifier);
}
