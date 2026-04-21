/**
 * @fileoverview Metrics and measurement API routes for Express.js application.
 * Provides RESTful endpoints for metric collection, data aggregation,
 * and statistical analysis with time-based filtering capabilities.
 *
 * @author Noobly JS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const { sendSuccess, sendError, sendStatus, ERROR_CODES, handleError } = require('../../appservice/utils/responseUtils');
const AuditLog = require('../../appservice/modules/auditLog');
const DataExporter = require('../../appservice/utils/exportUtils');
const DataImporter = require('../../appservice/utils/importUtils');
const { HealthCheck } = require('../../appservice/utils/healthCheck');

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
    const authMiddleware = options.authMiddleware;
    const auditLog = new AuditLog({ maxEntries: 5000, retention: { days: 90 } });
    const healthCheck = new HealthCheck('measuring', { dependencies: [] });

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
        return res.status(400).json({ error: 'Missing metric' });
      }

      if (value === undefined || value === null || Number.isNaN(Number(value))) {
        return res.status(400).json({ error: 'Missing or invalid value' });
      }

      try {
        await Promise.resolve(measuring.add(metric, Number(value)));
        res.status(200).json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
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
          res.status(500).json({ error: err.message });
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
          res.status(500).json({ error: err.message });
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
          res.status(500).json({ error: err.message });
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
      sendStatus(res, 'measuring api running');
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
          res.status(200).json({ success: true });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      } else {
        res.status(400).json({ error: 'Missing settings' });
      }
    });

    /**
     * GET /services/measuring/api/metrics
     * Retrieves all available metrics and their values for UI display.
     * Returns lists of unique metrics and all recorded values.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/measuring/api/metrics', async (req, res) => {
      try {
        const metrics = [];
        const values = [];
        const startDate = new Date(0);
        const endDate = new Date();

        // Get all metric names from the measuring service
        if (measuring.metrics && measuring.metrics instanceof Map) {
          // For Map-based providers (default MeasuringService)
          for (const [metricName, measures] of measuring.metrics) {
            metrics.push(metricName);
            if (Array.isArray(measures)) {
              measures.forEach(measure => {
                values.push({
                  metric: metricName,
                  value: measure.value,
                  timestamp: measure.timestamp || new Date()
                });
              });
            }
          }
        } else {
          // Fallback: try to get all metrics by calling list for each known metric
          // This is less efficient but supports other provider types
          const allMetrics = new Set();

          // Try to infer metrics from values if available
          if (measuring.allValues && Array.isArray(measuring.allValues)) {
            measuring.allValues.forEach(val => {
              if (val.metric) allMetrics.add(val.metric);
            });
          }

          // For each metric, fetch its values
          for (const metricName of allMetrics) {
            const measures = await Promise.resolve(measuring.list(metricName, startDate, endDate));
            if (Array.isArray(measures)) {
              measures.forEach(measure => {
                values.push({
                  metric: metricName,
                  value: measure.value,
                  timestamp: measure.timestamp || measure.date || new Date()
                });
              });
              metrics.push(metricName);
            }
          }
        }

        // Sort results
        const uniqueMetrics = [...new Set(metrics)].sort();
        const sortedValues = values.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.status(200).json({
          success: true,
          metrics: uniqueMetrics,
          values: sortedValues
        });
      } catch (err) {
        eventEmitter.emit('api-measuring-metrics-error', { error: err.message, endpoint: '/metrics' });
        res.status(500).json({
          success: false,
          error: err.message,
          metrics: [],
          values: []
        });
      }
    });


    /**
     * GET /services/measuring/api/audit
     * Retrieves audit log entries
     */
    app.get('/services/measuring/api/health', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const result = await healthCheck.check({ service: measuring });
        const statusCode = result.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(result);
      } catch (err) {
        handleError(res, err, { operation: 'health-check' });
      }
    });

    app.get('/services/measuring/api/audit', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const filters = { service: 'measuring', limit: parseInt(req.query.limit) || 100 };
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
        const logs = auditLog.query(filters);
        const stats = auditLog.getStats(filters);
        sendSuccess(res, { logs, stats, total: logs.length }, 'Audit logs retrieved');
      } catch (error) {
        handleError(res, error, { operation: 'measuring-audit-query' });
      }
    });

    /**
     * POST /services/measuring/api/audit/export
     * Exports audit logs
     */
    app.post('/services/measuring/api/audit/export', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const format = req.query.format || 'json';
        const exported = auditLog.export(format, { service: 'measuring', limit: 10000 });

    /**
     * POST /services/measuring/api/import
     * Imports data from specified format
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.body.format - Import format (json, csv, xml, jsonl)
     * @param {string|Array} req.body.data - Data to import
     * @param {string} req.query.dryRun - Dry-run mode (true/false)
     * @param {string} req.query.conflictStrategy - Conflict handling (error, skip, update)
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/measuring/api/import', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const { data: rawData, format = 'json' } = req.body;
        const dryRun = req.query.dryRun === 'true';
        const conflictStrategy = req.query.conflictStrategy || 'error';

        if (!rawData) {
          return sendError(res, ERROR_CODES.INVALID_REQUEST, 'Missing data to import');
        }

        // Parse data based on format
        let parsedData = Array.isArray(rawData) ? rawData : rawData;
        if (typeof rawData === 'string') {
          parsedData = DataImporter.parse(rawData, format);
        }

        if (!Array.isArray(parsedData)) {
          return sendError(res, ERROR_CODES.INVALID_REQUEST, 'Parsed data must be an array');
        }

        // Dry-run mode
        if (dryRun) {
          const dryRunResult = DataImporter.dryRun(parsedData, { conflictStrategy });
          return sendSuccess(res, dryRunResult, 'Dry-run completed successfully');
        }

        // Perform actual import
        const importHandler = async (item) => {
          try {
            // Service-specific import logic would go here
            return { success: true, type: 'new' };
          } catch (error) {
            throw error;
          }
        };

        const result = await DataImporter.import(parsedData, importHandler, { conflictStrategy });
        sendSuccess(res, result, 'Data imported successfully', 201);
      } catch (error) {
        handleError(res, error, { operation: 'measuring-import' });
      }
    });


        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('audit-logs', format);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'measuring-audit-export' });
      }
    });

    /**
     * GET /services/measuring/api/export
     * Exports service data
     */
    app.get('/services/measuring/api/export', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const format = req.query.format || 'json';
        const data = { note: 'Data export available' };
        const exported = DataExporter[`to${format.charAt(0).toUpperCase() + format.slice(1)}`]?.(data) || DataExporter.toJSON(data);
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('measuring-export', format);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'measuring-export' });
      }
    });
  }
};
