/**
 * @fileoverview Tests for Service Dependency Graph
 * Comprehensive test suite for service dependency tracking and visualization
 */

'use strict';

const ServiceDependencyGraph = require('../../../src/monitoring/serviceDependencyGraph');

describe('ServiceDependencyGraph', () => {
  let graph;

  beforeEach(() => {
    graph = new ServiceDependencyGraph();
  });

  describe('constructor', () => {
    it('should initialize with empty maps', () => {
      expect(graph.services.size).toBe(0);
      expect(graph.dependencies.size).toBe(0);
      expect(graph.callCounts.size).toBe(0);
      expect(graph.latencies.size).toBe(0);
      expect(graph.errors.size).toBe(0);
    });

    it('should set start time', () => {
      expect(graph.startTime).toBeDefined();
      expect(typeof graph.startTime).toBe('number');
    });
  });

  describe('registerService', () => {
    it('should register a new service', () => {
      graph.registerService('cache-service');

      expect(graph.services.has('cache-service')).toBe(true);
      const service = graph.services.get('cache-service');
      expect(service.name).toBe('cache-service');
      expect(service.status).toBe('unknown');
      expect(service.totalCalls).toBe(0);
      expect(service.totalErrors).toBe(0);
    });

    it('should initialize service data structures', () => {
      graph.registerService('api-service');

      expect(graph.dependencies.has('api-service')).toBe(true);
      expect(graph.callCounts.has('api-service')).toBe(true);
      expect(graph.latencies.has('api-service')).toBe(true);
      expect(graph.errors.has('api-service')).toBe(true);
    });

    it('should accept metadata', () => {
      const metadata = { version: '1.0.0', type: 'http' };
      graph.registerService('web-service', metadata);

      const service = graph.services.get('web-service');
      expect(service.metadata).toEqual(metadata);
    });

    it('should allow re-registering service', () => {
      graph.registerService('service-a', { version: '1.0' });
      graph.registerService('service-a', { version: '2.0' });

      const service = graph.services.get('service-a');
      expect(service.metadata.version).toBe('2.0');
    });
  });

  describe('recordCall', () => {
    it('should auto-register services if not present', () => {
      expect(graph.services.has('service-a')).toBe(false);
      expect(graph.services.has('service-b')).toBe(false);

      graph.recordCall('service-a', 'service-b', 50, true);

      expect(graph.services.has('service-a')).toBe(true);
      expect(graph.services.has('service-b')).toBe(true);
    });

    it('should track dependency', () => {
      graph.recordCall('web', 'cache');

      const deps = graph.dependencies.get('web');
      expect(deps.has('cache')).toBe(true);
    });

    it('should increment call count', () => {
      graph.recordCall('web', 'cache');
      graph.recordCall('web', 'cache');

      const calls = graph.callCounts.get('web').get('cache');
      expect(calls).toBe(2);
    });

    it('should track latency', () => {
      graph.recordCall('web', 'db', 150);
      graph.recordCall('web', 'db', 100);

      const latencies = graph.latencies.get('web');
      expect(latencies.length).toBe(2);
      expect(latencies[0].latency).toBe(150);
      expect(latencies[1].latency).toBe(100);
    });

    it('should track errors', () => {
      graph.recordCall('web', 'cache', 50, true);
      graph.recordCall('web', 'cache', 50, false);
      graph.recordCall('web', 'cache', 50, false);

      const errors = graph.errors.get('web').get('cache');
      expect(errors).toBe(2);
    });

    it('should update service statistics', () => {
      graph.recordCall('api', 'db', 100, true);
      graph.recordCall('api', 'db', 150, false);

      const service = graph.services.get('api');
      expect(service.totalCalls).toBe(2);
      expect(service.totalErrors).toBe(1);
    });

    it('should maintain latency history limit', () => {
      const service = 'worker';
      graph.registerService(service);

      // Record 10,001 calls to exceed limit of 10,000
      for (let i = 0; i < 10001; i++) {
        graph.recordCall(service, 'queue', 50);
      }

      const latencies = graph.latencies.get(service);
      expect(latencies.length).toBe(10000);
    });

    it('should calculate average latency', () => {
      graph.recordCall('api', 'db', 100);
      graph.recordCall('api', 'db', 200);
      graph.recordCall('api', 'db', 300);

      const service = graph.services.get('api');
      expect(service.avgLatency).toBe(200); // (100 + 200 + 300) / 3
    });
  });

  describe('updateServiceStatus', () => {
    it('should update service status', () => {
      graph.registerService('cache');
      graph.updateServiceStatus('cache', 'healthy');

      expect(graph.services.get('cache').status).toBe('healthy');
    });

    it('should accept all valid statuses', () => {
      graph.registerService('service');

      const statuses = ['healthy', 'degraded', 'unhealthy', 'unknown'];
      for (const status of statuses) {
        graph.updateServiceStatus('service', status);
        expect(graph.services.get('service').status).toBe(status);
      }
    });

    it('should do nothing if service not registered', () => {
      // Should not throw
      graph.updateServiceStatus('unknown-service', 'healthy');
      expect(graph.services.has('unknown-service')).toBe(false);
    });
  });

  describe('getServices', () => {
    it('should return empty array if no services', () => {
      const services = graph.getServices();
      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBe(0);
    });

    it('should return all registered services', () => {
      graph.registerService('cache');
      graph.registerService('database');
      graph.registerService('api');

      const services = graph.getServices();
      expect(services.length).toBe(3);
      expect(services.map(s => s.name)).toContain('cache');
      expect(services.map(s => s.name)).toContain('database');
      expect(services.map(s => s.name)).toContain('api');
    });

    it('should include dependencies in service info', () => {
      graph.recordCall('web', 'cache');
      graph.recordCall('web', 'db');

      const services = graph.getServices();
      const webService = services.find(s => s.name === 'web');

      expect(webService.dependencies).toContain('cache');
      expect(webService.dependencies).toContain('db');
      expect(webService.callCount).toBe(2);
    });

    it('should include uptime', () => {
      graph.registerService('service');
      const services = graph.getServices();

      expect(services[0].uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getGraph', () => {
    it('should return nodes and edges', () => {
      graph.recordCall('web', 'api');
      graph.recordCall('api', 'db');

      const graphData = graph.getGraph();

      expect(graphData.nodes).toBeDefined();
      expect(graphData.edges).toBeDefined();
      expect(Array.isArray(graphData.nodes)).toBe(true);
      expect(Array.isArray(graphData.edges)).toBe(true);
    });

    it('should include service nodes', () => {
      graph.registerService('cache', { version: '1.0' });
      graph.recordCall('web', 'cache', 50);

      const graphData = graph.getGraph();
      const cacheNode = graphData.nodes.find(n => n.id === 'cache');

      expect(cacheNode).toBeDefined();
      expect(cacheNode.label).toBe('cache');
      expect(cacheNode.status).toBe('unknown');
      expect(cacheNode.calls).toBe(0); // cache received no calls as target
    });

    it('should include dependency edges with metrics', () => {
      graph.recordCall('web', 'cache', 50, true);
      graph.recordCall('web', 'cache', 100, false);

      const graphData = graph.getGraph();
      const edge = graphData.edges.find(e => e.from === 'web' && e.to === 'cache');

      expect(edge).toBeDefined();
      expect(edge.calls).toBe(2);
      expect(edge.errors).toBe(1);
      expect(edge.successRate).toBe(50);
    });

    it('should calculate success rate correctly', () => {
      graph.recordCall('api', 'db', 50, true);
      graph.recordCall('api', 'db', 50, true);
      graph.recordCall('api', 'db', 50, true);
      graph.recordCall('api', 'db', 50, false);

      const graphData = graph.getGraph();
      const edge = graphData.edges[0];

      expect(edge.successRate).toBe(75);
    });
  });

  describe('getRelationshipMatrix', () => {
    it('should return matrix structure', () => {
      graph.recordCall('a', 'b');
      graph.recordCall('b', 'c');

      const matrix = graph.getRelationshipMatrix();

      expect(typeof matrix).toBe('object');
      expect(matrix.a).toBeDefined();
      expect(matrix.b).toBeDefined();
      expect(matrix.c).toBeDefined();
    });

    it('should track relationships between all service pairs', () => {
      graph.recordCall('web', 'cache', 100);
      graph.recordCall('web', 'db', 200);

      const matrix = graph.getRelationshipMatrix();

      expect(matrix.web.cache.calls).toBe(1);
      expect(matrix.web.cache.latency).toBe(100);
      expect(matrix.web.db.calls).toBe(1);
      expect(matrix.web.db.latency).toBe(200);
    });

    it('should handle self-references as zero', () => {
      graph.recordCall('service', 'other');

      const matrix = graph.getRelationshipMatrix();

      expect(matrix.service.service.calls).toBe(0);
      expect(matrix.service.service.errors).toBe(0);
      expect(matrix.service.service.latency).toBe(0);
    });

    it('should calculate average latency per path', () => {
      graph.recordCall('a', 'b', 100);
      graph.recordCall('a', 'b', 200);
      graph.recordCall('a', 'b', 300);

      const matrix = graph.getRelationshipMatrix();
      expect(matrix.a.b.latency).toBe(200);
    });
  });

  describe('getCriticalPaths', () => {
    it('should return critical paths sorted by volume', () => {
      graph.recordCall('web', 'cache', 50);
      graph.recordCall('web', 'cache', 50);
      graph.recordCall('web', 'cache', 50);

      graph.recordCall('api', 'db', 50);

      const paths = graph.getCriticalPaths();

      expect(paths[0].from).toBe('web');
      expect(paths[0].to).toBe('cache');
      expect(paths[0].calls).toBe(3);
      expect(paths[1].calls).toBe(1);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 50; i++) {
        graph.recordCall(`service-${i}`, `dep-${i}`);
      }

      const paths = graph.getCriticalPaths(5);
      expect(paths.length).toBe(5);
    });

    it('should include success rate and error count', () => {
      graph.recordCall('web', 'api', 50, true);
      graph.recordCall('web', 'api', 50, true);
      graph.recordCall('web', 'api', 50, false);

      const paths = graph.getCriticalPaths();

      expect(paths[0].successRate).toBe(67);
      expect(paths[0].errors).toBe(1);
    });

    it('should set priority based on call volume', () => {
      graph.recordCall('a', 'b', 50);
      graph.recordCall('c', 'd', 50);
      graph.recordCall('e', 'f', 50);

      const paths = graph.getCriticalPaths();

      // All have same priority since all have 1 call
      paths.forEach(path => {
        expect(path.priority).toBe(1);
      });
    });
  });

  describe('getHealthOverview', () => {
    it('should return health statistics', () => {
      graph.registerService('service-a');
      graph.registerService('service-b');

      const overview = graph.getHealthOverview();

      expect(overview.totalServices).toBe(2);
      expect(overview.healthy).toBeDefined();
      expect(overview.degraded).toBeDefined();
      expect(overview.unhealthy).toBeDefined();
      expect(overview.unknown).toBeDefined();
    });

    it('should count service statuses', () => {
      graph.registerService('s1');
      graph.registerService('s2');
      graph.registerService('s3');

      graph.updateServiceStatus('s1', 'healthy');
      graph.updateServiceStatus('s2', 'healthy');
      graph.updateServiceStatus('s3', 'degraded');

      const overview = graph.getHealthOverview();

      expect(overview.healthy).toBe(2);
      expect(overview.degraded).toBe(1);
      expect(overview.unhealthy).toBe(0);
      expect(overview.unknown).toBe(0);
    });

    it('should calculate health percentage', () => {
      graph.registerService('s1');
      graph.registerService('s2');

      graph.updateServiceStatus('s1', 'healthy');
      graph.updateServiceStatus('s2', 'degraded');

      const overview = graph.getHealthOverview();

      expect(overview.healthyPercentage).toBe(50);
    });

    it('should track error rate', () => {
      graph.recordCall('a', 'b', 50, true);
      graph.recordCall('a', 'b', 50, true);
      graph.recordCall('a', 'b', 50, false);

      const overview = graph.getHealthOverview();

      expect(overview.totalCalls).toBe(3);
      expect(overview.totalErrors).toBe(1);
      expect(overview.errorRate).toBe(33);
    });

    it('should calculate global average latency', () => {
      graph.recordCall('a', 'b', 100);
      graph.recordCall('a', 'b', 200);
      graph.recordCall('c', 'd', 300);

      const overview = graph.getHealthOverview();

      expect(overview.avgLatency).toBe(200);
    });
  });

  describe('analyzeDependencyImpact', () => {
    it('should return null for unknown service', () => {
      const impact = graph.analyzeDependencyImpact('unknown');
      expect(impact).toBeNull();
    });

    it('should identify direct dependencies', () => {
      graph.recordCall('web', 'cache');
      graph.recordCall('web', 'db');

      const impact = graph.analyzeDependencyImpact('web');

      expect(impact.directDependencies).toContain('cache');
      expect(impact.directDependencies).toContain('db');
      expect(impact.directDependencies.length).toBe(2);
    });

    it('should identify transitive dependencies', () => {
      graph.recordCall('web', 'api');
      graph.recordCall('api', 'cache');
      graph.recordCall('cache', 'db');

      const impact = graph.analyzeDependencyImpact('web');

      expect(impact.transitiveDependencies).toContain('api');
      expect(impact.transitiveDependencies).toContain('cache');
      expect(impact.transitiveDependencies).toContain('db');
    });

    it('should identify dependent services', () => {
      graph.recordCall('web', 'api');
      graph.recordCall('mobile', 'api');
      graph.recordCall('service', 'api');

      const impact = graph.analyzeDependencyImpact('api');

      expect(impact.dependentServices).toContain('web');
      expect(impact.dependentServices).toContain('mobile');
      expect(impact.dependentServices).toContain('service');
      expect(impact.dependentServices.length).toBe(3);
    });

    it('should calculate impact level based on dependent count', () => {
      graph.recordCall('s1', 'api');
      graph.recordCall('s2', 'api');
      graph.recordCall('s3', 'api');

      const impact = graph.analyzeDependencyImpact('api');

      expect(impact.impactLevel).toBe('medium');
    });

    it('should mark high impact for critical services', () => {
      // Create 6+ dependent services
      for (let i = 0; i < 7; i++) {
        graph.recordCall(`service-${i}`, 'critical-api');
      }

      const impact = graph.analyzeDependencyImpact('critical-api');

      expect(impact.impactLevel).toBe('high');
      expect(impact.dependentServices.length).toBe(7);
    });

    it('should mark low impact for non-critical services', () => {
      graph.recordCall('one-service', 'minor-api');

      const impact = graph.analyzeDependencyImpact('minor-api');

      expect(impact.impactLevel).toBe('low');
    });
  });

  describe('reset', () => {
    it('should clear statistics', () => {
      graph.recordCall('web', 'db', 100, true);
      graph.recordCall('api', 'cache', 50, false);

      graph.reset();

      const services = graph.getServices();
      for (const service of services) {
        expect(service.totalCalls).toBe(0);
        expect(service.totalErrors).toBe(0);
        expect(service.avgLatency).toBe(0);
      }
    });

    it('should clear latency history', () => {
      graph.recordCall('web', 'db', 100);
      const latenciesBefore = graph.latencies.get('web').length;
      expect(latenciesBefore).toBeGreaterThan(0);

      graph.reset();

      const latenciesAfter = graph.latencies.get('web').length;
      expect(latenciesAfter).toBe(0);
    });

    it('should clear error counts', () => {
      graph.recordCall('web', 'db', 50, false);
      const errorsBefore = graph.errors.get('web').get('db');
      expect(errorsBefore).toBeGreaterThan(0);

      graph.reset();

      const errorsAfter = graph.errors.get('web').get('db');
      expect(errorsAfter || 0).toBe(0);
    });

    it('should preserve service registrations', () => {
      graph.recordCall('web', 'db');
      const servicesBefore = graph.services.size;

      graph.reset();

      const servicesAfter = graph.services.size;
      expect(servicesAfter).toBe(servicesBefore);
    });
  });

  describe('export', () => {
    it('should export complete graph state', () => {
      graph.recordCall('web', 'cache', 100);
      graph.recordCall('api', 'db', 200);

      const exported = graph.export();

      expect(exported.timestamp).toBeDefined();
      expect(exported.graph).toBeDefined();
      expect(exported.matrix).toBeDefined();
      expect(exported.health).toBeDefined();
      expect(exported.criticalPaths).toBeDefined();
    });

    it('should include nodes and edges in graph export', () => {
      graph.recordCall('web', 'cache');

      const exported = graph.export();

      expect(exported.graph.nodes).toBeDefined();
      expect(exported.graph.edges).toBeDefined();
    });

    it('should include health overview', () => {
      graph.registerService('service');
      graph.updateServiceStatus('service', 'healthy');

      const exported = graph.export();

      expect(exported.health.totalServices).toBe(1);
      expect(exported.health.healthy).toBe(1);
    });

    it('should include critical paths', () => {
      graph.recordCall('a', 'b');
      graph.recordCall('c', 'd');

      const exported = graph.export();

      expect(Array.isArray(exported.criticalPaths)).toBe(true);
      expect(exported.criticalPaths.length).toBeGreaterThan(0);
    });

    it('should have valid timestamp', () => {
      const exported = graph.export();
      const timestamp = new Date(exported.timestamp);

      expect(timestamp instanceof Date).toBe(true);
      expect(!isNaN(timestamp.getTime())).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex service mesh', () => {
      // Create a realistic service mesh
      graph.recordCall('web', 'api-gateway', 50);
      graph.recordCall('api-gateway', 'auth', 30);
      graph.recordCall('api-gateway', 'cache', 20);
      graph.recordCall('api-gateway', 'db', 100);
      graph.recordCall('auth', 'cache', 10);
      graph.recordCall('cache', 'redis', 5);

      const webImpact = graph.analyzeDependencyImpact('web');
      const apiImpact = graph.analyzeDependencyImpact('api-gateway');
      const cacheImpact = graph.analyzeDependencyImpact('cache');

      expect(webImpact.directDependencies.length).toBe(1);
      expect(apiImpact.directDependencies.length).toBe(3);
      expect(cacheImpact.dependentServices.length).toBeGreaterThan(0);
    });

    it('should track partial failures', () => {
      for (let i = 0; i < 100; i++) {
        const success = Math.random() > 0.1; // 90% success rate
        graph.recordCall('api', 'db', 50 + Math.random() * 50, success);
      }

      const overview = graph.getHealthOverview();
      expect(overview.errorRate).toBeLessThan(20); // Allow some variance
      expect(overview.errorRate).toBeGreaterThan(0);
    });

    it('should support performance trending', () => {
      const exportedSnapshots = [];

      for (let i = 0; i < 3; i++) {
        graph.recordCall('web', 'db', 100 + (i * 50)); // Increasing latency
        exportedSnapshots.push(graph.export());
      }

      // Verify we captured trend
      expect(exportedSnapshots.length).toBe(3);
      expect(exportedSnapshots[0].criticalPaths[0].calls).toBeLessThanOrEqual(
        exportedSnapshots[2].criticalPaths[0].calls
      );
    });
  });
});
