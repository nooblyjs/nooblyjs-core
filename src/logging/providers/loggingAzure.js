/**
 * @fileoverview Azure Monitor logging provider for NooblyJS Core
 * Sends log messages to Azure Monitor for centralized logging and diagnostics.
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const os = require('os');
const https = require('https');
const crypto = require('crypto');

/**
 * Azure Monitor Logger
 * Integrates with Azure Monitor for enterprise-grade logging and analytics.
 * Uses the HTTP Data Collector API for flexible log ingestion.
 *
 * @class
 */
class LoggingAzure {
  /**
   * Initializes the Azure Monitor logger.
   *
   * @param {Object} options Configuration options
   * @param {string} options.workspaceId Azure Log Analytics workspace ID
   * @param {string} options.sharedKey Shared key for workspace authentication
   * @param {string} options.logType Custom log type name (default: 'NooblyCoreLogs')
   * @param {string} options.environment Azure environment (default: 'public')
   * @param {number} options.batchSize Number of logs to batch before sending (default: 10)
   * @param {number} options.flushInterval Time in ms to auto-flush logs (default: 5000)
   * @param {EventEmitter} eventEmitter Optional event emitter for log events
   */
  constructor(options = {}, eventEmitter) {
    this.settings = {
      description: 'Azure Monitor logging configuration',
      list: [
        { setting: 'minLogLevel', type: 'list', values: ['error', 'warn', 'info', 'log'] },
        { setting: 'workspaceId', type: 'string', values: [] },
        { setting: 'logType', type: 'string', values: [] },
        { setting: 'environment', type: 'list', values: ['public', 'government', 'china', 'germany'] }
      ]
    };

    this.eventEmitter_ = eventEmitter;
    this.instanceName_ = (options && options.instanceName) || 'default';
    this.workspaceId_ = options.workspaceId || process.env.AZURE_WORKSPACE_ID;
    this.sharedKey_ = options.sharedKey || process.env.AZURE_SHARED_KEY;
    this.logType_ = options.logType || 'NooblyCoreLogs';
    this.environment_ = options.environment || 'public';
    this.batchSize_ = options.batchSize || 10;
    this.flushInterval_ = options.flushInterval || 5000;
    this.logBuffer_ = [];
    this.isInitialized_ = false;

    // Determine the appropriate endpoint based on environment
    this.setEnvironmentEndpoint_();

    if (options?.log?.level) {
      this.settings.minLogLevel = options.log.level;
    } else {
      this.settings.minLogLevel = 'info';
    }

    this.settings.workspaceId = this.workspaceId_;
    this.settings.logType = this.logType_;
    this.settings.environment = this.environment_;

    // Validate Azure credentials
    this.validateAzureCredentials_();

    // Start flush interval
    this.startFlushInterval_();
  }

  /**
   * Sets the appropriate Azure endpoint based on environment.
   * @private
   */
  setEnvironmentEndpoint_() {
    const endpoints = {
      'public': '.ods.opinsights.azure.com',
      'government': '.ods.opinsights.us',
      'china': '.ods.opinsights.cn',
      'germany': '.ods.opinsights.de'
    };

    this.endpoint_ = endpoints[this.environment_] || endpoints['public'];
  }

  /**
   * Validates that Azure credentials are available.
   * @private
   */
  validateAzureCredentials_() {
    if (!this.workspaceId_) {
      console.warn('Azure Monitor: Missing AZURE_WORKSPACE_ID environment variable or workspaceId option');
    }
    if (!this.sharedKey_) {
      console.warn('Azure Monitor: Missing AZURE_SHARED_KEY environment variable or sharedKey option');
    }
  }

  /**
   * Initializes Azure Monitor connection.
   * @private
   * @return {Promise<void>}
   */
  async initialize_() {
    if (this.isInitialized_) {
      return;
    }

    if (!this.workspaceId_ || !this.sharedKey_) {
      console.warn('Azure Monitor: Cannot initialize without workspace credentials');
      return;
    }

    this.isInitialized_ = true;
  }

