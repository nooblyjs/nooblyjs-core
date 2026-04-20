/**
 * @fileoverview Audit Logging Module
 * Captures and stores audit entries for all data modifications across services.
 * Provides query capabilities and export functionality for compliance and auditing.
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const crypto = require('crypto');

/**
 * Audit Log class for tracking all data modification operations.
 * Stores detailed information about who performed what action, when, and with what results.
 * @class
 */
class AuditLog {
  /**
   * Initializes the audit log module.
   * @param {Object} options - Configuration options
   * @param {string} [options.storage='memory'] - Storage backend type (memory, file, database)
   * @param {Object} [options.retention] - Retention policy options
   * @param {number} [options.retention.days=90] - Keep audit logs for N days
   * @param {number} [options.maxEntries=10000] - Maximum entries to store in memory
   */
  constructor(options = {}) {
    this.storage = options.storage || 'memory';
    this.logs = [];
    this.maxEntries = options.maxEntries || 10000;
    this.retentionDays = options.retention?.days || 90;
    this.lastCleanupTime = Date.now();
    this.cleanupInterval = 60 * 60 * 1000; // Cleanup every hour
  }

  /**
   * Records an audit entry for an operation.
   * @param {Object} operation - Operation details
   * @param {string} operation.operation - Operation type: CREATE|UPDATE|DELETE|READ
   * @param {string} operation.service - Service name (e.g., 'dataservice', 'caching')
   * @param {string} operation.resourceType - Type of resource modified (e.g., 'user', 'document')
   * @param {string} operation.resourceId - Unique identifier of the resource
   * @param {string} [operation.userId] - User performing the action
   * @param {string} [operation.apiKey] - API key used for the request
   * @param {Object} [operation.before] - Pre-modification state
   * @param {Object} [operation.after] - Post-modification state
   * @param {string} [operation.status='SUCCESS'] - Operation status: SUCCESS|FAILURE
   * @param {string} [operation.errorMessage] - Error message if status is FAILURE
   * @param {number} [operation.duration=0] - Execution time in milliseconds
   * @param {string} [operation.ipAddress] - Client IP address
   * @param {string} [operation.userAgent] - Client user agent string
   * @return {string} Unique audit entry ID
   */
  record(operation) {
    const {
      operation: operationType,
      service,
      resourceType,
      resourceId,
      userId = 'anonymous',
      apiKey = null,
      before = null,
      after = null,
      status = 'SUCCESS',
      errorMessage = null,
      duration = 0,
      ipAddress = null,
      userAgent = null
    } = operation;

    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      timestampMs: Date.now(),
      service,
      operation: operationType,
      resourceType,
      resourceId,
      userId,
      apiKey: apiKey ? this.maskApiKey_(apiKey) : null,
      before,
      after,
      status,
      errorMessage,
      duration,
      ipAddress,
      userAgent
    };

    this.logs.push(entry);

    // Maintain max size
    if (this.logs.length > this.maxEntries) {
      this.logs.shift();
    }

    // Periodic cleanup of old entries
    if (Date.now() - this.lastCleanupTime > this.cleanupInterval) {
      this.purgeOldEntries_();
    }

