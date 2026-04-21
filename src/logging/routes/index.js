/**
 * @fileoverview Logging API routes for Express.js application.
 * Provides RESTful endpoints for structured logging operations including
 * info, warning, error level logging, and service status monitoring.
 *
 * Supports multiple named instances of logging service through optional
 * instance parameter in URL paths.
 *
 * @author Noobly JS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getServiceInstance } = require('../../appservice/utils/routeUtils');
const AuditLog = require('../../appservice/modules/auditLog');
const DataExporter = require('../../appservice/utils/exportUtils');
const DataImporter = require('../../appservice/utils/importUtils');
const { HealthCheck } = require('../../appservice/utils/healthCheck');
const { sendSuccess, sendError, sendStatus, sendList, ERROR_CODES, handleError } = require('../../appservice/utils/responseUtils');

/**
 * Configures and registers logging routes with the Express application.
 * Sets up endpoints for different log levels and service monitoring.
 * Supports both default routes and instance-specific routes.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} options.ServiceRegistry - ServiceRegistry singleton for instance lookup
 * @param {string} options.instanceName - Current instance name
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} logger - The logging provider instance with level methods
 * @param {Object} analytics - The analytics module instance for log retrieval
 * @return {void}
 */
module.exports = (options, eventEmitter, logger, analytics) => {
  if (options['express-app'] && logger) {
    const app = options['express-app'];
    const currentInstanceName = options.instanceName || 'default';
    const ServiceRegistry = options.ServiceRegistry;
    const providerType = options.providerType || 'memory';
    const authMiddleware = options.authMiddleware;

    // Initialize audit logging for logging service
    const auditLog = new AuditLog({ maxEntries: 5000, retention: { days: 90 } });
    const healthCheck = new HealthCheck('logging', { dependencies: [] });

    /**
     * GET /services/logging/scripts
     * Serves the client-side JavaScript library for consuming the logging service API
     * Allows front-end applications to log messages to the logging service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/scripts', (req, res) => {
      try {
        const scriptPath = path.join(__dirname, '..', 'scripts', 'client.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        res.setHeader('Content-Type', 'application/javascript');
        res.status(200).send(scriptContent);
        eventEmitter.emit('api-logging-scripts-served', 'Logging script library served');
      } catch (error) {
        eventEmitter.emit('api-logging-scripts-error', error.message);
        res.status(500).json({
          success: false,
          error: 'Failed to load script library',
          message: error.message
        });
      }
    });

    /**
     * Creates an async handler for info level logging
     * @param {Object} logger - Logger instance
     * @returns {Function} Express middleware function
     */
    const createInfoHandler = (logger) => {
      return async (req, res) => {
        const { message, meta } = req.body;
        if (message) {
          try {
            await logger.info(message, meta);
            res.status(200).json({ success: true });
          } catch (err) {
            eventEmitter.emit('api-logging-info-error', err.message);
            res.status(500).json({ error: err.message });
          }
        } else {
          res.status(400).json({ error: 'Bad Request: Missing message' });
        }
      };
    };

    /**
     * POST /services/logging/api/info
     * Logs an informational message through the logging system.
     *
     * @param {express.Request} req - Express request object
     * @param {*} req.body - The message to log at info level
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/logging/api/info', createInfoHandler(logger));

    /**
     * POST /services/logging/api/:instanceName/info
     * Logs an informational message to a named logger instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The logger instance name
     * @param {*} req.body - The message to log at info level
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/logging/api/:instanceName/info', (req, res) => {
      const instanceName = req.params.instanceName;
      const loggerInstance = getServiceInstance('logging', instanceName, logger, options, providerType);
      createInfoHandler(loggerInstance)(req, res);
    });

    /**
     * Creates an async handler for warning level logging
     * @param {Object} logger - Logger instance
     * @returns {Function} Express middleware function
     */
    const createWarnHandler = (logger) => {
      return async (req, res) => {
        const { message, meta } = req.body;
        if (message) {
          try {
            await logger.warn(message, meta);
            res.status(200).json({ success: true });
          } catch (err) {
            eventEmitter.emit('api-logging-warn-error', err.message);
            res.status(500).json({ error: err.message });
          }
        } else {
          res.status(400).json({ error: 'Bad Request: Missing message' });
        }
      };
    };

    /**
     * POST /services/logging/api/warn
     * Logs a warning message through the logging system.
     *
     * @param {express.Request} req - Express request object
     * @param {*} req.body - The message to log at warning level
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/logging/api/warn', createWarnHandler(logger));

    /**
     * POST /services/logging/api/:instanceName/warn
     * Logs a warning message to a named logger instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The logger instance name
     * @param {*} req.body - The message to log at warning level
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/logging/api/:instanceName/warn', (req, res) => {
      const instanceName = req.params.instanceName;
      const loggerInstance = getServiceInstance('logging', instanceName, logger, options, providerType);
      createWarnHandler(loggerInstance)(req, res);
    });

    /**
     * Creates an async handler for error level logging
     * @param {Object} logger - Logger instance
     * @returns {Function} Express middleware function
     */
    const createErrorHandler = (logger) => {
      return async (req, res) => {
        const { message, meta } = req.body;
        if (message) {
          try {
            await logger.error(message, meta);
            res.status(200).json({ success: true });
          } catch (err) {
            eventEmitter.emit('api-logging-error-error', err.message);
            res.status(500).json({ error: err.message });
          }
        } else {
          res.status(400).json({ error: 'Bad Request: Missing message' });
        }
      };
    };

    /**
     * POST /services/logging/api/error
     * Logs an error message through the logging system.
     *
     * @param {express.Request} req - Express request object
     * @param {*} req.body - The message to log at error level
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/logging/api/error', createErrorHandler(logger));

    /**
     * POST /services/logging/api/:instanceName/error
     * Logs an error message to a named logger instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The logger instance name
     * @param {*} req.body - The message to log at error level
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/logging/api/:instanceName/error', (req, res) => {
      const instanceName = req.params.instanceName;
      const loggerInstance = getServiceInstance('logging', instanceName, logger, options, providerType);
      createErrorHandler(loggerInstance)(req, res);
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
      sendStatus(res, 'logging api running', { provider: providerType, instance: currentInstanceName });
    });

    /**
     * GET /services/logging/api/instances
     * Returns a list of all available logging service instances.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/api/instances', (req, res) => {
      try {
        const instances = [];

        // Add the default instance
        instances.push({
          name: 'default',
          provider: providerType,
          status: 'active'
        });

        // Get additional instances from ServiceRegistry if available
        if (ServiceRegistry) {
          const additionalInstances = ServiceRegistry.listInstances('logging');
          if (additionalInstances && Array.isArray(additionalInstances)) {
            additionalInstances.forEach(instance => {
              // Skip the default instance to avoid duplication
              if (instance.instanceName !== 'default') {
                instances.push({
                  name: instance.instanceName,
                  provider: instance.providerType,
                  status: 'active'
                });
              }
            });
          }
        }

        eventEmitter.emit('api-logging-instances', `retrieved ${instances.length} instances`);
        res.status(200).json({
          success: true,
          instances: instances,
          total: instances.length
        });
      } catch (error) {
        eventEmitter.emit('api-logging-instances-error', error.message);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Helper function to create logs handler
    const createLogsHandler = (analytics) => {
      return (req, res) => {
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
      };
    };

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
    app.get('/services/logging/api/logs', createLogsHandler(analytics));

    /**
     * GET /services/logging/api/:instanceName/logs
     * Retrieves the last 1000 logs from a named logger instance's analytics.
     * Optional query parameter 'level' can filter by log level.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The logger instance name
     * @param {string} req.query.level - Optional log level filter (case-insensitive)
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/api/:instanceName/logs', (req, res) => {
      const instanceName = req.params.instanceName;
      // Note: In a real scenario, you'd get the analytics for that specific instance
      // For now, we retrieve the instance and its analytics property if it exists
      const loggerInstance = getServiceInstance('logging', instanceName, logger, options, providerType);
      const instanceAnalytics = loggerInstance.analytics || analytics;
      createLogsHandler(instanceAnalytics)(req, res);
    });

    // Helper function to create stats handler
    const createStatsHandler = (analytics) => {
      return (req, res) => {
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
      };
    };

    /**
     * GET /services/logging/api/stats
     * Retrieves statistics about log levels including counts and percentages.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/api/stats', createStatsHandler(analytics));

    /**
     * GET /services/logging/api/:instanceName/stats
     * Retrieves statistics about log levels from a named logger instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The logger instance name
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/api/:instanceName/stats', (req, res) => {
      const instanceName = req.params.instanceName;
      const loggerInstance = getServiceInstance('logging', instanceName, logger, options, providerType);
      const instanceAnalytics = loggerInstance.analytics || analytics;
      createStatsHandler(instanceAnalytics)(req, res);
    });

    // Helper function to create timeline handler
    const createTimelineHandler = (analytics) => {
      return (req, res) => {
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
      };
    };

    /**
     * GET /services/logging/api/timeline
     * Retrieves timeline data showing log activity per minute for each log level.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/api/timeline', createTimelineHandler(analytics));

    /**
     * GET /services/logging/api/:instanceName/timeline
     * Retrieves timeline data from a named logger instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The logger instance name
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/api/:instanceName/timeline', (req, res) => {
      const instanceName = req.params.instanceName;
      const loggerInstance = getServiceInstance('logging', instanceName, logger, options, providerType);
      const instanceAnalytics = loggerInstance.analytics || analytics;
      createTimelineHandler(instanceAnalytics)(req, res);
    });

    /**
     * GET /services/logging/api/settings
     * Retrieves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/api/settings', async (req, res) => {
      try {
        const settings = await logger.getSettings();
        res.status(200).json(settings);
      } catch (err) {
        eventEmitter.emit('api-logging-settings-error', err.message);
        res.status(500).json({
          error: 'Failed to retrieve settings',
          message: err.message
        });
      }
    });

    /**
     * POST /services/logging/api/settings
     * Saves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/logging/api/settings', async (req, res) => {
      const message = req.body;
      if (message) {
        try {
          await logger.saveSettings(message);
          eventEmitter.emit('api-logging-settings-saved', { timestamp: Date.now() });
          res.status(200).json({ success: true });
        } catch (err) {
          eventEmitter.emit('api-logging-settings-save-error', err.message);
          res.status(500).json({ error: err.message });
        }
      } else {
        res.status(400).json({ error: 'Bad Request: Missing settings' });
      }
    });

    /**
     * GET /services/logging/api/swagger/docs.json
     * Returns the OpenAPI/Swagger specification for the Logging Service API.
     * Used by Swagger UI and other API documentation tools.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/logging/api/swagger/docs.json', (req, res) => {
      try {
        const swaggerPath = path.join(__dirname, 'swagger', 'docs.json');
        const swaggerContent = fs.readFileSync(swaggerPath, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(swaggerContent);
        eventEmitter.emit('api-logging-swagger-docs-served', 'Swagger documentation served');
      } catch (error) {
        eventEmitter.emit('api-logging-swagger-docs-error', error.message);
        res.status(500).json({
          success: false,
          error: 'Failed to load Swagger documentation',
          message: error.message
        });
      }
    });

    /**
     * GET /services/logging/api/health
     * Returns health status of the logging service.
     */
    app.get('/services/logging/api/health', async (req, res) => {
      try {
        const result = await healthCheck.check({ service: logger });
        const statusCode = result.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(result);
      } catch (err) {
        handleError(res, err, { operation: 'health-check' });
      }
    });

    /**
     * GET /services/logging/api/audit
     * Retrieves audit log entries for logging service operations
     */
    app.get('/services/logging/api/audit', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const filters = {
          service: 'logging',
          limit: parseInt(req.query.limit) || 100,
          operation: req.query.operation,
          status: req.query.status
        };
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
        const logs = auditLog.query(filters);
        const stats = auditLog.getStats(filters);
        sendSuccess(res, { logs, stats, total: logs.length }, 'Audit logs retrieved successfully');
      } catch (error) {
        handleError(res, error, { operation: 'logging-audit-query' });
      }
    });

    /**
     * POST /services/logging/api/audit/export
     * Exports audit logs in specified format
     */
    app.post('/services/logging/api/audit/export', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const format = req.query.format || 'json';
        const exported = auditLog.export(format, { service: 'logging', limit: 10000 });

    /**
     * POST /services/logging/api/import
     * Imports data from specified format
     *
     * @param {{express.Request}} req - Express request object
     * @param {{string}} req.body.format - Import format (json, csv, xml, jsonl)
     * @param {{string|Array}} req.body.data - Data to import
     * @param {{string}} req.query.dryRun - Dry-run mode (true/false)
     * @param {{string}} req.query.conflictStrategy - Conflict handling (error, skip, update)
     * @param {{express.Response}} res - Express response object
     * @return {{void}}
     */
    app.post('/services/logging/api/import', authMiddleware || ((req, res, next) => next()), async (req, res) => {
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
        handleError(res, error, { operation: 'logging-import' });
      }
    });


        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('audit-logs', format);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'logging-audit-export' });
      }
    });

    /**
     * GET /services/logging/api/export
     * Exports logging data in specified format
     */
    app.get('/services/logging/api/export', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const format = req.query.format || 'json';
        const data = analytics ? analytics.getAllLogs() : { note: 'Logs not available' };
        const exported = DataExporter[`to${format.charAt(0).toUpperCase() + format.slice(1)}`]?.(data) || DataExporter.toJSON(data);
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('logs-export', format);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'logging-export' });
      }
    });
  }
};
