/**
 * @fileoverview Noobly-core Queueing JavaScript Client Library
 * Client-side library for interacting with the queueing service from web applications.
 * Provides a simple interface for enqueue and dequeue operations.
 *
 * @author NooblyJS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Noobly-core Queueing Service Client
 *
 * Provides a JavaScript client for consuming the queueing service API from browser applications.
 * Supports multiple named queue instances for different use cases.
 *
 * @example
 * // Create a new queueing client
 * var queueClient = new nooblyjscorequeueing('default');
 *
 * // Enqueue an item
 * var item = {data: {userId: 123, action: 'process'}};
 * queueClient.enqueue('tasks', item)
 *   .then(function() {
 *     console.log('Item enqueued successfully');
 *   })
 *   .catch(function(error) {
 *     console.error('Failed to enqueue item:', error);
 *   });
 *
 * // Dequeue an item
 * queueClient.dequeue('tasks')
 *   .then(function(item) {
 *     console.log('Dequeued item:', item);
 *   })
 *   .catch(function(error) {
 *     console.error('Failed to dequeue item:', error);
 *   });
 *
 * // Check queue size
 * queueClient.size('tasks')
 *   .then(function(size) {
 *     console.log('Queue size:', size);
 *   });
 *
 * // List all queues
 * queueClient.listQueues()
 *   .then(function(queues) {
 *     console.log('Available queues:', queues);
 *   });
 *
 * // Purge a queue
 * queueClient.purge('tasks')
 *   .then(function() {
 *     console.log('Queue purged');
 *   });
 */
class nooblyjscorequeueing {
  /**
   * Initializes a new Queueing Service client instance.
   *
   * @param {string} [instanceName='default'] - The name of the queue instance to connect to.
   *                                             Must match an instance on the server.
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.apiKey] - Optional API key for authentication
   * @param {boolean} [options.debug=false] - Enable debug logging
   * @throws {TypeError} If instanceName is provided but is not a string
   */
  constructor(instanceName = 'default', options = {}) {
    if (instanceName && typeof instanceName !== 'string') {
      throw new TypeError('instanceName must be a string');
    }

    /**
     * @type {string}
     * @private
     */
    this.instanceName = instanceName;

    /**
     * @type {Object}
     * @private
     */
    this.options = {
      apiKey: options.apiKey || null,
      debug: options.debug || false,
      ...options
    };

    /**
     * @type {string}
     * @private
     */
    this.baseUrl = this.getBaseUrl();

    if (this.options.debug) {
      console.log('[nooblyjscorequeueing] Initialized with instance:', this.instanceName);
      console.log('[nooblyjscorequeueing] Base URL:', this.baseUrl);
    }
  }

  /**
   * Get the base URL for the queueing API
   * Handles both default and named instances
   *
   * @private
   * @returns {string} The base URL for API calls
   */
  getBaseUrl() {
    if (this.instanceName === 'default' || !this.instanceName) {
      return '/services/queueing/api';
    }
    return `/services/queueing/api/${this.instanceName}`;
  }

