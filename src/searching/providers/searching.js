/**
 * @fileoverview Local Search Service (field-aware token engine).
 *
 * The single embedded/local search provider for the framework. Provides an
 * inverted-index search with per-field tokenization, BM25 scoring, prefix and
 * fuzzy matching, compositional autoSuggest, disk persistence, multiple named
 * indexes (containers), and a MiniSearch-compatible result shape.
 *
 * Backward compatible: if `fields` is omitted at construction, the entire
 * document is stringified into a single synthetic `_all` field, so callers that
 * just `add(key, obj)` and `search(term)` keep working without configuring
 * fields. This file is the result of merging the former `searchingTokens.js`
 * token provider into the canonical local provider — there is now ONE local
 * search service.
 *
 * Query syntax: any part of a query wrapped in double quotes is an exact
 * phrase — `Oracle "MySQL Enterprise"` requires the words "mysql enterprise"
 * to appear adjacent and in that order (case-insensitive), instead of merely
 * scoring documents that mention either word. See {@link SearchService#search}.
 *
 * @author NooblyJS Team
 * @version 3.0.0
 * @since 1.0.0
 */

'use strict';

const fs = require('node:fs').promises;
const path = require('node:path');
const analytics = require('../modules/analytics');
const levenshtein = require('../modules/levenshtein');
const { parseQuotedPhrases, normalizeForPhrase } = require('../modules/queryParser');

const DISK_FORMAT_VERSION = '2.1.0';
const SYNTHETIC_FIELD = '_all';

const DEFAULT_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
]);

/**
 * Default tokenizer: lowercase, strip non-word chars except hyphens,
 * split on whitespace, drop empties.
 *
 * @param {string} text
 * @return {Array<string>}
 */
