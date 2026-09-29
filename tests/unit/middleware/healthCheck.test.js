'use strict';

/**
 * @fileoverview Tests for P1-1 — health checks that actually probe dependencies.
 */

const { HealthCheckManager } = require('../../../src/middleware/healthCheck');

describe('P1-1 — HealthCheckManager dependency probing', () => {
  it('reports healthy when all live checkers pass', async () => {
    const mgr = new HealthCheckManager({
      criticalDependencies: ['cache', 'db'],
      dependencyCheckers: {
        cache: async () => true,
        db: async () => true
      }
    });
    expect(await mgr.checkCriticalDependencies()).toBe(true);
    expect(mgr.criticalServicesHealthy).toBe(true);
  });

  it('reports unhealthy when a live checker fails', async () => {
    const mgr = new HealthCheckManager({
      criticalDependencies: ['cache', 'db'],
      dependencyCheckers: {
        cache: async () => true,
        db: async () => false
      }
    });
    expect(await mgr.checkCriticalDependencies()).toBe(false);
    expect(mgr.criticalServicesHealthy).toBe(false);
  });

  it('treats a throwing checker as unhealthy', async () => {
    const mgr = new HealthCheckManager({
      criticalDependencies: ['db'],
      dependencyCheckers: {
        db: async () => { throw new Error('connection refused'); }
      }
    });
    expect(await mgr.checkCriticalDependencies()).toBe(false);
  });

  it('treats a hanging checker as unhealthy (timeout)', async () => {
    const mgr = new HealthCheckManager({
      criticalDependencies: ['db'],
      checkTimeoutMs: 50,
      dependencyCheckers: {
        db: () => new Promise(() => {}) // never resolves
      }
    });
    expect(await mgr.checkService('db')).toBe(false);
  });

  it('fixes the precedence bug: defaults healthy below the error threshold', async () => {
    const mgr = new HealthCheckManager({ criticalDependencies: ['x'] });
    // No checker, no errors → healthy.
    expect(await mgr.checkService('x')).toBe(true);
    // After exceeding the threshold → unhealthy.
    for (let i = 0; i < 4; i++) mgr.recordServiceError('x', new Error('boom'));
    expect(await mgr.checkService('x')).toBe(false);
  });

  it('registerDependencyChecker adds a dependency and checker', async () => {
    const mgr = new HealthCheckManager({});
    mgr.registerDependencyChecker('cache', async () => true);
    expect(mgr.dependencies).toContain('cache');
    expect(await mgr.checkCriticalDependencies()).toBe(true);
  });
});
