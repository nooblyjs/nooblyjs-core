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
    this.MAX_LOGS_ = 1000;
    this.logs_ = [];
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
   * @param {string=} level - Optional log level to filter by (INFO, WARN, ERROR, LOG). If not provided, returns all logs.
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

  /**
   * Gets statistics about log levels including counts and percentages.
   * @return {Object} Statistics object with counts and percentages for each level.
   */
  getStats() {
    const total = this.logs_.length;

    // Count logs by level
    const counts = {
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      LOG: 0
    };

    this.logs_.forEach(log => {
      if (counts.hasOwnProperty(log.level)) {
        counts[log.level]++;
      }
    });

    // Calculate percentages
    const percentages = {};
    Object.keys(counts).forEach(level => {
      percentages[level] = total > 0 ? ((counts[level] / total) * 100).toFixed(2) : 0;
    });

    return {
      total: total,
      counts: counts,
      percentages: percentages
    };
  }

  /**
   * Gets timeline data showing log activity per minute for each log level.
   * @return {Object} Timeline object with time labels and datasets for each level.
   */
  getTimeline() {
    if (this.logs_.length === 0) {
      return {
        labels: [],
        datasets: {
          INFO: [],
          WARN: [],
          ERROR: [],
          LOG: []
        }
      };
    }

    // Create a map to store counts per minute per level
    const timeMap = new Map();

    // Process each log entry
    this.logs_.forEach(log => {
      const logTime = new Date(log.timestamp);
      // Round down to the nearest minute
      const minuteKey = new Date(logTime.getFullYear(), logTime.getMonth(), logTime.getDate(),
                                 logTime.getHours(), logTime.getMinutes(), 0, 0).getTime();

      if (!timeMap.has(minuteKey)) {
        timeMap.set(minuteKey, {
          INFO: 0,
          WARN: 0,
          ERROR: 0,
          LOG: 0
        });
      }

      const counts = timeMap.get(minuteKey);
      if (counts.hasOwnProperty(log.level)) {
        counts[log.level]++;
      }
    });

    // Sort time keys and create labels
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);
    const labels = sortedTimes.map(time => {
      const date = new Date(time);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    });

    // Create datasets for each level
    const datasets = {
      INFO: sortedTimes.map(time => timeMap.get(time).INFO),
      WARN: sortedTimes.map(time => timeMap.get(time).WARN),
      ERROR: sortedTimes.map(time => timeMap.get(time).ERROR),
      LOG: sortedTimes.map(time => timeMap.get(time).LOG)
    };

    return {
      labels: labels,
      datasets: datasets
    };
  }
}

module.exports = LogAnalytics;
