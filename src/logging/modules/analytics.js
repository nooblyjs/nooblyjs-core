/**
 * @fileoverview Logging Analytics Module
 * Captures and stores the last 1000 log entries in memory for analytics purposes.
 * Provides methods to retrieve logs filtered by level in descending order.
 *
 * @author NooblyJS Core Team
 * @version 1.0.14
 * @since 1.0.14
 */

'use strict';

/**
 * A class that captures and stores log entries for analytics.
 * Maintains a rolling buffer of the last 1000 log entries.
 * @class
 */
class LogAnalytics {
  /**
   * Initializes the log analytics module.
   * @param {EventEmitter} eventEmitter - Event emitter to listen for log events.
   */
  constructor(eventEmitter) {
    /** @private @const {number} Maximum number of logs to store */
    this.MAX_LOGS_ = 1000;

    /** @private {Array<Object>} Circular buffer storing log entries */
    this.logs_ = [];

    /** @private @const {EventEmitter} */
    this.eventEmitter_ = eventEmitter;

    // Set up event listeners for different log levels
    this.initializeListeners_();
  }

  /**
   * Initializes event listeners for all log levels.
   * @private
   */
  initializeListeners_() {
    if (!this.eventEmitter_) {
      return;
    }

    // Listen for info logs
    this.eventEmitter_.on('log:info', (data) => {
      this.captureLog_('INFO', data.message);
    });

    // Listen for warning logs
    this.eventEmitter_.on('log:warn', (data) => {
      this.captureLog_('WARN', data.message);
    });

    // Listen for error logs
    this.eventEmitter_.on('log:error', (data) => {
      this.captureLog_('ERROR', data.message);
    });

    // Listen for generic logs
    this.eventEmitter_.on('log:log', (data) => {
      this.captureLog_('LOG', data.message);
    });
  }

  /**
   * Captures a log entry and adds it to the rolling buffer.
   * Maintains only the last MAX_LOGS_ entries.
   * @private
   * @param {string} level - The log level (INFO, WARN, ERROR, LOG).
   * @param {string} message - The log message.
   */
  captureLog_(level, message) {
    const logEntry = {
      level: level,
      message: message,
      timestamp: new Date().toISOString(),
      capturedAt: Date.now()
    };

    // Add to the beginning for newest-first ordering
    this.logs_.unshift(logEntry);

    // Maintain max size by removing oldest entries
    if (this.logs_.length > this.MAX_LOGS_) {
      this.logs_.pop();
    }
  }

  /**
   * Retrieves logs filtered by level in descending order (newest to oldest).
   * @param {string=} level - Optional log level to filter by (INFO, WARN, ERROR, LOG).
   *                          If not provided, returns all logs.
   * @return {Array<Object>} Array of log entries matching the criteria.
   */
  list(level) {
    // If no level specified, return all logs
    if (!level) {
      return [...this.logs_];
    }

    // Normalize level to uppercase for comparison
    const normalizedLevel = level.toUpperCase();

    // Filter logs by level
    return this.logs_.filter(log => log.level === normalizedLevel);
  }

  /**
   * Gets the current count of stored logs.
   * @return {number} The number of logs currently stored.
   */
  getCount() {
    return this.logs_.length;
  }

  /**
   * Gets the count of logs by level.
   * @param {string} level - The log level to count.
   * @return {number} The number of logs at the specified level.
   */
  getCountByLevel(level) {
    const normalizedLevel = level.toUpperCase();
    return this.logs_.filter(log => log.level === normalizedLevel).length;
  }

  /**
   * Clears all stored logs.
   * @return {void}
   */
  clear() {
    this.logs_ = [];
  }
}

module.exports = LogAnalytics;
