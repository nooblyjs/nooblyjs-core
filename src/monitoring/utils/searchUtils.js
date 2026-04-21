/**
 * @fileoverview Search Utilities for Monitoring
 * Full-text search and faceted filtering for traces and metrics
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Monitoring search utility for traces and metrics.
 * Supports full-text search with faceted filtering and ranking.
 *
 * @class
 */
class MonitoringSearchEngine {
  /**
   * Create a new search engine.
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.maxResults=100] - Maximum results per search
   */
  constructor(options = {}) {
    this.maxResults = options.maxResults || 100;
    this.savedSearches = new Map();
  }

  /**
   * Search traces with full-text and faceted filtering.
   * @param {Array<Object>} traces - Array of traces to search
   * @param {Object} criteria - Search criteria
   * @param {string} [criteria.query] - Full-text search query
   * @param {Object} [criteria.filters={}] - Faceted filters
   * @param {string} [criteria.filters.service] - Filter by service
   * @param {string} [criteria.filters.status] - Filter by status
   * @param {number} [criteria.filters.minDuration] - Minimum duration (ms)
   * @param {number} [criteria.filters.maxDuration] - Maximum duration (ms)
   * @param {number} [criteria.filters.minErrors] - Minimum error count
   * @param {number} [criteria.filters.maxErrors] - Maximum error count
   * @param {string} [criteria.sortBy='timestamp'] - Sort field (timestamp, duration, errors)
   * @param {string} [criteria.sortOrder='desc'] - Sort order (asc|desc)
   * @param {number} [criteria.limit=10] - Result limit
   * @return {Array<Object>} Matching traces with relevance scores
   */
  searchTraces(traces, criteria = {}) {
    const {
      query = '',
      filters = {},
      sortBy = 'timestamp',
      sortOrder = 'desc',
      limit = 10
    } = criteria;

    let results = traces.slice();

    // Apply full-text search
    if (query && query.trim()) {
      const queryLower = query.toLowerCase();
      results = results.filter(trace => {
        const searchableFields = [
          trace.traceId,
          trace.initiatingService,
          trace.initiatingEndpoint,
          ...(trace.services || []),
          ...(trace.metadata?.error ? [trace.metadata.error] : [])
        ].map(f => String(f || '').toLowerCase());

        const relevance = this._calculateRelevance(queryLower, searchableFields);
        return relevance > 0;
      });

      // Sort by relevance for text search
      results = results.map(trace => {
        const searchableFields = [
          trace.traceId,
          trace.initiatingService,
          trace.initiatingEndpoint,
          ...(trace.services || []),
          ...(trace.metadata?.error ? [trace.metadata.error] : [])
        ].map(f => String(f || '').toLowerCase());

        return {
          ...trace,
          _relevance: this._calculateRelevance(queryLower, searchableFields)
        };
      });

      results.sort((a, b) => b._relevance - a._relevance);
    }

    // Apply faceted filters
    results = this._applyFilters(results, filters);

    // Sort results
    results = this._sortResults(results, sortBy, sortOrder);

    // Apply limit
    results = results.slice(0, limit || this.maxResults);

    // Remove internal scoring fields
    return results.map(t => {
      const { _relevance, ...cleaned } = t;
      return cleaned;
    });
  }

  /**
   * Search metrics with full-text and faceted filtering.
   * @param {Array<Object>} metrics - Array of metric snapshots
   * @param {Object} criteria - Search criteria
   * @param {string} [criteria.query] - Full-text search query
   * @param {Object} [criteria.filters={}] - Faceted filters
   * @param {string} [criteria.filters.service] - Filter by service
   * @param {number} [criteria.filters.minCalls] - Minimum calls
   * @param {number} [criteria.filters.minErrors] - Minimum errors
   * @param {number} [criteria.filters.minLatency] - Minimum latency (ms)
   * @param {string} [criteria.sortBy='timestamp'] - Sort field
   * @param {string} [criteria.sortOrder='desc'] - Sort order
   * @param {number} [criteria.limit=10] - Result limit
   * @return {Array<Object>} Matching metrics
   */
  searchMetrics(metrics, criteria = {}) {
    const {
      query = '',
      filters = {},
      sortBy = 'timestamp',
      sortOrder = 'desc',
      limit = 10
    } = criteria;

    let results = metrics.slice();

    // Apply full-text search
    if (query && query.trim()) {
      const queryLower = query.toLowerCase();
      results = results.filter(metric => {
        const searchableFields = [
          metric.serviceName || '',
          metric.endpoint || '',
          metric.operation || ''
        ].map(f => String(f || '').toLowerCase());

        const relevance = this._calculateRelevance(queryLower, searchableFields);
        return relevance > 0;
      });

      // Add relevance scoring
      results = results.map(metric => ({
        ...metric,
        _relevance: this._calculateRelevance(
          queryLower,
          [
            metric.serviceName || '',
            metric.endpoint || '',
            metric.operation || ''
          ].map(f => String(f || '').toLowerCase())
        )
      }));

      results.sort((a, b) => b._relevance - a._relevance);
    }

    // Apply filters
    results = this._applyMetricsFilters(results, filters);

    // Sort results
    results = this._sortResults(results, sortBy, sortOrder);

    // Apply limit
    results = results.slice(0, limit || this.maxResults);

    // Remove internal fields
    return results.map(m => {
      const { _relevance, ...cleaned } = m;
      return cleaned;
    });
  }

