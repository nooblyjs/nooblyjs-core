/**
 * @fileoverview Unit tests for the vector search provider.
 *
 * Semantics are supplied by a **stub embedder** rather than a real model: a
 * fixed map of concept → axis vector, so "similar" is a property of the fixture
 * and every assertion is exact. That keeps the suite offline, deterministic and
 * fast, and it tests the engine's behaviour rather than a model's quality.
 *
 * The stub is what makes the headline claim testable at all — a document that
 * shares no vocabulary with the query is still retrieved, which no amount of
 * BM25 tuning could achieve.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 2026-08-27
 */

'use strict';

const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const EventEmitter = require('events');

const VectorSearchService = require('../../../src/searching/providers/vectorsearching');
const createSearchService = require('../../../src/searching');

const DIMENSIONS = 8;

/**
 * Concept axes. Texts mentioning a concept's trigger words embed onto its axis,
 * so two documents are "semantically similar" exactly when they share a
 * concept — regardless of whether they share any words.
 */
const CONCEPTS = [
  { axis: 0, triggers: ['password', 'credential', 'signin', 'login', 'authentication'] },
  { axis: 1, triggers: ['expense', 'receipt', 'reimbursement', 'claim'] },
  { axis: 2, triggers: ['meeting', 'room', 'booking', 'calendar'] },
  { axis: 3, triggers: ['holiday', 'leave', 'vacation', 'timeoff'] }
];

/** Embed text onto concept axes; unrelated text lands on a neutral axis. */
const stubEmbed = async (texts) => texts.map((text) => {
  const lower = String(text).toLowerCase();
  const vector = new Array(DIMENSIONS).fill(0);
  let hits = 0;
  for (const concept of CONCEPTS) {
    for (const trigger of concept.triggers) {
      if (lower.includes(trigger)) { vector[concept.axis] += 1; hits++; break; }
    }
  }
  if (hits === 0) vector[DIMENSIONS - 1] = 1;
  return vector;
});

/** A provider wired to the stub embedder. */
const makeService = (options = {}, emitter) => new VectorSearchService({
  fields: ['title', 'body'],
  embedding: { embed: stubEmbed, dimensions: DIMENSIONS, model: 'stub-v1' },
  ...options
}, emitter);

/**
 * The fixture that matters: `credentials` and `signin` describe password reset
 * without ever using the words "reset" or "password" together the way the query
 * does, and `expenses` is a lexical decoy — it contains the word "reset".
 */
const DOCS = [
  { id: 'credentials', title: 'Credential recovery procedure', body: 'Staff who cannot access their account should raise a credential request with the service desk.' },
  { id: 'signin', title: 'Sign-in problems', body: 'Troubleshooting guide for login and authentication failures.' },
  { id: 'expenses', title: 'Expense claims', body: 'Submit a receipt for reimbursement. Reset the form to start a new claim.' },
  { id: 'rooms', title: 'Meeting room booking', body: 'How to reserve a meeting room in the Cape Town office.' }
];

/** Result ids in score order. */
const ids = (results) => results.map(r => r.id);

/** Index the fixture and wait for embeddings to land. */
const seed = async (service, documents = DOCS) => {
  await service.addAll(documents);
  await service.flushEmbeddings();
  return service;
};