function defaultTokenize(text) {
  if (text == null) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

/**
 * Build the default term processor honoring min length + stop-word set.
 *
 * @param {number} minLength
 * @param {Set<string>} stopWords
 * @return {function(string): (string|null)}
 */
function makeDefaultProcessTerm(minLength, stopWords) {
  return (term) => {
    if (!term || term.length < minLength) return null;
    if (stopWords.has(term)) return null;
    return term;
  };
}

/**
 * Default field extractor: dot-path access for nested fields.
 * The synthetic _all field stringifies the entire document.
 *
 * @param {Object} document
 * @param {string} fieldName
 * @return {*}
 */
function defaultExtractField(document, fieldName) {
  if (fieldName === SYNTHETIC_FIELD) {
    return JSON.stringify(document);
  }
  return fieldName.split('.').reduce(
    (obj, key) => (obj == null ? obj : obj[key]),
    document
  );
}

/**
 * Local search provider with a field-aware inverted index, BM25 scoring,
 * prefix/fuzzy matching, compositional autoSuggest, and disk persistence.
 *
 * @class
 */
class SearchService {
  /**
   * @param {Object} [options] Configuration options.
   * @param {Array<string>} [options.fields] Field names to index. If absent,
   *   the entire document is stringified into a synthetic `_all` field
   *   (preserves backward compatibility with the simple substring provider).
   * @param {Array<string>} [options.storeFields] Field names to return in
   *   results. If absent, the full source object is returned via `obj`.
   * @param {string} [options.idField='id'] Field on documents to use as id
   *   when calling `addAll`, `replace`, etc.
   * @param {string} [options.defaultIndex='default'] Default container name.
   * @param {function(Object, string): *} [options.extractField] Custom
   *   per-field extractor. Receives (document, fieldName).
   * @param {function(string, string=): Array<string>} [options.tokenize]
   *   Custom tokenizer. Receives (text, fieldName).
   * @param {function(string, string=): (string|null|false)} [options.processTerm]
   *   Custom term processor. Return null/false to discard the term.
   * @param {Object} [options.searchOptions] Per-instance defaults for search.
   * @param {Object} [options.autoSuggestOptions] Per-instance defaults for autoSuggest.
   * @param {{k1: number, b: number}} [options.bm25] BM25 tuning. Defaults k1=1.2, b=0.75.
   * @param {Object<string,(string|string[])>|Array<Array<string>>} [options.synonyms]
   *   Query synonyms. Either a map of term → equivalent(s)
   *   (`{ bitrix: 'bitrix24' }`) or an array of equivalence groups
   *   (`[['bitrix','bitrix24']]`). Each group's members are treated as
   *   bidirectionally equivalent and expanded into the query before matching.
   * @param {number} [options.synonymWeight=1] Score weight for a synonym match
   *   relative to an exact match (1 = treated as equal).
   * @param {boolean|Object} [options.snippet] Enable match-centered context
   *   snippets on search results. `true` or an options object turns it on:
   *   `{ wordsBefore=10, wordsAfter=10, highlight=true, highlightTag='mark',
   *   maxChars=400 }`. When on, the raw indexed text is retained per document
   *   (extra memory + disk) so each `search()` result carries a `snippet`
   *   string — up to N words either side of the first matched term, clamped at
   *   sentence boundaries, with matches wrapped in the highlight tag.
   * @param {Set<string>|Array<string>} [options.stopWords] Override default stop words.
   * @param {number} [options.minTokenLength=3] Minimum length used by default processTerm.
   * @param {number} [options.maxTokensPerDocument=500] Per-field cap on tokens.
   * @param {number} [options.maxTotalTokens=500000] Total tokens cap per container.
   * @param {number} [options.diskTTLHours=24] TTL for on-disk indexes.
   * @param {string} [options.indexDir] Directory for disk persistence.
   * @param {EventEmitter} [eventEmitter] Optional event emitter.
   * @param {Object} [dependencies] Injected dependencies (logging, etc).
   */
  constructor(options = {}, eventEmitter, dependencies = {}) {
    this.logger = dependencies.logging || null;
    this.eventEmitter_ = eventEmitter;

    this.fields_ = Array.isArray(options.fields) && options.fields.length > 0
      ? [...options.fields]
      : [SYNTHETIC_FIELD];
    this.syntheticAllField_ = this.fields_.length === 1 && this.fields_[0] === SYNTHETIC_FIELD;
    this.storeFields_ = Array.isArray(options.storeFields) ? [...options.storeFields] : null;
    this.idField_ = options.idField || 'id';
    this.defaultIndex_ = this.normalizeIndexName_(options.defaultIndex);

    this.minTokenLength = options.minTokenLength || 3;
    this.stopWords = options.stopWords instanceof Set
      ? options.stopWords
      : (Array.isArray(options.stopWords) ? new Set(options.stopWords) : DEFAULT_STOP_WORDS);
    this.tokenizeFn_ = typeof options.tokenize === 'function' ? options.tokenize : defaultTokenize;
    this.processTermFn_ = typeof options.processTerm === 'function'
      ? options.processTerm
      : makeDefaultProcessTerm(this.minTokenLength, this.stopWords);
    this.extractFieldFn_ = typeof options.extractField === 'function'
      ? options.extractField
      : defaultExtractField;

    this.searchOptions_ = options.searchOptions || {};
    this.autoSuggestOptions_ = options.autoSuggestOptions || {};

    this.bm25_ = {
      k1: options.bm25?.k1 ?? 1.2,
      b: options.bm25?.b ?? 0.75
    };

    // Synonyms: query terms are expanded to configured equivalents before
    // matching, so a search for "bitrix" also finds documents indexed under
    // "bitrix24". Weight applied to a synonym match relative to an exact match.
    this.synonymWeight_ = typeof options.synonymWeight === 'number' ? options.synonymWeight : 1;
    this.synonymMap_ = this.buildSynonymMap_(options.synonyms);

    // Context snippets: when enabled, the raw indexed text is retained on each
    // document so search() can return a match-centered context snippet. Off by
    // default to avoid the extra memory/disk footprint; enable via
    // `snippet: true` or an options object. See normalizeSnippetOptions_.
    this.snippet_ = this.normalizeSnippetOptions_(options.snippet);

    this.containers = new Map();
    this.createContainer_(this.defaultIndex_);

    this.maxTokensPerDocument = options.maxTokensPerDocument || 500;
    this.maxTotalTokens = options.maxTotalTokens || 500000;
    this.diskTTLHours = options.diskTTLHours || 24;
    this.indexDir = options.indexDir || null;

    this.isIndexing = false;
    this.lastIndexTime = null;

    this.settings = {
      description: 'Field-aware local search with BM25, prefix/fuzzy matching, and autoSuggest',
      list: []
    };
  }

  // ─── Container management ────────────────────────────────────────

  createContainer_(name) {
    if (!this.containers.has(name)) {
      this.containers.set(name, {
        // token -> field -> docId -> termFrequency
        tokens: new Map(),
        // docId -> { storedFields, sourceDoc, fieldTokens, fieldLengths, isIndexed }
        documents: new Map(),
        // fieldName -> { totalLength, docCount }
        fieldStats: new Map()
      });
    }
  }

  getContainer_(name) {
    const resolved = this.normalizeIndexName_(name);
    this.createContainer_(resolved);
    return { name: resolved, container: this.containers.get(resolved) };
  }

  /**
   * Normalizes an index/container name ensuring a valid non-empty string.
   * @param {string=} searchContainer
   * @return {string}
   * @private
   */
  normalizeIndexName_(searchContainer) {
    if (typeof searchContainer === 'string') {
      const trimmed = searchContainer.trim();
      if (trimmed) {
        // Container names are persisted to disk as a directory segment under
        // this.indexDir (see _saveContainerToDisk). Reject path separators and
        // traversal so a name like "../../etc" cannot escape the index dir.
        if (/[\\/]/.test(trimmed) || trimmed === '.' || trimmed === '..') {
          throw new Error('Invalid container name: must not contain path separators or traversal segments');
        }
        return trimmed;
      }
    }
    return this.defaultIndex_ || 'default';
  }

  // ─── Tokenization helpers ────────────────────────────────────────

  /**
   * Public tokenizer (uses configured tokenize + processTerm).
   *
   * @param {string} text
   * @param {string} [fieldName]
   * @return {Array<string>}
   */
  tokenize(text, fieldName) {
    const raw = this.tokenizeFn_(text, fieldName);
    const out = [];
    const seen = new Set();
    for (const t of raw) {
      const processed = this.processTermFn_(t, fieldName);
      if (!processed) continue;
      if (seen.has(processed)) continue;
      seen.add(processed);
      out.push(processed);
    }
    return out;
  }

  /**
   * Tokenize and produce term-frequency counts (no dedup).
   *
   * @param {string} text
   * @param {string} [fieldName]
   * @return {{terms: Array<string>, tf: Map<string, number>}}
   */
  tokenizeWithFrequency_(text, fieldName) {
    const raw = this.tokenizeFn_(text, fieldName);
    const tf = new Map();
    const ordered = [];
    for (const t of raw) {
      const processed = this.processTermFn_(t, fieldName);
      if (!processed) continue;
      ordered.push(processed);
      tf.set(processed, (tf.get(processed) || 0) + 1);
    }
    return { terms: ordered, tf };
  }

  // ─── Field extraction helpers ────────────────────────────────────

  extractFieldValue_(document, fieldName) {
    const value = this.extractFieldFn_(document, fieldName);
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(v => (v == null ? '' : String(v))).join(' ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  buildStoredFields_(document) {
    if (!this.storeFields_) {
      return { ...document };
    }
    const out = {};
    for (const field of this.storeFields_) {
      const value = field.includes('.')
        ? field.split('.').reduce((o, k) => (o == null ? o : o[k]), document)
        : document[field];
      if (value !== undefined) out[field] = value;
    }
    return out;
  }

  // ─── Disk Persistence ───────────────────────────────────────────

  async _ensureIndexDir() {
    if (!this.indexDir) return;
    try {
      await fs.mkdir(this.indexDir, { recursive: true });
    } catch (error) {
      this.logger?.warn(`[${this.constructor.name}] Could not create index directory: ${error.message}`);
    }
  }

  async _saveContainerToDisk(containerName, container) {
    if (!this.indexDir) return;
    await this._ensureIndexDir();

    try {
      const containerDir = path.join(this.indexDir, containerName);
      await fs.mkdir(containerDir, { recursive: true });

      const docsObj = {};
      for (const [docId, info] of container.documents) {
        docsObj[docId] = {
          storedFields: info.storedFields,
          sourceDoc: info.sourceDoc,
          fieldTokens: Object.fromEntries(
            Array.from(info.fieldTokens.entries()).map(([f, set]) => [f, Array.from(set)])
          ),
          fieldLengths: Object.fromEntries(info.fieldLengths),
          text: info.text,
          isIndexed: info.isIndexed
        };
      }
      await fs.writeFile(
        path.join(containerDir, 'documents.json'),
        JSON.stringify(docsObj),
        'utf8'
      );

      const tokensObj = {};
      for (const [token, fieldMap] of container.tokens) {
        const byField = {};
        for (const [field, docMap] of fieldMap) {
          byField[field] = Object.fromEntries(docMap);
        }
        tokensObj[token] = byField;
      }
      await fs.writeFile(
        path.join(containerDir, 'tokens.json'),
        JSON.stringify(tokensObj),
        'utf8'
      );

      const fieldStatsObj = Object.fromEntries(container.fieldStats);

      await fs.writeFile(
        path.join(containerDir, 'meta.json'),
        JSON.stringify({
          version: DISK_FORMAT_VERSION,
          lastIndexTime: this.lastIndexTime,
          totalDocuments: container.documents.size,
          totalTokens: container.tokens.size,
          fields: this.fields_,
          fieldStats: fieldStatsObj
        }, null, 2),
        'utf8'
      );

      this.logger?.info(
        `[${this.constructor.name}] Saved ${containerName} to disk: ${container.documents.size} docs, ${container.tokens.size} tokens`
      );
    } catch (error) {
      this.logger?.error(
        `[${this.constructor.name}] Failed to save ${containerName} to disk: ${error.message}`
      );
    }
  }

  async _loadContainerFromDisk(containerName, container) {
    if (!this.indexDir) return false;

    try {
      const containerDir = path.join(this.indexDir, containerName);
      const metaPath = path.join(containerDir, 'meta.json');

      const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));

      if (meta.version !== DISK_FORMAT_VERSION) {
        this.logger?.info(
          `[${this.constructor.name}] ${containerName} disk format ${meta.version} != ${DISK_FORMAT_VERSION}, will rebuild`
        );
        return false;
      }
      if (!meta.lastIndexTime) {
        this.logger?.info(`[${this.constructor.name}] ${containerName} has no lastIndexTime, will rebuild`);
        return false;
      }
      const age = Date.now() - new Date(meta.lastIndexTime).getTime();
      if (age > this.diskTTLHours * 60 * 60 * 1000) {
        this.logger?.info(
          `[${this.constructor.name}] ${containerName} is ${Math.round(age / 3600000)}h old, will rebuild`
        );
        return false;
      }

      const docsJson = JSON.parse(await fs.readFile(path.join(containerDir, 'documents.json'), 'utf8'));
      container.documents.clear();
      for (const [docId, info] of Object.entries(docsJson)) {
        container.documents.set(docId, {
          storedFields: info.storedFields,
          sourceDoc: info.sourceDoc,
          fieldTokens: new Map(
            Object.entries(info.fieldTokens || {}).map(([f, arr]) => [f, new Set(arr)])
          ),
          fieldLengths: new Map(Object.entries(info.fieldLengths || {})),
          text: info.text,
          isIndexed: info.isIndexed !== false
        });
      }

      const tokensJson = JSON.parse(await fs.readFile(path.join(containerDir, 'tokens.json'), 'utf8'));
      container.tokens.clear();
      for (const [token, byField] of Object.entries(tokensJson)) {
        const fieldMap = new Map();
        for (const [field, docMap] of Object.entries(byField)) {
          fieldMap.set(field, new Map(Object.entries(docMap).map(([d, tf]) => [d, Number(tf)])));
        }
        container.tokens.set(token, fieldMap);
      }

      container.fieldStats.clear();
      for (const [field, stats] of Object.entries(meta.fieldStats || {})) {
        container.fieldStats.set(field, stats);
      }

      if (container.documents.size > 0) {
        for (let i = 0; i < container.documents.size; i++) {
          analytics.trackAdd(containerName);
        }
      }

      this.lastIndexTime = meta.lastIndexTime ? new Date(meta.lastIndexTime) : null;
      this.logger?.info(
        `[${this.constructor.name}] Loaded ${containerName} from disk: ${container.documents.size} docs, ${container.tokens.size} tokens`
      );
      return true;
    } catch (error) {
      this.logger?.debug(`[${this.constructor.name}] No valid ${containerName} on disk: ${error.message}`);
      return false;
    }
  }

  async saveToDisk(containerName = null) {
    if (!this.indexDir) return;
    if (containerName) {
      const container = this.containers.get(containerName);
      if (container) await this._saveContainerToDisk(containerName, container);
    } else {
      for (const [name, container] of this.containers) {
        await this._saveContainerToDisk(name, container);
      }
    }
  }

  async loadFromDisk(containerName = null) {
    if (!this.indexDir) return false;
    if (containerName) {
      this.createContainer_(containerName);
      const container = this.containers.get(containerName);
      return await this._loadContainerFromDisk(containerName, container);
    }
    let anyLoaded = false;
    for (const [name, container] of this.containers) {
      if (await this._loadContainerFromDisk(name, container)) anyLoaded = true;
    }
    return anyLoaded;
  }

  // ─── Document operations ────────────────────────────────────────

  /**
   * Resolve `arg` (third positional) into normalized options.
   * Accepts either a string container name (legacy) or an options object.
   * @private
   */
  resolveContainerArg_(arg) {
    if (typeof arg === 'string') return { containerName: this.normalizeIndexName_(arg) };
    if (arg && typeof arg === 'object') return { containerName: this.defaultIndex_, ...arg };
    return { containerName: this.defaultIndex_ };
  }

  /**
   * Add a document. Backward-compatible: `add(key, jsonObject, containerName)`.
   * Also accepts `add(key, jsonObject, { containerName })`.
   *
   * @param {string} key
   * @param {Object} jsonObject
   * @param {string|Object} [containerOrOptions]
   * @return {Promise<boolean>} True when indexed; false when key already exists.
   */
  async add(key, jsonObject, containerOrOptions = this.defaultIndex_) {
    if (!key || typeof key !== 'string' || key.trim() === '') {
      throw new Error('Invalid key: must be a non-empty string');
    }
    if (!jsonObject || typeof jsonObject !== 'object' || Array.isArray(jsonObject)) {
      throw new Error('Invalid jsonObject: must be a non-null object');
    }

    const { containerName } = this.resolveContainerArg_(containerOrOptions);
    const { name, container } = this.getContainer_(containerName);

    if (container.documents.has(key)) {
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('search:add:error', {
          jsonObject, key, searchContainer: name, error: 'Key already exists.'
        });
      }
      return false;
    }

    this.indexDocumentFields_(key, jsonObject, container, name);
    analytics.trackAdd(name);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('search:add', { jsonObject, key, searchContainer: name });
    }
    return true;
  }

  /**
   * Batch-add documents. Each document's id is read from `idField`.
   *
   * @param {Array<Object>} documents
   * @param {string|Object} [containerOrOptions]
   * @return {Promise<{added: number, skipped: number}>}
   */
  async addAll(documents, containerOrOptions = this.defaultIndex_) {
    if (!Array.isArray(documents)) {
      throw new Error('addAll requires an array of documents');
    }
    let added = 0, skipped = 0;
    for (const doc of documents) {
      const id = doc && doc[this.idField_];
      if (id == null) { skipped++; continue; }
      const ok = await this.add(String(id), doc, containerOrOptions);
      if (ok) added++; else skipped++;
    }
    return { added, skipped };
  }

  /**
   * Replace a document (remove + add). If the document doesn't exist yet,
   * it is added. Id is read from `idField`.
   *
   * @param {Object} document
   * @param {string|Object} [containerOrOptions]
   * @return {Promise<boolean>}
   */
  async replace(document, containerOrOptions = this.defaultIndex_) {
    if (!document || typeof document !== 'object') {
      throw new Error('replace requires a document object');
    }
    const id = document[this.idField_];
    if (id == null) {
      throw new Error(`replace: document missing idField '${this.idField_}'`);
    }
    const key = String(id);
    const { containerName } = this.resolveContainerArg_(containerOrOptions);
    await this.remove(key, containerName);
    return this.add(key, document, containerName);
  }

  /**
   * Remove a document.
   *
   * @param {string} key
   * @param {string|Object} [containerOrOptions]
   * @return {Promise<boolean>}
   */
  async remove(key, containerOrOptions = this.defaultIndex_) {
    if (!key || typeof key !== 'string' || key.trim() === '') {
      throw new Error('Invalid key: must be a non-empty string');
    }
    const { containerName } = this.resolveContainerArg_(containerOrOptions);
    return this.removeDocument(key, containerName);
  }

  /**
   * Discard — MiniSearch-compatible alias for remove.
   */
  async discard(id, containerOrOptions = this.defaultIndex_) {
    return this.remove(id, containerOrOptions);
  }

  /**
   * Remove many documents. Accepts either an array of ids (strings/numbers)
   * or an array of documents (uses idField).
   *
   * @param {Array<string|Object>} idsOrDocuments
   * @param {string|Object} [containerOrOptions]
   * @return {Promise<{removed: number, missing: number}>}
   */
  async removeAll(idsOrDocuments, containerOrOptions = this.defaultIndex_) {
    if (!Array.isArray(idsOrDocuments)) {
      throw new Error('removeAll requires an array');
    }
    let removed = 0, missing = 0;
    for (const item of idsOrDocuments) {
      let id;
      if (typeof item === 'string' || typeof item === 'number') id = String(item);
      else if (item && typeof item === 'object') id = String(item[this.idField_]);
      else { missing++; continue; }
      const ok = await this.remove(id, containerOrOptions);
      if (ok) removed++; else missing++;
    }
    return { removed, missing };
  }

  /**
   * Internal: index a document across all configured fields.
   * @private
   */
  indexDocumentFields_(id, document, container, containerName) {
    const fieldTokens = new Map();
    const fieldLengths = new Map();
    const snippetParts = this.snippet_.enabled ? [] : null;
    let totalNewTokens = 0;

    for (const field of this.fields_) {
      const rawValue = this.extractFieldValue_(document, field);
      if (snippetParts) snippetParts.push(rawValue);
      const { terms, tf } = this.tokenizeWithFrequency_(rawValue, field);

      // Per-field token cap
      let limitedEntries = Array.from(tf.entries());
      if (limitedEntries.length > this.maxTokensPerDocument) {
        limitedEntries = limitedEntries.slice(0, this.maxTokensPerDocument);
      }

      const tokenSetForField = new Set();
      for (const [token, count] of limitedEntries) {
        if (container.tokens.size >= this.maxTotalTokens && !container.tokens.has(token)) {
          this.logger?.warn(
            `[${this.constructor.name}] Token cap (${this.maxTotalTokens}) reached for ${containerName}`
          );
          break;
        }
        let byField = container.tokens.get(token);
        if (!byField) { byField = new Map(); container.tokens.set(token, byField); totalNewTokens++; }
        let docMap = byField.get(field);
        if (!docMap) { docMap = new Map(); byField.set(field, docMap); }
        docMap.set(id, count);
        tokenSetForField.add(token);
      }

      fieldTokens.set(field, tokenSetForField);
      fieldLengths.set(field, terms.length);

      // Track per-field length stats for BM25
      const stats = container.fieldStats.get(field) || { totalLength: 0, docCount: 0 };
      stats.totalLength += terms.length;
      stats.docCount += 1;
      container.fieldStats.set(field, stats);
    }

    container.documents.set(id, {
      storedFields: this.buildStoredFields_(document),
      sourceDoc: this.storeFields_ ? null : document,
      fieldTokens,
      fieldLengths,
      ...(snippetParts ? { text: snippetParts.join('\n') } : {}),
      isIndexed: true
    });

    this.lastIndexTime = new Date();
  }

  /**
   * Remove a document and clean up its postings + stats.
   *
   * @param {string} id
   * @param {string} [containerName]
   * @return {boolean}
   */
  removeDocument(id, containerName = this.defaultIndex_) {
    const { name, container } = this.getContainer_(containerName);
    const docInfo = container.documents.get(id);
    if (!docInfo) return false;

    for (const [field, tokenSet] of docInfo.fieldTokens) {
      for (const token of tokenSet) {
        const byField = container.tokens.get(token);
        if (!byField) continue;
        const docMap = byField.get(field);
        if (!docMap) continue;
        docMap.delete(id);
        if (docMap.size === 0) byField.delete(field);
        if (byField.size === 0) container.tokens.delete(token);
      }
      const stats = container.fieldStats.get(field);
      if (stats) {
        stats.totalLength -= (docInfo.fieldLengths.get(field) || 0);
        stats.docCount -= 1;
        if (stats.docCount <= 0) {
          container.fieldStats.delete(field);
        } else {
          container.fieldStats.set(field, stats);
        }
      }
    }

    container.documents.delete(id);
    analytics.trackDelete(name);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('search:remove', { key: id, searchContainer: name });
    }
    return true;
  }

  /**
   * Indexer-facing upsert. Indexes raw text into the synthetic `_all` field
   * regardless of configured fields. Used by crawler/indexer consumers that
   * deal in (id, content, metadata) tuples and chunked sub-documents.
   */
  async indexDocument(id, content, metadata = {}, containerName = this.defaultIndex_) {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid id: must be a non-empty string');
    }
    const { name, container } = this.getContainer_(containerName);
    if (container.documents.has(id)) {
      this.removeDocument(id, name);
    }

    // Force-index the synthetic _all field even when fields_ is something else
    const { terms, tf } = this.tokenizeWithFrequency_(content || '', SYNTHETIC_FIELD);
    const limited = Array.from(tf.entries()).slice(0, this.maxTokensPerDocument);
    const tokenSet = new Set();
    for (const [token, count] of limited) {
      if (container.tokens.size >= this.maxTotalTokens && !container.tokens.has(token)) break;
      let byField = container.tokens.get(token);
      if (!byField) { byField = new Map(); container.tokens.set(token, byField); }
      let docMap = byField.get(SYNTHETIC_FIELD);
      if (!docMap) { docMap = new Map(); byField.set(SYNTHETIC_FIELD, docMap); }
      docMap.set(id, count);
      tokenSet.add(token);
    }

    const stats = container.fieldStats.get(SYNTHETIC_FIELD) || { totalLength: 0, docCount: 0 };
    stats.totalLength += terms.length;
    stats.docCount += 1;
    container.fieldStats.set(SYNTHETIC_FIELD, stats);

    container.documents.set(id, {
      storedFields: { ...metadata },
      sourceDoc: metadata.object || null,
      fieldTokens: new Map([[SYNTHETIC_FIELD, tokenSet]]),
      fieldLengths: new Map([[SYNTHETIC_FIELD, terms.length]]),
      excerpt: this.generateExcerpt_(content),
      ...(this.snippet_.enabled ? { text: String(content || '') } : {}),
      isIndexed: true
    });

    this.lastIndexTime = new Date();
    analytics.trackAdd(name);
    if (this.eventEmitter_) {
      this.eventEmitter_.emit('search:add', { key: id, searchContainer: name, tokenCount: limited.length });
    }
    return true;
  }

  // ─── Search ─────────────────────────────────────────────────────

  /**
   * Search the index. Returns documents scored with BM25.
   *
   * Quoted segments are exact phrases. `Oracle "MySQL Enterprise"` scores on
   * all three words but only returns documents in which "mysql enterprise"
   * appears adjacent and in order (case-insensitive, punctuation-insensitive).
   * Phrase terms are never prefix-, fuzzy- or synonym-expanded — a quoted term
   * means what it says. Multiple phrases are ANDed together regardless of
   * `combineWith`. Pass `quotedPhrases: false` to treat quotes as literal
   * characters (callers that feed non-user text through search).
   *
   * @param {string} query
   * @param {string|Object} [containerOrOptions] Container name (legacy)
   *   or options object: { containerName, fields, boost, prefix, fuzzy,
   *   filter, combineWith, tokenize, processTerm, maxResults, quotedPhrases }.
   * @return {Promise<Array<Object>>}
   */
  async search(query, containerOrOptions = this.defaultIndex_) {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      throw new Error('Invalid searchTerm: must be a non-empty string');
    }

    const opts = this.mergeSearchOptions_(containerOrOptions, this.searchOptions_);
    const { name, container } = this.getContainer_(opts.containerName);

    const searchFields = Array.isArray(opts.fields) && opts.fields.length > 0
      ? opts.fields
      : this.fields_;
    const boost = opts.boost || {};
    const combineAnd = String(opts.combineWith || 'OR').toUpperCase() === 'AND';
    const tokenizeFn = typeof opts.tokenize === 'function' ? opts.tokenize : this.tokenizeFn_;
    const processFn = typeof opts.processTerm === 'function' ? opts.processTerm : this.processTermFn_;
    const filterFn = typeof opts.filter === 'function' ? opts.filter : null;
    const maxResults = Number.isInteger(opts.maxResults) && opts.maxResults > 0 ? opts.maxResults : null;

    // Split off quoted phrases. `remainder` still carries the phrase words, so
    // they are tokenized and scored like any other term; the phrases are then
    // enforced as a post-filter over the scored documents.
    const { phrases, remainder } = opts.quotedPhrases === false
      ? { phrases: [], remainder: query.trim() }
      : parseQuotedPhrases(query);
    const phraseMatchers = this.buildPhraseMatchers_(phrases, tokenizeFn, processFn);

    // Tokenize query
    const rawQueryTokens = tokenizeFn(remainder || query.trim());
    const queryTokens = [];
    for (const t of rawQueryTokens) {
      const processed = processFn(t);
      if (processed) queryTokens.push(processed);
    }
    if (queryTokens.length === 0) {
      // A query made entirely of unindexable words ("the", "of") normally has
      // nothing to match. Quoted, it is still a legitimate request — fall back
      // to scanning retained document text for the phrase.
      const scanned = phraseMatchers.length
        ? this.phraseOnlyScan_(container, phraseMatchers, filterFn, maxResults)
        : [];
      analytics.trackSearch(query, scanned.length, name);
      return scanned;
    }

    // Terms that came from a quoted phrase are matched verbatim: no prefix,
    // fuzzy or synonym expansion, since the phrase filter would reject those
    // documents anyway and expanding them only wastes scoring work.
    const exactTokens = new Set();
    for (const m of phraseMatchers) for (const t of m.tokens) exactTokens.add(t);

    // Resolve prefix/fuzzy options into per-token configuration
    const tokenConfigs = queryTokens.map((token, i, terms) => {
      const exact = exactTokens.has(token);
      return {
        token,
        exact,
        prefix: exact ? false : this.shouldPrefix_(opts.prefix, token, i, terms),
        fuzzy: exact ? 0 : this.resolveFuzzy_(opts.fuzzy, token, i, terms)
      };
    });

    // scores[docId] = totalScore
    // matchInfo[docId] = { token -> Set<field> }
    // matchedTokens[docId] = Set<originalQueryToken>
    const scores = new Map();
    const matchInfo = new Map();
    const matchedTokens = new Map();
    const N = container.documents.size;

    for (const cfg of tokenConfigs) {
      // Expand to candidates: exact + prefix + fuzzy
      const candidates = this.expandTokenCandidates_(cfg, container);

      for (const { token: matchedToken, weight } of candidates) {
        const byField = container.tokens.get(matchedToken);
        if (!byField) continue;
        for (const field of searchFields) {
          const docMap = byField.get(field);
          if (!docMap) continue;
          const fieldBoost = boost[field] != null ? boost[field] : 1;
          const idf = this.computeIDF_(matchedToken, container, N);
          const fieldStats = container.fieldStats.get(field);
          const avgFieldLen = fieldStats && fieldStats.docCount > 0
            ? fieldStats.totalLength / fieldStats.docCount
            : 0;

          for (const [docId, tf] of docMap) {
            const doc = container.documents.get(docId);
            if (!doc) continue;
            const fieldLen = doc.fieldLengths.get(field) || 0;
            const contribution = this.bm25Score_(tf, idf, fieldLen, avgFieldLen) * fieldBoost * weight;
            scores.set(docId, (scores.get(docId) || 0) + contribution);

            let mi = matchInfo.get(docId);
            if (!mi) { mi = new Map(); matchInfo.set(docId, mi); }
            let fieldSet = mi.get(cfg.token);
            if (!fieldSet) { fieldSet = new Set(); mi.set(cfg.token, fieldSet); }
            fieldSet.add(field);

            let mt = matchedTokens.get(docId);
            if (!mt) { mt = new Set(); matchedTokens.set(docId, mt); }
            mt.add(cfg.token);
          }
        }
      }
    }

    // AND mode: drop docs that didn't match every query token
    if (combineAnd) {
      for (const [docId, mt] of matchedTokens) {
        if (mt.size < queryTokens.length) scores.delete(docId);
      }
    }

    const results = [];
    for (const [docId, score] of scores) {
      const doc = container.documents.get(docId);
      if (!doc) continue;
      // Exact-phrase gate: every quoted phrase must appear in this document.
      if (phraseMatchers.length &&
          !this.matchesAllPhrases_(doc, phraseMatchers, matchedTokens.get(docId))) {
        continue;
      }
      const match = {};
      const mi = matchInfo.get(docId);
      if (mi) {
        for (const [token, fieldSet] of mi) match[token] = Array.from(fieldSet);
      }
      const terms = matchedTokens.get(docId)
        ? Array.from(matchedTokens.get(docId))
        : [];
      const result = {
        ...(doc.storedFields || {}),
        id: docId,
        key: docId,                      // legacy alias
        score,
        match,
        terms,
        obj: doc.sourceDoc || doc.storedFields || {}
      };
      if (filterFn && !filterFn(result)) continue;
      results.push(result);
    }

    results.sort((a, b) => b.score - a.score);
    const sliced = maxResults ? results.slice(0, maxResults) : results;

    // Attach a match-centered context snippet to each returned result. Done
    // after slicing so broad queries don't pay to build snippets for docs that
    // won't be returned. Requires the doc's raw text (retained only when the
    // `snippet` option is enabled at construction).
    if (this.snippet_.enabled) {
      for (const r of sliced) {
        const doc = container.documents.get(r.id);
        if (doc && doc.text) r.snippet = this.buildSnippet_(doc.text, r.terms, phraseMatchers);
      }
    }

    analytics.trackSearch(query, sliced.length, name);
    if (this.eventEmitter_) {
      this.eventEmitter_.emit('search:search', {
        searchTerm: query, searchContainer: name, results: sliced.length
      });
    }
    return sliced;
  }

  /**
   * @private
   */
  mergeSearchOptions_(containerOrOptions, defaults) {
    const base = typeof containerOrOptions === 'string'
      ? { containerName: this.normalizeIndexName_(containerOrOptions) }
      : { containerName: this.defaultIndex_, ...(containerOrOptions || {}) };
    return { ...defaults, ...base };
  }

  /**
   * Decide whether prefix expansion applies to this query token.
   * @private
   */
  shouldPrefix_(prefixOpt, token, i, terms) {
    if (prefixOpt === true) return true;
    if (typeof prefixOpt === 'function') return !!prefixOpt(token, i, terms);
    return false;
  }

  /**
   * Resolve fuzzy option into a max edit distance for this token.
   * Returns 0 if fuzzy not applicable.
   * @private
   */
  resolveFuzzy_(fuzzyOpt, token, i, terms) {
    if (fuzzyOpt == null || fuzzyOpt === false) return 0;
    let value = fuzzyOpt;
    if (typeof fuzzyOpt === 'function') value = fuzzyOpt(token, i, terms);
    if (value === true) value = 0.2;
    if (typeof value !== 'number' || value <= 0) return 0;
    if (value < 1) return Math.max(1, Math.round(value * token.length));
    return Math.floor(value);
  }

  /**
   * Build the candidate match list (exact + prefix + fuzzy) for a query token.
   * Each candidate carries a weight in (0, 1] reflecting match quality.
   * @private
   */
  expandTokenCandidates_(cfg, container) {
    const out = [];
    const seen = new Set();

    // A term inside quotes matches itself and nothing else.
    if (cfg.exact) {
      return container.tokens.has(cfg.token) ? [{ token: cfg.token, weight: 1 }] : [];
    }

    if (container.tokens.has(cfg.token)) {
      out.push({ token: cfg.token, weight: 1 });
      seen.add(cfg.token);
    }

    if (cfg.prefix || cfg.fuzzy > 0) {
      for (const token of container.tokens.keys()) {
        if (seen.has(token)) continue;
        if (cfg.prefix && token.startsWith(cfg.token) && token !== cfg.token) {
          out.push({ token, weight: 0.5 });
          seen.add(token);
          continue;
        }
        if (cfg.fuzzy > 0) {
          const d = levenshtein.distance(cfg.token, token, cfg.fuzzy);
          if (d <= cfg.fuzzy && d > 0) {
            const weight = Math.max(0.1, 1 - d / Math.max(cfg.token.length, token.length));
            out.push({ token, weight: weight * 0.8 });
            seen.add(token);
          }
        }
      }
    }

    // Synonym expansion: inject the configured equivalents of this query token
    // (e.g. "bitrix" → "bitrix24") as full-strength candidates. Matches on them
    // are attributed to the original query token by the caller, so coverage and
    // AND-mode semantics are preserved.
    if (this.synonymMap_ && this.synonymMap_.size) {
      const syns = this.synonymMap_.get(cfg.token);
      if (syns) {
        for (const synToken of syns) {
          if (seen.has(synToken)) continue;
          if (container.tokens.has(synToken)) {
            out.push({ token: synToken, weight: this.synonymWeight_ });
            seen.add(synToken);
          }
        }
      }
    }

    return out;
  }

  // ─── Exact phrases ──────────────────────────────────────────────

  /**
   * Split a query into its quoted phrases and the remaining text. Exposed so
   * consumers that post-process results (re-rankers, highlighters) can reason
   * about the same phrases the search engine enforced.
   *
   * @param {string} query
   * @return {{phrases: Array<string>, remainder: string}}
   */
  parseQuery(query) {
    return parseQuotedPhrases(query);
  }

  /**
   * Compile each quoted phrase into a matcher: the normalized needle used for
   * the text check, plus the indexable tokens used to cheaply narrow candidate
   * documents before that check runs.
   *
   * @param {Array<string>} phrases
   * @param {function(string, string=): Array<string>} tokenizeFn
   * @param {function(string, string=): (string|null|false)} processFn
   * @return {Array<{phrase: string, needle: string, words: Array<string>, tokens: Array<string>}>}
   * @private
   */
  buildPhraseMatchers_(phrases, tokenizeFn, processFn) {
    const matchers = [];
    for (const phrase of phrases || []) {
      const needle = normalizeForPhrase(phrase);
      if (!needle) continue;
      const tokens = [];
      for (const t of tokenizeFn(phrase)) {
        const processed = processFn(t);
        if (processed && !tokens.includes(processed)) tokens.push(processed);
      }
      matchers.push({ phrase, needle, words: needle.trim().split(' '), tokens });
    }
    return matchers;
  }

  /**
   * True when the document satisfies every quoted phrase.
   *
   * Two stages: an index-only check that all of a phrase's indexable tokens hit
   * this document (cheap, rejects nearly everything), then an adjacency check
   * against the document's text. When no text is recoverable — the index was
   * built without `snippet` retention and stores only metadata — the token-level
   * AND is the strongest available signal and the document is kept rather than
   * silently dropped.
   *
   * @param {Object} doc Document entry from the container.
   * @param {Array<Object>} matchers From buildPhraseMatchers_.
   * @param {Set<string>|undefined} matchedTokenSet Query tokens this doc matched.
   * @return {boolean}
   * @private
   */
  matchesAllPhrases_(doc, matchers, matchedTokenSet) {
    for (const m of matchers) {
      for (const token of m.tokens) {
        if (!matchedTokenSet || !matchedTokenSet.has(token)) return false;
      }
    }
    const haystack = this.phraseHaystack_(doc);
    if (!haystack) return true;
    for (const m of matchers) {
      if (haystack.indexOf(m.needle) === -1) return false;
    }
    return true;
  }

  /**
   * Normalized text of a document for phrase matching. Prefers the raw text
   * retained by the `snippet` option; otherwise reconstructs the indexed fields
   * from the stored source document and falls back to the excerpt.
   *
   * @param {Object} doc
   * @return {string} Normalized (padded) text, or '' when unavailable.
   * @private
   */
  phraseHaystack_(doc) {
    if (doc.text) return normalizeForPhrase(doc.text);
    const parts = [];
    const source = doc.sourceDoc || doc.storedFields;
    if (source && typeof source === 'object') {
      for (const field of this.fields_) {
        const value = this.extractFieldValue_(source, field);
        if (value) parts.push(value);
      }
    }
    if (doc.excerpt) parts.push(String(doc.excerpt));
    return parts.length ? normalizeForPhrase(parts.join('\n')) : '';
  }

  /**
   * Match phrases by scanning document text, used only when the query has no
   * indexable tokens at all (every word is a stop word or below the minimum
   * length, e.g. `"the who"`). Scores by occurrence count so the ordering is
   * still meaningful.
   *
   * @param {Object} container
   * @param {Array<Object>} matchers
   * @param {?function(Object): boolean} filterFn
   * @param {?number} maxResults
   * @return {Array<Object>}
   * @private
   */
  phraseOnlyScan_(container, matchers, filterFn, maxResults) {
    const results = [];
    for (const [docId, doc] of container.documents) {
      const haystack = this.phraseHaystack_(doc);
      if (!haystack) continue;
      let score = 0;
      let matchedAll = true;
      for (const m of matchers) {
        let count = 0;
        let at = haystack.indexOf(m.needle);
        // Overlapping matches share the padding space, so step back one char.
        while (at !== -1) { count++; at = haystack.indexOf(m.needle, at + m.needle.length - 1); }
        if (count === 0) { matchedAll = false; break; }
        score += count;
      }
      if (!matchedAll) continue;
      const terms = matchers.flatMap(m => m.words);
      const result = {
        ...(doc.storedFields || {}),
        id: docId,
        key: docId,
        score,
        match: {},
        terms,
        obj: doc.sourceDoc || doc.storedFields || {}
      };
      if (filterFn && !filterFn(result)) continue;
      if (this.snippet_.enabled && doc.text) {
        result.snippet = this.buildSnippet_(doc.text, terms, matchers);
      }
      results.push(result);
    }
    results.sort((a, b) => b.score - a.score);
    return maxResults ? results.slice(0, maxResults) : results;
  }

  /**
   * Build the query-expansion synonym map from the configured `synonyms` option.
   *
   * Accepts either:
   *  - an object of key → equivalent(s): `{ bitrix: 'bitrix24', aws: ['amazon web services'] }`
   *  - an array of equivalence groups: `[['bitrix', 'bitrix24'], ['aws', 'amazon web services']]`
   *
   * Every member of a group is treated as equivalent (bidirectional). Members
   * are tokenized with the index's own tokenizer so the mapped tokens line up
   * with what is actually indexed; the resulting map is token → Set(equivalent
   * tokens). Multi-word members contribute each of their tokens.
   *
   * @param {Object|Array|undefined} synonyms
   * @return {Map<string, Set<string>>}
   * @private
   */
  buildSynonymMap_(synonyms) {
    const map = new Map();
    if (!synonyms) return map;

    let groups = [];
    if (Array.isArray(synonyms)) {
      groups = synonyms.map(g => (Array.isArray(g) ? g : [g]));
    } else if (typeof synonyms === 'object') {
      for (const [key, value] of Object.entries(synonyms)) {
        const values = Array.isArray(value) ? value : [value];
        groups.push([key, ...values]);
      }
    }

    for (const group of groups) {
      const allTokens = new Set();
      for (const member of group) {
        for (const t of this.tokenize(String(member == null ? '' : member))) {
          allTokens.add(t);
        }
      }
      for (const token of allTokens) {
        let set = map.get(token);
        if (!set) { set = new Set(); map.set(token, set); }
        for (const other of allTokens) if (other !== token) set.add(other);
      }
    }

    return map;
  }

  /**
   * Document frequency of a token (unique docs across all fields).
   * @private
   */
  computeDF_(token, container) {
    const byField = container.tokens.get(token);
    if (!byField) return 0;
    const docs = new Set();
    for (const docMap of byField.values()) {
      for (const docId of docMap.keys()) docs.add(docId);
    }
    return docs.size;
  }

  /**
   * BM25 IDF component. Floored at a small positive value so common terms
   * still contribute slightly rather than going negative.
   * @private
   */
  computeIDF_(token, container, N) {
    if (N <= 0) return 0;
    const df = this.computeDF_(token, container);
    if (df === 0) return 0;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    return Math.max(idf, 1e-6);
  }

  /**
   * BM25 score for one (token, field, doc) triple.
   * @private
   */
  bm25Score_(tf, idf, fieldLen, avgFieldLen) {
    if (tf <= 0 || idf <= 0) return 0;
    const { k1, b } = this.bm25_;
    const norm = avgFieldLen > 0 ? (1 - b + b * (fieldLen / avgFieldLen)) : 1;
    return idf * (tf * (k1 + 1)) / (tf + k1 * norm);
  }

  // ─── autoSuggest & suggest ──────────────────────────────────────

  /**
   * MiniSearch-style auto-suggest. Prefix-expands the *last* query token
   * and ranks composed suggestions by document relevance of the synthetic query.
   *
   * @param {string} query
   * @param {Object} [options]
   * @return {Promise<Array<{suggestion: string, terms: Array<string>, score: number}>>}
   */
  async autoSuggest(query, options = {}) {
    const merged = { ...this.autoSuggestOptions_, ...(options || {}) };
    if (!query || typeof query !== 'string' || query.trim() === '') return [];

    const containerName = this.normalizeIndexName_(merged.containerName);
    const { container } = this.getContainer_(containerName);
    const maxSuggestions = Number.isInteger(merged.maxSuggestions) && merged.maxSuggestions > 0
      ? merged.maxSuggestions
      : 10;
    const filterFn = typeof merged.filter === 'function' ? merged.filter : null;

    const tokenizeFn = typeof merged.tokenize === 'function' ? merged.tokenize : this.tokenizeFn_;
    const processFn = typeof merged.processTerm === 'function' ? merged.processTerm : this.processTermFn_;

    // Tokenize once. The last token is treated as a partial being typed —
    // it gets lowercased but bypasses minTokenLength so "ar" → "art"/"archery"
    // is reachable. Earlier (completed) tokens go through full processTerm.
    const rawTokens = tokenizeFn(query.trim());
    if (rawTokens.length === 0) return [];
    const prefixTokens = [];
    for (const t of rawTokens.slice(0, -1)) {
      const p = processFn(t);
      if (p) prefixTokens.push(p);
    }
    const lastToken = String(rawTokens[rawTokens.length - 1]).toLowerCase();
    if (!lastToken) return [];

    // Gather prefix-expansion candidates for the last token (always prefix-on
    // for autoSuggest). Include the last token itself if present in the index.
    const candidates = [];
    if (container.tokens.has(lastToken)) candidates.push(lastToken);
    for (const token of container.tokens.keys()) {
      if (token === lastToken) continue;
      if (token.startsWith(lastToken)) candidates.push(token);
      if (candidates.length > 200) break; // safety cap before scoring
    }

    // If fuzzy supplied, also include near-matches of the last token
    const allTokens = [...prefixTokens, lastToken];
    const fuzzyMax = this.resolveFuzzy_(merged.fuzzy, lastToken, allTokens.length - 1, allTokens);
    if (fuzzyMax > 0) {
      for (const token of container.tokens.keys()) {
        if (candidates.includes(token)) continue;
        if (levenshtein.distance(lastToken, token, fuzzyMax) <= fuzzyMax) {
          candidates.push(token);
        }
        if (candidates.length > 400) break;
      }
    }

    const suggestions = [];
    for (const candidate of candidates) {
      const composedTerms = [...prefixTokens, candidate];
      const composedQuery = composedTerms.join(' ');

      // Score the composed query against the index using search()
      const searchOptions = {
        containerName,
        fields: merged.fields,
        boost: merged.boost,
        combineWith: 'AND',
        maxResults: 1,
        filter: filterFn
      };
      let topScore = 0;
      try {
        const res = await this.search(composedQuery, searchOptions);
        if (res.length > 0) topScore = res[0].score;
      } catch (_) {
        topScore = 0;
      }
      if (topScore > 0) {
        suggestions.push({ suggestion: composedQuery, terms: composedTerms, score: topScore });
      }
    }

    suggestions.sort((a, b) => b.score - a.score);
    return suggestions.slice(0, maxSuggestions);
  }

  /**
   * Legacy suggest API. Returns document-name matches and raw token prefix
   * matches. Kept for backward compatibility; new callers should use
   * `autoSuggest` for ranked compositional suggestions.
   *
   * @param {string} query
   * @param {Object} [options]
   * @return {Array<Object>}
   */
  suggest(query, options = {}) {
    if (!query || query.length < 2) return [];

    const maxSuggestions = options.maxSuggestions || 10;
    const containerName = this.normalizeIndexName_(options.containerName);
    const { container } = this.getContainer_(containerName);
    const queryLower = query.toLowerCase();

    const documentSuggestions = [];
    for (const docInfo of container.documents.values()) {
      const stored = docInfo.storedFields || {};
      const docName = stored.name || stored.title
        || (docInfo.sourceDoc && (docInfo.sourceDoc.name || docInfo.sourceDoc.title))
        || '';
      if (!docName) continue;
      const nameLower = docName.toLowerCase();
      if (nameLower.includes(queryLower)) {
        documentSuggestions.push({
          title: docName,
          type: 'document',
          relevance: nameLower.startsWith(queryLower) ? 2 : 1
        });
      }
      if (documentSuggestions.length >= maxSuggestions) break;
    }

    const tokenSuggestions = [];
    if (documentSuggestions.length < maxSuggestions) {
      for (const token of container.tokens.keys()) {
        if (token.startsWith(queryLower) && token !== queryLower) {
          tokenSuggestions.push(token);
          if (tokenSuggestions.length >= (maxSuggestions - documentSuggestions.length)) break;
        }
      }
    }

    documentSuggestions.sort((a, b) => b.relevance - a.relevance);
    return [...documentSuggestions, ...tokenSuggestions].slice(0, maxSuggestions);
  }

  // ─── Stats & index management ───────────────────────────────────

  getStats(containerName = null) {
    if (containerName) {
      const { container } = this.getContainer_(containerName);
      return {
        searchContainer: this.normalizeIndexName_(containerName),
        totalDocuments: container.documents.size,
        indexedDocuments: Array.from(container.documents.values()).filter(d => d.isIndexed).length,
        totalTokens: container.tokens.size,
        lastIndexTime: this.lastIndexTime
      };
    }
    let totalDocs = 0, totalIndexedDocs = 0, totalTokens = 0;
    for (const c of this.containers.values()) {
      totalDocs += c.documents.size;
      totalIndexedDocs += Array.from(c.documents.values()).filter(d => d.isIndexed).length;
      totalTokens += c.tokens.size;
    }
    return {
      totalContainers: this.containers.size,
      totalDocuments: totalDocs,
      indexedDocuments: totalIndexedDocs,
      totalTokens,
      lastIndexTime: this.lastIndexTime
    };
  }

  clearIndex(containerName = this.defaultIndex_) {
    const { name, container } = this.getContainer_(containerName);
    const previousSize = container.documents.size;
    container.documents.clear();
    container.tokens.clear();
    container.fieldStats.clear();
    if (this.eventEmitter_) {
      this.eventEmitter_.emit('search:index:cleared', { searchContainer: name, previousSize });
    }
    return true;
  }

  deleteIndex(containerName = this.defaultIndex_) {
    const resolved = this.normalizeIndexName_(containerName);
    if (resolved === this.defaultIndex_) {
      throw new Error('Cannot delete the default index');
    }
    if (!this.containers.has(resolved)) return false;
    const deleted = this.containers.delete(resolved);
    if (deleted && this.eventEmitter_) {
      this.eventEmitter_.emit('search:index:deleted', {
        searchContainer: resolved, remainingContainers: this.containers.size
      });
    }
    return deleted;
  }

  listIndexes() {
    return Array.from(this.containers.keys());
  }

  getIndexStats(containerName = this.defaultIndex_) {
    const resolved = this.normalizeIndexName_(containerName);
    if (!this.containers.has(resolved)) return null;
    const container = this.containers.get(resolved);
    return {
      searchContainer: resolved,
      size: container.documents.size,
      keys: Array.from(container.documents.keys()),
      tokenCount: container.tokens.size
    };
  }

  // ─── Context snippets ───────────────────────────────────────────

  /**
   * Normalize the `snippet` option into a resolved config. Accepts `true`
   * (enable with defaults), an options object, or a falsy value (disabled).
   *
   * @param {boolean|Object|undefined} opt
   * @return {{enabled: boolean, wordsBefore: number, wordsAfter: number,
   *   highlight: boolean, highlightTag: string, maxChars: number}}
   * @private
   */
  normalizeSnippetOptions_(opt) {
    const defaults = {
      enabled: false, wordsBefore: 10, wordsAfter: 10,
      highlight: true, highlightTag: 'mark', maxChars: 400
    };
    if (!opt) return defaults;
    const o = opt === true ? {} : (typeof opt === 'object' ? opt : {});
    return {
      enabled: o.enabled !== false,
      wordsBefore: Number.isInteger(o.wordsBefore) && o.wordsBefore >= 0 ? o.wordsBefore : 10,
      wordsAfter: Number.isInteger(o.wordsAfter) && o.wordsAfter >= 0 ? o.wordsAfter : 10,
      highlight: o.highlight !== false,
      highlightTag: typeof o.highlightTag === 'string' && o.highlightTag.trim()
        ? o.highlightTag.trim()
        : 'mark',
      maxChars: Number.isInteger(o.maxChars) && o.maxChars > 0 ? o.maxChars : 400
    };
  }

  /**
   * Build a match-centered context snippet from a document's retained text.
   * Locates the first occurrence of any matched query term and returns up to
   * `wordsBefore`/`wordsAfter` words on each side, clamped early at sentence
   * boundaries (`.`, `!`, `?`). Matched words are wrapped in the configured
   * highlight tag when highlighting is on. Falls back to a leading window when
   * no term is located in the stored text (e.g. prefix/synonym-only matches).
   *
   * When the query carried quoted phrases the snippet anchors on the phrase's
   * first word instead, so the window is centered on what the user asked for
   * rather than on whichever of its words happens to appear earliest.
   *
   * @param {string} text Retained document text.
   * @param {Array<string>} terms Matched query terms for this result.
   * @param {Array<Object>} [phraseMatchers] From buildPhraseMatchers_.
   * @return {string}
   * @private
   */
  buildSnippet_(text, terms, phraseMatchers) {
    const cfg = this.snippet_;
    if (!text) return '';
    const source = String(text);

    // Words with their source offsets, so we can measure the raw (punctuation-
    // bearing) gaps between them to detect sentence boundaries.
    const wordRe = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu;
    const words = [];
    let m;
    while ((m = wordRe.exec(source)) !== null) {
      words.push({ lower: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
      if (words.length >= 20000) break; // safety cap on very large texts
    }
    if (words.length === 0) return '';

    const termSet = Array.isArray(terms)
      ? terms.filter(Boolean).map(t => String(t).toLowerCase())
      : [];

    // Prefer the start of an exact-phrase occurrence.
    let anchor = -1;
    for (const m of (phraseMatchers || [])) {
      const pw = m.words;
      for (let i = 0; i + pw.length <= words.length; i++) {
        let hit = true;
        for (let j = 0; j < pw.length; j++) {
          if (words[i + j].lower !== pw[j]) { hit = false; break; }
        }
        if (hit) { anchor = i; break; }
      }
      if (anchor !== -1) break;
    }

    // First word matching any term (exact, or the term as a prefix of the word).
    for (let i = 0; i < words.length && anchor === -1; i++) {
      const w = words[i].lower;
      for (const t of termSet) {
        if (w === t || (t.length >= 3 && w.startsWith(t))) { anchor = i; break; }
      }
    }
    if (anchor === -1) anchor = 0;

    // Walk outward, stopping when the inter-word gap holds a sentence terminator.
    let startIdx = anchor;
    for (let s = 0; s < cfg.wordsBefore && startIdx > 0; s++) {
      if (/[.!?]/.test(source.slice(words[startIdx - 1].end, words[startIdx].start))) break;
      startIdx--;
    }
    let endIdx = anchor;
    for (let s = 0; s < cfg.wordsAfter && endIdx < words.length - 1; s++) {
      if (/[.!?]/.test(source.slice(words[endIdx].end, words[endIdx + 1].start))) break;
      endIdx++;
    }

    let sliceEnd = words[endIdx].end;
    // Pull in a trailing sentence terminator if it sits right after the last word.
    const tailM = /^\s*[.!?]/.exec(source.slice(sliceEnd, sliceEnd + 3));
    if (tailM) sliceEnd += tailM[0].length;

    let snippet = source.slice(words[startIdx].start, sliceEnd).replace(/\s+/g, ' ').trim();
    if (cfg.maxChars && snippet.length > cfg.maxChars) {
      snippet = snippet.slice(0, cfg.maxChars).replace(/\s+\S*$/, '').trim();
    }

    // Decide ellipses from the un-highlighted text (tags would confuse the test).
    const startsMid = startIdx > 0;
    const endsMid = endIdx < words.length - 1 && !/[.!?]$/.test(snippet);

    if (cfg.highlight && termSet.length) snippet = this.highlightTerms_(snippet, termSet);

    return `${startsMid ? '… ' : ''}${snippet}${endsMid ? ' …' : ''}`;
  }

  /**
   * Wrap occurrences of the matched terms (and the words they prefix) in the
   * configured highlight tag. Single-pass alternation so terms never double-wrap.
   *
   * @param {string} snippet
   * @param {Array<string>} termSet Lowercased matched terms.
   * @return {string}
   * @private
   */
  highlightTerms_(snippet, termSet) {
    const tag = this.snippet_.highlightTag;
    const uniq = Array.from(new Set(termSet))
      .filter(t => t && t.length >= 2)
      .sort((a, b) => b.length - a.length)
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!uniq.length) return snippet;
    let re;
    try {
      re = new RegExp('(?<![\\p{L}\\p{N}])(' + uniq.join('|') + ')([\\p{L}\\p{N}]*)', 'giu');
    } catch (_) {
      return snippet;
    }
    return snippet.replace(re, (_match, p1, p2) => `<${tag}>${p1}${p2}</${tag}>`);
  }

  // ─── Misc helpers ───────────────────────────────────────────────

  generateExcerpt_(content, maxLength = 200) {
    if (!content) return '';
    const cleaned = String(content)
      .replace(/#{1,6}\s/g, '')
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n\s*\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.substring(0, maxLength).replace(/\s+\w*$/, '') + '...';
  }

  async getSettings() { return this.settings; }
  async saveSettings(_settings) { /* placeholder */ }
}

module.exports = SearchService;
