/**
 * @fileoverview Health Check Utility Module
 * Provides comprehensive health checking for services including dependency verification
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Health Check utility class for monitoring service health status
 *
 * @class
 */
class HealthCheck {
  /**
   * Create a new HealthCheck instance.
   * @param {string} serviceName - Name of the service
   * @param {Object} [options={}] - Configuration options
   * @param {Array<string>} [options.dependencies] - Service dependencies to check
   * @param {Object} [options.checks] - Custom check functions
   */
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.dependencies = options.dependencies || [];
    this.customChecks = options.checks || {};
    this.startTime = Date.now();
    this.lastCheck = null;
  }

  /**
   * Perform full health check.
   * @param {Object} [context={}] - Context object with service references
   * @return {Promise<Object>} Health check result
   */
  async check(context = {}) {
    const result = {
      service: this.serviceName,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: {}
    };

    // Check basic service functionality
    try {
      result.checks.basic = { status: 'ok' };
    } catch (error) {
      result.checks.basic = { status: 'error', error: error.message };
      result.status = 'unhealthy';
    }

    // Check dependencies (only if context provided)
    if (this.dependencies.length > 0 && Object.keys(context).length > 0) {
      result.checks.dependencies = await this._checkDependencies(context);
      if (result.checks.dependencies.status === 'error') {
        result.status = 'degraded';
      }
    }

    // Run custom checks
    for (const [checkName, checkFn] of Object.entries(this.customChecks)) {
      try {
        const checkResult = await checkFn();
        result.checks[checkName] = {
          status: checkResult.status || 'ok',
          data: checkResult.data
        };

        if (checkResult.status === 'error') {
          result.status = result.status === 'healthy' ? 'degraded' : result.status;
        }
      } catch (error) {
        result.checks[checkName] = {
          status: 'error',
          error: error.message
        };
        result.status = 'unhealthy';
      }
    }

    this.lastCheck = result;
    return result;
  }

  /**
   * Check service dependencies.
   * @private
   * @param {Object} context - Context with service references
   * @return {Promise<Object>} Dependency check result
   */
  async _checkDependencies(context) {
    const result = {
      status: 'ok',
      dependencies: {}
    };

    for (const dep of this.dependencies) {
      try {
        if (context[dep]) {
          // Service exists, mark as available
          result.dependencies[dep] = { status: 'available' };
        } else {
          result.dependencies[dep] = { status: 'unavailable' };
          result.status = 'error';
        }
      } catch (error) {
        result.dependencies[dep] = { status: 'error', error: error.message };
        result.status = 'error';
      }
    }

    return result;
  }

  /**
   * Get health status summary.
   * @return {Object} Health status summary
   */
  getSummary() {
    if (!this.lastCheck) {
      return {
        service: this.serviceName,
        status: 'unknown',
        message: 'No health check performed yet'
      };
    }

    const statusCodes = {
      healthy: 200,
      degraded: 503,
      unhealthy: 503
    };

    return {
      service: this.serviceName,
      status: this.lastCheck.status,
      statusCode: statusCodes[this.lastCheck.status] || 503,
      uptime: this.lastCheck.uptime,
      timestamp: this.lastCheck.timestamp,
      checksPerformed: Object.keys(this.lastCheck.checks).length
    };
  }

  /**
   * Check if service is healthy.
   * @return {boolean} True if service is healthy
   */
  isHealthy() {
    return this.lastCheck?.status === 'healthy';
  }

  /**
   * Check if service is ready (healthy or degraded).
   * @return {boolean} True if service is ready
   */
  isReady() {
    return this.lastCheck?.status === 'healthy' || this.lastCheck?.status === 'degraded';
  }
}

/**
 * Create Express middleware for health check endpoints.
 * @param {Object} options - Middleware options
 * @param {Object} [options.healthChecks] - Map of service name to HealthCheck instance
 * @param {Function} [options.logger] - Logger function
 * @return {Function} Express middleware factory
 */
function createHealthCheckMiddleware(options = {}) {
  const { healthChecks = {}, logger = null } = options;

  return function setupHealthEndpoints(app, authMiddleware) {
    /**
     * GET /health
     * Quick liveness check for load balancers
     */
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
      });
    });

    /**
     * GET /health/live
     * Kubernetes liveness probe
     */
    app.get('/health/live', (req, res) => {
      res.status(200).json({
        status: 'live',
        timestamp: new Date().toISOString()
      });
    });

    /**
     * GET /health/ready
     * Kubernetes readiness probe
     */
    app.get('/health/ready', async (req, res) => {
      try {
        let allReady = true;
        const checks = {};

        for (const [serviceName, healthCheck] of Object.entries(healthChecks)) {
          if (healthCheck && typeof healthCheck.isReady === 'function') {
            checks[serviceName] = healthCheck.isReady();
            if (!checks[serviceName]) {
              allReady = false;
            }
          }
        }

        if (allReady) {
          res.status(200).json({
            status: 'ready',
            checks,
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(503).json({
            status: 'not-ready',
            checks,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        logger?.error('Health ready check failed', { error: error.message });
        res.status(503).json({
          status: 'error',
          error: error.message
        });
      }
    });

    /**
     * GET /health/detailed
     * Full health report (protected if auth middleware provided)
     */
    app.get('/health/detailed', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const detailedStatus = {};

        for (const [serviceName, healthCheck] of Object.entries(healthChecks)) {
          if (healthCheck && typeof healthCheck.getSummary === 'function') {
            detailedStatus[serviceName] = healthCheck.getSummary();
          }
        }

        const overallStatus = Object.values(detailedStatus).every(s => s.status === 'healthy') ? 'healthy' : 'degraded';

        res.status(200).json({
          overallStatus,
          services: detailedStatus,
          timestamp: new Date().toISOString(),
          timestamp_iso: new Date().toISOString()
        });
      } catch (error) {
        logger?.error('Health detailed check failed', { error: error.message });
        res.status(500).json({
          overallStatus: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    /**
     * GET /services/:service/api/health
     * Service-specific health check endpoint
     */
    app.get('/services/:service/api/health', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const serviceName = req.params.service;
        const healthCheck = healthChecks[serviceName];

        if (!healthCheck) {
          return res.status(404).json({
            error: 'Service not found',
            service: serviceName
          });
        }

        // Get current health check result
        const checkResult = await healthCheck.check();
        const statusCode = checkResult.status === 'healthy' ? 200 : checkResult.status === 'degraded' ? 503 : 503;

        res.status(statusCode).json(checkResult);
      } catch (error) {
        logger?.error(`Health check failed for ${req.params.service}`, { error: error.message });
        res.status(500).json({
          error: error.message,
          service: req.params.service,
          timestamp: new Date().toISOString()
        });
      }
    });

    return {
      healthChecks,
      getStatus: (serviceName) => {
        const check = healthChecks[serviceName];
        return check ? check.getSummary() : null;
      },
      getAllStatus: () => {
        const status = {};
        for (const [name, check] of Object.entries(healthChecks)) {
          status[name] = check.getSummary();
        }
        return status;
      }
    };
  };
}

module.exports = {
  HealthCheck,
  createHealthCheckMiddleware
};
