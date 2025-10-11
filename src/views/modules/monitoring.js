/**
 * @fileoverview System Monitoring Module
 * Tracks system metrics (RAM, CPU, threads) for the Service Registry dashboard.
 * Keeps metrics in memory with a rolling window of data points.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 */

'use strict';

const os = require('os');
const v8 = require('v8');

/**
 * System Monitoring Manager
 * Collects and stores system metrics for visualization
 */
class SystemMonitoring {
  constructor() {
    // Store up to 60 data points (for 60 seconds of data if collected every second)
    this.maxDataPoints = 60;
    this.metrics = {
      ram: [], // { timestamp, used, total, percentage }
      cpu: [], // { timestamp, usage }
      threads: [] // { timestamp, active, idle }
    };

    // Start collecting metrics
    this.startCollecting();
  }

  /**
   * Get memory usage in MB
   * @return {Object} Memory usage information
   * @private
   */
  _getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const heapStats = v8.getHeapStatistics();

    return {
      timestamp: Date.now(),
      total: Math.round(totalMemory / (1024 * 1024)), // MB
      used: Math.round(usedMemory / (1024 * 1024)), // MB
      free: Math.round(freeMemory / (1024 * 1024)), // MB
      percentage: Math.round((usedMemory / totalMemory) * 100),
      heap: {
        total: Math.round(heapStats.total_heap_size / (1024 * 1024)), // MB
        used: Math.round(heapStats.used_heap_size / (1024 * 1024)), // MB
        limit: Math.round(heapStats.heap_size_limit / (1024 * 1024)) // MB
      }
    };
  }

  /**
   * Get CPU usage percentage
   * Uses a sampling approach to calculate CPU usage
   * @return {Object} CPU usage information
   * @private
   */
  _getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return {
      timestamp: Date.now(),
      usage: usage,
      cores: cpus.length,
      model: cpus[0].model
    };
  }

  /**
   * Get thread/worker information from libuv
   * @return {Object} Thread information
   * @private
   */
  _getThreadInfo() {
    // Get active handles and requests from libuv
    const handles = process._getActiveHandles ? process._getActiveHandles().length : 0;
    const requests = process._getActiveRequests ? process._getActiveRequests().length : 0;

    return {
      timestamp: Date.now(),
      active: handles,
      requests: requests,
      total: handles + requests
    };
  }

  /**
   * Add a data point to a metric array, maintaining the max size
   * @param {Array} array - The metric array
   * @param {Object} dataPoint - The data point to add
   * @private
   */
  _addDataPoint(array, dataPoint) {
    array.push(dataPoint);
    if (array.length > this.maxDataPoints) {
      array.shift(); // Remove oldest data point
    }
  }

  /**
   * Collect current metrics
   * @private
   */
  _collectMetrics() {
    try {
      // Collect RAM metrics
      const ramData = this._getMemoryUsage();
      this._addDataPoint(this.metrics.ram, ramData);

      // Collect CPU metrics
      const cpuData = this._getCPUUsage();
      this._addDataPoint(this.metrics.cpu, cpuData);

      // Collect thread metrics
      const threadData = this._getThreadInfo();
      this._addDataPoint(this.metrics.threads, threadData);
    } catch (error) {
      console.error('Error collecting metrics:', error.message);
    }
  }

  /**
   * Start collecting metrics at regular intervals
   */
  startCollecting() {
    // Collect initial metrics immediately
    this._collectMetrics();

    // Then collect every second
    this.collectionInterval = setInterval(() => {
      this._collectMetrics();
    }, 1000);
  }

  /**
   * Stop collecting metrics
   */
  stopCollecting() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
  }

  /**
   * Get all current metrics
   * @return {Object} All metrics data
   */
  getMetrics() {
    return {
      ram: this.metrics.ram,
      cpu: this.metrics.cpu,
      threads: this.metrics.threads,
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        nodeVersion: process.version
      }
    };
  }

  /**
   * Get current snapshot of metrics (latest values only)
   * @return {Object} Current metric values
   */
  getCurrentSnapshot() {
    const ram = this.metrics.ram[this.metrics.ram.length - 1] || {};
    const cpu = this.metrics.cpu[this.metrics.cpu.length - 1] || {};
    const threads = this.metrics.threads[this.metrics.threads.length - 1] || {};

    return {
      ram,
      cpu,
      threads,
      timestamp: Date.now()
    };
  }

  /**
   * Clear all metrics data
   */
  clear() {
    this.metrics.ram = [];
    this.metrics.cpu = [];
    this.metrics.threads = [];
  }
}

// Create singleton instance
const systemMonitoring = new SystemMonitoring();

module.exports = systemMonitoring;
