/**
 * @fileoverview Apache SOLR search provider.
 *
 * Proxies search operations to an Apache SOLR instance over its HTTP REST API
 * (no SOLR-specific client dependency — uses axios). Exposes the same surface
 * as the default and tokens providers (add / remove / search / listIndexes /
 * etc.) so callers can swap providers without changing application code.
 *
 * Multi-index model
 * -----------------
 * The embedded providers support multiple named indexes (`searchContainer`).
 * This provider maps every container onto a single SOLR collection and
 * namespaces documents with a container field (default `_searchContainer_s`).
 * Containers are isolated at query time with a filter query (`fq`), and
 * created/cleared/deleted via delete-by-query. This avoids requiring SolrCloud
 * Collections-API or configset management and works on standalone SOLR too.
 *
 * Document model
 * --------------
 * Each stored document is written to SOLR as:
 *   - `<uniqueKey>`   the caller's key (defaults to the `id` field)
 *   - `<containerField>` the logical index name
 *   - `<sourceField>`  the full JSON object, stringified, for exact round-trip
 *   - `<textField>`    a recursively-flattened text blob of all string values,
 *                      for full-text matching (mirrors the default provider's
 *                      recursive string matching)
 * On search the source field is parsed back into `obj`, so results keep the
 * same `{ key, obj }` shape callers already expect (plus `id` and `score`).
 *
 * Schema note: the target collection must either run in schemaless mode or
 * have the configured uniqueKey, container, source and text fields defined.
 * The defaults (`id`, `_searchContainer_s`, `_source_s`, `_text_`) align with
 * SOLR's default `_default` configset.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.16
 */

'use strict';

const axios = require('axios');
const analytics = require('../modules/analytics');
const { parseQuotedPhrases } = require('../modules/queryParser');

