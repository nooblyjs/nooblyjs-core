/**
 * @fileoverview Unit tests for the working service REST API.
 *
 * Mounts the working routes on a bare Express application against a stub
 * worker and the real analytics module, and exercises run (including error
 * status mapping), stop, history, task lookup, stats, analytics and settings.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const request = require('supertest');
const EventEmitter = require('events');

const registerRoutes = require('../../../src/working/routes');
const WorkingAnalytics = require('../../../src/working/modules/analytics');

describe('Working routes', () => {
  let app;
  let worker;
  let analytics;
  let eventEmitter;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    eventEmitter = new EventEmitter();
    analytics = new WorkingAnalytics(eventEmitter);
    worker = {
      logger: { error: jest.fn() },
      getStatus: jest.fn().mockResolvedValue({ running: 0, queued: 0 }),
      start: jest.fn().mockResolvedValue('task-1'),
      stop: jest.fn().mockResolvedValue(),
      getTaskHistory: jest.fn().mockResolvedValue([{ id: 'task-1' }]),
      getTask: jest.fn(async (id) => (id === 'task-1' ? { id } : null)),
      getSettings: jest.fn().mockResolvedValue({ maxThreads: 4 }),
      saveSettings: jest.fn().mockResolvedValue()
    };
    registerRoutes({ 'express-app': app }, eventEmitter, worker, analytics);
  });

  afterEach(() => {
    analytics.destroy?.();
  });

  it('returns worker status', async () => {
    const res = await request(app).get('/services/working/api/status').expect(200);
    expect(res.body).toEqual({ running: 0, queued: 0 });
  });

  it('queues a task and forwards completion events', async () => {
    const emitted = jest.fn();
    eventEmitter.on('worker-complete', emitted);
    const res = await request(app)
      .post('/services/working/api/run')
      .send({ scriptPath: 'jobs/a.js', data: { x: 1 } })
      .expect(201);
    expect(res.body.taskId).toBe('task-1');
    const callback = worker.start.mock.calls[0][2];
    callback('completed', { ok: true });
    expect(emitted).toHaveBeenCalledWith({ status: 'completed', result: { ok: true } });
  });

  it('requires a scriptPath', async () => {
    await request(app).post('/services/working/api/run').send({}).expect(400);
    await request(app).post('/services/working/api/run').send({ scriptPath: 5 }).expect(400);
  });

  it.each([
    ['Task queue at capacity', 429],
    ['Script not found', 404],
    ['Worker manager stopped', 400],
    ['something unexpected', 500]
  ])('maps "%s" to %i', async (message, status) => {
    worker.start.mockRejectedValue(new Error(message));
    await request(app).post('/services/working/api/run').send({ scriptPath: 'a.js' }).expect(status);
  });

  it('stops the worker manager', async () => {
    await request(app).get('/services/working/api/stop').expect(200);
    expect(worker.stop).toHaveBeenCalled();
  });

  it('returns history with a capped limit', async () => {
    await request(app).get('/services/working/api/history?limit=99999').expect(200);
    expect(worker.getTaskHistory).toHaveBeenCalledWith(1000);
    await request(app).get('/services/working/api/history?limit=abc').expect(200);
    expect(worker.getTaskHistory).toHaveBeenLastCalledWith(100);
  });

  it('looks up a task by id', async () => {
    await request(app).get('/services/working/api/task/task-1').expect(200);
    await request(app).get('/services/working/api/task/nope').expect(404);
  });

  it('returns stats and analytics', async () => {
    eventEmitter.emit('worker:task:queued', { taskId: 't', scriptPath: 'a.js' });
    await request(app).get('/services/working/api/stats').expect(200);
    const res = await request(app).get('/services/working/api/analytics').expect(200);
    expect(res.body).toEqual(expect.any(Object));
    await request(app).get('/services/working/api/analytics/does/not/exist.js').expect(404);
  });

  it('returns analytics for a known script path', async () => {
    jest.spyOn(analytics, 'getTaskAnalyticsByPath').mockReturnValue({ scriptPath: 'a.js', runs: 1 });
    const res = await request(app).get('/services/working/api/analytics/jobs/a.js').expect(200);
    expect(res.body.runs).toBe(1);
    expect(analytics.getTaskAnalyticsByPath).toHaveBeenCalledWith('jobs/a.js');
  });

  it('returns 503 for analytics endpoints without analytics', async () => {
    const bare = express();
    registerRoutes({ 'express-app': bare }, eventEmitter, worker, null);
    await request(bare).get('/services/working/api/stats').expect(503);
    await request(bare).get('/services/working/api/analytics').expect(503);
    await request(bare).get('/services/working/api/analytics/a.js').expect(503);
  });

  it('gets and saves settings', async () => {
    const res = await request(app).get('/services/working/api/settings').expect(200);
    expect(res.body.maxThreads).toBe(4);
    await request(app).post('/services/working/api/settings').send({ maxThreads: 2 }).expect(200);
    expect(worker.saveSettings).toHaveBeenCalledWith({ maxThreads: 2 });
  });

  it('hides unexpected errors behind a generic 500', async () => {
    worker.getStatus.mockRejectedValue(new Error('internal'));
    const res = await request(app).get('/services/working/api/status').expect(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(worker.logger.error).toHaveBeenCalled();
  });

  it('does nothing without an express app or worker', () => {
    expect(registerRoutes({}, eventEmitter, worker, analytics)).toBeUndefined();
    expect(registerRoutes(null, eventEmitter, worker, analytics)).toBeUndefined();
  });
});
