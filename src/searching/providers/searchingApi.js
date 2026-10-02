/**
 * @fileoverview HTTP client that proxies search operations to a remote
 * nooblyjs-core searching service. Exposes the same surface as
 * the default and tokens providers (add / remove / search / listIndexes /
 * etc.) so callers can swap providers without changing application code.
 *
 * @author NooblyJS Team
 * @version 2.0.0
 * @since 1.0.14
 */

'use strict';

const axios = require('axios');

/**
 * @class SearchingApi
 */
class SearchingApi {
  /**
   * @param {Object} options
   * @param {string} [options.apiRoot] Base URL of the remote searching service
   *   (e.g. 'http://search.internal:9000'). Falls back to options.api or
   *   localhost:3000.
   * @param {string} [options.apiKey] Optional API key. Sent as X-API-Key.
   * @param {number} [options.timeout=10000] Request timeout in milliseconds.
   * @param {number} [options.retryLimit=3] (Reserved for future use.)
   * @param {EventEmitter} [eventEmitter]
   * @param {Object} [dependencies]
   */
  constructor(options = {}, eventEmitter, dependencies = {}) {
    this.apiRoot = options.apiRoot || options.api || 'http://localhost:3000';
    this.apiKey = options.apiKey || null;
    this.timeout = options.timeout || 10000;
    this.eventEmitter_ = eventEmitter;
    this.logger = (dependencies && dependencies.logging) || (options.dependencies && options.dependencies.logging) || null;

    this.client = this.buildClient_();

    this.settings = {
      description: 'Configuration settings for the Searching API Provider',
      list: [
        { setting: 'url', type: 'string', values: [this.apiRoot] },
        { setting: 'timeout', type: 'number', values: [this.timeout] },
        { setting: 'retryLimit', type: 'number', values: [options.retryLimit || 3] }
      ],
      url: this.apiRoot,
      timeout: this.timeout,
      retryLimit: options.retryLimit || 3
    };
  }

  buildClient_() {
    return axios.create({
      baseURL: this.apiRoot,
      timeout: this.timeout,
      headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {}
    });
  }

  /**
   * Emit an event if an emitter is configured.
   * @private
   */
  emit_(name, payload) {
    if (this.eventEmitter_) this.eventEmitter_.emit(name, payload);
  }

  // ─── CRUD ────────────────────────────────────────────────────────

