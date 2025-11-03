/**
 * @fileoverview Metrics and measurement API routes for Express.js application.
 * Provides RESTful endpoints for metric collection, data aggregation,
 * and statistical analysis with time-based filtering capabilities.
 *
 * @author NooblyJS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

/**
 * Configures and registers measurement routes with the Express application.
 * Sets up endpoints for metric collection and analysis operations.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} measuring - The measuring provider instance with metric methods
 * @param {Object} analytics - Analytics module for measurement insights
 * @return {void}
 */
module.exports = (options, eventEmitter, measuring, analytics) => {
  if (options['express-app'] && measuring) {
    const app = options['express-app'];

    /**
     * POST /services/measuring/api/add
     * Adds a new metric data point to the measurement system.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.body.metric - The metric name/identifier
     * @param {number} req.body.value - The metric value to record
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/measuring/api/add', async (req, res) => {
      const { metric, value } = req.body || {};

      if (typeof metric !== 'string' || metric.trim() === '') {
        return res.status(400).send('Bad Request: Missing metric');
      }

      if (value === undefined || value === null || Number.isNaN(Number(value))) {
        return res.status(400).send('Bad Request: Missing or invalid value');
      }

      try {
        await Promise.resolve(measuring.add(metric, Number(value)));
        res.status(200).send('OK');
      } catch (err) {
        res.status(500).send(err.message);
      }
    });

    /**
     * GET /services/measuring/api/list/:metric/:datestart/:dateend
     * Retrieves a list of metric values within a specified date range.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.metric - The metric name to query
     * @param {string} req.params.datestart - Start date (ISO string format)
     * @param {string} req.params.dateend - End date (ISO string format)
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/measuring/api/list/:metric/:datestart/:dateend',
      async (req, res) => {
        try {
          const measures = await Promise.resolve(
            measuring.list(
              req.params.metric,
              new Date(req.params.datestart),
              new Date(req.params.dateend)
            )
          );
          res.status(200).json(measures);
        } catch (err) {
          res.status(500).send(err.message);
        }
      }
    );

    /**
     * GET /services/measuring/api/total/:metric/:datestart/:dateend
     * Calculates the total sum of metric values within a specified date range.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.metric - The metric name to aggregate
     * @param {string} req.params.datestart - Start date (ISO string format)
     * @param {string} req.params.dateend - End date (ISO string format)
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/measuring/api/total/:metric/:datestart/:dateend',
      async (req, res) => {
        try {
          const total = await Promise.resolve(
            measuring.total(
              req.params.metric,
              new Date(req.params.datestart),
              new Date(req.params.dateend)
            )
          );
          res.status(200).json(total);
        } catch (err) {
          res.status(500).send(err.message);
        }
      }
    );

    /**
     * GET /services/measuring/api/average/:metric/:datestart/:dateend
     * Calculates the average of metric values within a specified date range.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.metric - The metric name to average
     * @param {string} req.params.datestart - Start date (ISO string format)
     * @param {string} req.params.dateend - End date (ISO string format)
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/measuring/api/average/:metric/:datestart/:dateend',
      async (req, res) => {
        try {
          const average = await Promise.resolve(
            measuring.average(
              req.params.metric,
              new Date(req.params.datestart),
              new Date(req.params.dateend)
            )
          );
          res.status(200).json(average);
        } catch (err) {
          res.status(500).send(err.message);
        }
      }
    );

    /**
     * GET /services/measuring/api/status
     * Returns the operational status of the measuring service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/measuring/api/status', (req, res) => {
      eventEmitter.emit('api-measuring-status', 'measuring api running');
      res.status(200).json('measuring api running');
    });

    /**
     * GET /services/measuring/api/analytics/summary
     * Provides aggregate analytics for dashboard consumption.
     *
     * @param {express.Request} req
     * @param {express.Response} res
     * @return {void}
     */
    app.get('/services/measuring/api/analytics/summary', (req, res) => {
      if (!analytics) {
        return res.status(503).json({
          error: 'Analytics module not available'
        });
      }

      const countLimit = Number.parseInt(req.query.topLimit, 10);
      const recentLimit = Number.parseInt(req.query.recentLimit, 10);
      const historyLimit = Number.parseInt(req.query.historyLimit, 10);

      try {
        res.status(200).json({
          totals: {
            uniqueMetrics: analytics.getUniqueMetricCount(),
            totalMeasurements: analytics.getMeasurementCount()
          },
          topByActivity: analytics.getTopMetricsByCount(
            Number.isNaN(countLimit) ? 10 : Math.min(countLimit, 100)
          ),
          topByRecency: analytics.getTopMetricsByRecency(
            Number.isNaN(recentLimit) ? 100 : Math.min(recentLimit, 250)
          ),
          recentHistory: analytics.getRecentHistory(
            Number.isNaN(historyLimit) ? 25 : Math.min(historyLimit, 250)
          )
        });
      } catch (err) {
        res.status(500).json({
          error: 'Failed to generate analytics summary',
          message: err.message
        });
      }
    });

    /**
     * GET /services/measuring/api/settings
     * Retrieves the settings for the measuring service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/measuring/api/settings', async (req, res) => {
      try {
        const settings = await measuring.getSettings();
        res.status(200).json(settings);
      } catch (err) {
        eventEmitter.emit('api-measuring-settings-error', err.message);
        res.status(500).json({
          error: 'Failed to retrieve settings',
          message: err.message
        });
      }
    });

    /**
     * POST /services/measuring/api/settings
     * Saves the settings for the measuring service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/measuring/api/settings', async (req, res) => {
      const message = req.body;
      if (message) {
        try {
          await measuring.saveSettings(message);
          res.status(200).send('OK');
        } catch (err) {
          res.status(500).send(err.message);
        }
      } else {
        res.status(400).send('Bad Request: Missing settings');
      }
    });
  }
};
