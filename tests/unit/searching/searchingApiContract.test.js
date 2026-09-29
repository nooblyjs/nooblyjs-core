/**
 * @fileoverview Contract tests for the searching API provider.
 *
 * Starts a real HTTP server with the default search provider's routes mounted
 * and points the `api` provider at it, so every proxied call is checked
 * against the routes the server actually exposes.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const EventEmitter = require('events');

const createSearch = require('../../../src/searching');
const SearchingApi = require('../../../src/searching/providers/searchingApi');
const analytics = require('../../../src/searching/modules/analytics');

describe('Searching API provider (contract)', () => {
  let server;
  let backend;
  let client;
  let events;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    backend = createSearch('default', { 'express-app': app }, new EventEmitter());
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  });

  afterAll(async () => {
    analytics.clear?.();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async () => {
    events = new EventEmitter();
    jest.spyOn(events, 'emit');
    client = new SearchingApi({ api: `http://127.0.0.1:${server.address().port}` }, events);
    await backend.clearIndex('docs');
  });

  it('adds, searches and removes documents remotely', async () => {
    await client.add('ignored-key', { title: 'hello world' }, 'docs');
    const found = await client.search('hello', 'docs');
    expect(found).toHaveLength(1);
    const posted = await client.search('hello', { containerName: 'docs', limit: 5 });
    expect(posted).toHaveLength(1);
    expect(events.emit).toHaveBeenCalledWith('searching:search', expect.objectContaining({ query: 'hello', count: 1 }));

    expect(await client.remove(found[0].key, 'docs')).toBeTruthy();
  });

  it('handles bulk operations and replace', async () => {
    const added = await client.addAll([{ id: 'a', title: 'alpha' }, { id: 'b', title: 'beta' }], 'docs');
    expect(added).toEqual(expect.objectContaining({ added: 2 }));
    await client.replace({ id: 'b', title: 'gamma' }, 'docs');
    expect((await client.search('gamma', { containerName: 'docs', limit: 5 })).map((r) => r.id)).toEqual(['b']);
    const removed = await client.removeAll(['a'], 'docs');
    expect(removed).toEqual(expect.objectContaining({ removed: 1 }));
  });

  it('suggests terms', async () => {
    await backend.addAll([{ id: 'h', title: 'hello' }], 'docs');
    expect(await client.suggest('hel', { searchContainer: 'docs' })).toEqual(expect.any(Array));
    const auto = await client.autoSuggest('hel', { containerName: 'docs' });
    expect(auto[0].suggestion).toBe('hello');
  });

  it('manages indexes and reads stats and settings', async () => {
    await backend.addAll([{ id: 'x', title: 'one' }], 'docs');
    const indexes = await client.listIndexes();
    expect(JSON.stringify(indexes)).toContain('docs');
    expect((await client.getIndexStats('docs')).size).toBe(1);
    expect(await client.clearIndex('docs')).toBeTruthy();
    expect(await client.getStats()).toEqual(expect.any(Object));
    expect(await client.getSettings()).toEqual(expect.any(Object));
    await client.saveSettings({});
    expect(await client.deleteIndex('docs')).toBeTruthy();
  });

  it('emits an error event and rethrows on transport failure', async () => {
    const down = new SearchingApi({ api: 'http://127.0.0.1:1', timeout: 500 }, events);
    await expect(down.search('x')).rejects.toThrow();
    expect(events.emit).toHaveBeenCalledWith('searching:error', expect.objectContaining({ operation: 'search' }));
  });
});
