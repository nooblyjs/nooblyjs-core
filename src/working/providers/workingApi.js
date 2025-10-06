/**
 * @fileoverview API-based working service implementation that proxies requests to a remote working service.
 * Allows client applications to consume backend working API endpoints for enterprise systems.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.14
 */

'use strict';

const axios = require('axios');

/**
 * A class that implements worker/job operations via HTTP API calls to a remote service.
 * Provides methods for managing background workers and jobs through REST endpoints.
 * @class
 */
class WorkingApi {
  /**
   * Initializes the Working API client with configuration.
   * @param {Object} options Configuration options for the API client.
   * @param {string} options.apiRoot The root URL of the backend API service.
   * @param {string=} options.apiKey Optional API key for authenticated requests.
   * @param {number=} options.timeout Request timeout in milliseconds (default: 30000).
   * @param {EventEmitter=} eventEmitter Optional event emitter for working events.
   */
  constructor(options = {}, eventEmitter) {
    this.apiRoot = options.apiRoot || 'http://localhost:3000';
    this.apiKey = options.apiKey || null;
    this.timeout = options.timeout || 30000;
    this.eventEmitter_ = eventEmitter;

    // Configure axios instance
    this.client = axios.create({
      baseURL: this.apiRoot,
      timeout: this.timeout,
      headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {}
    });
  }

  /**
   * Submits a job to the remote working service.
   * @param {Object} job The job definition.
   * @return {Promise<Object>} A promise that resolves to the job result.
   */
  async submitJob(job) {
    try {
      const response = await this.client.post('/services/working/api/submit', job);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('working:submit', { job: response.data });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('working:error', { operation: 'submitJob', error: error.message });
      throw error;
    }
  }

  /**
   * Gets job status via the remote working API.
   * @param {string} jobId The job ID.
   * @return {Promise<Object>} A promise that resolves to the job status.
   */
  async getJobStatus(jobId) {
    try {
      const response = await this.client.get(`/services/working/api/job/${jobId}`);
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('working:error', { operation: 'getJobStatus', jobId, error: error.message });
      throw error;
    }
  }

  /**
   * Cancels a job via the remote working API.
   * @param {string} jobId The job ID.
   * @return {Promise<void>} A promise that resolves when the job is cancelled.
   */
  async cancelJob(jobId) {
    try {
      await this.client.post(`/services/working/api/cancel/${jobId}`);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('working:cancel', { jobId });
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('working:error', { operation: 'cancelJob', jobId, error: error.message });
      throw error;
    }
  }

  /**
   * Lists all jobs via the remote working API.
   * @param {Object=} filter Filter parameters.
   * @return {Promise<Array>} A promise that resolves to the list of jobs.
   */
  async listJobs(filter = {}) {
    try {
      const response = await this.client.get('/services/working/api/jobs', { params: filter });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('working:error', { operation: 'listJobs', error: error.message });
      throw error;
    }
  }

  /**
   * Gets worker statistics via the remote working API.
   * @return {Promise<Object>} A promise that resolves to the worker statistics.
   */
  async getStats() {
    try {
      const response = await this.client.get('/services/working/api/stats');
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('working:error', { operation: 'getStats', error: error.message });
      throw error;
    }
  }

  /**
   * Retries a failed job via the remote working API.
   * @param {string} jobId The job ID.
   * @return {Promise<Object>} A promise that resolves to the retry result.
   */
  async retryJob(jobId) {
    try {
      const response = await this.client.post(`/services/working/api/retry/${jobId}`);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('working:retry', { jobId });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('working:error', { operation: 'retryJob', jobId, error: error.message });
      throw error;
    }
  }
}

module.exports = WorkingApi;
