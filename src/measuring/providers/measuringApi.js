/**
 * @fileoverview API-based measuring service implementation that proxies requests to a remote measuring service.
 * Allows client applications to consume backend measuring API endpoints for enterprise systems.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.14
 */

'use strict';

const axios = require('axios');

/**
 * A class that implements metrics and measurement operations via HTTP API calls to a remote service.
 * Provides methods for tracking metrics, counters, and gauges through REST endpoints.
 * @class
 */
class MeasuringApi {
  /**
   * Initializes the Measuring API client with configuration.
   * @param {Object} options Configuration options for the API client.
   * @param {string} options.apiRoot The root URL of the backend API service.
   * @param {string=} options.apiKey Optional API key for authenticated requests.
   * @param {number=} options.timeout Request timeout in milliseconds (default: 5000).
   * @param {EventEmitter=} eventEmitter Optional event emitter for measuring events.
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
   * Increments a counter via the remote measuring API.
   * @param {string} name The counter name.
   * @param {number=} value The increment value (default: 1).
   * @param {Object=} tags Additional tags for the metric.
   * @return {Promise<void>} A promise that resolves when the counter is incremented.
   */
  async increment(name, value = 1, tags = {}) {
    try {
      await this.client.post('/services/measuring/api/increment', { name, value, tags });
      if (this.eventEmitter_)
        this.eventEmitter_.emit('measuring:increment', { name, value });
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('measuring:error', { operation: 'increment', name, error: error.message });
    }
  }

  /**
   * Records a gauge value via the remote measuring API.
   * @param {string} name The gauge name.
   * @param {number} value The gauge value.
   * @param {Object=} tags Additional tags for the metric.
   * @return {Promise<void>} A promise that resolves when the gauge is recorded.
   */
  async gauge(name, value, tags = {}) {
    try {
      await this.client.post('/services/measuring/api/gauge', { name, value, tags });
      if (this.eventEmitter_)
        this.eventEmitter_.emit('measuring:gauge', { name, value });
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('measuring:error', { operation: 'gauge', name, error: error.message });
    }
  }

  /**
   * Records a timing value via the remote measuring API.
   * @param {string} name The timing metric name.
   * @param {number} duration The duration in milliseconds.
   * @param {Object=} tags Additional tags for the metric.
   * @return {Promise<void>} A promise that resolves when the timing is recorded.
   */
  async timing(name, duration, tags = {}) {
    try {
      await this.client.post('/services/measuring/api/timing', { name, duration, tags });
      if (this.eventEmitter_)
        this.eventEmitter_.emit('measuring:timing', { name, duration });
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('measuring:error', { operation: 'timing', name, error: error.message });
    }
  }

  /**
   * Records a histogram value via the remote measuring API.
   * @param {string} name The histogram name.
   * @param {number} value The histogram value.
   * @param {Object=} tags Additional tags for the metric.
   * @return {Promise<void>} A promise that resolves when the histogram is recorded.
   */
  async histogram(name, value, tags = {}) {
    try {
      await this.client.post('/services/measuring/api/histogram', { name, value, tags });
      if (this.eventEmitter_)
        this.eventEmitter_.emit('measuring:histogram', { name, value });
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('measuring:error', { operation: 'histogram', name, error: error.message });
    }
  }

  /**
   * Gets metrics from the remote measuring API.
   * @return {Promise<Object>} A promise that resolves to the metrics data.
   */
  async getMetrics() {
    try {
      const response = await this.client.get('/services/measuring/api/metrics');
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('measuring:error', { operation: 'getMetrics', error: error.message });
      throw error;
    }
  }
}

module.exports = MeasuringApi;
