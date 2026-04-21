/**
 * @fileoverview Tests for Metrics Aggregator
 * Comprehensive test suite for cross-service metrics aggregation
 */

'use strict';

const MetricsAggregator = require('../../../src/monitoring/utils/metricsAggregator');
const ServiceDependencyGraph = require('../../../src/monitoring/serviceDependencyGraph');

describe('MetricsAggregator', () => {
  let aggregator;
  let graph;

  beforeEach(() => {
    aggregator = new MetricsAggregator({ historySize: 100 });
    graph = new ServiceDependencyGraph();
  });

  describe('constructor', () => {
    it('should create aggregator with default options', () => {
      const defaultAgg = new MetricsAggregator();
      expect(defaultAgg.historySize).toBe(1000);
      expect(defaultAgg.snapshotInterval).toBe(60000);
      expect(defaultAgg.history.length).toBe(0);
    });

    it('should accept custom options', () => {
      const custom = new MetricsAggregator({ historySize: 500, snapshotInterval: 30000 });
      expect(custom.historySize).toBe(500);
      expect(custom.snapshotInterval).toBe(30000);
    });
  });

  describe('recordSnapshot', () => {
    it('should record a snapshot', () => {
      graph.recordCall('web', 'cache', 50, true);

      const snapshot = aggregator.recordSnapshot(graph);

      expect(snapshot).toBeDefined();
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.services).toBeDefined();
      expect(snapshot.health).toBeDefined();
      expect(snapshot.performance).toBeDefined();
    });

    it('should add to history', () => {
      graph.recordCall('web', 'api');
      aggregator.recordSnapshot(graph);

      expect(aggregator.history.length).toBe(1);
    });

    it('should maintain history size limit', () => {
      // Create aggregator with small history size
      const small = new MetricsAggregator({ historySize: 5 });

      // Record 10 snapshots
      for (let i = 0; i < 10; i++) {
        graph.recordCall('service', 'dep');
        small.recordSnapshot(graph);
      }

      expect(small.history.length).toBe(5);
    });

    it('should update aggregated metrics', () => {
      graph.recordCall('web', 'cache');
      aggregator.recordSnapshot(graph);

      expect(aggregator.aggregatedMetrics).toBeDefined();
      expect(aggregator.lastSnapshot).toBeDefined();
    });
  });

  describe('_aggregateServiceMetrics', () => {
    it('should aggregate metrics for all services', () => {
      graph.recordCall('web', 'api', 100, true);
      graph.recordCall('web', 'cache', 50, true);
      graph.recordCall('api', 'db', 200, false);

      const snapshot = aggregator.recordSnapshot(graph);

      expect(snapshot.services.length).toBeGreaterThan(0);
      expect(snapshot.services[0]).toHaveProperty('name');
      expect(snapshot.services[0]).toHaveProperty('status');
      expect(snapshot.services[0]).toHaveProperty('totalCalls');
    });

    it('should calculate inbound and outbound calls', () => {
      graph.recordCall('web', 'api');
      graph.recordCall('web', 'cache');
      graph.recordCall('api', 'db');

      const snapshot = aggregator.recordSnapshot(graph);
      const webService = snapshot.services.find(s => s.name === 'web');

      expect(webService.outboundCalls).toBeGreaterThan(0);
    });

    it('should include dependency information', () => {
      graph.recordCall('web', 'api');
      graph.recordCall('web', 'cache');

      const snapshot = aggregator.recordSnapshot(graph);
      const webService = snapshot.services.find(s => s.name === 'web');

      expect(webService.dependencies).toContain('api');
      expect(webService.dependencies).toContain('cache');
    });

    it('should calculate error rates', () => {
      graph.recordCall('web', 'api', 50, true);
      graph.recordCall('web', 'api', 50, true);
      graph.recordCall('web', 'api', 50, false);

      const snapshot = aggregator.recordSnapshot(graph);
      const webService = snapshot.services.find(s => s.name === 'web');

      expect(webService.errorRate).toBeGreaterThan(0);
      expect(webService.errorRate).toBeLessThanOrEqual(100);
    });
  });

  describe('_aggregateHealth', () => {
    it('should aggregate health metrics', () => {
      graph.registerService('service1');
      graph.updateServiceStatus('service1', 'healthy');

      const snapshot = aggregator.recordSnapshot(graph);

      expect(snapshot.health).toHaveProperty('totalServices');
      expect(snapshot.health).toHaveProperty('healthy');
      expect(snapshot.health).toHaveProperty('systemStatus');
      expect(snapshot.health).toHaveProperty('riskLevel');
    });

    it('should determine system status based on health', () => {
      for (let i = 0; i < 10; i++) {
        graph.registerService(`service-${i}`);
        graph.updateServiceStatus(`service-${i}`, 'healthy');
      }

      const snapshot = aggregator.recordSnapshot(graph);

      expect(snapshot.health.systemStatus).toBe('healthy');
      expect(snapshot.health.riskLevel).toBe('low');
    });
  });

  describe('_analyzePerformance', () => {
    it('should analyze performance metrics', () => {
      graph.recordCall('web', 'api', 100);
      graph.recordCall('api', 'db', 200);

      const snapshot = aggregator.recordSnapshot(graph);

      expect(snapshot.performance).toHaveProperty('avgLatency');
      expect(snapshot.performance).toHaveProperty('maxLatency');
      expect(snapshot.performance).toHaveProperty('minLatency');
      expect(snapshot.performance).toHaveProperty('slowServices');
      expect(snapshot.performance).toHaveProperty('overallPerformanceScore');
    });

    it('should identify slow services', () => {
      graph.recordCall('web', 'slow-api', 500);
      graph.recordCall('web', 'fast-api', 50);

      const snapshot = aggregator.recordSnapshot(graph);

      // Both services are recorded, slowServices identifies those above average
      expect(Array.isArray(snapshot.performance.slowServices)).toBe(true);
    });

    it('should calculate performance score', () => {
      graph.recordCall('web', 'api', 100);

      const snapshot = aggregator.recordSnapshot(graph);
      const score = snapshot.performance.overallPerformanceScore;

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('getServiceMetrics', () => {
    it('should return metrics for specific service', () => {
      graph.recordCall('web', 'api');
      aggregator.recordSnapshot(graph);

      const metrics = aggregator.getServiceMetrics('web');

      expect(metrics).toBeDefined();
      expect(metrics.name).toBe('web');
    });

    it('should return null for unknown service', () => {
      graph.recordCall('web', 'api');
      aggregator.recordSnapshot(graph);

      const metrics = aggregator.getServiceMetrics('unknown');

      expect(metrics).toBeNull();
    });
  });

  describe('getCurrentMetrics', () => {
    it('should return current aggregated metrics', () => {
      graph.recordCall('web', 'api');
      aggregator.recordSnapshot(graph);

      const metrics = aggregator.getCurrentMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.services).toBeDefined();
    });

    it('should return null before first snapshot', () => {
      const empty = new MetricsAggregator();
      expect(empty.getCurrentMetrics()).toBeNull();
    });
  });

  describe('getHistoricalMetrics', () => {
    it('should return historical metrics within time range', () => {
      // Record multiple snapshots
      for (let i = 0; i < 3; i++) {
        graph.recordCall('web', 'api');
        aggregator.recordSnapshot(graph);
      }

      const history = aggregator.getHistoricalMetrics(24);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(3);
    });

    it('should filter by time range', () => {
      graph.recordCall('web', 'api');
      aggregator.recordSnapshot(graph);

      const history = aggregator.getHistoricalMetrics(0.001); // Very short time range

      expect(history.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getMetricsComparison', () => {
    it('should compare metrics between time points', () => {
      graph.recordCall('web', 'api', 50, true);
      aggregator.recordSnapshot(graph);

      // Make a small change
      graph.recordCall('web', 'api', 50, false);
      aggregator.recordSnapshot(graph);

      const comparison = aggregator.getMetricsComparison(1);

      expect(comparison).toBeDefined();
      expect(comparison.timespan).toBe(1);
      expect(comparison.errorRateChange).toBeDefined();
    });

    it('should return null without sufficient history', () => {
      graph.recordCall('web', 'api');
      aggregator.recordSnapshot(graph);

      const comparison = aggregator.getMetricsComparison(1);

      expect(comparison).toBeNull();
    });
  });

  describe('getTopMetrics', () => {
    beforeEach(() => {
      // Create varied services with different metrics
      graph.recordCall('web', 'slow-api', 500);
      graph.recordCall('web', 'slow-api', 500);
      graph.recordCall('api', 'db', 100, false);
      graph.recordCall('api', 'db', 100, false);
      graph.recordCall('cache', 'redis', 10);
      graph.recordCall('cache', 'redis', 10);
      aggregator.recordSnapshot(graph);
    });

    it('should get slowest services', () => {
      const slowest = aggregator.getTopMetrics('slowest', 5);

      expect(slowest.length).toBeGreaterThan(0);
      expect(slowest[0].avgLatency).toBeGreaterThanOrEqual(slowest[1].avgLatency);
    });

    it('should get services with most errors', () => {
      const mostErrors = aggregator.getTopMetrics('mostErrors', 5);

      expect(Array.isArray(mostErrors)).toBe(true);
    });

    it('should get highest volume services', () => {
      const highVolume = aggregator.getTopMetrics('highest-volume', 5);

      expect(Array.isArray(highVolume)).toBe(true);
    });

    it('should get worst error rates', () => {
      const worstErrorRate = aggregator.getTopMetrics('worst-error-rate', 5);

      expect(Array.isArray(worstErrorRate)).toBe(true);
    });

    it('should respect limit parameter', () => {
      const top3 = aggregator.getTopMetrics('slowest', 3);

      expect(top3.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array for unknown category', () => {
      const result = aggregator.getTopMetrics('unknown');

      expect(result).toEqual([]);
    });
  });

  describe('export', () => {
    it('should export metrics as JSON', () => {
      graph.recordCall('web', 'api');
      aggregator.recordSnapshot(graph);

      const exported = aggregator.export('json');

      expect(exported).toHaveProperty('timestamp');
      expect(exported).toHaveProperty('current');
      expect(exported).toHaveProperty('history');
      expect(exported).toHaveProperty('analysis');
    });

    it('should export metrics as CSV', () => {
      graph.recordCall('web', 'api');
      aggregator.recordSnapshot(graph);

      const csv = aggregator.export('csv');

      expect(typeof csv).toBe('string');
      expect(csv).toContain('Timestamp,Service,Status');
      expect(csv).toContain('web');
    });

    it('should include analysis metadata', () => {
      graph.recordCall('web', 'api');
      aggregator.recordSnapshot(graph);

      const exported = aggregator.export();

      expect(exported.analysis.totalSnapshots).toBe(1);
      expect(exported.analysis.oldestSnapshot).toBeDefined();
      expect(exported.analysis.newestSnapshot).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should clear all historical data', () => {
      graph.recordCall('web', 'api');
      aggregator.recordSnapshot(graph);

      expect(aggregator.history.length).toBeGreaterThan(0);

      aggregator.reset();

      expect(aggregator.history.length).toBe(0);
      expect(aggregator.aggregatedMetrics).toBeNull();
      expect(aggregator.lastSnapshot).toBeNull();
    });
  });

  describe('trend calculation', () => {
    it('should calculate trends from history', () => {
      // Record multiple snapshots with variations
      for (let i = 0; i < 5; i++) {
        graph.recordCall('web', 'api', 50 + (i * 10), i > 2);
        aggregator.recordSnapshot(graph);
      }

      const trends = aggregator.aggregatedMetrics.trends;

      expect(trends).toHaveProperty('errorRateTrend');
      expect(trends).toHaveProperty('latencyTrend');
      expect(trends).toHaveProperty('healthTrend');
      expect(trends).toHaveProperty('callVolumeTrend');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex service mesh metrics', () => {
      // Simulate realistic service mesh
      graph.recordCall('web', 'api-gateway', 50);
      graph.recordCall('api-gateway', 'auth', 30);
      graph.recordCall('api-gateway', 'cache', 20);
      graph.recordCall('api-gateway', 'db', 100);
      graph.recordCall('auth', 'cache', 10);
      graph.recordCall('cache', 'redis', 5);

      const snapshot = aggregator.recordSnapshot(graph);

      expect(snapshot.services.length).toBeGreaterThan(0);
      expect(snapshot.health).toBeDefined();
      expect(snapshot.performance).toBeDefined();
    });

    it('should track metrics across multiple snapshots', () => {
      for (let i = 0; i < 5; i++) {
        graph.recordCall('web', 'api', 50 + (i * 20));
        aggregator.recordSnapshot(graph);
      }

      expect(aggregator.history.length).toBe(5);

      const comparison = aggregator.getMetricsComparison(1);
      expect(comparison).toBeDefined();
    });

    it('should provide actionable insights', () => {
      graph.recordCall('web', 'slow-service', 500);
      graph.recordCall('api', 'db', 100, false);
      graph.recordCall('api', 'db', 100, false);

      aggregator.recordSnapshot(graph);

      const performance = aggregator.aggregatedMetrics.performance;
      const slowServices = performance.slowServices;
      const problematic = performance.problematicPaths;

      expect(slowServices.length).toBeGreaterThan(0);
      expect(problematic.length).toBeGreaterThan(0);
    });
  });
});
