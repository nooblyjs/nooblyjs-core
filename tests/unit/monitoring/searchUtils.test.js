/**
 * @fileoverview Tests for Monitoring Search Utilities
 */

'use strict';

const MonitoringSearchEngine = require('../../../src/monitoring/utils/searchUtils');

describe('MonitoringSearchEngine', () => {
  let engine;
  let mockTraces;
  let mockMetrics;

  beforeEach(() => {
    engine = new MonitoringSearchEngine({ maxResults: 100 });

    mockTraces = [
      {
        traceId: 'trace-1',
        initiatingService: 'web-api',
        initiatingEndpoint: '/api/users',
        status: 'success',
        duration: 150,
        startTime: Date.now() - 5000,
        endTime: Date.now() - 4850,
        services: ['web-api', 'user-service', 'cache'],
        spanCount: 5,
        errorSpans: 0,
        metadata: {}
      },
      {
        traceId: 'trace-2',
        initiatingService: 'web-api',
        initiatingEndpoint: '/api/orders',
        status: 'error',
        duration: 2500,
        startTime: Date.now() - 3000,
        endTime: Date.now() - 500,
        services: ['web-api', 'order-service', 'payment-service'],
        spanCount: 8,
        errorSpans: 2,
        metadata: { error: 'Payment timeout' }
      },
      {
        traceId: 'trace-3',
        initiatingService: 'worker',
        initiatingEndpoint: '/jobs/process',
        status: 'success',
        duration: 5000,
        startTime: Date.now() - 6000,
        endTime: Date.now() - 1000,
        services: ['worker', 'dataservice', 'queue'],
        spanCount: 10,
        errorSpans: 0,
        metadata: {}
      }
    ];

    mockMetrics = [
      {
        serviceName: 'web-api',
        endpoint: '/api/users',
        operation: 'GET',
        totalCalls: 1000,
        totalErrors: 50,
        avgLatency: 45,
        timestamp: Date.now()
      },
      {
        serviceName: 'order-service',
        endpoint: '/api/orders',
        operation: 'POST',
        totalCalls: 500,
        totalErrors: 25,
        avgLatency: 200,
        timestamp: Date.now()
      }
    ];
  });

  describe('initialization', () => {
    it('should create search engine', () => {
      expect(engine).toBeDefined();
      expect(typeof engine.searchTraces).toBe('function');
    });

    it('should set default max results', () => {
      const defaultEngine = new MonitoringSearchEngine();
      expect(defaultEngine.maxResults).toBe(100);
    });

    it('should accept custom max results', () => {
      const customEngine = new MonitoringSearchEngine({ maxResults: 50 });
      expect(customEngine.maxResults).toBe(50);
    });
  });

  describe('searchTraces', () => {
    it('should return all traces without query', () => {
      const results = engine.searchTraces(mockTraces, {});
      expect(results.length).toBe(3);
    });

    it('should search by full-text query', () => {
      const results = engine.searchTraces(mockTraces, { query: 'user' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.initiatingEndpoint.includes('users'))).toBe(true);
    });

    it('should search by service name', () => {
      const results = engine.searchTraces(mockTraces, {
        query: 'web-api'
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should filter by service', () => {
      const results = engine.searchTraces(mockTraces, {
        filters: { service: 'worker' }
      });
      expect(results.length).toBe(1);
      expect(results[0].initiatingService).toBe('worker');
    });

    it('should filter by status', () => {
      const results = engine.searchTraces(mockTraces, {
        filters: { status: 'error' }
      });
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('error');
    });

    it('should filter by duration', () => {
      const results = engine.searchTraces(mockTraces, {
        filters: { minDuration: 1000, maxDuration: 3000 }
      });
      expect(results.length).toBe(1);
      expect(results[0].traceId).toBe('trace-2');
    });

    it('should filter by error spans', () => {
      const results = engine.searchTraces(mockTraces, {
        filters: { minErrors: 1 }
      });
      expect(results.length).toBe(1);
      expect(results[0].errorSpans).toBeGreaterThan(0);
    });

    it('should combine filters', () => {
      const results = engine.searchTraces(mockTraces, {
        filters: {
          service: 'web-api',
          status: 'success'
        }
      });
      expect(results.length).toBe(1);
      expect(results[0].traceId).toBe('trace-1');
    });

    it('should sort by timestamp', () => {
      const results = engine.searchTraces(mockTraces, {
        sortBy: 'startTime',
        sortOrder: 'desc'
      });
      expect(results[0].startTime >= results[1].startTime).toBe(true);
    });

    it('should sort by duration', () => {
      const results = engine.searchTraces(mockTraces, {
        sortBy: 'duration',
        sortOrder: 'asc'
      });
      expect(results[0].duration <= results[1].duration).toBe(true);
    });

    it('should respect result limit', () => {
      const results = engine.searchTraces(mockTraces, { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should remove internal fields from results', () => {
      const results = engine.searchTraces(mockTraces, { query: 'api' });
      results.forEach(trace => {
        expect(trace._relevance).toBeUndefined();
      });
    });
  });

  describe('searchMetrics', () => {
    it('should search metrics by service', () => {
      const results = engine.searchMetrics(mockMetrics, {
        filters: { service: 'web-api' }
      });
      expect(results.length).toBe(1);
      expect(results[0].serviceName).toBe('web-api');
    });

    it('should filter metrics by calls', () => {
      const results = engine.searchMetrics(mockMetrics, {
        filters: { minCalls: 600 }
      });
      expect(results.length).toBe(1);
      expect(results[0].totalCalls).toBeGreaterThanOrEqual(600);
    });

    it('should filter metrics by errors', () => {
      const results = engine.searchMetrics(mockMetrics, {
        filters: { minErrors: 30 }
      });
      expect(results.length).toBe(1);
    });

    it('should filter metrics by latency', () => {
      const results = engine.searchMetrics(mockMetrics, {
        filters: { minLatency: 100 }
      });
      expect(results.length).toBe(1);
      expect(results[0].avgLatency >= 100).toBe(true);
    });

    it('should search metrics by full-text', () => {
      const results = engine.searchMetrics(mockMetrics, {
        query: 'order'
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should respect limit on metrics', () => {
      const results = engine.searchMetrics(mockMetrics, { limit: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getFacets', () => {
    it('should extract unique services', () => {
      const facets = engine.getFacets(mockTraces);
      expect(Array.isArray(facets.services)).toBe(true);
      expect(facets.services.length).toBeGreaterThan(0);
      expect(facets.services).toContain('web-api');
    });

    it('should extract unique statuses', () => {
      const facets = engine.getFacets(mockTraces);
      expect(facets.statuses).toContain('success');
      expect(facets.statuses).toContain('error');
    });

    it('should extract unique endpoints', () => {
      const facets = engine.getFacets(mockTraces);
      expect(Array.isArray(facets.endpoints)).toBe(true);
      expect(facets.endpoints).toContain('/api/users');
    });

    it('should categorize duration ranges', () => {
      const facets = engine.getFacets(mockTraces);
      expect(facets.durationRanges['100-500ms']).toBeGreaterThan(0);
      expect(facets.durationRanges['1000ms+']).toBeGreaterThan(0);
    });
  });

  describe('saved searches', () => {
    it('should save a search', () => {
      const criteria = { filters: { status: 'error' }, limit: 10 };
      engine.saveSearch('error-traces', criteria);

      expect(engine.getSearch('error-traces')).toBeDefined();
    });

    it('should retrieve a saved search', () => {
      const criteria = { filters: { service: 'web-api' } };
      engine.saveSearch('web-api-traces', criteria);

      const retrieved = engine.getSearch('web-api-traces');
      expect(retrieved.filters.service).toBe('web-api');
    });

    it('should list all saved searches', () => {
      engine.saveSearch('search-1', { filters: {} });
      engine.saveSearch('search-2', { filters: { status: 'error' } });

      const list = engine.listSearches();
      expect(list.length).toBe(2);
      expect(list.some(s => s.name === 'search-1')).toBe(true);
    });

    it('should delete a saved search', () => {
      engine.saveSearch('temp-search', { filters: {} });
      const deleted = engine.deleteSearch('temp-search');

      expect(deleted).toBe(true);
      expect(engine.getSearch('temp-search')).toBeNull();
    });

    it('should return false when deleting non-existent search', () => {
      const deleted = engine.deleteSearch('non-existent');
      expect(deleted).toBe(false);
    });

    it('should include saved timestamp', () => {
      engine.saveSearch('timestamped', { filters: {} });
      const search = engine.getSearch('timestamped');

      expect(search.savedAt).toBeDefined();
      expect(typeof search.savedAt).toBe('string');
    });
  });

  describe('relevance scoring', () => {
    it('should rank exact matches highest', () => {
      const results = engine.searchTraces(mockTraces, { query: 'web-api' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].initiatingService).toBe('web-api');
    });

    it('should score prefix matches high', () => {
      const results = engine.searchTraces(mockTraces, { query: 'web' });
      expect(results.some(t => t.initiatingService.startsWith('web'))).toBe(true);
    });

    it('should include substring matches', () => {
      const results = engine.searchTraces(mockTraces, { query: 'api' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle case-insensitive search', () => {
      const results = engine.searchTraces(mockTraces, { query: 'WEB' });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('export', () => {
    it('should export search state', () => {
      engine.saveSearch('test-search', { filters: { status: 'error' } });
      const exported = engine.export();

      expect(exported).toHaveProperty('savedSearches');
      expect(exported).toHaveProperty('timestamp');
      expect(Array.isArray(exported.savedSearches)).toBe(true);
    });

    it('should include timestamp in export', () => {
      const exported = engine.export();
      expect(typeof exported.timestamp).toBe('string');
    });
  });

  describe('reset', () => {
    it('should clear all saved searches', () => {
      engine.saveSearch('search-1', { filters: {} });
      engine.saveSearch('search-2', { filters: {} });

      engine.reset();

      expect(engine.listSearches().length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty traces array', () => {
      const results = engine.searchTraces([], { query: 'test' });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle empty query', () => {
      const results = engine.searchTraces(mockTraces, { query: '' });
      expect(results.length).toBe(3);
    });

    it('should handle null filters', () => {
      const results = engine.searchTraces(mockTraces, { filters: null });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle undefined services array', () => {
      const trace = { traceId: 'test', status: 'success' };
      const results = engine.searchTraces([trace], { filters: { service: 'web' } });
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle missing fields gracefully', () => {
      const incompletTrace = { traceId: 'test' };
      const facets = engine.getFacets([incompletTrace]);

      expect(facets.services).toEqual([]);
      expect(facets.statuses).toEqual([]);
    });
  });
});
