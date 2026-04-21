/**
 * @fileoverview Admin Dashboard Utilities
 * Centralized configuration and control for system administration
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Admin manager for system configuration and control.
 * @class
 */
class AdminManager {
  /**
   * Create a new admin manager.
   * @param {Object} [options={}] - Configuration options
   * @param {Object} [options.monitoringService] - Monitoring service instance
   */
  constructor(options = {}) {
    this.monitoringService = options.monitoringService;
    this.rateLimitPolicies = new Map();
    this.tracingConfig = {
      enabled: true,
      samplingRate: 1.0, // 100% - trace all requests
      excludedPaths: ['/health', '/status', '/public', '/docs'],
      maxTraces: 10000
    };
    this.systemSettings = {
      maintenanceMode: false,
      maintenanceMessage: '',
      maxConcurrentRequests: 1000,
      requestTimeout: 30000,
      cacheEnabled: true,
      logLevel: 'info'
    };
    this.auditLog = [];
    this.configChanges = new Map();
  }

  /**
   * Set a rate limiting policy for an endpoint.
   * @param {string} endpoint - Endpoint path pattern
   * @param {Object} policy - Rate limiting policy
   * @param {number} [policy.requestsPerMinute] - Requests per minute limit
   * @param {number} [policy.requestsPerHour] - Requests per hour limit
   * @param {number} [policy.burstSize] - Burst size allowed
   * @return {Object} Updated policy
   */
  setRateLimitPolicy(endpoint, policy) {
    const timestamp = new Date().toISOString();
    const updatedPolicy = {
      endpoint,
      ...policy,
      createdAt: timestamp,
      lastModified: timestamp
    };

    this.rateLimitPolicies.set(endpoint, updatedPolicy);
    this._logChange('rate-limit-policy', 'set', endpoint, updatedPolicy);

    return updatedPolicy;
  }

  /**
   * Get a rate limiting policy.
   * @param {string} endpoint - Endpoint path pattern
   * @return {Object|null} Rate limiting policy or null
   */
  getRateLimitPolicy(endpoint) {
    return this.rateLimitPolicies.get(endpoint) || null;
  }

  /**
   * Get all rate limiting policies.
   * @return {Array<Object>} All rate limiting policies
   */
  getAllRateLimitPolicies() {
    return Array.from(this.rateLimitPolicies.values());
  }

  /**
   * Delete a rate limiting policy.
   * @param {string} endpoint - Endpoint path pattern
   * @return {boolean} True if deleted, false if not found
   */
  deleteRateLimitPolicy(endpoint) {
    const deleted = this.rateLimitPolicies.delete(endpoint);
    if (deleted) {
      this._logChange('rate-limit-policy', 'delete', endpoint, null);
    }
    return deleted;
  }

  /**
   * Update tracing configuration.
   * @param {Object} config - Tracing configuration
   * @param {boolean} [config.enabled] - Enable/disable tracing
   * @param {number} [config.samplingRate] - Sampling rate (0-1)
   * @param {Array<string>} [config.excludedPaths] - Paths to exclude from tracing
   * @param {number} [config.maxTraces] - Maximum traces to keep
   */
  setTracingConfig(config) {
    const oldConfig = { ...this.tracingConfig };
    this.tracingConfig = { ...this.tracingConfig, ...config };

    if (config.samplingRate !== undefined && (config.samplingRate < 0 || config.samplingRate > 1)) {
      this.tracingConfig.samplingRate = Math.max(0, Math.min(1, config.samplingRate));
    }

    this._logChange('tracing-config', 'update', 'tracing', { from: oldConfig, to: this.tracingConfig });

    return this.tracingConfig;
  }

  /**
   * Get tracing configuration.
   * @return {Object} Current tracing configuration
   */
  getTracingConfig() {
    return { ...this.tracingConfig };
  }

  /**
   * Update system settings.
   * @param {Object} settings - System settings to update
   * @param {boolean} [settings.maintenanceMode] - Enable/disable maintenance mode
   * @param {string} [settings.maintenanceMessage] - Maintenance message
   * @param {number} [settings.maxConcurrentRequests] - Max concurrent requests
   * @param {number} [settings.requestTimeout] - Request timeout (ms)
   * @param {boolean} [settings.cacheEnabled] - Enable/disable caching
   * @param {string} [settings.logLevel] - Log level (debug|info|warn|error)
   */
  setSystemSettings(settings) {
    const oldSettings = { ...this.systemSettings };
    this.systemSettings = { ...this.systemSettings, ...settings };

    // Validate settings
    if (settings.maxConcurrentRequests !== undefined) {
      this.systemSettings.maxConcurrentRequests = Math.max(1, settings.maxConcurrentRequests);
    }
    if (settings.requestTimeout !== undefined) {
      this.systemSettings.requestTimeout = Math.max(100, settings.requestTimeout);
    }

    this._logChange('system-settings', 'update', 'system', { from: oldSettings, to: this.systemSettings });

    return this.systemSettings;
  }