  /**
   * Add a JSON object under `key` to the remote search service.
   * Note: the local /add endpoint generates its own UUID — when targeting it,
   * `key` is ignored server-side and a new id is returned in the response.
   *
   * @param {string} key
   * @param {Object} jsonObject
   * @param {string} [searchContainer]
   * @return {Promise<boolean>}
   */
  async add(key, jsonObject, searchContainer) {
    try {
      const body = { ...jsonObject };
      if (searchContainer) body.searchContainer = searchContainer;
      const res = await this.client.post('/services/searching/api/add/', body);
      this.emit_('searching:add', { key, searchContainer });
      return res.data && res.data.success === true;
    } catch (error) {
      this.emit_('searching:error', { operation: 'add', key, error: error.message });
      this.logger?.error?.(`[SearchingApi] add failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a document by key.
   *
   * @param {string} key
   * @param {string} [searchContainer]
   * @return {Promise<boolean>}
   */
  async remove(key, searchContainer) {
    try {
      const url = `/services/searching/api/delete/${encodeURIComponent(key)}`;
      const params = searchContainer ? { searchContainer } : {};
      const res = await this.client.delete(url, { params });
      this.emit_('searching:remove', { key, searchContainer });
      return !!(res.data && res.data.success);
    } catch (error) {
      if (error.response && error.response.status === 404) return false;
      this.emit_('searching:error', { operation: 'remove', key, error: error.message });
      throw error;
    }
  }

  /**
   * Search for a term.
   *
   * @param {string} query
   * @param {string|Object} [containerOrOptions] Container name (legacy) or
   *   options object with { containerName, fields, boost, prefix, fuzzy,
   *   combineWith, maxResults }. When options are supplied, POST /search/:c
   *   is used to forward them; otherwise the simpler GET /search/:term is used.
   * @return {Promise<Array<Object>>}
   */
  async search(query, containerOrOptions) {
    try {
      let containerName;
      let options = null;
      if (typeof containerOrOptions === 'string') {
        containerName = containerOrOptions;
      } else if (containerOrOptions && typeof containerOrOptions === 'object') {
        ({ containerName, ...options } = containerOrOptions);
      }

      let res;
      if (options && Object.keys(options).length > 0) {
        const path = containerName
          ? `/services/searching/api/search/${encodeURIComponent(containerName)}`
          : '/services/searching/api/search/';
        res = await this.client.post(path, { query, ...options });
      } else {
        const path = `/services/searching/api/search/${encodeURIComponent(query)}`;
        const params = containerName ? { searchContainer: containerName } : {};
        res = await this.client.get(path, { params });
      }

      const results = Array.isArray(res.data) ? res.data : [];
      this.emit_('searching:search', { query, searchContainer: containerName, count: results.length });
      return results;
    } catch (error) {
      this.emit_('searching:error', { operation: 'search', query, error: error.message });
      throw error;
    }
  }

  // ─── autoSuggest / suggest ───────────────────────────────────────

  /**
   * Token-provider-only: compositional ranked suggestions.
   */
  async autoSuggest(query, options = {}) {
    try {
      const url = `/services/searching/api/autosuggest/${encodeURIComponent(query)}`;
      const params = {};
      if (options.containerName) params.searchContainer = options.containerName;
      if (options.maxSuggestions) params.limit = options.maxSuggestions;
      if (options.fuzzy != null) params.fuzzy = options.fuzzy;
      const res = await this.client.get(url, { params });
      return Array.isArray(res.data) ? res.data : [];
    } catch (error) {
      this.emit_('searching:error', { operation: 'autoSuggest', error: error.message });
      throw error;
    }
  }

  /**
   * Legacy suggest API (token providers).
   */
  async suggest(query, options = {}) {
    try {
      const url = `/services/searching/api/suggest/${encodeURIComponent(query)}`;
      const params = {};
      if (options.containerName) params.searchContainer = options.containerName;
      if (options.maxSuggestions) params.limit = options.maxSuggestions;
      const res = await this.client.get(url, { params });
      return Array.isArray(res.data) ? res.data : [];
    } catch (error) {
      this.emit_('searching:error', { operation: 'suggest', error: error.message });
      throw error;
    }
  }

  // ─── Bulk (token providers) ──────────────────────────────────────

  async addAll(documents, searchContainer) {
    try {
      const body = searchContainer ? { documents, searchContainer } : { documents };
      const res = await this.client.post('/services/searching/api/add-bulk', body);
      return { added: res.data?.added || 0, skipped: res.data?.skipped || 0 };
    } catch (error) {
      this.emit_('searching:error', { operation: 'addAll', error: error.message });
      throw error;
    }
  }

  async removeAll(ids, searchContainer) {
    try {
      const body = searchContainer ? { ids, searchContainer } : { ids };
      const res = await this.client.post('/services/searching/api/delete-bulk', body);
      return { removed: res.data?.removed || 0, missing: res.data?.missing || 0 };
    } catch (error) {
      this.emit_('searching:error', { operation: 'removeAll', error: error.message });
      throw error;
    }
  }

  async replace(document, searchContainer) {
    try {
      const params = searchContainer ? { searchContainer } : {};
      await this.client.post('/services/searching/api/replace', { document }, { params });
      return true;
    } catch (error) {
      this.emit_('searching:error', { operation: 'replace', error: error.message });
      throw error;
    }
  }

  /**
   * discard — MiniSearch-compatible alias for remove.
   */
  async discard(key, searchContainer) {
    return this.remove(key, searchContainer);
  }

  // ─── Index management ────────────────────────────────────────────

  async listIndexes() {
    try {
      const res = await this.client.get('/services/searching/api/indexes');
      const indexes = res.data && Array.isArray(res.data.indexes) ? res.data.indexes : [];
      return indexes.map(i => i.name);
    } catch (error) {
      this.emit_('searching:error', { operation: 'listIndexes', error: error.message });
      throw error;
    }
  }

  async getIndexStats(searchContainer) {
    try {
      const url = `/services/searching/api/indexes/${encodeURIComponent(searchContainer)}/stats`;
      const res = await this.client.get(url);
      return res.data;
    } catch (error) {
      if (error.response && error.response.status === 404) return null;
      this.emit_('searching:error', { operation: 'getIndexStats', error: error.message });
      throw error;
    }
  }

  async clearIndex(searchContainer) {
    try {
      const url = `/services/searching/api/indexes/${encodeURIComponent(searchContainer)}/clear`;
      const res = await this.client.delete(url);
      return res.status === 200;
    } catch (error) {
      if (error.response && error.response.status === 404) return false;
      this.emit_('searching:error', { operation: 'clearIndex', error: error.message });
      throw error;
    }
  }

  async deleteIndex(searchContainer) {
    try {
      const url = `/services/searching/api/indexes/${encodeURIComponent(searchContainer)}`;
      const res = await this.client.delete(url);
      return res.status === 200;
    } catch (error) {
      if (error.response && error.response.status === 404) return false;
      this.emit_('searching:error', { operation: 'deleteIndex', error: error.message });
      throw error;
    }
  }

  // ─── Analytics + stats ───────────────────────────────────────────

  async getStats(searchContainer) {
    try {
      const params = searchContainer ? { searchContainer } : {};
      const res = await this.client.get('/services/searching/api/analytics', { params });
      return (res.data && res.data.stats) || res.data;
    } catch (error) {
      this.emit_('searching:error', { operation: 'getStats', error: error.message });
      throw error;
    }
  }

  // ─── Settings ────────────────────────────────────────────────────

  async getSettings() {
    try {
      const res = await this.client.get('/services/searching/api/settings');
      return res.data;
    } catch (_) {
      return this.settings;
    }
  }

  async saveSettings(settings) {
    for (const def of this.settings.list) {
      if (settings[def.setting] != null) {
        this.settings[def.setting] = settings[def.setting];
        this.logger?.info?.(`[SearchingApi] Setting changed: ${def.setting}`, {
          setting: def.setting,
          newValue: settings[def.setting]
        });
      }
    }
    if (settings.url || settings.timeout) {
      this.apiRoot = this.settings.url;
      this.timeout = this.settings.timeout;
      this.client = this.buildClient_();
    }
    try {
      await this.client.post('/services/searching/api/settings', settings);
    } catch (error) {
      this.logger?.warn?.(`[SearchingApi] Remote saveSettings failed: ${error.message}`);
    }
  }
}

module.exports = SearchingApi;
