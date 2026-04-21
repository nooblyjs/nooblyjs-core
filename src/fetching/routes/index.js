/**
 * @fileoverview Fetching API routes for Express.js application.
 * Provides RESTful endpoints for fetch operations including fetch,
 * status monitoring, and analytics retrieval.
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const AuditLog = require('../../appservice/modules/auditLog');
const DataExporter = require('../../appservice/utils/exportUtils');
const DataImporter = require('../../appservice/utils/importUtils');
const { HealthCheck } = require('../../appservice/utils/healthCheck');
const { sendSuccess, sendError, sendStatus, ERROR_CODES, handleError } = require('../../appservice/utils/responseUtils');

/**
 * Configures and registers fetching routes with the Express application.
 * Sets up endpoints for fetch operations and monitoring.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} fetching - The fetching provider instance with fetch method
 * @return {void}
 */
module.exports = (options, eventEmitter, fetching) => {
  if (options['express-app'] && fetching) {
    const app = options['express-app'];
    const authMiddleware = options.authMiddleware;

    // Initialize audit logging for fetching service
    const auditLog = new AuditLog({ maxEntries: 5000, retention: { days: 90 } });
    const healthCheck = new HealthCheck('fetching', { dependencies: [] });

    /**
     * POST /services/fetching/api/fetch
     * Fetches a URL with optional caching and deduplication.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.body.url - The URL to fetch
     * @param {Object} req.body.options - Optional fetch options
     * @param {string} req.body.options.method - HTTP method (default: 'GET')
     * @param {Object|string} req.body.options.body - Request body
     * @param {Object} req.body.options.headers - Request headers
     * @param {Object} req.body.options.next - Cache options
     * @param {string} req.body.options.cache - Cache control
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/fetching/api/fetch',
      authMiddleware || ((req, res, next) => next()),
      async (req, res) => {
        try {
          const { url, options = {} } = req.body;

          if (!url) {
            return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'URL is required', {});
          }

          const response = await fetching.fetch(url, options);

          sendSuccess(res, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
          }, 'Fetch completed successfully');
        } catch (error) {
          eventEmitter.emit('api-fetching-error', error.message);
          handleError(res, error, { operation: 'fetch', url: req.body.url });
        }
      }
    );

    /**
     * GET /services/fetching/api/fetch/:url
     * Simple GET fetch endpoint (URL passed as base64 in URL parameter).
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.url - Base64 encoded URL
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/fetching/api/fetch/:url',
      authMiddleware || ((req, res, next) => next()),
      async (req, res) => {
        try {
          // Decode base64 URL
          const url = Buffer.from(req.params.url, 'base64').toString('utf-8');

          const response = await fetching.fetch(url);

          sendSuccess(res, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
          }, 'Fetch completed successfully');
        } catch (error) {
          eventEmitter.emit('api-fetching-error', error.message);
          handleError(res, error, { operation: 'fetch-by-url', url: req.params.url });
        }
      }
    );

    /**
     * GET /services/fetching/api/status
     * Returns the operational status of the fetching service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/fetching/api/status', (req, res) => {
      eventEmitter.emit('api-fetching-status', 'fetching api running');
      sendStatus(res, 'fetching api running');
    });

    /**
     * GET /services/fetching/api/analytics
     * Returns comprehensive analytics data for fetch operations.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/fetching/api/analytics', async (req, res) => {
      try {
        if (!fetching.analytics) {
          return sendError(res, ERROR_CODES.SERVICE_UNAVAILABLE, 'Analytics not available', {}, 503);
        }

        const stats = fetching.analytics.getStats();
        const urlDistribution = fetching.analytics.getUrlDistribution(50);
        const timeline = fetching.analytics.getTimeline(10);
        const urlList = fetching.analytics.getUrlList(100);
        const topErrors = fetching.analytics.getTopErrors(50);

        sendSuccess(res, {
          stats,
          urlDistribution,
          timeline,
          urlList,
          topErrors
        }, 'Analytics retrieved successfully');
      } catch (error) {
        handleError(res, error, { operation: 'fetch-analytics' });
      }
    });

    /**
     * GET /services/fetching/api/list
     * Retrieves analytics data for fetch operations.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/fetching/api/list', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        if (!fetching.getAnalytics) {
          return sendError(res, ERROR_CODES.SERVICE_UNAVAILABLE, 'Analytics not available', {}, 503);
        }

        const analytics = fetching.getAnalytics();
        eventEmitter.emit('api-fetching-list',
            `retrieved ${analytics.length} analytics entries`);
        sendSuccess(res, analytics, `Retrieved ${analytics.length} analytics entries`);
      } catch (err) {
        eventEmitter.emit('api-fetching-list-error', err.message);
        handleError(res, err, { operation: 'fetch-analytics-list' });
      }
    });

    /**
     * GET /services/fetching/api/settings
     * Retrieves the fetching service settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/fetching/api/settings', async (req, res) => {
      try {
        const settings = await fetching.getSettings();
        sendSuccess(res, settings, 'Settings retrieved successfully');
      } catch (err) {
        handleError(res, err, { operation: 'fetch-get-settings' });
      }
    });

    /**
     * POST /services/fetching/api/settings
     * Updates the fetching service settings
     *
     * @param {express.Request} req - Express request object
     * @param {Object} req.body - New settings
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/fetching/api/settings', async (req, res) => {
      const settings = req.body;
      if (!settings || Object.keys(settings).length === 0) {
        return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Missing settings in request body', {});
      }
      try {
        await fetching.saveSettings(settings);
        sendSuccess(res, {}, 'Settings saved successfully');
      } catch (err) {
        handleError(res, err, { operation: 'fetch-save-settings' });
      }
    });

    /**
     * DELETE /services/fetching/api/cache
     * Clears the fetch cache
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete('/services/fetching/api/cache', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        if (!fetching.clear) {
          return sendError(res, ERROR_CODES.SERVICE_UNAVAILABLE, 'Cache clear not available', {}, 503);
        }
        await fetching.clear();
        sendSuccess(res, {}, 'Cache cleared successfully');
      } catch (err) {
        handleError(res, err, { operation: 'fetch-clear-cache' });
      }
    });

    /**
     * GET /services/fetching/api/health
     * Returns health status of the fetching service.
     */
    app.get('/services/fetching/api/health', async (req, res) => {
      try {
        const result = await healthCheck.check({ service: fetching });
        const statusCode = result.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(result);
      } catch (err) {
        handleError(res, err, { operation: 'health-check' });
      }
    });

    /**
     * GET /services/fetching/api/audit
     * Retrieves audit log entries for fetching operations
     */
    app.get('/services/fetching/api/audit', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const filters = {
          service: 'fetching',
          limit: parseInt(req.query.limit) || 100,
          operation: req.query.operation,
          status: req.query.status,
          userId: req.query.userId
        };

        Object.keys(filters).forEach(key =>
          filters[key] === undefined && delete filters[key]
        );

        const logs = auditLog.query(filters);
        const stats = auditLog.getStats(filters);

        sendSuccess(res, { logs, stats, total: logs.length }, 'Audit logs retrieved successfully');
      } catch (error) {
        handleError(res, error, { operation: 'fetching-audit-query' });
      }
    });

    /**
     * POST /services/fetching/api/audit/export
     * Exports audit logs in specified format
     */
    app.post('/services/fetching/api/audit/export', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const format = req.query.format || 'json';
        const filters = {
          service: 'fetching',
          limit: parseInt(req.query.limit) || 10000
        };

        const exported = auditLog.export(format, filters);
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('audit-logs', format);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'fetching-audit-export' });
      }
    });

    /**
     * GET /services/fetching/api/export
     * Exports fetching statistics in specified format
     */
    app.get('/services/fetching/api/export', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const format = req.query.format || 'json';
        const data = fetching.analytics ? fetching.analytics.getStats() : { note: 'Analytics not available' };

        const exported = DataExporter[`to${format.charAt(0).toUpperCase() + format.slice(1).toUpperCase()}`]?.(data) ||
                        DataExporter.toJSON(data);
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('fetch-stats-export', format);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'fetching-export' });
      }
    });

    /**
     * POST /services/fetching/api/import
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
    app.post('/services/fetching/api/import', authMiddleware || ((req, res, next) => next()), async (req, res) => {
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
        handleError(res, error, { operation: 'fetching-import' });
      }
    });
  }
};
