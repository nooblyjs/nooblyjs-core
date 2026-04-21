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
const MetricsAggregator = require('./utils/metricsAggregator');
const RequestTracer = require('./utils/requestTracer');
const MonitoringSearchEngine = require('./utils/searchUtils');
const ThemeManager = require('./utils/darkModeUtils');
const AdminManager = require('./utils/adminUtils');
const {
  DashboardConfig,
  VisualizationHelper,
  ResponsiveHelper
} = require('./utils/uiUtils');
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

  // Initialize the dependency graph, metrics aggregator, request tracer, search engine, theme manager, and admin manager
  const graph = new ServiceDependencyGraph(options);
  const metricsAggregator = new MetricsAggregator({
    historySize: 1000,
    snapshotInterval: 60000 // 1 minute
  });
  const requestTracer = new RequestTracer({
    maxTraces: 10000,
    maxSpans: 100000,
    traceTTL: 3600000 // 1 hour
  });
  const searchEngine = new MonitoringSearchEngine({
    maxResults: 100
  });
  const themeManager = new ThemeManager({
    defaultTheme: 'auto'
  });
  const adminManager = new AdminManager();
  const dashboardConfig = new DashboardConfig({
    title: 'Monitoring Dashboard'
  });
  const visualizationHelper = new VisualizationHelper();
  const responsiveHelper = new ResponsiveHelper();

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
   * Record a metrics snapshot for historical tracking.
   * Should be called periodically (e.g., every minute).
   * @return {Object} Current aggregated metrics snapshot
   */
  function recordMetricsSnapshot() {
    return metricsAggregator.recordSnapshot(graph);
  }

  /**
   * Get current aggregated metrics across all services.
   * @return {Object|null} Current aggregated metrics
   */
  function getAggregatedMetrics() {
    return metricsAggregator.getCurrentMetrics();
  }

  /**
   * Get metrics for a specific service.
   * @param {string} serviceName - Service name
   * @return {Object|null} Service metrics or null
   */
  function getServiceMetrics(serviceName) {
    return metricsAggregator.getServiceMetrics(serviceName);
  }

  /**
   * Get historical metrics within time range.
   * @param {number} [hoursBack=24] - Hours of history
   * @return {Array<Object>} Historical snapshots
   */
  function getHistoricalMetrics(hoursBack = 24) {
    return metricsAggregator.getHistoricalMetrics(hoursBack);
  }

  /**
   * Get top metrics by category.
   * @param {string} category - Category (slowest, mostErrors, highest-volume, worst-error-rate)
   * @param {number} [limit=10] - Number of results
   * @return {Array<Object>} Top metrics
   */
  function getTopMetrics(category, limit = 10) {
    return metricsAggregator.getTopMetrics(category, limit);
  }

  /**
   * Get metrics comparison between time points.
   * @param {number} [hoursBack=1] - Hours back to compare
   * @return {Object|null} Comparison metrics
   */
  function getMetricsComparison(hoursBack = 1) {
    return metricsAggregator.getMetricsComparison(hoursBack);
  }

  /**
   * Start a new trace for a request.
   * @param {Object} [options={}] - Trace options
   * @param {string} [options.traceId] - Use specific trace ID
   * @param {string} [options.service] - Service initiating trace
   * @param {string} [options.endpoint] - API endpoint being called
   * @param {Object} [options.metadata={}] - Custom metadata
   * @return {string} Generated or provided trace ID
   */
  function startTrace(options = {}) {
    return requestTracer.startTrace(options);
  }

  /**
   * Start a new span within a trace.
   * @param {string} traceId - Trace ID
   * @param {Object} [options={}] - Span options
   * @param {string} [options.spanId] - Use specific span ID
   * @param {string} [options.parentSpanId] - Parent span ID
   * @param {string} [options.operation] - Operation name
   * @param {string} [options.service] - Service name
   * @param {string} [options.endpoint] - Endpoint being called
   * @param {Object} [options.tags={}] - Custom tags
   * @return {string} Generated or provided span ID
   */
  function startSpan(traceId, options = {}) {
    return requestTracer.startSpan(traceId, options);
  }

  /**
   * End a span with status and optional error.
   * @param {string} spanId - Span ID to end
   * @param {Object} [options={}] - End options
   * @param {string} [options.status='success'] - Span status
   * @param {Error|string} [options.error] - Error if span failed
   * @param {number} [options.latency] - Call latency in ms
   * @return {Object} Ended span object
   */
  function endSpan(spanId, options = {}) {
    return requestTracer.endSpan(spanId, options);
  }

  /**
   * Add a log entry to a span.
   * @param {string} spanId - Span ID
   * @param {Object} logEntry - Log entry with level, message, fields
   */
  function addSpanLog(spanId, logEntry) {
    return requestTracer.addLog(spanId, logEntry);
  }

  /**
   * End a trace with overall status.
   * @param {string} traceId - Trace ID
   * @param {Object} [options={}] - End options
   * @param {string} [options.status='success'] - Overall status
   * @param {Error} [options.error] - Error if trace failed
   * @return {Object} Completed trace object
   */
  function endTrace(traceId, options = {}) {
    return requestTracer.endTrace(traceId, options);
  }

  /**
   * Get complete trace with all spans.
   * @param {string} traceId - Trace ID
   * @return {Object|null} Complete trace with expanded spans
   */
  function getTrace(traceId) {
    return requestTracer.getTrace(traceId);
  }

  /**
   * Get trace summary without full span details.
   * @param {string} traceId - Trace ID
   * @return {Object|null} Trace summary
   */
  function getTraceSummary(traceId) {
    return requestTracer.getTraceSummary(traceId);
  }

  /**
   * Get all traces matching criteria.
   * @param {Object} [filter={}] - Filter criteria
   * @param {string} [filter.service] - Filter by service
   * @param {string} [filter.status] - Filter by status
   * @param {number} [filter.minDuration] - Minimum duration (ms)
   * @param {number} [filter.maxDuration] - Maximum duration (ms)
   * @param {number} [filter.limit=100] - Max results
   * @return {Array<Object>} Matching trace summaries
   */
  function findTraces(filter = {}) {
    return requestTracer.findTraces(filter);
  }

  /**
   * Get call chain visualization for a trace.
   * @param {string} traceId - Trace ID
   * @return {Object|null} Call chain visualization data
   */
  function getCallChainVisualization(traceId) {
    return requestTracer.getCallChainVisualization(traceId);
  }

  /**
   * Get slowest spans in a trace.
   * @param {string} traceId - Trace ID
   * @param {number} [limit=10] - Number of results
   * @return {Array<Object>} Slowest spans
   */
  function getSlowestSpans(traceId, limit = 10) {
    return requestTracer.getSlowestSpans(traceId, limit);
  }

  /**
   * Get error spans in a trace.
   * @param {string} traceId - Trace ID
   * @return {Array<Object>} Spans with errors
   */
  function getErrorSpans(traceId) {
    return requestTracer.getErrorSpans(traceId);
  }

  /**
   * Search traces with full-text and faceted filtering.
   * @param {Object} criteria - Search criteria
   * @param {string} [criteria.query] - Full-text search query
   * @param {Object} [criteria.filters={}] - Faceted filters
   * @param {string} [criteria.sortBy='timestamp'] - Sort field
   * @param {string} [criteria.sortOrder='desc'] - Sort order
   * @param {number} [criteria.limit=10] - Result limit
   * @return {Array<Object>} Matching traces with relevance scores
   */
  function searchTraces(criteria = {}) {
    const traces = Array.from(requestTracer.traces.values());
    return searchEngine.searchTraces(traces, criteria);
  }

  /**
   * Search metrics with full-text and faceted filtering.
   * @param {Object} criteria - Search criteria
   * @param {string} [criteria.query] - Full-text search query
   * @param {Object} [criteria.filters={}] - Faceted filters
   * @param {string} [criteria.sortBy='timestamp'] - Sort field
   * @param {string} [criteria.sortOrder='desc'] - Sort order
   * @param {number} [criteria.limit=10] - Result limit
   * @return {Array<Object>} Matching metrics
   */
  function searchMetrics(criteria = {}) {
    const metrics = metricsAggregator.getAllSnapshots();
    return searchEngine.searchMetrics(metrics, criteria);
  }

  /**
   * Get available facets for filtering.
   * @return {Object} Available facet values
   */
  function getSearchFacets() {
    const traces = Array.from(requestTracer.traces.values());
    return searchEngine.getFacets(traces);
  }

  /**
   * Save a search query for later use.
   * @param {string} name - Search name
   * @param {Object} criteria - Search criteria
   */
  function saveSearch(name, criteria) {
    searchEngine.saveSearch(name, criteria);
  }

  /**
   * Retrieve a saved search.
   * @param {string} name - Search name
   * @return {Object|null} Saved search criteria or null
   */
  function getSearch(name) {
    return searchEngine.getSearch(name);
  }

  /**
   * List all saved searches.
   * @return {Array<Object>} List of saved searches
   */
  function listSearches() {
    return searchEngine.listSearches();
  }

  /**
   * Delete a saved search.
   * @param {string} name - Search name
   * @return {boolean} True if deleted, false if not found
   */
  function deleteSearch(name) {
    return searchEngine.deleteSearch(name);
  }

  /**
   * Set theme (light or dark).
   * @param {string} theme - Theme to set (light|dark)
   */
  function setTheme(theme) {
    themeManager.setTheme(theme);
  }

  /**
   * Get current theme.
   * @return {string} Current theme (light|dark)
   */
  function getTheme() {
    return themeManager.getTheme();
  }

  /**
   * Toggle between light and dark theme.
   */
  function toggleTheme() {
    themeManager.toggleTheme();
  }

  /**
   * Check if dark mode is active.
   * @return {boolean} True if dark mode is active
   */
  function isDarkMode() {
    return themeManager.isDark();
  }

  /**
   * Set a rate limit policy.
   * @param {string} endpoint - Endpoint path pattern
   * @param {Object} policy - Rate limiting policy
   * @return {Object} Updated policy
   */
  function setRateLimitPolicy(endpoint, policy) {
    return adminManager.setRateLimitPolicy(endpoint, policy);
  }

  /**
   * Get a rate limit policy.
   * @param {string} endpoint - Endpoint path pattern
   * @return {Object|null} Rate limiting policy or null
   */
  function getRateLimitPolicy(endpoint) {
    return adminManager.getRateLimitPolicy(endpoint);
  }

  /**
   * Get all rate limit policies.
   * @return {Array<Object>} All rate limiting policies
   */
  function getAllRateLimitPolicies() {
    return adminManager.getAllRateLimitPolicies();
  }

  /**
   * Delete a rate limit policy.
   * @param {string} endpoint - Endpoint path pattern
   * @return {boolean} True if deleted, false if not found
   */
  function deleteRateLimitPolicy(endpoint) {
    return adminManager.deleteRateLimitPolicy(endpoint);
  }

  /**
   * Update tracing configuration.
   * @param {Object} config - Tracing configuration
   * @return {Object} Updated tracing configuration
   */
  function setTracingConfig(config) {
    return adminManager.setTracingConfig(config);
  }

  /**
   * Get tracing configuration.
   * @return {Object} Current tracing configuration
   */
  function getTracingConfig() {
    return adminManager.getTracingConfig();
  }

  /**
   * Update system settings.
   * @param {Object} settings - System settings to update
   * @return {Object} Updated system settings
   */
  function setSystemSettings(settings) {
    return adminManager.setSystemSettings(settings);
  }

  /**
   * Get system settings.
   * @return {Object} Current system settings
   */
  function getSystemSettings() {
    return adminManager.getSystemSettings();
  }

  /**
   * Enable maintenance mode.
   * @param {string} [message] - Optional maintenance message
   */
  function enableMaintenanceMode(message) {
    adminManager.enableMaintenanceMode(message);
  }

  /**
   * Disable maintenance mode.
   */
  function disableMaintenanceMode() {
    adminManager.disableMaintenanceMode();
  }

  /**
   * Get audit log entries.
   * @param {Object} [filter={}] - Filter options
   * @return {Array<Object>} Audit log entries
   */
  function getAuditLog(filter) {
    return adminManager.getAuditLog(filter);
  }

  /**
   * Get system health and status summary.
   * @return {Object} Health status summary
   */
  function getAdminHealthSummary() {
    return adminManager.getHealthSummary();
  }

  /**
   * Create a new dashboard configuration.
   * @param {Object} options - Dashboard options
   * @return {DashboardConfig} Dashboard configuration instance
   */
  function createDashboardConfig(options = {}) {
    const config = new DashboardConfig(options);
    logger?.info('[Monitoring] Dashboard configuration created', {
      title: config.title,
      layout: config.layout
    });
    return config;
  }

  /**
   * Get current dashboard configuration.
   * @return {DashboardConfig} Current dashboard configuration
   */
  function getDashboardConfig() {
    return dashboardConfig;
  }

  /**
   * Add a widget to the dashboard.
   * @param {Object} widget - Widget configuration
   * @return {Object} Added widget
   */
  function addDashboardWidget(widget) {
    const added = dashboardConfig.addWidget(widget);
    logger?.info('[Monitoring] Widget added to dashboard', {
      widgetId: widget.id,
      widgetType: widget.type
    });
    return added;
  }

  /**
   * Remove a widget from the dashboard.
   * @param {string} widgetId - Widget ID to remove
   * @return {boolean} True if removed successfully
   */
  function removeDashboardWidget(widgetId) {
    const removed = dashboardConfig.removeWidget(widgetId);
    if (removed) {
      logger?.info('[Monitoring] Widget removed from dashboard', {
        widgetId
      });
    }
    return removed;
  }

  /**
   * Update a dashboard widget configuration.
   * @param {string} widgetId - Widget ID to update
   * @param {Object} updates - Configuration updates
   * @return {Object|null} Updated widget or null if not found
   */
  function updateDashboardWidget(widgetId, updates) {
    const updated = dashboardConfig.updateWidget(widgetId, updates);
    if (updated) {
      logger?.info('[Monitoring] Widget configuration updated', {
        widgetId
      });
    }
    return updated;
  }

  /**
   * Export dashboard configuration.
   * @return {Object} Exported configuration
   */
  function exportDashboard() {
    return dashboardConfig.export();
  }

  /**
   * Import dashboard configuration.
   * @param {Object} config - Configuration to import
   */
  function importDashboard(config) {
    dashboardConfig.import(config);
    logger?.info('[Monitoring] Dashboard configuration imported');
  }

  /**
   * Get responsive column count for viewport width.
   * @param {number} viewportWidth - Viewport width in pixels
   * @return {number} Column count
   */
  function getResponsiveColumns(viewportWidth) {
    return dashboardConfig.getResponsiveColumns(viewportWidth);
  }

  /**
   * Get responsive breakpoint for viewport width.
   * @param {number} viewportWidth - Viewport width in pixels
   * @return {string} Breakpoint name (mobile|tablet|desktop|wide)
   */
  function getResponsiveBreakpoint(viewportWidth) {
    return dashboardConfig.getResponsiveBreakpoint(viewportWidth);
  }

  /**
   * Generate a bar chart SVG.
   * @param {Array<Object>} data - Chart data points
   * @param {Object} [options={}] - Chart options
   * @return {string} SVG markup
   */
  function generateBarChart(data, options = {}) {
    return visualizationHelper.generateBarChart(data, options);
  }

  /**
   * Generate a line chart SVG.
   * @param {Array<Object>} data - Data points with x, y values
   * @param {Object} [options={}] - Chart options
   * @return {string} SVG markup
   */
  function generateLineChart(data, options = {}) {
    return visualizationHelper.generateLineChart(data, options);
  }

  /**
   * Generate a metric card HTML.
   * @param {Object} metric - Metric data
   * @return {string} HTML markup
   */
  function generateMetricCard(metric) {
    return visualizationHelper.generateMetricCard(metric);
  }

  /**
   * Generate responsive grid CSS.
   * @param {number} [columns=3] - Number of columns for desktop
   * @return {string} CSS rules
   */
  function generateResponsiveGridCSS(columns = 3) {
    return responsiveHelper.generateResponsiveGrid(columns);
  }

  /**
   * Export complete monitoring snapshot and metrics.
   * @param {string} [format='json'] - Export format (json or csv)
   * @return {Object|string} Exported data
   */
  function export_(format = 'json') {
    return {
      graph: graph.export(),
      metrics: metricsAggregator.export(format),
      traces: requestTracer.export(),
      searches: searchEngine.export(),
      theme: themeManager.export(),
      admin: adminManager.export(),
      dashboard: dashboardConfig.export()
    };
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
    recordMetricsSnapshot,
    getAggregatedMetrics,
    getHistoricalMetrics,
    getTopMetrics,
    getMetricsComparison,
    reset,
    export: export_,
    startTrace,
    startSpan,
    endSpan,
    addSpanLog,
    endTrace,
    getTrace,
    getTraceSummary,
    findTraces,
    getCallChainVisualization,
    getSlowestSpans,
    getErrorSpans,
    searchTraces,
    searchMetrics,
    getSearchFacets,
    saveSearch,
    getSearch,
    listSearches,
    deleteSearch,
    setTheme,
    getTheme,
    toggleTheme,
    isDarkMode,
    setRateLimitPolicy,
    getRateLimitPolicy,
    getAllRateLimitPolicies,
    deleteRateLimitPolicy,
    setTracingConfig,
    getTracingConfig,
    setSystemSettings,
    getSystemSettings,
    enableMaintenanceMode,
    disableMaintenanceMode,
    getAuditLog,
    getAdminHealthSummary,
    createDashboardConfig,
    getDashboardConfig,
    addDashboardWidget,
    removeDashboardWidget,
    updateDashboardWidget,
    exportDashboard,
    importDashboard,
    getResponsiveColumns,
    getResponsiveBreakpoint,
    generateBarChart,
    generateLineChart,
    generateMetricCard,
    generateResponsiveGridCSS,
    logger,
    graph,
    metricsAggregator,
    requestTracer,
    searchEngine,
    themeManager,
    adminManager,
    dashboardConfig,
    visualizationHelper,
    responsiveHelper
  };

  // Setup routes and views for the monitoring service
  setupRoutes(options['express-app'], service, options.authMiddleware);
  Views(options, eventEmitter, logger);

  // Start periodic metrics snapshot recording (every minute)
  let snapshotInterval = null;
  if (enableAutoTracking) {
    snapshotInterval = setInterval(() => {
      try {
        service.recordMetricsSnapshot();
      } catch (err) {
        logger?.error('[Monitoring] Failed to record metrics snapshot', {
          error: err.message
        });
      }
    }, 60000); // Every 60 seconds

    // Allow process to exit even if interval is running
    if (snapshotInterval.unref) {
      snapshotInterval.unref();
    }
  }

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
