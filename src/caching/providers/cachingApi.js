/**
 * @fileoverview API-based cache implementation that proxies requests to a remote caching service.
 * Allows client applications to consume backend caching API endpoints for enterprise systems.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.14
 */

'use strict';

const axios = require('axios');

/**
 * A class that implements cache operations via HTTP API calls to a remote service.
 * Provides methods for storing, retrieving, and deleting cached values through REST endpoints.
 * @class
 */
class CacheApi {
  /**
   * Initializes the API cache client with configuration.
   * @param {Object} options Configuration options for the API client.
   * @param {string} options.apiRoot The root URL of the backend API service.
   * @param {string=} options.apiKey Optional API key for authenticated requests.
   * @param {number=} options.timeout Request timeout in milliseconds (default: 5000).
   * @param {EventEmitter=} eventEmitter Optional event emitter for cache events.
   */
  constructor(options = {}, eventEmitter) {
    this.apiRoot = options.apiRoot || 'http://localhost:3000';
    this.apiKey = options.apiKey || null;
    this.timeout = options.timeout || 5000;
    this.eventEmitter_ = eventEmitter;

    // Configure axios instance
    this.client = axios.create({
      baseURL: this.apiRoot,
      timeout: this.timeout,
      headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {}
    });
  }

  /**
   * Adds a value to the remote cache via API.
   * @param {string} key The key to store the value under.
   * @param {*} value The value to store.
   * @return {Promise<void>} A promise that resolves when the value is stored.
   */
  async put(key, value) {
    try {
      await this.client.post(`/services/caching/api/put/${encodeURIComponent(key)}`, value);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('cache:put', { key, value });
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('cache:error', { operation: 'put', key, error: error.message });
      throw error;
    }
  }

  /**
   * Retrieves a value from the remote cache via API.
   * @param {string} key The key to retrieve the value for.
   * @return {Promise<*>} A promise that resolves to the cached value, or undefined if not found.
   */
  async get(key) {
    try {
      const response = await this.client.get(`/services/caching/api/get/${encodeURIComponent(key)}`);
      const value = response.data;
      if (this.eventEmitter_)
        this.eventEmitter_.emit('cache:get', { key, value });
      return value;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('cache:error', { operation: 'get', key, error: error.message });
      throw error;
    }
  }

  /**
   * Deletes a value from the remote cache via API.
   * @param {string} key The key to delete.
   * @return {Promise<void>} A promise that resolves when the key is deleted.
   */
  async delete(key) {
    try {
      await this.client.delete(`/services/caching/api/delete/${encodeURIComponent(key)}`);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('cache:delete', { key });
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('cache:error', { operation: 'delete', key, error: error.message });
      throw error;
    }
  }

  /**
   * Gets analytics data from the remote cache service.
   * @return {Promise<Array<{key: string, hits: number, lastHit: string}>>} Array of analytics data.
   */
  async getAnalytics() {
    try {
      const response = await this.client.get('/services/caching/api/list');
      return response.data.data || [];
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('cache:error', { operation: 'getAnalytics', error: error.message });
      throw error;
    }
  }
}

module.exports = CacheApi;
