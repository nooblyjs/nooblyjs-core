/**
 * @fileoverview Service Dependency Graph
 * Tracks and visualizes service dependencies and relationships
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Service Dependency Graph for tracking service relationships
 * @class
 */
class ServiceDependencyGraph {
  /**
   * Create a new dependency graph.
   * @param {Object} [options={}] - Configuration options
   */
  constructor(options = {}) {
    this.services = new Map();
    this.dependencies = new Map();
    this.callCounts = new Map();
    this.latencies = new Map();
    this.errors = new Map();
    this.startTime = Date.now();
  }

  /**
   * Register a service in the graph.
   * @param {string} serviceName - Name of the service
   * @param {Object} [metadata={}] - Service metadata
   */
  registerService(serviceName, metadata = {}) {
    this.services.set(serviceName, {
      name: serviceName,
      registered: new Date(),
      status: 'unknown',
      metadata,
      uptime: 0,
      totalCalls: 0,
      totalErrors: 0,
      avgLatency: 0
    });

    this.dependencies.set(serviceName, new Set());
    this.callCounts.set(serviceName, new Map());
    this.latencies.set(serviceName, []);
    this.errors.set(serviceName, new Map());
  }

  /**
   * Record a service call from one service to another.
   * @param {string} fromService - Calling service
   * @param {string} toService - Called service
   * @param {number} [latency=0] - Call latency in milliseconds
   * @param {boolean} [success=true] - Whether call succeeded
   * @param {string} [error=null] - Error message if failed
   */
  recordCall(fromService, toService, latency = 0, success = true, error = null) {
    // Register services if not already registered
    if (!this.services.has(fromService)) {
      this.registerService(fromService);
    }
    if (!this.services.has(toService)) {
      this.registerService(toService);
    }

    // Add dependency
    this.dependencies.get(fromService).add(toService);

    // Track call count
    const fromCalls = this.callCounts.get(fromService);
    fromCalls.set(toService, (fromCalls.get(toService) || 0) + 1);

    // Track latency
    const latencyArray = this.latencies.get(fromService);
    latencyArray.push({ to: toService, latency, timestamp: Date.now() });
    if (latencyArray.length > 10000) {
      latencyArray.shift(); // Keep last 10k entries
    }

    // Track errors
    if (!success) {
      const errorMap = this.errors.get(fromService);
      errorMap.set(toService, (errorMap.get(toService) || 0) + 1);
    }

    // Update service stats
    const service = this.services.get(fromService);
    service.totalCalls++;
    if (!success) {
      service.totalErrors++;
    }
    service.avgLatency = this._calculateAvgLatency(fromService);
  }

  /**
   * Update service status.
   * @param {string} serviceName - Service name
   * @param {string} status - Status: healthy, degraded, unhealthy, unknown
   */
  updateServiceStatus(serviceName, status) {
    if (this.services.has(serviceName)) {
      this.services.get(serviceName).status = status;
    }
  }

  /**
   * Get all services as array.
   * @return {Array<Object>} Array of service objects
   */
  getServices() {
    return Array.from(this.services.values()).map(service => ({
      ...service,
      dependencies: Array.from(this.dependencies.get(service.name) || []),
      callCount: this.callCounts.get(service.name)?.size || 0,
      uptime: Date.now() - this.startTime
    }));
  }

