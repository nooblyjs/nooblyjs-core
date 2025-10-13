/**
 * @fileoverview Measuring Analytics Module
 * Tracks measurement activity for generating dashboard insights.
 * Maintains aggregate counts, last-captured timestamps, and recent history
 * so the UI can display the most active and most recent metrics.
 *
 * @author
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Rolling history size for recent measurements.
 * @type {number}
 */
const MAX_HISTORY = 1000;

/**
 * Analytics helper for the measuring service.
 * Listens to measuring events and captures per-metric statistics.
 */
class MeasuringAnalytics {
  /**
   * @param {EventEmitter} eventEmitter Global event emitter instance.
   */
  constructor(eventEmitter) {
    /** @private @type {Map<string, {
     *   name: string,
     *   count: number,
     *   lastCaptured: number,
     *   lastValue: number,
     *   totalValue: number
     * }>}*/
    this.metricStats_ = new Map();

    /** @private @type {Array<{
     *   metric: string,
     *   value: number,
     *   capturedAt: number
     * }>}*/
    this.history_ = [];

    if (eventEmitter) {
      this.initializeListeners_(eventEmitter);
    }
  }

  /**
   * Registers listeners for measuring events.
   * @param {EventEmitter} eventEmitter
   * @private
   */
  initializeListeners_(eventEmitter) {
    eventEmitter.on('measuring:add', ({ metricName, measure }) => {
      this.captureMetric_(metricName, measure);
    });

    eventEmitter.on('measuring:increment', ({ name, value }) => {
      this.captureMetric_(name, { value: value ?? 1, timestamp: new Date() });
    });

    eventEmitter.on('measuring:gauge', ({ name, value }) => {
      this.captureMetric_(name, { value, timestamp: new Date() });
    });

    eventEmitter.on('measuring:timing', ({ name, duration }) => {
      this.captureMetric_(name, { value: duration, timestamp: new Date() });
    });

    eventEmitter.on('measuring:histogram', ({ name, value }) => {
      this.captureMetric_(name, { value, timestamp: new Date() });
    });
  }

  /**
   * Records a measurement for analytics.
   * @param {string} metricName
   * @param {{value: number, timestamp: Date}} measure
   * @private
   */
  captureMetric_(metricName, measure) {
    if (!metricName) {
      return;
    }

    const now = (measure && measure.timestamp instanceof Date)
      ? measure.timestamp.getTime()
      : Date.now();
    const value = measure && typeof measure.value === 'number' ? measure.value : 0;

    const stat = this.metricStats_.get(metricName) || {
      name: metricName,
      count: 0,
      lastCaptured: 0,
      lastValue: 0,
      totalValue: 0
    };

    stat.count += 1;
    stat.lastCaptured = now;
    stat.lastValue = value;
    stat.totalValue += value;

    this.metricStats_.set(metricName, stat);

    this.history_.unshift({
      metric: metricName,
      value,
      capturedAt: now
    });

    if (this.history_.length > MAX_HISTORY) {
      this.history_.pop();
    }
  }

  /**
   * Returns the number of distinct metrics tracked.
   * @return {number}
   */
  getUniqueMetricCount() {
    return this.metricStats_.size;
  }

  /**
   * Returns the total number of measurements recorded.
   * @return {number}
   */
  getMeasurementCount() {
    let total = 0;
    this.metricStats_.forEach(stat => {
      total += stat.count;
    });
    return total;
  }

  /**
   * Returns metrics sorted by count (descending).
   * @param {number} limit
   * @return {Array<Object>}
   */
  getTopMetricsByCount(limit = 10) {
    return [...this.metricStats_.values()]
      .sort((a, b) => b.count - a.count || b.lastCaptured - a.lastCaptured)
      .slice(0, limit)
      .map(stat => ({
        metric: stat.name,
        count: stat.count,
        lastCaptured: new Date(stat.lastCaptured).toISOString(),
        lastValue: stat.lastValue,
        totalValue: stat.totalValue
      }));
  }

  /**
   * Returns metrics sorted by recency (descending).
   * @param {number} limit
   * @return {Array<Object>}
   */
  getTopMetricsByRecency(limit = 100) {
    return [...this.metricStats_.values()]
      .sort((a, b) => b.lastCaptured - a.lastCaptured || b.count - a.count)
      .slice(0, limit)
      .map(stat => ({
        metric: stat.name,
        count: stat.count,
        lastCaptured: new Date(stat.lastCaptured).toISOString(),
        lastValue: stat.lastValue,
        totalValue: stat.totalValue
      }));
  }

  /**
   * Returns the most recent measurement events.
   * @param {number} limit
   * @return {Array<Object>}
   */
  getRecentHistory(limit = 50) {
    return this.history_
      .slice(0, limit)
      .map(entry => ({
        metric: entry.metric,
        value: entry.value,
        capturedAt: new Date(entry.capturedAt).toISOString()
      }));
  }
}

module.exports = MeasuringAnalytics;
