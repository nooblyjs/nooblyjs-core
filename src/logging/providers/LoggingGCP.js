/**
 * @fileoverview GCP Cloud Logging provider for NooblyJS Core
 * Sends log messages to Google Cloud Platform's Cloud Logging service.
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const os = require('os');

/**
 * GCP Cloud Logging
 * Integrates with Google Cloud Platform's Cloud Logging for enterprise-grade logging.
 * Uses the @google-cloud/logging SDK for automatic log ingestion and analytics.
 *
 * @class
 */
class LoggingGCP {
  /**
   * Initializes the GCP Cloud Logging provider.
   *
   * @param {Object} options Configuration options
   * @param {string} options.projectId GCP project ID (from env: GOOGLE_CLOUD_PROJECT)
   * @param {string} options.keyFilename Path to GCP service account key file
   * @param {string} options.logName Name of the log in Cloud Logging (default: 'noobly-core-logs')
   * @param {string} options.resource GCP resource type (default: 'global')
   * @param {number} options.batchSize Number of logs to batch before sending (default: 10)
   * @param {number} options.flushInterval Time in ms to auto-flush logs (default: 5000)
   * @param {EventEmitter} eventEmitter Optional event emitter for log events
   */
  constructor(options = {}, eventEmitter) {
    this.settings = {
      description: 'GCP Cloud Logging configuration',
      list: [
        { setting: 'minLogLevel', type: 'list', values: ['error', 'warn', 'info', 'log'] },
        { setting: 'projectId', type: 'string', values: [] },
        { setting: 'logName', type: 'string', values: [] },
        { setting: 'resource', type: 'list', values: ['global', 'gce_instance', 'k8s_cluster', 'cloud_function'] }
      ]
    };

    this.eventEmitter_ = eventEmitter;
    this.instanceName_ = (options && options.instanceName) || 'default';
    this.projectId_ = options.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
    this.keyFilename_ = options.keyFilename || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    this.logName_ = options.logName || 'noobly-core-logs';
    this.resource_ = options.resource || 'global';
    this.batchSize_ = options.batchSize || 10;
    this.flushInterval_ = options.flushInterval || 5000;
    this.logBuffer_ = [];
    this.isInitialized_ = false;
    this.initializationPromise_ = null;

    if (options?.log?.level) {
      this.settings.minLogLevel = options.log.level;
    } else {
      this.settings.minLogLevel = 'info';
    }

    this.settings.projectId = this.projectId_;
    this.settings.logName = this.logName_;
    this.settings.resource = this.resource_;

    // Validate GCP credentials
    this.validateGCPCredentials_();

    // Start flush interval
    this.startFlushInterval_();
  }

