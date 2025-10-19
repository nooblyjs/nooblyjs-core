/**
 * @fileoverview API-based data service implementation that proxies requests to a remote data service.
 * Allows client applications to consume backend data API endpoints for enterprise systems.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.14
 */

'use strict';

const axios = require('axios');

/**
 * A class that implements data operations via HTTP API calls to a remote service.
 * Provides CRUD methods for data management through REST endpoints.
 * @class
 */
class DataServiceApi {
  /**
   * Initializes the Data Service API client with configuration.
   * @param {Object} options Configuration options for the API client.
   * @param {string} options.apiRoot The root URL of the backend API service.
   * @param {string=} options.apiKey Optional API key for authenticated requests.
   * @param {number=} options.timeout Request timeout in milliseconds (default: 10000).
   * @param {EventEmitter=} eventEmitter Optional event emitter for data events.
   */
  constructor(options = {}, eventEmitter) {

    this.settings = {};
    this.settings.description = "Configuration settings for the DataService API Provider";
    this.settings.list = [
      {setting: "apiUrl", type: "string", values: ["http://localhost:3000"]},
      {setting: "timeout", type: "number", values: [10000]},
      {setting: "retryLimit", type: "number", values: [3]}
    ];
     this.settings.api = options.api || 'http://localhost:3000';
     this.settings.apikey = options.apiKey || null;
     this.timeout = options.timeout || 5000;

     this.eventEmitter_ = eventEmitter;
 
     // Configure axios instance
     this.client = axios.create({
       baseURL: this.settings.api,
       timeout: this.timeout,
       headers: this.settings.apikey ? { 'X-API-Key': this.settings.apikey } : {}
     });
  }

  /**
   * Creates a new record via the remote data API.
   * @param {string} collection The collection/table name.
   * @param {Object} data The data to create.
   * @return {Promise<Object>} A promise that resolves to the created record.
   */
  async create(collection, data) {
    try {
      const response = await this.client.post(`/services/dataservice/api/${collection}`, data);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('data:create', { collection, data: response.data });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('data:error', { operation: 'create', collection, error: error.message });
      throw error;
    }
  }

  /**
   * Reads records from the remote data API.
   * @param {string} collection The collection/table name.
   * @param {Object=} query Query parameters.
   * @return {Promise<Array>} A promise that resolves to the records.
   */
  async read(collection, query = {}) {
    try {
      const response = await this.client.get(`/services/dataservice/api/${collection}`, { params: query });
      if (this.eventEmitter_)
        this.eventEmitter_.emit('data:read', { collection, count: response.data.length });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('data:error', { operation: 'read', collection, error: error.message });
      throw error;
    }
  }

  /**
   * Reads a single record by ID via the remote data API.
   * @param {string} collection The collection/table name.
   * @param {string} id The record ID.
   * @return {Promise<Object>} A promise that resolves to the record.
   */
  async readById(collection, id) {
    try {
      const response = await this.client.get(`/services/dataservice/api/${collection}/${id}`);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('data:readById', { collection, id });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('data:error', { operation: 'readById', collection, id, error: error.message });
      throw error;
    }
  }

  /**
   * Updates a record via the remote data API.
   * @param {string} collection The collection/table name.
   * @param {string} id The record ID.
   * @param {Object} updates The data to update.
   * @return {Promise<Object>} A promise that resolves to the updated record.
   */
  async update(collection, id, updates) {
    try {
      const response = await this.client.put(`/services/dataservice/api/${collection}/${id}`, updates);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('data:update', { collection, id, updates });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('data:error', { operation: 'update', collection, id, error: error.message });
      throw error;
    }
  }

  /**
   * Deletes a record via the remote data API.
   * @param {string} collection The collection/table name.
   * @param {string} id The record ID.
   * @return {Promise<void>} A promise that resolves when the record is deleted.
   */
  async delete(collection, id) {
    try {
      await this.client.delete(`/services/dataservice/api/${collection}/${id}`);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('data:delete', { collection, id });
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('data:error', { operation: 'delete', collection, id, error: error.message });
      throw error;
    }
  }

  /**
   * Executes a query via the remote data API.
   * @param {string} collection The collection/table name.
   * @param {Object} query The query object.
   * @return {Promise<Array>} A promise that resolves to the query results.
   */
  async query(collection, query) {
    try {
      const response = await this.client.post(`/services/dataservice/api/${collection}/query`, { query });
      if (this.eventEmitter_)
        this.eventEmitter_.emit('data:query', { collection, count: response.data.length });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('data:error', { operation: 'query', collection, error: error.message });
      throw error;
    }
  }

  /**
   * Get all settings
   */
  async getSettings(){
    return this.settings;
  }

  /**
   * Save/update settings
   */
  async saveSettings(settings){
    for (let i = 0; i < this.settings.list.length; i++){
      if (settings[this.settings.list[i].setting] != null){
        this.settings[this.settings.list[i].setting] = settings[this.settings.list[i].setting];
        console.log(this.settings.list[i].setting + ' changed to: ' + settings[this.settings.list[i].setting]);
      }
    }
  }
}

module.exports = DataServiceApi;
