/**
 * @fileoverview Rate Limiting Middleware
 * Provides per-user, per-IP, and per-endpoint rate limiting using sliding window algorithm.
 * Supports configurable limits and graceful degradation.
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Rate Limiter middleware for Express applications.
 * Implements sliding window rate limiting with multiple strategies.
 *
 * @class
 */
class RateLimiter {
  /**
   * Creates a new RateLimiter instance.
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.storage='memory'] - Storage backend: 'memory' (only option for now)
   * @param {Object} [options.defaults={}] - Default rate limit settings
   * @param {number} [options.defaults.windowMs=60000] - Time window in milliseconds (default 1 minute)
   * @param {number} [options.defaults.maxRequests=100] - Max requests per window
   * @param {Function} [options.onLimitReached] - Callback when limit is reached
   * @param {Array<string>} [options.excludePaths=[]] - Paths to exclude from rate limiting
   * @param {Array<string>} [options.whitelist=[]] - IP addresses to whitelist
   */
  constructor(options = {}) {
    const { storage = 'memory', defaults = {}, onLimitReached = null, excludePaths = [], whitelist = [] } = options;

    this.storage = storage;
    this.defaults = {
      windowMs: defaults.windowMs || 60000, // 1 minute
      maxRequests: defaults.maxRequests || 100,
      ...defaults
    };
    this.onLimitReached = onLimitReached;
    this.excludePaths = excludePaths;
    this.whitelist = whitelist;

    // In-memory storage for tracking requests
    this.store = new Map();
    this.endpoints = new Map(); // Per-endpoint limits

    // Cleanup old entries periodically (use unref to not keep process alive)
    this.cleanupInterval = setInterval(() => this._cleanup(), this.defaults.windowMs * 2);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Register endpoint-specific rate limit.
   * @param {string} pathPattern - Express path pattern (e.g., '/services/*/api/*')
   * @param {string} method - HTTP method (GET, POST, etc.) or '*' for all
   * @param {number} maxRequests - Max requests for this endpoint
   * @param {number} [windowMs] - Time window (defaults to global window)
   * @return {void}
   */
  registerEndpoint(pathPattern, method, maxRequests, windowMs = null) {
    const key = `${method}:${pathPattern}`;
    this.endpoints.set(key, {
      pattern: pathPattern,
      method,
      maxRequests,
      windowMs: windowMs || this.defaults.windowMs
    });
  }

  /**
   * Create Express middleware function.
   * @param {Object} [options={}] - Options for this middleware
   * @param {string} [options.keyGenerator] - 'ip', 'apikey', 'combined' (default: 'combined')
   * @param {number} [options.windowMs] - Override default window
   * @param {number} [options.maxRequests] - Override default max requests
   * @return {Function} Express middleware function
   */
  middleware(options = {}) {
    const { keyGenerator = 'combined', windowMs = null, maxRequests = null } = options;

    return (req, res, next) => {
      try {
        // Check whitelist
        const clientIp = this._getClientIp(req);
        if (this.whitelist.includes(clientIp)) {
          return next();
        }

        // Check excluded paths
        if (this._isExcludedPath(req.path)) {
          return next();
        }

        // Generate rate limit key
        const key = this._generateKey(req, keyGenerator);

        // Get endpoint-specific limits or use defaults
        const limits = this._getEndpointLimits(req);
        const window = windowMs || limits.windowMs || this.defaults.windowMs;
        const max = maxRequests || limits.maxRequests || this.defaults.maxRequests;

        // Check rate limit
        const result = this._checkLimit(key, window, max);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - result.count));
        res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

        if (result.exceeded) {
          res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));

          if (this.onLimitReached && typeof this.onLimitReached === 'function') {
            this.onLimitReached(req, res, key, result);
          }

          return res.status(429).json({
            success: false,
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Maximum ${max} requests per ${Math.floor(window / 1000)} seconds allowed.`,
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
            rateLimit: {
              limit: max,
              remaining: 0,
              resetTime: new Date(result.resetTime).toISOString()
            }
          });
        }

        next();
      } catch (error) {
        // Fail gracefully - don't block requests on rate limiter errors
        res.setHeader('X-RateLimit-Error', error.message);
        next();
      }
    };
  }

  /**
   * Check rate limit for a given key.
   * @private
   * @param {string} key - Rate limit key
   * @param {number} windowMs - Time window in milliseconds
   * @param {number} maxRequests - Maximum requests allowed
   * @return {Object} Result object with count, exceeded, resetTime
   */
  _checkLimit(key, windowMs, maxRequests) {
    const now = Date.now();
    let entry = this.store.get(key);

    // Initialize entry if doesn't exist
    if (!entry) {
      entry = {
        requests: [],
        resetTime: now + windowMs
      };
      this.store.set(key, entry);
    }

    // Reset if window has passed
    if (now > entry.resetTime) {
      entry.requests = [];
      entry.resetTime = now + windowMs;
    }

    // Remove old requests outside the window
    const windowStart = now - windowMs;
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    const count = entry.requests.length;
    const exceeded = count >= maxRequests;

    // Add current request
    entry.requests.push(now);

    return {
      count: count + 1, // Include current request
      exceeded,
      resetTime: entry.resetTime
    };
  }

  /**
   * Generate rate limit key based on strategy.
   * @private
   * @param {express.Request} req - Express request object
   * @param {string} keyGenerator - 'ip', 'apikey', 'combined'
   * @return {string} Rate limit key
   */
  _generateKey(req, keyGenerator) {
    const ip = this._getClientIp(req);
    const apiKey = this._getApiKey(req);

    switch (keyGenerator) {
      case 'ip':
        return `rate-limit:ip:${ip}`;
      case 'apikey':
        return `rate-limit:apikey:${apiKey || 'anonymous'}`;
      case 'combined':
      default:
        return `rate-limit:combined:${apiKey || ip}`;
    }
  }

  /**
   * Get client IP address from request.
   * @private
   * @param {express.Request} req - Express request object
   * @return {string} Client IP address
   */
  _getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.connection.socket?.remoteAddress ||
           '127.0.0.1';
  }

  /**
   * Extract API key from request.
   * @private
   * @param {express.Request} req - Express request object
   * @return {string|null} API key or null
   */
  _getApiKey(req) {
    return req.headers?.['x-api-key'] ||
           req.headers?.['api-key'] ||
           req.query?.api_key ||
           req.body?.api_key ||
           null;
  }

  /**
   * Check if path is excluded from rate limiting.
   * @private
   * @param {string} path - Request path
   * @return {boolean} True if path is excluded
   */
  _isExcludedPath(path) {
    return this.excludePaths.some(excludePath => {
      const regex = new RegExp(`^${excludePath.replace(/\*/g, '.*')}$`);
      return regex.test(path);
    });
  }

  /**
   * Get endpoint-specific rate limit for request.
   * @private
   * @param {express.Request} req - Express request object
   * @return {Object} Endpoint limits object
   */
  _getEndpointLimits(req) {
    const method = req.method.toUpperCase();
    const path = req.path;

    // Check exact matches and patterns
    for (const [key, config] of this.endpoints) {
      if ((config.method === '*' || config.method === method) && this._matchPath(config.pattern, path)) {
        return {
          maxRequests: config.maxRequests,
          windowMs: config.windowMs
        };
      }
    }

    return {};
  }

  /**
   * Match path against pattern.
   * @private
   * @param {string} pattern - Path pattern with wildcards
   * @param {string} path - Actual path
   * @return {boolean} True if path matches pattern
   */
  _matchPath(pattern, path) {
    const regex = new RegExp(`^${pattern.replace(/\//g, '\\/')
      .replace(/\*/g, '[^/]*')
      .replace(/\\\*/g, '.*')}$`);
    return regex.test(path);
  }

  /**
   * Clean up old entries from store.
   * @private
   * @return {void}
   */
  _cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, entry] of this.store) {
      // Remove if reset time has passed and no recent requests
      if (now > entry.resetTime && entry.requests.length === 0) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.store.delete(key));
  }

  /**
   * Reset rate limit for a specific key.
   * @param {string} key - Rate limit key
   * @return {boolean} True if reset was successful
   */
  reset(key) {
    return this.store.delete(key);
  }

  /**
   * Get current rate limit status for a key.
   * @param {string} key - Rate limit key
   * @return {Object|null} Status object or null if key not found
   */
  getStatus(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    return {
      key,
      requestCount: entry.requests.length,
      resetTime: new Date(entry.resetTime).toISOString(),
      windowMs: entry.resetTime - Date.now()
    };
  }

  /**
   * Get statistics about rate limiting.
   * @return {Object} Statistics object
   */
  getStats() {
    let totalRequests = 0;
    let totalKeys = this.store.size;

    for (const entry of this.store.values()) {
      totalRequests += entry.requests.length;
    }

    return {
      totalKeys,
      totalRequests,
      averageRequestsPerKey: totalKeys > 0 ? totalRequests / totalKeys : 0,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Destroy rate limiter and cleanup resources.
   * @return {void}
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
    this.endpoints.clear();
  }
}

module.exports = RateLimiter;
