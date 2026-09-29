/**
 * @fileoverview Unit tests for the queueing service REST API.
 *
 * Mounts the memory queue on a bare Express application and exercises the
 * enqueue/dequeue/size/queues/purge, analytics, instance, settings, script and
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

const createQueue = require('../../../src/queueing');

describe('Queueing routes', () => {
  let app;
  let queue;
  let otherQueue;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    otherQueue = createQueue('memory', { instanceName: 'other' }, new EventEmitter());
    const registry = {
      getServiceInstance: jest.fn((service, provider, name) => (name === 'other' ? otherQueue : null)),
      listInstances: jest.fn(() => [
        { instanceName: 'default', providerType: 'memory' },
        { instanceName: 'other', providerType: 'memory' }
      ])
    };
    queue = createQueue('memory', { 'express-app': app, ServiceRegistry: registry }, new EventEmitter());
  });

  afterEach(() => {
    queue.analytics?.destroy?.();
    otherQueue.analytics?.destroy?.();
  });

  it('reports status', async () => {
    const res = await request(app).get('/services/queueing/api/status').expect(200);
    expect(res.body).toBe('queueing api running');
  });

  it('enqueues, sizes, lists, dequeues and purges', async () => {
    await request(app).post('/services/queueing/api/enqueue/jobs').send({ task: { id: 1 } }).expect(200);
    await request(app).post('/services/queueing/api/enqueue/jobs').send({ task: { id: 2 } }).expect(200);

    const size = await request(app).get('/services/queueing/api/size/jobs').expect(200);
    expect(size.body).toBe(2);

    const queues = await request(app).get('/services/queueing/api/queues').expect(200);
    expect(queues.body).toContain('jobs');

    const task = await request(app).get('/services/queueing/api/dequeue/jobs').expect(200);
    expect(task.body).toEqual({ id: 1 });

    await request(app).delete('/services/queueing/api/purge/jobs').expect(200);
    expect(await queue.size('jobs')).toBe(0);
  });

  it('rejects enqueue without a task', async () => {
    await request(app).post('/services/queueing/api/enqueue/jobs').send({}).expect(400);
  });

  it('routes named-instance requests to that instance', async () => {
    await request(app).post('/services/queueing/api/other/enqueue/q').send({ task: 'a' }).expect(200);
    expect(await otherQueue.size('q')).toBe(1);
    expect(await queue.size('q')).toBe(0);

    const size = await request(app).get('/services/queueing/api/other/size/q').expect(200);
    expect(size.body).toBe(1);
    const queues = await request(app).get('/services/queueing/api/other/queues').expect(200);
    expect(queues.body).toContain('q');
    const task = await request(app).get('/services/queueing/api/other/dequeue/q').expect(200);
    expect(task.body).toBe('a');
    await request(app).delete('/services/queueing/api/other/purge/q').expect(200);
    await request(app).get('/services/queueing/api/other/analytics').expect(200);
  });

  it('hides provider failures', async () => {
    const boom = () => Promise.reject(new Error('broker secret'));
    jest.spyOn(queue, 'enqueue').mockImplementation(boom);
    jest.spyOn(queue, 'dequeue').mockImplementation(boom);
    jest.spyOn(queue, 'size').mockImplementation(boom);
    jest.spyOn(queue, 'listQueues').mockImplementation(boom);
    jest.spyOn(queue, 'purge').mockImplementation(boom);

    const res = await request(app).post('/services/queueing/api/enqueue/jobs').send({ task: 1 }).expect(500);
    expect(JSON.stringify(res.body)).not.toContain('broker secret');
    await request(app).get('/services/queueing/api/dequeue/jobs').expect(500);
    await request(app).get('/services/queueing/api/size/jobs').expect(500);
    await request(app).get('/services/queueing/api/queues').expect(500);
    await request(app).delete('/services/queueing/api/purge/jobs').expect(500);
  });

  it('lists instances', async () => {
    const res = await request(app).get('/services/queueing/api/instances').expect(200);
    expect(res.body.instances.map((i) => i.name)).toEqual(['default', 'other']);
  });

  it('returns analytics, or 503 when unavailable', async () => {
    await queue.enqueue('a', 1);
    const res = await request(app).get('/services/queueing/api/analytics').expect(200);
    expect(res.body).toEqual(expect.any(Object));
    queue.analytics = null;
    await request(app).get('/services/queueing/api/analytics').expect(503);
  });

  it('gets and saves settings', async () => {
    await request(app).get('/services/queueing/api/settings').expect(200);
    await request(app).post('/services/queueing/api/settings').send({}).expect(200);
    jest.spyOn(queue, 'getSettings').mockRejectedValue(new Error('x'));
    jest.spyOn(queue, 'saveSettings').mockRejectedValue(new Error('x'));
    await request(app).get('/services/queueing/api/settings').expect(500);
    await request(app).post('/services/queueing/api/settings').send({}).expect(500);
  });

  it('serves the client script and swagger docs', async () => {
    const script = await request(app).get('/services/queueing/scripts').expect(200);
    expect(script.headers['content-type']).toMatch(/javascript/);
    await request(app).get('/services/queueing/api/swagger/docs.json').expect(200);
  });
});
