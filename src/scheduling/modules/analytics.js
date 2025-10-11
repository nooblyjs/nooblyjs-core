/**
 * @fileoverview Analytics module for scheduling service
 * Tracks schedule execution statistics including pending, running, completed, and errored states.
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

/**
 * Singleton class for tracking scheduling analytics
 * Maintains execution counts and status information for scheduled tasks
 */
class SchedulingAnalytics {
  constructor() {
    // Map of schedule name -> { schedule, pending, running, completed, error, lastRun }
    this.schedules = new Map();

    // Total counts across all schedules
    this.totals = {
      schedules: 0,
      pending: 0,
      running: 0,
      completed: 0,
      error: 0
    };
  }

  /**
   * Track when a schedule is started (created)
   * @param {string} scheduleName - Name of the schedule
   */
  trackScheduleStarted(scheduleName) {
    if (!this.schedules.has(scheduleName)) {
      this.schedules.set(scheduleName, {
        schedule: scheduleName,
        pending: 0,
        running: 0,
        completed: 0,
        error: 0,
        lastRun: new Date().toISOString()
      });
      this.totals.schedules++;
    }

    // Mark as pending initially
    const schedule = this.schedules.get(scheduleName);
    schedule.pending++;
    this.totals.pending++;
  }

  /**
   * Track when a schedule execution begins
   * @param {string} scheduleName - Name of the schedule
   */
  trackScheduleRunning(scheduleName) {
    if (!this.schedules.has(scheduleName)) {
      this.schedules.set(scheduleName, {
        schedule: scheduleName,
        pending: 0,
        running: 0,
        completed: 0,
        error: 0,
        lastRun: new Date().toISOString()
      });
      this.totals.schedules++;
    }

    const schedule = this.schedules.get(scheduleName);

    // Move from pending to running if there was a pending count
    if (schedule.pending > 0) {
      schedule.pending--;
      this.totals.pending--;
    }

    schedule.running++;
    schedule.lastRun = new Date().toISOString();
    this.totals.running++;
  }

  /**
   * Track when a schedule execution completes successfully
   * @param {string} scheduleName - Name of the schedule
   */
  trackScheduleCompleted(scheduleName) {
    if (!this.schedules.has(scheduleName)) {
      this.schedules.set(scheduleName, {
        schedule: scheduleName,
        pending: 0,
        running: 0,
        completed: 0,
        error: 0,
        lastRun: new Date().toISOString()
      });
      this.totals.schedules++;
    }

    const schedule = this.schedules.get(scheduleName);

    // Move from running to completed
    if (schedule.running > 0) {
      schedule.running--;
      this.totals.running--;
    }

    schedule.completed++;
    schedule.lastRun = new Date().toISOString();
    this.totals.completed++;
  }

  /**
   * Track when a schedule execution fails
   * @param {string} scheduleName - Name of the schedule
   */
  trackScheduleError(scheduleName) {
    if (!this.schedules.has(scheduleName)) {
      this.schedules.set(scheduleName, {
        schedule: scheduleName,
        pending: 0,
        running: 0,
        completed: 0,
        error: 0,
        lastRun: new Date().toISOString()
      });
      this.totals.schedules++;
    }

    const schedule = this.schedules.get(scheduleName);

    // Move from running to error
    if (schedule.running > 0) {
      schedule.running--;
      this.totals.running--;
    }

    schedule.error++;
    schedule.lastRun = new Date().toISOString();
    this.totals.error++;
  }

  /**
   * Track when a schedule is stopped
   * @param {string} scheduleName - Name of the schedule
   */
  trackScheduleStopped(scheduleName) {
    if (this.schedules.has(scheduleName)) {
      const schedule = this.schedules.get(scheduleName);

      // Clear any pending/running states when stopped
      if (schedule.pending > 0) {
        this.totals.pending -= schedule.pending;
        schedule.pending = 0;
      }
      if (schedule.running > 0) {
        this.totals.running -= schedule.running;
        schedule.running = 0;
      }
    }
  }

  /**
   * Get analytics for all schedules
   * @param {number} limit - Maximum number of schedules to return (default: 100)
   * @return {Array} Array of schedule analytics sorted by lastRun descending
   */
  getScheduleAnalytics(limit = 100) {
    const analyticsArray = Array.from(this.schedules.values());

    // Transform data to match expected format for dashboard
    const transformedArray = analyticsArray.map(item => ({
      name: item.schedule,           // Schedule name (taskName)
      scheduleId: item.schedule,     // Also provide as scheduleId for compatibility
      pending: item.pending,         // Pending count
      runCount: item.completed + item.error, // Total runs (completed + error)
      completeCount: item.completed, // Successfully completed count
      errorCount: item.error,        // Error count
      lastRun: item.lastRun          // Last run timestamp
    }));

    // Sort by lastRun descending (most recent first)
    transformedArray.sort((a, b) => {
      return new Date(b.lastRun) - new Date(a.lastRun);
    });

    return transformedArray.slice(0, limit);
  }

  /**
   * Get total statistics across all schedules
   * @return {Object} Total counts for schedules, pending, running, completed, error
   */
  getTotalStats() {
    return { ...this.totals };
  }

  /**
   * Get all analytics data (totals + schedules)
   * @return {Object} Complete analytics data
   */
  getAllAnalytics() {
    const totals = this.getTotalStats();
    return {
      totalSchedules: totals.schedules,
      totalPending: totals.pending,
      totalRunning: totals.running,
      totalCompleted: totals.completed,
      totalErrors: totals.error,
      schedules: this.getScheduleAnalytics()
    };
  }

  /**
   * Clear all analytics data
   */
  clear() {
    this.schedules.clear();
    this.totals = {
      schedules: 0,
      pending: 0,
      running: 0,
      completed: 0,
      error: 0
    };
  }
}

// Export singleton instance
module.exports = new SchedulingAnalytics();
