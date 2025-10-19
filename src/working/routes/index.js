/**
 * @fileoverview Worker management API routes for Express.js application.
 * Provides RESTful endpoints for background task execution, worker lifecycle
 * management, and service status monitoring with event-driven callbacks.
 *
 * @author NooblyJS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

/**
 * Configures and registers worker routes with the Express application.
 * Sets up endpoints for background task execution and worker management.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} worker - The worker provider instance with start/stop methods
 * @param {Object} analytics - The analytics module instance for task analytics
 * @return {void}
 */
module.exports = (options, eventEmitter, worker, analytics) => {
  if (options['express-app'] && worker) {
    const app = options['express-app'];

    /**
     * POST /services/working/api/run
     * Starts a background worker task with completion callback.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.body.scriptPath - The path to the script to execute in the worker
     * @param {*} req.body.data - Optional data for the task execution
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/working/api/run', (req, res) => {
      const { scriptPath, data } = req.body;
      if (scriptPath) {
        worker
          .start(scriptPath, data, (status, result) => {
            eventEmitter.emit('worker-complete', { status, result });
          })
          .then((taskId) => res.status(200).json({ taskId, message: 'Task queued successfully' }))
          .catch((err) => res.status(500).send(err.message));
      } else {
        res.status(400).send('Bad Request: Missing scriptPath');
      }
    });

    /**
     * GET /services/working/api/stop
     * Stops the currently running background worker.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/working/api/stop', (req, res) => {
      worker
        .stop()
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).send(err.message));
    });

    /**
     * GET /services/working/api/status
     * Returns the operational status of the working service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/working/api/status', (req, res) => {
      worker
        .getStatus()
        .then((status) => {
          eventEmitter.emit('api-working-status', status);
          res.status(200).json(status);
        })
        .catch((err) => res.status(500).send(err.message));
    });

    /**
     * GET /services/working/api/history
     * Returns the task history.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/working/api/history', (req, res) => {
      const limit = parseInt(req.query.limit) || 100;
      worker
        .getTaskHistory(limit)
        .then((history) => res.status(200).json(history))
        .catch((err) => res.status(500).send(err.message));
    });

    /**
     * GET /services/working/api/task/:taskId
     * Returns information about a specific task.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/working/api/task/:taskId', (req, res) => {
      const { taskId } = req.params;
      worker
        .getTask(taskId)
        .then((task) => {
          if (task) {
            res.status(200).json(task);
          } else {
            res.status(404).send('Task not found');
          }
        })
        .catch((err) => res.status(500).send(err.message));
    });

    /**
     * GET /services/working/api/stats
     * Retrieves overall statistics about worker tasks including counts and percentages.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/working/api/stats', (req, res) => {
      if (!analytics) {
        return res.status(503).json({
          error: 'Analytics module not available'
        });
      }

      try {
        const stats = analytics.getStats();
        res.status(200).json(stats);
      } catch (err) {
        res.status(500).json({
          error: 'Failed to retrieve statistics',
          message: err.message
        });
      }
    });

    /**
     * GET /services/working/api/analytics
     * Retrieves detailed analytics for all tasks ordered by last run date.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/working/api/analytics', (req, res) => {
      if (!analytics) {
        return res.status(503).json({
          error: 'Analytics module not available'
        });
      }

      try {
        const taskAnalytics = analytics.getTaskAnalytics();
        res.status(200).json({
          count: taskAnalytics.length,
          tasks: taskAnalytics
        });
      } catch (err) {
        res.status(500).json({
          error: 'Failed to retrieve task analytics',
          message: err.message
        });
      }
    });

    /**
     * GET /services/working/api/analytics/:scriptPath
     * Retrieves analytics for a specific task by script path.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/working/api/analytics/:scriptPath(*)', (req, res) => {
      if (!analytics) {
        return res.status(503).json({
          error: 'Analytics module not available'
        });
      }

      try {
        const { scriptPath } = req.params;
        const taskAnalytics = analytics.getTaskAnalyticsByPath(scriptPath);

        if (taskAnalytics) {
          res.status(200).json(taskAnalytics);
        } else {
          res.status(404).json({
            error: 'Task not found',
            scriptPath: scriptPath
          });
        }
      } catch (err) {
        res.status(500).json({
          error: 'Failed to retrieve task analytics',
          message: err.message
        });
      }
    });

    /**
     * GET /services/working/api/settings
     * Retrieves the settings for the working service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/working/api/settings', (req, res) => {
      try {
        worker.getSettings()
          .then((settings) => res.status(200).json(settings))
          .catch((err) => {
            console.log(err);
            res.status(500).json({
              error: 'Failed to retrieve settings',
              message: err.message
            });
          });
      } catch (err) {
        console.log(err);
        res.status(500).json({
          error: 'Failed to retrieve settings',
          message: err.message
        });
      }
    });

    /**
     * POST /services/working/api/settings
     * Saves the settings for the working service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/working/api/settings', (req, res) => {
      const message = req.body;
      if (message) {
        worker
          .saveSettings(message)
          .then(() => res.status(200).send('OK'))
          .catch((err) => res.status(500).send(err.message));
      } else {
        res.status(400).send('Bad Request: Missing settings');
      }
    });
  }
};