describe('VectorSearchService — semantic retrieval', () => {
  let service;
  beforeEach(async () => { service = await seed(makeService()); });
  afterEach(() => service.close());

  it('finds a document that shares meaning but not vocabulary', async () => {
    // "password" appears in no document; the credential/sign-in docs are found
    // purely through the embedding.
    const results = await service.search('password');

    expect(ids(results)).toEqual(expect.arrayContaining(['credentials', 'signin']));
    expect(results.every(r => r.matchedBy === 'semantic')).toBe(true);
  });

  it('does not return a lexical decoy that shares words but not meaning', async () => {
    const results = await service.search('password');
    expect(ids(results)).not.toContain('rooms');
  });

  it('ranks by cosine similarity', async () => {
    const results = await service.search('expense receipt');
    expect(results[0].id).toBe('expenses');
    expect(results[0].semanticScore).toBeGreaterThan(0.9);
  });

  it('reports semanticScore and leaves lexicalScore null', async () => {
    const [top] = await service.search('meeting room');
    expect(top.semanticScore).toBeGreaterThan(0);
    expect(top.lexicalScore).toBeNull();
    expect(top.matchedBy).toBe('semantic');
  });

  it('returns stored fields and the source object alongside the score', async () => {
    const [top] = await service.search('meeting room');
    expect(top.title).toBe('Meeting room booking');
    expect(top.obj.id).toBe('rooms');
    expect(top.key).toBe(top.id);
  });

  it('honours minScore', async () => {
    const loose = await service.search('password', { minScore: 0 });
    const strict = await service.search('password', { minScore: 0.99 });
    expect(strict.length).toBeLessThan(loose.length);
  });

  it('honours maxResults', async () => {
    expect(await service.search('password', { maxResults: 1 })).toHaveLength(1);
  });

  it('honours a filter predicate', async () => {
    const results = await service.search('password', {
      filter: (r) => r.id !== 'signin'
    });
    expect(ids(results)).not.toContain('signin');
  });

  it('rejects an empty query', async () => {
    await expect(service.search('')).rejects.toThrow(/non-empty string/);
    await expect(service.search('   ')).rejects.toThrow(/non-empty string/);
  });

  it('rejects an unknown mode rather than silently falling back', async () => {
    await expect(service.search('password', { mode: 'magic' }))
      .rejects.toThrow(/Unknown search mode "magic"/);
  });

  it('returns nothing from an empty index instead of throwing', async () => {
    const empty = makeService();
    await expect(empty.search('anything')).resolves.toEqual([]);
    empty.close();
  });
});

describe('VectorSearchService — keyword mode', () => {
  let service;
  beforeEach(async () => { service = await seed(makeService()); });
  afterEach(() => service.close());

  it('scores BM25 over the provider\'s own lexical index', async () => {
    const results = await service.search('reimbursement', { mode: 'keyword' });
    expect(ids(results)).toEqual(['expenses']);
    expect(results[0].lexicalScore).toBeGreaterThan(0);
    expect(results[0].semanticScore).toBeNull();
    expect(results[0].matchedBy).toBe('lexical');
  });

  it('finds the lexical decoy that semantic search correctly ignores', async () => {
    // "reset" appears only in the expenses document.
    expect(ids(await service.search('reset', { mode: 'keyword' }))).toEqual(['expenses']);
  });

  it('returns nothing for a word that is not indexed', async () => {
    expect(await service.search('nonexistentterm', { mode: 'keyword' })).toEqual([]);
  });

  it('reports matched terms and fields', async () => {
    const [top] = await service.search('reimbursement', { mode: 'keyword' });
    expect(top.terms).toContain('reimbursement');
    expect(top.match.reimbursement).toContain('body');
  });

  it('supports AND combination', async () => {
    const or = await service.search('reimbursement booking', { mode: 'keyword' });
    const and = await service.search('reimbursement booking', {
      mode: 'keyword', combineWith: 'AND'
    });
    expect(or.length).toBeGreaterThan(and.length);
    expect(and).toEqual([]);
  });

  it('applies field boosts', async () => {
    const boosted = await service.search('booking', {
      mode: 'keyword', boost: { title: 10 }
    });
    expect(boosted[0].id).toBe('rooms');
  });
});

