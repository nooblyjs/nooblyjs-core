/**
 * @fileoverview API-based searching service implementation that proxies requests to a remote searching service.
 * Allows client applications to consume backend search API endpoints for enterprise systems.
 * @author Noobly JS Team
 * @version 1.0.14
 * @since 1.0.14
 */

'use strict';

const axios = require('axios');

/**
 * A class that implements search operations via HTTP API calls to a remote service.
 * Provides methods for indexing and searching documents through REST endpoints.
 * @class
 */
class SearchingApi {
  /**
   * Initializes the Searching API client with configuration.
   * @param {Object} options Configuration options for the API client.
   * @param {string} options.apiRoot The root URL of the backend API service.
   * @param {string=} options.apiKey Optional API key for authenticated requests.
   * @param {number=} options.timeout Request timeout in milliseconds (default: 10000).
   * @param {EventEmitter=} eventEmitter Optional event emitter for searching events.
   */
  constructor(options = {}, eventEmitter) {
    this.apiRoot = options.apiRoot || options.api || 'http://localhost:3000';
    this.apiKey = options.apiKey || null;
    this.timeout = options.timeout || 10000;
    this.eventEmitter_ = eventEmitter;

    // Initialize logger from dependencies
    const { dependencies = {} } = options;
    /** @private */
    this.logger = dependencies.logging || null;

    // Configure axios instance
    this.client = axios.create({
      baseURL: this.apiRoot,
      timeout: this.timeout,
      headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {}
    });

    // Settings for searching API provider
    this.settings = {};
    this.settings.description = "Configuration settings for the Searching API Provider";
    this.settings.list = [
      {setting: "url", type: "string", values: ["http://localhost:3000"]},
      {setting: "timeout", type: "number", values: [10000]},
      {setting: "retryLimit", type: "number", values: [3]}
    ];
    this.settings.url = this.apiRoot;
    this.settings.timeout = this.timeout;
    this.settings.retryLimit = options.retryLimit || this.settings.list[2].values[0];
  }

  /**
   * Indexes a document in the remote search service for full-text search capability.
   * Adds or updates a document in a search index, making it searchable via search() method.
   * Indexing is asynchronous - document becomes searchable shortly after the call completes.
   *
   * @param {string} index The name/identifier of the search index (e.g., 'products', 'articles')
   * @param {string} id The unique document identifier within the index
   * @param {Object} document The document content to index containing:
   *   - title: {string} Searchable title
   *   - content: {string} Searchable content/body
   *   - tags: {Array} Array of searchable tags
   *   - metadata: {Object} Additional fields for filtering
   *   - Any other fields to be indexed
   * @return {Promise<Object>} A promise that resolves to the indexing result containing:
   *   - id: {string} Document identifier
   *   - index: {string} Index name
   *   - status: {string} Indexing status ('indexed', 'queued', 'error')
   *   - timestamp: {string} ISO timestamp of indexing
   * @throws {Error} When the HTTP request fails or the document is invalid
   *
   * @example
   * // Index a product document
   * await searchingApi.index('products', 'prod-123', {
   *   title: 'Widget Pro',
   *   content: 'A professional-grade widget with advanced features',
   *   tags: ['widget', 'professional', 'hardware'],
   *   price: 99.99
   * });
   */
  async index(index, id, document) {
    try {
      const response = await this.client.post(`/services/searching/api/index/${index}/${id}`, document);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('searching:index', { index, id });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('searching:error', { operation: 'index', index, id, error: error.message });
      throw error;
    }
  }

  /**
   * Searches for documents in an index via the remote search service.
   * Performs full-text and field search across indexed documents.
   * Supports simple text queries, field-specific queries, filters, sorting, and pagination.
   *
   * @param {string} index The name of the search index to query
   * @param {Object} query The search query containing:
   *   - text: {string} Search text for full-text matching
   *   - field: {string} Specific field to search in (optional)
   *   - filters: {Object} Field filters (e.g., { status: 'active', price: { $gt: 10 } })
   *   - sort: {string} Sort field (prefix with '-' for descending)
   *   - limit: {number} Maximum results to return
   *   - offset: {number} Results offset for pagination
   * @return {Promise<Array>} A promise that resolves to an array of matching documents with scores
   * @throws {Error} When the HTTP request fails or the query is invalid
   *
   * @example
   * // Simple full-text search
   * const results = await searchingApi.search('products', {
   *   text: 'widget',
   *   limit: 10
   * });
   * console.log(`Found ${results.length} products`);
   *
   * @example
   * // Filtered and sorted search
   * const results = await searchingApi.search('articles', {
   *   text: 'javascript',
   *   filters: { published: true, category: 'tutorial' },
   *   sort: '-createdAt',
   *   limit: 20,
   *   offset: 0
   * });
   */
  async search(index, query) {
    try {
      const response = await this.client.post(`/services/searching/api/search/${index}`, { query });
      if (this.eventEmitter_)
        this.eventEmitter_.emit('searching:search', { index, resultsCount: response.data.length });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('searching:error', { operation: 'search', index, error: error.message });
      throw error;
    }
  }

