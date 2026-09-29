/**
 * @fileoverview Unit tests for the caching service REST API.
 *
 * Mounts the memory cache on a bare Express application and exercises the
 * put/get/delete, listing, analytics, instance and settings endpoints,
 * including named-instance routing and error handling.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const request = require('supertest');
const EventEmitter = require('events');

const createCache = require('../../../src/caching');

describe('Caching routes', () => {
  let app;
  let cache;
  let otherCache;
  let eventEmitter;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    eventEmitter = new EventEmitter();
    otherCache = createCache('memory', { instanceName: 'other' }, new EventEmitter());
    const registry = {
      getServiceInstance: jest.fn((service, provider, name) => (name === 'other' ? otherCache : null)),
      listInstances: jest.fn(() => [
        { instanceName: 'default', providerType: 'memory' },
        { instanceName: 'other', providerType: 'memory' }
      ])
    };
    cache = createCache('memory', {
      'express-app': app,
      ServiceRegistry: registry,
      dependencies: { logging: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }
    }, eventEmitter);
  });

  afterEach(() => {
    cache.analytics?.destroy?.();
    otherCache.analytics?.destroy?.();
  });

  it('reports status', async () => {
    const res = await request(app).get('/services/caching/api/status').expect(200);
    expect(res.body).toBe('caching api running');
  });

  it('puts, gets and deletes a value', async () => {
    await request(app).post('/services/caching/api/put/k1').send({ a: 1 }).expect(200);
    const got = await request(app).get('/services/caching/api/get/k1').expect(200);
    expect(got.body).toEqual({ a: 1 });
    await request(app).delete('/services/caching/api/delete/k1').expect(200);
    expect(await cache.get('k1')).toBeFalsy();
  });

  it('routes named-instance requests to that instance', async () => {
    await request(app).post('/services/caching/api/other/put/k2').send({ b: 2 }).expect(200);
    expect(await otherCache.get('k2')).toEqual({ b: 2 });
    expect(await cache.get('k2')).toBeFalsy();

    const got = await request(app).get('/services/caching/api/other/get/k2').expect(200);
    expect(got.body).toEqual({ b: 2 });
    await request(app).get('/services/caching/api/other/list').expect(200);
    await request(app).get('/services/caching/api/other/analytics').expect(200);
    await request(app).delete('/services/caching/api/other/delete/k2').expect(200);
    expect(await otherCache.get('k2')).toBeFalsy();
  });

  it('falls back to the default instance for unknown names', async () => {
    await request(app).post('/services/caching/api/missing/put/k3').send({ c: 3 }).expect(200);
    expect(await cache.get('k3')).toEqual({ c: 3 });
  });

  it('lists instances from the registry without duplicating default', async () => {
    const res = await request(app).get('/services/caching/api/instances').expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.instances.map((i) => i.name)).toEqual(['default', 'other']);
  });

  it('returns analytics and the analytics list', async () => {
    await cache.put('x', 1);
    await cache.get('x');
    await cache.get('nope');
    const res = await request(app).get('/services/caching/api/analytics').expect(200);
    expect(res.body).toEqual(expect.objectContaining({
      stats: expect.any(Object),
      hitDistribution: expect.objectContaining({ labels: expect.arrayContaining(['x']) }),
      keyList: expect.any(Array),
      topMisses: expect.any(Array)
    }));
    const list = await request(app).get('/services/caching/api/list').expect(200);
    expect(list.body.success).toBe(true);
  });

  it('returns 503 when analytics are unavailable', async () => {
    const saved = cache.analytics;
    cache.analytics = null;
    await request(app).get('/services/caching/api/analytics').expect(503);
    cache.analytics = saved;
  });

  it('gets and saves settings', async () => {
    const res = await request(app).get('/services/caching/api/settings').expect(200);
    expect(res.body).toEqual(expect.any(Object));
    await request(app).post('/services/caching/api/settings').send({}).expect(200);
  });

  it('hides internal error messages on provider failure', async () => {
    jest.spyOn(cache, 'put').mockRejectedValue(new Error('secret internals'));
    jest.spyOn(cache, 'delete').mockRejectedValue(new Error('secret internals'));
    jest.spyOn(cache, 'getSettings').mockRejectedValue(new Error('secret internals'));
    const put = await request(app).post('/services/caching/api/put/k').send({}).expect(500);
    expect(JSON.stringify(put.body)).not.toContain('secret internals');
    await request(app).delete('/services/caching/api/delete/k').expect(500);
    await request(app).get('/services/caching/api/settings').expect(500);
  });

  it('rejects over-long keys', async () => {
    await request(app).post(`/services/caching/api/put/${'k'.repeat(600)}`).send({}).expect(400);
  });
});
