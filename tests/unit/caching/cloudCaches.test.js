/**
 * @fileoverview Unit tests for the Redis cache provider and its AWS
 * ElastiCache, Azure Cache for Redis and GCP Memorystore subclasses.
 *
 * ioredis is replaced with an in-memory fake that records its constructor
 * options, so the tests cover value round-tripping, option parsing (TLS,
 * auth, connection strings), connection handling, INFO parsing, analytics
 * and settings without a Redis server.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const EventEmitter = require('events');

/** Fake ioredis client backed by a Map. */
class FakeRedis extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.status = 'wait';
    this.store = new Map();
    this.infoText = {};
    this.connector = {};
    FakeRedis.instances.push(this);
  }
  async connect() { this.status = 'ready'; this.emit('ready'); }
  async set(key, value) { this.store.set(key, String(value)); return 'OK'; }
  async setex(key, ttl, value) { this.store.set(key, String(value)); this.lastTtl = ttl; return 'OK'; }
  async get(key) { return this.store.has(key) ? this.store.get(key) : null; }
  async del(key) { this.store.delete(key); return 1; }
  async info(section) {
    if (this.infoError) throw this.infoError;
    return this.infoText[section] || '';
  }
  async cluster() { return 'node1\nnode2\nnode3'; }
  async quit() { this.status = 'end'; }
  async disconnect() { this.status = 'end'; }
}
FakeRedis.instances = [];

// Registered before requiring the providers: this project's Jest config
// disables babel-jest, so jest.mock() is not hoisted.
jest.mock('ioredis', () => FakeRedis);

const CacheRedis = require('../../../src/caching/providers/cachingRedis');
const CacheAWS = require('../../../src/caching/providers/cachingAWS');
const CacheAzure = require('../../../src/caching/providers/cachingAzure');
const CacheGCP = require('../../../src/caching/providers/cachingGCP');
const createCache = require('../../../src/caching');

/** Redis INFO text for the given key/value pairs. */
const info = (pairs) => Object.entries(pairs).map(([k, v]) => `${k}:${v}`).join('\r\n');

describe('CacheRedis', () => {
  let cache;
  let events;

  beforeEach(() => {
    FakeRedis.instances = [];
    events = new EventEmitter();
    jest.spyOn(events, 'emit');
    cache = new CacheRedis({ redisurl: 'redis.test', instanceName: 'r1' }, events);
  });

  it('round-trips strings, objects and arrays', async () => {
    await cache.put('s', 'hello');
    await cache.put('n', '123');
    await cache.put('o', { a: 1 });
    await cache.put('arr', [1, 2]);
    expect(await cache.get('s')).toBe('hello');
    expect(await cache.get('n')).toBe('123');
    expect(await cache.get('o')).toEqual({ a: 1 });
    expect(await cache.get('arr')).toEqual([1, 2]);
    expect(await cache.get('missing')).toBeNull();
    expect(events.emit).toHaveBeenCalledWith('cache:get:r1', expect.objectContaining({ key: 'o', value: { a: 1 } }));
  });

  it('returns malformed JSON-looking strings unchanged', async () => {
    await cache.put('bad', '{not json');
    expect(await cache.get('bad')).toBe('{not json');
  });

  it('uses SETEX when a TTL is given, and deletes', async () => {
    await cache.put('t', 'v', 30);
    expect(FakeRedis.instances[0].lastTtl).toBe(30);
    await cache.delete('t');
    expect(await cache.get('t')).toBeNull();
    expect(events.emit).toHaveBeenCalledWith('cache:delete:r1', expect.objectContaining({ key: 't' }));
  });

  it('validates keys and values', async () => {
    await expect(cache.put('', 'v')).rejects.toThrow('Invalid key');
    await expect(cache.get('  ')).rejects.toThrow('Invalid key');
    await expect(cache.delete(null)).rejects.toThrow('Invalid key');
    await expect(cache.put('k', undefined)).rejects.toThrow('Invalid value');
    expect(events.emit).toHaveBeenCalledWith('cache:validation-error:r1', expect.objectContaining({ method: 'put' }));
  });

  it('connects lazily once and forwards connection events', async () => {
    const client = FakeRedis.instances[0];
    await cache.put('a', 1);
    await cache.put('b', 2);
    expect(client.status).toBe('ready');
    for (const e of ['connect', 'close', 'reconnecting', 'end']) client.emit(e);
    client.emit('error', new Error('boom'));
    expect(events.emit).toHaveBeenCalledWith('redis:connect');
    expect(events.emit).toHaveBeenCalledWith('redis:error', expect.any(Error));
    expect(events.emit).toHaveBeenCalledWith('redis:end');
  });

  it('tracks analytics and exposes settings and connection info', async () => {
    await cache.put('a', 1);
    await cache.get('a');
    expect(cache.getAnalytics()).toEqual([expect.objectContaining({ key: 'a', hits: 2 })]);
    await cache.saveSettings({ redisurl: 'other' });
    expect((await cache.getSettings()).redisurl).toBe('other');
    expect(events.emit).toHaveBeenCalledWith('cache:setting-changed', { setting: 'redisurl', value: 'other' });
    expect(cache.getConnectionInfo()).toEqual(expect.objectContaining({ status: expect.any(String) }));
    expect(FakeRedis.instances[0].options.reconnectOnError(new Error('READONLY replica'))).toBe(true);
    expect(FakeRedis.instances[0].options.reconnectOnError(new Error('other'))).toBe(false);
    await cache.disconnect();
  });

  it('is created by the factory for the redis provider', () => {
    const viaFactory = createCache('redis', { redisurl: 'x' }, new EventEmitter());
    expect(viaFactory).toBeInstanceOf(CacheRedis);
    viaFactory.analytics?.destroy?.();
  });
});

