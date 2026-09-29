/**
 * @fileoverview Locations for data written by test runs.
 *
 * All temporary test data lives under `.temp/tests/data/` (git-ignored) —
 * never the repo root, `tests/`, `.test/` or the system temp directory. See
 * `.claude/rules/output-locations.md`.
 *
 * @author NooblyJS Team
 * @since 1.1.0
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** Root directory for all test-run data. */
const TEST_DATA_ROOT = path.join(__dirname, '../../.temp/tests/data');

/**
 * Returns (and creates) the test data root, or a named folder inside it.
 *
 * @param {string} [name] - Optional sub-folder, e.g. 'settings' or 'auth'
 * @return {string} Absolute directory path
 *
 * @example
 * const dir = testDataDir('auth');           // .temp/tests/data/auth
 * const tmp = fs.mkdtempSync(path.join(testDataDir(), 'nooblyjs-upload-'));
 */
function testDataDir(name) {
  const dir = name ? path.join(TEST_DATA_ROOT, name) : TEST_DATA_ROOT;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { TEST_DATA_ROOT, testDataDir };