describe('VectorSearchService — hybrid mode', () => {
  let service;
  beforeEach(async () => { service = await seed(makeService()); });
  afterEach(() => service.close());

  it('returns documents neither retriever would find alone', async () => {
    // "reset" is lexical-only (expenses); the concept is semantic-only
    // (credentials, signin). Hybrid surfaces all three.
    const results = await service.search('reset credential', { mode: 'hybrid' });
    expect(ids(results)).toEqual(expect.arrayContaining(['expenses', 'credentials', 'signin']));
  });

  it('labels how each document was matched', async () => {
    const byId = Object.fromEntries(
      (await service.search('reset credential', { mode: 'hybrid' })).map(r => [r.id, r])
    );
    expect(byId.credentials.matchedBy).toBe('both');
    expect(byId.signin.matchedBy).toBe('semantic');
    expect(byId.expenses.matchedBy).toBe('lexical');
  });

  it('ranks a document found by both retrievers above one found by either', async () => {
    const results = await service.search('reset credential', { mode: 'hybrid' });
    expect(results[0].id).toBe('credentials');
  });

  it('carries both original scores through fusion', async () => {
    const [top] = await service.search('reset credential', { mode: 'hybrid' });
    expect(top.lexicalScore).toBeGreaterThan(0);
    expect(top.semanticScore).toBeGreaterThan(0);
    // The fused score is on neither scale — it is a rank-based score.
    expect(top.score).not.toBe(top.lexicalScore);
  });

  it('supports weighted fusion, leaning either way', async () => {
    const query = 'reset credential';

    // alpha 1 is pure lexical, so the documents BM25 found must come back in
    // BM25's own order; alpha 0 is pure vector, and likewise for cosine.
    const lexicalOrder = ids(await service.search(query, { mode: 'keyword' }));
    const semanticOrder = ids(await service.search(query, { mode: 'semantic' }));

    const leanLexical = ids(await service.search(query, {
      mode: 'hybrid', fusion: 'weighted', alpha: 1
    }));
    const leanSemantic = ids(await service.search(query, {
      mode: 'hybrid', fusion: 'weighted', alpha: 0
    }));

    expect(leanLexical.filter(id => lexicalOrder.includes(id))).toEqual(lexicalOrder);
    expect(leanSemantic.filter(id => semanticOrder.includes(id))).toEqual(semanticOrder);
    expect(leanLexical).not.toEqual(leanSemantic);
  });

  it('restricts the vector branch to lexical candidates when asked', async () => {
    const open = await service.search('reset credential', { mode: 'hybrid' });
    const restricted = await service.search('reset credential', {
      mode: 'hybrid', restrictToLexical: true
    });

    // With reranking on, a document BM25 never surfaced cannot appear.
    expect(ids(open)).toContain('signin');
    expect(ids(restricted)).not.toContain('signin');
  });

  it('degrades to the surviving retriever when the other finds nothing', async () => {
    // "password" is in no document, so BM25 returns nothing at all — but the
    // concept is present, so hybrid still answers from the vector branch.
    expect(await service.search('password', { mode: 'keyword' })).toEqual([]);

    const results = await service.search('password', { mode: 'hybrid' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.matchedBy === 'semantic')).toBe(true);
  });
});

describe('VectorSearchService — quoted phrases', () => {
  let service;
  beforeEach(async () => { service = await seed(makeService()); });
  afterEach(() => service.close());

  it('rejects a semantically similar document that lacks the exact phrase', async () => {
    // Semantically, both credential docs match; only one contains the phrase.
    const loose = await service.search('credential request', { mode: 'hybrid' });
    const exact = await service.search('"credential request"', { mode: 'hybrid' });

    expect(ids(loose)).toEqual(expect.arrayContaining(['credentials', 'signin']));
    expect(ids(exact)).toEqual(['credentials']);
  });

  it('applies the phrase gate in pure semantic mode too', async () => {
    const results = await service.search('"credential request"', { mode: 'semantic' });
    expect(ids(results)).toEqual(['credentials']);
  });

  it('returns nothing when no document contains the phrase', async () => {
    expect(await service.search('"no such phrase here"', { mode: 'hybrid' })).toEqual([]);
  });

  it('can be told to treat quotes literally', async () => {
    const results = await service.search('"credential request"', {
      mode: 'semantic', quotedPhrases: false
    });
    expect(ids(results)).toEqual(expect.arrayContaining(['credentials', 'signin']));
  });

  it('exposes the parsed query', () => {
    expect(service.parseQuery('Oracle "MySQL Enterprise"')).toEqual({
      phrases: ['MySQL Enterprise'],
      remainder: 'Oracle MySQL Enterprise'
    });
  });
});

