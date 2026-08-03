#!/usr/bin/env node
/**
 * Entry point for the analyses in ./src, so the root package.json can name one launcher
 * instead of repeating a path into node_modules for each tool.
 *
 * ts-node is registered from here rather than run as a binary because the root workspace does
 * not depend on it, and `pnpm --filter` would move the cwd into this package -- which would
 * rewrite every relative path in the report and change which tsconfig `--project` defaults to.
 * `require` resolves from this file, so pnpm is free to lay node_modules out however it likes.
 */
'use strict';

const path = require('node:path');

const ANALYSES = {
  dependencies: 'analyze-dependencies.ts',
  duplication: 'analyze-duplication.ts',
  independence: 'analyze-independence.ts',
};

const [name, ...analysisArgs] = process.argv.slice(2);
const entry = Object.prototype.hasOwnProperty.call(ANALYSES, name) ? ANALYSES[name] : undefined;

if (entry === undefined) {
  const available = Object.keys(ANALYSES).join(', ');
  const problem = name === undefined ? 'No analysis name given' : `Unknown analysis: ${name}`;
  process.stderr.write(`${problem}\nUsage: node tools/static-analysis/run.js <${available}> [options]\n`);
  process.exit(1);
}

require('ts-node').register({
  transpileOnly: true,
  project: path.join(__dirname, 'tsconfig.json'),
});

// The analyses read process.argv directly, so the analysis name is dropped from it. argv[1]
// becomes the module being run, which is what a directly invoked script would see.
process.argv = [process.argv[0], path.join(__dirname, 'src', entry), ...analysisArgs];

require(path.join(__dirname, 'src', entry));
