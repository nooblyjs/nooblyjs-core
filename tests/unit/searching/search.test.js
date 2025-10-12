/**
 * @fileoverview Unit tests for the search service functionality.
 *
 * This test suite covers the search service provider, testing JSON object
 * indexing, searching, and management across multiple named indexes.
 * Tests verify proper data storage, search functionality across nested objects,
 * multi-index support, and event emission.
 *
 * @author NooblyJS Team
 * @version 1.0.15
 * @since 1.0.0
 */

'use strict';

const createSearchService = require('../../../src/searching');
const EventEmitter = require('events');

/**
 * Test suite for search service operations.
 *
 * Tests the search service functionality including object indexing,
 * search operations, key management, multi-index support, and error handling.
 */
describe('SearchService', () => {
  /** @type {Object} Search service instance for testing */
  let searchService;
  /** @type {EventEmitter} Mock event emitter for testing search events */
  let mockEventEmitter;

  /**
   * Set up test environment before each test case.
   * Creates a fresh search service instance and event emitter spy.
   */
  beforeEach(() => {
    mockEventEmitter = new EventEmitter();
    jest.spyOn(mockEventEmitter, 'emit');
    searchService = createSearchService('default', {}, mockEventEmitter);
  });

  /**
   * Helper function to get the default index for testing.
   * @return {Map} The default index Map
   */
  const getDefaultIndex = () => searchService.indexes.get('default');

  /**
   * Test adding JSON objects with unique keys.
   *
   * Verifies that objects can be added with unique keys and that
   * duplicate key attempts are properly handled with error events.
   */
  it('should add a JSON object with a unique key', async () => {
    const key1 = 'key1';
    const obj1 = { id: 1, name: 'Test Object 1' };
    expect(await searchService.add(key1, obj1)).toBe(true);
    expect(getDefaultIndex().size).toBe(1);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:add', {
      jsonObject: obj1,
      key: key1,
      searchContainer: 'default',
    });

    // Try adding with the same key, should return false
    mockEventEmitter.emit.mockClear();
    expect(await searchService.add(key1, { id: 2, name: 'Another Object' })).toBe(
      false,
    );
    expect(getDefaultIndex().size).toBe(1); // Size should remain 1
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:add:error', {
      jsonObject: { id: 2, name: 'Another Object' },
      key: 'key1',
      searchContainer: 'default',
      error: 'Key already exists.',
    });
  });

  /**
   * Test removing JSON objects by key.
   *
   * Verifies that objects can be removed by their keys and that
   * removal of non-existent keys is handled gracefully.
   */
  it('should remove a JSON object by its key', async () => {
    const key1 = 'key1';
    const obj1 = { id: 1, name: 'Test Object 1' };
    const key2 = 'key2';
    const obj2 = { id: 2, name: 'Test Object 2' };

    await searchService.add(key1, obj1);
    await searchService.add(key2, obj2);
    expect(getDefaultIndex().size).toBe(2);

    mockEventEmitter.emit.mockClear();
    expect(await searchService.remove(key1)).toBe(true);
    expect(getDefaultIndex().has(key1)).toBe(false);
    expect(getDefaultIndex().size).toBe(1);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:remove', {
      key: key1,
      searchContainer: 'default',
    });

    // Try removing a non-existent key, should return false
    mockEventEmitter.emit.mockClear();
    expect(await searchService.remove('nonExistentKey')).toBe(false);
    expect(getDefaultIndex().size).toBe(1);
    expect(mockEventEmitter.emit).not.toHaveBeenCalledWith('search:remove', {
      key: 'nonExistentKey',
      searchContainer: 'default',
    });
  });

  /**
   * Test case-insensitive search across all string values.
   *
   * Verifies that search works across all string values in objects,
   * including nested objects, with case-insensitive matching.
   */
  it('should search for a term across all string values (case-insensitive)', async () => {
    const obj1 = { id: 1, name: 'Apple', description: 'A red fruit.' };
    const obj2 = { id: 2, name: 'Banana', description: 'A yellow fruit.' };
    const obj3 = { id: 3, name: 'Cherry', description: 'A small red fruit.' };
    const obj4 = {
      id: 4,
      name: 'Date',
      details: { color: 'brown', taste: 'sweet' },
    };

    await searchService.add('obj1', obj1);
    await searchService.add('obj2', obj2);
    await searchService.add('obj3', obj3);
    await searchService.add('obj4', obj4);

    mockEventEmitter.emit.mockClear();
    // Search for 'fruit' (case-insensitive)
    let results = await searchService.search('fruit');
    expect(results).toEqual(expect.arrayContaining([
      {key: 'obj1', obj: obj1},
      {key: 'obj2', obj: obj2},
      {key: 'obj3', obj: obj3}
    ]));
    expect(results.length).toBe(3);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:search', {
      searchTerm: 'fruit',
      searchContainer: 'default',
      results,
    });

    mockEventEmitter.emit.mockClear();
    // Search for 'red'
    results = await searchService.search('red');
    expect(results).toEqual(expect.arrayContaining([{key: 'obj1', obj: obj1}, {key: 'obj3', obj: obj3}]));
    expect(results.length).toBe(2);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:search', {
      searchTerm: 'red',
      searchContainer: 'default',
      results,
    });

    mockEventEmitter.emit.mockClear();
    // Search for 'yellow'
    results = await searchService.search('yellow');
    expect(results).toEqual(expect.arrayContaining([{key: 'obj2', obj: obj2}]));
    expect(results.length).toBe(1);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:search', {
      searchTerm: 'yellow',
      searchContainer: 'default',
      results,
    });

    mockEventEmitter.emit.mockClear();
    // Search for a term that doesn't exist
    results = await searchService.search('grape');
    expect(results).toEqual([]);
    expect(results.length).toBe(0);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:search', {
      searchTerm: 'grape',
      searchContainer: 'default',
      results: [],
    });

    mockEventEmitter.emit.mockClear();
    // Search for a term in a nested object
    results = await searchService.search('brown');
    expect(results).toEqual(expect.arrayContaining([{key: 'obj4', obj: obj4}]));
    expect(results.length).toBe(1);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:search', {
      searchTerm: 'brown',
      searchContainer: 'default',
      results,
    });

    // Search for a term that is part of a key, not a value
    const obj5 = { id: 5, fruitName: 'Orange' };
    await searchService.add('obj5', obj5);
    mockEventEmitter.emit.mockClear();
    results = await searchService.search('fruitName');
    expect(results).toEqual([]);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:search', {
      searchTerm: 'fruitName',
      searchContainer: 'default',
      results: [],
    });
  });

  /**
   * Test search behavior with empty index.
   *
   * Verifies that searching returns empty results when no objects
   * have been added to the search index.
   */
  it('should return an empty array if no objects are added', async () => {
    mockEventEmitter.emit.mockClear();
    const results = await searchService.search('anything');
    expect(results).toEqual([]);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:search', {
      searchTerm: 'anything',
      searchContainer: 'default',
      results: [],
    });
  });

  /**
   * Test search behavior with empty search term.
   *
   * Verifies that empty search terms return no results and are
   * handled gracefully without errors.
   */
  it('should handle empty search term', async () => {
    const obj1 = { id: 1, name: 'Test Object 1' };
    await searchService.add('obj1', obj1);
    mockEventEmitter.emit.mockClear();
    const results = await searchService.search('');
    expect(results).toEqual([]);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:search', {
      searchTerm: '',
      searchContainer: 'default',
      results: [],
    });
  });

  /**
   * Test suite for multi-index support.
   *
   * Tests all multi-index functionality including creating indexes,
   * adding/searching/removing documents across indexes, and index management.
   */
  describe('Multi-Index Support', () => {
    /**
     * Test creating and using multiple indexes.
     *
     * Verifies that multiple named indexes can be created and used
     * independently with proper event emission.
     */
    it('should create and use multiple indexes', async () => {
      const products = { id: 1, name: 'Laptop', category: 'Electronics' };
      const people = { id: 1, name: 'John Doe', role: 'Developer' };
      const articles = { id: 1, title: 'Node.js Guide', topic: 'Programming' };

      mockEventEmitter.emit.mockClear();

      // Add to different indexes
      await searchService.add('prod1', products, 'products');
      await searchService.add('person1', people, 'people');
      await searchService.add('article1', articles, 'articles');

      // Verify indexes were created
      expect(searchService.indexes.has('products')).toBe(true);
      expect(searchService.indexes.has('people')).toBe(true);
      expect(searchService.indexes.has('articles')).toBe(true);

      // Verify index creation events were emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:index:created', {
        searchContainer: 'products',
        totalIndexes: 2 // includes default
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:index:created', {
        searchContainer: 'people',
        totalIndexes: 3
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:index:created', {
        searchContainer: 'articles',
        totalIndexes: 4
      });

      // Verify each index has the correct data
      expect(searchService.indexes.get('products').size).toBe(1);
      expect(searchService.indexes.get('people').size).toBe(1);
      expect(searchService.indexes.get('articles').size).toBe(1);
    });

    /**
     * Test adding documents to different indexes.
     *
     * Verifies that documents can be added to specific indexes
     * and that each index maintains its own separate data.
     */
    it('should add documents to different indexes', async () => {
      const doc1 = { id: 1, content: 'First document' };
      const doc2 = { id: 2, content: 'Second document' };
      const doc3 = { id: 3, content: 'Third document' };

      await searchService.add('doc1', doc1, 'indexA');
      await searchService.add('doc2', doc2, 'indexA');
      await searchService.add('doc3', doc3, 'indexB');

      expect(searchService.indexes.get('indexA').size).toBe(2);
      expect(searchService.indexes.get('indexB').size).toBe(1);
      expect(searchService.indexes.get('indexA').get('doc1')).toEqual(doc1);
      expect(searchService.indexes.get('indexA').get('doc2')).toEqual(doc2);
      expect(searchService.indexes.get('indexB').get('doc3')).toEqual(doc3);
    });

    /**
     * Test searching within specific indexes.
     *
     * Verifies that search operations can be scoped to specific indexes
     * and only return results from the specified index.
     */
    it('should search within specific indexes', async () => {
      const laptop = { id: 1, name: 'Laptop', category: 'Electronics' };
      const mouse = { id: 2, name: 'Mouse', category: 'Electronics' };
      const book = { id: 3, name: 'Electronics Guide', category: 'Books' };

      await searchService.add('prod1', laptop, 'products');
      await searchService.add('prod2', mouse, 'products');
      await searchService.add('book1', book, 'books');

      mockEventEmitter.emit.mockClear();

      // Search in products index
      const productResults = await searchService.search('Electronics', 'products');
      expect(productResults.length).toBe(2);
      expect(productResults).toEqual(expect.arrayContaining([
        { key: 'prod1', obj: laptop },
        { key: 'prod2', obj: mouse }
      ]));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:search', {
        searchTerm: 'Electronics',
        searchContainer: 'products',
        results: productResults,
      });

      mockEventEmitter.emit.mockClear();

      // Search in books index
      const bookResults = await searchService.search('Electronics', 'books');
      expect(bookResults.length).toBe(1);
      expect(bookResults).toEqual([{ key: 'book1', obj: book }]);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:search', {
        searchTerm: 'Electronics',
        searchContainer: 'books',
        results: bookResults,
      });
    });

    /**
     * Test removing documents from specific indexes.
     *
     * Verifies that documents can be removed from specific indexes
     * without affecting other indexes.
     */
    it('should remove documents from specific indexes', async () => {
      const doc1 = { id: 1, content: 'Document 1' };
      const doc2 = { id: 2, content: 'Document 2' };

      await searchService.add('doc1', doc1, 'indexA');
      await searchService.add('doc1', doc2, 'indexB'); // Same key, different index

      expect(searchService.indexes.get('indexA').size).toBe(1);
      expect(searchService.indexes.get('indexB').size).toBe(1);

      mockEventEmitter.emit.mockClear();

      // Remove from indexA only
      const removed = await searchService.remove('doc1', 'indexA');
      expect(removed).toBe(true);
      expect(searchService.indexes.get('indexA').size).toBe(0);
      expect(searchService.indexes.get('indexB').size).toBe(1); // indexB unchanged
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:remove', {
        key: 'doc1',
        searchContainer: 'indexA',
      });
    });

    /**
     * Test listIndexes() method.
     *
     * Verifies that listIndexes returns all index names including
     * the default index and any created indexes.
     */
    it('should list all indexes using listIndexes()', () => {
      // Initially should have only default index
      expect(searchService.listIndexes()).toEqual(['default']);

      // Add data to create new indexes
      searchService.add('key1', { data: 'value1' }, 'index1');
      searchService.add('key2', { data: 'value2' }, 'index2');

      const indexes = searchService.listIndexes();
      expect(indexes.length).toBe(3);
      expect(indexes).toContain('default');
      expect(indexes).toContain('index1');
      expect(indexes).toContain('index2');
    });

    /**
     * Test getIndexStats(searchContainer) method.
     *
     * Verifies that getIndexStats returns correct statistics
     * for a specific index including size and keys.
     */
    it('should get statistics for a specific index using getIndexStats()', async () => {
      await searchService.add('key1', { data: 'value1' }, 'testIndex');
      await searchService.add('key2', { data: 'value2' }, 'testIndex');
      await searchService.add('key3', { data: 'value3' }, 'testIndex');

      const stats = searchService.getIndexStats('testIndex');
      expect(stats).toEqual({
        searchContainer: 'testIndex',
        size: 3,
        keys: ['key1', 'key2', 'key3']
      });
    });

    /**
     * Test clearIndex(searchContainer) method.
     *
     * Verifies that clearIndex removes all documents from an index
     * while keeping the index itself intact.
     */
    it('should clear all data from a specific index using clearIndex()', async () => {
      await searchService.add('key1', { data: 'value1' }, 'testIndex');
      await searchService.add('key2', { data: 'value2' }, 'testIndex');
      await searchService.add('key3', { data: 'value3' }, 'testIndex');

      expect(searchService.indexes.get('testIndex').size).toBe(3);

      mockEventEmitter.emit.mockClear();

      const result = searchService.clearIndex('testIndex');
      expect(result).toBe(true);
      expect(searchService.indexes.get('testIndex').size).toBe(0);
      expect(searchService.indexes.has('testIndex')).toBe(true); // Index still exists
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:index:cleared', {
        searchContainer: 'testIndex',
        previousSize: 3
      });
    });

    /**
     * Test deleteIndex(searchContainer) method.
     *
     * Verifies that deleteIndex completely removes an index
     * and emits appropriate events.
     */
    it('should delete an index using deleteIndex()', async () => {
      await searchService.add('key1', { data: 'value1' }, 'testIndex');
      await searchService.add('key2', { data: 'value2' }, 'testIndex');

      expect(searchService.indexes.has('testIndex')).toBe(true);

      mockEventEmitter.emit.mockClear();

      const result = searchService.deleteIndex('testIndex');
      expect(result).toBe(true);
      expect(searchService.indexes.has('testIndex')).toBe(false);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('search:index:deleted', {
        searchContainer: 'testIndex',
        deletedSize: 2,
        remainingIndexes: 1 // Only default index remains
      });
    });

    /**
     * Test that deleting default index throws error.
     *
     * Verifies that attempting to delete the default index
     * results in an error to prevent data loss.
     */
    it('should throw error when attempting to delete default index', () => {
      expect(() => {
        searchService.deleteIndex('default');
      }).toThrow('Cannot delete the default index');

      // Verify default index still exists
      expect(searchService.indexes.has('default')).toBe(true);
    });

    /**
     * Test index isolation.
     *
     * Verifies that documents in one index do not appear in
     * searches of another index, ensuring complete isolation.
     */
    it('should maintain index isolation - documents in one index do not appear in another', async () => {
      const electronics = { id: 1, name: 'Laptop', type: 'computer' };
      const food = { id: 2, name: 'Apple', type: 'fruit' };
      const clothing = { id: 3, name: 'Laptop Bag', type: 'accessory' };

      await searchService.add('item1', electronics, 'electronics');
      await searchService.add('item2', food, 'groceries');
      await searchService.add('item3', clothing, 'clothing');

      // Search for 'Laptop' in electronics - should find it
      const electronicsResults = await searchService.search('Laptop', 'electronics');
      expect(electronicsResults.length).toBe(1);
      expect(electronicsResults[0].key).toBe('item1');

      // Search for 'Laptop' in groceries - should not find anything
      const groceriesResults = await searchService.search('Laptop', 'groceries');
      expect(groceriesResults.length).toBe(0);

      // Search for 'Laptop' in clothing - should find laptop bag
      const clothingResults = await searchService.search('Laptop', 'clothing');
      expect(clothingResults.length).toBe(1);
      expect(clothingResults[0].key).toBe('item3');

      // Search for 'Apple' in groceries - should find it
      const appleInGroceries = await searchService.search('Apple', 'groceries');
      expect(appleInGroceries.length).toBe(1);
      expect(appleInGroceries[0].key).toBe('item2');

      // Search for 'Apple' in electronics - should not find anything
      const appleInElectronics = await searchService.search('Apple', 'electronics');
      expect(appleInElectronics.length).toBe(0);

      // Verify default index remains empty and isolated
      const defaultResults = await searchService.search('Laptop', 'default');
      expect(defaultResults.length).toBe(0);
    });

    /**
     * Test getStats with specific index.
     *
     * Verifies that getStats(searchContainer) returns statistics
     * for a specific index when provided.
     */
    it('should get stats for a specific index when searchContainer is provided', async () => {
      await searchService.add('key1', { data: 'value1' }, 'testIndex');
      await searchService.add('key2', { data: 'value2' }, 'testIndex');

      const stats = await searchService.getStats('testIndex');
      expect(stats).toEqual({
        searchContainer: 'testIndex',
        indexedItems: 2,
        queueName: 'noobly-core-searching',
        queueSize: 0
      });
    });

    /**
     * Test getStats without searchContainer returns aggregated stats.
     *
     * Verifies that getStats() without parameters returns
     * aggregated statistics across all indexes.
     */
    it('should get aggregated stats when no searchContainer is provided', async () => {
      await searchService.add('key1', { data: 'value1' }, 'index1');
      await searchService.add('key2', { data: 'value2' }, 'index1');
      await searchService.add('key3', { data: 'value3' }, 'index2');

      const stats = await searchService.getStats();
      expect(stats).toEqual({
        totalIndexes: 3, // default, index1, index2
        totalIndexedItems: 3,
        indexStats: {
          default: 0,
          index1: 2,
          index2: 1
        },
        queueName: 'noobly-core-searching',
        queueSize: 0
      });
    });
  });
});
