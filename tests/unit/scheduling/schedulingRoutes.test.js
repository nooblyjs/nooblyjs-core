/**
 * @fileoverview Unit tests for the scheduling service's legacy REST API.
 *
 * Mounts the scheduling routes on a bare Express application against a real
 * scheduler provider and exercises schedule creation (with cron validation and
 * conflict handling), cancellation, lookup, analytics and settings.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const request = require('supertest');
const EventEmitter = require('events');

const SchedulerProvider = require('../../../src/scheduling/providers/scheduling');
const registerRoutes = require('../../../src/scheduling/routes');
const analytics = require('../../../src/scheduling/modules/analytics');

describe('Scheduling routes', () => {
  let app;
  let scheduler;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    const worker = { start: jest.fn() };
    scheduler = new SchedulerProvider({}, new EventEmitter(), worker);
    scheduler.logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    registerRoutes({ 'express-app': app }, new EventEmitter(), scheduler);
  });

  afterEach(async () => {
    await scheduler.shutdown();
    analytics.clear();
  });

  it('reports status', async () => {
    const res = await request(app).get('/services/scheduling/api/status').expect(200);
    expect(res.body).toBe('scheduling api running');
  });

  it('creates, reads, lists and cancels a cron schedule', async () => {
    const created = await request(app)
      .post('/services/scheduling/api/schedule')
      .send({ task: { scriptPath: 'a.js' }, cron: '0 2 * * *', taskName: 'nightly' })
      .expect(201);
    expect(created.body.taskName).toBe('nightly');

    await request(app)
      .post('/services/scheduling/api/schedule')
      .send({ task: { scriptPath: 'a.js' }, cron: '0 2 * * *', taskName: 'nightly' })
      .expect(409);

    const one = await request(app).get('/services/scheduling/api/schedules/nightly').expect(200);
    expect(one.body).toEqual(expect.objectContaining({ name: 'nightly' }));
    const live = await request(app).get('/services/scheduling/api/schedules/live').expect(200);
    expect(JSON.stringify(live.body)).toContain('nightly');

    await request(app).delete('/services/scheduling/api/cancel/nightly').expect(200);
    await request(app).delete('/services/scheduling/api/cancel/nightly').expect(404);
    await request(app).get('/services/scheduling/api/schedules/nightly').expect(404);
  });

  it('validates schedule input', async () => {
    await request(app).post('/services/scheduling/api/schedule').send({ cron: '* * * * *' }).expect(400);
    await request(app).post('/services/scheduling/api/schedule').send({ task: 'a.js' }).expect(400);
    const bad = await request(app)
      .post('/services/scheduling/api/schedule')
      .send({ task: 'a.js', cron: 'not a cron' })
      .expect(400);
    expect(bad.body.error).toMatch(/Invalid cron/);
  });

  it('returns 500 for unexpected scheduler failures', async () => {
    jest.spyOn(scheduler, 'startCron').mockRejectedValue(new Error('db down'));
    const res = await request(app)
      .post('/services/scheduling/api/schedule')
      .send({ task: 'a.js', cron: '* * * * *' })
      .expect(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(scheduler.logger.error).toHaveBeenCalled();
  });

  it('serves analytics and execution history', async () => {
    analytics.trackScheduleStarted('s1', '* * * * *', 'a.js');
    analytics.trackExecution('s1', 'completed', { ok: true });
    const all = await request(app).get('/services/scheduling/api/analytics').expect(200);
    expect(all.body).toEqual(expect.any(Object));
    await request(app).get('/services/scheduling/api/analytics/totals').expect(200);
    const list = await request(app).get('/services/scheduling/api/analytics/schedules?limit=5').expect(200);
    expect(JSON.stringify(list.body)).toContain('s1');
    await request(app).get('/services/scheduling/api/schedules').expect(200);
    const history = await request(app).get('/services/scheduling/api/executions/s1?limit=5').expect(200);
    expect(history.body).toHaveLength(1);
    await request(app).delete('/services/scheduling/api/analytics').expect(200);
    const after = await request(app).get('/services/scheduling/api/executions/s1').expect(200);
    expect(after.body).toHaveLength(0);
  });

  it('gets and saves settings', async () => {
    await request(app).get('/services/scheduling/api/settings').expect(200);
    await request(app).post('/services/scheduling/api/settings').send({}).expect(200);
  });
});
