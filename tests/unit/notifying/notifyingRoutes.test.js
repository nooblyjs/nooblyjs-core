/**
 * @fileoverview Unit tests for the notifying service REST API.
 *
 * Mounts the default notifier on a bare Express application and exercises
 * topic, subscribe/unsubscribe, notify, notifications, analytics, instance,
 * settings and Swagger endpoints, including named-instance routing.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const request = require('supertest');
const EventEmitter = require('events');

const createNotifying = require('../../../src/notifying');

describe('Notifying routes', () => {
  let app;
  let notifier;
  let other;
  let registry;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    other = createNotifying('default', { instanceName: 'other' }, new EventEmitter());
    registry = {
      services: new Map([
        ['notifying:default:default', {}],
        ['notifying:default:other', {}],
        ['caching:memory:default', {}]
      ]),
      getServiceInstance: jest.fn((service, provider, name) => (name === 'other' ? other : null))
    };
    notifier = createNotifying('default', {
      'express-app': app,
      ServiceRegistry: registry,
      providerType: 'default'
    }, new EventEmitter());
  });

  afterEach(() => {
    notifier.analytics?.destroy?.();
    other.analytics?.destroy?.();
  });

  it('reports status', async () => {
    const res = await request(app).get('/services/notifying/api/status').expect(200);
    expect(res.body).toBe('notifying api running');
  });

  it('creates a topic, subscribes, notifies and unsubscribes', async () => {
    await request(app).post('/services/notifying/api/topic').send({ topic: 'orders' }).expect(200);
    await request(app)
      .post('/services/notifying/api/subscribe/topic/orders')
      .send({ callbackUrl: 'http://example.test/hook' })
      .expect(200);
    await request(app)
      .post('/services/notifying/api/notify/topic/orders')
      .send({ message: 'order placed' })
      .expect(200);

    const list = await request(app).get('/services/notifying/api/notifications').expect(200);
    expect(list.body.notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ topic: 'orders', message: 'order placed' })
    ]));

    await request(app)
      .post('/services/notifying/api/unsubscribe/topic/orders')
      .send({ callbackUrl: 'http://example.test/hook' })
      .expect(200);
  });

  it('validates required fields', async () => {
    await request(app).post('/services/notifying/api/topic').send({}).expect(400);
    await request(app).post('/services/notifying/api/subscribe/topic/t').send({}).expect(400);
    await request(app).post('/services/notifying/api/unsubscribe/topic/t').send({}).expect(400);
    await request(app).post('/services/notifying/api/notify/topic/t').send({}).expect(400);
  });

  it('routes named-instance requests to that instance', async () => {
    await request(app).post('/services/notifying/api/other/topic').send({ topic: 't' }).expect(200);
    await request(app).post('/services/notifying/api/other/subscribe/topic/t').send({ callbackUrl: 'u' }).expect(200);
    await request(app).post('/services/notifying/api/other/notify/topic/t').send({ message: 'hi' }).expect(200);
    await request(app).post('/services/notifying/api/other/unsubscribe/topic/t').send({ callbackUrl: 'u' }).expect(200);

    const list = await request(app).get('/services/notifying/api/other/notifications').expect(200);
    expect(list.body.notifications).toHaveLength(1);
    const defaultList = await request(app).get('/services/notifying/api/notifications').expect(200);
    expect(defaultList.body.notifications).toHaveLength(0);
  });

  it('hides provider failures', async () => {
    const boom = () => Promise.reject(new Error('internal detail'));
    jest.spyOn(notifier, 'createTopic').mockImplementation(boom);
    jest.spyOn(notifier, 'subscribe').mockImplementation(boom);
    jest.spyOn(notifier, 'unsubscribe').mockImplementation(boom);
    jest.spyOn(notifier, 'notify').mockImplementation(boom);
    jest.spyOn(notifier, 'getNotifications').mockImplementation(() => { throw new Error('internal detail'); });

    const res = await request(app).post('/services/notifying/api/topic').send({ topic: 't' }).expect(500);
    expect(JSON.stringify(res.body)).not.toContain('internal detail');
    await request(app).post('/services/notifying/api/subscribe/topic/t').send({ callbackUrl: 'u' }).expect(500);
    await request(app).post('/services/notifying/api/unsubscribe/topic/t').send({ callbackUrl: 'u' }).expect(500);
    await request(app).post('/services/notifying/api/notify/topic/t').send({ message: 'm' }).expect(500);
    await request(app).get('/services/notifying/api/notifications').expect(500);
  });

  it('serves analytics for default and named instances', async () => {
    await notifier.createTopic('a');
    await notifier.notify('a', 'x');
    const overview = await request(app).get('/services/notifying/api/analytics/overview').expect(200);
    expect(overview.body).toEqual(expect.any(Object));
    await request(app).get('/services/notifying/api/analytics/top-topics?limit=5').expect(200);
    await request(app).get('/services/notifying/api/analytics/topics').expect(200);
    await request(app).get('/services/notifying/api/other/analytics/overview').expect(200);
    await request(app).get('/services/notifying/api/other/analytics/top-topics').expect(200);
    await request(app).get('/services/notifying/api/other/analytics/topics?limit=2').expect(200);
    await request(app).get('/services/notifying/api/default/analytics/overview').expect(200);
  });

  it('returns 500 when analytics throw', async () => {
    const boom = () => { throw new Error('x'); };
    jest.spyOn(notifier.analytics, 'getOverview').mockImplementation(boom);
    jest.spyOn(notifier.analytics, 'getTopTopics').mockImplementation(boom);
    jest.spyOn(notifier.analytics, 'getTopicDetails').mockImplementation(boom);
    await request(app).get('/services/notifying/api/analytics/overview').expect(500);
    await request(app).get('/services/notifying/api/analytics/top-topics').expect(500);
    await request(app).get('/services/notifying/api/analytics/topics').expect(500);
  });

  it('lists instances from the registry', async () => {
    const res = await request(app).get('/services/notifying/api/instances').expect(200);
    expect(res.body.instances).toEqual(['default', 'other']);
  });

  it('lists only the default instance without a registry', async () => {
    const bare = express();
    const n = createNotifying('default', { 'express-app': bare }, new EventEmitter());
    const res = await request(bare).get('/services/notifying/api/instances').expect(200);
    expect(res.body.instances).toEqual(['default']);
    n.analytics?.destroy?.();
  });

  it('gets and saves settings', async () => {
    await request(app).get('/services/notifying/api/settings').expect(200);
    await request(app).post('/services/notifying/api/settings').send({}).expect(200);
    jest.spyOn(notifier, 'getSettings').mockRejectedValue(new Error('x'));
    jest.spyOn(notifier, 'saveSettings').mockRejectedValue(new Error('x'));
    await request(app).get('/services/notifying/api/settings').expect(500);
    await request(app).post('/services/notifying/api/settings').send({}).expect(500);
  });

  it('serves swagger docs', async () => {
    const res = await request(app).get('/services/notifying/api/swagger/docs.json').expect(200);
    expect(res.body).toHaveProperty('paths');
  });
});
