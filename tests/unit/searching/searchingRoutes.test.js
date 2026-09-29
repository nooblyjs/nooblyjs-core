/**
 * @fileoverview Unit tests for the searching service REST API.
 *
 * Mounts the default search provider on a bare Express application and
 * exercises add/search/delete, bulk add/replace/delete, index management,
 * suggestions, token stats, analytics, settings and rebuild endpoints,
 * including 501 responses for providers lacking optional features.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const request = require('supertest');
const EventEmitter = require('events');

const createSearch = require('../../../src/searching');
const registerRoutes = require('../../../src/searching/routes');
const analytics = require('../../../src/searching/modules/analytics');

describe('Searching routes', () => {
  let app;
  let search;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    search = createSearch('default', { 'express-app': app }, new EventEmitter());
    analytics.clear?.();
  });

  afterEach(() => {
    search.analytics?.destroy?.();
    analytics.clear?.();
  });

  it('reports status', async () => {
    const res = await request(app).get('/services/searching/api/status').expect(200);
    expect(res.body).toBe('searching api is running');
  });

  it('adds documents and finds them by GET and POST search', async () => {
    await request(app).post('/services/searching/api/add/').send({ title: 'hello world', searchContainer: 'docs' }).expect(200);

    const got = await request(app).get('/services/searching/api/search/hello?searchContainer=docs').expect(200);
    expect(got.body).toHaveLength(1);
    expect(got.body[0].title).toBe('hello world');

    const posted = await request(app).post('/services/searching/api/search/docs').send({ query: 'hello' }).expect(200);
    expect(posted.body).toHaveLength(1);
    await request(app).post('/services/searching/api/search/docs').send({}).expect(400);

    await request(app).delete(`/services/searching/api/delete/${got.body[0].key}?searchContainer=docs`).expect(200);
    await request(app).delete('/services/searching/api/delete/missing').expect(404);
  });

  it('handles bulk add, replace and delete', async () => {
    const added = await request(app)
      .post('/services/searching/api/add-bulk')
      .send({ documents: [{ id: 'd1', title: 'alpha beta' }, { id: 'd2', title: 'gamma' }], searchContainer: 'bulk' })
      .expect(200);
    expect(added.body.added).toBe(2);

    await request(app).post('/services/searching/api/replace?searchContainer=bulk').send({ document: { id: 'd2', title: 'delta' } }).expect(200);
    const replaced = await request(app).post('/services/searching/api/search/bulk').send({ query: 'delta' }).expect(200);
    expect(replaced.body.map((r) => r.id)).toEqual(['d2']);

    const removed = await request(app).post('/services/searching/api/delete-bulk').send({ ids: ['d1'], searchContainer: 'bulk' }).expect(200);
    expect(removed.body.removed).toBe(1);

    await request(app).post('/services/searching/api/add-bulk').send({ documents: 'nope' }).expect(400);
    await request(app).post('/services/searching/api/delete-bulk').send({ ids: 'nope' }).expect(400);
  });

  it('rejects oversized bulk requests', async () => {
    const previous = process.env.SEARCH_MAX_BULK_DOCUMENTS;
    process.env.SEARCH_MAX_BULK_DOCUMENTS = '2';
    try {
      await request(app).post('/services/searching/api/add-bulk').send([{ id: 1 }, { id: 2 }, { id: 3 }]).expect(413);
    } finally {
      if (previous === undefined) delete process.env.SEARCH_MAX_BULK_DOCUMENTS;
      else process.env.SEARCH_MAX_BULK_DOCUMENTS = previous;
    }
  });

  it('manages indexes', async () => {
    await search.addAll([{ id: 'x', title: 'one two' }], 'idx');
    const list = await request(app).get('/services/searching/api/indexes').expect(200);
    expect(list.body.indexes.map((i) => i.name)).toContain('idx');

    const stats = await request(app).get('/services/searching/api/indexes/idx/stats').expect(200);
    expect(stats.body.size).toBe(1);
    await request(app).get('/services/searching/api/indexes/none/stats').expect(404);

    await request(app).delete('/services/searching/api/indexes/idx/clear').expect(200);
    await request(app).delete('/services/searching/api/indexes/idx').expect(200);
    await request(app).delete('/services/searching/api/indexes/idx').expect(404);
  });

  it('suggests and auto-suggests terms, and reports token stats', async () => {
    await search.addAll([{ id: 'h', title: 'hello world' }], 'docs');
    const suggest = await request(app).get('/services/searching/api/suggest/hel?searchContainer=docs&limit=5').expect(200);
    expect(suggest.body).toContain('hello');
    const auto = await request(app).get('/services/searching/api/autosuggest/hel?searchContainer=docs&fuzzy=1').expect(200);
    expect(auto.body[0].suggestion).toBe('hello');
    const tokens = await request(app).get('/services/searching/api/token-stats').expect(200);
    expect(tokens.body.totalTokens).toBeGreaterThan(0);
  });

  it('serves and clears analytics', async () => {
    await search.addAll([{ id: 'h', title: 'hello' }], 'docs');
    await request(app).get('/services/searching/api/search/hello?searchContainer=docs').expect(200);
    const all = await request(app).get('/services/searching/api/analytics?limit=5').expect(200);
    expect(all.body).toEqual(expect.objectContaining({ operations: expect.any(Object) }));
    await request(app).get('/services/searching/api/analytics/operations').expect(200);
    const terms = await request(app).get('/services/searching/api/analytics/terms').expect(200);
    expect(terms.body.map((t) => t.term)).toContain('hello');
    await request(app).delete('/services/searching/api/analytics').expect(200);
  });

  it('gets and saves settings', async () => {
    await request(app).get('/services/searching/api/settings').expect(200);
    await request(app).post('/services/searching/api/settings').send({}).expect(200);
    jest.spyOn(search, 'getSettings').mockRejectedValue(new Error('x'));
    jest.spyOn(search, 'saveSettings').mockRejectedValue(new Error('x'));
    await request(app).get('/services/searching/api/settings').expect(500);
    await request(app).post('/services/searching/api/settings').send({}).expect(500);
  });

  it('starts a background rebuild', async () => {
    const res = await request(app).post('/services/searching/api/rebuild').send({ searchContainer: 'docs' }).expect(202);
    expect(res.body.success).toBe(true);
  });

  it('hides provider failures', async () => {
    const boom = () => Promise.reject(new Error('index corrupt at /secret/path'));
    jest.spyOn(search, 'add').mockImplementation(boom);
    jest.spyOn(search, 'remove').mockImplementation(boom);
    jest.spyOn(search, 'search').mockImplementation(boom);
    jest.spyOn(search, 'addAll').mockImplementation(boom);
    jest.spyOn(search, 'replace').mockImplementation(boom);
    jest.spyOn(search, 'removeAll').mockImplementation(boom);
    const res = await request(app).post('/services/searching/api/add/').send({ a: 1 }).expect(500);
    expect(JSON.stringify(res.body)).not.toContain('/secret/path');
    await request(app).delete('/services/searching/api/delete/k').expect(500);
    await request(app).get('/services/searching/api/search/k').expect(500);
    await request(app).post('/services/searching/api/search').send({ query: 'k' }).expect(500);
    await request(app).post('/services/searching/api/add-bulk').send([{ id: 1 }]).expect(500);
    await request(app).post('/services/searching/api/replace').send({ id: 1 }).expect(500);
    await request(app).post('/services/searching/api/delete-bulk').send([1]).expect(500);
  });

  it('returns 501 for optional features a provider lacks', async () => {
    const bare = express();
    bare.use(express.json());
    const minimal = {
      getStats: () => ({}),
      search: async () => []
    };
    registerRoutes({ 'express-app': bare }, new EventEmitter(), minimal);
    await request(bare).get('/services/searching/api/suggest/abc').expect(501);
    await request(bare).get('/services/searching/api/autosuggest/abc').expect(501);
    await request(bare).get('/services/searching/api/token-stats').expect(501);
    await request(bare).post('/services/searching/api/add-bulk').send([]).expect(501);
    await request(bare).post('/services/searching/api/replace').send({}).expect(501);
    await request(bare).post('/services/searching/api/delete-bulk').send([]).expect(501);
    await request(bare).post('/services/searching/api/rebuild').send({}).expect(501);
  });
});
