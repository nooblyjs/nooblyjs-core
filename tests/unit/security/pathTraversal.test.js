'use strict';

/**
 * @fileoverview Regression tests for P1-4 — path-traversal containment.
 */

const path = require('node:path');
const { resolveWithin, assertSafeRelativePath } = require('../../../src/filing/modules/pathSafety');
const FilingLocal = require('../../../src/filing/providers/filingLocal');

describe('P1-4 — resolveWithin (local base-dir containment)', () => {
  const base = '/srv/data';

  it('resolves paths inside the base directory', () => {
    expect(resolveWithin(base, 'docs/a.txt')).toBe(path.resolve(base, 'docs/a.txt'));
    expect(resolveWithin(base, '')).toBe(path.resolve(base));
    expect(resolveWithin(base, '.')).toBe(path.resolve(base));
  });

  it('rejects ../ traversal', () => {
    expect(() => resolveWithin(base, '../etc/passwd')).toThrow(/traversal/i);
    expect(() => resolveWithin(base, 'a/../../b')).toThrow(/traversal/i);
  });

  it('rejects the prefix-bypass (e.g. /srv/data-secrets)', () => {
    // The old startsWith(baseDir) check would have allowed this.
    expect(() => resolveWithin(base, '../data-secrets/x')).toThrow(/traversal/i);
  });

  it('rejects non-string input', () => {
    expect(() => resolveWithin(base, null)).toThrow();
  });
});

describe('P1-4 — assertSafeRelativePath (remote/object keys)', () => {
  it('accepts safe relative keys', () => {
    expect(assertSafeRelativePath('docs/a.txt')).toBe('docs/a.txt');
    expect(assertSafeRelativePath('a.txt')).toBe('a.txt');
  });

  it('rejects absolute paths and traversal', () => {
    expect(() => assertSafeRelativePath('/etc/passwd')).toThrow(/traversal/i);
    expect(() => assertSafeRelativePath('../secrets')).toThrow(/traversal/i);
    expect(() => assertSafeRelativePath('a/../../b')).toThrow(/traversal/i);
    expect(() => assertSafeRelativePath('..\\windows')).toThrow(/traversal/i);
  });
});

describe('P1-4 — FilingLocal._resolveAndVerifyPath', () => {
  it('blocks traversal out of the configured baseDir', () => {
    const provider = new FilingLocal({ baseDir: '/srv/data' });
    expect(() => provider._resolveAndVerifyPath('../../etc/passwd')).toThrow(/traversal/i);
    expect(provider._resolveAndVerifyPath('ok/file.txt')).toBe(
      path.resolve('/srv/data', 'ok/file.txt')
    );
  });
});
