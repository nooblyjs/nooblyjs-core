/**
 * @fileoverview Searching Analytics Module
 * Tracks search operations (add, read, delete, search) for analytics and monitoring.
 * Provides an unobtrusive way to collect metrics without impacting provider performance.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 */

'use strict';

/**
 * Searching Analytics Manager
 * Tracks search operations and search terms for monitoring and analytics purposes
 */
class SearchingAnalytics {
  constructor() {
    // Map to store search term analytics: searchTerm -> { term, count, totalResults, lastCalled }
    this.searchTerms = new Map();

    // Operation counters
    this.operations = {
      adds: 0,
      reads: 0,
      deletes: 0,
      searches: 0
    };
  }

  /**
   * Track an add operation
   */
  trackAdd() {
    this.operations.adds++;
  }

  /**
   * Track a read operation
   */
  trackRead() {
    this.operations.reads++;
  }

  /**
   * Track a delete operation
   */
  trackDelete() {
    this.operations.deletes++;
  }

  /**
   * Track a search operation
   * @param {string} searchTerm - The search term used
   * @param {number} resultCount - Number of results returned
   */
  trackSearch(searchTerm, resultCount = 0) {
    if (!searchTerm) return;

    this.operations.searches++;

    // Normalize search term (trim and lowercase for consistency)
    const normalizedTerm = searchTerm.trim().toLowerCase();

    if (!this.searchTerms.has(normalizedTerm)) {
      this.searchTerms.set(normalizedTerm, {
        term: searchTerm.trim(), // Keep original case for display
        count: 0,
        totalResults: 0,
        lastCalled: new Date().toISOString()
      });
    }

    const stats = this.searchTerms.get(normalizedTerm);
    stats.count++;
    stats.totalResults += resultCount;
    stats.lastCalled = new Date().toISOString();
  }

  /**
   * Get search term analytics sorted by count
   * @param {number} [limit=100] - Maximum number of entries to return
   * @return {Array<Object>} Array of search term analytics objects
   */
  getSearchTermAnalytics(limit = 100) {
    // Convert map to array
    const analyticsArray = Array.from(this.searchTerms.values());

    // Sort by count descending
    analyticsArray.sort((a, b) => b.count - a.count);

    // Return top entries up to the limit
    return analyticsArray.slice(0, limit);
  }

  /**
   * Get operation statistics
   * @return {Object} Statistics object
   */
  getOperationStats() {
    return {
      ...this.operations,
      totalSearchTerms: this.searchTerms.size
    };
  }

  /**
   * Get all analytics data
   * @return {Object} Complete analytics data
   */
  getAllAnalytics() {
    return {
      operations: this.getOperationStats(),
      searchTerms: this.getSearchTermAnalytics(100)
    };
  }

  /**
   * Clear all analytics data
   */
  clear() {
    this.searchTerms.clear();
    this.operations = {
      adds: 0,
      reads: 0,
      deletes: 0,
      searches: 0
    };
  }

  /**
   * Get analytics for a specific search term
   * @param {string} searchTerm - The search term to get analytics for
   * @return {Object|null} Analytics object or null if not found
   */
  getTermAnalytics(searchTerm) {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return this.searchTerms.get(normalizedTerm) || null;
  }
}

// Create singleton instance
const searchingAnalytics = new SearchingAnalytics();

module.exports = searchingAnalytics;