describe('CacheAWS (ElastiCache)', () => {
  beforeEach(() => { FakeRedis.instances = []; });

  it('configures host, port, auth and TLS', () => {
    const cache = new CacheAWS({ elasticacheEndpoint: 'ec.test', elasticachePort: 6380, authToken: 'tok', region: 'eu-west-1' }, new EventEmitter());
    const opts = FakeRedis.instances[0].options;
    expect(opts).toEqual(expect.objectContaining({ host: 'ec.test', port: 6380, password: 'tok' }));
    expect(opts.tls).toEqual({ rejectUnauthorized: true });
    expect(cache.getConnectionInfo()).toEqual(expect.objectContaining({ region: 'eu-west-1' }));

    new CacheAWS({ tls: false }, new EventEmitter());
    expect(FakeRedis.instances[1].options.tls).toBeUndefined();
  });

  it('detects cluster mode from INFO', async () => {
    const events = new EventEmitter();
    jest.spyOn(events, 'emit');
    const cache = new CacheAWS({}, events);
    const client = FakeRedis.instances[0];
    client.infoText.cluster = 'cluster_enabled:1';
    expect(await cache.detectClusterMode()).toEqual(expect.objectContaining({ mode: 'cluster', nodes: 3 }));
    expect(events.emit).toHaveBeenCalledWith('elasticache:cluster-detected', expect.any(Object));

    client.infoText.cluster = 'cluster_enabled:0';
    expect((await cache.detectClusterMode()).mode).toBe('single-node');

    client.infoError = new Error('no INFO');
    expect((await cache.detectClusterMode()).mode).toBe('single-node');
  });

  it('merges Redis INFO stats into analytics and falls back on failure', async () => {
    const cache = new CacheAWS({}, new EventEmitter());
    const client = FakeRedis.instances[0];
    client.infoText.stats = info({ keyspace_hits: 5, keyspace_misses: 2, evicted_keys: 1 });
    const analytics = await cache.getAnalytics();
    expect(analytics).toEqual(expect.objectContaining({ cacheHits: 5, cacheMisses: 2 }));
    client.infoError = new Error('down');
    expect(await cache.getAnalytics()).toEqual(expect.anything());
    expect(await cache.getSettings()).toEqual(expect.any(Object));
  });
});