/** SOLR query-syntax special characters that must be escaped in terms/values. */
const SOLR_SPECIAL_CHARS = /([+\-!(){}\[\]^"~*?:\\/]|&&|\|\|)/g;

/**
 * Search provider backed by Apache SOLR.
 * @class
 */
class SearchingSOLR {
  /**
   * @param {Object} [options] Configuration options.
   * @param {string} [options.SOLR_URL] Base SOLR URL including the `/solr`
   *   path, e.g. `http://localhost:8983/solr`.
   * @param {string} [options.SOLR_COLLECTION] Collection/core name. Default `default`.
   * @param {string} [options.SOLR_CONTAINER_FIELD] Field used to namespace
   *   logical indexes. Default `_searchContainer_s`.
   * @param {string} [options.SOLR_SOURCE_FIELD] Field holding the stringified
   *   source object. Default `_source_s`.
   * @param {string} [options.SOLR_TEXT_FIELD] Catch-all text field queried by
   *   default. Default `_text_`.
   * @param {string} [options.SOLR_UNIQUE_KEY] Document uniqueKey field. Default `id`.
   * @param {string} [options.defaultIndex] Default container name. Default `default`.
   * @param {number} [options.maxResults] Default `rows` when not specified. Default 50.
   * @param {number} [options.commitWithin] commitWithin window in ms. Default 1000.
   * @param {boolean} [options.commit] Force a hard commit on every write. Default false.
   * @param {number} [options.timeout] Request timeout in ms. Default 10000.
   * @param {string} [options.configName] Configset used when creating the
   *   collection via {@link SearchingSOLR#ensureCollection}. Default `_default`.
   * @param {number} [options.numShards] Shard count for collection creation. Default 1.
   * @param {number} [options.replicationFactor] Replication factor for collection
   *   creation. Default 1.
   * @param {number} [options.createTimeout] Timeout (ms) for Collections-API admin
   *   calls used during collection bootstrap. Default 60000.
   * @param {number} [options.readyAttempts] Number of poll attempts while waiting
   *   for a freshly-created collection to become queryable. Default 20.
   * @param {number} [options.readyDelayMs] Delay (ms) between readiness polls. Default 500.
   * @param {string} [options.username] Optional HTTP basic-auth username.
   * @param {string} [options.password] Optional HTTP basic-auth password.
   * @param {EventEmitter} [eventEmitter] Optional event emitter.
   * @param {Object} [dependencies] Injected dependencies (logging, etc).
   */
  constructor(options = {}, eventEmitter, dependencies = {}) {
    this.eventEmitter_ = eventEmitter;
    this.logger = (dependencies && dependencies.logging) || null;

    this.settings = {
      description: 'The following settings are needed for the SOLR provider',
      list: [
        { setting: 'SOLR_URL', type: 'string', values: ['http://localhost:8983/solr'] },
        { setting: 'SOLR_COLLECTION', type: 'string', values: ['default'] },
        { setting: 'SOLR_CONTAINER_FIELD', type: 'string', values: ['_searchContainer_s'] },
        { setting: 'SOLR_SOURCE_FIELD', type: 'string', values: ['_source_s'] },
        { setting: 'SOLR_TEXT_FIELD', type: 'string', values: ['_text_'] },
        { setting: 'SOLR_UNIQUE_KEY', type: 'string', values: ['id'] },
        { setting: 'maxResults', type: 'number', values: [50] },
        { setting: 'commitWithin', type: 'number', values: [1000] }
      ]
    };

    this.settings.SOLR_URL = options.SOLR_URL || 'http://localhost:8983/solr';
    this.settings.SOLR_COLLECTION = options.SOLR_COLLECTION || 'default';
    this.settings.SOLR_CONTAINER_FIELD = options.SOLR_CONTAINER_FIELD || '_searchContainer_s';
    this.settings.SOLR_SOURCE_FIELD = options.SOLR_SOURCE_FIELD || '_source_s';
    this.settings.SOLR_TEXT_FIELD = options.SOLR_TEXT_FIELD || '_text_';
    this.settings.SOLR_UNIQUE_KEY = options.SOLR_UNIQUE_KEY || 'id';
    this.settings.maxResults = options.maxResults || 50;
    this.settings.commitWithin = options.commitWithin != null ? options.commitWithin : 1000;

    this.defaultIndex_ = this.normalizeIndexName_(options.defaultIndex);
    this.commit_ = options.commit === true;
    this.timeout_ = options.timeout || 10000;
    this.auth_ = (options.username && options.password)
      ? { username: options.username, password: options.password }
      : null;

    // Parameters for bootstrapping the collection via the Collections API.
    this.collectionConfig_ = {
      configName: options.configName || '_default',
      numShards: options.numShards || 1,
      replicationFactor: options.replicationFactor || 1,
      createTimeout: options.createTimeout || 60000,
      readyAttempts: options.readyAttempts || 20,
      readyDelayMs: options.readyDelayMs || 500
    };

    this.client_ = this.buildClient_();
  }

  /**
   * Build/rebuild the axios client from current settings.
   * @private
   * @return {import('axios').AxiosInstance}
   */
  buildClient_() {
    const baseURL = String(this.settings.SOLR_URL).replace(/\/+$/, '');
    return axios.create({
      baseURL,
      timeout: this.timeout_,
      auth: this.auth_ || undefined,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Emit an event if an emitter is configured.
   * @private
   */
  emit_(name, payload) {
    if (this.eventEmitter_) this.eventEmitter_.emit(name, payload);
  }

  /**
   * Normalize an index/container name to a valid non-empty string.
   * @private
   * @param {string=} searchContainer
   * @return {string}
   */
  normalizeIndexName_(searchContainer) {
    if (typeof searchContainer === 'string') {
      const trimmed = searchContainer.trim();
      if (trimmed) return trimmed;
    }
    return this.defaultIndex_ || 'default';
  }

  /**
   * Resolve a third positional argument that may be a container name (legacy)
   * or an options object, into `{ containerName, ...rest }`.
   * @private
   */
  resolveContainerArg_(arg) {
    if (typeof arg === 'string') return { containerName: this.normalizeIndexName_(arg) };
    if (arg && typeof arg === 'object') {
      const { containerName, ...rest } = arg;
      return { containerName: this.normalizeIndexName_(containerName), ...rest };
    }
    return { containerName: this.defaultIndex_ };
  }

  /** Escape a value for safe inclusion inside a SOLR query/filter clause. @private */
  escapeSolr_(value) {
    return String(value).replace(SOLR_SPECIAL_CHARS, '\\$1');
  }

  /** Build the path to the configured collection's request handler. @private */
  path_(handler) {
    return `/${encodeURIComponent(this.settings.SOLR_COLLECTION)}/${handler}`;
  }

  /** Filter-query clause restricting results to one container. @private */
  containerFilter_(containerName) {
    return `${this.settings.SOLR_CONTAINER_FIELD}:"${this.escapeSolr_(containerName)}"`;
  }

  /**
   * Recursively collect all string/number/boolean values into a single text
   * blob (mirrors the default provider's recursive string matching).
   * @private
   * @param {*} value
   * @param {Array<string>} out
   */
  flattenText_(value, out) {
    if (value == null) return;
    if (typeof value === 'string') {
      out.push(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out.push(String(value));
    } else if (Array.isArray(value)) {
      for (const item of value) this.flattenText_(item, out);
    } else if (typeof value === 'object') {
      for (const key of Object.keys(value)) this.flattenText_(value[key], out);
    }
  }

  /**
   * Build the SOLR document for a key/object/container triple.
   * @private
   */
  buildDoc_(key, jsonObject, containerName) {
    const textParts = [];
    this.flattenText_(jsonObject, textParts);
    return {
      [this.settings.SOLR_UNIQUE_KEY]: key,
      [this.settings.SOLR_CONTAINER_FIELD]: containerName,
      [this.settings.SOLR_SOURCE_FIELD]: JSON.stringify(jsonObject),
      [this.settings.SOLR_TEXT_FIELD]: textParts.join(' ')
    };
  }

  /**
   * Issue an `/update` request, applying commit semantics.
   * @private
   * @param {Object} body SOLR update command document.
   * @return {Promise<Object>} SOLR response body.
   */
  async update_(body) {
    const params = {};
    if (this.commit_) {
      params.commit = true;
    } else {
      params.commitWithin = this.settings.commitWithin;
    }
    const res = await this.client_.post(this.path_('update'), body, { params });
    return res.data;
  }

  /**
   * Run a `/select` query against the collection.
   * @private
   * @param {Object} params SOLR query params.
   * @return {Promise<Object>} The `response`/`facet_counts` payload from SOLR.
   */
  async select_(params) {
    const res = await this.client_.get(this.path_('select'), {
      params: { wt: 'json', ...params }
    });
    return res.data;
  }

  /**
   * Parse a SOLR document back into the caller-facing result shape.
   * @private
   */
  toResult_(doc) {
    const key = doc[this.settings.SOLR_UNIQUE_KEY];
    let obj = {};
    const raw = doc[this.settings.SOLR_SOURCE_FIELD];
    if (raw != null) {
      try {
        obj = JSON.parse(Array.isArray(raw) ? raw[0] : raw);
      } catch (_) {
        obj = {};
      }
    }
    return {
      id: key,
      key,
      score: typeof doc.score === 'number' ? doc.score : undefined,
      obj
    };
  }

  // ─── Lifecycle ───────────────────────────────────────────────────

  /**
   * Ensure the configured collection exists, creating it via the SolrCloud
   * Collections API if necessary, then wait until it answers a trivial query.
   * Idempotent — safe to call on every startup.
   *
   * The collection name is taken from `SOLR_COLLECTION` (default `default`,
   * overridable in the constructor options). Creation parameters (configset,
   * shards, replication factor, timeouts) default to the values supplied at
   * construction time but can be overridden per-call.
   *
   * On standalone (non-cloud) SOLR the Collections API is unavailable; the
   * LIST/CREATE step is best-effort and the method still verifies the
   * collection/core is queryable, which is the real readiness signal.
   *
   * @param {Object} [overrides] Per-call overrides for creation parameters.
   * @param {string} [overrides.configName]
   * @param {number} [overrides.numShards]
   * @param {number} [overrides.replicationFactor]
   * @param {number} [overrides.readyAttempts]
   * @param {number} [overrides.readyDelayMs]
   * @return {Promise<boolean>} Resolves true once the collection is queryable.
   * @throws {Error} If the collection does not become queryable in time.
   *
   * @example
   * const search = registry.searching('solr', { SOLR_URL });
   * await search.ensureCollection();           // bootstrap "default"
   *
   * @example
   * const search = registry.searching('solr', { SOLR_COLLECTION: 'catalog' });
   * await search.ensureCollection({ numShards: 2 });
   */
  async ensureCollection(overrides = {}) {
    const collection = this.settings.SOLR_COLLECTION;
    const configName = overrides.configName || this.collectionConfig_.configName;
    const numShards = overrides.numShards || this.collectionConfig_.numShards;
    const replicationFactor = overrides.replicationFactor || this.collectionConfig_.replicationFactor;
    const readyAttempts = overrides.readyAttempts || this.collectionConfig_.readyAttempts;
    const readyDelayMs = overrides.readyDelayMs || this.collectionConfig_.readyDelayMs;

    // Collection CREATE in SolrCloud can take a while on first run, so admin
    // calls get a generous timeout independent of the per-request timeout.
    const admin = axios.create({
      baseURL: String(this.settings.SOLR_URL).replace(/\/+$/, ''),
      timeout: this.collectionConfig_.createTimeout,
      auth: this.auth_ || undefined
    });

    try {
      const list = await admin.get('/admin/collections', { params: { action: 'LIST', wt: 'json' } });
      const existing = (list.data && list.data.collections) || [];
      if (existing.includes(collection)) {
        this.logger?.info?.(`[${this.constructor.name}] Collection "${collection}" already exists`);
      } else {
        this.logger?.info?.(`[${this.constructor.name}] Creating collection "${collection}" (configset ${configName})`);
        await admin.get('/admin/collections', {
          params: {
            action: 'CREATE',
            name: collection,
            numShards,
            replicationFactor,
            'collection.configName': configName,
            wt: 'json'
          }
        });
        this.emit_('search:collection:created', { collection, configName });
        this.logger?.info?.(`[${this.constructor.name}] Created collection "${collection}"`);
      }
    } catch (error) {
      // Collections API may be unavailable (standalone SOLR) — fall through to
      // the queryability check, which is the authoritative readiness signal.
      this.logger?.warn?.(
        `[${this.constructor.name}] Collections-API bootstrap skipped: ${error.message}`,
        { collection }
      );
    }

    // Wait for the collection to answer a trivial query.
    for (let i = 0; i < readyAttempts; i++) {
      try {
        await admin.get(`/${encodeURIComponent(collection)}/select`, {
          params: { q: '*:*', rows: 0, wt: 'json' }
        });
        this.emit_('search:collection:ready', { collection });
        return true;
      } catch (_) {
        await new Promise(r => setTimeout(r, readyDelayMs));
      }
    }

    const error = new Error(`Collection "${collection}" did not become queryable in time`);
    this.emit_('search:error', { operation: 'ensureCollection', error: error.message });
    throw error;
  }

  // ─── Settings ────────────────────────────────────────────────────

  /** Get all settings. */
  async getSettings() {
    return this.settings;
  }

  /** Persist supplied settings, rebuilding the client if connection details change. */
  async saveSettings(settings) {
    let rebuild = false;
    for (let i = 0; i < this.settings.list.length; i++) {
      const key = this.settings.list[i].setting;
      if (settings[key] != null) {
        this.settings[key] = settings[key];
        if (key === 'SOLR_URL') rebuild = true;
        this.logger?.info(`[${this.constructor.name}] Setting changed: ${key}`, {
          setting: key,
          newValue: settings[key]
        });
      }
    }
    if (rebuild) this.client_ = this.buildClient_();
  }

  /**
   * Release local client resources. SOLR is a remote service reached over
   * stateless HTTP (axios with no keep-alive agent), so there is no connection
   * to close and NOTHING is sent to the server — this never shuts SOLR down.
   * It simply drops the client reference and marks the provider disconnected so
   * the instance can be garbage-collected on application shutdown.
   * @return {Promise<void>}
   */
  async close() {
    this.client_ = null;
    this.connected_ = false;
    this.logger?.info?.(`[${this.constructor.name}] Client released (remote SOLR left running)`);
    this.emit_('search:closed', { provider: 'solr' });
  }

  // ─── CRUD ────────────────────────────────────────────────────────

  /**
   * Add a JSON object under `key`. Returns false if the key already exists in
   * the container (matching the default provider's semantics).
   *
   * @param {string} key
   * @param {Object} jsonObject
   * @param {string|Object} [containerOrOptions]
   * @return {Promise<boolean>}
   * @throws {Error} When key or jsonObject is invalid, or SOLR rejects the write.
   */
  async add(key, jsonObject, containerOrOptions = this.defaultIndex_) {
    if (!key || typeof key !== 'string' || key.trim() === '') {
      const error = new Error('Invalid key: must be a non-empty string');
      this.emit_('search:validation-error', { method: 'add', error: error.message, key });
      throw error;
    }
    if (!jsonObject || typeof jsonObject !== 'object' || Array.isArray(jsonObject)) {
      const error = new Error('Invalid jsonObject: must be a non-null object');
      this.emit_('search:validation-error', { method: 'add', error: error.message, key });
      throw error;
    }

    const { containerName } = this.resolveContainerArg_(containerOrOptions);

    if (await this.exists_(key, containerName)) {
      this.emit_('search:add:error', {
        jsonObject, key, searchContainer: containerName, error: 'Key already exists.'
      });
      return false;
    }

    try {
      await this.update_([this.buildDoc_(key, jsonObject, containerName)]);
      analytics.trackAdd(containerName);
      this.emit_('search:add', { jsonObject, key, searchContainer: containerName });
      return true;
    } catch (error) {
      this.emit_('search:error', { operation: 'add', key, error: error.message });
      this.logger?.error?.(`[${this.constructor.name}] add failed: ${error.message}`, { key });
      throw error;
    }
  }

  /**
   * Check whether a document exists in a container.
   * @private
   * @return {Promise<boolean>}
   */
  async exists_(key, containerName) {
    const data = await this.select_({
      q: `${this.settings.SOLR_UNIQUE_KEY}:"${this.escapeSolr_(key)}"`,
      fq: this.containerFilter_(containerName),
      rows: 0
    });
    return (data?.response?.numFound || 0) > 0;
  }

  /**
   * Batch-add documents. Reads each document's id from `idField` (default `id`).
   *
   * @param {Array<Object>} documents
   * @param {string|Object} [containerOrOptions] May include `{ idField }`.
   * @return {Promise<{added: number, skipped: number}>}
   */
  async addAll(documents, containerOrOptions = this.defaultIndex_) {
    if (!Array.isArray(documents)) {
      throw new Error('addAll requires an array of documents');
    }
    const { containerName, idField = 'id' } = this.resolveContainerArg_(containerOrOptions);

    let added = 0;
    let skipped = 0;
    const docsToWrite = [];
    for (const doc of documents) {
      const id = doc && doc[idField];
      if (id == null) { skipped++; continue; }
      const key = String(id);
      if (await this.exists_(key, containerName)) { skipped++; continue; }
      docsToWrite.push(this.buildDoc_(key, doc, containerName));
      added++;
    }

    if (docsToWrite.length > 0) {
      try {
        await this.update_(docsToWrite);
        for (let i = 0; i < docsToWrite.length; i++) analytics.trackAdd(containerName);
        this.emit_('search:add:bulk', { added, searchContainer: containerName });
      } catch (error) {
        this.emit_('search:error', { operation: 'addAll', error: error.message });
        throw error;
      }
    }
    return { added, skipped };
  }

  /**
   * Replace a document (upsert). Id is read from `idField` (default `id`).
   * SOLR overwrites documents sharing the same uniqueKey, so this always succeeds.
   *
   * @param {Object} document
   * @param {string|Object} [containerOrOptions] May include `{ idField }`.
   * @return {Promise<boolean>}
   */
  async replace(document, containerOrOptions = this.defaultIndex_) {
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      throw new Error('replace requires a document object');
    }
    const { containerName, idField = 'id' } = this.resolveContainerArg_(containerOrOptions);
    const id = document[idField];
    if (id == null) {
      throw new Error(`replace: document missing idField '${idField}'`);
    }
    const key = String(id);
    try {
      await this.update_([this.buildDoc_(key, document, containerName)]);
      this.emit_('search:replace', { key, searchContainer: containerName });
      return true;
    } catch (error) {
      this.emit_('search:error', { operation: 'replace', key, error: error.message });
      throw error;
    }
  }

  /**
   * Remove a document by key.
   *
   * @param {string} key
   * @param {string|Object} [containerOrOptions]
   * @return {Promise<boolean>} True when a document was removed.
   */
  async remove(key, containerOrOptions = this.defaultIndex_) {
    if (!key || typeof key !== 'string' || key.trim() === '') {
      const error = new Error('Invalid key: must be a non-empty string');
      this.emit_('search:validation-error', { method: 'remove', error: error.message, key });
      throw error;
    }
    const { containerName } = this.resolveContainerArg_(containerOrOptions);

    if (!(await this.exists_(key, containerName))) {
      return false;
    }
    try {
      await this.update_({
        delete: {
          query: `${this.settings.SOLR_UNIQUE_KEY}:"${this.escapeSolr_(key)}" AND ${this.containerFilter_(containerName)}`
        }
      });
      analytics.trackDelete(containerName);
      this.emit_('search:remove', { key, searchContainer: containerName });
      return true;
    } catch (error) {
      this.emit_('search:error', { operation: 'remove', key, error: error.message });
      throw error;
    }
  }

  /**
   * Discard — MiniSearch-compatible alias for remove.
   */
  async discard(key, containerOrOptions = this.defaultIndex_) {
    return this.remove(key, containerOrOptions);
  }

  /**
   * Remove many documents. Accepts an array of ids (string/number) or documents
   * (uses `idField`).
   *
   * @param {Array<string|number|Object>} idsOrDocuments
   * @param {string|Object} [containerOrOptions] May include `{ idField }`.
   * @return {Promise<{removed: number, missing: number}>}
   */
  async removeAll(idsOrDocuments, containerOrOptions = this.defaultIndex_) {
    if (!Array.isArray(idsOrDocuments)) {
      throw new Error('removeAll requires an array');
    }
    const { containerName, idField = 'id' } = this.resolveContainerArg_(containerOrOptions);

    let removed = 0;
    let missing = 0;
    for (const item of idsOrDocuments) {
      let id;
      if (typeof item === 'string' || typeof item === 'number') id = String(item);
      else if (item && typeof item === 'object') id = String(item[idField]);
      else { missing++; continue; }

      const ok = await this.remove(id, containerName);
      if (ok) removed++; else missing++;
    }
    return { removed, missing };
  }

  // ─── Search ─────────────────────────────────────────────────────

  /**
   * Search a container with SOLR's edismax query parser.
   *
   * Quoted segments are exact phrases (`Oracle "MySQL Enterprise"`) and become
   * required phrase clauses; the rest of the query is escaped as loose terms.
   *
   * @param {string} query
   * @param {string|Object} [containerOrOptions] Container name (legacy) or
   *   options: { containerName, fields, boost, prefix, combineWith, maxResults,
   *   filter }.
   *   - `fields` Array<string> — query fields (edismax `qf`). Defaults to the text field.
   *   - `boost`  Object<string,number> — per-field boosts merged into `qf`.
   *   - `prefix` boolean — append `*` to each query token for prefix matching.
   *   - `combineWith` 'AND'|'OR' — default operator (`q.op`). Default 'OR'.
   *   - `maxResults` number — `rows`. Defaults to the configured `maxResults`.
   *   - `filter` function — client-side predicate applied to each result.
   * @return {Promise<Array<Object>>} Results as `{ id, key, score, obj }`.
   * @throws {Error} When query is invalid.
   */
  async search(query, containerOrOptions = this.defaultIndex_) {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      const error = new Error('Invalid searchTerm: must be a non-empty string');
      this.emit_('search:validation-error', { method: 'search', error: error.message, searchTerm: query });
      throw error;
    }

    const { containerName, fields, boost, prefix, combineWith, maxResults, filter } =
      this.resolveContainerArg_(containerOrOptions);

    // Build query-field list with optional boosts.
    const qfFields = (Array.isArray(fields) && fields.length > 0)
      ? fields
      : [this.settings.SOLR_TEXT_FIELD];
    const qf = qfFields
      .map(f => (boost && boost[f] != null ? `${f}^${boost[f]}` : f))
      .join(' ');

    // Quoted segments are exact phrases (`Oracle "MySQL Enterprise"`), which
    // edismax expresses natively — re-emit them as required phrase clauses and
    // escape only the loose remainder. Phrases are never prefix-expanded.
    const { phrases, remainder } = parseQuotedPhrases(query);
    const loose = phrases.length ? remainder : query.trim();
    const looseQuery = prefix
      ? loose.trim().split(/\s+/).filter(Boolean).map(t => `${this.escapeSolr_(t)}*`).join(' ')
      : this.escapeSolr_(loose.trim());
    const phraseClauses = phrases.map(p => `+"${this.escapeSolr_(p)}"`).join(' ');
    const userQuery = [looseQuery, phraseClauses].filter(Boolean).join(' ');

    const params = {
      defType: 'edismax',
      q: userQuery,
      qf,
      fq: this.containerFilter_(containerName),
      fl: `${this.settings.SOLR_UNIQUE_KEY},${this.settings.SOLR_SOURCE_FIELD},score`,
      rows: Number.isInteger(maxResults) && maxResults > 0 ? maxResults : this.settings.maxResults,
      'q.op': String(combineWith || 'OR').toUpperCase() === 'AND' ? 'AND' : 'OR'
    };

    try {
      const data = await this.select_(params);
      const docs = data?.response?.docs || [];
      let results = docs.map(d => this.toResult_(d));
      if (typeof filter === 'function') results = results.filter(filter);

      analytics.trackSearch(query, results.length, containerName);
      this.emit_('search:search', { searchTerm: query, searchContainer: containerName, results });
      return results;
    } catch (error) {
      this.emit_('search:error', { operation: 'search', query, error: error.message });
      this.logger?.error?.(`[${this.constructor.name}] search failed: ${error.message}`, { query });
      throw error;
    }
  }

  /**
   * Compositional autocomplete. Prefix-expands the query against the text field
   * using SOLR's terms-style grouping and returns ranked suggestions.
   *
   * @param {string} query
   * @param {Object} [options] { containerName, maxSuggestions }.
   * @return {Promise<Array<{suggestion: string, terms: Array<string>, score: number}>>}
   */
  async autoSuggest(query, options = {}) {
    if (!query || typeof query !== 'string' || query.trim() === '') return [];
    const containerName = this.normalizeIndexName_(options.containerName);
    const maxSuggestions = Number.isInteger(options.maxSuggestions) && options.maxSuggestions > 0
      ? options.maxSuggestions
      : 10;

    // Prefix-match the trailing token, AND-ing any completed leading tokens.
    const results = await this.search(query, {
      containerName,
      prefix: true,
      combineWith: 'AND',
      maxResults: maxSuggestions
    });

    return results.map(r => ({
      suggestion: query,
      terms: query.trim().split(/\s+/),
      score: r.score || 0,
      id: r.id
    }));
  }

  /**
   * Legacy suggest API. Returns document-name prefix matches.
   *
   * @param {string} query
   * @param {Object} [options] { containerName, maxSuggestions }.
   * @return {Promise<Array<Object>>}
   */
  async suggest(query, options = {}) {
    if (!query || query.length < 2) return [];
    const maxSuggestions = options.maxSuggestions || 10;
    const containerName = this.normalizeIndexName_(options.containerName);

    const results = await this.search(query, {
      containerName,
      prefix: true,
      maxResults: maxSuggestions
    });

    return results
      .map(r => {
        const name = r.obj?.name || r.obj?.title;
        return name ? { title: name, type: 'document', relevance: 1 } : null;
      })
      .filter(Boolean)
      .slice(0, maxSuggestions);
  }

  // ─── Index management & stats ────────────────────────────────────

  /**
   * List all logical container names by faceting on the container field.
   * @return {Promise<Array<string>>}
   */
  async listIndexes() {
    try {
      const data = await this.select_({
        q: '*:*',
        rows: 0,
        facet: true,
        'facet.field': this.settings.SOLR_CONTAINER_FIELD,
        'facet.mincount': 1,
        'facet.limit': -1
      });
      const facet = data?.facet_counts?.facet_fields?.[this.settings.SOLR_CONTAINER_FIELD] || [];
      const names = [];
      for (let i = 0; i < facet.length; i += 2) names.push(facet[i]);
      if (!names.includes(this.defaultIndex_)) names.unshift(this.defaultIndex_);
      return names;
    } catch (error) {
      this.emit_('search:error', { operation: 'listIndexes', error: error.message });
      throw error;
    }
  }

  /**
   * Stats for a specific container, or aggregated across all containers.
   * @param {string} [searchContainer]
   * @return {Promise<Object>}
   */
  async getStats(searchContainer) {
    try {
      if (searchContainer) {
        const containerName = this.normalizeIndexName_(searchContainer);
        const data = await this.select_({
          q: '*:*',
          fq: this.containerFilter_(containerName),
          rows: 0
        });
        return {
          searchContainer: containerName,
          indexedItems: data?.response?.numFound || 0,
          collection: this.settings.SOLR_COLLECTION
        };
      }

      const data = await this.select_({
        q: '*:*',
        rows: 0,
        facet: true,
        'facet.field': this.settings.SOLR_CONTAINER_FIELD,
        'facet.mincount': 1,
        'facet.limit': -1
      });
      const facet = data?.facet_counts?.facet_fields?.[this.settings.SOLR_CONTAINER_FIELD] || [];
      const indexStats = {};
      for (let i = 0; i < facet.length; i += 2) indexStats[facet[i]] = facet[i + 1];
      return {
        totalIndexes: Object.keys(indexStats).length,
        totalIndexedItems: data?.response?.numFound || 0,
        indexStats,
        collection: this.settings.SOLR_COLLECTION
      };
    } catch (error) {
      this.emit_('search:error', { operation: 'getStats', error: error.message });
      throw error;
    }
  }

  /**
   * Stats for a single container, including its document keys.
   * @param {string} searchContainer
   * @return {Promise<Object>}
   */
  async getIndexStats(searchContainer) {
    const containerName = this.normalizeIndexName_(searchContainer);
    try {
      const data = await this.select_({
        q: '*:*',
        fq: this.containerFilter_(containerName),
        fl: this.settings.SOLR_UNIQUE_KEY,
        rows: 1000
      });
      const docs = data?.response?.docs || [];
      return {
        searchContainer: containerName,
        size: data?.response?.numFound || 0,
        keys: docs.map(d => d[this.settings.SOLR_UNIQUE_KEY])
      };
    } catch (error) {
      this.emit_('search:error', { operation: 'getIndexStats', error: error.message });
      throw error;
    }
  }

  /**
   * Remove every document in a container (delete-by-query).
   * @param {string} searchContainer
   * @return {Promise<boolean>}
   */
  async clearIndex(searchContainer) {
    const containerName = this.normalizeIndexName_(searchContainer);
    try {
      const before = await this.getStats(containerName);
      await this.update_({ delete: { query: this.containerFilter_(containerName) } });
      this.emit_('search:index:cleared', {
        searchContainer: containerName,
        previousSize: before.indexedItems || 0
      });
      return true;
    } catch (error) {
      this.emit_('search:error', { operation: 'clearIndex', error: error.message });
      throw error;
    }
  }

  /**
   * Delete a container entirely. Cannot delete the default container, matching
   * the embedded providers.
   * @param {string} searchContainer
   * @return {Promise<boolean>}
   * @throws {Error} When attempting to delete the default container.
   */
  async deleteIndex(searchContainer) {
    const containerName = this.normalizeIndexName_(searchContainer);
    if (containerName === this.defaultIndex_) {
      throw new Error('Cannot delete the default index');
    }
    try {
      await this.update_({ delete: { query: this.containerFilter_(containerName) } });
      this.emit_('search:index:deleted', { searchContainer: containerName });
      return true;
    } catch (error) {
      this.emit_('search:error', { operation: 'deleteIndex', error: error.message });
      throw error;
    }
  }
}

module.exports = SearchingSOLR;
