/**
 * @fileoverview Health Check Middleware for Production Load Balancers
 * Provides multiple health check endpoints for Kubernetes, Docker, and load balancers
 *
 * Endpoints:
 * - GET /health - Quick liveness check
 * - GET /health/live - Kubernetes liveness probe
 * - GET /health/ready - Kubernetes readiness probe
 * - GET /health/startup - Kubernetes startup probe
 * - GET /health/detailed - Full status report (protected)
 *
 * @author Digital Technologies Team
 * @version 1.0.0
 */

'use strict';

/**
 * @class HealthCheckManager
 * @description Manages application health status and critical service dependencies
 */
class HealthCheckManager {
  constructor(options = {}) {
    this.logger = options.logger;
    this.serviceRegistry = options.serviceRegistry;
    this.dependencies = options.dependencies || [];

    // Health state
    this.startTime = Date.now();
    this.isReady = false;
    this.criticalServicesHealthy = true;
    this.lastHealthCheck = null;

    // Service health tracking
    this.serviceHealth = new Map();
    this.errorCounts = new Map();
  }

  /**
   * Marks the application as ready (all startup tasks complete)
   */
  markReady() {
    this.isReady = true;
    this.logger?.info('[HealthCheck] Application marked as ready', {
      uptime: this.getUptime()
    });
  }

  /**
   * Records a service error for health monitoring
   *
   * @param {string} serviceName - Name of the service
   * @param {Error} error - The error that occurred
   */
  recordServiceError(serviceName, error) {
    const count = (this.errorCounts.get(serviceName) || 0) + 1;
    this.errorCounts.set(serviceName, count);

    // Mark service as unhealthy if error threshold exceeded
    if (count > 3) {
      this.serviceHealth.set(serviceName, false);
      this.logger?.warn('[HealthCheck] Service health degraded', {
        service: serviceName,
        errorCount: count
      });
    }
  }

  /**
   * Records successful service operation
   *
   * @param {string} serviceName - Name of the service
   */
  recordServiceSuccess(serviceName) {
    // Reset error count on success
    this.errorCounts.set(serviceName, 0);

    // Mark service as healthy
    this.serviceHealth.set(serviceName, true);
  }

  /**
   * Gets application uptime in seconds
   *
   * @return {number} Uptime in seconds
   */
  getUptime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Gets memory usage statistics
   *
   * @return {Object} Memory stats
   */
  getMemoryStats() {
    const mem = process.memoryUsage();
    return {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
      externalMB: Math.round(mem.external / 1024 / 1024)
    };
  }

  /**
   * Checks if critical dependencies are healthy
   *
   * @return {Promise<boolean>} True if all critical services are accessible
   */
  async checkCriticalDependencies() {
    const checks = [];

    for (const dependency of this.dependencies) {
      checks.push(
        this.checkService(dependency)
          .then(healthy => ({ service: dependency, healthy }))
          .catch(error => {
            this.logger?.debug('[HealthCheck] Dependency check failed', {
              service: dependency,
              error: error.message
            });
            return { service: dependency, healthy: false };
          })
      );
    }

    const results = await Promise.all(checks);
    return results.every(r => r.healthy);
  }

