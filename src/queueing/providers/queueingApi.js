/**
 * @fileoverview API-based queueing service implementation that proxies requests to a remote queueing service.
 * Allows client applications to consume backend queueing API endpoints for enterprise systems.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.14
 */

'use strict';

const axios = require('axios');

/**
 * A class that implements queue operations via HTTP API calls to a remote service.
 * Provides methods for enqueuing, dequeuing, and managing queues through REST endpoints.
 * @class
 */
class QueueingApi {
  /**
   * Initializes the Queueing API client with configuration.
   * @param {Object} options Configuration options for the API client.
   * @param {string} options.apiRoot The root URL of the backend API service.
   * @param {string=} options.apiKey Optional API key for authenticated requests.
   * @param {number=} options.timeout Request timeout in milliseconds (default: 10000).
   * @param {EventEmitter=} eventEmitter Optional event emitter for queueing events.
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
   * Adds a job to the queue via the remote queueing API.
   * @param {string} queueName The queue name.
   * @param {Object} job The job data.
   * @param {Object=} options Job options.
   * @return {Promise<Object>} A promise that resolves to the job result.
   */
  async enqueue(queueName, job, options = {}) {
    try {
      const response = await this.client.post(`/services/queueing/api/enqueue/${queueName}`, { job, options });
      if (this.eventEmitter_)
        this.eventEmitter_.emit('queueing:enqueue', { queueName, job });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('queueing:error', { operation: 'enqueue', queueName, error: error.message });
      throw error;
    }
  }

  /**
   * Retrieves and removes a job from the queue via the remote queueing API.
   * @param {string} queueName The queue name.
   * @return {Promise<Object>} A promise that resolves to the job data.
   */
  async dequeue(queueName) {
    try {
      const response = await this.client.get(`/services/queueing/api/dequeue/${queueName}`);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('queueing:dequeue', { queueName });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('queueing:error', { operation: 'dequeue', queueName, error: error.message });
      throw error;
    }
  }

  /**
   * Gets queue statistics via the remote queueing API.
   * @param {string} queueName The queue name.
   * @return {Promise<Object>} A promise that resolves to the queue statistics.
   */
  async getStats(queueName) {
    try {
      const response = await this.client.get(`/services/queueing/api/stats/${queueName}`);
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('queueing:error', { operation: 'getStats', queueName, error: error.message });
      throw error;
    }
  }

  /**
   * Lists all queues via the remote queueing API.
   * @return {Promise<Array>} A promise that resolves to the list of queues.
   */
  async listQueues() {
    try {
      const response = await this.client.get('/services/queueing/api/queues');
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('queueing:error', { operation: 'listQueues', error: error.message });
      throw error;
    }
  }

  /**
   * Purges a queue via the remote queueing API.
   * @param {string} queueName The queue name.
   * @return {Promise<void>} A promise that resolves when the queue is purged.
   */
  async purge(queueName) {
    try {
      await this.client.delete(`/services/queueing/api/purge/${queueName}`);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('queueing:purge', { queueName });
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('queueing:error', { operation: 'purge', queueName, error: error.message });
      throw error;
    }
  }
}

module.exports = QueueingApi;
