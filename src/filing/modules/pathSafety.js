'use strict';

/**
 * @fileoverview Path-traversal containment helper for filing providers.
 *
 * Resolves a user-supplied path against a base directory and guarantees the
 * result stays inside that base directory. Fixes the common prefix-bypass bug
 * where `resolved.startsWith(baseDir)` lets `/srv/data` match
 * `/srv/data-secrets` — containment is checked against `baseDir + path.sep`
 * (with the base directory itself permitted).
 *
 * @module filing/modules/pathSafety
 */

const path = require('node:path');
const { ClientError } = require('../../shared/utils/httpErrors');

/**
 * Resolves `userPath` within `baseDir`, throwing if it escapes.
 *
 * @param {string} baseDir The directory the path must stay within.
 * @param {string} userPath The user-supplied relative path (''/'.' = baseDir).
 * @return {string} The resolved absolute path, guaranteed inside baseDir.
 * @throws {Error} If userPath is not a string or escapes baseDir.
 *
 * @example
 * resolveWithin('/srv/data', 'docs/a.txt'); // -> /srv/data/docs/a.txt
 * resolveWithin('/srv/data', '../etc/passwd'); // throws
 */
function resolveWithin(baseDir, userPath) {
  if (typeof userPath !== 'string') {
    throw new ClientError(400, 'Invalid path: must be a string');
  }

  const resolvedBase = path.resolve(baseDir);
  const resolved = userPath === '' || userPath === '.'
    ? resolvedBase
    : path.resolve(resolvedBase, userPath);

  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
    throw new ClientError(400, 'Path traversal detected: path is outside the base directory');
  }

  return resolved;
}

/**
 * Asserts that a remote/object path is a safe relative path: not absolute and
 * containing no `..` traversal segment. Use for backends that have no local
 * base directory to resolve against (FTP remote paths, S3/object keys).
 *
 * @param {string} filePath The path/key to validate.
 * @return {string} The validated path (unchanged).
 * @throws {Error} If the path is not a string, is absolute, or contains `..`.
 *
 * @example
 * assertSafeRelativePath('docs/a.txt'); // ok
 * assertSafeRelativePath('../secrets');  // throws
 */
function assertSafeRelativePath(filePath) {
  if (typeof filePath !== 'string') {
    throw new ClientError(400, 'Invalid path: must be a string');
  }
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.startsWith('/')) {
    throw new ClientError(400, 'Path traversal detected: absolute paths are not allowed');
  }
  const segments = normalized.split('/');
  if (segments.includes('..')) {
    throw new ClientError(400, 'Path traversal detected: ".." is not allowed in the path');
  }
  return filePath;
}

module.exports = { resolveWithin, assertSafeRelativePath };
