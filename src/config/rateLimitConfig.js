/**
 * @fileoverview Rate Limiting Configuration
 * Defines global and per-endpoint rate limiting policies for all services
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Rate limiting configuration for the application
 * @type {Object}
 */
const rateLimitConfig = {
  // Global default limits
  defaults: {
    windowMs: 60000, // 1 minute
    maxRequests: 1000 // 1000 requests per minute
  },

  // Whitelist IPs that bypass rate limiting
  // Useful for health checks, internal services, load balancers
  whitelist: [
    '127.0.0.1',
    '::1' // IPv6 localhost
  ],

  // Paths to exclude from rate limiting
  excludePaths: [
    '/health',
    '/health/*',
    '/status',
    '/services/*/status',
    '/public/*',
    '/docs/*',
    '/swagger/*',
    '/favicon.ico'
  ],

  // Per-endpoint rate limits
  // More restrictive limits for sensitive operations
  endpoints: [
    // Auth endpoints - strict limits to prevent brute force
    {
      pattern: '/services/authservice/api/login',
      method: 'POST',
      maxRequests: 5,
      windowMs: 900000 // 15 minutes
    },
    {
      pattern: '/services/authservice/api/register',
      method: 'POST',
      maxRequests: 10,
      windowMs: 3600000 // 1 hour
    },

    // Data operations - moderate limits
    {
      pattern: '/services/dataservice/api/:container',
      method: 'POST',
      maxRequests: 100,
      windowMs: 60000 // 1 minute
    },
    {
      pattern: '/services/dataservice/api/import',
      method: 'POST',
      maxRequests: 20,
      windowMs: 60000 // 1 minute
    },
    {
      pattern: '/services/dataservice/api/export',
      method: 'GET',
      maxRequests: 50,
      windowMs: 60000 // 1 minute
    },

    // Query endpoints - generous limits
    {
      pattern: '/services/*/api/find',
      method: 'GET',
      maxRequests: 500,
      windowMs: 60000 // 1 minute
    },

    // Admin operations - strict limits
    {
      pattern: '/services/*/api/admin/*',
      method: '*',
      maxRequests: 50,
      windowMs: 60000 // 1 minute
    },

    // Import/Export operations
    {
      pattern: '/services/*/api/import',
      method: 'POST',
      maxRequests: 30,
      windowMs: 60000 // 1 minute
    },
    {
      pattern: '/services/*/api/export',
      method: 'GET',
      maxRequests: 100,
      windowMs: 60000 // 1 minute
    },
    {
      pattern: '/services/*/api/audit/export',
      method: 'POST',
      maxRequests: 100,
      windowMs: 60000 // 1 minute
    },

    // Write operations - moderate limits
    {
      pattern: '/services/*/api/*',
      method: 'POST',
      maxRequests: 200,
      windowMs: 60000 // 1 minute
    },
    {
      pattern: '/services/*/api/*',
      method: 'PUT',
      maxRequests: 200,
      windowMs: 60000 // 1 minute
    },
    {
      pattern: '/services/*/api/*',
      method: 'DELETE',
      maxRequests: 100,
      windowMs: 60000 // 1 minute
    },

    // Read operations - generous limits
    {
      pattern: '/services/*/api/*',
      method: 'GET',
      maxRequests: 500,
      windowMs: 60000 // 1 minute
    }
  ],

  // Key generation strategy for rate limiting
  // 'ip' - Per IP address
  // 'apikey' - Per API key
  // 'combined' - Prefer API key, fall back to IP
  keyGenerator: 'combined',

  // Callback when rate limit is reached
  onLimitReached: (req, res, key, result) => {
    // Could log to monitoring system, send alerts, etc.
    console.warn(`Rate limit exceeded for ${key}. Window reset at ${new Date(result.resetTime).toISOString()}`);
  }
};

module.exports = rateLimitConfig;
