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

  return {
    getDependencyGraph: () => service.getDependencyGraph(),
    getHealthOverview: () => service.getHealthOverview(),
    getCriticalPaths: (limit) => service.getCriticalPaths(limit)
  };
}

module.exports = setupMonitoringRoutes;
