/**
 * @fileoverview File-system store shared by NooblyJS and its hosted apps.
 *
 * Every entity is a Markdown file with YAML front matter, configuration is a
 * `.yaml` file, and events and audit records are append-only YAML streams
 * (multi-document files, one `---` per record). The store guarantees:
 *
 *   - atomic writes: write a temp file, fsync, rename, so a reader never sees half a file
 *   - a per-path async lock for read-modify-write (`updateDoc`, `appendYaml`)
 *   - path safety: every segment matches SEGMENT and the resolved path stays under the root
 *   - YAML CORE_SCHEMA, so ISO dates stay strings
 *   - an optional mtime/size-validated document cache (an nooblyjs-core caching service),
 *     so files edited by hand outside the app are still picked up
 *
 * Moved here from nooblyjs-ai-teammate (src/store/fs-store.js), with the YAML
 * helpers added for NooblyJS's config files and daily event/audit streams.
 *
 * @author NooblyJS Team
 * @since 1.0.11
 */

'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const YAML_OPTIONS = { schema: yaml.CORE_SCHEMA, lineWidth: 100, noRefs: true };
// Windows can hold a file briefly (an indexer, an antivirus scan), which makes rename fail.
const RENAME_RETRIES = [10, 30, 100, 300];

class StoreError extends Error {}

/** Splits a Markdown file into its front matter (`data`) and `body`. */
function parseMarkdown(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { data: {}, body: text };
  const data = yaml.load(match[1], { schema: yaml.CORE_SCHEMA }) ?? {};
  return { data, body: match[2].replace(/^\r?\n/, '') };
}

/** Builds a Markdown file from front matter and a body. */
function serializeMarkdown(data, body = '') {
  const front = yaml.dump(stripUndefined(data), YAML_OPTIONS);
  return `---\n${front}---\n\n${String(body).trim()}\n`;
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, stripUndefined(v)]),
    );
  }
  return value;
}

async function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fs.rename(from, to);
    } catch (err) {
      const busy = err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES';
      if (!busy || attempt >= RENAME_RETRIES.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, RENAME_RETRIES[attempt]));
    }
  }
}

class FsStore {
  /**
   * @param {string} root - the folder this store may read and write
   * @param {object} [options]
   * @param {object} [options.cache] - an nooblyjs-core caching service for parsed documents
   * @param {number} [options.maxCached=2000] - most documents kept, least recently used dropped first
   * @param {(segments: string[]) => boolean} [options.cacheable] - which files may be cached
   */
  constructor(root, { cache = null, maxCached = 2000, cacheable = () => true } = {}) {
    this.root = path.resolve(root);
    this.locks = new Map();
    this.cache = cache;
    this.cacheable = cacheable;
    this.maxCached = maxCached;
    this.cachedKeys = new Set(); // insertion order = least recently used first
    this.cacheStats = { hits: 0, misses: 0 };
  }

  /** Resolves path segments under the root, refusing anything that could escape it. */
  resolve(segments) {
    for (const s of segments) {
      if (typeof s !== 'string' || !SEGMENT.test(s) || s.includes('..')) {
        throw new StoreError(`Invalid path segment: ${JSON.stringify(s)}`);
      }
    }
    const full = path.resolve(this.root, ...segments);
    if (full !== this.root && !full.startsWith(this.root + path.sep)) {
      throw new StoreError('Path escapes the data directory');
    }
    return full;
  }

