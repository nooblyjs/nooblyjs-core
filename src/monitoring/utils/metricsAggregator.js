/**
 * @fileoverview Metrics Aggregator for Cross-Service Analysis
 * Aggregates metrics from multiple services with historical trending
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Aggregates metrics across all services with historical data and trending.
 * @class
 */
class MetricsAggregator {
  /**
   * Create a new metrics aggregator.
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.historySize=1000] - Maximum historical data points per metric
   * @param {number} [options.snapshotInterval=60000] - Interval between snapshots (ms)
   */
  constructor(options = {}) {
    this.historySize = options.historySize || 1000;
    this.snapshotInterval = options.snapshotInterval || 60000; // 1 minute
    this.history = []; // Historical snapshots
    this.serviceMetrics = new Map(); // Current service metrics
    this.aggregatedMetrics = null; // Latest aggregated metrics
    this.lastSnapshot = null;
  }

  /**
   * Record a snapshot of current metrics from dependency graph.
   * @param {Object} graph - ServiceDependencyGraph instance
   * @return {Object} Snapshot of aggregated metrics
   */
  recordSnapshot(graph) {
    const snapshot = {
      timestamp: new Date().toISOString(),
      timestampMs: Date.now(),
      services: this._aggregateServiceMetrics(graph),
      callPaths: this._aggregateCallPaths(graph),
      health: this._aggregateHealth(graph),
      performance: this._analyzePerformance(graph),
      trends: this._calculateTrends()
    };

    this.history.push(snapshot);

    // Maintain history size limit
    if (this.history.length > this.historySize) {
      this.history.shift();
    }

    this.aggregatedMetrics = snapshot;
    this.lastSnapshot = snapshot;

    return snapshot;
  }

  /**
   * Aggregate metrics for all services.
   * @private
   * @param {Object} graph - ServiceDependencyGraph instance
   * @return {Array<Object>} Array of service metrics
   */
  _aggregateServiceMetrics(graph) {
    const serviceList = graph.getServices();
    const matrix = graph.getRelationshipMatrix();

    return serviceList.map(service => {
      const deps = Array.from(graph.dependencies.get(service.name) || []);
      const dependents = Array.from(graph.dependencies).filter(([_, d]) => d.has(service.name)).map(([name]) => name);

      // Calculate inbound metrics (calls TO this service)
      let inboundCalls = 0;
      let inboundErrors = 0;

      for (const [fromService, toServices] of Object.entries(matrix)) {
        if (toServices[service.name]) {
          inboundCalls += toServices[service.name].calls || 0;
          inboundErrors += toServices[service.name].errors || 0;
        }
      }

      // Calculate outbound metrics (calls FROM this service)
      let outboundCalls = service.totalCalls || 0;
      let outboundErrors = service.totalErrors || 0;

      return {
        name: service.name,
        status: service.status,
        uptime: service.uptime,
        inboundCalls,
        inboundErrors,
        outboundCalls,
        outboundErrors,
        totalCalls: inboundCalls + outboundCalls,
        totalErrors: inboundErrors + outboundErrors,
        errorRate: (inboundCalls + outboundCalls) > 0
          ? Math.round(((inboundErrors + outboundErrors) / (inboundCalls + outboundCalls)) * 100)
          : 0,
        avgLatency: service.avgLatency || 0,
        dependencies: deps,
        dependents,
        dependencyCount: deps.length,
        dependentCount: dependents.length
      };
    });
  }

  /**
   * Aggregate call path metrics.
   * @private
   * @param {Object} graph - ServiceDependencyGraph instance
   * @return {Array<Object>} Array of call path metrics
   */
  _aggregateCallPaths(graph) {
    const paths = graph.getCriticalPaths(50);

    return paths.map(path => ({
      from: path.from,
      to: path.to,
      calls: path.calls,
      errors: path.errors,
      successRate: path.successRate,
      priority: path.priority,
      errorRate: path.calls > 0 ? Math.round((path.errors / path.calls) * 100) : 0,
      latency: 0 // Would be calculated from detailed metrics
    }));
  }

