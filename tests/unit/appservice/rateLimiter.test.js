/**
 * @fileoverview Tests for Rate Limiter Middleware
 * Comprehensive test suite for rate limiting functionality
 */

'use strict';

const RateLimiter = require('../../../src/appservice/middleware/rateLimiter');

describe('RateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      defaults: {
        windowMs: 1000, // 1 second for testing
        maxRequests: 3
      }
    });
  });

  afterEach(() => {
    if (limiter) {
      limiter.destroy();
    }
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const instance = new RateLimiter();

      expect(instance.defaults.windowMs).toBe(60000);
      expect(instance.defaults.maxRequests).toBe(100);
      expect(instance.storage).toBe('memory');
    });

    it('should accept custom options', () => {
      const instance = new RateLimiter({
        defaults: { windowMs: 5000, maxRequests: 50 }
      });

      expect(instance.defaults.windowMs).toBe(5000);
      expect(instance.defaults.maxRequests).toBe(50);
    });

    it('should exclude specified paths', () => {
      const instance = new RateLimiter({
        excludePaths: ['/health', '/status']
      });

      expect(instance.excludePaths).toContain('/health');
      expect(instance.excludePaths).toContain('/status');
    });

    it('should whitelist specified IPs', () => {
      const instance = new RateLimiter({
        whitelist: ['127.0.0.1', '192.168.1.1']
      });

      expect(instance.whitelist).toContain('127.0.0.1');
    });
  });

  describe('middleware', () => {
    it('should create middleware function', () => {
      const middleware = limiter.middleware();

      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // (req, res, next)
    });

    it('should allow request within limit', (done) => {
      const middleware = limiter.middleware();
      const req = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
        connection: { remoteAddress: '127.0.0.1' }
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn(() => {
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
        done();
      });

      middleware(req, res, next);
    });

    it('should block request exceeding limit', () => {
      const middleware = limiter.middleware();
      const req = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
        connection: { remoteAddress: '127.0.0.1' }
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      // Make 3 requests (at limit)
      middleware(req, res, next);
      middleware(req, res, next);
      middleware(req, res, next);

      // Clear the mock to check for new calls
      res.status.mockClear();

      // 4th request should be blocked
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should set rate limit headers', () => {
      const middleware = limiter.middleware();
      const req = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
        connection: { remoteAddress: '127.0.0.1' }
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 3);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    it('should exclude specified paths', () => {
      const instance = new RateLimiter({
        excludePaths: ['/health']
      });
      const middleware = instance.middleware();

      const req = {
        method: 'GET',
        path: '/health',
        headers: {},
        query: {},
        body: {},
        connection: { remoteAddress: '127.0.0.1' }
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should whitelist specified IPs', () => {
      const instance = new RateLimiter({
        whitelist: ['127.0.0.1']
      });
      const middleware = instance.middleware();

      const req = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
        connection: { remoteAddress: '127.0.0.1' }
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle custom options', () => {
      const middleware = limiter.middleware({ maxRequests: 1 });
      const req = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
        connection: { remoteAddress: '127.0.0.1' }
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      // First request should pass
      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Second request should fail (limit is 1)
      res.status.mockClear();
      middleware(req, res, () => {
        expect(res.status).toHaveBeenCalledWith(429);
      });
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('_generateKey', () => {
    it('should generate key by IP', () => {
      const req = {
        headers: {},
        query: {},
        body: {},
        connection: { remoteAddress: '192.168.1.1' }
      };
      const key = limiter._generateKey(req, 'ip');

      expect(key).toBe('rate-limit:ip:192.168.1.1');
    });

    it('should generate key by API key', () => {
      const req = {
        headers: { 'x-api-key': 'test-key' },
        query: {},
        body: {},
        connection: { remoteAddress: '127.0.0.1' }
      };
      const key = limiter._generateKey(req, 'apikey');

      expect(key).toBe('rate-limit:apikey:test-key');
    });

    it('should generate combined key (API key preferred)', () => {
      const req = {
        headers: { 'x-api-key': 'test-key' },
        query: {},
        body: {},
        connection: { remoteAddress: '192.168.1.1' }
      };
      const key = limiter._generateKey(req, 'combined');

      expect(key).toBe('rate-limit:combined:test-key');
    });

    it('should use IP for combined key if no API key', () => {
      const req = {
        headers: {},
        query: {},
        body: {},
        connection: { remoteAddress: '192.168.1.1' }
      };
      const key = limiter._generateKey(req, 'combined');

      expect(key).toBe('rate-limit:combined:192.168.1.1');
    });
  });

  describe('_getClientIp', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1' },
        connection: {}
      };
      const ip = limiter._getClientIp(req);

      expect(ip).toBe('203.0.113.1');
    });

    it('should fall back to connection.remoteAddress', () => {
      const req = {
        headers: {},
        connection: { remoteAddress: '192.168.1.1' }
      };
      const ip = limiter._getClientIp(req);

      expect(ip).toBe('192.168.1.1');
    });

    it('should handle missing IP information', () => {
      const req = {
        headers: {},
        connection: {},
        socket: {},
        connection: { socket: {} }
      };
      const ip = limiter._getClientIp(req);

      expect(ip).toBeDefined();
    });
  });

  describe('_getApiKey', () => {
    it('should extract from x-api-key header', () => {
      const req = {
        headers: { 'x-api-key': 'key123' },
        query: {}
      };
      const key = limiter._getApiKey(req);

      expect(key).toBe('key123');
    });

    it('should extract from api-key header', () => {
      const req = {
        headers: { 'api-key': 'key456' },
        query: {}
      };
      const key = limiter._getApiKey(req);

      expect(key).toBe('key456');
    });

    it('should extract from query parameter', () => {
      const req = {
        headers: {},
        query: { api_key: 'key789' }
      };
      const key = limiter._getApiKey(req);

      expect(key).toBe('key789');
    });

    it('should return null if no API key found', () => {
      const req = {
        headers: {},
        query: {}
      };
      const key = limiter._getApiKey(req);

      expect(key).toBeNull();
    });
  });

  describe('_isExcludedPath', () => {
    it('should match exact paths', () => {
      limiter.excludePaths = ['/health', '/status'];

      expect(limiter._isExcludedPath('/health')).toBe(true);
      expect(limiter._isExcludedPath('/status')).toBe(true);
      expect(limiter._isExcludedPath('/other')).toBe(false);
    });

    it('should match wildcard patterns', () => {
      limiter.excludePaths = ['/public/*'];

      expect(limiter._isExcludedPath('/public/index.html')).toBe(true);
      expect(limiter._isExcludedPath('/public/style.css')).toBe(true);
      expect(limiter._isExcludedPath('/private/data')).toBe(false);
    });
  });

  describe('registerEndpoint', () => {
    it('should register endpoint-specific limits', () => {
      limiter.registerEndpoint('/api/users', 'POST', 5, 1000);

      const endpoint = limiter.endpoints.get('POST:/api/users');
      expect(endpoint).toBeDefined();
      expect(endpoint.maxRequests).toBe(5);
    });

    it('should support wildcard methods', () => {
      limiter.registerEndpoint('/api/*', '*', 10);

      const endpoint = limiter.endpoints.get('*:/api/*');
      expect(endpoint.method).toBe('*');
    });
  });

  describe('reset', () => {
    it('should reset rate limit for a key', () => {
      const middleware = limiter.middleware({ keyGenerator: 'ip' });
      const req = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
        connection: { remoteAddress: '127.0.0.1' }
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(),
        json: jest.fn()
      };
      const next = jest.fn();

      // Make requests
      middleware(req, res, next);
      middleware(req, res, next);

      // Reset using IP-based key
      const key = 'rate-limit:ip:127.0.0.1';
      const result = limiter.reset(key);

      expect(result).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return status for a key', () => {
      const req = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
        connection: { remoteAddress: '127.0.0.1' }
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(),
        json: jest.fn()
      };
      const middleware = limiter.middleware({ keyGenerator: 'ip' });
      const next = jest.fn();

      middleware(req, res, next);

      // Get the IP-based key
      const key = `rate-limit:ip:127.0.0.1`;
      const status = limiter.getStatus(key);

      expect(status).toBeDefined();
      expect(status.requestCount).toBeGreaterThanOrEqual(0);
      expect(status.resetTime).toBeDefined();
    });

    it('should return null for unknown key', () => {
      const status = limiter.getStatus('unknown-key-xyz');

      expect(status).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const req = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
        connection: { remoteAddress: '127.0.0.1' }
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(),
        json: jest.fn()
      };
      const middleware = limiter.middleware();
      const next = jest.fn();

      middleware(req, res, next);

      const stats = limiter.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalKeys).toBeGreaterThanOrEqual(1);
      expect(stats.totalRequests).toBeGreaterThanOrEqual(1);
      expect(typeof stats.averageRequestsPerKey).toBe('number');
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', () => {
      const instance = new RateLimiter();
      const middleware = instance.middleware();
      const req = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
        connection: { remoteAddress: '127.0.0.1' }
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(),
        json: jest.fn()
      };

      middleware(req, res, jest.fn());

      expect(instance.store.size).toBeGreaterThan(0);

      instance.destroy();

      expect(instance.store.size).toBe(0);
      expect(instance.endpoints.size).toBe(0);
    });
  });

  describe('sliding window algorithm', () => {
    it('should reset requests outside window', (done) => {
      const instance = new RateLimiter({
        defaults: { windowMs: 100, maxRequests: 2 }
      });

      const middleware = instance.middleware();
      const req = {
        method: 'GET',
        path: '/test',
        headers: {},
        query: {},
        body: {},
        connection: { remoteAddress: '127.0.0.1' }
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      // Make 2 requests
      middleware(req, res, next);
      middleware(req, res, next);

      // Wait for window to expire
      setTimeout(() => {
        res.status.mockClear();
        next.mockClear();

        // Should allow new requests after window expires
        middleware(req, res, next);

        // Third request should succeed because window has expired
        expect(res.status).not.toHaveBeenCalledWith(429);
        expect(next).toHaveBeenCalled();

        instance.destroy();
        done();
      }, 150);
    }, 10000);
  });
});
