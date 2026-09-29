/**
 * @fileoverview Unit tests for the fetching service REST API.
 *
 * Mounts the node fetching provider on a bare Express application with the
 * outbound fetch stubbed, and exercises the fetch (body and base64 URL),
 * status, analytics, list, settings and cache endpoints.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const request = require('supertest');
const EventEmitter = require('events');

const createFetching = require('../../../src/fetching');

describe('Fetching routes', () => {
  let app;
  let fetching;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    fetching = createFetching('node', { 'express-app': app }, new EventEmitter());
    jest.spyOn(fetching, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: { hello: 'world' },
      json: async () => ({ hello: 'world' }),
      text: async () => '{"hello":"world"}'
    });
  });

  afterEach(() => {
    fetching.analytics?.destroy?.();
    jest.restoreAllMocks();
  });

  it('reports status', async () => {
    await request(app).get('/services/fetching/api/status').expect(200);
  });

  it('fetches a URL from the request body', async () => {
    await request(app)
      .post('/services/fetching/api/fetch')
      .send({ url: 'https://example.test/data', options: { method: 'GET' } })
      .expect(200);
    expect(fetching.fetch).toHaveBeenCalledWith('https://example.test/data', { method: 'GET' });
  });

  it('requires a URL', async () => {
    await request(app).post('/services/fetching/api/fetch').send({}).expect(400);
  });

  it('fetches a base64-encoded URL', async () => {
    const encoded = Buffer.from('https://example.test/x').toString('base64');
    await request(app).get(`/services/fetching/api/fetch/${encodeURIComponent(encoded)}`).expect(200);
    expect(fetching.fetch).toHaveBeenCalledWith('https://example.test/x');
  });

  it('hides fetch failures', async () => {
    fetching.fetch.mockRejectedValue(new Error('upstream secret'));
    const res = await request(app).post('/services/fetching/api/fetch').send({ url: 'https://e.test' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body)).not.toContain('upstream secret');
    const encoded = Buffer.from('https://e.test').toString('base64');
    const res2 = await request(app).get(`/services/fetching/api/fetch/${encodeURIComponent(encoded)}`);
    expect(res2.status).toBeGreaterThanOrEqual(400);
  });

  it('returns analytics and list, or 503 when unavailable', async () => {
    const res = await request(app).get('/services/fetching/api/analytics').expect(200);
    expect(res.body).toEqual(expect.any(Object));
    await request(app).get('/services/fetching/api/list').expect(200);

    const saved = fetching.analytics;
    fetching.analytics = null;
    await request(app).get('/services/fetching/api/analytics').expect(503);
    fetching.analytics = saved;
  });

  it('gets and saves settings', async () => {
    await request(app).get('/services/fetching/api/settings').expect(200);
    await request(app).post('/services/fetching/api/settings').send({}).expect(200);
    jest.spyOn(fetching, 'getSettings').mockRejectedValue(new Error('x'));
    jest.spyOn(fetching, 'saveSettings').mockRejectedValue(new Error('x'));
    await request(app).get('/services/fetching/api/settings').expect(500);
    await request(app).post('/services/fetching/api/settings').send({}).expect(500);
  });

  it('clears the cache', async () => {
    await request(app).delete('/services/fetching/api/cache').expect(200);
    jest.spyOn(fetching, 'clear').mockRejectedValue(new Error('x'));
    await request(app).delete('/services/fetching/api/cache').expect(500);
  });
});
