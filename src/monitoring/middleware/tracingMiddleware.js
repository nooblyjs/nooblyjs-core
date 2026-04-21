/**
 * @fileoverview Distributed Tracing Middleware
 * Express middleware for automatic request tracing and trace context propagation
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Create distributed tracing middleware for Express.
 * Automatically creates and manages trace context for each request.
 *
 * @param {Object} monitoringService - Monitoring service instance
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.serviceName='api'] - Service name for this instance
 * @param {Array<string>} [options.excludePaths=[]] - Paths to exclude from tracing
 * @param {boolean} [options.propagateHeaders=true] - Propagate trace headers to downstream services
 * @return {Function} Express middleware function
 *
 * @example
 * const tracingMiddleware = require('./middleware/tracingMiddleware');
 * const middleware = tracingMiddleware(monitoringService, { serviceName: 'web-api' });
 * app.use(middleware);
 */
function createTracingMiddleware(monitoringService, options = {}) {
  const {
    serviceName = 'api',
    excludePaths = ['/health', '/status', '/public'],
    propagateHeaders = true
  } = options;

  return (req, res, next) => {
    // Skip tracing for excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    try {
      // Extract trace ID from headers or create new one
      const traceIdHeader = req.get('X-Trace-ID') || req.get('x-trace-id');
      const parentSpanIdHeader = req.get('X-Parent-Span-ID') || req.get('x-parent-span-id');
      const parentTraceIdHeader = req.get('X-Parent-Trace-ID') || req.get('x-parent-trace-id');

      let traceId;
      if (traceIdHeader) {
        // Use existing trace ID from upstream service
        traceId = traceIdHeader;
      } else {
        // Start new trace
        traceId = monitoringService.startTrace({
          service: serviceName,
          endpoint: req.path,
          metadata: {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || req.connection.remoteAddress
          }
        });
      }

      // Start a span for this request
      const spanId = monitoringService.startSpan(traceId, {
        operation: `${req.method} ${req.path}`,
        service: serviceName,
        endpoint: req.path,
        parentSpanId: parentSpanIdHeader || undefined,
        tags: {
          method: req.method,
          path: req.path,
          protocol: req.protocol,
          host: req.hostname
        }
      });

      // Store trace context in request for downstream use
      req.traceContext = {
        traceId,
        spanId,
        parentSpanId: spanId,
        serviceName
      };

      // Add trace headers to request object for propagation to downstream services
      req.traceHeaders = {
        'X-Trace-ID': traceId,
        'X-Parent-Span-ID': spanId,
        'X-Parent-Trace-ID': parentTraceIdHeader || traceId,
        'X-Service-Name': serviceName
      };

      // Add trace context to response headers if configured
      if (propagateHeaders) {
        res.setHeader('X-Trace-ID', traceId);
        res.setHeader('X-Span-ID', spanId);
      }

      // Capture response status code
      const originalSend = res.send;
      res.send = function(data) {
        // End the span when response is sent
        const endTime = Date.now();
        const latency = endTime - req._startTime;
        const success = res.statusCode < 400;

        monitoringService.endSpan(spanId, {
          status: success ? 'success' : 'error',
          error: !success ? `HTTP ${res.statusCode}` : undefined,
          latency: latency
        });

        // Record service call in dependency graph
        if (req.get('X-Calling-Service')) {
          monitoringService.recordCall(
            req.get('X-Calling-Service'),
            serviceName,
            latency,
            success,
            !success ? `HTTP ${res.statusCode}` : undefined
          );
        }

        // Call original send
        return originalSend.call(this, data);
      };

      // Capture request start time
      req._startTime = Date.now();

      next();
    } catch (error) {
      // Log error but don't block request
      monitoringService.logger?.error('[TracingMiddleware] Failed to setup tracing', {
        error: error.message,
        path: req.path
      });

      next();
    }
  };
}

/**
 * Middleware to propagate trace context to downstream service calls.
 * Use this to add trace headers to HTTP requests made by your service.
 *
 * @param {Object} [options={}] - Configuration options
 * @return {Function} Middleware that attaches traceHeaders to request object
 *
 * @example
 * const tracingMiddleware = require('./middleware/tracingMiddleware');
 * const httpClient = require('node-http-client');
 * const propagateTracing = tracingMiddleware.propagateContext();
 *
 * app.get('/api/data', async (req, res) => {
 *   const headers = req.traceHeaders || {};
 *   const response = await httpClient.get('http://downstream-service/api/endpoint', {
 *     headers: headers
 *   });
 *   res.json(response);
 * });
 */
function propagateContext(options = {}) {
  return (req, res, next) => {
    if (!req.traceHeaders) {
      req.traceHeaders = {};
    }
    next();
  };
}

/**
 * Utility to attach trace context to HTTP client requests.
 * Use this to automatically add trace headers to outgoing HTTP requests.
 *
 * @param {Object} traceContext - Trace context from req.traceContext
 * @param {Object} headers - Existing headers object
 * @return {Object} Headers with trace context added
 *
 * @example
 * const { attachTraceHeaders } = require('./middleware/tracingMiddleware');
 *
 * app.get('/api/endpoint', async (req, res) => {
 *   const downstreamHeaders = attachTraceHeaders(req.traceContext, {
 *     'Authorization': 'Bearer token'
 *   });
 *   const response = await fetch('http://service/api', { headers: downstreamHeaders });
 *   res.json(response);
 * });
 */
function attachTraceHeaders(traceContext, headers = {}) {
  if (!traceContext) {
    return headers;
  }

  return {
    ...headers,
    'X-Trace-ID': traceContext.traceId,
    'X-Parent-Span-ID': traceContext.spanId,
    'X-Parent-Trace-ID': traceContext.traceId,
    'X-Service-Name': traceContext.serviceName
  };
}

module.exports = createTracingMiddleware;
module.exports.propagateContext = propagateContext;
module.exports.attachTraceHeaders = attachTraceHeaders;