  /**
   * Get dependency graph for visualization.
   * @return {Object} Graph structure with nodes and edges
   */
  getGraph() {
    const nodes = [];
    const edges = [];

    for (const [serviceName, service] of this.services) {
      nodes.push({
        id: serviceName,
        label: serviceName,
        status: service.status,
        calls: service.totalCalls,
        errors: service.totalErrors,
        latency: Math.round(service.avgLatency)
      });

      const deps = this.dependencies.get(serviceName);
      for (const dep of deps) {
        const callCount = this.callCounts.get(serviceName)?.get(dep) || 0;
        const errorCount = this.errors.get(serviceName)?.get(dep) || 0;

        edges.push({
          from: serviceName,
          to: dep,
          calls: callCount,
          errors: errorCount,
          successRate: callCount > 0 ? Math.round(((callCount - errorCount) / callCount) * 100) : 100
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * Get service relationship matrix.
   * @return {Object} Matrix of service relationships
   */
  getRelationshipMatrix() {
    const matrix = {};
    const serviceNames = Array.from(this.services.keys());

    for (const from of serviceNames) {
      matrix[from] = {};
      for (const to of serviceNames) {
        if (from === to) {
          matrix[from][to] = { calls: 0, errors: 0, latency: 0 };
        } else {
          const calls = this.callCounts.get(from)?.get(to) || 0;
          const errors = this.errors.get(from)?.get(to) || 0;
          const latencies = this.latencies
            .get(from)
            ?.filter(l => l.to === to)
            .map(l => l.latency) || [];
          const avgLatency = latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : 0;

          matrix[from][to] = { calls, errors, latency: avgLatency };
        }
      }
    }

    return matrix;
  }

  /**
   * Get critical paths (services with highest call volume).
   * @param {number} [limit=10] - Number of top paths to return
   * @return {Array<Object>} Array of critical paths
   */
  getCriticalPaths(limit = 10) {
    const paths = [];

    for (const [from, toServices] of this.callCounts) {
      for (const [to, count] of toServices) {
        const errors = this.errors.get(from)?.get(to) || 0;
        paths.push({
          from,
          to,
          calls: count,
          errors,
          successRate: count > 0 ? Math.round(((count - errors) / count) * 100) : 100,
          priority: count // Sort by call volume
        });
      }
    }

    return paths
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);
  }

  /**
   * Get service health overview.
   * @return {Object} Health overview statistics
   */
  getHealthOverview() {
    const services = Array.from(this.services.values());
    const healthy = services.filter(s => s.status === 'healthy').length;
    const degraded = services.filter(s => s.status === 'degraded').length;
    const unhealthy = services.filter(s => s.status === 'unhealthy').length;
    const unknown = services.filter(s => s.status === 'unknown').length;

    const totalCalls = services.reduce((sum, s) => sum + s.totalCalls, 0);
    const totalErrors = services.reduce((sum, s) => sum + s.totalErrors, 0);

    return {
      totalServices: services.length,
      healthy,
      degraded,
      unhealthy,
      unknown,
      healthyPercentage: services.length > 0 ? Math.round((healthy / services.length) * 100) : 0,
      totalCalls,
      totalErrors,
      errorRate: totalCalls > 0 ? Math.round((totalErrors / totalCalls) * 100) : 0,
      avgLatency: this._calculateGlobalAvgLatency()
    };
  }

  /**
   * Get dependency impact analysis.
   * @param {string} serviceName - Service to analyze
   * @return {Object} Impact analysis
   */
  analyzeDependencyImpact(serviceName) {
    if (!this.services.has(serviceName)) {
      return null;
    }

    const directDependencies = Array.from(this.dependencies.get(serviceName) || []);
    const transitiveDependencies = new Set();

    // Find transitive dependencies
    const visited = new Set();
    const queue = [...directDependencies];

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      transitiveDependencies.add(current);

      const deps = this.dependencies.get(current) || new Set();
      for (const dep of deps) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }

    // Find dependent services (services that depend on this one)
    const dependentServices = [];
    for (const [service, deps] of this.dependencies) {
      if (deps.has(serviceName)) {
        dependentServices.push(service);
      }
    }

    return {
      service: serviceName,
      directDependencies,
      transitiveDependencies: Array.from(transitiveDependencies),
      dependentServices,
      impactLevel: dependentServices.length > 5 ? 'high' : dependentServices.length > 2 ? 'medium' : 'low'
    };
  }

  /**
   * Calculate average latency for a service.
   * @private
   * @param {string} serviceName - Service name
   * @return {number} Average latency in milliseconds
   */
  _calculateAvgLatency(serviceName) {
    const latencies = this.latencies.get(serviceName) || [];
    if (latencies.length === 0) return 0;

    const sum = latencies.reduce((acc, l) => acc + l.latency, 0);
    return Math.round(sum / latencies.length);
  }

  /**
   * Calculate global average latency.
   * @private
   * @return {number} Average latency across all services
   */
  _calculateGlobalAvgLatency() {
    const allLatencies = [];
    for (const latencies of this.latencies.values()) {
      allLatencies.push(...latencies.map(l => l.latency));
    }

    if (allLatencies.length === 0) return 0;
    const sum = allLatencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / allLatencies.length);
  }

  /**
   * Reset statistics.
   */
  reset() {
    for (const callMap of this.callCounts.values()) {
      callMap.clear();
    }
    for (const errorMap of this.errors.values()) {
      errorMap.clear();
    }
    for (const latencyArray of this.latencies.values()) {
      latencyArray.length = 0;
    }
    for (const service of this.services.values()) {
      service.totalCalls = 0;
      service.totalErrors = 0;
      service.avgLatency = 0;
    }
  }

  /**
   * Export graph as JSON.
   * @return {Object} Complete graph state
   */
  export() {
    return {
      timestamp: new Date().toISOString(),
      graph: this.getGraph(),
      matrix: this.getRelationshipMatrix(),
      health: this.getHealthOverview(),
      criticalPaths: this.getCriticalPaths(20)
    };
  }
}

module.exports = ServiceDependencyGraph;
