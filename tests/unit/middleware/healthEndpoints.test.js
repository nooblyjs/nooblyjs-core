/**
 * @fileoverview Unit tests for the health-check HTTP endpoints.
 *
 * Mounts the health-check middleware on a bare Express application and
 * checks /health, /health/live, /health/ready, /health/startup and
 * /health/detailed across the starting, ready and degraded states, plus the
 * manager's per-service error tracking.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const request = require('supertest');

const { createHealthCheckMiddleware, HealthCheckManager } = require('../../../src/middleware/healthCheck');

describe('Health endpoints', () => {
  let app;
  let manager;
  let dbHealthy;

  beforeEach(() => {
    dbHealthy = true;
    app = express();
    manager = createHealthCheckMiddleware({
      logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      criticalDependencies: ['db'],
      dependencyCheckers: { db: async () => dbHealthy }
    })(app);
  });

  /** Pretends the process has been up for a while. */
  const age = () => { manager.startTime = Date.now() - 10000; };

  it('reports starting during the first second', async () => {
    const res = await request(app).get('/health').expect(503);
    expect(res.body.status).toBe('starting');
  });

  it('reports healthy, then critical when dependencies fail', async () => {
    age();
    const ok = await request(app).get('/health').expect(200);
    expect(ok.body.status).toBe('healthy');
    manager.criticalServicesHealthy = false;
    const bad = await request(app).get('/health').expect(503);
    expect(bad.body.status).toBe('critical');
  });

  it('always answers the liveness probe', async () => {
    const res = await request(app).get('/health/live').expect(200);
    expect(res.body.status).toBe('alive');
  });

  it('gates readiness on initialisation and dependencies', async () => {
    const starting = await request(app).get('/health/ready').expect(503);
    expect(starting.body.reason).toBe('Initialization in progress');

    manager.markReady();
    const ready = await request(app).get('/health/ready').expect(200);
    expect(ready.body.dependencies).toBe(1);

    dbHealthy = false;
    const unhealthy = await request(app).get('/health/ready').expect(503);
    expect(unhealthy.body.reason).toBe('Dependencies unhealthy');
  });

  it('reports startup progress', async () => {
    await request(app).get('/health/startup').expect(503);
    manager.markReady();
    const res = await request(app).get('/health/startup').expect(200);
    expect(res.body.status).toBe('started');
  });

  it('returns a detailed report, behind the supplied guard', async () => {
    manager.markReady();
    const res = await request(app).get('/health/detailed').expect(200);
    expect(res.body).toEqual(expect.objectContaining({
      status: 'ready',
      node: expect.objectContaining({ version: process.version }),
      memory: expect.objectContaining({ heapUsedMB: expect.any(Number) }),
      critical: { allHealthy: true, dependenciesCount: 1 }
    }));

    const guarded = express();
    createHealthCheckMiddleware()(guarded, (req, res) => res.status(401).end());
    await request(guarded).get('/health/detailed').expect(401);
  });

  it('returns 500 when the detailed report fails', async () => {
    jest.spyOn(manager, 'getDetailedStatus').mockRejectedValue(new Error('x'));
    await request(app).get('/health/detailed').expect(500);
  });
});

describe('HealthCheckManager service tracking', () => {
  it('degrades a service after more than three errors and recovers on success', async () => {
    const logger = { warn: jest.fn() };
    const mgr = new HealthCheckManager({ logger, dependencies: ['queue'] });
    for (let i = 0; i < 3; i++) mgr.recordServiceError('queue', new Error('x'));
    expect(await mgr.checkService('queue')).toBe(false);
    mgr.recordServiceError('queue', new Error('x'));
    expect(logger.warn).toHaveBeenCalled();
    expect(await mgr.checkService('queue')).toBe(false);
    mgr.recordServiceSuccess('queue');
    expect(await mgr.checkService('queue')).toBe(true);
  });

  it('records checker results against service health', async () => {
    const mgr = new HealthCheckManager({ dependencyCheckers: { a: async () => false } });
    expect(await mgr.checkService('a')).toBe(false);
    expect(mgr.errorCounts.get('a')).toBe(1);
    expect(await mgr.checkService('unknown')).toBe(true);
  });
});
