/**
 * @fileoverview Logging API routes for Express.js application.
 * Provides RESTful endpoints for structured logging operations including
 * info, warning, error level logging, and service status monitoring.
 *
 * @author NooblyJS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

/**
 * Configures and registers logging routes with the Express application.
 * Sets up endpoints for different log levels and service monitoring.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} logger - The logging provider instance with level methods
 * @param {Object} analytics - The analytics module instance for log retrieval
 * @return {void}
 */
module.exports = (options, eventEmitter, logger, analytics) => {
  if (options['express-app'] && logger) {
    const app = options['express-app'];

    /**
     * POST /services/logging/api/info
     * Logs an informational message through the logging system.
     *
     * @param {express.Request} req - Express request object
     * @param {*} req.body - The message to log at info level
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/logging/api/info', (req, res) => {
      const message = req.body;
      if (message) {
        logger
          .info(message)
          .then(() => res.status(200).send('OK'))
          .catch((err) => res.status(500).send(err.message));
      } else {
        res.status(400).send('Bad Request: Missing message');
      }
    });

    /**
     * POST /services/logging/api/warn
     * Logs a warning message through the logging system.
     *
     * @param {express.Request} req - Express request object
     * @param {*} req.body - The message to log at warning level
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/logging/api/warn', (req, res) => {
      const message = req.body;
      if (message) {
        logger
          .warn(message)
          .then(() => res.status(200).send('OK'))
          .catch((err) => res.status(500).send(err.message));
      } else {
        res.status(400).send('Bad Request: Missing message');
      }
    });

    /**
     * POST /services/logging/api/error
     * Logs an error message through the logging system.
     *
     * @param {express.Request} req - Express request object
     * @param {*} req.body - The message to log at error level
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/logging/api/error', (req, res) => {
      const message = req.body;
      if (message) {
        logger
          .error(message)
          .then(() => res.status(200).send('OK'))
          .catch((err) => res.status(500).send(err.message));
      } else {
        res.status(400).send('Bad Request: Missing message');
      }
    });

    /**
     * GET /services/logging/api/status
     * Returns the operational status of the logging service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/api/status', (req, res) => {
      eventEmitter.emit('api-logging-status', 'logging api running');
      res.status(200).json('logging api running');
    });

    /**
     * GET /services/logging/api/logs
     * Retrieves the last 1000 logs from analytics in descending order.
     * Optional query parameter 'level' can filter by log level (INFO, WARN, ERROR, LOG).
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.query.level - Optional log level filter (case-insensitive)
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/api/logs', (req, res) => {
      if (!analytics) {
        return res.status(503).json({
          error: 'Analytics module not available'
        });
      }

      try {
        const level = req.query.level;
        const logs = analytics.list(level);

        res.status(200).json({
          count: logs.length,
          level: level || 'ALL',
          logs: logs
        });
      } catch (err) {
        res.status(500).json({
          error: 'Failed to retrieve logs',
          message: err.message
        });
      }
    });

    /**
     * GET /services/logging/api/stats
     * Retrieves statistics about log levels including counts and percentages.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/api/stats', (req, res) => {
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
     * GET /services/logging/api/timeline
     * Retrieves timeline data showing log activity per minute for each log level.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/api/timeline', (req, res) => {
      if (!analytics) {
        return res.status(503).json({
          error: 'Analytics module not available'
        });
      }

      try {
        const timeline = analytics.getTimeline();
        res.status(200).json(timeline);
      } catch (err) {
        res.status(500).json({
          error: 'Failed to retrieve timeline',
          message: err.message
        });
      }
    });

    /**
     * GET /services/logging/api/settings
     * Retrieves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/api/settings', (req, res) => {
      try {
        const settings = logger.getSettings().then((settings)=> res.status(200).json(settings));
      } catch (err) {
        console.log(err);
        res.status(500).json({
          error: 'Failed to retrieve settings',
          message: err.message
        });
      }
    });

     /**
     * POST /services/logging/api/settings
     * Retrieves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/logging/api/settings', (req, res) => {
      const message = req.body;
      if (message) {
        logger
          .saveSettings(message)
          .then(() => res.status(200).send('OK'))
          .catch((err) => res.status(500).send(err.message));
      } else {
        res.status(400).send('Bad Request: Missing settings');
      }
    });

  }
};
