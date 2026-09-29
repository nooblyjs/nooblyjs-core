/**
 * @fileoverview Unit tests for the node (native fetch) and axios fetching
 * providers against a local HTTP server.
 *
 * Covers the SSRF guard, response caching (default and explicit GET, TTL,
 * no-store/no-cache/force-cache, revalidate), request de-duplication,
 * repeated body reads of shared responses, error handling, analytics and
 * settings.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const http = require('node:http');
const EventEmitter = require('events');

const FetchingNode = require('../../../src/fetching/providers/fetchingnode');
const FetchingAxios = require('../../../src/fetching/providers/fetchingaxios');

describe('Fetching providers', () => {
  let server;
  let base;
  let hits;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      hits += 1;
      if (req.url.startsWith('/fail')) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end('{"error":"boom"}');
      }
      if (req.url.startsWith('/slow')) {
        return setTimeout(() => { res.writeHead(200); res.end('{"slow":true}'); }, 50);
      }
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ n: hits, method: req.method, body }));
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => { hits = 0; });

  /** Reads a response body as JSON for either provider. */
  const json = async (res) => (typeof res.json === 'function' ? res.json() : res.data);

  describe.each([
    ['node', FetchingNode],
    ['axios', FetchingAxios]
  ])('%s', (name, Provider) => {
    let fetching;
    let events;

    beforeEach(() => {
      events = new EventEmitter();
      jest.spyOn(events, 'emit');
      fetching = new Provider({ ssrf: { allowPrivateNetworks: true }, cacheTime: 60, timeout: 2000 }, events);
    });

    it('blocks private addresses by default', async () => {
      const guarded = new Provider({}, events);
      await expect(guarded.fetch(`${base}/x`)).rejects.toThrow(/Blocked request/);
    });

    it('caches successful GETs, whether or not the method is explicit', async () => {
      const first = await fetching.fetch(`${base}/a`);
      const second = await fetching.fetch(`${base}/a`);
      const third = await fetching.fetch(`${base}/a`, { method: 'GET' });
      expect(hits).toBe(1);
      // Every caller can read its own copy of the body.
      expect((await json(first)).n).toBe(1);
      expect((await json(second)).n).toBe(1);
      expect((await json(third)).n).toBe(1);
      expect(events.emit).toHaveBeenCalledWith('fetch:cache-hit', expect.objectContaining({ url: `${base}/a` }));
    });

    it('does not cache non-GET requests or no-store, and bypasses the cache for no-cache', async () => {
      await fetching.fetch(`${base}/p`, { method: 'POST', body: JSON.stringify({ a: 1 }) });
      await fetching.fetch(`${base}/p`, { method: 'POST', body: JSON.stringify({ a: 1 }) });
      expect(hits).toBe(2);

      await fetching.fetch(`${base}/ns`, { cache: 'no-store' });
      await fetching.fetch(`${base}/ns`, { cache: 'no-store' });
      expect(hits).toBe(4);

      await fetching.fetch(`${base}/nc`);
      await fetching.fetch(`${base}/nc`, { cache: 'no-cache' });
      expect(hits).toBe(6);
    });

    it('honours revalidate and force-cache', async () => {
      await fetching.fetch(`${base}/r`, { next: { revalidate: 0, tags: ['t'] } });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await fetching.fetch(`${base}/r`, { next: { revalidate: 0, tags: ['t'] } });
      expect(hits).toBe(2);

      await fetching.fetch(`${base}/f`, { cache: 'force-cache' });
      await fetching.fetch(`${base}/f`, { cache: 'force-cache' });
      expect(hits).toBe(3);
    });

    it('de-duplicates concurrent identical requests', async () => {
      const [a, b] = await Promise.all([fetching.fetch(`${base}/slow`), fetching.fetch(`${base}/slow`)]);
      expect(hits).toBe(1);
      expect(await json(a)).toEqual({ slow: true });
      expect(await json(b)).toEqual({ slow: true });
      expect(events.emit).toHaveBeenCalledWith('fetch:dedup-hit', expect.any(Object));
    });

    it('does not cache failed responses', async () => {
      const res = await fetching.fetch(`${base}/fail`, { axiosConfig: { validateStatus: () => true } });
      expect(res.status).toBe(500);
      await fetching.fetch(`${base}/fail`, { axiosConfig: { validateStatus: () => true } });
      expect(hits).toBe(2);
    });

    it('emits fetch:error and tracks errors on network failure', async () => {
      await expect(fetching.fetch('http://127.0.0.1:1/down')).rejects.toThrow();
      expect(events.emit).toHaveBeenCalledWith('fetch:error', expect.objectContaining({ url: 'http://127.0.0.1:1/down' }));
      expect(fetching.getAnalytics()).toEqual([expect.objectContaining({ errors: 1 })]);
    });

    it('tracks analytics, evicts old entries and clears', async () => {
      fetching.maxAnalyticsEntries_ = 1;
      await fetching.fetch(`${base}/one`);
      await fetching.fetch(`${base}/two`);
      expect(fetching.getAnalytics()).toHaveLength(1);
      await fetching.clear();
      expect(fetching.getAnalytics()).toEqual([]);
    });

    it('gets and saves settings', async () => {
      await fetching.saveSettings({ cacheTime: 5, timeout: 100 });
      expect(await fetching.getSettings()).toEqual(expect.objectContaining({ list: expect.any(Array) }));
    });
  });
});
