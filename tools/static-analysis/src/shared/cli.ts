import path from 'node:path';

/** Arguments every analysis tool in this package accepts. */
export type SharedCliOptions = {
  /** Absolute path of the tsconfig.json that defines the analysis target. */
  projectPath: string;
  /** cwd-relative globs replacing the tsconfig file list, or null to use the tsconfig file list. */
  includeGlobs: string[] | null;
  /** Output path (must resolve under `<cwd>/.tmp/`), or null to write JSON to stdout. */
  out: string | null;
  includeGeneratedAt: boolean;
};

export type SharedCliParseResult = {
  options: SharedCliOptions;
  /** Arguments this parser does not own. Callers consume theirs, then call `rejectUnknownArgs`. */
  rest: string[];
};

/** Stops the run on leftovers, so a misspelled option cannot be ignored into a wrong report. */
export function rejectUnknownArgs(rest: string[]): void {
  if (rest.length > 0) throw new Error(`Unknown argument: ${rest[0]}`);
}

/** Help lines for the shared arguments, so each tool can compose its own usage text. */
export const SHARED_CLI_HELP_LINES = [
  '  --project <tsconfig.json>    tsconfig defining the analysis target (default: ./tsconfig.json)',
  '  --include "src/**/*.ts,..."  analyze these cwd-relative globs instead of the tsconfig file list',
  '  --out .tmp/<name>.json       write the JSON report to a file under .tmp/ instead of stdout',
  '  --include-generated-at       set generatedAt to the current time (default: null, for determinism)',
  '  --help, -h                   show this help',
];

export function parseSharedCliOptions(cwd: string, args: string[], helpText: string): SharedCliParseResult {
  let projectPath = path.resolve(cwd, 'tsconfig.json');
  let includeGlobs: string[] | null = null;
  let out: string | null = null;
  let includeGeneratedAt = false;
  const rest: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--project') {
      projectPath = path.resolve(cwd, requireArgValue(args, index, '--project'));
      index += 1;
      continue;
    }
    if (arg === '--include') {
      includeGlobs = requireArgValue(args, index, '--include').split(',').map((glob) => glob.trim()).filter(Boolean);
      index += 1;
      continue;
    }
    if (arg === '--out') {
      out = requireArgValue(args, index, '--out');
      index += 1;
      continue;
    }
    if (arg === '--include-generated-at') {
      includeGeneratedAt = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(helpText);
      process.exit(0);
    }
    rest.push(arg);
  }

  if (includeGlobs !== null && includeGlobs.length === 0) {
    throw new Error('--include requires at least one glob');
  }

  return { options: { projectPath, includeGlobs, out, includeGeneratedAt }, rest };
}

/** The value following the option at `index`, rejecting a missing one or another option. */
export function requireArgValue(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}
