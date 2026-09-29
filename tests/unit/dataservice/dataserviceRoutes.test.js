/**
 * @fileoverview Unit tests for the dataservice REST API.
 *
 * Mounts the memory dataservice on a bare Express application and exercises
 * CRUD, find/count, JSON search, analytics and settings endpoints. Also
 * guards the route order: fixed paths such as /settings and
 * /analytics/totals must not be captured by /:container or /:container/:uuid.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const request = require('supertest');
const EventEmitter = require('events');

const createDataService = require('../../../src/dataservice');
const analytics = require('../../../src/dataservice/modules/analytics');

describe('Dataservice routes', () => {
  let app;
  let ds;
  let eventEmitter;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    eventEmitter = new EventEmitter();
    ds = createDataService('memory', { 'express-app': app }, eventEmitter);
    analytics.clear();
  });

  afterEach(() => {
    analytics.clear();
  });

  it('reports status', async () => {
    const res = await request(app).get('/services/dataservice/api/status').expect(200);
    expect(res.body).toBe('dataservice api running');
  });

  it('creates, reads, updates, finds, counts and deletes records', async () => {
    const created = await request(app)
      .post('/services/dataservice/api/users')
      .send({ name: 'Ada', profile: { role: 'admin' } })
      .expect(201);
    const id = created.body.id;
    expect(id).toEqual(expect.any(String));

    await request(app).post('/services/dataservice/api/users').send({ name: 'Bob', profile: { role: 'user' } }).expect(201);

    const got = await request(app).get(`/services/dataservice/api/users/${id}`).expect(200);
    expect(got.body.name).toBe('Ada');

    await request(app).put(`/services/dataservice/api/users/${id}`).send({ name: 'Ada L', profile: { role: 'admin' } }).expect(200);
    const found = await request(app).get('/services/dataservice/api/find/users?q=Ada').expect(200);
    expect(found.body).toHaveLength(1);

    const count = await request(app).get('/services/dataservice/api/count/users').expect(200);
    expect(count.body.count).toBe(2);

    await request(app).delete(`/services/dataservice/api/users/${id}`).expect(200);
    await request(app).get(`/services/dataservice/api/users/${id}`).expect(404);
    await request(app).delete(`/services/dataservice/api/users/${id}`).expect(404);
    await request(app).put(`/services/dataservice/api/users/${id}`).send({}).expect(404);
  });

  it('searches JSON by path and criteria', async () => {
    await request(app).post('/services/dataservice/api/items').send({ kind: 'a', meta: { color: 'red' } }).expect(201);
    await request(app).post('/services/dataservice/api/items').send({ kind: 'b', meta: { color: 'blue' } }).expect(201);

    const byPath = await request(app).get('/services/dataservice/api/jsonFindByPath/items/meta.color/red').expect(200);
    expect(byPath.body).toHaveLength(1);

    const byCriteria = await request(app)
      .post('/services/dataservice/api/jsonFindByCriteria/items')
      .send({ kind: 'b' })
      .expect(200);
    expect(byCriteria.body).toHaveLength(1);

    const jsonFind = await request(app)
      .post('/services/dataservice/api/jsonFind/items')
      .send({ criteria: { 'meta.color': 'blue' } })
      .expect(200);
    expect(jsonFind.body).toHaveLength(1);

    await request(app).post('/services/dataservice/api/jsonFind/items').send({}).expect(400);
  });

  it('serves analytics without the generic routes capturing them', async () => {
    await request(app).post('/services/dataservice/api/things').send({ a: 1 }).expect(201);
    await request(app).get('/services/dataservice/api/analytics').expect(200);
    const totals = await request(app).get('/services/dataservice/api/analytics/totals').expect(200);
    expect(totals.body).toEqual(expect.objectContaining({ adds: expect.any(Number) }));
    const containers = await request(app).get('/services/dataservice/api/analytics/containers?limit=5').expect(200);
    expect(Array.isArray(containers.body)).toBe(true);
    await request(app).delete('/services/dataservice/api/analytics').expect(200);
  });

  it('saves settings instead of storing them as a record', async () => {
    const saveSpy = jest.spyOn(ds, 'saveSettings');
    await request(app).get('/services/dataservice/api/settings').expect(200);
    const res = await request(app).post('/services/dataservice/api/settings').send({}).expect(200);
    expect(res.body).toEqual({ updated: true });
    expect(saveSpy).toHaveBeenCalled();
  });

  it('hides provider failures', async () => {
    const boom = () => Promise.reject(new Error('driver secret'));
    for (const m of ['add', 'find', 'count', 'getByUuid', 'update', 'remove', 'jsonFindByPath', 'jsonFindByCriteria', 'getSettings', 'saveSettings']) {
      jest.spyOn(ds, m).mockImplementation(boom);
    }
    const res = await request(app).post('/services/dataservice/api/c').send({ a: 1 }).expect(500);
    expect(JSON.stringify(res.body)).not.toContain('driver secret');
    await request(app).get('/services/dataservice/api/find/c').expect(500);
    await request(app).get('/services/dataservice/api/count/c').expect(500);
    await request(app).get('/services/dataservice/api/c/1').expect(500);
    await request(app).put('/services/dataservice/api/c/1').send({}).expect(500);
    await request(app).delete('/services/dataservice/api/c/1').expect(500);
    await request(app).get('/services/dataservice/api/jsonFindByPath/c/a/b').expect(500);
    await request(app).post('/services/dataservice/api/jsonFindByCriteria/c').send({ a: 1 }).expect(500);
    await request(app).post('/services/dataservice/api/jsonFind/c').send({ criteria: { a: 1 } }).expect(400);
    await request(app).get('/services/dataservice/api/settings').expect(500);
    await request(app).post('/services/dataservice/api/settings').send({}).expect(500);
  });

  it('applies the auth middleware to data routes', async () => {
    const guarded = express();
    guarded.use(express.json());
    createDataService('memory', {
      'express-app': guarded,
      authMiddleware: (req, res) => res.status(401).json({ error: 'no' })
    }, new EventEmitter());
    await request(guarded).post('/services/dataservice/api/c').send({}).expect(401);
    await request(guarded).get('/services/dataservice/api/c/1').expect(401);
  });
});