  /** Runs `fn` while holding the lock for this path. Calls for the same path run one at a time. */
  async withLock(segments, fn) {
    const key = this.resolve(segments);
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release;
    const current = new Promise((r) => (release = r));
    const chained = previous.then(() => current);
    this.locks.set(key, chained);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(key) === chained) this.locks.delete(key);
    }
  }

  async exists(segments) {
    try {
      await fs.access(this.resolve(segments));
      return true;
    } catch {
      return false;
    }
  }

  async readText(segments) {
    try {
      return await fs.readFile(this.resolve(segments), 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async writeText(segments, text) {
    const full = this.resolve(segments);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.tmp-${crypto.randomBytes(4).toString('hex')}`;
    const handle = await fs.open(tmp, 'w');
    try {
      await handle.writeFile(text, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await renameWithRetry(tmp, full);
    } catch (err) {
      await fs.rm(tmp, { force: true });
      throw err;
    }
    await this.invalidate(full);
  }

  async writeBuffer(segments, buffer) {
    const full = this.resolve(segments);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.tmp-${crypto.randomBytes(4).toString('hex')}`;
    await fs.writeFile(tmp, buffer);
    await renameWithRetry(tmp, full);
    await this.invalidate(full);
  }

  // ---------- Markdown documents ----------

  async readDoc(segments) {
    if (!this.cache || !this.cacheable(segments)) {
      const text = await this.readText(segments);
      return text == null ? null : parseMarkdown(text);
    }
    const full = this.resolve(segments);
    let stat;
    try {
      stat = await fs.stat(full);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
    // Stat before reading: a write landing in between leaves a stale stamp, so the next read misses and re-reads.
    const stamp = `${stat.mtimeMs}:${stat.size}`;
    const key = `doc:${full}`;
    const hit = await this.cacheGet(key);
    if (hit?.stamp === stamp) {
      this.cacheStats.hits += 1;
      this.touch(key);
      return structuredClone(hit.doc); // callers modify what they read
    }
    this.cacheStats.misses += 1;
    const text = await this.readText(segments);
    if (text == null) return null;
    const doc = parseMarkdown(text);
    await this.cachePut(key, { stamp, doc: structuredClone(doc) });
    return doc;
  }

  async writeDoc(segments, data, body = '') {
    await this.writeText(segments, serializeMarkdown(data, body));
  }

  /** Read-modify-write under the path lock. `fn` gets the doc (or null) and returns the new doc, or null to skip. */
  async updateDoc(segments, fn) {
    return this.withLock(segments, async () => {
      const doc = await this.readDoc(segments);
      const next = await fn(doc);
      if (next) await this.writeDoc(segments, next.data, next.body ?? '');
      return next;
    });
  }

  // ---------- YAML files and streams ----------

  /** A `.yaml` file's value, or null when the file doesn't exist. */
  async readYaml(segments) {
    const text = await this.readText(segments);
    return text == null ? null : yaml.load(text, { schema: yaml.CORE_SCHEMA }) ?? null;
  }

  async writeYaml(segments, value) {
    await this.writeText(segments, yaml.dump(stripUndefined(value), YAML_OPTIONS));
  }

  /** Appends one record to a multi-document YAML stream. Appends to one file never interleave. */
  async appendYaml(segments, record) {
    const text = `---\n${yaml.dump(stripUndefined(record), YAML_OPTIONS)}`;
    return this.withLock(segments, async () => {
      const full = this.resolve(segments);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.appendFile(full, text, 'utf8');
    });
  }

  /** Every record in a YAML stream, oldest first. An unreadable record stops the read with a StoreError. */
  async readYamlStream(segments) {
    const text = await this.readText(segments);
    if (text == null) return [];
    try {
      return yaml.loadAll(text, null, { schema: yaml.CORE_SCHEMA }).filter((r) => r != null);
    } catch (err) {
      throw new StoreError(`Unreadable YAML stream ${segments.join('/')}: ${err.message}`);
    }
  }

  // ---------- Folders ----------

  /** File names (or, with `dirs`, folder names) in a folder, sorted. Temp files and unsafe names are skipped. */
  async list(segments, { dirs = false } = {}) {
    try {
      const entries = await fs.readdir(this.resolve(segments), { withFileTypes: true });
      return entries
        .filter((e) => (dirs ? e.isDirectory() : e.isFile()) && !e.name.includes('.tmp-') && SEGMENT.test(e.name))
        .map((e) => e.name)
        .sort();
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async remove(segments) {
    const full = this.resolve(segments);
    await fs.rm(full, { recursive: true, force: true });
    await this.invalidate(full, { tree: true });
  }

  async move(from, to) {
    const source = this.resolve(from);
    const target = this.resolve(to);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await renameWithRetry(source, target);
    await this.invalidate(source, { tree: true });
    await this.invalidate(target, { tree: true });
  }

  // ---------- Document cache (nooblyjs-core caching service) ----------

  async cacheGet(key) {
    try {
      return await this.cache.get(key);
    } catch {
      return undefined; // a failing cache only costs a disk read
    }
  }

  async cachePut(key, value) {
    try {
      await this.cache.put(key, value);
      this.touch(key);
      while (this.cachedKeys.size > this.maxCached) {
        const oldest = this.cachedKeys.values().next().value;
        this.cachedKeys.delete(oldest);
        await this.cache.delete(oldest);
      }
    } catch { /* a failing cache only costs a disk read */ }
  }

  touch(key) {
    this.cachedKeys.delete(key);
    this.cachedKeys.add(key);
  }

  async invalidate(full, { tree = false } = {}) {
    if (!this.cache) return;
    const key = `doc:${full}`;
    const prefix = `${key}${path.sep}`;
    const keys = tree ? [...this.cachedKeys].filter((k) => k === key || k.startsWith(prefix)) : [key];
    for (const k of keys) {
      if (!this.cachedKeys.delete(k)) continue;
      try {
        await this.cache.delete(k);
      } catch { /* ignore */ }
    }
  }

  /** Hits, misses and documents held. */
  cacheInfo() {
    return { enabled: Boolean(this.cache), documents: this.cachedKeys.size, maxDocuments: this.maxCached, ...this.cacheStats };
  }
}

module.exports = { FsStore, StoreError, parseMarkdown, serializeMarkdown, SEGMENT };
