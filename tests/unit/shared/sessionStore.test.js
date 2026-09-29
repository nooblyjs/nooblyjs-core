/**
 * @fileoverview Tests for the production session stores (N-4).
 *
 * @author NooblyJS Team
 * @since 1.1.0
 */

'use strict';

const session = require('express-session');
const RedisMock = require('ioredis-mock');
const { createSessionStore } = require('../../../src/shared/utils/sessionStore');

/**
 * Promisifies a callback-style store call.
 *
 * @param {Object} store - Session store
 * @param {string} method - Method name
 * @param {...*} args - Arguments before the callback
 * @return {Promise<*>} Result
 */
function call(store, method, ...args) {
  return new Promise((resolve, reject) => {
    store[method](...args, (err, value) => (err ? reject(err) : resolve(value)));
  });
}

const sess = (maxAgeMs) => ({
  cookie: { originalMaxAge: maxAgeMs, expires: new Date(Date.now() + maxAgeMs) },
  user: 'alice'
});

describe('createSessionStore', () => {
  const saved = { SESSION_REDIS_URL: process.env.SESSION_REDIS_URL, REDIS_URL: process.env.REDIS_URL };
  beforeEach(() => {
    delete process.env.SESSION_REDIS_URL;
    delete process.env.REDIS_URL;
  });
  afterAll(() => Object.assign(process.env, saved));

  describe('memory store', () => {
    let result;
    afterEach(async () => result && result.close());

    it('is used when no Redis URL is configured and is an express-session Store', () => {
      result = createSessionStore(session);
      expect(result.type).toBe('memory');
      expect(result.store).toBeInstanceOf(session.Store);
    });

    it('stores, reads and destroys sessions', async () => {
      result = createSessionStore(session);
      await call(result.store, 'set', 'sid1', sess(60000));
      expect((await call(result.store, 'get', 'sid1')).user).toBe('alice');
      await call(result.store, 'destroy', 'sid1');
      expect(await call(result.store, 'get', 'sid1')).toBeNull();
    });

    it('prunes expired sessions so memory does not grow unbounded', async () => {
      result = createSessionStore(session);
      await call(result.store, 'set', 'old', sess(1));
      await call(result.store, 'set', 'live', sess(60000));
      await new Promise((r) => setTimeout(r, 10));
      expect(result.store.prune()).toBe(1);
      expect(await call(result.store, 'length')).toBe(1);
    });
  });

  describe('redis store', () => {
    let result;
    let client;
    beforeEach(() => {
      client = new RedisMock();
      result = createSessionStore(session, { redisClient: client });
    });
    afterEach(async () => {
      await result.close();
      client.disconnect();
    });

    it('is selected when a Redis client/URL is provided', () => {
      expect(result.type).toBe('redis');
      expect(result.store).toBeInstanceOf(session.Store);
    });

    it('round-trips a session with a TTL', async () => {
      await call(result.store, 'set', 'sid2', sess(60000));
      expect((await call(result.store, 'get', 'sid2')).user).toBe('alice');
      const ttl = await client.pttl('sess:sid2');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60000);
    });

    it('touch extends expiry and destroy removes the key', async () => {
      await call(result.store, 'set', 'sid3', sess(1000));
      await call(result.store, 'touch', 'sid3', sess(60000));
      expect(await client.pttl('sess:sid3')).toBeGreaterThan(1000);
      await call(result.store, 'destroy', 'sid3');
      expect(await call(result.store, 'get', 'sid3')).toBeNull();
    });
  });
});

describe('session store edge cases', () => {
  const { defineStores, ttlFor } = require('../../../src/shared/utils/sessionStore');
  const { PruningMemoryStore, RedisSessionStore } = defineStores(session);

  it('derives TTLs from expires, originalMaxAge or the one-day default', () => {
    expect(ttlFor({ cookie: { expires: new Date(Date.now() - 1000) } })).toBe(1);
    expect(ttlFor({ cookie: { originalMaxAge: 5000 } })).toBe(5000);
    expect(ttlFor({ cookie: { originalMaxAge: -1 } })).toBe(24 * 60 * 60 * 1000);
    expect(ttlFor(null)).toBe(24 * 60 * 60 * 1000);
  });

  it('drops expired entries on read, touches and counts live sessions', async () => {
    const store = new PruningMemoryStore({ pruneIntervalMs: 60000 });
    try {
      await call(store, 'set', 'a', sess(60000));
      await call(store, 'set', 'b', sess(60000));
      store.sessions_.get('b').expiresAt = Date.now() - 1;
      expect(await call(store, 'get', 'b')).toBeNull();
      expect(await call(store, 'get', 'missing')).toBeNull();

      const before = store.sessions_.get('a').expiresAt;
      await call(store, 'touch', 'a', sess(120000));
      expect(store.sessions_.get('a').expiresAt).toBeGreaterThan(before);
      await call(store, 'touch', 'missing', sess(1000));
      expect(await call(store, 'length')).toBe(1);

      store.set('c', sess(1000));
      store.destroy('c');
      store.touch('a', sess(1000));
    } finally {
      store.close();
    }
  });

  it('surfaces Redis errors through the callback', async () => {
    const client = { get: jest.fn().mockRejectedValue(new Error('redis down')) };
    const store = new RedisSessionStore({ client });
    await expect(call(store, 'get', 'x')).rejects.toThrow('redis down');
    store.get('x');
  });

  it('creates and quits its own Redis client from a URL', async () => {
    jest.resetModules();
    const quit = jest.fn(() => Promise.reject(new Error('already closed')));
    const disconnect = jest.fn();
    jest.doMock('ioredis', () => jest.fn().mockImplementation(() => ({ on: jest.fn(), quit, disconnect })));
    const { createSessionStore: create } = require('../../../src/shared/utils/sessionStore');
    const result = create(session, { redisUrl: 'redis://cache.test:6379', logger: { error: jest.fn() } });
    expect(result.type).toBe('redis');
    await result.close();
    expect(quit).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
    jest.dontMock('ioredis');
  });
});
