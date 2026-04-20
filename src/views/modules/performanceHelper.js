/**
 * @fileoverview Performance Helper Module
 * Provides utilities for services to mark performance checkpoints and track operation timing.
 * Integrates with the system monitoring module for centralized metrics collection.
 *
 * @author Noobly JS Team
 * @version 1.0.0
 */

'use strict';

const { performance } = require('perf_hooks');
const systemMonitoring = require('./monitoring');

/**
 * Performance Helper Manager
 * Provides convenience methods for services to track operation performance
 */
class PerformanceHelper {
  /**
   * Start tracking an operation
   * Returns a function to call when the operation completes
   *
   * @param {string} operationName - Name of the operation being tracked
   * @param {Object} [metadata] - Optional metadata about the operation
   * @return {Function} A function to call when the operation completes
   *
   * @example
   * const endOperation = performanceHelper.startOperation('cache-get', { key: 'user:123' });
   * // ... perform operation ...
   * endOperation(); // Automatically records the duration
   *
   * @example
   * // With async operations
   * const endOperation = performanceHelper.startOperation('database-query');
   * try {
   *   const result = await db.query();
   *   endOperation();
   *   return result;
   * } catch (error) {
   *   endOperation(error); // Marks failed operations
   *   throw error;
   * }
   */
  startOperation(operationName, metadata = {}) {
    const startTime = performance.now();
    const startMark = `${operationName}-start-${Date.now()}-${Math.random()}`;

    try {
      performance.mark(startMark);
    } catch (e) {
      // Mark may fail in some environments, continue anyway
    }

    return (error = null) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const endMark = startMark.replace('-start-', '-end-');

      try {
        performance.mark(endMark);
        performance.measure(operationName, startMark, endMark);
      } catch (e) {
        // Measurement may fail, continue anyway
      }

      // Record in system monitoring
      const operationKey = error ? `${operationName}:error` : operationName;
      systemMonitoring.recordMark(operationKey, duration);

      return {
        operationName,
        duration: Math.round(duration * 100) / 100,
        metadata,
        error: error ? error.message : null,
        timestamp: Date.now()
      };
    };
  }

  /**
   * Measure a synchronous operation
   * Automatically records duration upon completion
   *
   * @param {string} operationName - Name of the operation
   * @param {Function} fn - Function to execute and measure
   * @param {Object} [metadata] - Optional metadata about the operation
   * @return {*} Result of the function execution
   * @throws {Error} If the function throws, error is recorded and re-thrown
   *
   * @example
   * const result = performanceHelper.measure('json-parse', () => {
   *   return JSON.parse(jsonString);
   * });
   */
  measure(operationName, fn, metadata = {}) {
    const startTime = performance.now();

    try {
      const result = fn();
      const duration = performance.now() - startTime;
      systemMonitoring.recordMark(operationName, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      systemMonitoring.recordMark(`${operationName}:error`, duration);
      throw error;
    }
  }

  /**
   * Measure an asynchronous operation
   * Automatically records duration upon completion or error
   *
   * @param {string} operationName - Name of the operation
   * @param {Function} asyncFn - Async function to execute and measure
   * @param {Object} [metadata] - Optional metadata about the operation
   * @return {Promise<*>} Promise that resolves with the function's result
   *
   * @example
   * const data = await performanceHelper.measureAsync('database-query', async () => {
   *   return await database.find({ id: 123 });
   * }, { collection: 'users' });
   */
  async measureAsync(operationName, asyncFn, metadata = {}) {
    const startTime = performance.now();

    try {
      const result = await asyncFn();
      const duration = performance.now() - startTime;
      systemMonitoring.recordMark(operationName, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      systemMonitoring.recordMark(`${operationName}:error`, duration);
      throw error;
    }
  }

  /**
   * Get statistics for a specific operation
   * Useful for debugging and performance optimization
   *
   * @param {string} operationName - Name of the operation to analyze
   * @return {Object|null} Statistics including min, max, avg, and count, or null if no data
   *
   * @example
   * const stats = performanceHelper.getStats('cache-get');
   * console.log(`Cache get avg: ${stats.avg}ms (${stats.count} operations)`);
   */
  getStats(operationName) {
    return systemMonitoring.getMarkStats(operationName);
  }

  /**
   * Get statistics for all tracked operations
   * Useful for performance dashboards and reports
   *
   * @return {Array<Object>} Array of operation statistics
   *
   * @example
   * const allStats = performanceHelper.getAllStats();
   * allStats.forEach(stat => {
   *   if (stat.avg > 100) {
   *     console.warn(`Slow operation: ${stat.name} avg=${stat.avg}ms`);
   *   }
   * });
   */
  getAllStats() {
    return systemMonitoring.getAllMarkStats();
  }

  /**
   * Create a performance tracker for batch operations
   * Useful for tracking multiple similar operations together
   *
   * @param {string} batchName - Name of the batch operation
   * @return {Object} Batch tracker object with track() method
   *
   * @example
   * const batchTracker = performanceHelper.createBatchTracker('user-bulk-import');
   * for (const user of users) {
   *   const end = batchTracker.track('import-item');
   *   // ... import user ...
   *   end();
   * }
   * const stats = batchTracker.getStats(); // Get aggregated stats
   */
  createBatchTracker(batchName) {
    return {
      batchName,
      items: [],

      /**
       * Track an item in the batch
       * @param {string} [itemName] - Optional specific item operation name
       * @return {Function} End function to call when item completes
       */
      track: (itemName = 'item') => {
        const operationName = `${batchName}:${itemName}`;
        return this.startOperation(operationName);
      },

      /**
       * Get statistics for this batch
       * @return {Object} Aggregated batch statistics
       */
      getStats: () => {
        const baseStats = this.getStats(batchName);
        const itemStats = this.getStats(`${batchName}:item`);

        return {
          batch: baseStats,
          averageItemDuration: itemStats?.avg,
          totalItems: itemStats?.count || 0
        };
      }
    };
  }

  /**
   * Create a performance threshold monitor
   * Alerts when operation duration exceeds a threshold
   *
   * @param {string} operationName - Name of the operation to monitor
   * @param {number} thresholdMs - Threshold duration in milliseconds
   * @param {Function} [onThresholdExceeded] - Optional callback when threshold is exceeded
   * @return {Function} End function that checks threshold and calls callback if needed
   *
   * @example
   * const endWithThreshold = performanceHelper.withThreshold(
   *   'api-request',
   *   500, // Alert if > 500ms
   *   (duration) => logger.warn(`Slow API request: ${duration}ms`)
   * );
   * // ... perform operation ...
   * endWithThreshold();
   */
  withThreshold(operationName, thresholdMs, onThresholdExceeded = null) {
    const end = this.startOperation(operationName);

    return (error = null) => {
      const result = end(error);

      if (result.duration > thresholdMs && onThresholdExceeded) {
        onThresholdExceeded(result.duration, result);
      }

      return result;
    };
  }

  /**
   * Get the current system monitoring instance
   * For advanced use cases where direct access to monitoring is needed
   *
   * @return {Object} SystemMonitoring instance
   */
  getMonitoringInstance() {
    return systemMonitoring;
  }
}

// Create singleton instance
const performanceHelper = new PerformanceHelper();

module.exports = performanceHelper;
