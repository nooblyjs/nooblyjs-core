/**
 * @fileoverview Noobly-core Logging JavaScript Client Library
 * Client-side library for logging from web applications.
 * Provides methods for logging at different levels: info, warn, error, and debug.
 *
 * @author NooblyJS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Noobly-core Logging Service Client
 *
 * Provides a JavaScript client for consuming the logging service API from browser applications.
 * Supports multiple named logger instances for different use cases and log routing.
 *
 * @example
 * // Create a new logging client
 * var logger = new nooblyjscorelogging('default');
 *
 * // Log at different levels
 * logger.info('User logged in', {userId: 123, timestamp: new Date()});
 * logger.warn('Unusual activity detected', {activity: 'multiple_login_attempts'});
 * logger.error('Database connection failed', {error: 'timeout', duration: 5000});
 * logger.debug('Processing request', {requestId: 'abc123', params: {foo: 'bar'}});
 *
 * // Get analytics
 * logger.getAnalytics()
 *   .then(analytics => console.log('Log stats:', analytics))
 *   .catch(err => console.error(err));
 */
class nooblyjscorelogging {
  /**
   * Initializes a new Logging Service client instance.
   *
   * @param {string} [instanceName='default'] - The name of the logger instance to connect to.
   *                                             Must match an instance on the server.
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.apiKey] - Optional API key for authentication
   * @param {boolean} [options.debug=false] - Enable debug logging
   * @param {string} [options.minLogLevel='info'] - Minimum log level to send ('debug', 'info', 'warn', 'error')
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
      minLogLevel: options.minLogLevel || 'info',
      ...options
    };

    /**
     * @type {string}
     * @private
     */
    this.baseUrl = this.getBaseUrl();

    /**
     * Log levels in order of severity
     * @type {Array<string>}
     * @private
     */
    this.logLevels = ['debug', 'info', 'warn', 'error'];

    /**
     * Local log history for offline support
     * @type {Array<Object>}
     * @private
     */
    this.localLogs = [];

    /**
     * Max number of local logs to keep in memory
     * @type {number}
     * @private
     */
    this.maxLocalLogs = 100;

