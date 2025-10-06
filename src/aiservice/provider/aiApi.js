/**
 * @fileoverview API-based AI implementation that proxies requests to a remote AI service.
 * Allows client applications to consume backend AI API endpoints for enterprise systems.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.14
 */

'use strict';

const axios = require('axios');

/**
 * A class that implements AI operations via HTTP API calls to a remote service.
 * Provides methods for prompt processing and model interactions through REST endpoints.
 * @class
 */
class AIApi {
  /**
   * Initializes the AI API client with configuration.
   * @param {Object} options Configuration options for the API client.
   * @param {string} options.apiRoot The root URL of the backend API service.
   * @param {string=} options.apiKey Optional API key for authenticated requests.
   * @param {number=} options.timeout Request timeout in milliseconds (default: 30000).
   * @param {EventEmitter=} eventEmitter Optional event emitter for AI events.
   */
  constructor(options = {}, eventEmitter) {
    this.apiRoot = options.apiRoot || 'http://localhost:3000';
    this.apiKey = options.apiKey || null;
    this.timeout = options.timeout || 30000;
    this.eventEmitter_ = eventEmitter;
    this.enabled = true;

    // Configure axios instance
    this.client = axios.create({
      baseURL: this.apiRoot,
      timeout: this.timeout,
      headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {}
    });
  }

  /**
   * Sends a prompt to the remote AI service via API.
   * @param {string} prompt The prompt text to send to the AI.
   * @param {Object=} options Additional options for the AI request.
   * @return {Promise<string>} A promise that resolves to the AI response.
   */
  async prompt(prompt, options = {}) {
    try {
      const response = await this.client.post('/services/ai/api/prompt', { prompt, options });
      if (this.eventEmitter_)
        this.eventEmitter_.emit('ai:prompt', { prompt, response: response.data });
      return response.data.response || response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('ai:error', { operation: 'prompt', error: error.message });
      throw error;
    }
  }

  /**
   * Gets available models from the remote AI service.
   * @return {Promise<Array>} A promise that resolves to the list of available models.
   */
  async getModels() {
    try {
      const response = await this.client.get('/services/ai/api/models');
      return response.data.models || response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('ai:error', { operation: 'getModels', error: error.message });
      throw error;
    }
  }

  /**
   * Gets analytics data from the remote AI service.
   * @return {Promise<Object>} A promise that resolves to analytics data.
   */
  async getAnalytics() {
    try {
      const response = await this.client.get('/services/ai/api/analytics');
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('ai:error', { operation: 'getAnalytics', error: error.message });
      throw error;
    }
  }

  /**
   * Checks health status of the remote AI service.
   * @return {Promise<Object>} A promise that resolves to health status.
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/services/ai/api/health');
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('ai:error', { operation: 'healthCheck', error: error.message });
      throw error;
    }
  }
}

module.exports = AIApi;
