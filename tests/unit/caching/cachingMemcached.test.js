/**
 * @fileoverview Unit tests for the Memcached cache provider.
 *
 * memjs is replaced with an in-memory fake, so the tests cover value
 * serialisation, TTLs, validation, analytics, reconnection and settings
 * without a Memcached server.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const EventEmitter = require('events');

const fakeClient = {
  store: new Map(),
  set: jest.fn(async (key, value, opts) => { fakeClient.store.set(key, { value: Buffer.from(value), opts }); return true; }),
  get: jest.fn(async (key) => ({ value: fakeClient.store.has(key) ? fakeClient.store.get(key).value : null })),
  delete: jest.fn(async (key) => fakeClient.store.delete(key)),
  stats: jest.fn(async () => ({ 'localhost:11211': { curr_items: '1' } })),
  close: jest.fn()
};
const create = jest.fn(() => fakeClient);

// Registered before requiring the provider (babel-jest is disabled, so
// jest.mock() is not hoisted).
jest.mock('memjs', () => ({ Client: { create: (...args) => create(...args) } }));

const CacheMemcached = require('../../../src/caching/providers/cachingMemcached');

describe('CacheMemcached', () => {
  let cache;
  let events;

  beforeEach(() => {
    fakeClient.store.clear();
    jest.clearAllMocks();
    events = new EventEmitter();
    jest.spyOn(events, 'emit');
    cache = new CacheMemcached({ memcachedurl: 'mc.test:11211', poolSize: 3, instanceName: 'm1' }, events);
  });

  it('creates the client from the configured URL and options', () => {
    expect(create).toHaveBeenCalledWith('mc.test:11211', expect.objectContaining({ poolSize: 3, timeout: 5000 }));
  });

  it('round-trips objects and strings, with TTLs', async () => {
    await cache.put('o', { a: 1 }, 60);
    await cache.put('s', 'plain');
    expect(fakeClient.set).toHaveBeenCalledWith('o', '{"a":1}', { expires: 60 });
    expect(fakeClient.set).toHaveBeenCalledWith('s', 'plain', { expires: 0 });
    expect(await cache.get('o')).toEqual({ a: 1 });
    expect(await cache.get('s')).toBe('plain');
    expect(await cache.get('missing')).toBeNull();
    expect(events.emit).toHaveBeenCalledWith('cache:put:m1', expect.objectContaining({ key: 'o', ttl: 60 }));
  });

  it('deletes values', async () => {
    await cache.put('d', 'x');
    await cache.delete('d');
    expect(await cache.get('d')).toBeNull();
    expect(events.emit).toHaveBeenCalledWith('cache:delete:m1', expect.objectContaining({ key: 'd' }));
  });

  it('validates keys and values', async () => {
    await expect(cache.put('', 'x')).rejects.toThrow('Invalid key');
    await expect(cache.get(null)).rejects.toThrow('Invalid key');
    await expect(cache.delete(' ')).rejects.toThrow('Invalid key');
    await expect(cache.put('k', undefined)).rejects.toThrow('Invalid value');
  });

  it('marks the connection down on client errors and emits them', async () => {
    fakeClient.set.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(cache.put('k', 'v')).rejects.toThrow('ECONNRESET');
    expect(events.emit).toHaveBeenCalledWith('memcached:error', expect.any(Error));
    expect(cache.getConnectionInfo().isConnected).toBe(false);

    fakeClient.get.mockRejectedValueOnce(new Error('down'));
    await expect(cache.get('k')).rejects.toThrow('down');
    fakeClient.delete.mockRejectedValueOnce(new Error('down'));
    await expect(cache.delete('k')).rejects.toThrow('down');
  });

  it('reconnects on the next operation', async () => {
    cache.isConnected_ = false;
    await cache.put('k', 'v');
    expect(events.emit).toHaveBeenCalledWith('memcached:reconnected');
    expect(cache.getConnectionInfo()).toEqual(expect.objectContaining({ status: 'connected', poolSize: 3 }));
  });

  it('reports stats and ping', async () => {
    expect(await cache.ping()).toBe(true);
    expect(await cache.getStats()).toEqual(expect.any(Object));
    fakeClient.stats.mockRejectedValueOnce(new Error('x'));
    expect(await cache.ping()).toBe(false);
    fakeClient.stats.mockRejectedValueOnce(new Error('x'));
    expect(await cache.getStats()).toBeNull();
    expect(events.emit).toHaveBeenCalledWith('memcached:stats_error', expect.any(Error));
  });

  it('tracks analytics with LRU eviction', async () => {
    cache.maxAnalyticsEntries_ = 2;
    await cache.put('a', 1);
    await cache.put('b', 1);
    await cache.put('c', 1);
    expect(cache.getAnalytics()).toHaveLength(2);
  });

  it('saves settings and disconnects', async () => {
    await cache.saveSettings({ memcachedurl: 'other:1' });
    expect((await cache.getSettings()).memcachedurl).toBe('other:1');
    expect(events.emit).toHaveBeenCalledWith('cache:setting-changed', { setting: 'memcachedurl', value: 'other:1' });
    await cache.disconnect();
    expect(fakeClient.close).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith('memcached:disconnected');
  });
});
