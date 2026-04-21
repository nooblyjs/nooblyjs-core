/**
 * @fileoverview Monitoring Service Factory
 * Creates monitoring service instances for service dependency tracking and metrics visualization
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const ServiceDependencyGraph = require('./serviceDependencyGraph');
const setupRoutes = require('./routes');
const Views = require('./views');

/**
 * Create a monitoring service instance.
 * Provides service dependency tracking, metrics visualization, and health monitoring.
 *
 * @param {string} providerType - Type of provider (memory is currently the only option)
 * @param {Object} [options={}] - Configuration options
 * @param {Object} [options.dependencies={}] - Service dependencies (logging)
 * @param {Object} [options.enableAutoTracking=true] - Enable automatic call tracking
 * @param {EventEmitter} [eventEmitter] - Event emitter for lifecycle events
 *
 * @return {Object} Monitoring service instance
 *
 * @example
 * const monitoring = createMonitoring('memory', {
 *   dependencies: { logging: logService },
 *   enableAutoTracking: true
 * }, eventEmitter);
 *
 * // Record service calls
 * monitoring.recordCall('web', 'cache', 50, true);
 *
 * // Get dependency graph
 * const graph = monitoring.getDependencyGraph();
 */
function createMonitoring(providerType = 'memory', options = {}, eventEmitter) {
  const { dependencies = {}, enableAutoTracking = true } = options;
  const logger = dependencies.logging;

  // Initialize the dependency graph
  const graph = new ServiceDependencyGraph(options);

  logger?.info('[Monitoring] Initializing monitoring service', {
    provider: providerType,
    autoTracking: enableAutoTracking
  });

  /**
   * Record a service-to-service call for tracking.
   * @param {string} fromService - Calling service name
   * @param {string} toService - Called service name
   * @param {number} [latency=0] - Call latency in milliseconds
   * @param {boolean} [success=true] - Whether call succeeded
   * @param {string} [error=null] - Error message if failed
   */
  function recordCall(fromService, toService, latency = 0, success = true, error = null) {
    try {
      graph.recordCall(fromService, toService, latency, success, error);

      if (!success) {
        logger?.warn('[Monitoring] Service call failed', {
          from: fromService,
          to: toService,
          latency,
          error
        });
      }

      eventEmitter?.emit('monitoring:call-recorded', {
        from: fromService,
        to: toService,
        latency,
        success,
        error,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger?.error('[Monitoring] Failed to record call', {
        from: fromService,
        to: toService,
        error: err.message
      });
    }
  }

  /**
   * Register a service in the monitoring graph.
   * @param {string} serviceName - Name of the service
   * @param {Object} [metadata={}] - Service metadata
   */
  function registerService(serviceName, metadata = {}) {
    try {
      graph.registerService(serviceName, metadata);

      logger?.info('[Monitoring] Service registered', {
        service: serviceName,
        metadata: metadata
      });

      eventEmitter?.emit('monitoring:service-registered', {
        serviceName,
        metadata,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger?.error('[Monitoring] Failed to register service', {
        service: serviceName,
        error: err.message
      });
    }
  }

  /**
   * Update service health status.
   * @param {string} serviceName - Service name
   * @param {string} status - Health status (healthy|degraded|unhealthy|unknown)
   */
  function updateServiceStatus(serviceName, status) {
    try {
      graph.updateServiceStatus(serviceName, status);

      if (status !== 'healthy') {
        logger?.warn('[Monitoring] Service status changed', {
          service: serviceName,
          status
        });
      }

      eventEmitter?.emit('monitoring:status-updated', {
        serviceName,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger?.error('[Monitoring] Failed to update service status', {
        service: serviceName,
        error: err.message
      });
    }
  }

  /**
   * Get all services.
   * @return {Array<Object>} Array of service objects with dependencies
   */
  function getServices() {
    return graph.getServices();
  }

  /**
   * Get dependency graph visualization data.
   * @return {Object} Graph structure with nodes and edges
   */
  function getDependencyGraph() {
    return graph.getGraph();
  }

  /**
   * Get service relationship matrix.
   * @return {Object} Matrix of service relationships
   */
  function getRelationshipMatrix() {
    return graph.getRelationshipMatrix();
  }

  /**
   * Get critical paths (highest call volume).
   * @param {number} [limit=10] - Number of top paths to return
   * @return {Array<Object>} Array of critical paths
   */
  function getCriticalPaths(limit = 10) {
    return graph.getCriticalPaths(limit);
  }

  /**
   * Get overall health overview.
   * @return {Object} Health overview statistics
   */
  function getHealthOverview() {
    return graph.getHealthOverview();
  }

  /**
   * Analyze dependency impact for a service.
   * @param {string} serviceName - Service to analyze
   * @return {Object|null} Impact analysis or null if service not found
   */
  function analyzeDependencyImpact(serviceName) {
    return graph.analyzeDependencyImpact(serviceName);
  }

  /**
   * Get detailed metrics for a service.
   * @param {string} serviceName - Service name
   * @return {Object|null} Detailed service metrics or null if not found
   */
  function getServiceMetrics(serviceName) {
    const service = graph.services.get(serviceName);
    if (!service) {
      return null;
    }

    const deps = graph.dependencies.get(serviceName);
    const callMap = graph.callCounts.get(serviceName);
    const errorMap = graph.errors.get(serviceName);
    const latencies = graph.latencies.get(serviceName);

    const dependencyMetrics = {};
    if (deps) {
      for (const dep of deps) {
        const calls = callMap?.get(dep) || 0;
        const errors = errorMap?.get(dep) || 0;
        const depLatencies = latencies?.filter(l => l.to === dep).map(l => l.latency) || [];
        const avgLatency = depLatencies.length > 0
          ? Math.round(depLatencies.reduce((a, b) => a + b, 0) / depLatencies.length)
          : 0;

        dependencyMetrics[dep] = {
          calls,
          errors,
          successRate: calls > 0 ? Math.round(((calls - errors) / calls) * 100) : 100,
          avgLatency,
          minLatency: depLatencies.length > 0 ? Math.min(...depLatencies) : 0,
          maxLatency: depLatencies.length > 0 ? Math.max(...depLatencies) : 0
        };
      }
    }

    return {
      name: serviceName,
      status: service.status,
      uptime: Date.now() - graph.startTime,
      registered: service.registered,
      metadata: service.metadata,
      totalCalls: service.totalCalls,
      totalErrors: service.totalErrors,
      errorRate: service.totalCalls > 0
        ? Math.round((service.totalErrors / service.totalCalls) * 100)
        : 0,
      avgLatency: service.avgLatency,
      dependencies: Array.from(deps || []),
      dependencyMetrics,
      dependentServices: Array.from(graph.dependencies).filter(([_, deps]) => deps.has(serviceName)).map(([name]) => name)
    };
  }

  /**
   * Reset all monitoring statistics.
   */
  function reset() {
    try {
      graph.reset();

      logger?.info('[Monitoring] All statistics have been reset');

      eventEmitter?.emit('monitoring:reset', {
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger?.error('[Monitoring] Failed to reset statistics', {
        error: err.message
      });
    }
  }

  /**
   * Export complete monitoring snapshot.
   * @return {Object} Complete monitoring state
   */
  function export_() {
    return graph.export();
  }

  // Initialize the service instance
  const service = {
    recordCall,
    registerService,
    updateServiceStatus,
    getServices,
    getDependencyGraph,
    getRelationshipMatrix,
    getCriticalPaths,
    getHealthOverview,
    analyzeDependencyImpact,
    getServiceMetrics,
    reset,
    export: export_,
    logger,
    graph  // Expose for direct access if needed
  };

  // Setup routes and views for the monitoring service
  setupRoutes(options['express-app'], service, options.authMiddleware);
  Views(options, eventEmitter, logger);

  // Emit service created event
  eventEmitter?.emit('service:created', {
    serviceName: 'monitoring',
    providerType,
    dependencies: Object.keys(dependencies)
  });

  // Return public API
  return service;
}

module.exports = createMonitoring;