  /**
   * Validates that GCP credentials are available.
   * @private
   */
  validateGCPCredentials_() {
    const hasProjectId = this.projectId_;
    const hasCredentials = this.keyFilename_ || process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!hasProjectId) {
      console.warn('GCP Cloud Logging: Missing GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID environment variable');
    }
    if (!hasCredentials) {
      console.warn('GCP Cloud Logging: Missing GOOGLE_APPLICATION_CREDENTIALS environment variable. Application Default Credentials will be used');
    }
  }

  /**
   * Initializes the GCP Cloud Logging client.
   * @private
   * @return {Promise<void>}
   */
  async initialize_() {
    if (this.isInitialized_) {
      return;
    }

    if (this.initializationPromise_) {
      return this.initializationPromise_;
    }

    this.initializationPromise_ = (async () => {
      try {
        // Dynamically require GCP SDK to avoid hard dependency if not installed
        let Logging;
        try {
          const { Logging: LoggingClass } = require('@google-cloud/logging');
          Logging = LoggingClass;
        } catch (err) {
          console.warn('GCP Cloud Logging SDK not installed. Install with: npm install @google-cloud/logging');
          this.isInitialized_ = false;
          return;
        }

        // Initialize the logging client
        const clientOptions = {
          projectId: this.projectId_
        };

        if (this.keyFilename_) {
          clientOptions.keyFilename = this.keyFilename_;
        }

        this.logging_ = new Logging(clientOptions);
        this.log_ = this.logging_.log(this.logName_);

        this.isInitialized_ = true;
      } catch (error) {
        console.warn(`GCP Cloud Logging initialization error: ${error.message}`);
        this.isInitialized_ = false;
      }
    })();

    return this.initializationPromise_;
  }

  /**
   * Sends buffered logs to GCP Cloud Logging.
   * @private
   * @return {Promise<void>}
   */
  async flushLogs_() {
    if (!this.isInitialized_ || this.logBuffer_.length === 0 || !this.log_) {
      return;
    }

    try {
      const entries = this.logBuffer_.map(logEntry => {
        // Build structured log entry
        const metadata = {
          resource: {
            type: this.resource_
          },
          severity: logEntry.severity,
          timestamp: new Date(logEntry.timestamp)
        };

        return this.log_.entry(metadata, logEntry.message);
      });

      // Write entries to Cloud Logging
      await this.log_.write(entries);
      this.logBuffer_ = [];
    } catch (error) {
      console.warn(`Failed to flush logs to GCP Cloud Logging: ${error.message}`);
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
   * Maps log levels to GCP severity levels.
   * @private
   * @param {string} level
   * @returns {string}
   */
  mapToGCPSeverity_(level) {
    const severityMap = {
      'error': 'ERROR',
      'warn': 'WARNING',
      'info': 'INFO',
      'log': 'DEBUG'
    };
    return severityMap[level] || 'DEFAULT';
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
   * Logs an info message to GCP Cloud Logging.
   * @param {string} message
   * @param {*} meta Optional metadata
   * @return {Promise<void>}
   */
  async info(message, meta) {
    if (!this.shouldLog('info')) {
      return;
    }

    await this.initialize_();

    const timestamp = new Date().getTime();
    const device = os.hostname();
    const formattedMessage = this.formatMessage_(message, meta);
    const logMessage = `[${new Date().toISOString()}] INFO - ${device} - ${formattedMessage}`;

    this.logBuffer_.push({
      message: logMessage,
      timestamp: timestamp,
      severity: this.mapToGCPSeverity_('info'),
      level: 'info'
    });

    if (this.logBuffer_.length >= this.batchSize_) {
      await this.flushLogs_();
    }

    if (this.eventEmitter_) {
      const eventName = `log:info:${this.instanceName_}`;
      this.eventEmitter_.emit(eventName, { message: logMessage });
    }
  }

  /**
   * Logs a warning message to GCP Cloud Logging.
   * @param {string} message
   * @param {*} meta Optional metadata
   * @return {Promise<void>}
   */
  async warn(message, meta) {
    if (!this.shouldLog('warn')) {
      return;
    }

    await this.initialize_();

    const timestamp = new Date().getTime();
    const device = os.hostname();
    const formattedMessage = this.formatMessage_(message, meta);
    const logMessage = `[${new Date().toISOString()}] WARN - ${device} - ${formattedMessage}`;

    this.logBuffer_.push({
      message: logMessage,
      timestamp: timestamp,
      severity: this.mapToGCPSeverity_('warn'),
      level: 'warn'
    });

    if (this.logBuffer_.length >= this.batchSize_) {
      await this.flushLogs_();
    }

    if (this.eventEmitter_) {
      const eventName = `log:warn:${this.instanceName_}`;
      this.eventEmitter_.emit(eventName, { message: logMessage });
    }
  }

  /**
   * Logs an error message to GCP Cloud Logging.
   * @param {string} message
   * @param {*} meta Optional metadata
   * @return {Promise<void>}
   */
  async error(message, meta) {
    if (!this.shouldLog('error')) {
      return;
    }

    await this.initialize_();

    const timestamp = new Date().getTime();
    const device = os.hostname();
    const formattedMessage = this.formatMessage_(message, meta);
    const logMessage = `[${new Date().toISOString()}] ERROR - ${device} - ${formattedMessage}`;

    this.logBuffer_.push({
      message: logMessage,
      timestamp: timestamp,
      severity: this.mapToGCPSeverity_('error'),
      level: 'error'
    });

    if (this.logBuffer_.length >= this.batchSize_) {
      await this.flushLogs_();
    }

    if (this.eventEmitter_) {
      const eventName = `log:error:${this.instanceName_}`;
      this.eventEmitter_.emit(eventName, { message: logMessage });
    }
  }

  /**
   * Logs a debug message to GCP Cloud Logging.
   * @param {string} message
   * @param {*} meta Optional metadata
   * @return {Promise<void>}
   */
  async debug(message, meta) {
    if (!this.shouldLog('log')) {
      return;
    }

    await this.initialize_();

    const timestamp = new Date().getTime();
    const device = os.hostname();
    const formattedMessage = this.formatMessage_(message, meta);
    const logMessage = `[${new Date().toISOString()}] DEBUG - ${device} - ${formattedMessage}`;

    this.logBuffer_.push({
      message: logMessage,
      timestamp: timestamp,
      severity: this.mapToGCPSeverity_('log'),
      level: 'log'
    });

    if (this.logBuffer_.length >= this.batchSize_) {
      await this.flushLogs_();
    }

    if (this.eventEmitter_) {
      const eventName = `log:debug:${this.instanceName_}`;
      this.eventEmitter_.emit(eventName, { message: logMessage });
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
    if (this.logging_) {
      await this.logging_.close();
    }
  }
}

module.exports = LoggingGCP;
