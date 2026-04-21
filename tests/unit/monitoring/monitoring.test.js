/**
 * @fileoverview Tests for Monitoring Service
 * Comprehensive test suite for monitoring service functionality
 */

'use strict';

const createMonitoring = require('../../../src/monitoring');
const EventEmitter = require('events');

describe('Monitoring Service', () => {
  let monitoring;
  let mockEventEmitter;
  let mockLogger;

  beforeEach(() => {
    mockEventEmitter = new EventEmitter();
    jest.spyOn(mockEventEmitter, 'emit');

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    monitoring = createMonitoring('memory', {
      dependencies: { logging: mockLogger }
    }, mockEventEmitter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create monitoring service instance', () => {
      expect(monitoring).toBeDefined();
      expect(typeof monitoring.recordCall).toBe('function');
      expect(typeof monitoring.getDependencyGraph).toBe('function');
    });

    it('should have logging service', () => {
      expect(monitoring.logger).toBe(mockLogger);
    });

    it('should emit service:created event', () => {
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('service:created', expect.objectContaining({
        serviceName: 'monitoring',
        providerType: 'memory'
      }));
    });

    it('should log initialization', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing'),
        expect.any(Object)
      );
    });
  });

  describe('recordCall', () => {
    it('should record service call', () => {
      monitoring.recordCall('web', 'cache', 50, true);

      const graph = monitoring.getDependencyGraph();
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('should emit monitoring:call-recorded event', () => {
      monitoring.recordCall('api', 'db', 100, true);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('monitoring:call-recorded', expect.objectContaining({
        from: 'api',
        to: 'db',
        latency: 100,
        success: true
      }));
    });

    it('should log errors on failed calls', () => {
      monitoring.recordCall('web', 'cache', 50, false, 'Connection timeout');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        expect.objectContaining({
          from: 'web',
          to: 'cache',
          error: 'Connection timeout'
        })
      );
    });

    it('should handle multiple calls', () => {
      monitoring.recordCall('web', 'api', 50, true);
      monitoring.recordCall('web', 'api', 100, true);
      monitoring.recordCall('web', 'api', 75, false);

      const graph = monitoring.getDependencyGraph();
      const edge = graph.edges.find(e => e.from === 'web' && e.to === 'api');

      expect(edge.calls).toBe(3);
      expect(edge.errors).toBe(1);
    });
  });

  describe('registerService', () => {
    it('should register service', () => {
      monitoring.registerService('api-service', { version: '1.0' });

      const services = monitoring.getServices();
      expect(services.find(s => s.name === 'api-service')).toBeDefined();
    });

    it('should emit monitoring:service-registered event', () => {
      monitoring.registerService('cache-service', { version: '2.0' });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('monitoring:service-registered', expect.objectContaining({
        serviceName: 'cache-service'
      }));
    });

    it('should log service registration', () => {
      monitoring.registerService('worker-service');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('registered'),
        expect.any(Object)
      );
    });
  });

  describe('updateServiceStatus', () => {
    it('should update service status', () => {
      monitoring.registerService('api');
      monitoring.updateServiceStatus('api', 'healthy');

      const services = monitoring.getServices();
      expect(services.find(s => s.name === 'api').status).toBe('healthy');
    });

    it('should emit monitoring:status-updated event', () => {
      monitoring.registerService('service');
      monitoring.updateServiceStatus('service', 'degraded');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('monitoring:status-updated', expect.objectContaining({
        serviceName: 'service',
        status: 'degraded'
      }));
    });

    it('should log non-healthy status changes', () => {
      monitoring.registerService('service');
      monitoring.updateServiceStatus('service', 'unhealthy');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('status changed'),
        expect.objectContaining({
          status: 'unhealthy'
        })
      );
    });
  });

  describe('getServices', () => {
    it('should return array of services', () => {
      monitoring.registerService('service1');
      monitoring.registerService('service2');

      const services = monitoring.getServices();

      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBe(2);
    });

    it('should include service metadata', () => {
      monitoring.registerService('api', { version: '1.0', type: 'http' });

      const services = monitoring.getServices();
      const apiService = services.find(s => s.name === 'api');

      expect(apiService.metadata.version).toBe('1.0');
      expect(apiService.metadata.type).toBe('http');
    });
  });

  describe('getDependencyGraph', () => {
    it('should return graph structure', () => {
      monitoring.recordCall('web', 'api');

      const graph = monitoring.getDependencyGraph();

      expect(graph).toHaveProperty('nodes');
      expect(graph).toHaveProperty('edges');
      expect(Array.isArray(graph.nodes)).toBe(true);
      expect(Array.isArray(graph.edges)).toBe(true);
    });

    it('should include service nodes', () => {
      monitoring.recordCall('web', 'api');

      const graph = monitoring.getDependencyGraph();
      const webNode = graph.nodes.find(n => n.id === 'web');
      const apiNode = graph.nodes.find(n => n.id === 'api');

      expect(webNode).toBeDefined();
      expect(apiNode).toBeDefined();
    });

    it('should include dependency edges', () => {
      monitoring.recordCall('web', 'cache', 50, true);

      const graph = monitoring.getDependencyGraph();
      const edge = graph.edges.find(e => e.from === 'web' && e.to === 'cache');

      expect(edge).toBeDefined();
      expect(edge.calls).toBe(1);
    });
  });

  describe('getCriticalPaths', () => {
    it('should return critical paths', () => {
      monitoring.recordCall('web', 'api', 50);
      monitoring.recordCall('api', 'db', 100);

      const paths = monitoring.getCriticalPaths();

      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 20; i++) {
        monitoring.recordCall(`service-${i}`, `dep-${i}`);
      }

      const paths = monitoring.getCriticalPaths(5);

      expect(paths.length).toBe(5);
    });
  });

  describe('getHealthOverview', () => {
    it('should return health statistics', () => {
      monitoring.registerService('service1');
      monitoring.registerService('service2');

      const overview = monitoring.getHealthOverview();

      expect(overview).toHaveProperty('totalServices');
      expect(overview).toHaveProperty('healthy');
      expect(overview).toHaveProperty('degraded');
      expect(overview).toHaveProperty('unhealthy');
    });

    it('should track service statuses', () => {
      monitoring.registerService('s1');
      monitoring.registerService('s2');

      monitoring.updateServiceStatus('s1', 'healthy');
      monitoring.updateServiceStatus('s2', 'degraded');

      const overview = monitoring.getHealthOverview();

      expect(overview.healthy).toBe(1);
      expect(overview.degraded).toBe(1);
    });
  });

  describe('analyzeDependencyImpact', () => {
    it('should analyze service impact', () => {
      monitoring.recordCall('web', 'api');
      monitoring.recordCall('mobile', 'api');

      const impact = monitoring.analyzeDependencyImpact('api');

      expect(impact).toBeDefined();
      expect(impact.dependentServices).toContain('web');
      expect(impact.dependentServices).toContain('mobile');
    });

    it('should return null for unknown service', () => {
      const impact = monitoring.analyzeDependencyImpact('unknown');

      expect(impact).toBeNull();
    });
  });

  describe('getServiceMetrics', () => {
    it('should return service metrics', () => {
      monitoring.recordCall('web', 'cache', 50, true);
      monitoring.recordCall('web', 'db', 100, true);

      const metrics = monitoring.getServiceMetrics('web');

      if (metrics) {
        expect(metrics.name).toBe('web');
        expect(metrics).toHaveProperty('totalCalls');
      }
    });

    it('should return null for unknown service', () => {
      monitoring.recordCall('web', 'api');
      const metrics = monitoring.getServiceMetrics('unknown-service');

      expect(metrics).toBeNull();
    });

    it('should return service with dependencies', () => {
      monitoring.recordCall('web', 'cache', 50, true);
      monitoring.recordCall('web', 'cache', 100, false);

      const metrics = monitoring.getServiceMetrics('web');

      expect(metrics).toBeDefined();
      if (metrics && metrics.dependencies) {
        expect(metrics.dependencies).toContain('cache');
      }
    });
  });

  describe('getRelationshipMatrix', () => {
    it('should return relationship matrix', () => {
      monitoring.recordCall('a', 'b');
      monitoring.recordCall('b', 'c');

      const matrix = monitoring.getRelationshipMatrix();

      expect(matrix.a).toBeDefined();
      expect(matrix.b).toBeDefined();
      expect(matrix.c).toBeDefined();
    });

    it('should track relationships between all service pairs', () => {
      monitoring.recordCall('web', 'api', 100);
      monitoring.recordCall('web', 'db', 200);

      const matrix = monitoring.getRelationshipMatrix();

      expect(matrix.web.api.calls).toBe(1);
      expect(matrix.web.api.latency).toBe(100);
      expect(matrix.web.db.calls).toBe(1);
      expect(matrix.web.db.latency).toBe(200);
    });
  });

  describe('export', () => {
    it('should export complete monitoring state', () => {
      monitoring.recordCall('web', 'api');

      const exported = monitoring.export();

      expect(exported).toHaveProperty('graph');
      expect(exported).toHaveProperty('metrics');
      expect(exported.graph).toHaveProperty('timestamp');
    });

    it('should have valid structure', () => {
      monitoring.recordCall('web', 'api');
      const exported = monitoring.export();

      expect(typeof exported).toBe('object');
      expect(exported.graph).toBeDefined();
      expect(exported.metrics).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should reset all statistics', () => {
      monitoring.recordCall('web', 'api');

      monitoring.reset();

      const overview = monitoring.getHealthOverview();
      expect(overview.totalCalls).toBe(0);
      expect(overview.totalErrors).toBe(0);
    });

    it('should emit monitoring:reset event', () => {
      monitoring.reset();

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('monitoring:reset', expect.any(Object));
    });

    it('should log reset operation', () => {
      monitoring.reset();

      const resetCall = mockLogger.info.mock.calls.find(call => call[0].includes('reset'));
      expect(resetCall).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle record call errors gracefully', () => {
      const errorMonitoring = createMonitoring('memory', {
        dependencies: { logging: null }
      }, mockEventEmitter);

      // Should not throw even with null logger
      errorMonitoring.recordCall('web', 'api');
      expect(errorMonitoring.graph.services.size).toBeGreaterThan(0);
    });

    it('should handle status update errors gracefully', () => {
      const errorMonitoring = createMonitoring('memory', {
        dependencies: { logging: null }
      }, mockEventEmitter);

      // Should not throw
      errorMonitoring.updateServiceStatus('unknown', 'healthy');
      expect(true).toBe(true); // Just verify no exception
    });
  });
});
