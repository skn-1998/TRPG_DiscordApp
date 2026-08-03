import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { toRelativePath } from './project';

/** Fields every analysis report in this package starts with. */
export type ReportHeader = {
  schemaVersion: 1;
  kind: string;
  generatedAt: string | null;
  projectPath: string;
  includeGlobs: string[] | null;
};

export type ReportHeaderOptions = {
  projectPath: string;
  includeGlobs: string[] | null;
  includeGeneratedAt: boolean;
};

export function createReportHeader(cwd: string, kind: string, options: ReportHeaderOptions): ReportHeader {
  return {
    schemaVersion: 1,
    kind,
    generatedAt: options.includeGeneratedAt ? new Date().toISOString() : null,
    projectPath: toRelativePath(cwd, options.projectPath),
    includeGlobs: options.includeGlobs,
  };
}

export function writeReport(cwd: string, out: string | null, report: unknown): void {
  const content = `${JSON.stringify(report, null, 2)}\n`;
  if (out === null) {
    process.stdout.write(content);
    return;
  }
  const outPath = safeTmpOutputPath(cwd, out);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, 'utf8');
}

function safeTmpOutputPath(cwd: string, out: string): string {
  const resolved = path.resolve(cwd, out);
  const tmpRoot = path.resolve(cwd, '.tmp');
  const relative = path.relative(tmpRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('--out must resolve inside .tmp/');
  }
  return resolved;
}
