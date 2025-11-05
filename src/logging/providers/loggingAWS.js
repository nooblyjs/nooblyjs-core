/**
 * @fileoverview AWS CloudWatch logging provider for NooblyJS Core
 * Sends log messages to AWS CloudWatch for centralized logging and monitoring.
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const os = require('os');

/**
 * AWS CloudWatch Logger
 * Integrates with AWS CloudWatch Logs service for enterprise-grade logging.
 * Supports batching and automatic log group/stream creation.
 *
 * @class
 */
class LoggingAWS {
  /**
   * Initializes the AWS CloudWatch logger.
   * Requires AWS SDK v3 client for CloudWatch Logs.
   *
   * @param {Object} options Configuration options
   * @param {string} options.region AWS region (default: 'us-east-1')
   * @param {string} options.logGroup CloudWatch log group name
   * @param {string} options.logStream CloudWatch log stream name
   * @param {string} options.accessKeyId AWS access key ID (from env: AWS_ACCESS_KEY_ID)
   * @param {string} options.secretAccessKey AWS secret access key (from env: AWS_SECRET_ACCESS_KEY)
   * @param {number} options.batchSize Number of logs to batch before sending (default: 10)
   * @param {number} options.flushInterval Time in ms to auto-flush logs (default: 5000)
   * @param {EventEmitter} eventEmitter Optional event emitter for log events
   */
  constructor(options = {}, eventEmitter) {
    this.settings = {
      description: 'AWS CloudWatch logging configuration',
      list: [
        { setting: 'minLogLevel', type: 'list', values: ['error', 'warn', 'info', 'log'] },
        { setting: 'region', type: 'string', values: ['us-east-1', 'us-west-2', 'eu-west-1'] },
        { setting: 'logGroup', type: 'string', values: [] },
        { setting: 'logStream', type: 'string', values: [] }
      ]
    };

    this.eventEmitter_ = eventEmitter;
    this.instanceName_ = (options && options.instanceName) || 'default';
    this.region_ = options.region || process.env.AWS_REGION || 'us-east-1';
    this.logGroup_ = options.logGroup || process.env.AWS_LOG_GROUP || 'noobly-core-logs';
    this.logStream_ = options.logStream || process.env.AWS_LOG_STREAM || `app-${this.instanceName_}-${new Date().toISOString().split('T')[0]}`;
    this.batchSize_ = options.batchSize || 10;
    this.flushInterval_ = options.flushInterval || 5000;
    this.logBuffer_ = [];
    this.sequenceToken_ = null;
    this.isInitialized_ = false;
    this.initializationPromise_ = null;

    if (options?.log?.level) {
      this.settings.minLogLevel = options.log.level;
    } else {
      this.settings.minLogLevel = 'info';
    }

    this.settings.region = this.region_;
    this.settings.logGroup = this.logGroup_;
    this.settings.logStream = this.logStream_;

    // Validate AWS credentials
    this.validateAWSCredentials_();

    // Start flush interval
    this.startFlushInterval_();
  }

  /**
   * Validates that AWS credentials are available.
   * @private
   */
  validateAWSCredentials_() {
    const hasAccessKey = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE;
    const hasSecretKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_PROFILE;

    if (!hasAccessKey || !hasSecretKey) {
      console.warn('AWS CloudWatch: Missing credentials. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables, or configure AWS_PROFILE');
    }
  }

