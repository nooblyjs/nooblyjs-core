/**
 * @fileoverview Request Tracer for Distributed Tracing
 * Tracks requests across service boundaries with unique trace IDs
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const { randomUUID } = require('crypto');

/**
 * Request Tracer for distributed tracing across services.
 * @class
 */
class RequestTracer {
  /**
   * Create a new request tracer.
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.maxTraces=10000] - Maximum traces to maintain
   * @param {number} [options.maxSpans=100000] - Maximum spans to maintain
   * @param {number} [options.traceTTL=3600000] - Trace retention in ms (1 hour)
   */
  constructor(options = {}) {
    this.maxTraces = options.maxTraces || 10000;
    this.maxSpans = options.maxSpans || 100000;
    this.traceTTL = options.traceTTL || 3600000; // 1 hour
    this.traces = new Map(); // traceId -> trace object
    this.spans = new Map(); // spanId -> span object
    this.contextStack = []; // Thread-local context stack
    this.currentContext = null; // Current trace context
  }

  /**
   * Start a new trace for a request.
   * @param {Object} [options={}] - Options for trace creation
   * @param {string} [options.traceId] - Use specific trace ID (default: generate UUID)
   * @param {string} [options.service] - Service that initiated the trace
   * @param {string} [options.endpoint] - API endpoint being called
   * @param {Object} [options.metadata={}] - Custom metadata
   * @return {string} Generated or provided trace ID
   */
  startTrace(options = {}) {
    const traceId = options.traceId || randomUUID();
    const timestamp = Date.now();

    const trace = {
      traceId,
      parentTraceId: options.parentTraceId || null,
      initiatingService: options.service || 'unknown',
      initiatingEndpoint: options.endpoint || 'unknown',
      startTime: timestamp,
      endTime: null,
      duration: null,
      status: 'active',
      spans: [],
      spanCount: 0,
      errorSpans: 0,
      metadata: options.metadata || {},
      services: new Set([options.service || 'unknown']),
      callChain: []
    };

    this.traces.set(traceId, trace);

    // Maintain size limit
    if (this.traces.size > this.maxTraces) {
      const oldestKey = this.traces.keys().next().value;
      this.traces.delete(oldestKey);
    }

    // Save context
    this.currentContext = {
      traceId,
      parentSpanId: null,
      baggage: {}
    };

    return traceId;
  }

  /**
   * Start a new span within a trace.
   * @param {string} traceId - Trace ID
   * @param {Object} [options={}] - Span options
   * @param {string} [options.spanId] - Use specific span ID (default: generate UUID)
   * @param {string} [options.parentSpanId] - Parent span ID
   * @param {string} [options.operation] - Operation name (method call, etc.)
   * @param {string} [options.service] - Service name
   * @param {string} [options.endpoint] - Endpoint being called
   * @param {Object} [options.tags={}] - Custom tags
   * @return {string} Generated or provided span ID
   */
  startSpan(traceId, options = {}) {
    if (!traceId) {
      throw new Error('traceId is required');
    }

    const spanId = options.spanId || randomUUID();
    const timestamp = Date.now();
    const trace = this.traces.get(traceId);

    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    const span = {
      spanId,
      traceId,
      parentSpanId: options.parentSpanId || this.currentContext?.parentSpanId || null,
      operation: options.operation || 'unknown',
      service: options.service || 'unknown',
      endpoint: options.endpoint || 'unknown',
      startTime: timestamp,
      endTime: null,
      duration: null,
      status: 'active',
      tags: options.tags || {},
      logs: [],
      errorCount: 0
    };

    this.spans.set(spanId, span);
    trace.spans.push(spanId);
    trace.spanCount++;
    trace.services.add(options.service || 'unknown');

    // Add to call chain if this is a service-to-service call
    if (options.service && options.endpoint) {
      trace.callChain.push({
        from: this.currentContext?.service || trace.initiatingService,
        to: options.service,
        endpoint: options.endpoint,
        spanId,
        timestamp
      });
    }

    // Maintain size limit
    if (this.spans.size > this.maxSpans) {
      const oldestSpanId = this.spans.keys().next().value;
      this.spans.delete(oldestSpanId);
    }

    // Update context
    const previousContext = this.currentContext;
    this.currentContext = {
      traceId,
      parentSpanId: spanId,
      service: options.service,
      baggage: previousContext?.baggage || {}
    };

    return spanId;
  }

