/**
 * @fileoverview Tests for Admin Dashboard Utilities
 */

'use strict';

const AdminManager = require('../../../src/monitoring/utils/adminUtils');

describe('AdminManager', () => {
  let admin;

  beforeEach(() => {
    admin = new AdminManager();
  });

  describe('initialization', () => {
    it('should create admin manager', () => {
      expect(admin).toBeDefined();
      expect(typeof admin.setRateLimitPolicy).toBe('function');
    });

    it('should initialize with default settings', () => {
      expect(admin.systemSettings.logLevel).toBe('info');
      expect(admin.tracingConfig.enabled).toBe(true);
    });

    it('should initialize empty rate limit policies', () => {
      expect(admin.getAllRateLimitPolicies().length).toBe(0);
    });
  });

  describe('rate limit policies', () => {
    it('should set a rate limit policy', () => {
      const policy = {
        requestsPerMinute: 100,
        requestsPerHour: 5000,
        burstSize: 20
      };

      const result = admin.setRateLimitPolicy('/api/users', policy);

      expect(result.endpoint).toBe('/api/users');
      expect(result.requestsPerMinute).toBe(100);
    });

    it('should get a rate limit policy', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });

      const policy = admin.getRateLimitPolicy('/api/users');

      expect(policy).toBeDefined();
      expect(policy.requestsPerMinute).toBe(100);
    });

    it('should return null for non-existent policy', () => {
      const policy = admin.getRateLimitPolicy('/non-existent');

      expect(policy).toBeNull();
    });

    it('should get all policies', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });
      admin.setRateLimitPolicy('/api/orders', { requestsPerMinute: 50 });

      const policies = admin.getAllRateLimitPolicies();

      expect(policies.length).toBe(2);
    });

    it('should delete a rate limit policy', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });

      const deleted = admin.deleteRateLimitPolicy('/api/users');

      expect(deleted).toBe(true);
      expect(admin.getRateLimitPolicy('/api/users')).toBeNull();
    });

    it('should return false when deleting non-existent policy', () => {
      const deleted = admin.deleteRateLimitPolicy('/non-existent');

      expect(deleted).toBe(false);
    });

    it('should update policy with new values', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 200 });

      const policy = admin.getRateLimitPolicy('/api/users');

      expect(policy.requestsPerMinute).toBe(200);
    });
  });

  describe('tracing configuration', () => {
    it('should set tracing config', () => {
      const config = {
        enabled: false,
        samplingRate: 0.5
      };

      const result = admin.setTracingConfig(config);

      expect(result.enabled).toBe(false);
      expect(result.samplingRate).toBe(0.5);
    });

    it('should get tracing config', () => {
      admin.setTracingConfig({ enabled: true, samplingRate: 0.8 });

      const config = admin.getTracingConfig();

      expect(config.enabled).toBe(true);
      expect(config.samplingRate).toBe(0.8);
    });

    it('should clamp sampling rate to 0-1', () => {
      admin.setTracingConfig({ samplingRate: 1.5 });

      const config = admin.getTracingConfig();

      expect(config.samplingRate).toBe(1.0);
    });

    it('should set sampling rate to 0 for negative values', () => {
      admin.setTracingConfig({ samplingRate: -0.5 });

      const config = admin.getTracingConfig();

      expect(config.samplingRate).toBe(0);
    });

    it('should preserve other config when updating', () => {
      admin.setTracingConfig({ excludedPaths: ['/health'] });
      admin.setTracingConfig({ samplingRate: 0.5 });

      const config = admin.getTracingConfig();

      expect(config.excludedPaths).toContain('/health');
      expect(config.samplingRate).toBe(0.5);
    });
  });

  describe('system settings', () => {
    it('should set system settings', () => {
      const settings = {
        maxConcurrentRequests: 500,
        cacheEnabled: false,
        logLevel: 'debug'
      };

      const result = admin.setSystemSettings(settings);

      expect(result.maxConcurrentRequests).toBe(500);
      expect(result.cacheEnabled).toBe(false);
    });

    it('should get system settings', () => {
      admin.setSystemSettings({ logLevel: 'warn' });

      const settings = admin.getSystemSettings();

      expect(settings.logLevel).toBe('warn');
    });

    it('should validate max concurrent requests', () => {
      admin.setSystemSettings({ maxConcurrentRequests: 0 });

      const settings = admin.getSystemSettings();

      expect(settings.maxConcurrentRequests).toBeGreaterThan(0);
    });

    it('should validate request timeout', () => {
      admin.setSystemSettings({ requestTimeout: 50 });

      const settings = admin.getSystemSettings();

      expect(settings.requestTimeout).toBeGreaterThanOrEqual(100);
    });
  });

  describe('maintenance mode', () => {
    it('should enable maintenance mode', () => {
      admin.enableMaintenanceMode('System under maintenance');

      expect(admin.isMaintenanceMode()).toBe(true);
      expect(admin.systemSettings.maintenanceMessage).toBe('System under maintenance');
    });

    it('should disable maintenance mode', () => {
      admin.enableMaintenanceMode();
      admin.disableMaintenanceMode();

      expect(admin.isMaintenanceMode()).toBe(false);
    });

    it('should clear message when disabling maintenance', () => {
      admin.enableMaintenanceMode('Under maintenance');
      admin.disableMaintenanceMode();

      expect(admin.systemSettings.maintenanceMessage).toBe('');
    });
  });

  describe('audit log', () => {
    it('should log configuration changes', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });

      const log = admin.getAuditLog();

      expect(log.length).toBeGreaterThan(0);
      expect(log[0].type).toBe('rate-limit-policy');
      expect(log[0].action).toBe('set');
    });

    it('should filter audit log by type', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });
      admin.setSystemSettings({ logLevel: 'debug' });

      const log = admin.getAuditLog({ type: 'rate-limit-policy' });

      expect(log.every(entry => entry.type === 'rate-limit-policy')).toBe(true);
    });

    it('should filter audit log by action', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });
      admin.deleteRateLimitPolicy('/api/users');

      const log = admin.getAuditLog({ action: 'delete' });

      expect(log.some(entry => entry.action === 'delete')).toBe(true);
    });

    it('should respect audit log limit', () => {
      for (let i = 0; i < 10; i++) {
        admin.setRateLimitPolicy(`/api/endpoint${i}`, { requestsPerMinute: 100 });
      }

      const log = admin.getAuditLog({ limit: 5 });

      expect(log.length).toBeLessThanOrEqual(5);
    });

    it('should clear audit log', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });

      admin.clearAuditLog();

      expect(admin.getAuditLog().length).toBe(0);
    });

    it('should clear old audit log entries', async () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });

      // Clear entries older than 1 second
      await new Promise(resolve => {
        setTimeout(() => {
          admin.setRateLimitPolicy('/api/orders', { requestsPerMinute: 50 });
          admin.clearAuditLog(500); // Clear older than 500ms

          const log = admin.getAuditLog();
          expect(log.length).toBeGreaterThan(0);
          resolve();
        }, 600);
      });
    });
  });

  describe('change history', () => {
    it('should track configuration changes', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });
      admin.setSystemSettings({ logLevel: 'debug' });

      const history = admin.getChangeHistory();

      expect(history.length).toBe(2);
    });

    it('should filter change history by type', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });
      admin.setSystemSettings({ logLevel: 'debug' });

      const history = admin.getChangeHistory('rate-limit-policy');

      expect(history.every(entry => entry.type === 'rate-limit-policy')).toBe(true);
    });
  });

  describe('health summary', () => {
    it('should provide health summary', () => {
      const summary = admin.getHealthSummary();

      expect(summary.status).toBeDefined();
      expect(summary.timestamp).toBeDefined();
      expect(summary.configuration).toBeDefined();
    });

    it('should indicate operational status when not in maintenance', () => {
      admin.disableMaintenanceMode();

      const summary = admin.getHealthSummary();

      expect(summary.status).toBe('operational');
    });

    it('should indicate maintenance status when in maintenance mode', () => {
      admin.enableMaintenanceMode();

      const summary = admin.getHealthSummary();

      expect(summary.status).toBe('maintenance');
    });

    it('should include configuration counts in summary', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });
      admin.setRateLimitPolicy('/api/orders', { requestsPerMinute: 50 });

      const summary = admin.getHealthSummary();

      expect(summary.configuration.rateLimitPolicies).toBe(2);
    });

    it('should include audit log stats', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });

      const summary = admin.getHealthSummary();

      expect(summary.auditLog.entries).toBeGreaterThan(0);
    });
  });

  describe('export', () => {
    it('should export complete configuration', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });
      admin.setTracingConfig({ samplingRate: 0.5 });

      const exported = admin.export();

      expect(exported.rateLimitPolicies).toBeDefined();
      expect(exported.tracingConfig).toBeDefined();
      expect(exported.systemSettings).toBeDefined();
      expect(exported.exportedAt).toBeDefined();
    });

    it('should include health summary in export', () => {
      const exported = admin.export();

      expect(exported.healthSummary).toBeDefined();
      expect(exported.healthSummary.status).toBeDefined();
    });

    it('should include audit log in export', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });

      const exported = admin.export();

      expect(Array.isArray(exported.auditLog)).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all settings', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });
      admin.setSystemSettings({ logLevel: 'debug' });

      admin.reset();

      expect(admin.getAllRateLimitPolicies().length).toBe(0);
      expect(admin.systemSettings.logLevel).toBe('info');
    });

    it('should clear audit log on reset', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });

      admin.reset();

      expect(admin.getAuditLog().length).toBe(0);
    });

    it('should reset to default tracing config', () => {
      admin.setTracingConfig({ enabled: false });

      admin.reset();

      expect(admin.tracingConfig.enabled).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle policy with no limits', () => {
      const policy = {};
      const result = admin.setRateLimitPolicy('/api/test', policy);

      expect(result.endpoint).toBe('/api/test');
    });

    it('should handle multiple policy updates', () => {
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 100 });
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 200 });
      admin.setRateLimitPolicy('/api/users', { requestsPerMinute: 300 });

      const policy = admin.getRateLimitPolicy('/api/users');

      expect(policy.requestsPerMinute).toBe(300);
    });

    it('should handle concurrent policy operations', () => {
      const endpoints = Array.from({ length: 100 }, (_, i) => `/api/endpoint${i}`);

      endpoints.forEach(ep => {
        admin.setRateLimitPolicy(ep, { requestsPerMinute: 100 });
      });

      expect(admin.getAllRateLimitPolicies().length).toBe(100);
    });
  });
});