describe('VectorSearchService — write path and embedding queue', () => {
  let service;
  beforeEach(() => { service = makeService(); });
  afterEach(() => service.close());

  it('indexes lexically straight away and embeds in the background', async () => {
    await service.add('doc-1', { title: 'Expense claims', body: 'receipt' });

    // Lexically searchable immediately, before any embedding has run.
    expect(ids(await service.search('receipt', { mode: 'keyword' }))).toEqual(['doc-1']);
    expect(service.getStats().pendingEmbeddings).toBe(1);

    await service.flushEmbeddings();
    expect(service.getStats().pendingEmbeddings).toBe(0);
    expect(service.getStats().embeddedDocuments).toBe(1);
  });

  it('refuses to add a duplicate key', async () => {
    await service.add('doc-1', { title: 'One', body: 'body' });
    await expect(service.add('doc-1', { title: 'Two', body: 'body' })).resolves.toBe(false);
  });

  it('validates its arguments', async () => {
    await expect(service.add('', {})).rejects.toThrow(/non-empty string/);
    await expect(service.add('k', null)).rejects.toThrow(/non-null object/);
    await expect(service.addAll('nope')).rejects.toThrow(/requires an array/);
    await expect(service.removeAll('nope')).rejects.toThrow(/requires an array/);
    await expect(service.replace({})).rejects.toThrow(/missing idField/);
  });

  it('counts added and skipped documents in addAll', async () => {
    expect(await service.addAll([{ id: 'a', title: 'A' }, { title: 'no id' }]))
      .toEqual({ added: 1, skipped: 1 });
  });

  it('replaces a document and its vectors', async () => {
    await service.add('doc-1', { title: 'Expense claims', body: 'receipt' });
    await service.flushEmbeddings();
    const before = await service.search('expense');
    expect(ids(before)).toEqual(['doc-1']);

    await service.replace({ id: 'doc-1', title: 'Meeting room booking', body: 'calendar' });
    await service.flushEmbeddings();

    expect(ids(await service.search('meeting'))).toEqual(['doc-1']);
    expect(await service.search('expense', { minScore: 0.5 })).toEqual([]);
    expect(service.getStats().embeddedDocuments).toBe(1);
  });

  it('removes a document from both the lexical index and the vector store', async () => {
    await seed(service);
    expect(await service.remove('expenses')).toBe(true);

    expect(await service.search('reimbursement', { mode: 'keyword' })).toEqual([]);
    expect(ids(await service.search('expense receipt'))).not.toContain('expenses');
    expect(service.getStats().embeddedDocuments).toBe(3);
  });

  it('does not resurrect a document removed while its embedding was queued', async () => {
    await service.add('doc-1', { title: 'Expense claims', body: 'receipt' });
    await service.remove('doc-1');           // removed before the drain runs
    await service.flushEmbeddings();

    expect(service.getStats().embeddedDocuments).toBe(0);
    expect(await service.search('expense')).toEqual([]);
  });

  it('removes many documents at once', async () => {
    await seed(service);
    expect(await service.removeAll(['expenses', 'rooms', 'missing']))
      .toEqual({ removed: 2, missing: 1 });
    expect(service.getStats().totalDocuments).toBe(2);
  });

  it('supports discard as an alias for remove', async () => {
    await seed(service);
    expect(await service.discard('rooms')).toBe(true);
  });

  it('can defer embedding entirely with autoEmbed false', async () => {
    const manual = makeService({ autoEmbed: false });
    await manual.add('doc-1', { title: 'Expense claims', body: 'receipt' });

    await new Promise(resolve => setTimeout(resolve, 5));
    expect(manual.getStats().pendingEmbeddings).toBe(1);

    await manual.flushEmbeddings();
    expect(manual.getStats().embeddedDocuments).toBe(1);
    manual.close();
  });
});

