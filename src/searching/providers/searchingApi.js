/**
 * @fileoverview API-based searching service implementation that proxies requests to a remote searching service.
 * Allows client applications to consume backend search API endpoints for enterprise systems.
 * @author NooblyJS Team
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
    this.apiRoot = options.apiRoot || 'http://localhost:3000';
    this.apiKey = options.apiKey || null;
    this.timeout = options.timeout || 10000;
    this.eventEmitter_ = eventEmitter;

    // Configure axios instance
    this.client = axios.create({
      baseURL: this.apiRoot,
      timeout: this.timeout,
      headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {}
    });
  }

  /**
   * Indexes a document via the remote searching API.
   * @param {string} index The index name.
   * @param {string} id The document ID.
   * @param {Object} document The document to index.
   * @return {Promise<Object>} A promise that resolves to the indexing result.
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
   * Searches for documents via the remote searching API.
   * @param {string} index The index name.
   * @param {Object} query The search query.
   * @return {Promise<Array>} A promise that resolves to the search results.
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
   * Gets a document by ID via the remote searching API.
   * @param {string} index The index name.
   * @param {string} id The document ID.
   * @return {Promise<Object>} A promise that resolves to the document.
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
   * Deletes a document via the remote searching API.
   * @param {string} index The index name.
   * @param {string} id The document ID.
   * @return {Promise<void>} A promise that resolves when the document is deleted.
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
   * Clears an index via the remote searching API.
   * @param {string} index The index name.
   * @return {Promise<void>} A promise that resolves when the index is cleared.
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
}

module.exports = SearchingApi;