  /**
   * Get available facet values for filtering.
   * @param {Array<Object>} traces - Traces to analyze
   * @return {Object} Facet options
   */
  getFacets(traces) {
    const facets = {
      services: new Set(),
      statuses: new Set(),
      endpoints: new Set(),
      durationRanges: {
        '0-100ms': 0,
        '100-500ms': 0,
        '500-1000ms': 0,
        '1000ms+': 0
      }
    };

    traces.forEach(trace => {
      if (trace.services) {
        (Array.isArray(trace.services) ? trace.services : [trace.services]).forEach(s => {
          facets.services.add(s);
        });
      }
      if (trace.status) facets.statuses.add(trace.status);
      if (trace.initiatingEndpoint) facets.endpoints.add(trace.initiatingEndpoint);

      if (trace.duration) {
        if (trace.duration < 100) facets.durationRanges['0-100ms']++;
        else if (trace.duration < 500) facets.durationRanges['100-500ms']++;
        else if (trace.duration < 1000) facets.durationRanges['500-1000ms']++;
        else facets.durationRanges['1000ms+']++;
      }
    });

    return {
      services: Array.from(facets.services),
      statuses: Array.from(facets.statuses),
      endpoints: Array.from(facets.endpoints),
      durationRanges: facets.durationRanges
    };
  }

  /**
   * Save a search query for later use.
   * @param {string} name - Search name
   * @param {Object} criteria - Search criteria
   */
  saveSearch(name, criteria) {
    this.savedSearches.set(name, {
      ...criteria,
      savedAt: new Date().toISOString()
    });
  }

  /**
   * Retrieve a saved search.
   * @param {string} name - Search name
   * @return {Object|null} Saved search criteria or null
   */
  getSearch(name) {
    return this.savedSearches.get(name) || null;
  }

  /**
   * List all saved searches.
   * @return {Array<Object>} List of saved searches with metadata
   */
  listSearches() {
    return Array.from(this.savedSearches.entries()).map(([name, criteria]) => ({
      name,
      ...criteria
    }));
  }

  /**
   * Delete a saved search.
   * @param {string} name - Search name
   * @return {boolean} True if deleted, false if not found
   */
  deleteSearch(name) {
    return this.savedSearches.delete(name);
  }

  /**
   * Calculate text relevance score for a query.
   * @private
   * @param {string} query - Search query
   * @param {Array<string>} fields - Fields to search
   * @return {number} Relevance score (0-100)
   */
  _calculateRelevance(query, fields) {
    let score = 0;

    fields.forEach(field => {
      if (!field) return;

      // Exact match: highest score
      if (field === query) {
        score += 100;
      }
      // Prefix match: high score
      else if (field.startsWith(query)) {
        score += 50;
      }
      // Contains match: medium score
      else if (field.includes(query)) {
        score += 25;
      }

      // Word boundary match: bonus
      const wordRegex = new RegExp(`\\b${query}`, 'i');
      if (wordRegex.test(field)) {
        score += 15;
      }
    });

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Apply faceted filters to traces.
   * @private
   * @param {Array<Object>} traces - Traces to filter
   * @param {Object} filters - Filter criteria
   * @return {Array<Object>} Filtered traces
   */
  _applyFilters(traces, filters) {
    if (!filters || typeof filters !== 'object') {
      return traces;
    }

    return traces.filter(trace => {
      // Service filter
      if (filters.service) {
        const services = Array.isArray(trace.services) ? trace.services : [trace.services];
        if (!services.includes(filters.service)) return false;
      }

      // Status filter
      if (filters.status && trace.status !== filters.status) {
        return false;
      }

      // Duration filters
      if (filters.minDuration !== undefined && trace.duration < filters.minDuration) {
        return false;
      }
      if (filters.maxDuration !== undefined && trace.duration > filters.maxDuration) {
        return false;
      }

      // Error filters
      if (filters.minErrors !== undefined && trace.errorSpans < filters.minErrors) {
        return false;
      }
      if (filters.maxErrors !== undefined && trace.errorSpans > filters.maxErrors) {
        return false;
      }

      return true;
    });
  }

  /**
   * Apply filters to metrics.
   * @private
   * @param {Array<Object>} metrics - Metrics to filter
   * @param {Object} filters - Filter criteria
   * @return {Array<Object>} Filtered metrics
   */
  _applyMetricsFilters(metrics, filters) {
    if (!filters || typeof filters !== 'object') {
      return metrics;
    }

    return metrics.filter(metric => {
      if (filters.service && metric.serviceName !== filters.service) return false;
      if (filters.minCalls !== undefined && metric.totalCalls < filters.minCalls) return false;
      if (filters.minErrors !== undefined && metric.totalErrors < filters.minErrors) return false;
      if (filters.minLatency !== undefined && metric.avgLatency < filters.minLatency) return false;

      return true;
    });
  }

  /**
   * Sort results by specified field.
   * @private
   * @param {Array<Object>} results - Results to sort
   * @param {string} sortBy - Field to sort by
   * @param {string} sortOrder - Sort order (asc|desc)
   * @return {Array<Object>} Sorted results
   */
  _sortResults(results, sortBy, sortOrder) {
    const sorted = results.slice();
    const ascending = sortOrder === 'asc';

    sorted.sort((a, b) => {
      let aVal = a[sortBy] || 0;
      let bVal = b[sortBy] || 0;

      if (typeof aVal === 'string') {
        return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return ascending ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }

  /**
   * Export search index for external analysis.
   * @return {Object} Current search index state
   */
  export() {
    return {
      savedSearches: Array.from(this.savedSearches.entries()),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset search engine state.
   */
  reset() {
    this.savedSearches.clear();
  }
}

module.exports = MonitoringSearchEngine;