describe('VectorSearchService — chunking', () => {
  it('splits a long document and returns it once, at its best passage', async () => {
    const service = makeService({ chunk: { maxChars: 120, overlap: 20 } });

    const long = [
      'This opening section is about meeting room booking and the calendar system. '.repeat(2),
      'This later section is entirely about expense receipt reimbursement instead. '.repeat(2)
    ].join('');

    await service.add('long-doc', { title: 'Handbook', body: long });
    await service.add('short-doc', { title: 'Rooms', body: 'meeting room' });
    await service.flushEmbeddings();

    const stats = service.getIndexStats();
    expect(stats.vectorCount).toBeGreaterThan(stats.embeddedDocuments);

    // Matched on its expense passage, and returned once despite many chunks.
    const results = await service.search('expense receipt');
    expect(results.filter(r => r.id === 'long-doc')).toHaveLength(1);
    expect(ids(results)).toContain('long-doc');

    service.close();
  });

  it('replaces every chunk when a long document is re-indexed', async () => {
    const service = makeService({ chunk: { maxChars: 120, overlap: 20 } });

    await service.add('doc-1', { title: 'Long', body: 'meeting room calendar booking. '.repeat(20) });
    await service.flushEmbeddings();
    const chunked = service.getIndexStats().vectorCount;
    expect(chunked).toBeGreaterThan(1);

    await service.replace({ id: 'doc-1', title: 'Short', body: 'expense' });
    await service.flushEmbeddings();

    // No orphaned chunks from the previous, longer version.
    expect(service.getIndexStats().vectorCount).toBe(1);
    service.close();
  });
});

describe('VectorSearchService — similar (more like this)', () => {
  let service;
  beforeEach(async () => { service = await seed(makeService()); });
  afterEach(() => service.close());

  it('returns documents about the same thing, excluding the subject', async () => {
    const related = await service.similar('credentials');
    expect(ids(related)).toContain('signin');
    expect(ids(related)).not.toContain('credentials');
  });

  it('honours k', async () => {
    expect(await service.similar('credentials', { k: 1 })).toHaveLength(1);
  });

  it('explains itself when the document has no vector', async () => {
    await expect(service.similar('unknown-id')).rejects.toThrow(/no vector for "unknown-id"/);
  });
});

describe('VectorSearchService — named indexes', () => {
  let service;
  beforeEach(() => { service = makeService(); });
  afterEach(() => service.close());

  it('keeps documents and vectors isolated per container', async () => {
    await service.add('a', { title: 'Expense claims', body: 'receipt' }, 'finance');
    await service.add('b', { title: 'Meeting rooms', body: 'calendar' }, 'facilities');
    await service.flushEmbeddings();

    expect(ids(await service.search('expense', 'finance'))).toEqual(['a']);
    expect(await service.search('expense', { containerName: 'facilities', minScore: 0.5 }))
      .toEqual([]);
    expect(service.listIndexes()).toEqual(expect.arrayContaining(['finance', 'facilities']));
  });

  it('reports per-index stats', async () => {
    await service.add('a', { title: 'Expense claims', body: 'receipt' }, 'finance');
    await service.flushEmbeddings();

    expect(service.getIndexStats('finance')).toMatchObject({
      searchContainer: 'finance', size: 1, vectorCount: 1, embeddedDocuments: 1
    });
    expect(service.getIndexStats('missing')).toBeNull();
  });

  it('clears an index including its vectors', async () => {
    await seed(service);
    expect(service.clearIndex()).toBe(true);
    expect(service.getStats().totalDocuments).toBe(0);
    expect(service.getStats().vectorCount).toBe(0);
  });

  it('deletes a named index but refuses to delete the default', async () => {
    await service.add('a', { title: 'A' }, 'finance');
    expect(service.deleteIndex('finance')).toBe(true);
    expect(service.deleteIndex('finance')).toBe(false);
    expect(() => service.deleteIndex('default')).toThrow(/Cannot delete the default index/);
  });
});

