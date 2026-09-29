#!/usr/bin/env node
/**
 * @fileoverview Production build script for NooblyJS Core.
 *
 * Produces a self-contained `./dist` folder that contains only the runtime
 * code required to run the application. It:
 *   1. Cleans any previous `./dist`.
 *   2. Copies the runtime code (src, public, entry points, README).
 *   3. Excludes development artefacts (tests, docs, Claude files, scripts,
 *      screenshots, .bak files, .env files, runtime data folders).
 *   4. Obfuscates every JavaScript file in `./dist`.
 *   5. Writes a trimmed `package.json` (production dependencies only,
 *      development scripts removed).
 *
 * Usage:  npm run build
 *
 * @author NooblyJS Contributors
 * @since 1.0.10
 */
'use strict';

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

/**
 * Top-level files and folders copied into `./dist`.
 * Everything not listed here is excluded by default.
 * @type {Array<string>}
 */
const INCLUDE = [
  'src',
  'public',
  'index.js',
  'app.js',
  'app-noauth.js',
  'README.md',
];

/**
 * Directory names dropped wherever they are found, including nested inside the
 * runtime code. These are build/VCS/test/runtime artefacts only — never code.
 *
 * NOTE: Top-level dev folders (docs, tests, scripts, .claude, screenshots,
 * activities) are already excluded simply by not being listed in INCLUDE.
 * `scripts` is intentionally NOT listed here because services ship their own
 * nested `scripts/` folders (e.g. src/searching/scripts) that ARE runtime code.
 * @type {Set<string>}
 */
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.application',
  '.cache',
  '.data',
  '.test',
  '.test-files',
  'coverage',
  '__tests__',
]);

/**
 * Determines whether an individual file should be excluded from `./dist`.
 *
 * @param {string} name - The file's base name.
 * @return {boolean} True when the file must not be copied.
 */
function isExcludedFile(name) {
  const lower = name.toLowerCase();
  return (
    lower.endsWith('.bak') ||
    lower.endsWith('.test.js') ||
    lower.endsWith('.spec.js') ||
    lower.endsWith('.disabled.js') ||
    lower.endsWith('.disable.js') ||
    lower === 'claude.md' ||
    lower === '.ds_store' ||
    lower === '.env' ||
    lower.startsWith('.env.')
  );
}

/**
 * Obfuscation options tuned for Node.js (server) and browser (client) code.
 * `renameGlobals` is left disabled so module-level identifiers — class names,
 * exported functions and `module.exports` — keep working with `require()`.
 * @type {object}
 */
const OBFUSCATOR_OPTIONS = {
  compact: true,
  simplify: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  renameGlobals: false,
  identifierNamesGenerator: 'hexadecimal',
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  transformObjectKeys: false,
  numbersToExpressions: false,
  unicodeEscapeSequence: false,
};

/** Removes a path recursively if it exists. @param {string} target */
function clean(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

/**
 * Recursively copies a runtime item into `./dist`, applying exclusion rules.
 *
 * @param {string} src - Absolute source path.
 * @param {string} dest - Absolute destination path.
 * @return {{files: number, skipped: number}} Copy statistics.
 */
function copyItem(src, dest) {
  const stats = { files: 0, skipped: 0 };
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    if (EXCLUDE_DIRS.has(path.basename(src))) {
      stats.skipped += 1;
      return stats;
    }
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      const child = copyItem(path.join(src, entry), path.join(dest, entry));
      stats.files += child.files;
      stats.skipped += child.skipped;
    }
    return stats;
  }

  if (isExcludedFile(path.basename(src))) {
    stats.skipped += 1;
    return stats;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  stats.files += 1;
  return stats;
}

/**
 * Recursively obfuscates every `.js` file beneath the given directory.
 * A file that fails to parse (e.g. a pre-existing syntax error) is left
 * un-obfuscated and recorded so the build can still complete.
 *
 * @param {string} dir - Absolute directory to walk.
 * @param {Array<string>} failures - Accumulator for relative paths that failed.
 * @return {number} Count of successfully obfuscated files.
 */
function obfuscateTree(dir, failures) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += obfuscateTree(full, failures);
    } else if (entry.name.toLowerCase().endsWith('.js')) {
      const source = fs.readFileSync(full, 'utf8');
      try {
        const result = JavaScriptObfuscator.obfuscate(source, OBFUSCATOR_OPTIONS);
        fs.writeFileSync(full, result.getObfuscatedCode(), 'utf8');
        count += 1;
      } catch (err) {
        // Leave the original (un-obfuscated) file in place so the bundle
        // is still functional, and surface the problem at the end.
        failures.push(`${path.relative(DIST, full)} -> ${err.message}`);
      }
    }
  }
  return count;
}

/**
 * Writes a trimmed `package.json` into `./dist` with development scripts and
 * devDependencies removed.
 */
function writeDistPackageJson() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  delete pkg.devDependencies;
  pkg.scripts = {
    start: pkg.scripts && pkg.scripts.start ? pkg.scripts.start : 'node ./app.js',
  };

  fs.writeFileSync(
    path.join(DIST, 'package.json'),
    `${JSON.stringify(pkg, null, 2)}\n`,
    'utf8',
  );
}

/** Runs the full build pipeline. */
function build() {
  const started = Date.now();
  console.log('Building production bundle -> ./dist\n');

  clean(DIST);
  fs.mkdirSync(DIST, { recursive: true });

  let copied = 0;
  let skipped = 0;
  for (const item of INCLUDE) {
    const src = path.join(ROOT, item);
    if (!fs.existsSync(src)) {
      console.log(`  - skip (missing): ${item}`);
      continue;
    }
    const result = copyItem(src, path.join(DIST, item));
    copied += result.files;
    skipped += result.skipped;
    console.log(`  + copied: ${item}`);
  }

  writeDistPackageJson();
  console.log(`  + generated: package.json (production)\n`);

  console.log('Obfuscating JavaScript...');
  const failures = [];
  const obfuscated = obfuscateTree(DIST, failures);

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\nBuild complete in ${seconds}s`);
  console.log(`  files copied:      ${copied}`);
  console.log(`  excluded entries:  ${skipped}`);
  console.log(`  files obfuscated:  ${obfuscated}`);

  if (failures.length > 0) {
    console.log(`\nWARNING: ${failures.length} file(s) could not be obfuscated`);
    console.log('         (copied as-is; likely a pre-existing syntax error):');
    for (const failure of failures) {
      console.log(`  ! ${failure}`);
    }
  }

  console.log(`\nRun the bundle with:  cd dist && npm install --omit=dev && npm start`);
}

try {
  build();
} catch (err) {
  console.error(`\nBuild failed: ${err.message}`);
  process.exitCode = 1;
}
