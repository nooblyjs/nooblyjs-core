/**
 * @fileoverview Tests for Health Check Utility Module
 * Comprehensive test suite for service health checking
 */

'use strict';

const { HealthCheck, createHealthCheckMiddleware } = require('../../../src/appservice/utils/healthCheck');

describe('HealthCheck', () => {
  let healthCheck;

  beforeEach(() => {
    healthCheck = new HealthCheck('test-service', {
      dependencies: ['cache', 'database'],
      checks: {
        memory: async () => ({ status: 'ok' }),
        cpu: async () => ({ status: 'ok' })
      }
    });
  });

  describe('constructor', () => {
    it('should create instance with service name', () => {
      expect(healthCheck.serviceName).toBe('test-service');
    });

    it('should initialize dependencies', () => {
      expect(healthCheck.dependencies).toContain('cache');
      expect(healthCheck.dependencies).toContain('database');
    });

    it('should initialize custom checks', () => {
      expect(Object.keys(healthCheck.customChecks)).toContain('memory');
      expect(Object.keys(healthCheck.customChecks)).toContain('cpu');
    });
  });

  describe('check()', () => {
    it('should return health status', async () => {
      const result = await healthCheck.check();

      expect(result.service).toBe('test-service');
      expect(result.status).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.checks).toBeDefined();
    });

    it('should include basic check', async () => {
      const result = await healthCheck.check();

      expect(result.checks.basic).toBeDefined();
      expect(result.checks.basic.status).toBe('ok');
    });

    it('should check dependencies', async () => {
      const context = { cache: {}, database: {} };
      const result = await healthCheck.check(context);

      expect(result.checks.dependencies).toBeDefined();
      expect(result.checks.dependencies.dependencies).toBeDefined();
    });

    it('should run custom checks', async () => {
      const result = await healthCheck.check();

      expect(result.checks.memory).toBeDefined();
      expect(result.checks.cpu).toBeDefined();
    });

    it('should mark as healthy when all checks pass', async () => {
      const result = await healthCheck.check();

      expect(result.status).toBe('healthy');
    });

    it('should mark as degraded when custom check fails', async () => {
      const check = new HealthCheck('test', {
        checks: {
          failingCheck: async () => ({ status: 'error' })
        }
      });

      const result = await check.check();

      expect(result.status).toBe('degraded');
    });

    it('should calculate uptime', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      const result = await healthCheck.check();

      expect(result.uptime).toBeGreaterThanOrEqual(10);
    });
  });

  describe('getSummary()', () => {
    it('should return summary when check performed', async () => {
      await healthCheck.check();
      const summary = healthCheck.getSummary();

      expect(summary.service).toBe('test-service');
      expect(summary.status).toBeDefined();
      expect(summary.statusCode).toBeDefined();
    });

    it('should return 200 for healthy service', async () => {
      await healthCheck.check();
      const summary = healthCheck.getSummary();

      expect(summary.statusCode).toBe(200);
    });

    it('should return 503 for unhealthy service', async () => {
      const check = new HealthCheck('test', {
        checks: {
          failing: async () => ({ status: 'error' })
        }
      });
      await check.check();
      const summary = check.getSummary();

      expect(summary.statusCode).toBe(503);
    });

    it('should report unknown status if no check performed', () => {
      const check = new HealthCheck('test');
      const summary = check.getSummary();

      expect(summary.status).toBe('unknown');
    });
  });

  describe('isHealthy()', () => {
    it('should return true for healthy service', async () => {
      await healthCheck.check();

      expect(healthCheck.isHealthy()).toBe(true);
    });

    it('should return false for unhealthy service', async () => {
      const check = new HealthCheck('test', {
        checks: {
          failing: async () => ({ status: 'error' })
        }
      });
      await check.check();

      expect(check.isHealthy()).toBe(false);
    });
  });

  describe('isReady()', () => {
    it('should return true for healthy service', async () => {
      await healthCheck.check();

      expect(healthCheck.isReady()).toBe(true);
    });

    it('should return true for degraded service', async () => {
      const check = new HealthCheck('test', {
        checks: {
          degrading: async () => ({ status: 'error' })
        }
      });
      await check.check();

      expect(check.isReady()).toBe(true); // degraded is ready
    });

    it('should return false for unhealthy service', async () => {
      const check = new HealthCheck('test', {
        checks: {
          failing: async () => { throw new Error('Critical failure'); }
        }
      });
      await check.check();

      expect(check.isReady()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle check errors gracefully', async () => {
      const check = new HealthCheck('test', {
        checks: {
          failing: async () => { throw new Error('Check failed'); }
        }
      });

      const result = await check.check();

      expect(result.checks.failing.status).toBe('error');
      expect(result.checks.failing.error).toBeDefined();
    });
  });
});

describe('createHealthCheckMiddleware', () => {
  let app;
  let healthChecks;
  let setupMiddleware;

  beforeEach(() => {
    app = {
      get: jest.fn()
    };

    healthChecks = {
      'service1': new HealthCheck('service1'),
      'service2': new HealthCheck('service2')
    };

    setupMiddleware = createHealthCheckMiddleware({ healthChecks });
  });

  it('should create middleware factory', () => {
    expect(typeof setupMiddleware).toBe('function');
  });

  it('should setup health endpoints', () => {
    const manager = setupMiddleware(app);

    expect(app.get).toHaveBeenCalledWith('/health', expect.any(Function));
    expect(app.get).toHaveBeenCalledWith('/health/live', expect.any(Function));
    expect(app.get).toHaveBeenCalledWith('/health/ready', expect.any(Function));
  });

  it('should return manager with status methods', () => {
    const manager = setupMiddleware(app);

    expect(manager.getStatus).toBeDefined();
    expect(manager.getAllStatus).toBeDefined();
    expect(typeof manager.getStatus).toBe('function');
    expect(typeof manager.getAllStatus).toBe('function');
  });
});