    return entry.id;
  }

  /**
   * Queries audit logs with optional filtering.
   * @param {Object} filters - Query filters
   * @param {string} [filters.service] - Filter by service name
   * @param {string} [filters.operation] - Filter by operation type
   * @param {string} [filters.userId] - Filter by user ID
   * @param {string} [filters.resourceType] - Filter by resource type
   * @param {string} [filters.status] - Filter by status (SUCCESS|FAILURE)
   * @param {Date} [filters.since] - Include entries since this date
   * @param {Date} [filters.until] - Include entries until this date
   * @param {number} [filters.limit=100] - Maximum results to return
   * @return {Array} Array of audit log entries matching filters
   */
  query(filters = {}) {
    let results = [...this.logs];

    if (filters.service) {
      results = results.filter(l => l.service === filters.service);
    }
    if (filters.operation) {
      results = results.filter(l => l.operation === filters.operation);
    }
    if (filters.userId) {
      results = results.filter(l => l.userId === filters.userId);
    }
    if (filters.resourceType) {
      results = results.filter(l => l.resourceType === filters.resourceType);
    }
    if (filters.status) {
      results = results.filter(l => l.status === filters.status);
    }
    if (filters.since) {
      const sinceTime = typeof filters.since === 'string'
        ? new Date(filters.since).getTime()
        : filters.since.getTime();
      results = results.filter(l => l.timestampMs >= sinceTime);
    }
    if (filters.until) {
      const untilTime = typeof filters.until === 'string'
        ? new Date(filters.until).getTime()
        : filters.until.getTime();
      results = results.filter(l => l.timestampMs <= untilTime);
    }

    const limit = filters.limit || 100;
    return results.reverse().slice(0, limit);
  }

  /**
   * Gets summary statistics for audit logs.
   * @param {Object} filters - Optional filters to apply
   * @return {Object} Statistics object with counts by operation and status
   */
  getStats(filters = {}) {
    const results = this.query(filters);

    const stats = {
      total: results.length,
      byOperation: {},
      byStatus: {},
      byService: {},
      byUser: {},
      failureRate: '0.00'
    };

    let failureCount = 0;

    results.forEach(entry => {
      // Count by operation type
      stats.byOperation[entry.operation] = (stats.byOperation[entry.operation] || 0) + 1;

      // Count by status
      stats.byStatus[entry.status] = (stats.byStatus[entry.status] || 0) + 1;
      if (entry.status === 'FAILURE') {
        failureCount++;
      }

      // Count by service
      stats.byService[entry.service] = (stats.byService[entry.service] || 0) + 1;

      // Count by user
      stats.byUser[entry.userId] = (stats.byUser[entry.userId] || 0) + 1;
    });

    if (results.length > 0) {
      stats.failureRate = ((failureCount / results.length) * 100).toFixed(2);
    }

    return stats;
  }

  /**
   * Exports audit logs in the specified format.
   * @param {string} [format='json'] - Export format: json|csv|jsonl
   * @param {Object} [filters={}] - Optional filters to apply
   * @return {string} Exported data in requested format
   */
  export(format = 'json', filters = {}) {
    const data = this.query(filters);

    switch (format.toLowerCase()) {
      case 'csv':
        return this.toCSV_(data);
      case 'jsonl':
        return this.toJSONL_(data);
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Converts audit logs to CSV format.
   * @private
   * @param {Array} data - Audit log entries
   * @return {string} CSV formatted data
   */
  toCSV_(data) {
    if (data.length === 0) {
      return '';
    }

    const headers = [
      'id', 'timestamp', 'service', 'operation', 'resourceType', 'resourceId',
      'userId', 'status', 'duration', 'ipAddress'
    ];

    const csv = [headers.join(',')];

    data.forEach(entry => {
      const row = [
        entry.id,
        entry.timestamp,
        entry.service,
        entry.operation,
        entry.resourceType,
        entry.resourceId,
        entry.userId,
        entry.status,
        entry.duration,
        entry.ipAddress || ''
      ];

      csv.push(row.map(val => {
        if (typeof val === 'string' && val.includes(',')) {
          return `"${val}"`;
        }
        return val;
      }).join(','));
    });

    return csv.join('\n');
  }

  /**
   * Converts audit logs to JSONL (JSON Lines) format.
   * @private
   * @param {Array} data - Audit log entries
   * @return {string} JSONL formatted data
   */
  toJSONL_(data) {
    return data.map(entry => JSON.stringify(entry)).join('\n');
  }

  /**
   * Purges audit log entries older than the retention period.
   * @private
   * @return {number} Number of entries removed
   */
  purgeOldEntries_() {
    const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;
    const beforeLength = this.logs.length;

    this.logs = this.logs.filter(entry => entry.timestampMs >= cutoffTime);

    this.lastCleanupTime = Date.now();
    const removed = beforeLength - this.logs.length;

    if (removed > 0) {
      this.logs = this.logs.slice(-this.maxEntries);
    }

    return removed;
  }

  /**
   * Masks API key for security (shows only last 4 characters).
   * @private
   * @param {string} apiKey - API key to mask
   * @return {string} Masked API key
   */
  maskApiKey_(apiKey) {
    if (!apiKey || apiKey.length < 4) {
      return '****';
    }
    return '***' + apiKey.slice(-4);
  }

  /**
   * Clears all audit log entries.
   * @return {void}
   */
  clear() {
    this.logs = [];
  }

  /**
   * Gets the total number of audit log entries.
   * @return {number} Number of entries currently stored
   */
  getCount() {
    return this.logs.length;
  }
}

module.exports = AuditLog;
