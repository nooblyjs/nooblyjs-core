/**
 * @fileoverview API-based workflow service implementation that proxies requests to a remote workflow service.
 * Allows client applications to consume backend workflow API endpoints for enterprise systems.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.14
 */

'use strict';

const axios = require('axios');

/**
 * A class that implements workflow operations via HTTP API calls to a remote service.
 * Provides methods for creating, executing, and managing workflows through REST endpoints.
 * @class
 */
class WorkflowApi {
  /**
   * Initializes the Workflow API client with configuration.
   * @param {Object} options Configuration options for the API client.
   * @param {string} options.apiRoot The root URL of the backend API service.
   * @param {string=} options.apiKey Optional API key for authenticated requests.
   * @param {number=} options.timeout Request timeout in milliseconds (default: 30000).
   * @param {EventEmitter=} eventEmitter Optional event emitter for workflow events.
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
   * Creates a workflow via the remote workflow API.
   * @param {Object} workflow The workflow definition.
   * @return {Promise<Object>} A promise that resolves to the created workflow.
   */
  async create(workflow) {
    try {
      const response = await this.client.post('/services/workflow/api/create', workflow);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('workflow:create', { workflow: response.data });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('workflow:error', { operation: 'create', error: error.message });
      throw error;
    }
  }

  /**
   * Executes a workflow via the remote workflow API.
   * @param {string} workflowId The workflow ID.
   * @param {Object=} context Execution context data.
   * @return {Promise<Object>} A promise that resolves to the execution result.
   */
  async execute(workflowId, context = {}) {
    try {
      const response = await this.client.post(`/services/workflow/api/execute/${workflowId}`, { context });
      if (this.eventEmitter_)
        this.eventEmitter_.emit('workflow:execute', { workflowId, result: response.data });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('workflow:error', { operation: 'execute', workflowId, error: error.message });
      throw error;
    }
  }

  /**
   * Gets a workflow by ID via the remote workflow API.
   * @param {string} workflowId The workflow ID.
   * @return {Promise<Object>} A promise that resolves to the workflow definition.
   */
  async get(workflowId) {
    try {
      const response = await this.client.get(`/services/workflow/api/workflow/${workflowId}`);
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('workflow:error', { operation: 'get', workflowId, error: error.message });
      throw error;
    }
  }

  /**
   * Lists all workflows via the remote workflow API.
   * @return {Promise<Array>} A promise that resolves to the list of workflows.
   */
  async list() {
    try {
      const response = await this.client.get('/services/workflow/api/workflows');
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('workflow:error', { operation: 'list', error: error.message });
      throw error;
    }
  }

  /**
   * Updates a workflow via the remote workflow API.
   * @param {string} workflowId The workflow ID.
   * @param {Object} updates The workflow updates.
   * @return {Promise<Object>} A promise that resolves to the updated workflow.
   */
  async update(workflowId, updates) {
    try {
      const response = await this.client.put(`/services/workflow/api/workflow/${workflowId}`, updates);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('workflow:update', { workflowId, updates });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('workflow:error', { operation: 'update', workflowId, error: error.message });
      throw error;
    }
  }

  /**
   * Deletes a workflow via the remote workflow API.
   * @param {string} workflowId The workflow ID.
   * @return {Promise<void>} A promise that resolves when the workflow is deleted.
   */
  async delete(workflowId) {
    try {
      await this.client.delete(`/services/workflow/api/workflow/${workflowId}`);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('workflow:delete', { workflowId });
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('workflow:error', { operation: 'delete', workflowId, error: error.message });
      throw error;
    }
  }

  /**
   * Gets workflow execution status via the remote workflow API.
   * @param {string} executionId The execution ID.
   * @return {Promise<Object>} A promise that resolves to the execution status.
   */
  async getExecutionStatus(executionId) {
    try {
      const response = await this.client.get(`/services/workflow/api/execution/${executionId}`);
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('workflow:error', { operation: 'getExecutionStatus', executionId, error: error.message });
      throw error;
    }
  }
}

module.exports = WorkflowApi;