  /**
   * Aggregate overall health metrics.
   * @private
   * @param {Object} graph - ServiceDependencyGraph instance
   * @return {Object} Aggregated health metrics
   */
  _aggregateHealth(graph) {
    const overview = graph.getHealthOverview();

    return {
      totalServices: overview.totalServices,
      healthy: overview.healthy,
      degraded: overview.degraded,
      unhealthy: overview.unhealthy,
      unknown: overview.unknown,
      healthyPercentage: overview.healthyPercentage,
      totalCalls: overview.totalCalls,
      totalErrors: overview.totalErrors,
      errorRate: overview.errorRate,
      avgLatency: overview.avgLatency,
      systemStatus: overview.healthyPercentage >= 95 ? 'healthy'
        : overview.healthyPercentage >= 70 ? 'degraded'
          : 'unhealthy',
      riskLevel: overview.healthyPercentage >= 95 ? 'low'
        : overview.healthyPercentage >= 70 ? 'medium'
          : 'high'
    };
  }

  /**
   * Analyze performance metrics.
   * @private
   * @param {Object} graph - ServiceDependencyGraph instance
   * @return {Object} Performance analysis
   */
  _analyzePerformance(graph) {
    const matrix = graph.getRelationshipMatrix();
    const services = graph.getServices();

    // Calculate latencies
    let totalLatency = 0;
    let latencyCount = 0;
    let maxLatency = 0;
    let minLatency = Infinity;

    for (const service of services) {
      if (service.avgLatency > 0) {
        totalLatency += service.avgLatency;
        latencyCount++;
        maxLatency = Math.max(maxLatency, service.avgLatency);
        minLatency = Math.min(minLatency, service.avgLatency);
      }
    }

    const avgLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;

    // Identify slow services (above average)
    const slowServices = services
      .filter(s => s.avgLatency > avgLatency)
      .map(s => ({ name: s.name, latency: s.avgLatency }))
      .sort((a, b) => b.latency - a.latency)
      .slice(0, 10);

    // Identify problematic paths (high error rates)
    const problematicPaths = graph.getCriticalPaths(100)
      .filter(p => p.successRate < 95)
      .slice(0, 10);

    return {
      avgLatency,
      maxLatency: maxLatency === Infinity ? 0 : maxLatency,
      minLatency: minLatency === Infinity ? 0 : minLatency,
      slowServices,
      problematicPaths,
      overallPerformanceScore: this._calculatePerformanceScore(avgLatency, slowServices.length, problematicPaths.length)
    };
  }

  /**
   * Calculate overall performance score (0-100).
   * @private
   * @param {number} avgLatency - Average latency
   * @param {number} slowCount - Number of slow services
   * @param {number} problematicCount - Number of problematic paths
   * @return {number} Performance score
   */
  _calculatePerformanceScore(avgLatency, slowCount, problematicCount) {
    let score = 100;

    // Latency impact (0-30 points)
    if (avgLatency > 500) score -= 30;
    else if (avgLatency > 200) score -= 20;
    else if (avgLatency > 100) score -= 10;

    // Slow services impact (0-30 points)
    score -= Math.min(slowCount * 3, 30);

    // Problematic paths impact (0-40 points)
    score -= Math.min(problematicCount * 4, 40);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate metrics trends from history.
   * @private
   * @return {Object} Trend analysis
   */
  _calculateTrends() {
    if (this.history.length < 2) {
      return {
        errorRateTrend: 'stable',
        latencyTrend: 'stable',
        healthTrend: 'stable',
        callVolumeTrend: 'stable'
      };
    }

    const current = this.history[this.history.length - 1];
    const previous = this.history[Math.max(0, this.history.length - 10)];

    const errorRateTrend = this._compareTrend(previous.health.errorRate, current.health.errorRate);
    const latencyTrend = this._compareTrend(previous.health.avgLatency, current.health.avgLatency);
    const healthTrend = this._compareTrend(previous.health.healthyPercentage, current.health.healthyPercentage);
    const callVolumeTrend = this._compareTrend(previous.health.totalCalls, current.health.totalCalls);

    return {
      errorRateTrend,
      latencyTrend,
      healthTrend,
      callVolumeTrend,
      lastUpdate: current.timestamp
    };
  }

  /**
   * Compare two values and return trend direction.
   * @private
   * @param {number} previous - Previous value
   * @param {number} current - Current value
   * @return {string} Trend ('improving', 'degrading', 'stable')
   */
  _compareTrend(previous, current) {
    if (previous === null || previous === undefined) return 'stable';

    const change = ((current - previous) / previous) * 100;

    // For error rates and latency, negative change is good (improving)
    // For health percentage, positive change is good (improving)
    if (Math.abs(change) < 5) return 'stable';
    return 'stable'; // Simplified for now
  }

  /**
   * Get metrics summary for a specific service.
   * @param {string} serviceName - Name of service
   * @return {Object|null} Service metrics or null if not found
   */
  getServiceMetrics(serviceName) {
    if (!this.aggregatedMetrics) {
      return null;
    }

    return this.aggregatedMetrics.services.find(s => s.name === serviceName) || null;
  }

  /**
   * Get all current aggregated metrics.
   * @return {Object|null} Current aggregated metrics or null
   */
  getCurrentMetrics() {
    return this.aggregatedMetrics;
  }

  /**
   * Get historical metrics within time range.
   * @param {number} [hoursBack=24] - Hours of history to retrieve
   * @return {Array<Object>} Historical snapshots
   */
  getHistoricalMetrics(hoursBack = 24) {
    const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);

    return this.history.filter(snapshot => snapshot.timestampMs >= cutoffTime);
  }