  /**
   * Make a fetch request to the queueing API
   *
   * @private
   * @param {string} endpoint - The API endpoint
   * @param {string} method - HTTP method (GET, POST, DELETE)
   * @param {*} body - Optional request body
   * @returns {Promise<*>} The response data
   * @throws {Error} If the API request fails
   */
  async request(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (this.options.apiKey) {
      options.headers['X-API-Key'] = this.options.apiKey;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    if (this.options.debug) {
      console.log('[nooblyjscorequeueing] Request:', method, url, body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      // Handle different response types
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      if (this.options.debug) {
        console.error('[nooblyjscorequeueing] Request failed:', error);
      }
      throw error;
    }
  }

  /**
   * Enqueues an item to the specified queue
   *
   * @param {string} queueName - The name of the queue
   * @param {*} object_to_be_queued - The object to add to the queue
   * @returns {Promise<void>} Promise that resolves when the item is enqueued
   * @throws {Error} If the queue name is missing or the API request fails
   *
   * @example
   * queueClient.enqueue('tasks', {userId: 123, action: 'process'})
   *   .then(() => console.log('Enqueued'))
   *   .catch(err => console.error(err));
   */
  async enqueue(queueName, object_to_be_queued) {
    if (!queueName) {
      throw new Error('Queue name is required');
    }

    if (object_to_be_queued === undefined) {
      throw new Error('Object to be queued is required');
    }

    const endpoint = `/enqueue/${encodeURIComponent(queueName)}`;
    return await this.request(endpoint, 'POST', { task: object_to_be_queued });
  }

  /**
   * Dequeues and returns the next item from the specified queue
   *
   * @param {string} queueName - The name of the queue
   * @returns {Promise<*>} Promise that resolves to the dequeued object, or undefined if queue is empty
   * @throws {Error} If the queue name is missing or the API request fails
   *
   * @example
   * queueClient.dequeue('tasks')
   *   .then(item => console.log('Dequeued:', item))
   *   .catch(err => console.error(err));
   */
  async dequeue(queueName) {
    if (!queueName) {
      throw new Error('Queue name is required');
    }

    const endpoint = `/dequeue/${encodeURIComponent(queueName)}`;
    return await this.request(endpoint, 'GET');
  }

  /**
   * Gets the current size of the specified queue
   *
   * @param {string} queueName - The name of the queue
   * @returns {Promise<number>} Promise that resolves to the queue size
   * @throws {Error} If the queue name is missing or the API request fails
   *
   * @example
   * queueClient.size('tasks')
   *   .then(size => console.log('Queue size:', size))
   *   .catch(err => console.error(err));
   */
  async size(queueName) {
    if (!queueName) {
      throw new Error('Queue name is required');
    }

    const endpoint = `/size/${encodeURIComponent(queueName)}`;
    return await this.request(endpoint, 'GET');
  }

  /**
   * Gets a list of all queue names in this instance
   *
   * @returns {Promise<Array<string>>} Promise that resolves to array of queue names
   * @throws {Error} If the API request fails
   *
   * @example
   * queueClient.listQueues()
   *   .then(queues => console.log('Available queues:', queues))
   *   .catch(err => console.error(err));
   */
  async listQueues() {
    const endpoint = '/queues';
    return await this.request(endpoint, 'GET');
  }

  /**
   * Purges all items from the specified queue
   *
   * @param {string} queueName - The name of the queue to purge
   * @returns {Promise<void>} Promise that resolves when the queue is purged
   * @throws {Error} If the queue name is missing or the API request fails
   *
   * @example
   * queueClient.purge('tasks')
   *   .then(() => console.log('Queue purged'))
   *   .catch(err => console.error(err));
   */
  async purge(queueName) {
    if (!queueName) {
      throw new Error('Queue name is required');
    }

    const endpoint = `/purge/${encodeURIComponent(queueName)}`;
    return await this.request(endpoint, 'DELETE');
  }

  /**
   * Gets analytics data for this queue instance
   *
   * @returns {Promise<Object>} Promise that resolves to analytics data
   * @throws {Error} If the API request fails
   *
   * @example
   * queueClient.getAnalytics()
   *   .then(analytics => console.log('Analytics:', analytics))
   *   .catch(err => console.error(err));
   */
  async getAnalytics() {
    const endpoint = '/analytics';
    return await this.request(endpoint, 'GET');
  }

  /**
   * Gets the settings for this queue instance
   *
   * @returns {Promise<Object>} Promise that resolves to settings object
   * @throws {Error} If the API request fails
   *
   * @example
   * queueClient.getSettings()
   *   .then(settings => console.log('Settings:', settings))
   *   .catch(err => console.error(err));
   */
  async getSettings() {
    const endpoint = '/settings';
    return await this.request(endpoint, 'GET');
  }

  /**
   * Saves settings for this queue instance
   *
   * @param {Object} settings - Settings object to save
   * @returns {Promise<void>} Promise that resolves when settings are saved
   * @throws {Error} If the settings are invalid or the API request fails
   *
   * @example
   * queueClient.saveSettings({maxSize: 1000})
   *   .then(() => console.log('Settings saved'))
   *   .catch(err => console.error(err));
   */
  async saveSettings(settings) {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Settings must be a non-null object');
    }

    const endpoint = '/settings';
    return await this.request(endpoint, 'POST', settings);
  }
}

// Export for use in browser or Node.js environments
if (typeof window !== 'undefined') {
  // Browser environment - attach to window object
  window.nooblyjscorequeueing = nooblyjscorequeueing;
}

if (typeof module !== 'undefined' && module.exports) {
  // Node.js/CommonJS environment
  module.exports = nooblyjscorequeueing;
}
