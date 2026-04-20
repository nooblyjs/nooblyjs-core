/**
 * @fileoverview HTTP routes for the scheduling service.
 *
 * Mounts a REST API at `/services/scheduling/api/*` for creating, listing
 * and managing schedules, plus dashboards for analytics and settings. All
 * handlers convert validation failures into 4xx responses and unexpected
 * failures into 5xx responses, and route through the optional logger.
 *
 * @author Noobly JS Core Team
 * @version 2.0.0
 * @since 1.0.0
 */

'use strict';

const analytics = require('../modules/analytics');
const { isValid: isValidCron } = require('../providers/cronExpression');

/**
 * Returns true for plain integer-coercible positive numbers (used by query
 * params like `?limit=20`).
 * @param {*} value
 * @return {boolean}
 */
function parsePositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Registers all scheduling-service HTTP routes.
 *
 * @param {!Object} options Service options. Must include `'express-app'`.
 * @param {!EventEmitter} eventEmitter Event emitter for service lifecycle.
 * @param {!Object} scheduler The scheduler provider instance.
 * @return {void}
 */
module.exports = (options, eventEmitter, scheduler) => {
  if (!options || !options['express-app'] || !scheduler) return;
  const app = options['express-app'];
  const logger = scheduler.logger || null;

  /**
   * Wraps an async route handler so any thrown error becomes a 500 response
   * with structured logging instead of a stack trace leaking to the client.
   * @param {Function} handler
   */
  const wrap = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      logger?.error?.('[SchedulingRoutes] Unhandled error', {
        path: req.path,
        method: req.method,
        error: err?.message
      });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error', message: err?.message });
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  app.get('/services/scheduling/api/status', (req, res) => {
    eventEmitter?.emit('api-scheduling-status', 'scheduling api running');
    res.status(200).json('scheduling api running');
  });

  // ---------------------------------------------------------------------------
  // Schedule creation — CRON
  // ---------------------------------------------------------------------------

  app.post('/services/scheduling/api/schedule', wrap(async (req, res) => {
    const { task, cron, taskName } = req.body || {};

    if (task === undefined || task === null) {
      return res.status(400).json({ error: 'Bad Request: Missing task' });
    }
    if (!cron || typeof cron !== 'string') {
      return res.status(400).json({ error: 'Bad Request: Missing cron expression' });
    }
    if (!isValidCron(cron)) {
      return res.status(400).json({ error: `Bad Request: Invalid cron expression "${cron}"` });
    }

    try {
      const name = await scheduler.startCron(task, cron, taskName);
      res.status(201).json({ status: 'OK', taskName: name, message: 'Schedule created successfully' });
    } catch (err) {
      // startCron throws on duplicate names — surface that as a 409.
      if (/already scheduled/i.test(err.message)) {
        return res.status(409).json({ error: err.message });
      }
      throw err;
    }
  }));

  // ---------------------------------------------------------------------------
  // Schedule cancellation
  // ---------------------------------------------------------------------------

  app.delete('/services/scheduling/api/cancel/:taskId', wrap(async (req, res) => {
    const taskId = req.params.taskId;
    if (!taskId) {
      return res.status(400).json({ error: 'Bad Request: Missing taskId' });
    }
    const removed = await scheduler.cancel(taskId);
    if (!removed) {
      return res.status(404).json({ error: `Schedule "${taskId}" not found` });
    }
    res.status(200).json({ status: 'OK', message: `Schedule "${taskId}" cancelled` });
  }));

  // ---------------------------------------------------------------------------
  // Live schedule listing — directly from the provider, not analytics
  // ---------------------------------------------------------------------------

  app.get('/services/scheduling/api/schedules/live', wrap(async (req, res) => {
    const schedules = await scheduler.listSchedules();
    res.status(200).json(schedules);
  }));

  app.get('/services/scheduling/api/schedules/:taskName', wrap(async (req, res) => {
    const schedule = await scheduler.getSchedule(req.params.taskName);
    if (!schedule) {
      return res.status(404).json({ error: `Schedule "${req.params.taskName}" not found` });
    }
    res.status(200).json(schedule);
  }));

  // ---------------------------------------------------------------------------
  // Analytics endpoints
  // ---------------------------------------------------------------------------

  app.get('/services/scheduling/api/analytics', wrap(async (req, res) => {
    res.status(200).json(analytics.getAllAnalytics());
  }));

  app.get('/services/scheduling/api/analytics/totals', wrap(async (req, res) => {
    res.status(200).json(analytics.getTotalStats());
  }));

  app.get('/services/scheduling/api/analytics/schedules', wrap(async (req, res) => {
    const limit = parsePositiveInt(req.query.limit, 100);
    res.status(200).json(analytics.getScheduleAnalytics(limit));
  }));

  app.get('/services/scheduling/api/schedules', wrap(async (req, res) => {
    const limit = parsePositiveInt(req.query.limit, 1000);
    res.status(200).json(analytics.getScheduleAnalytics(limit));
  }));

  app.get('/services/scheduling/api/executions/:scheduleId', wrap(async (req, res) => {
    const limit = parsePositiveInt(req.query.limit, 20);
    res.status(200).json(analytics.getExecutionHistory(req.params.scheduleId, limit));
  }));

  app.delete('/services/scheduling/api/analytics', wrap(async (req, res) => {
    analytics.clear();
    res.status(200).json({ message: 'Analytics data cleared successfully' });
  }));

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  app.get('/services/scheduling/api/settings', wrap(async (req, res) => {
    const settings = await scheduler.getSettings();
    res.status(200).json(settings);
  }));

  app.post('/services/scheduling/api/settings', wrap(async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Bad Request: Missing settings body' });
    }
    await scheduler.saveSettings(body);
    res.status(200).json({ status: 'OK', message: 'Settings updated' });
  }));
};
