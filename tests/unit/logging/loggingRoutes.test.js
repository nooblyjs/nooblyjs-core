/**
 * @fileoverview Unit tests for the logging service REST API.
 *
 * Mounts the memory logger on a bare Express application and exercises the
 * info/warn/error, logs, stats, timeline, instance, settings, script and
 * Swagger endpoints, including named-instance routing and error handling.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const request = require('supertest');
const EventEmitter = require('events');

const createLogger = require('../../../src/logging');

describe('Logging routes', () => {
  let app;
  let logger;
  let otherLogger;
  let eventEmitter;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    eventEmitter = new EventEmitter();
    otherLogger = createLogger('memory', { instanceName: 'other' }, new EventEmitter());
    const registry = {
      getServiceInstance: jest.fn((service, provider, name) => (name === 'other' ? otherLogger : null)),
      listInstances: jest.fn(() => [
        { instanceName: 'default', providerType: 'memory' },
        { instanceName: 'other', providerType: 'memory' }
      ])
    };
    logger = createLogger('memory', { 'express-app': app, ServiceRegistry: registry }, eventEmitter);
  });

  afterEach(() => {
    logger.analytics?.destroy?.();
    otherLogger.analytics?.destroy?.();
  });

  it('reports status', async () => {
    const res = await request(app).get('/services/logging/api/status').expect(200);
    expect(res.body).toBe('logging api running');
  });

  it.each(['info', 'warn', 'error'])('logs %s messages and records them in analytics', async (level) => {
    await request(app).post(`/services/logging/api/${level}`).send({ message: `hello ${level}`, meta: { a: 1 } }).expect(200);
    const logs = await request(app).get(`/services/logging/api/logs?level=${level.toUpperCase()}`).expect(200);
    expect(logs.body.level).toBe(level.toUpperCase());
    expect(logs.body.logs.some((l) => String(l.message).includes(`hello ${level}`))).toBe(true);
  });

  it.each(['info', 'warn', 'error'])('rejects %s without a message', async (level) => {
    await request(app).post(`/services/logging/api/${level}`).send({}).expect(400);
    await request(app).post(`/services/logging/api/other/${level}`).send({}).expect(400);
  });

  it.each(['info', 'warn', 'error'])('routes %s to a named instance', async (level) => {
    const spy = jest.spyOn(otherLogger, level);
    await request(app).post(`/services/logging/api/other/${level}`).send({ message: 'm' }).expect(200);
    expect(spy).toHaveBeenCalledWith('m', undefined);
  });

  it.each(['info', 'warn', 'error'])('hides provider failures from %s', async (level) => {
    jest.spyOn(logger, level).mockRejectedValue(new Error('disk exploded'));
    const res = await request(app).post(`/services/logging/api/${level}`).send({ message: 'm' }).expect(500);
    expect(JSON.stringify(res.body)).not.toContain('disk exploded');
  });

  it('returns stats and timeline, default and per instance', async () => {
    await logger.info('one');
    const stats = await request(app).get('/services/logging/api/stats').expect(200);
    expect(stats.body).toEqual(expect.any(Object));
    await request(app).get('/services/logging/api/timeline').expect(200);
    await request(app).get('/services/logging/api/other/logs').expect(200);
    await request(app).get('/services/logging/api/other/stats').expect(200);
    await request(app).get('/services/logging/api/other/timeline').expect(200);
  });

  it('returns 500 when analytics throw', async () => {
    jest.spyOn(logger.analytics, 'list').mockImplementation(() => { throw new Error('x'); });
    jest.spyOn(logger.analytics, 'getStats').mockImplementation(() => { throw new Error('x'); });
    jest.spyOn(logger.analytics, 'getTimeline').mockImplementation(() => { throw new Error('x'); });
    await request(app).get('/services/logging/api/logs').expect(500);
    await request(app).get('/services/logging/api/stats').expect(500);
    await request(app).get('/services/logging/api/timeline').expect(500);
  });

  it('lists instances', async () => {
    const res = await request(app).get('/services/logging/api/instances').expect(200);
    expect(res.body.instances.map((i) => i.name)).toEqual(['default', 'other']);
  });

  it('gets and saves settings', async () => {
    await request(app).get('/services/logging/api/settings').expect(200);
    await request(app).post('/services/logging/api/settings').send({ loglevel: 'info' }).expect(200);
    jest.spyOn(logger, 'getSettings').mockRejectedValue(new Error('x'));
    jest.spyOn(logger, 'saveSettings').mockRejectedValue(new Error('x'));
    await request(app).get('/services/logging/api/settings').expect(500);
    await request(app).post('/services/logging/api/settings').send({ loglevel: 'info' }).expect(500);
  });

  it('serves the client script and swagger docs', async () => {
    const script = await request(app).get('/services/logging/scripts').expect(200);
    expect(script.headers['content-type']).toMatch(/javascript/);
    const docs = await request(app).get('/services/logging/api/swagger/docs.json').expect(200);
    expect(JSON.parse(docs.text)).toHaveProperty('paths');
  });

  it('applies the auth middleware to the API', async () => {
    const guarded = express();
    guarded.use(express.json());
    const l = createLogger('memory', {
      'express-app': guarded,
      authMiddleware: (req, res) => res.status(401).json({ error: 'no' })
    }, new EventEmitter());
    await request(guarded).get('/services/logging/api/status').expect(401);
    l.analytics?.destroy?.();
  });
});
