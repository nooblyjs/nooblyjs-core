/**
 * @fileoverview Unit tests for the measuring service REST API.
 *
 * Mounts the default measuring service on a bare Express application and
 * exercises the add, list/total/average, analytics summary, metrics and
 * settings endpoints, including input validation and error handling.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const request = require('supertest');
const EventEmitter = require('events');

const createMeasuring = require('../../../src/measuring');

describe('Measuring routes', () => {
  let app;
  let measuring;
  const start = encodeURIComponent(new Date(Date.now() - 60000).toISOString());
  const end = encodeURIComponent(new Date(Date.now() + 60000).toISOString());

  beforeEach(() => {
    app = express();
    app.use(express.json());
    measuring = createMeasuring('default', { 'express-app': app }, new EventEmitter());
  });

  afterEach(() => {
    measuring.analytics?.destroy?.();
  });

  it('reports status', async () => {
    const res = await request(app).get('/services/measuring/api/status').expect(200);
    expect(res.body).toBe('measuring api running');
  });

  it('adds measurements and aggregates them', async () => {
    await request(app).post('/services/measuring/api/add').send({ metric: 'latency', value: 10 }).expect(200);
    await request(app).post('/services/measuring/api/add').send({ metric: 'latency', value: '30' }).expect(200);

    const list = await request(app).get(`/services/measuring/api/list/latency/${start}/${end}`).expect(200);
    expect(list.body).toHaveLength(2);
    const total = await request(app).get(`/services/measuring/api/total/latency/${start}/${end}`).expect(200);
    expect(total.body).toBe(40);
    const avg = await request(app).get(`/services/measuring/api/average/latency/${start}/${end}`).expect(200);
    expect(avg.body).toBe(20);
  });

  it('validates metric and value', async () => {
    await request(app).post('/services/measuring/api/add').send({ value: 1 }).expect(400);
    await request(app).post('/services/measuring/api/add').send({ metric: '  ', value: 1 }).expect(400);
    await request(app).post('/services/measuring/api/add').send({ metric: 'm' }).expect(400);
    await request(app).post('/services/measuring/api/add').send({ metric: 'm', value: 'abc' }).expect(400);
  });

  it('hides provider failures', async () => {
    const boom = () => { throw new Error('secret'); };
    jest.spyOn(measuring, 'add').mockImplementation(boom);
    jest.spyOn(measuring, 'list').mockImplementation(boom);
    jest.spyOn(measuring, 'total').mockImplementation(boom);
    jest.spyOn(measuring, 'average').mockImplementation(boom);
    const res = await request(app).post('/services/measuring/api/add').send({ metric: 'm', value: 1 }).expect(500);
    expect(JSON.stringify(res.body)).not.toContain('secret');
    await request(app).get(`/services/measuring/api/list/m/${start}/${end}`).expect(500);
    await request(app).get(`/services/measuring/api/total/m/${start}/${end}`).expect(500);
    await request(app).get(`/services/measuring/api/average/m/${start}/${end}`).expect(500);
  });

  it('returns the analytics summary with limits', async () => {
    measuring.add('cpu', 5);
    measuring.add('mem', 7);
    const res = await request(app)
      .get('/services/measuring/api/analytics/summary?topLimit=1&recentLimit=1&historyLimit=5')
      .expect(200);
    expect(res.body).toEqual(expect.objectContaining({
      topByActivity: expect.any(Array),
      topByRecency: expect.any(Array),
      recentHistory: expect.any(Array)
    }));
  });

  it('lists metrics from analytics and the provider', async () => {
    measuring.add('cpu', 5);
    const res = await request(app).get('/services/measuring/api/metrics').expect(200);
    expect(JSON.stringify(res.body)).toContain('cpu');
  });

  it('returns 503 for analytics summary without analytics', async () => {
    const bare = express();
    const routes = require('../../../src/measuring/routes');
    routes({ 'express-app': bare }, new EventEmitter(), measuring, null);
    await request(bare).get('/services/measuring/api/analytics/summary').expect(503);
    await request(bare).get('/services/measuring/api/metrics').expect(200);
  });

  it('gets and saves settings', async () => {
    await request(app).get('/services/measuring/api/settings').expect(200);
    await request(app).post('/services/measuring/api/settings').send({}).expect(200);
    jest.spyOn(measuring, 'getSettings').mockRejectedValue(new Error('x'));
    jest.spyOn(measuring, 'saveSettings').mockRejectedValue(new Error('x'));
    await request(app).get('/services/measuring/api/settings').expect(500);
    await request(app).post('/services/measuring/api/settings').send({}).expect(500);
  });
});