  /**
   * Initializes CloudWatch client and ensures log group/stream exist.
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
        // Dynamically require AWS SDK to avoid hard dependency if not installed
        let CloudWatchLogsClient;
        try {
          const { CloudWatchLogsClient: CWL } = require('@aws-sdk/client-cloudwatch-logs');
          CloudWatchLogsClient = CWL;
        } catch (err) {
          console.warn('AWS SDK not installed. Install with: npm install @aws-sdk/client-cloudwatch-logs');
          this.isInitialized_ = false;
          return;
        }

        this.cloudwatchClient_ = new CloudWatchLogsClient({ region: this.region_ });

        // Attempt to create log group
        await this.createLogGroup_();

        // Attempt to create log stream
        await this.createLogStream_();

        this.isInitialized_ = true;
      } catch (error) {
        console.warn(`AWS CloudWatch initialization error: ${error.message}`);
        this.isInitialized_ = false;
      }
    })();

    return this.initializationPromise_;
  }

  /**
   * Creates CloudWatch log group if it doesn't exist.
   * @private
   * @return {Promise<void>}
   */
  async createLogGroup_() {
    if (!this.cloudwatchClient_) return;

    try {
      const { CreateLogGroupCommand, ResourceAlreadyExistsException } = require('@aws-sdk/client-cloudwatch-logs');
      const command = new CreateLogGroupCommand({ logGroupName: this.logGroup_ });
      await this.cloudwatchClient_.send(command);
    } catch (error) {
      // Log group already exists or other error
      if (error.name !== 'ResourceAlreadyExistsException') {
        console.warn(`Failed to create CloudWatch log group: ${error.message}`);
      }
    }
  }

  /**
   * Creates CloudWatch log stream if it doesn't exist.
   * @private
   * @return {Promise<void>}
   */
  async createLogStream_() {
    if (!this.cloudwatchClient_) return;

    try {
      const { CreateLogStreamCommand, ResourceAlreadyExistsException } = require('@aws-sdk/client-cloudwatch-logs');
      const command = new CreateLogStreamCommand({
        logGroupName: this.logGroup_,
        logStreamName: this.logStream_
      });
      await this.cloudwatchClient_.send(command);
    } catch (error) {
      if (error.name !== 'ResourceAlreadyExistsException') {
        console.warn(`Failed to create CloudWatch log stream: ${error.message}`);
      }
    }
  }

  /**
   * Sends buffered logs to CloudWatch.
   * @private
   * @return {Promise<void>}
   */
  async flushLogs_() {
    if (!this.isInitialized_ || this.logBuffer_.length === 0) {
      return;
    }

    try {
      const { PutLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');

      const logEvents = this.logBuffer_.map(log => ({
        message: log.message,
        timestamp: log.timestamp
      }));

      const command = new PutLogEventsCommand({
        logGroupName: this.logGroup_,
        logStreamName: this.logStream_,
        logEvents: logEvents,
        sequenceToken: this.sequenceToken_
      });

      const response = await this.cloudwatchClient_.send(command);
      this.sequenceToken_ = response.nextSequenceToken;
      this.logBuffer_ = [];
    } catch (error) {
      console.warn(`Failed to flush logs to CloudWatch: ${error.message}`);
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
   * Logs an info message to CloudWatch.
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
    const logMessage = `${new Date().toISOString()} - INFO - ${device} - ${formattedMessage}`;

    this.logBuffer_.push({ message: logMessage, timestamp });

    if (this.logBuffer_.length >= this.batchSize_) {
      await this.flushLogs_();
    }

    if (this.eventEmitter_) {
      const eventName = `log:info:${this.instanceName_}`;
      this.eventEmitter_.emit(eventName, { message: logMessage });
    }
  }

  /**
   * Logs a warning message to CloudWatch.
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
    const logMessage = `${new Date().toISOString()} - WARN - ${device} - ${formattedMessage}`;

    this.logBuffer_.push({ message: logMessage, timestamp });

    if (this.logBuffer_.length >= this.batchSize_) {
      await this.flushLogs_();
    }

    if (this.eventEmitter_) {
      const eventName = `log:warn:${this.instanceName_}`;
      this.eventEmitter_.emit(eventName, { message: logMessage });
    }
  }

  /**
   * Logs an error message to CloudWatch.
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
    const logMessage = `${new Date().toISOString()} - ERROR - ${device} - ${formattedMessage}`;

    this.logBuffer_.push({ message: logMessage, timestamp });

    if (this.logBuffer_.length >= this.batchSize_) {
      await this.flushLogs_();
    }

    if (this.eventEmitter_) {
      const eventName = `log:error:${this.instanceName_}`;
      this.eventEmitter_.emit(eventName, { message: logMessage });
    }
  }

  /**
   * Logs a debug message to CloudWatch.
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
    const logMessage = `${new Date().toISOString()} - DEBUG - ${device} - ${formattedMessage}`;

    this.logBuffer_.push({ message: logMessage, timestamp });

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
  }
}

module.exports = LoggingAWS;