  /**
   * End a span with status and optional error.
   * @param {string} spanId - Span ID to end
   * @param {Object} [options={}] - End options
   * @param {string} [options.status='success'] - Span status (success, error, timeout, etc.)
   * @param {Error|string} [options.error] - Error if span failed
   * @param {number} [options.latency] - Call latency in ms
   * @return {Object} Ended span object
   */
  endSpan(spanId, options = {}) {
    const span = this.spans.get(spanId);

    if (!span) {
      throw new Error(`Span ${spanId} not found`);
    }

    const timestamp = Date.now();
    span.endTime = timestamp;
    span.duration = timestamp - span.startTime;
    span.status = options.status || 'success';

    if (options.latency) {
      span.tags.latency = options.latency;
    }

    if (options.error) {
      span.errorCount++;
      span.tags.error = options.error instanceof Error ? options.error.message : String(options.error);
      span.tags.errorType = options.error instanceof Error ? options.error.constructor.name : 'Error';
    }

    // Update trace
    const trace = this.traces.get(span.traceId);
    if (trace) {
      if (options.error) {
        trace.errorSpans++;
      }
    }

    return span;
  }

  /**
   * Add a log entry to a span.
   * @param {string} spanId - Span ID
   * @param {Object} logEntry - Log entry with optional level, message, fields
   */
  addLog(spanId, logEntry) {
    const span = this.spans.get(spanId);

    if (!span) {
      throw new Error(`Span ${spanId} not found`);
    }

    span.logs.push({
      timestamp: Date.now(),
      level: logEntry.level || 'info',
      message: logEntry.message || '',
      fields: logEntry.fields || {}
    });
  }

  /**
   * End a trace with overall status.
   * @param {string} traceId - Trace ID
   * @param {Object} [options={}] - End options
   * @param {string} [options.status='success'] - Overall status
   * @param {Error} [options.error] - Error if trace failed
   * @return {Object} Completed trace object
   */
  endTrace(traceId, options = {}) {
    const trace = this.traces.get(traceId);

    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    const timestamp = Date.now();
    trace.endTime = timestamp;
    trace.duration = timestamp - trace.startTime;
    trace.status = options.status || 'success';

    if (options.error) {
      trace.status = 'error';
      trace.metadata.error = options.error instanceof Error ? options.error.message : String(options.error);
    }

    // Calculate statistics
    trace.services = Array.from(trace.services);
    const spans = trace.spans.map(sid => this.spans.get(sid)).filter(Boolean);
    const totalLatency = spans.reduce((sum, s) => sum + (s.duration || 0), 0);
    trace.metadata.totalLatency = totalLatency;
    trace.metadata.avgSpanLatency = spans.length > 0 ? Math.round(totalLatency / spans.length) : 0;

    return trace;
  }

  /**
   * Get complete trace with all spans.
   * @param {string} traceId - Trace ID
   * @return {Object} Complete trace with expanded spans
   */
  getTrace(traceId) {
    const trace = this.traces.get(traceId);

    if (!trace) {
      return null;
    }

    return {
      ...trace,
      spans: trace.spans.map(spanId => this.spans.get(spanId)).filter(Boolean)
    };
  }

  /**
   * Get trace summary without full span details.
   * @param {string} traceId - Trace ID
   * @return {Object} Trace summary
   */
  getTraceSummary(traceId) {
    const trace = this.traces.get(traceId);

    if (!trace) {
      return null;
    }

    return {
      traceId: trace.traceId,
      status: trace.status,
      duration: trace.duration,
      startTime: trace.startTime,
      endTime: trace.endTime,
      initiatingService: trace.initiatingService,
      initiatingEndpoint: trace.initiatingEndpoint,
      services: trace.services,
      spanCount: trace.spanCount,
      errorSpans: trace.errorSpans,
      errorRate: trace.spanCount > 0 ? Math.round((trace.errorSpans / trace.spanCount) * 100) : 0,
      callChain: trace.callChain,
      metadata: trace.metadata
    };
  }

