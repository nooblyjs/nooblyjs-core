/**
 * @fileoverview Unit tests for the local search service (default provider).
 *
 * The 'default' provider is the single local search engine — a field-aware
 * token index with BM25 scoring. With no `fields` configured it falls back to a
 * synthetic `_all` field that stringifies the whole document, so callers can
 * just `add(key, obj)` and `search(term)`. This suite covers that backward-
 * compatible surface plus multi-index (container) management and events.
 *
 * Field-aware indexing, prefix/fuzzy matching, autoSuggest, bulk operations and
 * disk persistence are covered by searchTokens.test.js (same engine, 'tokens'
 * alias).
 *
 * @author NooblyJS Team
 * @version 3.0.0
 * @since 1.0.0
 */

'use strict';

const createSearchService = require('../../../src/searching');
const EventEmitter = require('events');

describe('SearchService (default/local engine)', () => {
  /** @type {Object} Search service instance for testing */
  let searchService;
  /** @type {EventEmitter} Mock event emitter for testing search events */
  let mockEventEmitter;

  beforeEach(() => {
    mockEventEmitter = new EventEmitter();
    jest.spyOn(mockEventEmitter, 'emit');
    searchService = createSearchService('default', {}, mockEventEmitter);
  });

  /**
   * Helper: documents Map for a container (the merged engine stores documents
   * per-container rather than in a flat `indexes` Map).
   * @param {string} [name='default']
   * @return {Map<string, Object>}
   */
  const docs = (name = 'default') => searchService.containers.get(name).documents;

  it('should add a JSON object with a unique key', async () => {
    const key1 = 'key1';
    const obj1 = { id: 1, name: 'Test Object 1' };
    expect(await searchService.add(key1, obj1)).toBe(true);
    expect(docs().size).toBe(1);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:add', {
      jsonObject: obj1,
      key: key1,
      searchContainer: 'default',
    });

    // Adding with the same key should return false and emit an error event.
    mockEventEmitter.emit.mockClear();
    expect(await searchService.add(key1, { id: 2, name: 'Another Object' })).toBe(false);
    expect(docs().size).toBe(1); // Size should remain 1
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:add:error', {
      jsonObject: { id: 2, name: 'Another Object' },
      key: 'key1',
      searchContainer: 'default',
      error: 'Key already exists.',
    });
  });

  it('should remove a JSON object by its key', async () => {
    const obj1 = { id: 1, name: 'Test Object 1' };
    const obj2 = { id: 2, name: 'Test Object 2' };

    await searchService.add('key1', obj1);
    await searchService.add('key2', obj2);
    expect(docs().size).toBe(2);

    mockEventEmitter.emit.mockClear();
    expect(await searchService.remove('key1')).toBe(true);
    expect(docs().has('key1')).toBe(false);
    expect(docs().size).toBe(1);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:remove', {
      key: 'key1',
      searchContainer: 'default',
    });

    // Removing a non-existent key should return false.
    mockEventEmitter.emit.mockClear();
    expect(await searchService.remove('nonExistentKey')).toBe(false);
    expect(docs().size).toBe(1);
    expect(mockEventEmitter.emit).not.toHaveBeenCalledWith('search:remove', {
      key: 'nonExistentKey',
      searchContainer: 'default',
    });
  });

  it('should search across all values (case-insensitive, token-based)', async () => {
    const obj1 = { id: 1, name: 'Apple', description: 'A red fruit.' };
    const obj2 = { id: 2, name: 'Banana', description: 'A yellow fruit.' };
    const obj3 = { id: 3, name: 'Cherry', description: 'A small red fruit.' };
    const obj4 = { id: 4, name: 'Date', details: { color: 'brown', taste: 'sweet' } };

    await searchService.add('obj1', obj1);
    await searchService.add('obj2', obj2);
    await searchService.add('obj3', obj3);
    await searchService.add('obj4', obj4);

    // 'fruit' appears in obj1, obj2, obj3.
    let results = await searchService.search('fruit');
    expect(results.length).toBe(3);
    expect(results.map(r => r.key).sort()).toEqual(['obj1', 'obj2', 'obj3']);
    // With no `fields` configured, the original document round-trips via `obj`.
    expect(results.find(r => r.key === 'obj1').obj).toEqual(obj1);

    // 'red' appears in obj1 and obj3.
    results = await searchService.search('red');
    expect(results.map(r => r.key).sort()).toEqual(['obj1', 'obj3']);

    // 'yellow' appears only in obj2.
    results = await searchService.search('yellow');
    expect(results.map(r => r.key)).toEqual(['obj2']);

    // A term present only in a nested object value still matches.
    results = await searchService.search('brown');
    expect(results.map(r => r.key)).toEqual(['obj4']);

    // A term that doesn't exist returns nothing, and a count is emitted.
    mockEventEmitter.emit.mockClear();
    results = await searchService.search('grape');
    expect(results).toEqual([]);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:search', {
      searchTerm: 'grape',
      searchContainer: 'default',
      results: 0,
    });
  });

  it('should return an empty array if no objects are added', async () => {
    const results = await searchService.search('anything');
    expect(results).toEqual([]);
  });

  it('should throw on empty search term', async () => {
    await searchService.add('obj1', { id: 1, name: 'Test Object 1' });
    await expect(searchService.search('')).rejects.toThrow(
      'Invalid searchTerm: must be a non-empty string'
    );
  });

  it('should not cap results — returns every match by default', async () => {
    // Index well beyond the legacy 20-result cap to prove there is no limit
    // unless maxResults is explicitly supplied.
    for (let i = 0; i < 50; i++) {
      await searchService.add(`doc${i}`, { id: i, text: 'widget gadget' });
    }
    const all = await searchService.search('widget');
    expect(all.length).toBe(50);

    const limited = await searchService.search('widget', { maxResults: 10 });
    expect(limited.length).toBe(10);
  });

  describe('Multi-Index (container) Support', () => {
    it('should create and use multiple indexes', async () => {
      await searchService.add('prod1', { id: 1, name: 'Laptop', category: 'Electronics' }, 'products');
      await searchService.add('person1', { id: 1, name: 'John Doe', role: 'Developer' }, 'people');
      await searchService.add('article1', { id: 1, title: 'Node.js Guide', topic: 'Programming' }, 'articles');

      expect(searchService.containers.has('products')).toBe(true);
      expect(searchService.containers.has('people')).toBe(true);
      expect(searchService.containers.has('articles')).toBe(true);

      expect(docs('products').size).toBe(1);
      expect(docs('people').size).toBe(1);
      expect(docs('articles').size).toBe(1);
    });

    it('should keep documents in separate indexes', async () => {
      await searchService.add('doc1', { id: 1, content: 'First document' }, 'indexA');
      await searchService.add('doc2', { id: 2, content: 'Second document' }, 'indexA');
      await searchService.add('doc3', { id: 3, content: 'Third document' }, 'indexB');

      expect(docs('indexA').size).toBe(2);
      expect(docs('indexB').size).toBe(1);
      expect(docs('indexA').has('doc1')).toBe(true);
      expect(docs('indexB').has('doc3')).toBe(true);
    });

    it('should search within specific indexes', async () => {
      await searchService.add('prod1', { id: 1, name: 'Laptop', category: 'Electronics' }, 'products');
      await searchService.add('prod2', { id: 2, name: 'Mouse', category: 'Electronics' }, 'products');
      await searchService.add('book1', { id: 3, name: 'Electronics Guide', category: 'Books' }, 'books');

      const productResults = await searchService.search('Electronics', 'products');
      expect(productResults.length).toBe(2);
      expect(productResults.map(r => r.key).sort()).toEqual(['prod1', 'prod2']);

      const bookResults = await searchService.search('Electronics', 'books');
      expect(bookResults.length).toBe(1);
      expect(bookResults[0].key).toBe('book1');
    });

    it('should remove documents from specific indexes', async () => {
      await searchService.add('doc1', { id: 1, content: 'Document 1' }, 'indexA');
      await searchService.add('doc1', { id: 2, content: 'Document 2' }, 'indexB'); // same key, different index

      expect(docs('indexA').size).toBe(1);
      expect(docs('indexB').size).toBe(1);

      mockEventEmitter.emit.mockClear();
      const removed = await searchService.remove('doc1', 'indexA');
      expect(removed).toBe(true);
      expect(docs('indexA').size).toBe(0);
      expect(docs('indexB').size).toBe(1); // indexB unchanged
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:remove', {
        key: 'doc1',
        searchContainer: 'indexA',
      });
    });

    it('should list all indexes using listIndexes()', async () => {
      expect(searchService.listIndexes()).toEqual(['default']);

      await searchService.add('key1', { data: 'value1' }, 'index1');
      await searchService.add('key2', { data: 'value2' }, 'index2');

      const indexes = searchService.listIndexes();
      expect(indexes.length).toBe(3);
      expect(indexes).toEqual(expect.arrayContaining(['default', 'index1', 'index2']));
    });

    it('should get statistics for a specific index using getIndexStats()', async () => {
      await searchService.add('key1', { data: 'value1' }, 'testIndex');
      await searchService.add('key2', { data: 'value2' }, 'testIndex');
      await searchService.add('key3', { data: 'value3' }, 'testIndex');

      const stats = searchService.getIndexStats('testIndex');
      expect(stats).toMatchObject({
        searchContainer: 'testIndex',
        size: 3,
        keys: ['key1', 'key2', 'key3'],
      });
      expect(stats.tokenCount).toBeGreaterThan(0);
    });

    it('should clear all data from a specific index using clearIndex()', async () => {
      await searchService.add('key1', { data: 'value1' }, 'testIndex');
      await searchService.add('key2', { data: 'value2' }, 'testIndex');
      await searchService.add('key3', { data: 'value3' }, 'testIndex');

      expect(docs('testIndex').size).toBe(3);

      mockEventEmitter.emit.mockClear();
      const result = searchService.clearIndex('testIndex');
      expect(result).toBe(true);
      expect(docs('testIndex').size).toBe(0);
      expect(searchService.containers.has('testIndex')).toBe(true); // Index still exists
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:index:cleared', {
        searchContainer: 'testIndex',
        previousSize: 3,
      });
    });

    it('should delete an index using deleteIndex()', async () => {
      await searchService.add('key1', { data: 'value1' }, 'testIndex');
      await searchService.add('key2', { data: 'value2' }, 'testIndex');

      expect(searchService.containers.has('testIndex')).toBe(true);

      mockEventEmitter.emit.mockClear();
      const result = searchService.deleteIndex('testIndex');
      expect(result).toBe(true);
      expect(searchService.containers.has('testIndex')).toBe(false);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:index:deleted', {
        searchContainer: 'testIndex',
        remainingContainers: 1, // Only default remains
      });
    });

    it('should throw error when attempting to delete default index', () => {
      expect(() => searchService.deleteIndex('default')).toThrow('Cannot delete the default index');
      expect(searchService.containers.has('default')).toBe(true);
    });

    it('should maintain index isolation', async () => {
      await searchService.add('item1', { id: 1, name: 'Laptop', type: 'computer' }, 'electronics');
      await searchService.add('item2', { id: 2, name: 'Apple', type: 'fruit' }, 'groceries');
      await searchService.add('item3', { id: 3, name: 'Laptop Bag', type: 'accessory' }, 'clothing');

      const electronicsResults = await searchService.search('Laptop', 'electronics');
      expect(electronicsResults.length).toBe(1);
      expect(electronicsResults[0].key).toBe('item1');

      expect((await searchService.search('Laptop', 'groceries')).length).toBe(0);

      const clothingResults = await searchService.search('Laptop', 'clothing');
      expect(clothingResults.length).toBe(1);
      expect(clothingResults[0].key).toBe('item3');

      const appleInGroceries = await searchService.search('Apple', 'groceries');
      expect(appleInGroceries.length).toBe(1);
      expect(appleInGroceries[0].key).toBe('item2');

      expect((await searchService.search('Apple', 'electronics')).length).toBe(0);
      expect((await searchService.search('Laptop', 'default')).length).toBe(0);
    });

    it('should get stats for a specific index when searchContainer is provided', async () => {
      await searchService.add('key1', { data: 'value1' }, 'testIndex');
      await searchService.add('key2', { data: 'value2' }, 'testIndex');

      const stats = await searchService.getStats('testIndex');
      expect(stats).toMatchObject({
        searchContainer: 'testIndex',
        totalDocuments: 2,
        indexedDocuments: 2,
      });
      expect(stats.totalTokens).toBeGreaterThan(0);
    });

    it('should get aggregated stats when no searchContainer is provided', async () => {
      await searchService.add('key1', { data: 'value1' }, 'index1');
      await searchService.add('key2', { data: 'value2' }, 'index1');
      await searchService.add('key3', { data: 'value3' }, 'index2');

      const stats = await searchService.getStats();
      expect(stats).toMatchObject({
        totalContainers: 3, // default, index1, index2
        totalDocuments: 3,
        indexedDocuments: 3,
      });
    });
  });
});