  /**
   * Get system settings.
   * @return {Object} Current system settings
   */
  getSystemSettings() {
    return { ...this.systemSettings };
  }

  /**
   * Enable maintenance mode.
   * @param {string} [message] - Optional maintenance message
   */
  enableMaintenanceMode(message = '') {
    this.setSystemSettings({
      maintenanceMode: true,
      maintenanceMessage: message
    });
  }

  /**
   * Disable maintenance mode.
   */
  disableMaintenanceMode() {
    this.setSystemSettings({
      maintenanceMode: false,
      maintenanceMessage: ''
    });
  }

  /**
   * Check if system is in maintenance mode.
   * @return {boolean} True if in maintenance mode
   */
  isMaintenanceMode() {
    return this.systemSettings.maintenanceMode;
  }

  /**
   * Get audit log entries.
   * @param {Object} [filter={}] - Filter options
   * @param {string} [filter.type] - Filter by change type
   * @param {string} [filter.action] - Filter by action (set|delete|update)
   * @param {number} [filter.limit=100] - Result limit
   * @return {Array<Object>} Audit log entries
   */
  getAuditLog(filter = {}) {
    const { type, action, limit = 100 } = filter;

    let results = this.auditLog.slice();

    if (type) {
      results = results.filter(entry => entry.type === type);
    }
    if (action) {
      results = results.filter(entry => entry.action === action);
    }

    return results.slice(-limit).reverse();
  }

  /**
   * Clear audit log.
   * @param {number} [olderThanMs] - Only clear entries older than this many milliseconds
   */
  clearAuditLog(olderThanMs) {
    if (olderThanMs) {
      const cutoff = Date.now() - olderThanMs;
      this.auditLog = this.auditLog.filter(entry => entry.timestamp > cutoff);
    } else {
      this.auditLog = [];
    }
  }

  /**
   * Get configuration change history.
   * @param {string} [configType] - Filter by configuration type
   * @return {Array<Object>} Change history
   */
  getChangeHistory(configType) {
    if (configType) {
      return (this.configChanges.get(configType) || []).slice();
    }

    const all = [];
    this.configChanges.forEach(changes => {
      all.push(...changes);
    });

    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get system health and status summary.
   * @return {Object} Health status summary
   */
  getHealthSummary() {
    const now = new Date();
    const auditLogSizeKB = JSON.stringify(this.auditLog).length / 1024;

    return {
      status: this.systemSettings.maintenanceMode ? 'maintenance' : 'operational',
      maintenanceMode: this.systemSettings.maintenanceMode,
      timestamp: now.toISOString(),
      uptime: process.uptime ? process.uptime() : 0,
      memoryUsage: process.memoryUsage ? process.memoryUsage() : {},
      configuration: {
        rateLimitPolicies: this.rateLimitPolicies.size,
        tracingEnabled: this.tracingConfig.enabled,
        cachingEnabled: this.systemSettings.cacheEnabled,
        logLevel: this.systemSettings.logLevel
      },
      auditLog: {
        entries: this.auditLog.length,
        sizeKB: Math.round(auditLogSizeKB),
        oldestEntry: this.auditLog.length > 0 ? this.auditLog[0].timestamp : null
      },
      configChanges: {
        total: this.configChanges.size,
        types: Array.from(this.configChanges.keys())
      }
    };
  }

  /**
   * Export admin configuration.
   * @return {Object} Complete admin configuration
   */
  export() {
    return {
      rateLimitPolicies: this.getAllRateLimitPolicies(),
      tracingConfig: this.getTracingConfig(),
      systemSettings: this.getSystemSettings(),
      healthSummary: this.getHealthSummary(),
      auditLog: this.getAuditLog({ limit: 1000 }),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Log a configuration change.
   * @private
   * @param {string} type - Change type (rate-limit-policy, tracing-config, etc.)
   * @param {string} action - Action performed (set, update, delete)
   * @param {string} target - Configuration target
   * @param {Object} details - Change details
   */
  _logChange(type, action, target, details) {
    const entry = {
      type,
      action,
      target,
      details,
      timestamp: Date.now(),
      isoTimestamp: new Date().toISOString()
    };

    this.auditLog.push(entry);

    // Keep change history by type
    if (!this.configChanges.has(type)) {
      this.configChanges.set(type, []);
    }
    this.configChanges.get(type).push(entry);
  }

  /**
   * Reset all admin settings to defaults.
   */
  reset() {
    this.rateLimitPolicies.clear();
    this.tracingConfig = {
      enabled: true,
      samplingRate: 1.0,
      excludedPaths: ['/health', '/status', '/public', '/docs'],
      maxTraces: 10000
    };
    this.systemSettings = {
      maintenanceMode: false,
      maintenanceMessage: '',
      maxConcurrentRequests: 1000,
      requestTimeout: 30000,
      cacheEnabled: true,
      logLevel: 'info'
    };
    this.auditLog = [];
    this.configChanges.clear();
  }
}

module.exports = AdminManager;
