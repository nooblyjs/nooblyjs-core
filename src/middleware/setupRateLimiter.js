/**
 * @fileoverview Rate Limiter Setup Utility
 * Configures and initializes rate limiting middleware for Express application
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const RateLimiter = require('../appservice/middleware/rateLimiter');

/**
 * Setup rate limiting middleware for Express application
 * @param {Object} app - Express application instance
 * @param {Object} config - Rate limiting configuration
 * @param {Object} [logger] - Optional logger instance
 * @return {RateLimiter} Configured rate limiter instance
 */
function setupRateLimiter(app, config, logger = null) {
  if (!config) {
    logger?.warn('Rate limiter config not provided, using defaults');
    return null;
  }

  try {
    // Create rate limiter instance
    const rateLimiter = new RateLimiter({
      storage: 'memory',
      defaults: config.defaults || { windowMs: 60000, maxRequests: 1000 },
      excludePaths: config.excludePaths || [],
      whitelist: config.whitelist || [],
      onLimitReached: config.onLimitReached
    });

    // Register endpoint-specific limits
    if (config.endpoints && Array.isArray(config.endpoints)) {
      for (const endpoint of config.endpoints) {
        rateLimiter.registerEndpoint(
          endpoint.pattern,
          endpoint.method || '*',
          endpoint.maxRequests,
          endpoint.windowMs
        );
      }

      logger?.info(`Registered ${config.endpoints.length} rate limit rules`, {
        rules: config.endpoints.length
      });
    }

    // Add rate limiter middleware to Express app
    const keyGenerator = config.keyGenerator || 'combined';
    app.use(rateLimiter.middleware({ keyGenerator }));

    logger?.info('Rate limiter middleware initialized', {
      defaultWindow: config.defaults?.windowMs || 60000,
      defaultLimit: config.defaults?.maxRequests || 1000,
      endpoints: config.endpoints?.length || 0,
      whitelist: config.whitelist?.length || 0,
      excluded: config.excludePaths?.length || 0
    });

    return rateLimiter;
  } catch (error) {
    logger?.error('Failed to initialize rate limiter', {
      error: error.message,
      stack: error.stack
    });

    // Return null on error - don't block app startup
    return null;
  }
}

/**
 * Get rate limiter status information
 * @param {RateLimiter} rateLimiter - Rate limiter instance
 * @return {Object} Status object with current limits
 */
function getRateLimiterStatus(rateLimiter) {
  if (!rateLimiter) {
    return null;
  }

  return rateLimiter.getStats();
}

module.exports = {
  setupRateLimiter,
  getRateLimiterStatus
};
