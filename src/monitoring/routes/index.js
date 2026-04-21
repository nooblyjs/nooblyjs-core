/**
 * @fileoverview Monitoring Service Routes
 * REST API endpoints for service dependency tracking and metrics visualization
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Setup monitoring service routes.
 * Provides endpoints for service dependency graph and metrics visualization.
 *
 * @param {Object} app - Express application instance (or options object with 'express-app' key)
 * @param {Object} service - Monitoring service instance
 * @param {Function} authMiddleware - Authentication middleware
 * @return {void}
 *
 * @example
 * const setupRoutes = require('./routes');
 * setupRoutes(app, monitoringService, authMiddleware);
 */
function setupMonitoringRoutes(app, service, authMiddleware) {
  // Handle both direct app and options object patterns
  if (app && typeof app === 'object' && app['express-app']) {
    app = app['express-app'];
  }

  if (!app) {
    service?.logger?.warn('[MonitoringRoutes] Express app not provided, skipping route setup');
    return;
  }

  const logger = service.logger;

  /**
   * GET /services/monitoring/api/graph
   * Get complete service dependency graph
   */
  app.get('/services/monitoring/api/graph', authMiddleware, (req, res) => {
    try {
      const graphData = service.getDependencyGraph();

      res.status(200).json({
        success: true,
        data: graphData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get dependency graph', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/health-overview
   * Get overall health status of all services
   */
  app.get('/services/monitoring/api/health-overview', authMiddleware, (req, res) => {
    try {
      const overview = service.getHealthOverview();

      res.status(200).json({
        success: true,
        data: overview,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get health overview', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/critical-paths
   * Get highest-priority service call paths
   *
   * Query Parameters:
   * - limit: number of paths to return (default: 10)
   */
  app.get('/services/monitoring/api/critical-paths', authMiddleware, (req, res) => {
    try {
      const limit = parseInt(req.query.limit || '10', 10);
      const paths = service.getCriticalPaths(limit);

      res.status(200).json({
        success: true,
        data: paths,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get critical paths', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/service/:serviceName/impact
   * Analyze dependency impact for a specific service
   *
   * Path Parameters:
   * - serviceName: name of service to analyze
   */
  app.get('/services/monitoring/api/service/:serviceName/impact', authMiddleware, (req, res) => {
    try {
      const { serviceName } = req.params;
      const impact = service.analyzeDependencyImpact(serviceName);

      if (!impact) {
        return res.status(404).json({
          success: false,
          error: `Service ${serviceName} not found`
        });
      }

      res.status(200).json({
        success: true,
        data: impact,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to analyze dependency impact', {
        error: error.message,
        serviceName: req.params.serviceName
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/service/:serviceName/metrics
   * Get detailed metrics for a specific service
   *
   * Path Parameters:
   * - serviceName: name of service
   */
  app.get('/services/monitoring/api/service/:serviceName/metrics', authMiddleware, (req, res) => {
    try {
      const { serviceName } = req.params;
      const metrics = service.getServiceMetrics(serviceName);

      if (!metrics) {
        return res.status(404).json({
          success: false,
          error: `Service ${serviceName} not found`
        });
      }

      res.status(200).json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get service metrics', {
        error: error.message,
        serviceName: req.params.serviceName
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/relationship-matrix
   * Get service relationship matrix with call counts and latencies
   */
  app.get('/services/monitoring/api/relationship-matrix', authMiddleware, (req, res) => {
    try {
      const matrix = service.getRelationshipMatrix();

      res.status(200).json({
        success: true,
        data: matrix,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get relationship matrix', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/export
   * Export complete monitoring snapshot
   */
  app.get('/services/monitoring/api/export', authMiddleware, (req, res) => {
    try {
      const snapshot = service.export();

      res.status(200).json({
        success: true,
        data: snapshot,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to export monitoring data', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/record-call
   * Record a service-to-service call for tracking
   *
   * Body Parameters:
   * - from: calling service name
   * - to: called service name
   * - latency: call latency in milliseconds (default: 0)
   * - success: whether call succeeded (default: true)
   * - error: error message if failed (default: null)
   */
  app.post('/services/monitoring/api/record-call', authMiddleware, (req, res) => {
    try {
      const { from, to, latency = 0, success = true, error: errorMsg = null } = req.body;

      if (!from || !to) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: from, to'
        });
      }

      service.recordCall(from, to, latency, success, errorMsg);

      res.status(200).json({
        success: true,
        message: `Call recorded from ${from} to ${to}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to record call', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /services/monitoring/api/service/:serviceName/status
   * Update service health status
   *
   * Path Parameters:
   * - serviceName: name of service
   *
   * Body Parameters:
   * - status: health status (healthy|degraded|unhealthy|unknown)
   */
  app.put('/services/monitoring/api/service/:serviceName/status', authMiddleware, (req, res) => {
    try {
      const { serviceName } = req.params;
      const { status } = req.body;

      const validStatuses = ['healthy', 'degraded', 'unhealthy', 'unknown'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      service.updateServiceStatus(serviceName, status);

      res.status(200).json({
        success: true,
        message: `Service ${serviceName} status updated to ${status}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to update service status', {
        error: error.message,
        serviceName: req.params.serviceName
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/reset
   * Reset all monitoring statistics
   */
  app.post('/services/monitoring/api/reset', authMiddleware, (req, res) => {
    try {
      service.reset();

      res.status(200).json({
        success: true,
        message: 'All monitoring statistics have been reset',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to reset monitoring data', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/metrics/aggregated
   * Get current aggregated metrics across all services
   */
  app.get('/services/monitoring/api/metrics/aggregated', authMiddleware, (req, res) => {
    try {
      const metrics = service.getAggregatedMetrics();

      if (!metrics) {
        return res.status(404).json({
          success: false,
          error: 'No metrics available yet. Metrics snapshots are recorded periodically.'
        });
      }

      res.status(200).json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get aggregated metrics', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/metrics/historical
   * Get historical metrics within time range
   *
   * Query Parameters:
   * - hours: number of hours back (default: 24)
   */
  app.get('/services/monitoring/api/metrics/historical', authMiddleware, (req, res) => {
    try {
      const hours = parseInt(req.query.hours || '24', 10);
      const historical = service.getHistoricalMetrics(hours);

      res.status(200).json({
        success: true,
        data: historical,
        count: historical.length,
        timeRange: `${hours} hours`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get historical metrics', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/metrics/comparison
   * Get metrics comparison between time points
   *
   * Query Parameters:
   * - hours: hours back to compare (default: 1)
   */
  app.get('/services/monitoring/api/metrics/comparison', authMiddleware, (req, res) => {
    try {
      const hours = parseInt(req.query.hours || '1', 10);
      const comparison = service.getMetricsComparison(hours);

      if (!comparison) {
        return res.status(404).json({
          success: false,
          error: 'Insufficient historical data for comparison'
        });
      }

      res.status(200).json({
        success: true,
        data: comparison,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get metrics comparison', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/metrics/top
   * Get top metrics by category
   *
   * Query Parameters:
   * - category: 'slowest', 'mostErrors', 'highest-volume', 'worst-error-rate'
   * - limit: number of results (default: 10)
   */
  app.get('/services/monitoring/api/metrics/top', authMiddleware, (req, res) => {
    try {
      const category = req.query.category || 'slowest';
      const limit = parseInt(req.query.limit || '10', 10);

      const topMetrics = service.getTopMetrics(category, limit);

      res.status(200).json({
        success: true,
        category,
        limit,
        data: topMetrics,
        count: topMetrics.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get top metrics', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/metrics/snapshot
   * Trigger immediate metrics snapshot recording
   */
  app.post('/services/monitoring/api/metrics/snapshot', authMiddleware, (req, res) => {
    try {
      const snapshot = service.recordMetricsSnapshot();

      res.status(200).json({
        success: true,
        message: 'Metrics snapshot recorded',
        data: snapshot,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to record metrics snapshot', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/trace/start
   * Start a new trace for request correlation
   *
   * Body Parameters:
   * - service: initiating service name
   * - endpoint: API endpoint being called
   * - metadata: optional custom metadata
   */
  app.post('/services/monitoring/api/trace/start', authMiddleware, (req, res) => {
    try {
      const { service: serviceName, endpoint, metadata = {} } = req.body;

      if (!serviceName) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: service'
        });
      }

      const traceId = service.startTrace({
        service: serviceName,
        endpoint,
        metadata
      });

      res.status(200).json({
        success: true,
        data: { traceId },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to start trace', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/trace/:traceId/span/start
   * Start a new span within a trace
   *
   * Body Parameters:
   * - operation: operation name
   * - service: service name
   * - endpoint: endpoint being called
   * - parentSpanId: parent span ID (optional)
   * - tags: custom tags (optional)
   */
  app.post('/services/monitoring/api/trace/:traceId/span/start', authMiddleware, (req, res) => {
    try {
      const { traceId } = req.params;
      const { operation, service: serviceName, endpoint, parentSpanId, tags = {} } = req.body;

      if (!traceId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: traceId'
        });
      }

      const spanId = service.startSpan(traceId, {
        operation,
        service: serviceName,
        endpoint,
        parentSpanId,
        tags
      });

      res.status(200).json({
        success: true,
        data: { spanId, traceId },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to start span', {
        error: error.message,
        traceId: req.params.traceId
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/span/:spanId/end
   * End a span with status and optional error
   *
   * Body Parameters:
   * - status: span status (success, error, timeout, etc.)
   * - error: error message if failed (optional)
   * - latency: call latency in ms (optional)
   */
  app.post('/services/monitoring/api/span/:spanId/end', authMiddleware, (req, res) => {
    try {
      const { spanId } = req.params;
      const { status = 'success', error: errorMsg, latency } = req.body;

      if (!spanId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: spanId'
        });
      }

      const span = service.endSpan(spanId, {
        status,
        error: errorMsg,
        latency
      });

      res.status(200).json({
        success: true,
        data: span,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to end span', {
        error: error.message,
        spanId: req.params.spanId
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/span/:spanId/log
   * Add a log entry to a span
   *
   * Body Parameters:
   * - level: log level (info, warn, error)
   * - message: log message
   * - fields: optional additional fields
   */
  app.post('/services/monitoring/api/span/:spanId/log', authMiddleware, (req, res) => {
    try {
      const { spanId } = req.params;
      const { level = 'info', message, fields = {} } = req.body;

      if (!spanId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: spanId'
        });
      }

      service.addSpanLog(spanId, {
        level,
        message,
        fields
      });

      res.status(200).json({
        success: true,
        message: 'Log entry added',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to add span log', {
        error: error.message,
        spanId: req.params.spanId
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/trace/:traceId/end
   * End a trace with overall status
   *
   * Body Parameters:
   * - status: overall status
   * - error: error message if trace failed (optional)
   */
  app.post('/services/monitoring/api/trace/:traceId/end', authMiddleware, (req, res) => {
    try {
      const { traceId } = req.params;
      const { status = 'success', error: errorMsg } = req.body;

      if (!traceId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: traceId'
        });
      }

      const trace = service.endTrace(traceId, {
        status,
        error: errorMsg
      });

      res.status(200).json({
        success: true,
        data: trace,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to end trace', {
        error: error.message,
        traceId: req.params.traceId
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/trace/:traceId
   * Get complete trace with all spans
   *
   * Path Parameters:
   * - traceId: trace ID
   */
  app.get('/services/monitoring/api/trace/:traceId', authMiddleware, (req, res) => {
    try {
      const { traceId } = req.params;
      const trace = service.getTrace(traceId);

      if (!trace) {
        return res.status(404).json({
          success: false,
          error: `Trace ${traceId} not found`
        });
      }

      res.status(200).json({
        success: true,
        data: trace,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get trace', {
        error: error.message,
        traceId: req.params.traceId
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/trace/:traceId/summary
   * Get trace summary without full span details
   *
   * Path Parameters:
   * - traceId: trace ID
   */
  app.get('/services/monitoring/api/trace/:traceId/summary', authMiddleware, (req, res) => {
    try {
      const { traceId } = req.params;
      const summary = service.getTraceSummary(traceId);

      if (!summary) {
        return res.status(404).json({
          success: false,
          error: `Trace ${traceId} not found`
        });
      }

      res.status(200).json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get trace summary', {
        error: error.message,
        traceId: req.params.traceId
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/trace/:traceId/chain
   * Get call chain visualization for a trace
   *
   * Path Parameters:
   * - traceId: trace ID
   */
  app.get('/services/monitoring/api/trace/:traceId/chain', authMiddleware, (req, res) => {
    try {
      const { traceId } = req.params;
      const chainViz = service.getCallChainVisualization(traceId);

      if (!chainViz) {
        return res.status(404).json({
          success: false,
          error: `Trace ${traceId} not found`
        });
      }

      res.status(200).json({
        success: true,
        data: chainViz,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get call chain visualization', {
        error: error.message,
        traceId: req.params.traceId
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/trace/:traceId/slowest-spans
   * Get slowest spans in a trace
   *
   * Path Parameters:
   * - traceId: trace ID
   * Query Parameters:
   * - limit: number of spans to return (default: 10)
   */
  app.get('/services/monitoring/api/trace/:traceId/slowest-spans', authMiddleware, (req, res) => {
    try {
      const { traceId } = req.params;
      const limit = parseInt(req.query.limit || '10', 10);
      const spans = service.getSlowestSpans(traceId, limit);

      res.status(200).json({
        success: true,
        data: spans,
        count: spans.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get slowest spans', {
        error: error.message,
        traceId: req.params.traceId
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/trace/:traceId/error-spans
   * Get spans with errors in a trace
   *
   * Path Parameters:
   * - traceId: trace ID
   */
  app.get('/services/monitoring/api/trace/:traceId/error-spans', authMiddleware, (req, res) => {
    try {
      const { traceId } = req.params;
      const errorSpans = service.getErrorSpans(traceId);

      res.status(200).json({
        success: true,
        data: errorSpans,
        count: errorSpans.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get error spans', {
        error: error.message,
        traceId: req.params.traceId
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/traces
   * Get all traces matching criteria
   *
   * Query Parameters:
   * - service: filter by service
   * - status: filter by status
   * - minDuration: minimum duration (ms)
   * - maxDuration: maximum duration (ms)
   * - limit: max results (default: 100)
   */
  app.get('/services/monitoring/api/traces', authMiddleware, (req, res) => {
    try {
      const filter = {
        service: req.query.service,
        status: req.query.status,
        minDuration: req.query.minDuration ? parseInt(req.query.minDuration, 10) : undefined,
        maxDuration: req.query.maxDuration ? parseInt(req.query.maxDuration, 10) : undefined,
        limit: parseInt(req.query.limit || '100', 10)
      };

      const traces = service.findTraces(filter);

      res.status(200).json({
        success: true,
        data: traces,
        count: traces.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to find traces', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/search/traces
   * Search traces with full-text and faceted filtering
   *
   * Body Parameters:
   * - query: full-text search query
   * - filters: faceted filters object
   * - sortBy: sort field (timestamp, duration, errorSpans)
   * - sortOrder: sort order (asc|desc)
   * - limit: result limit
   */
  app.post('/services/monitoring/api/search/traces', authMiddleware, (req, res) => {
    try {
      const { query, filters, sortBy = 'startTime', sortOrder = 'desc', limit = 10 } = req.body;

      const results = service.searchTraces({
        query,
        filters,
        sortBy,
        sortOrder,
        limit
      });

      res.status(200).json({
        success: true,
        data: results,
        count: results.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to search traces', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/search/metrics
   * Search metrics with full-text and faceted filtering
   *
   * Body Parameters:
   * - query: full-text search query
   * - filters: faceted filters object
   * - sortBy: sort field (timestamp, totalCalls, avgLatency)
   * - sortOrder: sort order (asc|desc)
   * - limit: result limit
   */
  app.post('/services/monitoring/api/search/metrics', authMiddleware, (req, res) => {
    try {
      const { query, filters, sortBy = 'timestamp', sortOrder = 'desc', limit = 10 } = req.body;

      const results = service.searchMetrics({
        query,
        filters,
        sortBy,
        sortOrder,
        limit
      });

      res.status(200).json({
        success: true,
        data: results,
        count: results.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to search metrics', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/search/facets
   * Get available facets for search filtering
   */
  app.get('/services/monitoring/api/search/facets', authMiddleware, (req, res) => {
    try {
      const facets = service.getSearchFacets();

      res.status(200).json({
        success: true,
        data: facets,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get search facets', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/search/save
   * Save a search query
   *
   * Body Parameters:
   * - name: search name
   * - query: search query
   * - filters: faceted filters
   */
  app.post('/services/monitoring/api/search/save', authMiddleware, (req, res) => {
    try {
      const { name, query, filters } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: name'
        });
      }

      service.saveSearch(name, { query, filters });

      res.status(200).json({
        success: true,
        message: `Search "${name}" saved`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to save search', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/search/saved
   * List all saved searches
   */
  app.get('/services/monitoring/api/search/saved', authMiddleware, (req, res) => {
    try {
      const searches = service.listSearches();

      res.status(200).json({
        success: true,
        data: searches,
        count: searches.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to list saved searches', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/search/saved/:name
   * Get a specific saved search
   *
   * Path Parameters:
   * - name: search name
   */
  app.get('/services/monitoring/api/search/saved/:name', authMiddleware, (req, res) => {
    try {
      const { name } = req.params;
      const search = service.getSearch(name);

      if (!search) {
        return res.status(404).json({
          success: false,
          error: `Search "${name}" not found`
        });
      }

      res.status(200).json({
        success: true,
        data: search,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get saved search', {
        error: error.message,
        name: req.params.name
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /services/monitoring/api/search/saved/:name
   * Delete a saved search
   *
   * Path Parameters:
   * - name: search name
   */
  app.delete('/services/monitoring/api/search/saved/:name', authMiddleware, (req, res) => {
    try {
      const { name } = req.params;
      const deleted = service.deleteSearch(name);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: `Search "${name}" not found`
        });
      }

      res.status(200).json({
        success: true,
        message: `Search "${name}" deleted`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to delete saved search', {
        error: error.message,
        name: req.params.name
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /services/monitoring/api/theme
   * Set application theme
   *
   * Body Parameters:
   * - theme: theme to set (light|dark)
   */
  app.put('/services/monitoring/api/theme', authMiddleware, (req, res) => {
    try {
      const { theme } = req.body;

      if (!theme || (theme !== 'light' && theme !== 'dark')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid theme. Must be light or dark.'
        });
      }

      service.setTheme(theme);

      res.status(200).json({
        success: true,
        data: { theme: service.getTheme() },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to set theme', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/theme
   * Get current application theme
   */
  app.get('/services/monitoring/api/theme', authMiddleware, (req, res) => {
    try {
      res.status(200).json({
        success: true,
        data: {
          theme: service.getTheme(),
          isDark: service.isDarkMode()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get theme', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/theme/toggle
   * Toggle between light and dark theme
   */
  app.post('/services/monitoring/api/theme/toggle', authMiddleware, (req, res) => {
    try {
      service.toggleTheme();

      res.status(200).json({
        success: true,
        data: { theme: service.getTheme() },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to toggle theme', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/admin/rate-limit
   * Set a rate limiting policy
   *
   * Body Parameters:
   * - endpoint: endpoint path pattern
   * - requestsPerMinute: requests per minute limit
   * - requestsPerHour: requests per hour limit (optional)
   * - burstSize: burst size allowed (optional)
   */
  app.post('/services/monitoring/api/admin/rate-limit', authMiddleware, (req, res) => {
    try {
      const { endpoint, ...policy } = req.body;

      if (!endpoint) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: endpoint'
        });
      }

      const updated = service.setRateLimitPolicy(endpoint, policy);

      res.status(200).json({
        success: true,
        data: updated,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to set rate limit policy', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/admin/rate-limit
   * Get all rate limiting policies
   */
  app.get('/services/monitoring/api/admin/rate-limit', authMiddleware, (req, res) => {
    try {
      const policies = service.getAllRateLimitPolicies();

      res.status(200).json({
        success: true,
        data: policies,
        count: policies.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get rate limit policies', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /services/monitoring/api/admin/rate-limit/:endpoint
   * Delete a rate limiting policy
   */
  app.delete('/services/monitoring/api/admin/rate-limit/:endpoint', authMiddleware, (req, res) => {
    try {
      const { endpoint } = req.params;
      const deleted = service.deleteRateLimitPolicy(endpoint);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: `Policy for ${endpoint} not found`
        });
      }

      res.status(200).json({
        success: true,
        message: `Policy for ${endpoint} deleted`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to delete rate limit policy', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /services/monitoring/api/admin/tracing
   * Update tracing configuration
   *
   * Body Parameters:
   * - enabled: enable/disable tracing
   * - samplingRate: sampling rate (0-1)
   * - excludedPaths: paths to exclude from tracing
   * - maxTraces: maximum traces to keep
   */
  app.put('/services/monitoring/api/admin/tracing', authMiddleware, (req, res) => {
    try {
      const config = service.setTracingConfig(req.body);

      res.status(200).json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to update tracing config', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/admin/tracing
   * Get tracing configuration
   */
  app.get('/services/monitoring/api/admin/tracing', authMiddleware, (req, res) => {
    try {
      const config = service.getTracingConfig();

      res.status(200).json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get tracing config', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /services/monitoring/api/admin/settings
   * Update system settings
   *
   * Body Parameters:
   * - maintenanceMode: enable/disable maintenance mode
   * - maintenanceMessage: maintenance message
   * - maxConcurrentRequests: max concurrent requests
   * - requestTimeout: request timeout (ms)
   * - cacheEnabled: enable/disable caching
   * - logLevel: log level (debug|info|warn|error)
   */
  app.put('/services/monitoring/api/admin/settings', authMiddleware, (req, res) => {
    try {
      const settings = service.setSystemSettings(req.body);

      res.status(200).json({
        success: true,
        data: settings,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to update system settings', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/admin/settings
   * Get system settings
   */
  app.get('/services/monitoring/api/admin/settings', authMiddleware, (req, res) => {
    try {
      const settings = service.getSystemSettings();

      res.status(200).json({
        success: true,
        data: settings,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get system settings', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/admin/maintenance/enable
   * Enable maintenance mode
   *
   * Body Parameters:
   * - message: optional maintenance message
   */
  app.post('/services/monitoring/api/admin/maintenance/enable', authMiddleware, (req, res) => {
    try {
      const { message } = req.body;
      service.enableMaintenanceMode(message);

      res.status(200).json({
        success: true,
        message: 'Maintenance mode enabled',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to enable maintenance mode', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/admin/maintenance/disable
   * Disable maintenance mode
   */
  app.post('/services/monitoring/api/admin/maintenance/disable', authMiddleware, (req, res) => {
    try {
      service.disableMaintenanceMode();

      res.status(200).json({
        success: true,
        message: 'Maintenance mode disabled',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to disable maintenance mode', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/admin/audit-log
   * Get audit log entries
   *
   * Query Parameters:
   * - type: filter by change type
   * - action: filter by action
   * - limit: result limit (default: 100)
   */
  app.get('/services/monitoring/api/admin/audit-log', authMiddleware, (req, res) => {
    try {
      const filter = {
        type: req.query.type,
        action: req.query.action,
        limit: parseInt(req.query.limit || '100', 10)
      };

      const log = service.getAuditLog(filter);

      res.status(200).json({
        success: true,
        data: log,
        count: log.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get audit log', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/admin/health
   * Get admin panel health and status summary
   */
  app.get('/services/monitoring/api/admin/health', authMiddleware, (req, res) => {
    try {
      const summary = service.getAdminHealthSummary();

      res.status(200).json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get admin health summary', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/dashboard/config
   * Create or update dashboard configuration
   *
   * Body Parameters:
   * - title: dashboard title
   * - layout: layout type (grid|flex|masonry)
   * - columnCount: number of columns
   * - theme: theme configuration
   */
  app.post('/services/monitoring/api/dashboard/config', authMiddleware, (req, res) => {
    try {
      const { title, layout, columnCount, theme } = req.body;
      const config = service.createDashboardConfig({
        title,
        layout,
        columnCount,
        theme
      });

      res.status(201).json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to create dashboard config', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/dashboard/config
   * Get current dashboard configuration
   */
  app.get('/services/monitoring/api/dashboard/config', authMiddleware, (req, res) => {
    try {
      const config = service.getDashboardConfig();

      res.status(200).json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get dashboard config', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/dashboard/widgets
   * Add a widget to dashboard
   *
   * Body Parameters:
   * - id: widget unique ID
   * - title: widget title
   * - type: widget type (chart|table|metric|card)
   * - width: width in columns (1-4)
   * - height: height in pixels
   * - config: widget-specific configuration
   */
  app.post('/services/monitoring/api/dashboard/widgets', authMiddleware, (req, res) => {
    try {
      const widget = service.addDashboardWidget(req.body);

      res.status(201).json({
        success: true,
        data: widget,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to add widget', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /services/monitoring/api/dashboard/widgets/:widgetId
   * Remove a widget from dashboard
   *
   * URL Parameters:
   * - widgetId: widget ID to remove
   */
  app.delete('/services/monitoring/api/dashboard/widgets/:widgetId', authMiddleware, (req, res) => {
    try {
      const { widgetId } = req.params;
      const removed = service.removeDashboardWidget(widgetId);

      res.status(200).json({
        success: removed,
        message: removed ? 'Widget removed' : 'Widget not found',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to remove widget', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /services/monitoring/api/dashboard/widgets/:widgetId
   * Update a widget configuration
   *
   * URL Parameters:
   * - widgetId: widget ID to update
   *
   * Body Parameters:
   * - title: new widget title
   * - visible: visibility state
   * - config: widget configuration updates
   */
  app.put('/services/monitoring/api/dashboard/widgets/:widgetId', authMiddleware, (req, res) => {
    try {
      const { widgetId } = req.params;
      const widget = service.updateDashboardWidget(widgetId, req.body);

      if (!widget) {
        return res.status(404).json({
          success: false,
          error: 'Widget not found'
        });
      }

      res.status(200).json({
        success: true,
        data: widget,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to update widget', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/dashboard/export
   * Export dashboard configuration
   */
  app.post('/services/monitoring/api/dashboard/export', authMiddleware, (req, res) => {
    try {
      const exported = service.exportDashboard();

      res.status(200).json({
        success: true,
        data: exported,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to export dashboard', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/dashboard/import
   * Import dashboard configuration
   *
   * Body Parameters:
   * - config: dashboard configuration to import
   */
  app.post('/services/monitoring/api/dashboard/import', authMiddleware, (req, res) => {
    try {
      const { config } = req.body;
      service.importDashboard(config);

      res.status(200).json({
        success: true,
        message: 'Dashboard configuration imported',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to import dashboard', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/visualization/bar-chart
   * Generate bar chart SVG
   *
   * Body Parameters:
   * - data: array of {label, value, color?} objects
   * - options: {width?, height?, title?}
   */
  app.post('/services/monitoring/api/visualization/bar-chart', authMiddleware, (req, res) => {
    try {
      const { data, options } = req.body;
      const svg = service.generateBarChart(data, options);

      res.status(200)
        .set('Content-Type', 'image/svg+xml')
        .send(svg);
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to generate bar chart', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/visualization/line-chart
   * Generate line chart SVG
   *
   * Body Parameters:
   * - data: array of {x, y} objects
   * - options: {width?, height?, title?}
   */
  app.post('/services/monitoring/api/visualization/line-chart', authMiddleware, (req, res) => {
    try {
      const { data, options } = req.body;
      const svg = service.generateLineChart(data, options);

      res.status(200)
        .set('Content-Type', 'image/svg+xml')
        .send(svg);
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to generate line chart', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /services/monitoring/api/visualization/metric-card
   * Generate metric card HTML
   *
   * Body Parameters:
   * - metric: {label, value, unit?, status?}
   */
  app.post('/services/monitoring/api/visualization/metric-card', authMiddleware, (req, res) => {
    try {
      const { metric } = req.body;
      const html = service.generateMetricCard(metric);

      res.status(200)
        .set('Content-Type', 'text/html')
        .send(html);
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to generate metric card', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/responsive/columns
   * Get responsive column count for viewport width
   *
   * Query Parameters:
   * - viewportWidth: width in pixels
   */
  app.get('/services/monitoring/api/responsive/columns', authMiddleware, (req, res) => {
    try {
      const viewportWidth = parseInt(req.query.viewportWidth || '1024', 10);
      const columns = service.getResponsiveColumns(viewportWidth);

      res.status(200).json({
        success: true,
        data: {
          viewportWidth,
          columns
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get responsive columns', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/responsive/breakpoint
   * Get responsive breakpoint for viewport width
   *
   * Query Parameters:
   * - viewportWidth: width in pixels
   */
  app.get('/services/monitoring/api/responsive/breakpoint', authMiddleware, (req, res) => {
    try {
      const viewportWidth = parseInt(req.query.viewportWidth || '1024', 10);
      const breakpoint = service.getResponsiveBreakpoint(viewportWidth);

      res.status(200).json({
        success: true,
        data: {
          viewportWidth,
          breakpoint
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to get responsive breakpoint', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /services/monitoring/api/responsive/grid-css
   * Generate responsive grid CSS
   *
   * Query Parameters:
   * - columns: number of columns (default: 3)
   */
  app.get('/services/monitoring/api/responsive/grid-css', authMiddleware, (req, res) => {
    try {
      const columns = parseInt(req.query.columns || '3', 10);
      const css = service.generateResponsiveGridCSS(columns);

      res.status(200)
        .set('Content-Type', 'text/css')
        .send(css);
    } catch (error) {
      logger?.error('[MonitoringRoutes] Failed to generate responsive grid CSS', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return {
    getDependencyGraph: () => service.getDependencyGraph(),
    getHealthOverview: () => service.getHealthOverview(),
    getCriticalPaths: (limit) => service.getCriticalPaths(limit),
    getAggregatedMetrics: () => service.getAggregatedMetrics(),
    getHistoricalMetrics: (hours) => service.getHistoricalMetrics(hours),
    getTopMetrics: (category, limit) => service.getTopMetrics(category, limit)
  };
}

module.exports = setupMonitoringRoutes;