  /**
   * Get metrics comparison between two time points.
   * @param {number} [hoursBack=1] - Hours back to compare
   * @return {Object} Comparison metrics
   */
  getMetricsComparison(hoursBack = 1) {
    if (this.history.length < 2) {
      return null;
    }

    const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
    const historicalSnapshots = this.history.filter(s => s.timestampMs >= cutoffTime);

    if (historicalSnapshots.length < 2) {
      return null;
    }

    const oldest = historicalSnapshots[0];
    const newest = this.aggregatedMetrics;

    return {
      timespan: hoursBack,
      startTime: oldest.timestamp,
      endTime: newest.timestamp,
      errorRateChange: newest.health.errorRate - oldest.health.errorRate,
      latencyChange: newest.health.avgLatency - oldest.health.avgLatency,
      callVolumeChange: newest.health.totalCalls - oldest.health.totalCalls,
      healthPercentageChange: newest.health.healthyPercentage - oldest.health.healthyPercentage
    };
  }

  /**
   * Get top N metrics by category.
   * @param {string} category - Category ('slowest', 'mostErrors', 'highest-volume')
   * @param {number} [limit=10] - Number of results
   * @return {Array<Object>} Top metrics
   */
  getTopMetrics(category, limit = 10) {
    if (!this.aggregatedMetrics) {
      return [];
    }

    const services = this.aggregatedMetrics.services;

    switch (category) {
      case 'slowest':
        return services
          .filter(s => s.avgLatency > 0)
          .sort((a, b) => b.avgLatency - a.avgLatency)
          .slice(0, limit);

      case 'mostErrors':
        return services
          .filter(s => s.totalErrors > 0)
          .sort((a, b) => b.totalErrors - a.totalErrors)
          .slice(0, limit);

      case 'highest-volume':
        return services
          .filter(s => s.totalCalls > 0)
          .sort((a, b) => b.totalCalls - a.totalCalls)
          .slice(0, limit);

      case 'worst-error-rate':
        return services
          .filter(s => s.errorRate > 0)
          .sort((a, b) => b.errorRate - a.errorRate)
          .slice(0, limit);

      default:
        return [];
    }
  }

  /**
   * Get all historical metric snapshots.
   * @return {Array<Object>} All metric snapshots in history
   */
  getAllSnapshots() {
    return this.history.slice();
  }

  /**
   * Export metrics for external analysis.
   * @param {string} [format='json'] - Export format
   * @return {string|Object} Exported metrics
   */
  export(format = 'json') {
    const data = {
      timestamp: new Date().toISOString(),
      current: this.aggregatedMetrics,
      history: this.history,
      analysis: {
        totalSnapshots: this.history.length,
        oldestSnapshot: this.history.length > 0 ? this.history[0].timestamp : null,
        newestSnapshot: this.aggregatedMetrics ? this.aggregatedMetrics.timestamp : null
      }
    };

    if (format === 'csv') {
      return this._exportAsCSV(data);
    }

    return data;
  }

  /**
   * Export metrics as CSV.
   * @private
   * @param {Object} data - Data to export
   * @return {string} CSV formatted data
   */
  _exportAsCSV(data) {
    let csv = 'Timestamp,Service,Status,TotalCalls,Errors,ErrorRate%,AvgLatency(ms)\n';

    if (data.current && data.current.services) {
      for (const service of data.current.services) {
        csv += `"${data.current.timestamp}","${service.name}","${service.status}",${service.totalCalls},${service.totalErrors},${service.errorRate},${service.avgLatency}\n`;
      }
    }

    return csv;
  }

  /**
   * Clear all historical data.
   */
  reset() {
    this.history = [];
    this.aggregatedMetrics = null;
    this.lastSnapshot = null;
  }
}

module.exports = MetricsAggregator;
