/**
 * @fileoverview Logging API routes for Express.js application.
 * Provides RESTful endpoints for structured logging operations including
 * info, warning, error level logging, and service status monitoring.
 *
 * Supports multiple named instances of logging service through optional
 * instance parameter in URL paths.
 *
 * @author NooblyJS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Gets the appropriate logger instance based on instance name
 * Falls back to the provided default logger if no instance name is specified
 *
 * @param {string} instanceName - Optional instance name
 * @param {Object} defaultLogger - Default logger instance
 * @param {Object} options - Options containing service registry reference
 * @param {string} providerType - Provider type for the logging service
 * @returns {Object} Logger instance to use
 */
function getLoggerInstance(instanceName, defaultLogger, options, providerType = 'memory') {
  if (!instanceName || instanceName === 'default') {
    return defaultLogger;
  }

  // Try to get from service registry if available
  const ServiceRegistry = options.ServiceRegistry;
  if (ServiceRegistry) {
    const instance = ServiceRegistry.getServiceInstance('logging', providerType, instanceName);
    if (instance) {
      return instance;
    }
  }

  // If not found, return default
  return defaultLogger;
}

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
        const message = req.body;
        if (message) {
          try {
            await logger.info(message);
            res.status(200).send('OK');
          } catch (err) {
            eventEmitter.emit('api-logging-info-error', err.message);
            res.status(500).send(err.message);
          }
        } else {
          res.status(400).send('Bad Request: Missing message');
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
      const loggerInstance = getLoggerInstance(instanceName, logger, options, providerType);
      createInfoHandler(loggerInstance)(req, res);
    });

    /**
     * Creates an async handler for warning level logging
     * @param {Object} logger - Logger instance
     * @returns {Function} Express middleware function
     */
    const createWarnHandler = (logger) => {
      return async (req, res) => {
        const message = req.body;
        if (message) {
          try {
            await logger.warn(message);
            res.status(200).send('OK');
          } catch (err) {
            eventEmitter.emit('api-logging-warn-error', err.message);
            res.status(500).send(err.message);
          }
        } else {
          res.status(400).send('Bad Request: Missing message');
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
      const loggerInstance = getLoggerInstance(instanceName, logger, options, providerType);
      createWarnHandler(loggerInstance)(req, res);
    });

    /**
     * Creates an async handler for error level logging
     * @param {Object} logger - Logger instance
     * @returns {Function} Express middleware function
     */
    const createErrorHandler = (logger) => {
      return async (req, res) => {
        const message = req.body;
        if (message) {
          try {
            await logger.error(message);
            res.status(200).send('OK');
          } catch (err) {
            eventEmitter.emit('api-logging-error-error', err.message);
            res.status(500).send(err.message);
          }
        } else {
          res.status(400).send('Bad Request: Missing message');
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
      const loggerInstance = getLoggerInstance(instanceName, logger, options, providerType);
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
      res.status(200).json('logging api running');
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
      const loggerInstance = getLoggerInstance(instanceName, logger, options, providerType);
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
      const loggerInstance = getLoggerInstance(instanceName, logger, options, providerType);
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
      const loggerInstance = getLoggerInstance(instanceName, logger, options, providerType);
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
          res.status(200).send('OK');
        } catch (err) {
          eventEmitter.emit('api-logging-settings-save-error', err.message);
          res.status(500).send(err.message);
        }
      } else {
        res.status(400).send('Bad Request: Missing settings');
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
  }
};