describe('VectorSearchService — indexer contract', () => {
  let service;
  beforeEach(() => { service = makeService(); });
  afterEach(() => service.close());

  it('indexes raw content through indexDocument', async () => {
    await service.indexDocument('doc-1', 'Guidance on expense receipt reimbursement.', {
      path: '/docs/expenses.md', type: 'markdown'
    });
    await service.flushEmbeddings();

    const [top] = await service.search('expense');
    expect(top.id).toBe('doc-1');
    expect(top.path).toBe('/docs/expenses.md'); // metadata spread onto the result
  });

  it('upserts on re-index rather than duplicating', async () => {
    await service.indexDocument('doc-1', 'meeting room booking', {});
    await service.indexDocument('doc-1', 'expense receipt', {});
    await service.flushEmbeddings();

    expect(service.getStats().totalDocuments).toBe(1);
    expect(ids(await service.search('expense'))).toEqual(['doc-1']);
  });

  it('removes through removeDocument', async () => {
    await service.indexDocument('doc-1', 'expense receipt', {});
    await service.flushEmbeddings();
    expect(service.removeDocument('doc-1')).toBe(true);
    expect(service.getStats().totalDocuments).toBe(0);
  });

  it('rejects an invalid id', async () => {
    await expect(service.indexDocument('', 'text')).rejects.toThrow(/non-empty string/);
  });
});

describe('VectorSearchService — suggestions', () => {
  let service;
  beforeEach(async () => { service = await seed(makeService()); });
  afterEach(() => service.close());

  it('suggests matching document titles', () => {
    const suggestions = service.suggest('meet');
    expect(suggestions.some(s => s.title === 'Meeting room booking')).toBe(true);
  });

  it('ignores a query that is too short', () => {
    expect(service.suggest('m')).toEqual([]);
  });

  it('auto-suggests completions ranked by document frequency', async () => {
    const suggestions = await service.autoSuggest('reim');
    expect(suggestions[0].suggestion).toBe('reimbursement');
    expect(suggestions[0].terms).toEqual(['reimbursement']);
  });

  it('composes a completion onto the preceding words', async () => {
    const [first] = await service.autoSuggest('submit a reim');
    expect(first.suggestion).toBe('submit a reimbursement');
  });

  it('returns nothing for an empty query', async () => {
    expect(await service.autoSuggest('')).toEqual([]);
  });
});

describe('VectorSearchService — re-embedding', () => {
  it('backfills documents that have no vector', async () => {
    const service = makeService({ autoEmbed: false });
    await service.addAll(DOCS);

    // Discard the queue without embedding, simulating an interrupted run.
    service.pending_.clear();
    expect(service.getStats().embeddedDocuments).toBe(0);

    expect((await service.reembed()).queued).toBe(DOCS.length);
    await service.flushEmbeddings();
    expect(service.getStats().embeddedDocuments).toBe(DOCS.length);

    service.close();
  });

  it('re-embeds everything when forced', async () => {
    const service = await seed(makeService());
    expect((await service.reembed('default', { force: true })).queued).toBe(DOCS.length);
    await service.flushEmbeddings();
    expect(service.getStats().embeddedDocuments).toBe(DOCS.length);
    service.close();
  });

  it('skips documents that already have a vector', async () => {
    const service = await seed(makeService());
    expect((await service.reembed()).queued).toBe(0);
    service.close();
  });
});

describe('VectorSearchService — failure handling', () => {
  it('keeps documents lexically searchable when embedding fails', async () => {
    const warn = jest.fn();
    const service = new VectorSearchService({
      fields: ['title', 'body'],
      embedding: {
        dimensions: DIMENSIONS,
        model: 'failing',
        retryBaseMs: 0,
        embed: async () => { throw Object.assign(new Error('backend down'), { status: 500 }); }
      }
    }, undefined, { logging: { warn, info: jest.fn(), error: jest.fn(), debug: jest.fn() } });

    await service.add('doc-1', { title: 'Expense claims', body: 'receipt' });
    await service.flushEmbeddings();

    expect(ids(await service.search('receipt', { mode: 'keyword' }))).toEqual(['doc-1']);
    expect(service.getStats().embeddedDocuments).toBe(0);
    expect(service.getStats().lastEmbedError).toMatch(/backend down/);

    service.close();
  });

  it('surfaces a dimension mismatch as an event rather than a crash', async () => {
    const emitter = new EventEmitter();
    const errors = [];
    emitter.on('search:embed:error', (payload) => errors.push(payload));

    const service = makeService({
      embedding: { embed: async (t) => t.map(() => [1, 2]), dimensions: DIMENSIONS, model: 'wrong' }
    }, emitter);

    await service.add('doc-1', { title: 'Expense claims', body: 'receipt' });
    await service.flushEmbeddings();

    expect(errors).toHaveLength(1);
    expect(errors[0].error).toMatch(/not comparable/);
    service.close();
  });
});

