/**
 * @fileoverview Unit tests for the field-aware token search provider.
 * Covers phases 1-5: data model, search options (fields/boost/filter/
 * combineWith), prefix, fuzzy, BM25 scoring, autoSuggest, and bulk ops.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs').promises;
const os = require('node:os');
const EventEmitter = require('events');
const createSearchService = require('../../../src/searching');

const documents = [
  { id: 1, title: 'Moby Dick', text: 'Call me Ishmael. Some years ago...', category: 'fiction' },
  { id: 2, title: 'Zen and the Art of Motorcycle Maintenance', text: 'I can see by my watch...', category: 'fiction' },
  { id: 3, title: 'Neuromancer', text: 'The sky above the port was the color of television.', category: 'fiction' },
  { id: 4, title: 'Zen and the Art of Archery', text: 'At first sight it must seem...', category: 'non-fiction' }
];

function makeService(options = {}) {
  const ee = new EventEmitter();
  jest.spyOn(ee, 'emit');
  const service = createSearchService('tokens', options, ee);
  return { service, ee };
}

describe('SearchTokenService — backward compat (no fields)', () => {
  it('falls back to synthetic _all field and searches across all values', async () => {
    const { service } = makeService();
    await service.add('a', { name: 'Hello World', body: 'lorem ipsum dolor' });
    await service.add('b', { name: 'Goodbye Moon', body: 'sit amet consectetur' });

    const results = await service.search('hello');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('a');
    expect(results[0].key).toBe('a');
    expect(results[0].obj).toEqual({ name: 'Hello World', body: 'lorem ipsum dolor' });
  });

  it('rejects duplicate keys', async () => {
    const { service } = makeService();
    expect(await service.add('a', { name: 'foo' })).toBe(true);
    expect(await service.add('a', { name: 'bar' })).toBe(false);
  });

  it('preserves indexDocument() legacy API', async () => {
    const { service } = makeService();
    await service.indexDocument('doc-1', 'the quick brown fox jumps', { name: 'Fox Tale' });
    const results = await service.search('quick');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('doc-1');
  });
});

describe('SearchTokenService — field-aware indexing', () => {
  it('only tokenizes configured fields', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.add('a', { title: 'Moby Dick', text: 'Ishmael' });
    const titleHit = await service.search('moby');
    const textMiss = await service.search('ishmael');
    expect(titleHit).toHaveLength(1);
    expect(textMiss).toHaveLength(0);
  });

  it('projects storeFields onto results', async () => {
    const { service } = makeService({
      fields: ['title', 'text'],
      storeFields: ['title', 'category']
    });
    await service.addAll(documents);
    const results = await service.search('motorcycle');
    expect(results[0].title).toBe('Zen and the Art of Motorcycle Maintenance');
    expect(results[0].category).toBe('fiction');
    expect(results[0].text).toBeUndefined();
  });

  it('match info maps token -> matched fields', async () => {
    const { service } = makeService({ fields: ['title', 'text'] });
    await service.addAll(documents);
    const [top] = await service.search('zen');
    expect(top.match).toHaveProperty('zen');
    expect(top.match.zen).toContain('title');
    expect(top.terms).toContain('zen');
  });

  it('extractField supports nested fields', async () => {
    const { service } = makeService({
      fields: ['author.name', 'title'],
      storeFields: ['title']
    });
    await service.add('a', { title: 'Moby Dick', author: { name: 'Herman Melville' } });
    const results = await service.search('melville');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Moby Dick');
  });

  it('extractField can derive a virtual field', async () => {
    const { service } = makeService({
      fields: ['title', 'pubYear'],
      extractField: (doc, field) => {
        if (field === 'pubYear') return doc.pubDate ? String(new Date(doc.pubDate).getFullYear()) : '';
        return doc[field];
      }
    });
    await service.add('a', { title: 'Moby Dick', pubDate: '1851-10-18' });
    const results = await service.search('1851');
    expect(results).toHaveLength(1);
  });
});

describe('SearchTokenService — search options', () => {
  it('restricts search by fields option', async () => {
    const { service } = makeService({ fields: ['title', 'text'] });
    await service.addAll(documents);
    const titleOnly = await service.search('ishmael', { fields: ['title'] });
    expect(titleOnly).toHaveLength(0);
    const bothFields = await service.search('ishmael');
    expect(bothFields.length).toBeGreaterThan(0);
  });

  it('boost lifts a field above another', async () => {
    const { service } = makeService({ fields: ['title', 'text'] });
    await service.add('title-hit', { id: 'title-hit', title: 'zen', text: 'unrelated body content here' });
    await service.add('text-hit', { id: 'text-hit', title: 'unrelated', text: 'zen appears here in the body' });

    const noBoost = await service.search('zen');
    const boosted = await service.search('zen', { boost: { title: 100 } });
    expect(boosted[0].id).toBe('title-hit');
    expect(noBoost.length).toBeGreaterThan(0);
  });

  it('filter excludes results', async () => {
    const { service } = makeService({ fields: ['title'], storeFields: ['title', 'category'] });
    await service.addAll(documents);
    const fictionOnly = await service.search('zen', {
      filter: r => r.category === 'fiction'
    });
    expect(fictionOnly.every(r => r.category === 'fiction')).toBe(true);
    expect(fictionOnly.length).toBeGreaterThan(0);
  });

  it('combineWith AND requires every query token to match', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.addAll(documents);
    const orHits = await service.search('zen motorcycle');
    const andHits = await service.search('zen motorcycle', { combineWith: 'AND' });
    expect(orHits.length).toBeGreaterThanOrEqual(andHits.length);
    expect(andHits.every(r => r.match.zen && r.match.motorcycle)).toBe(true);
    expect(andHits.some(r => r.id === '2')).toBe(true);
  });

  it('maxResults caps the result set', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.addAll(documents);
    const limited = await service.search('zen', { maxResults: 1 });
    expect(limited).toHaveLength(1);
  });

  it('searchOptions defaults apply when not overridden', async () => {
    const { service } = makeService({
      fields: ['title', 'text'],
      searchOptions: { combineWith: 'AND' }
    });
    await service.addAll(documents);
    const andHits = await service.search('zen motorcycle');
    expect(andHits.every(r => r.match.zen && r.match.motorcycle)).toBe(true);
  });
});

describe('SearchTokenService — prefix matching', () => {
  it('matches token prefix when prefix=true', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.addAll(documents);
    const exact = await service.search('moto');
    expect(exact).toHaveLength(0);
    const prefix = await service.search('moto', { prefix: true });
    expect(prefix.length).toBeGreaterThan(0);
    expect(prefix[0].terms).toContain('moto');
  });

  it('prefix predicate applies per token', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.addAll(documents);
    const results = await service.search('zen moto', {
      prefix: (token) => token === 'moto'
    });
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.title).toContain('Motorcycle');
  });
});

describe('SearchTokenService — fuzzy matching', () => {
  it('matches with edit distance', async () => {
    const { service } = makeService({ fields: ['text'] });
    await service.addAll(documents);
    const exact = await service.search('ismael');
    expect(exact).toHaveLength(0);
    const fuzzy = await service.search('ismael', { fuzzy: 0.2 });
    expect(fuzzy.length).toBeGreaterThan(0);
    expect(fuzzy[0].obj.text).toMatch(/Ishmael/);
  });

  it('fuzzy with true defaults to 0.2', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.addAll(documents);
    const fuzzy = await service.search('motorcicle', { fuzzy: true });
    expect(fuzzy.length).toBeGreaterThan(0);
  });

  it('fuzzy as integer uses absolute distance', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.addAll(documents);
    const fuzzy = await service.search('motorcicle', { fuzzy: 2 });
    expect(fuzzy.length).toBeGreaterThan(0);
  });
});

describe('SearchTokenService — BM25 scoring', () => {
  it('rarer terms outscore common terms', async () => {
    const { service } = makeService({ fields: ['text'] });
    // "the" is everywhere; "neuromancer" is rare
    for (let i = 0; i < 10; i++) {
      await service.add(`c-${i}`, { id: `c-${i}`, text: 'the the the common common common' });
    }
    await service.add('rare', { id: 'rare', text: 'neuromancer of cyberpunk' });

    const rareHit = await service.search('neuromancer');
    const commonHit = await service.search('common');
    expect(rareHit[0].score).toBeGreaterThan(commonHit[0].score);
  });

  it('shorter docs score higher on same term frequency', async () => {
    const { service } = makeService({ fields: ['text'] });
    await service.add('short', { id: 'short', text: 'zen' });
    await service.add('long', {
      id: 'long',
      text: 'zen ' + new Array(50).fill('padding').join(' ')
    });

    const results = await service.search('zen');
    expect(results[0].id).toBe('short');
  });
});

describe('SearchTokenService — autoSuggest', () => {
  it('returns compositional ranked suggestions', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.addAll(documents);
    const suggestions = await service.autoSuggest('zen ar');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toHaveProperty('suggestion');
    expect(suggestions[0]).toHaveProperty('terms');
    expect(suggestions[0]).toHaveProperty('score');
    expect(suggestions[0].suggestion.startsWith('zen ')).toBe(true);
  });

  it('honors fuzzy in autoSuggest', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.addAll(documents);
    const fuzzy = await service.autoSuggest('neromancer', { fuzzy: 0.2 });
    expect(fuzzy.length).toBeGreaterThan(0);
  });

  it('legacy suggest() still returns doc-name matches', async () => {
    const { service } = makeService({
      fields: ['title'], storeFields: ['title']
    });
    await service.addAll(documents);
    const sug = service.suggest('Zen');
    expect(sug.length).toBeGreaterThan(0);
    expect(sug.some(s => s.type === 'document')).toBe(true);
  });
});

describe('SearchTokenService — bulk operations', () => {
  it('addAll adds many and reports counts', async () => {
    const { service } = makeService({ fields: ['title'] });
    const r = await service.addAll(documents);
    expect(r.added).toBe(4);
    expect(r.skipped).toBe(0);
    expect(service.getStats().totalDocuments).toBe(4);
  });

  it('addAll skips docs missing idField', async () => {
    const { service } = makeService({ fields: ['title'] });
    const r = await service.addAll([{ id: 1, title: 'A' }, { title: 'no id' }]);
    expect(r.added).toBe(1);
    expect(r.skipped).toBe(1);
  });

  it('replace updates an existing document', async () => {
    const { service } = makeService({ fields: ['title'], storeFields: ['title'] });
    await service.add('1', { id: 1, title: 'Old' });
    await service.replace({ id: 1, title: 'New' });
    const hit = await service.search('new');
    expect(hit[0].title).toBe('New');
    const stale = await service.search('old');
    expect(stale).toHaveLength(0);
  });

  it('removeAll removes by ids', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.addAll(documents);
    const r = await service.removeAll([1, 2]);
    expect(r.removed).toBe(2);
    expect(service.getStats().totalDocuments).toBe(2);
  });

  it('removeAll removes by document objects', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.addAll(documents);
    const r = await service.removeAll([{ id: 3 }, { id: 4 }]);
    expect(r.removed).toBe(2);
  });

  it('discard is an alias for remove', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.add('a', { id: 'a', title: 'foo' });
    expect(await service.discard('a')).toBe(true);
  });

  it('removeDocument cleans up postings and stats', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.add('a', { id: 'a', title: 'unique-term-xyz' });
    expect(service.getStats().totalTokens).toBeGreaterThan(0);
    await service.remove('a');
    // Token unique-term-xyz had only this doc — should be gone
    const results = await service.search('unique-term-xyz');
    expect(results).toHaveLength(0);
  });
});

describe('SearchTokenService — pluggable tokenize / processTerm', () => {
  it('custom tokenizer splits differently', async () => {
    const { service } = makeService({
      fields: ['title'],
      tokenize: (str) => str.split('-')
    });
    await service.add('a', { id: 'a', title: 'foo-bar-baz' });
    const results = await service.search('bar');
    expect(results).toHaveLength(1);
  });

  it('custom processTerm can normalize / filter', async () => {
    const stopWords = new Set(['the', 'and']);
    const { service } = makeService({
      fields: ['title'],
      processTerm: (t) => (stopWords.has(t.toLowerCase()) ? null : t.toLowerCase())
    });
    await service.add('a', { id: 'a', title: 'The Zen and Art' });
    // 'the' and 'and' shouldn't be searchable
    expect(await service.search('the')).toHaveLength(0);
    expect((await service.search('zen')).length).toBeGreaterThan(0);
  });

  it('search-time processTerm can differ from index-time', async () => {
    const { service } = makeService({
      fields: ['title'],
      processTerm: (t) => t.toLowerCase(),
      searchOptions: {
        processTerm: (t) => t.toLowerCase().replace(/s$/, '') // strip trailing s
      }
    });
    await service.add('a', { id: 'a', title: 'motorcycle' });
    const results = await service.search('motorcycles');
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('SearchTokenService — disk persistence', () => {
  let tmpDir;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'search-tokens-'));
  });
  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('round-trips v2 index through disk', async () => {
    const { service } = makeService({
      fields: ['title', 'text'],
      storeFields: ['title'],
      indexDir: tmpDir
    });
    await service.addAll(documents);
    await service.saveToDisk();

    const { service: reloaded } = makeService({
      fields: ['title', 'text'],
      storeFields: ['title'],
      indexDir: tmpDir
    });
    const loaded = await reloaded.loadFromDisk();
    expect(loaded).toBe(true);
    const results = await reloaded.search('motorcycle');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('Motorcycle');
  });

  it('rebuilds when on-disk version mismatches', async () => {
    const containerDir = path.join(tmpDir, 'default');
    await fs.mkdir(containerDir, { recursive: true });
    await fs.writeFile(path.join(containerDir, 'meta.json'), JSON.stringify({
      version: '1.0.0',
      lastIndexTime: new Date().toISOString(),
      totalDocuments: 0,
      totalTokens: 0
    }));
    await fs.writeFile(path.join(containerDir, 'documents.json'), '{}');
    await fs.writeFile(path.join(containerDir, 'tokens.json'), '{}');

    const { service } = makeService({ fields: ['title'], indexDir: tmpDir });
    const loaded = await service.loadFromDisk();
    expect(loaded).toBe(false); // version mismatch -> false, ready for rebuild
  });
});

describe('SearchTokenService — index management', () => {
  it('listIndexes returns container names', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.add('a', { id: 'a', title: 'x' }, 'other');
    expect(service.listIndexes()).toEqual(expect.arrayContaining(['default', 'other']));
  });

  it('clearIndex empties a container', async () => {
    const { service } = makeService({ fields: ['title'] });
    await service.addAll(documents);
    service.clearIndex();
    expect(service.getStats('default').totalDocuments).toBe(0);
  });

  it('deleteIndex refuses to remove default', () => {
    const { service } = makeService({ fields: ['title'] });
    expect(() => service.deleteIndex('default')).toThrow();
  });
});

describe('SearchTokenService — events', () => {
  it('emits search:add, search:remove, search:search', async () => {
    const { service, ee } = makeService({ fields: ['title'] });
    await service.add('a', { id: 'a', title: 'foo' });
    await service.search('foo');
    await service.remove('a');
    expect(ee.emit).toHaveBeenCalledWith('search:add', expect.objectContaining({ key: 'a' }));
    expect(ee.emit).toHaveBeenCalledWith('search:search', expect.objectContaining({ searchTerm: 'foo' }));
    expect(ee.emit).toHaveBeenCalledWith('search:remove', expect.objectContaining({ key: 'a' }));
  });
});