describe('CacheAzure', () => {
  beforeEach(() => { FakeRedis.instances = []; });

  it('parses a connection string', () => {
    const cache = new CacheAzure({ connectionString: 'my.redis.cache.windows.net:6380,password=secret,ssl=True' }, new EventEmitter());
    const opts = FakeRedis.instances[0].options;
    expect(opts).toEqual(expect.objectContaining({ host: 'my.redis.cache.windows.net', port: 6380, password: 'secret' }));
    expect(opts.tls.servername).toBe('my.redis.cache.windows.net');
    expect(opts.retryStrategy(3)).toBe(150);
    expect(opts.retryStrategy(100)).toBe(2000);
    expect(cache.getConnectionInfo()).toEqual(expect.objectContaining({ provider: 'azure-redis', ssl: true }));
  });

  it('uses explicit options and normalises the tier', () => {
    new CacheAzure({ hostname: 'h', port: 6379, accessKey: 'k', tier: 'basic', ssl: false }, new EventEmitter());
    const opts = FakeRedis.instances[0].options;
    expect(opts).toEqual(expect.objectContaining({ host: 'h', password: 'k', tier: 'premium' }));
    expect(opts.tls).toBeUndefined();
  });

  it('detects the tier, reads analytics and settings', async () => {
    const events = new EventEmitter();
    jest.spyOn(events, 'emit');
    const cache = new CacheAzure({ hostname: 'h' }, events);
    const client = FakeRedis.instances[0];
    client.infoText.memory = info({ maxmemory: 60000000000, used_memory_human: '1G' });
    const tier = await cache.detectCacheTier();
    expect(tier).toEqual(expect.objectContaining({ estimatedTier: 'premium', maxMemory: 60000000000 }));
    expect(events.emit).toHaveBeenCalledWith('azure-redis:tier-detected', expect.any(Object));

    client.infoText.stats = info({ keyspace_hits: 1 });
    expect((await cache.getAnalytics()).cacheHits).toBe(1);
    expect((await cache.getSettings()).azure.hostname).toBe('h');

    client.infoError = new Error('nope');
    expect((await cache.detectCacheTier()).error).toBe('nope');
    expect(await cache.getAnalytics()).toEqual(expect.anything());
  });
});

describe('CacheGCP (Memorystore)', () => {
  beforeEach(() => { FakeRedis.instances = []; });

  it('configures host, port and auth', () => {
    const cache = new CacheGCP({ projectId: 'p', region: 'r', instanceId: 'i', host: '10.0.0.1', port: 6378, authToken: 't' }, new EventEmitter());
    expect(FakeRedis.instances[0].options).toEqual(expect.objectContaining({ host: '10.0.0.1', port: 6378 }));
    expect(cache.getConnectionInfo()).toEqual(expect.objectContaining({ projectId: 'p', region: 'r', instanceId: 'i', authEnabled: true }));
  });

  it('detects configuration, reads analytics and settings', async () => {
    const events = new EventEmitter();
    jest.spyOn(events, 'emit');
    const cache = new CacheGCP({ projectId: 'p' }, events);
    const client = FakeRedis.instances[0];
    client.infoText.server = info({ redis_version: '7.0.0' });
    client.infoText.memory = info({ maxmemory: 1000, used_memory_human: '1M' });
    expect(await cache.detectMemorystoreConfig()).toEqual(expect.any(Object));
    expect(events.emit).toHaveBeenCalledWith('gcp-memorystore:config-detected', expect.any(Object));

    client.infoText.stats = info({ keyspace_misses: 4 });
    expect((await cache.getAnalytics()).cacheMisses).toBe(4);
    expect(await cache.getSettings()).toEqual(expect.any(Object));

    client.infoError = new Error('x');
    expect(await cache.detectMemorystoreConfig()).toEqual(expect.any(Object));
    expect(await cache.getAnalytics()).toEqual(expect.anything());
  });
});
