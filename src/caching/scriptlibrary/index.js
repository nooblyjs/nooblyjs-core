/**
 * @fileoverview NooblyJS Core Caching Client Library
 * A client-side JavaScript library for interacting with the NooblyJS Core caching service.
 * This library provides a simple, intuitive API for caching operations from web applications.
 *
 * @author NooblyJS Core Team
 * @version 1.0.0
 * @since 1.0.15
 *
 * @example
 * // Include the library in your HTML
 * <script src="/services/caching/scriptlibrary"></script>
 *
 * // Create a cache instance
 * const cache = new nooblyjsCaching({ instanceName: 'default' });
 *
 * // Store data in cache
 * cache.put('user:123', { name: 'John', age: 30 });
 *
 * // Retrieve data from cache
 * cache.get('user:123').then(data => {
 *   console.log(data); // { name: 'John', age: 30 }
 * });
 *
 * // Delete data from cache
 * cache.delete('user:123');
 *
 * // Check if key exists
 * cache.exists('user:123').then(exists => {
 *   console.log(exists); // true or false
 * });
 */

(function(global) {
  'use strict';

  /**
   * NooblyJS Core Caching Client Library
   * Provides client-side access to the caching service REST API
   *
   * @class nooblyjsCaching
   * @param {Object} options - Configuration options
   * @param {string} options.instanceName - Optional cache instance name (default: 'default')
   * @param {string} options.baseUrl - Optional base URL for API calls (default: window.location.origin)
   * @param {boolean} options.debug - Enable debug logging (default: false)
   * @param {number} options.timeout - Request timeout in milliseconds (default: 5000)
   */
  function nooblyjsCaching(options = {}) {
    this.instanceName = options.instanceName || 'default';
    this.baseUrl = options.baseUrl || window.location.origin;
    this.debug = options.debug || false;
    this.timeout = options.timeout || 5000;
    this.apiBase = this.buildApiBase();
  }

  /**
   * Build the base API URL for the cache instance
   * @private
   * @returns {string} The base API URL
   */
  nooblyjsCaching.prototype.buildApiBase = function() {
    if (this.instanceName === 'default') {
      return `${this.baseUrl}/services/caching/api`;
    }
    return `${this.baseUrl}/services/caching/api/${this.instanceName}`;
  };

  /**
   * Log a debug message if debugging is enabled
   * @private
   * @param {string} message - The message to log
   * @param {*} data - Optional data to log
   */
  nooblyjsCaching.prototype.log = function(message, data) {
    if (this.debug) {
      if (data !== undefined) {
        console.log(`[nooblyjsCaching:${this.instanceName}] ${message}`, data);
      } else {
        console.log(`[nooblyjsCaching:${this.instanceName}] ${message}`);
      }
    }
  };

  /**
   * Make a fetch request with error handling and timeout
   * @private
   * @param {string} url - The URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} The fetch response
   */
  nooblyjsCaching.prototype.fetchWithTimeout = function(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    return fetch(url, { ...options, signal: controller.signal })
      .then(response => {
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
      })
      .catch(error => {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }
        throw error;
      });
  };

  /**
   * Store a value in the cache
   * Stores data under the specified key in the cache service.
   * The key can use any string format including hierarchical keys like 'user:123:profile'
   *
   * @param {string} key - The cache key
   * @param {*} value - The value to store (can be any JSON-serializable value)
   * @returns {Promise<void>} A promise that resolves when the value is stored
   * @throws {Error} If the operation fails
   *
   * @example
   * cache.put('user:123', { name: 'John', email: 'john@example.com' })
   *   .then(() => console.log('Stored successfully'))
   *   .catch(err => console.error('Failed to store:', err));
   */
  nooblyjsCaching.prototype.put = function(key, value) {
    if (!key || typeof key !== 'string') {
      return Promise.reject(new Error('Key must be a non-empty string'));
    }

    const url = `${this.apiBase}/put/${encodeURIComponent(key)}`;

    this.log(`Storing key: ${key}`);

    return this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(value)
    })
      .then(response => {
        this.log(`Successfully stored key: ${key}`);
        return response.text();
      })
      .catch(error => {
        this.log(`Failed to store key: ${key}`, error.message);
        throw error;
      });
  };

  /**
   * Retrieve a value from the cache
   * Retrieves data stored under the specified key from the cache service.
   * Returns null or undefined if the key does not exist.
   *
   * @param {string} key - The cache key to retrieve
   * @returns {Promise<*>} A promise that resolves with the cached value
   * @throws {Error} If the operation fails
   *
   * @example
   * cache.get('user:123')
   *   .then(data => {
   *     console.log('Retrieved:', data); // { name: 'John', email: 'john@example.com' }
   *   })
   *   .catch(err => console.error('Failed to retrieve:', err));
   */
  nooblyjsCaching.prototype.get = function(key) {
    if (!key || typeof key !== 'string') {
      return Promise.reject(new Error('Key must be a non-empty string'));
    }

    const url = `${this.apiBase}/get/${encodeURIComponent(key)}`;

    this.log(`Retrieving key: ${key}`);

    return this.fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => response.json())
      .then(data => {
        this.log(`Successfully retrieved key: ${key}`, data);
        return data;
      })
      .catch(error => {
        this.log(`Failed to retrieve key: ${key}`, error.message);
        throw error;
      });
  };

  /**
   * Delete a value from the cache
   * Removes the data stored under the specified key from the cache service.
   * Does not throw an error if the key doesn't exist.
   *
   * @param {string} key - The cache key to delete
   * @returns {Promise<void>} A promise that resolves when the value is deleted
   * @throws {Error} If the operation fails
   *
   * @example
   * cache.delete('user:123')
   *   .then(() => console.log('Deleted successfully'))
   *   .catch(err => console.error('Failed to delete:', err));
   */
  nooblyjsCaching.prototype.delete = function(key) {
    if (!key || typeof key !== 'string') {
      return Promise.reject(new Error('Key must be a non-empty string'));
    }

    const url = `${this.apiBase}/delete/${encodeURIComponent(key)}`;

    this.log(`Deleting key: ${key}`);

    return this.fetchWithTimeout(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => {
        this.log(`Successfully deleted key: ${key}`);
        return response.text();
      })
      .catch(error => {
        this.log(`Failed to delete key: ${key}`, error.message);
        throw error;
      });
  };

  /**
   * Check if a key exists in the cache
   * Attempts to retrieve a key and returns true if it exists, false otherwise.
   *
   * @param {string} key - The cache key to check
   * @returns {Promise<boolean>} A promise that resolves with true if key exists, false otherwise
   *
   * @example
   * cache.exists('user:123')
   *   .then(exists => {
   *     console.log(exists ? 'Key exists' : 'Key does not exist');
   *   });
   */
  nooblyjsCaching.prototype.exists = function(key) {
    return this.get(key)
      .then(value => value !== null && value !== undefined)
      .catch(() => false);
  };

  /**
   * Get cache service status
   * Checks if the caching service is running and accessible.
   *
   * @returns {Promise<string>} A promise that resolves with the status message
   * @throws {Error} If the operation fails
   *
   * @example
   * cache.status()
   *   .then(status => console.log('Status:', status))
   *   .catch(err => console.error('Failed to get status:', err));
   */
  nooblyjsCaching.prototype.status = function() {
    const url = `${this.baseUrl}/services/caching/api/status`;

    this.log('Checking cache service status');

    return this.fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => response.json())
      .then(status => {
        this.log('Cache service status:', status);
        return status;
      })
      .catch(error => {
        this.log('Failed to get cache service status', error.message);
        throw error;
      });
  };

  /**
   * Get list of available cache instances
   * Retrieves a list of all configured cache instances.
   *
   * @returns {Promise<Array>} A promise that resolves with array of instance objects
   * @throws {Error} If the operation fails
   *
   * @example
   * cache.listInstances()
   *   .then(instances => {
   *     console.log('Available instances:', instances);
   *     // [{ name: 'default', provider: 'memory', status: 'active' }, ...]
   *   });
   */
  nooblyjsCaching.prototype.listInstances = function() {
    const url = `${this.baseUrl}/services/caching/api/instances`;

    this.log('Listing available cache instances');

    return this.fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => response.json())
      .then(data => {
        this.log('Available instances:', data.instances);
        return data.instances;
      })
      .catch(error => {
        this.log('Failed to list instances', error.message);
        throw error;
      });
  };

  /**
   * Store multiple values in cache (batch operation)
   * Stores multiple key-value pairs in the cache service.
   *
   * @param {Object} items - Object with key-value pairs to store
   * @returns {Promise<Object>} A promise that resolves with results of each operation
   *
   * @example
   * cache.putBatch({
   *   'user:123': { name: 'John' },
   *   'user:456': { name: 'Jane' },
   *   'config:app': { theme: 'dark' }
   * }).then(results => {
   *   console.log('All items stored');
   * });
   */
  nooblyjsCaching.prototype.putBatch = function(items) {
    if (typeof items !== 'object' || items === null) {
      return Promise.reject(new Error('Items must be an object'));
    }

    const keys = Object.keys(items);
    this.log(`Batch storing ${keys.length} items`);

    const promises = keys.map(key => {
      return this.put(key, items[key])
        .then(() => ({ key, success: true }))
        .catch(error => ({ key, success: false, error: error.message }));
    });

    return Promise.all(promises);
  };

  /**
   * Retrieve multiple values from cache (batch operation)
   * Retrieves multiple values from the cache service.
   *
   * @param {Array<string>} keys - Array of cache keys to retrieve
   * @returns {Promise<Object>} A promise that resolves with object of key-value pairs
   *
   * @example
   * cache.getBatch(['user:123', 'user:456', 'config:app'])
   *   .then(results => {
   *     console.log('Retrieved items:', results);
   *     // { 'user:123': {...}, 'user:456': {...}, 'config:app': {...} }
   *   });
   */
  nooblyjsCaching.prototype.getBatch = function(keys) {
    if (!Array.isArray(keys)) {
      return Promise.reject(new Error('Keys must be an array'));
    }

    this.log(`Batch retrieving ${keys.length} items`);

    const promises = keys.map(key => {
      return this.get(key)
        .then(value => ({ key, value, success: true }))
        .catch(error => ({ key, success: false, error: error.message }));
    });

    return Promise.all(promises)
      .then(results => {
        const output = {};
        results.forEach(result => {
          if (result.success) {
            output[result.key] = result.value;
          }
        });
        return output;
      });
  };

  /**
   * Clear all cache entries (delete multiple keys)
   * Deletes multiple keys from the cache service.
   *
   * @param {Array<string>} keys - Array of cache keys to delete
   * @returns {Promise<Object>} A promise that resolves with results of each deletion
   *
   * @example
   * cache.clear(['user:123', 'user:456', 'config:app'])
   *   .then(results => console.log('Cleared items'));
   */
  nooblyjsCaching.prototype.clear = function(keys) {
    if (!Array.isArray(keys)) {
      return Promise.reject(new Error('Keys must be an array'));
    }

    this.log(`Clearing ${keys.length} items`);

    const promises = keys.map(key => {
      return this.delete(key)
        .then(() => ({ key, success: true }))
        .catch(error => ({ key, success: false, error: error.message }));
    });

    return Promise.all(promises);
  };

  // Expose the library globally
  global.nooblyjsCaching = nooblyjsCaching;

  // Also support AMD and CommonJS if running in those environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = nooblyjsCaching;
  }

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