  /**
   * Checks health of a specific service
   *
   * @param {string} serviceName - Name of service to check
   * @return {Promise<boolean>} True if service is healthy
   * @private
   */
  async checkService(serviceName) {
    // Simple ping/status check
    // In production, implement actual health checks for each service
    try {
      // Check if service is tracked and healthy
      if (this.serviceHealth.has(serviceName)) {
        return this.serviceHealth.get(serviceName);
      }

      // Default to healthy if no errors recorded
      return this.errorCounts.get(serviceName) || 0 < 3;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets detailed health information
   *
   * @return {Promise<Object>} Detailed health report
   */
  async getDetailedStatus() {
    const memory = this.getMemoryStats();
    const criticalHealthy = await this.checkCriticalDependencies();

    return {
      status: this.isReady ? 'ready' : 'starting',
      uptime: this.getUptime(),
      timestamp: new Date().toISOString(),
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      },
      memory,
      services: {
        tracked: this.serviceHealth.size,
        healthy: Array.from(this.serviceHealth.values()).filter(h => h).length,
        unhealthy: Array.from(this.serviceHealth.values()).filter(h => !h).length
      },
      critical: {
        allHealthy: criticalHealthy,
        dependenciesCount: this.dependencies.length
      },
      lastCheck: this.lastHealthCheck
    };
  }
}

/**
 * Quick health check response
 * Used by Docker HEALTHCHECK and load balancers for fast liveness checks
 *
 * Status Code: 200 if alive, 503 if critical failure
 */
function quickHealthCheck(req, res, manager) {
  const uptime = manager.getUptime();

  // Application must have been running for at least 1 second
  if (uptime < 1) {
    return res.status(503).json({
      status: 'starting',
      message: 'Application is starting up'
    });
  }

  // Check for critical issues
  if (!manager.criticalServicesHealthy) {
    return res.status(503).json({
      status: 'critical',
      message: 'Critical services are unavailable',
      uptime
    });
  }

  // Application is healthy
  res.status(200).json({
    status: 'healthy',
    uptime,
    timestamp: new Date().toISOString()
  });
}

/**
 * Kubernetes liveness probe endpoint
 * Indicates if the process should be restarted
 * Returns 200 if process is running, 503 if critical failure
 */
function livenessProbe(req, res, manager) {
  // Process is alive if we can respond
  res.status(200).json({
    status: 'alive',
    uptime: manager.getUptime(),
    timestamp: new Date().toISOString()
  });
}

/**
 * Kubernetes readiness probe endpoint
 * Indicates if the application should receive traffic
 * Returns 200 if ready, 503 if not
 */
async function readinessProbe(req, res, manager) {
  const criticalHealthy = await manager.checkCriticalDependencies();

  if (!manager.isReady || !criticalHealthy) {
    return res.status(503).json({
      status: 'not_ready',
      reason: !manager.isReady ? 'Initialization in progress' : 'Dependencies unhealthy',
      uptime: manager.getUptime()
    });
  }

  res.status(200).json({
    status: 'ready',
    uptime: manager.getUptime(),
    dependencies: manager.dependencies.length,
    timestamp: new Date().toISOString()
  });
}

/**
 * Kubernetes startup probe endpoint
 * Indicates if the application has completed startup
 * Used to prevent liveness probe failures during slow startup
 */
async function startupProbe(req, res, manager) {
  const criticalHealthy = await manager.checkCriticalDependencies();

  if (!manager.isReady) {
    return res.status(503).json({
      status: 'starting',
      uptime: manager.getUptime()
    });
  }

  res.status(200).json({
    status: 'started',
    uptime: manager.getUptime(),
    timestamp: new Date().toISOString()
  });
}

/**
 * Detailed health status endpoint (protected by authentication)
 * Provides comprehensive information for monitoring and debugging
 */
async function detailedStatus(req, res, manager) {
  try {
    const status = await manager.getDetailedStatus();
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate health report',
      message: error.message
    });
  }
}

/**
 * Creates health check middleware
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.logger - Logger instance
 * @param {Array<string>} [options.criticalDependencies] - Services that must be healthy
 * @return {Function} Express middleware setup function
 *
 * @example
 * const healthCheck = require('./src/middleware/healthCheck');
 * const setupHealthChecks = healthCheck.createHealthCheckMiddleware({
 *   logger: appLogger,
 *   criticalDependencies: ['database', 'cache']
 * });
 * setupHealthChecks(app);
 */
function createHealthCheckMiddleware(options = {}) {
  const manager = new HealthCheckManager(options);

  return function setupHealthChecks(app, servicesAuthMiddleware) {
    // GET /health - Quick liveness check (used by Docker and load balancers)
    app.get('/health', (req, res) => {
      quickHealthCheck(req, res, manager);
    });

    // GET /health/live - Kubernetes liveness probe
    app.get('/health/live', (req, res) => {
      livenessProbe(req, res, manager);
    });

    // GET /health/ready - Kubernetes readiness probe
    app.get('/health/ready', (req, res) => {
      readinessProbe(req, res, manager);
    });

    // GET /health/startup - Kubernetes startup probe
    app.get('/health/startup', (req, res) => {
      startupProbe(req, res, manager);
    });

    // GET /health/detailed - Full status (protected)
    app.get('/health/detailed', servicesAuthMiddleware || ((req, res, next) => next()), async (req, res) => {
      detailedStatus(req, res, manager);
    });

    // Return manager for marking ready and recording errors
    return manager;
  };
}

module.exports = {
  createHealthCheckMiddleware,
  HealthCheckManager
};