  /**
   * Builds Azure Monitor API request signature.
   * @private
   * @param {string} date RFC1123 formatted date
   * @param {number} contentLength Length of request body
   * @returns {string} Authorization header value
   */
  buildSignature_(date, contentLength) {
    const stringToSign = `POST\n${contentLength}\napplication/json\nx-ms-date:${date}\n/api/logs`;

    const signature = crypto
      .createHmac('sha256', Buffer.from(this.sharedKey_, 'base64'))
      .update(stringToSign, 'utf-8')
      .digest('base64');

    return `SharedKey ${this.workspaceId_}:${signature}`;
  }

  /**
   * Sends buffered logs to Azure Monitor.
   * @private
   * @return {Promise<void>}
   */
  async flushLogs_() {
    if (!this.isInitialized_ || this.logBuffer_.length === 0) {
      return;
    }

    try {
      const payload = JSON.stringify(this.logBuffer_);
      const payloadBytes = Buffer.byteLength(payload, 'utf-8');
      const now = new Date();
      const date = now.toUTCString();
      const signature = this.buildSignature_(date, payloadBytes);

      const hostname = `${this.workspaceId_}${this.endpoint_}`;
      const path = '/api/logs?api-version=2016-04-01';

      const options = {
        hostname: hostname,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payloadBytes,
          'Authorization': signature,
          'Log-Type': this.logType_,
          'x-ms-date': date,
          'time-generated-field': 'timestamp'
        }
      };

      await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              this.logBuffer_ = [];
              resolve();
            } else {
              reject(new Error(`Azure Monitor API error: ${res.statusCode} ${res.statusMessage}`));
            }
          });
        });

        req.on('error', (error) => {
          console.warn(`Failed to send logs to Azure Monitor: ${error.message}`);
          reject(error);
        });

        req.write(payload);
        req.end();
      });
    } catch (error) {
      console.warn(`Failed to flush logs to Azure Monitor: ${error.message}`);
      // Keep logs in buffer for next attempt
    }
  }

  /**
   * Starts the automatic flush interval.
   * @private
   */
  startFlushInterval_() {
    this.flushTimer_ = setInterval(async () => {
      if (this.isInitialized_) {
        await this.flushLogs_();
      }
    }, this.flushInterval_);

    // Ensure timer doesn't prevent process exit
    if (this.flushTimer_.unref) {
      this.flushTimer_.unref();
    }
  }

  /**
   * Determines the priority of a log level.
   * @param {string} level
   * @returns {number}
   */
  determineLogLevelPriority(level) {
    const levels = ['error', 'warn', 'info', 'log'];
    return levels.indexOf(level);
  }

  /**
   * Determines if a message should be logged based on level and minimum log level.
   * @param {string} level
   * @returns {boolean}
   */
  shouldLog(level) {
    if (!this.settings.minLogLevel) {
      return true;
    }
    const messagePriority = this.determineLogLevelPriority(level);
    const minPriority = this.determineLogLevelPriority(this.settings.minLogLevel);
    return messagePriority <= minPriority;
  }

  /**
   * Formats the message and metadata into a log string.
   * @private
   * @param {string} message
   * @param {*} meta
   * @returns {string}
   */
  formatMessage_(message, meta) {
    if (meta === undefined || meta === null) {
      return message;
    }

    if (typeof meta === 'object') {
      try {
        const metaStr = JSON.stringify(meta, null, 2);
        return `${message} ${metaStr}`;
      } catch (err) {
        return `${message} ${String(meta)}`;
      }
    }

    return `${message} ${meta}`;
  }

  /**
   * Logs an info message to Azure Monitor.
   * @param {string} message
   * @param {*} meta Optional metadata
   * @return {Promise<void>}
   */
  async info(message, meta) {
    if (!this.shouldLog('info')) {
      return;
    }

    await this.initialize_();

    const timestamp = new Date().toISOString();
    const device = os.hostname();
    const formattedMessage = this.formatMessage_(message, meta);

    this.logBuffer_.push({
      timestamp: timestamp,
      level: 'INFO',
      device: device,
      message: formattedMessage,
      instanceName: this.instanceName_
    });

    if (this.logBuffer_.length >= this.batchSize_) {
      await this.flushLogs_();
    }

    if (this.eventEmitter_) {
      const eventName = `log:info:${this.instanceName_}`;
      this.eventEmitter_.emit(eventName, { message: formattedMessage });
    }
  }

  /**
   * Logs a warning message to Azure Monitor.
   * @param {string} message
   * @param {*} meta Optional metadata
   * @return {Promise<void>}
   */
  async warn(message, meta) {
    if (!this.shouldLog('warn')) {
      return;
    }

    await this.initialize_();

    const timestamp = new Date().toISOString();
    const device = os.hostname();
    const formattedMessage = this.formatMessage_(message, meta);

    this.logBuffer_.push({
      timestamp: timestamp,
      level: 'WARN',
      device: device,
      message: formattedMessage,
      instanceName: this.instanceName_
    });

    if (this.logBuffer_.length >= this.batchSize_) {
      await this.flushLogs_();
    }

    if (this.eventEmitter_) {
      const eventName = `log:warn:${this.instanceName_}`;
      this.eventEmitter_.emit(eventName, { message: formattedMessage });
    }
  }

  /**
   * Logs an error message to Azure Monitor.
   * @param {string} message
   * @param {*} meta Optional metadata
   * @return {Promise<void>}
   */
  async error(message, meta) {
    if (!this.shouldLog('error')) {
      return;
    }

    await this.initialize_();

    const timestamp = new Date().toISOString();
    const device = os.hostname();
    const formattedMessage = this.formatMessage_(message, meta);

    this.logBuffer_.push({
      timestamp: timestamp,
      level: 'ERROR',
      device: device,
      message: formattedMessage,
      instanceName: this.instanceName_
    });

    if (this.logBuffer_.length >= this.batchSize_) {
      await this.flushLogs_();
    }

    if (this.eventEmitter_) {
      const eventName = `log:error:${this.instanceName_}`;
      this.eventEmitter_.emit(eventName, { message: formattedMessage });
    }
  }

  /**
   * Logs a debug message to Azure Monitor.
   * @param {string} message
   * @param {*} meta Optional metadata
   * @return {Promise<void>}
   */
  async debug(message, meta) {
    if (!this.shouldLog('log')) {
      return;
    }

    await this.initialize_();

    const timestamp = new Date().toISOString();
    const device = os.hostname();
    const formattedMessage = this.formatMessage_(message, meta);

    this.logBuffer_.push({
      timestamp: timestamp,
      level: 'DEBUG',
      device: device,
      message: formattedMessage,
      instanceName: this.instanceName_
    });

    if (this.logBuffer_.length >= this.batchSize_) {
      await this.flushLogs_();
    }

    if (this.eventEmitter_) {
      const eventName = `log:debug:${this.instanceName_}`;
      this.eventEmitter_.emit(eventName, { message: formattedMessage });
    }
  }

  /**
   * Retrieves current settings.
   * @return {Promise<Object>}
   */
  async getSettings() {
    return this.settings;
  }

  /**
   * Updates settings.
   * @param {Object} settings New settings
   * @return {Promise<void>}
   */
  async saveSettings(settings) {
    for (const { setting } of this.settings.list) {
      if (settings[setting] != null) {
        this.settings[setting] = settings[setting];
      }
    }
  }

  /**
   * Flushes any remaining logs on shutdown.
   * @return {Promise<void>}
   */
  async shutdown() {
    if (this.flushTimer_) {
      clearInterval(this.flushTimer_);
    }
    await this.flushLogs_();
  }
}

module.exports = LoggingAzure;
