/**
 * @fileoverview Tests for Tracing Middleware
 * Tests for distributed tracing middleware and context propagation
 */

'use strict';

const createTracingMiddleware = require('../../../src/monitoring/middleware/tracingMiddleware');
const { attachTraceHeaders, propagateContext } = require('../../../src/monitoring/middleware/tracingMiddleware');

describe('Tracing Middleware', () => {
  let middleware;
  let mockMonitoringService;
  let req;
  let res;
  let next;

  beforeEach(() => {
    mockMonitoringService = {
      startTrace: jest.fn(() => 'trace-id-123'),
      startSpan: jest.fn(() => 'span-id-456'),
      endSpan: jest.fn(),
      recordCall: jest.fn(),
      logger: {
        error: jest.fn()
      }
    };

    middleware = createTracingMiddleware(mockMonitoringService, {
      serviceName: 'test-api',
      excludePaths: ['/health', '/status'],
      propagateHeaders: true
    });

    req = {
      get: jest.fn((header) => {
        const headers = {
          'X-Trace-ID': null,
          'X-Parent-Span-ID': null,
          'X-Parent-Trace-ID': null,
          'X-Calling-Service': null
        };
        return headers[header];
      }),
      path: '/api/test',
      method: 'GET',
      protocol: 'http',
      hostname: 'localhost',
      ip: '127.0.0.1',
      originalUrl: '/api/test?foo=bar',
      connection: {
        remoteAddress: '127.0.0.1'
      }
    };

    res = {
      statusCode: 200,
      setHeader: jest.fn(),
      send: jest.fn()
    };

    next = jest.fn();
  });

  describe('middleware creation', () => {
    it('should create middleware function', () => {
      expect(typeof middleware).toBe('function');
    });

    it('should accept monitoring service and options', () => {
      const m = createTracingMiddleware(mockMonitoringService, {
        serviceName: 'custom-api'
      });
      expect(typeof m).toBe('function');
    });

    it('should use default service name', () => {
      const m = createTracingMiddleware(mockMonitoringService);
      expect(typeof m).toBe('function');
    });
  });

  describe('trace creation', () => {
    it('should start trace for new request', () => {
      middleware(req, res, next);

      expect(mockMonitoringService.startTrace).toHaveBeenCalledWith({
        service: 'test-api',
        endpoint: '/api/test',
        metadata: expect.objectContaining({
          method: 'GET',
          url: '/api/test?foo=bar'
        })
      });
    });

    it('should start span with correct parameters', () => {
      middleware(req, res, next);

      expect(mockMonitoringService.startSpan).toHaveBeenCalledWith(
        'trace-id-123',
        expect.objectContaining({
          operation: 'GET /api/test',
          service: 'test-api',
          endpoint: '/api/test'
        })
      );
    });

    it('should store trace context in request', () => {
      middleware(req, res, next);

      expect(req.traceContext).toEqual({
        traceId: 'trace-id-123',
        spanId: 'span-id-456',
        parentSpanId: 'span-id-456',
        serviceName: 'test-api'
      });
    });

    it('should set trace headers on response', () => {
      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Trace-ID', 'trace-id-123');
      expect(res.setHeader).toHaveBeenCalledWith('X-Span-ID', 'span-id-456');
    });

    it('should attach trace headers to request', () => {
      middleware(req, res, next);

      expect(req.traceHeaders).toEqual({
        'X-Trace-ID': 'trace-id-123',
        'X-Parent-Span-ID': 'span-id-456',
        'X-Parent-Trace-ID': 'trace-id-123',
        'X-Service-Name': 'test-api'
      });
    });
  });

  describe('trace context extraction', () => {
    it('should reuse existing trace ID from header', () => {
      req.get = jest.fn((header) => {
        if (header === 'X-Trace-ID') return 'existing-trace-id';
        return null;
      });

      middleware(req, res, next);

      expect(req.traceContext.traceId).toBe('existing-trace-id');
    });

    it('should extract parent span ID from header', () => {
      req.get = jest.fn((header) => {
        if (header === 'X-Parent-Span-ID') return 'parent-span-id';
        return null;
      });

      middleware(req, res, next);

      expect(mockMonitoringService.startSpan).toHaveBeenCalledWith(
        'trace-id-123',
        expect.objectContaining({
          parentSpanId: 'parent-span-id'
        })
      );
    });

    it('should handle case-insensitive headers', () => {
      req.get = jest.fn((header) => {
        if (header === 'x-trace-id') return 'trace-from-lowercase';
        return null;
      });

      middleware(req, res, next);

      expect(req.traceContext.traceId).toBe('trace-from-lowercase');
    });
  });

  describe('excluded paths', () => {
    it('should skip tracing for health endpoint', () => {
      req.path = '/health';

      middleware(req, res, next);

      expect(mockMonitoringService.startTrace).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should skip tracing for status endpoint', () => {
      req.path = '/status';

      middleware(req, res, next);

      expect(mockMonitoringService.startTrace).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should skip tracing for public paths', () => {
      const m = createTracingMiddleware(mockMonitoringService, {
        excludePaths: ['/public']
      });
      req.path = '/public/image.png';

      m(req, res, next);

      expect(mockMonitoringService.startTrace).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('response handling', () => {
    it('should end span on response send', () => {
      middleware(req, res, next);

      const originalSend = res.send;
      res.send('response data');

      expect(mockMonitoringService.endSpan).toHaveBeenCalledWith(
        'span-id-456',
        expect.objectContaining({
          status: 'success'
        })
      );
    });

    it('should mark span as error for 4xx status', () => {
      res.statusCode = 400;
      middleware(req, res, next);

      res.send('error');

      expect(mockMonitoringService.endSpan).toHaveBeenCalledWith(
        'span-id-456',
        expect.objectContaining({
          status: 'error',
          error: 'HTTP 400'
        })
      );
    });

    it('should mark span as error for 5xx status', () => {
      res.statusCode = 500;
      middleware(req, res, next);

      res.send('error');

      expect(mockMonitoringService.endSpan).toHaveBeenCalledWith(
        'span-id-456',
        expect.objectContaining({
          status: 'error',
          error: 'HTTP 500'
        })
      );
    });

    it('should include latency in span end', () => {
      middleware(req, res, next);

      res.send('data');

      expect(mockMonitoringService.endSpan).toHaveBeenCalledWith(
        'span-id-456',
        expect.objectContaining({
          latency: expect.any(Number)
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle middleware errors gracefully', () => {
      mockMonitoringService.startTrace.mockImplementation(() => {
        throw new Error('Trace creation failed');
      });

      expect(() => middleware(req, res, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });

    it('should log middleware errors', () => {
      mockMonitoringService.startTrace.mockImplementation(() => {
        throw new Error('Test error');
      });

      middleware(req, res, next);

      expect(mockMonitoringService.logger.error).toHaveBeenCalledWith(
        '[TracingMiddleware] Failed to setup tracing',
        expect.objectContaining({
          error: 'Test error'
        })
      );
    });
  });

  describe('propagateContext', () => {
    it('should create middleware function', () => {
      const m = propagateContext();
      expect(typeof m).toBe('function');
    });

    it('should initialize traceHeaders if not present', () => {
      const m = propagateContext();
      const testReq = {};
      const testRes = {};

      m(testReq, testRes, next);

      expect(testReq.traceHeaders).toBeDefined();
      expect(typeof testReq.traceHeaders).toBe('object');
    });

    it('should preserve existing traceHeaders', () => {
      const m = propagateContext();
      const testReq = { traceHeaders: { 'X-Trace-ID': 'test' } };
      const testRes = {};

      m(testReq, testRes, next);

      expect(testReq.traceHeaders['X-Trace-ID']).toBe('test');
    });
  });

  describe('attachTraceHeaders', () => {
    it('should attach trace headers to request headers', () => {
      const traceContext = {
        traceId: 'trace-123',
        spanId: 'span-456',
        serviceName: 'test-api'
      };

      const headers = attachTraceHeaders(traceContext, {});

      expect(headers['X-Trace-ID']).toBe('trace-123');
      expect(headers['X-Parent-Span-ID']).toBe('span-456');
      expect(headers['X-Service-Name']).toBe('test-api');
    });

    it('should merge with existing headers', () => {
      const traceContext = {
        traceId: 'trace-123',
        spanId: 'span-456',
        serviceName: 'test-api'
      };

      const headers = attachTraceHeaders(traceContext, {
        'Authorization': 'Bearer token',
        'Content-Type': 'application/json'
      });

      expect(headers['Authorization']).toBe('Bearer token');
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Trace-ID']).toBe('trace-123');
    });

    it('should handle null trace context', () => {
      const headers = attachTraceHeaders(null, { 'Custom': 'header' });

      expect(headers['Custom']).toBe('header');
      expect(headers['X-Trace-ID']).toBeUndefined();
    });

    it('should handle undefined trace context', () => {
      const headers = attachTraceHeaders(undefined, { 'Custom': 'header' });

      expect(headers['Custom']).toBe('header');
    });
  });

  describe('end-to-end flow', () => {
    it('should create and track complete request trace', () => {
      middleware(req, res, next);

      expect(req.traceContext).toBeDefined();
      expect(req.traceHeaders).toBeDefined();
      expect(mockMonitoringService.startTrace).toHaveBeenCalled();
      expect(mockMonitoringService.startSpan).toHaveBeenCalled();

      // Simulate response
      res.send('data');

      expect(mockMonitoringService.endSpan).toHaveBeenCalled();
    });

    it('should propagate trace through multiple services', () => {
      middleware(req, res, next);

      const downstreamHeaders = attachTraceHeaders(req.traceContext, {});

      expect(downstreamHeaders['X-Trace-ID']).toBe(req.traceContext.traceId);
      expect(downstreamHeaders['X-Parent-Span-ID']).toBe(req.traceContext.spanId);
    });
  });
});
