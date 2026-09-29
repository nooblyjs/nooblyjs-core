/**
 * @fileoverview Contract tests for the queueing API provider.
 *
 * Starts a real HTTP server with the memory queue's routes mounted and points
 * the `api` provider at it, so the endpoints the proxy calls are checked
 * against the routes the server actually exposes.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const EventEmitter = require('events');

const createQueue = require('../../../src/queueing');

describe('Queueing API provider (contract)', () => {
  let server;
  let backend;
  let client;
  let clientEvents;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    backend = createQueue('memory', { 'express-app': app }, new EventEmitter());
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  });

  afterAll(async () => {
    backend.analytics?.destroy?.();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    clientEvents = new EventEmitter();
    jest.spyOn(clientEvents, 'emit');
    client = createQueue('api', { api: `http://127.0.0.1:${server.address().port}`, apiKey: 'k' }, clientEvents);
  });

  afterEach(async () => {
    client.analytics?.destroy?.();
    await backend.purge('jobs');
  });

  it('enqueues and dequeues through the remote service', async () => {
    await client.enqueue('jobs', { id: 1 });
    expect(await backend.size('jobs')).toBe(1);
    expect(await client.dequeue('jobs')).toEqual({ id: 1 });
    expect(clientEvents.emit).toHaveBeenCalledWith('queue:enqueue:default', expect.objectContaining({ queueName: 'jobs' }));
  });

  it('lists and purges remote queues', async () => {
    await backend.enqueue('jobs', 'a');
    expect(await client.listQueues()).toContain('jobs');
    await client.purge('jobs');
    expect(await backend.size('jobs')).toBe(0);
  });

  it('validates queue names before calling the server', async () => {
    await expect(client.enqueue('', {})).rejects.toThrow('Invalid queue name');
    await expect(client.purge('  ')).rejects.toThrow('Invalid queue name');
  });

  it('surfaces transport errors and emits an error event', async () => {
    const down = createQueue('api', { api: 'http://127.0.0.1:1', timeout: 500 }, clientEvents);
    await expect(down.listQueues()).rejects.toThrow();
    expect(clientEvents.emit).toHaveBeenCalledWith('queue:error:default', expect.objectContaining({ operation: 'listQueues' }));
    down.analytics?.destroy?.();
  });

  it('gets and saves settings locally', async () => {
    const settings = await client.getSettings();
    expect(settings.url).toMatch(/^http:\/\/127\.0\.0\.1/);
    await client.saveSettings({ apikey: 'new' });
    expect((await client.getSettings()).apikey).toBe('new');
  });
});