  /**
   * Get all traces matching criteria.
   * @param {Object} [filter={}] - Filter criteria
   * @param {string} [filter.service] - Filter by service
   * @param {string} [filter.status] - Filter by status
   * @param {number} [filter.minDuration] - Minimum duration (ms)
   * @param {number} [filter.maxDuration] - Maximum duration (ms)
   * @param {number} [filter.limit=100] - Max results
   * @return {Array<Object>} Matching trace summaries
   */
  findTraces(filter = {}) {
    const results = [];
    const limit = filter.limit || 100;

    for (const [traceId, trace] of this.traces) {
      if (results.length >= limit) break;

      // Apply filters
      if (filter.service && !trace.services.includes(filter.service)) continue;
      if (filter.status && trace.status !== filter.status) continue;
      if (filter.minDuration && trace.duration < filter.minDuration) continue;
      if (filter.maxDuration && trace.duration > filter.maxDuration) continue;

      results.push(this.getTraceSummary(traceId));
    }

    return results;
  }

  /**
   * Get call chain visualization for a trace.
   * @param {string} traceId - Trace ID
   * @return {Object} Call chain visualization data
   */
  getCallChainVisualization(traceId) {
    const trace = this.traces.get(traceId);

    if (!trace) {
      return null;
    }

    const nodes = new Map();
    const edges = [];

    // Add all services as nodes
    for (const service of trace.services) {
      nodes.set(service, {
        id: service,
        label: service,
        calls: 0,
        errors: 0
      });
    }

    // Build edges from call chain
    for (const call of trace.callChain) {
      const from = call.from || trace.initiatingService;
      const to = call.to;

      const fromNode = nodes.get(from);
      const toNode = nodes.get(to);

      if (fromNode && toNode) {
        fromNode.calls++;

        // Check if span had error
        const span = this.spans.get(call.spanId);
        if (span && span.errorCount > 0) {
          fromNode.errors++;
        }
      }

      edges.push({
        from,
        to,
        endpoint: call.endpoint,
        spanId: call.spanId,
        timestamp: call.timestamp
      });
    }

    return {
      traceId,
      nodes: Array.from(nodes.values()),
      edges,
      callChainLength: trace.callChain.length
    };
  }

  /**
   * Get slowest spans in a trace.
   * @param {string} traceId - Trace ID
   * @param {number} [limit=10] - Number of results
   * @return {Array<Object>} Slowest spans
   */
  getSlowestSpans(traceId, limit = 10) {
    const trace = this.traces.get(traceId);

    if (!trace) {
      return [];
    }

    return trace.spans
      .map(spanId => this.spans.get(spanId))
      .filter(Boolean)
      .filter(s => s.duration > 0)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get error spans in a trace.
   * @param {string} traceId - Trace ID
   * @return {Array<Object>} Spans with errors
   */
  getErrorSpans(traceId) {
    const trace = this.traces.get(traceId);

    if (!trace) {
      return [];
    }

    return trace.spans
      .map(spanId => this.spans.get(spanId))
      .filter(Boolean)
      .filter(s => s.errorCount > 0);
  }

  /**
   * Export trace as JSON for external analysis.
   * @param {string} traceId - Trace ID
   * @return {Object} Complete trace data
   */
  exportTrace(traceId) {
    return this.getTrace(traceId);
  }

  /**
   * Clean up expired traces.
   * @param {number} [age=this.traceTTL] - Age threshold in ms
   * @return {number} Number of traces cleaned up
   */
  cleanup(age = this.traceTTL) {
    const now = Date.now();
    const cutoff = now - age;
    let cleaned = 0;

    for (const [traceId, trace] of this.traces) {
      if (trace.endTime && trace.endTime < cutoff) {
        // Remove associated spans
        for (const spanId of trace.spans) {
          this.spans.delete(spanId);
        }
        this.traces.delete(traceId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get tracer statistics.
   * @return {Object} Current statistics
   */
  getStatistics() {
    return {
      activeTraces: Array.from(this.traces.values()).filter(t => t.status === 'active').length,
      totalTraces: this.traces.size,
      totalSpans: this.spans.size,
      completedTraces: Array.from(this.traces.values()).filter(t => t.endTime !== null).length,
      maxTraces: this.maxTraces,
      maxSpans: this.maxSpans
    };
  }

  /**
   * Export all traces and spans.
   * @return {Object} Complete export with all traces, spans, and statistics
   */
  export() {
    const tracesArray = Array.from(this.traces.values()).map(trace => ({
      ...trace,
      spans: trace.spans.map(spanId => this.spans.get(spanId)).filter(Boolean),
      services: Array.from(trace.services)
    }));

    return {
      traces: tracesArray,
      statistics: this.getStatistics(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear all traces and spans.
   */
  reset() {
    this.traces.clear();
    this.spans.clear();
    this.currentContext = null;
  }
}

module.exports = RequestTracer;