  /**
   * Retrieves a document by ID from the search index via the remote search service.
   * Returns the original indexed document without search scoring.
   *
   * @param {string} index The name of the search index
   * @param {string} id The unique document identifier
   * @return {Promise<Object>} A promise that resolves to the document object
   * @throws {Error} When the HTTP request fails or the document is not found
   *
   * @example
   * // Get a specific product from the index
   * const product = await searchingApi.get('products', 'prod-123');
   * console.log(`Product: ${product.title}`);
   */
  async get(index, id) {
    try {
      const response = await this.client.get(`/services/searching/api/document/${index}/${id}`);
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('searching:error', { operation: 'get', index, id, error: error.message });
      throw error;
    }
  }

  /**
   * Removes a document from the search index via the remote search service.
   * Deletes a document so it will no longer appear in search results.
   *
   * @param {string} index The name of the search index
   * @param {string} id The unique document identifier to delete
   * @return {Promise<void>} A promise that resolves when the document is removed
   * @throws {Error} When the HTTP request fails or the document doesn't exist
   *
   * @example
   * // Remove a product from the search index
   * await searchingApi.delete('products', 'prod-123');
   * console.log('Product removed from search');
   */
  async delete(index, id) {
    try {
      await this.client.delete(`/services/searching/api/document/${index}/${id}`);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('searching:delete', { index, id });
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('searching:error', { operation: 'delete', index, id, error: error.message });
      throw error;
    }
  }

  /**
   * Deletes all documents from a search index via the remote search service.
   * Clears the entire index, removing all indexed documents.
   * This operation is not reversible - use with caution.
   *
   * @param {string} index The name of the search index to clear
   * @return {Promise<void>} A promise that resolves when the index is cleared
   * @throws {Error} When the HTTP request fails or the index doesn't exist
   *
   * @example
   * // Clear all products from the search index
   * await searchingApi.clearIndex('products');
   * console.log('Products index cleared');
   */
  async clearIndex(index) {
    try {
      await this.client.delete(`/services/searching/api/index/${index}`);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('searching:clearIndex', { index });
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('searching:error', { operation: 'clearIndex', index, error: error.message });
      throw error;
    }
  }

  /**
   * Retrieves all current configuration settings for the searching API provider.
   * Returns the settings object including API URL, timeout, and retry configuration.
   *
   * @return {Promise<Object>} A promise that resolves to the settings object containing:
   *   - description: {string} Description of the provider
   *   - list: {Array} Array of configurable settings definitions
   *   - url: {string} The remote API URL
   *   - timeout: {number} Request timeout in milliseconds
   *   - retryLimit: {number} Maximum number of retry attempts
   *
   * @example
   * const settings = await searchingApi.getSettings();
   * console.log(`API URL: ${settings.apiUrl}`);
   */
  async getSettings(){
    return this.settings;
  }

  /**
   * Updates configuration settings for the searching API provider.
   * Only specified settings are updated; unspecified settings are left unchanged.
   *
   * @param {Object} settings The settings object containing new values
   * @param {string} [settings.url] The new remote API URL
   * @param {number} [settings.timeout] The new request timeout in milliseconds
   * @param {number} [settings.retryLimit] The new retry limit
   * @return {Promise<void>} A promise that resolves when all settings are updated
   *
   * @example
   * // Update API timeout
   * await searchingApi.saveSettings({
   *   timeout: 12000,
   *   url: 'https://search-api.internal.service'
   * });
   */
  async saveSettings(settings){
    for (let i = 0; i < this.settings.list.length; i++){
      if (settings[this.settings.list[i].setting] != null){
        this.settings[this.settings.list[i].setting] = settings[this.settings.list[i].setting];
        this.logger?.info(`[${this.constructor.name}] Setting changed: ${this.settings.list[i].setting}`, {
          setting: this.settings.list[i].setting,
          newValue: settings[this.settings.list[i].setting]
        });
      }
    }
    // Rebuild axios client if URL or timeout changed
    if (settings.url || settings.timeout) {
      this.apiRoot = this.settings.url;
      this.timeout = this.settings.timeout;
      this.client = axios.create({
        baseURL: this.apiRoot,
        timeout: this.timeout,
        headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {}
      });
    }
  }
}

module.exports = SearchingApi;