describe('VectorSearchService — events', () => {
  it('emits lifecycle events with the search mode', async () => {
    const emitter = new EventEmitter();
    const seen = [];
    for (const event of ['search:add', 'search:remove', 'search:search', 'search:embed:complete']) {
      emitter.on(event, (payload) => seen.push([event, payload]));
    }

    const service = makeService({}, emitter);
    await service.add('doc-1', { title: 'Expense claims', body: 'receipt' });
    await service.flushEmbeddings();
    await service.search('expense', { mode: 'hybrid' });
    await service.remove('doc-1');

    const names = seen.map(([name]) => name);
    expect(names).toContain('search:add');
    expect(names).toContain('search:embed:complete');
    expect(names).toContain('search:remove');

    const [, searchPayload] = seen.find(([name]) => name === 'search:search');
    expect(searchPayload.mode).toBe('hybrid');

    service.close();
  });
});

describe('VectorSearchService — stats and settings', () => {
  let service;
  beforeEach(async () => { service = await seed(makeService()); });
  afterEach(() => service.close());

  it('reports vector coverage alongside document counts', () => {
    expect(service.getStats()).toMatchObject({
      totalDocuments: DOCS.length,
      embeddedDocuments: DOCS.length,
      pendingEmbeddings: 0,
      embeddingModel: 'stub-v1',
      dimensions: DIMENSIONS
    });
  });

  it('describes the semantic subsystem for the dashboard', () => {
    expect(service.semanticStatus()).toMatchObject({
      enabled: true,
      provider: 'vector',
      model: 'stub-v1',
      dimensions: DIMENSIONS,
      defaultMode: 'semantic',
      fusion: 'rrf'
    });
  });

  it('exposes tunable settings for the Settings tab', async () => {
    const settings = await service.getSettings();
    expect(settings.list.map(s => s.setting)).toEqual(
      expect.arrayContaining(['mode', 'fusion', 'alpha', 'k', 'minScore'])
    );
  });

  it('applies settings changes and ignores invalid ones', async () => {
    await service.saveSettings({ mode: 'hybrid', fusion: 'weighted', alpha: 0.25, k: 5 });
    expect(service.semanticStatus()).toMatchObject({
      defaultMode: 'hybrid', fusion: 'weighted', alpha: 0.25, k: 5
    });

    await service.saveSettings({ mode: 'nonsense', fusion: 'nonsense' });
    expect(service.semanticStatus()).toMatchObject({ defaultMode: 'hybrid', fusion: 'weighted' });
  });

  it('uses the configured default mode when none is given per call', async () => {
    await service.saveSettings({ mode: 'keyword' });
    expect((await service.search('reset'))[0].matchedBy).toBe('lexical');
  });
});

