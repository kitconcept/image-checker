#!/usr/bin/env node
'use strict';

/**
 * Local test runner for the image-checker action.
 *
 * Calls the core checker logic directly (no GitHub Actions runtime needed).
 *
 * Usage:
 *   node scripts/run-local.js --paths <dir1,dir2> [options]
 *   make check PATHS=<dir> [EXTENSIONS=png,jpg] [MAX_SIZE=2097152] ...
 *
 * Options:
 *   --paths              Comma-separated directory paths to scan (required)
 *   --file-extensions    Comma-separated extensions to match (default: png,jpg,jpeg,gif,webp,avif,tiff,svg)
 *   --min-size           Minimum file size in bytes
 *   --max-size           Maximum file size in bytes
 *   --min-width          Minimum image width in pixels
 *   --max-width          Maximum image width in pixels
 *   --min-height         Minimum image height in pixels
 *   --max-height         Maximum image height in pixels
 */

const { parseArgs } = require('util');
const { parsePaths, parseExtensions, findFiles, checkFile } = require('../src/checker');

const { values } = parseArgs({
  options: {
    'paths':           { type: 'string' },
    'file-extensions': { type: 'string', default: 'png,jpg,jpeg,gif,webp,avif,tiff,svg' },
    'min-size':        { type: 'string' },
    'max-size':        { type: 'string' },
    'min-width':       { type: 'string' },
    'max-width':       { type: 'string' },
    'min-height':      { type: 'string' },
    'max-height':      { type: 'string' },
  },
});

if (!values['paths']) {
  console.error('Error: --paths is required');
  process.exit(1);
}

function parseOptionalInt(name, val) {
  if (!val) { return null; }
  const n = parseInt(val, 10);
  if (isNaN(n)) { throw new Error(`--${name} must be an integer, got: '${val}'`); }
  return n;
}

async function main() {
  const searchPaths = parsePaths(values['paths']);
  const extensions  = parseExtensions(values['file-extensions']);

  console.log(`Scanning ${searchPaths.length} path(s) for extensions: ${extensions.join(', ')}`);
  const filePaths = findFiles(searchPaths, extensions);
  console.log(`Found ${filePaths.length} file(s).`);

  if (filePaths.length === 0) {
    console.log('Nothing to check.');
    return;
  }

  const constraints = {
    minSize:   parseOptionalInt('min-size',   values['min-size']),
    maxSize:   parseOptionalInt('max-size',   values['max-size']),
    minWidth:  parseOptionalInt('min-width',  values['min-width']),
    maxWidth:  parseOptionalInt('max-width',  values['max-width']),
    minHeight: parseOptionalInt('min-height', values['min-height']),
    maxHeight: parseOptionalInt('max-height', values['max-height']),
  };

  const failedFiles = [];

  for (const filePath of filePaths) {
    const result = await checkFile(filePath, constraints);
    if (result.violations.length > 0) {
      failedFiles.push(filePath);
      console.error(`\u274c ${filePath}`);
      for (const v of result.violations) {
        console.error(`   - ${v.check}: ${v.value} (rule: ${v.rule})`);
      }
    } else {
      console.log(`\u2705 ${filePath}`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total : ${filePaths.length}`);
  console.log(`Passed: ${filePaths.length - failedFiles.length}`);
  console.log(`Failed: ${failedFiles.length}`);

  if (failedFiles.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