    if (this.options.debug) {
      console.log('[nooblyjscorelogging] Initialized with instance:', this.instanceName);
      console.log('[nooblyjscorelogging] Base URL:', this.baseUrl);
      console.log('[nooblyjscorelogging] Min log level:', this.options.minLogLevel);
    }
  }

  /**
   * Get the base URL for the logging API
   * Handles both default and named instances
   *
   * @private
   * @returns {string} The base URL for API calls
   */
  getBaseUrl() {
    if (this.instanceName === 'default' || !this.instanceName) {
      return '/services/logging/api';
    }
    return `/services/logging/api/${this.instanceName}`;
  }

  /**
   * Determines if a message should be logged based on its level
   *
   * @private
   * @param {string} level - The log level
   * @returns {boolean} True if the message should be logged
   */
  shouldLog(level) {
    const messagePriority = this.logLevels.indexOf(level);
    const minPriority = this.logLevels.indexOf(this.options.minLogLevel);
    return messagePriority >= minPriority;
  }

  /**
   * Make a fetch request to the logging API
   *
   * @private
   * @param {string} endpoint - The API endpoint
   * @param {*} logData - The log data to send
   * @returns {Promise<*>} The response data
   * @throws {Error} If the API request fails
   */
  async request(endpoint, logData) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (this.options.apiKey) {
      options.headers['X-API-Key'] = this.options.apiKey;
    }

    options.body = JSON.stringify(logData);

    if (this.options.debug) {
      console.log('[nooblyjscorelogging] Request:', url, logData);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      if (this.options.debug) {
        console.error('[nooblyjscorelogging] Request failed:', error);
      }
      // Still store locally even if API fails
      this.storeLocalLog('error', 'Failed to send log to server', { error: error.message });
      throw error;
    }
  }

  /**
   * Store a log message locally for offline support
   *
   * @private
   * @param {string} level - The log level
   * @param {string} message - The log message
   * @param {*} meta - Optional metadata
   */
  storeLocalLog(level, message, meta) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message,
      meta: meta
    };

    this.localLogs.push(logEntry);

    // Keep only the last maxLocalLogs entries
    if (this.localLogs.length > this.maxLocalLogs) {
      this.localLogs.shift();
    }
  }

  /**
   * Logs an info message
   *
   * @param {string} message - The message to log
   * @param {*} [meta] - Optional metadata to include in the log
   * @returns {Promise<void>} Promise that resolves when the message is logged
   * @throws {Error} If the message is missing or the API request fails
   *
   * @example
   * logger.info('User action', {userId: 123, action: 'login'})
   *   .then(() => console.log('Logged'))
   *   .catch(err => console.error(err));
   */
  async info(message, meta) {
    if (!message) {
      throw new Error('Message is required');
    }

    if (!this.shouldLog('info')) {
      return;
    }

    const endpoint = '/info';
    const logData = { message, meta };

    this.storeLocalLog('info', message, meta);

    try {
      return await this.request(endpoint, logData);
    } catch (error) {
      // Log locally on failure, but don't throw - allow app to continue
      if (this.options.debug) {
        console.error('[nooblyjscorelogging] Info log failed:', error.message);
      }
    }
  }

  /**
   * Logs a warning message
   *
   * @param {string} message - The message to log
   * @param {*} [meta] - Optional metadata to include in the log
   * @returns {Promise<void>} Promise that resolves when the message is logged
   * @throws {Error} If the message is missing or the API request fails
   *
   * @example
   * logger.warn('Unusual activity', {activity: 'multiple_failed_logins'})
   *   .then(() => console.log('Logged'))
   *   .catch(err => console.error(err));
   */
  async warn(message, meta) {
    if (!message) {
      throw new Error('Message is required');
    }

    if (!this.shouldLog('warn')) {
      return;
    }

    const endpoint = '/warn';
    const logData = { message, meta };

    this.storeLocalLog('warn', message, meta);

    try {
      return await this.request(endpoint, logData);
    } catch (error) {
      if (this.options.debug) {
        console.error('[nooblyjscorelogging] Warn log failed:', error.message);
      }
    }
  }

  /**
   * Logs an error message
   *
   * @param {string} message - The message to log
   * @param {*} [meta] - Optional metadata to include in the log
   * @returns {Promise<void>} Promise that resolves when the message is logged
   * @throws {Error} If the message is missing or the API request fails
   *
   * @example
   * logger.error('Connection failed', {error: 'timeout', url: 'https://api.example.com'})
   *   .then(() => console.log('Logged'))
   *   .catch(err => console.error(err));
   */
  async error(message, meta) {
    if (!message) {
      throw new Error('Message is required');
    }

    if (!this.shouldLog('error')) {
      return;
    }

    const endpoint = '/error';
    const logData = { message, meta };

    this.storeLocalLog('error', message, meta);

    try {
      return await this.request(endpoint, logData);
    } catch (error) {
      if (this.options.debug) {
        console.error('[nooblyjscorelogging] Error log failed:', error.message);
      }
    }
  }

  /**
   * Logs a debug message
   *
   * @param {string} message - The message to log
   * @param {*} [meta] - Optional metadata to include in the log
   * @returns {Promise<void>} Promise that resolves when the message is logged
   * @throws {Error} If the message is missing or the API request fails
   *
   * @example
   * logger.debug('Processing request', {requestId: 'abc123', params: {foo: 'bar'}})
   *   .then(() => console.log('Logged'))
   *   .catch(err => console.error(err));
   */
  async debug(message, meta) {
    if (!message) {
      throw new Error('Message is required');
    }

    if (!this.shouldLog('debug')) {
      return;
    }

    const endpoint = '/log';
    const logData = { message, meta };

    this.storeLocalLog('debug', message, meta);

    try {
      return await this.request(endpoint, logData);
    } catch (error) {
      if (this.options.debug) {
        console.error('[nooblyjscorelogging] Debug log failed:', error.message);
      }
    }
  }

  /**
   * Gets analytics data for this logger instance
   *
   * @returns {Promise<Object>} Promise that resolves to analytics data
   * @throws {Error} If the API request fails
   *
   * @example
   * logger.getAnalytics()
   *   .then(analytics => console.log('Analytics:', analytics))
   *   .catch(err => console.error(err));
   */
  async getAnalytics() {
    const url = `${this.baseUrl}/analytics`;
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (this.options.apiKey) {
      options.headers['X-API-Key'] = this.options.apiKey;
    }

    if (this.options.debug) {
      console.log('[nooblyjscorelogging] Getting analytics');
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (this.options.debug) {
        console.error('[nooblyjscorelogging] Failed to get analytics:', error);
      }
      throw error;
    }
  }

  /**
   * Gets the settings for this logger instance
   *
   * @returns {Promise<Object>} Promise that resolves to settings object
   * @throws {Error} If the API request fails
   *
   * @example
   * logger.getSettings()
   *   .then(settings => console.log('Settings:', settings))
   *   .catch(err => console.error(err));
   */
  async getSettings() {
    const url = `${this.baseUrl}/settings`;
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (this.options.apiKey) {
      options.headers['X-API-Key'] = this.options.apiKey;
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (this.options.debug) {
        console.error('[nooblyjscorelogging] Failed to get settings:', error);
      }
      throw error;
    }
  }

  /**
   * Saves settings for this logger instance
   *
   * @param {Object} settings - Settings object to save
   * @returns {Promise<void>} Promise that resolves when settings are saved
   * @throws {Error} If the settings are invalid or the API request fails
   *
   * @example
   * logger.saveSettings({minLogLevel: 'warn'})
   *   .then(() => console.log('Settings saved'))
   *   .catch(err => console.error(err));
   */
  async saveSettings(settings) {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Settings must be a non-null object');
    }

    const url = `${this.baseUrl}/settings`;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (this.options.apiKey) {
      options.headers['X-API-Key'] = this.options.apiKey;
    }

    options.body = JSON.stringify(settings);

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      return await response.text();
    } catch (error) {
      if (this.options.debug) {
        console.error('[nooblyjscorelogging] Failed to save settings:', error);
      }
      throw error;
    }
  }

  /**
   * Gets the local log history
   *
   * @param {number} [limit=10] - Maximum number of logs to return
   * @returns {Array<Object>} Array of log entries
   */
  getLocalLogs(limit = 10) {
    return this.localLogs.slice(-limit);
  }

  /**
   * Clears the local log history
   *
   * @returns {void}
   */
  clearLocalLogs() {
    this.localLogs = [];
  }

  /**
   * Get the current log level
   *
   * @returns {string} The current minimum log level
   */
  getLogLevel() {
    return this.options.minLogLevel;
  }

  /**
   * Set the minimum log level
   *
   * @param {string} level - The new minimum log level ('debug', 'info', 'warn', 'error')
   * @throws {Error} If the level is not valid
   */
  setLogLevel(level) {
    if (!this.logLevels.includes(level)) {
      throw new Error(`Invalid log level: ${level}. Must be one of: ${this.logLevels.join(', ')}`);
    }
    this.options.minLogLevel = level;
  }
}

// Export for use in browser or Node.js environments
if (typeof window !== 'undefined') {
  // Browser environment - attach to window object
  window.nooblyjscorelogging = nooblyjscorelogging;
}

if (typeof module !== 'undefined' && module.exports) {
  // Node.js/CommonJS environment
  module.exports = nooblyjscorelogging;
}