describe('VectorSearchService — disk persistence', () => {
  let indexDir;

  beforeEach(async () => {
    indexDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vectorsearch-test-'));
  });
  afterEach(async () => {
    await fs.rm(indexDir, { recursive: true, force: true });
  });

  it('round-trips documents and vectors through disk', async () => {
    const writer = await seed(makeService({ indexDir }));
    const before = await writer.search('password');
    await writer.saveToDisk();
    writer.close();

    const reader = makeService({ indexDir });
    expect(await reader.loadFromDisk('default')).toBe(true);

    expect(reader.getStats()).toMatchObject({
      totalDocuments: DOCS.length,
      embeddedDocuments: DOCS.length,
      pendingEmbeddings: 0
    });
    expect(ids(await reader.search('password'))).toEqual(ids(before));
    expect(ids(await reader.search('reimbursement', { mode: 'keyword' }))).toEqual(['expenses']);

    reader.close();
  });

  it('writes vectors as a binary file, not JSON', async () => {
    const writer = await seed(makeService({ indexDir }));
    await writer.saveToDisk();
    writer.close();

    const files = await fs.readdir(path.join(indexDir, 'default'));
    expect(files).toEqual(expect.arrayContaining([
      'documents.json', 'tokens.json', 'meta.json', 'vectors.bin', 'vectors.meta.json'
    ]));

    const { size } = await fs.stat(path.join(indexDir, 'default', 'vectors.bin'));
    expect(size).toBe(DOCS.length * DIMENSIONS * 4);
  });

  it('keeps documents but re-queues embeddings when the model changed', async () => {
    const writer = await seed(makeService({ indexDir }));
    await writer.saveToDisk();
    writer.close();

    const reader = makeService({
      indexDir,
      embedding: { embed: stubEmbed, dimensions: DIMENSIONS, model: 'stub-v2' }
    });
    expect(await reader.loadFromDisk('default')).toBe(true);

    // Lexical data survives a model change; the incomparable vectors do not.
    expect(reader.getStats().totalDocuments).toBe(DOCS.length);
    expect(reader.getStats().pendingEmbeddings).toBe(DOCS.length);

    await reader.flushEmbeddings();
    expect(reader.getStats().embeddedDocuments).toBe(DOCS.length);
    reader.close();
  });

  it('refuses to load a directory written by another provider', async () => {
    const writer = await seed(makeService({ indexDir }));
    await writer.saveToDisk();
    writer.close();

    const metaPath = path.join(indexDir, 'default', 'meta.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    meta.provider = 'tokens';
    await fs.writeFile(metaPath, JSON.stringify(meta), 'utf8');

    const reader = makeService({ indexDir });
    expect(await reader.loadFromDisk('default')).toBe(false);
    reader.close();
  });

  it('rebuilds when the index on disk has expired', async () => {
    const writer = await seed(makeService({ indexDir }));
    await writer.saveToDisk();
    writer.close();

    const metaPath = path.join(indexDir, 'default', 'meta.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    meta.lastIndexTime = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    await fs.writeFile(metaPath, JSON.stringify(meta), 'utf8');

    const reader = makeService({ indexDir, diskTTLHours: 24 });
    expect(await reader.loadFromDisk('default')).toBe(false);
    reader.close();
  });

  it('reports no load when nothing has been persisted', async () => {
    const reader = makeService({ indexDir });
    expect(await reader.loadFromDisk('default')).toBe(false);
    reader.close();
  });

  it('is a no-op without an indexDir', async () => {
    const service = makeService();
    await expect(service.saveToDisk()).resolves.toBeUndefined();
    await expect(service.loadFromDisk()).resolves.toBe(false);
    service.close();
  });
});

describe('searching factory — vector provider registration', () => {
  const build = (type) => createSearchService(type, {
    fields: ['title', 'body'],
    embedding: { embed: stubEmbed, dimensions: DIMENSIONS, model: 'stub-v1' }
  }, new EventEmitter());

  it.each(['vector', 'vectorsearching', 'semantic'])('resolves type "%s"', (type) => {
    const service = build(type);
    expect(service).toBeInstanceOf(VectorSearchService);
    service.close();
  });

  it('still resolves the token engine for the default types', () => {
    for (const type of ['default', 'memory', 'tokens', 'files']) {
      expect(createSearchService(type, {}, new EventEmitter()))
        .not.toBeInstanceOf(VectorSearchService);
    }
  });

  it('is left alone by the indexer compatibility layer', () => {
    const service = build('vector');
    // It implements the contract natively, so no shim should have wrapped it.
    expect(service.__indexerSearchWrapped).toBeUndefined();
    expect(typeof service.indexDocument).toBe('function');
    expect(typeof service.loadFromDisk).toBe('function');
    service.close();
  });

  it('works end to end through the factory', async () => {
    const service = build('vector');
    await service.addAll(DOCS);
    await service.flushEmbeddings();

    expect(ids(await service.search('password'))).toEqual(
      expect.arrayContaining(['credentials', 'signin'])
    );
    service.close();
  });
});
