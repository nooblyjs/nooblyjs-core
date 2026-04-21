/**
 * @fileoverview Caching API routes for Express.js application.
 * Provides RESTful endpoints for cache operations including put, get, delete,
 * status monitoring, and analytics retrieval.
 *
 * Supports multiple named instances of caching service through optional
 * instance parameter in URL paths.
 *
 * @author Noobly JS Core Team
 * @version 1.0.15
 * @since 1.0.0
 */

'use strict';

const path = require('node:path');
const express = require('express');
const { getServiceInstance } = require('../../appservice/utils/routeUtils');
const AuditLog = require('../../appservice/modules/auditLog');
const DataExporter = require('../../appservice/utils/exportUtils');
const DataImporter = require('../../appservice/utils/importUtils');
const BulkOperations = require('../../appservice/utils/bulkOperations');
const HealthCheck = require('../../appservice/utils/healthCheck');
const { sendSuccess, sendError, sendStatus, ERROR_CODES, handleError } = require('../../appservice/utils/responseUtils');

/**
 * Configures and registers caching routes with the Express application.
 * Sets up endpoints for cache management and monitoring operations.
 * Supports both default routes and instance-specific routes.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} options.ServiceRegistry - ServiceRegistry singleton for instance lookup
 * @param {string} options.instanceName - Current instance name
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} cache - The caching provider instance with put/get/delete methods
 * @return {void}
 */
module.exports = (options, eventEmitter, cache) => {
  if (options['express-app'] && cache) {
    const app = options['express-app'];
    const authMiddleware = options.authMiddleware;
    const currentInstanceName = options.instanceName || 'default';
    const ServiceRegistry = options.ServiceRegistry;
    const providerType = options.providerType || 'memory';

    // Initialize audit logging for caching service
    const auditLog = new AuditLog({ maxEntries: 5000, retention: { days: 90 } });
    const healthCheck = new HealthCheck('caching', { dependencies: [] });

    /**
     * Helper function to create put handler
     * @param {Object} cache - Cache instance
     * @returns {Function} Express route handler
     */
    const createPutHandler = (cache) => {
      return async (req, res) => {
        const key = req.params.key;
        const value = req.body;
        try {
          await cache.put(key, value);
          sendSuccess(res, { key });
        } catch (err) {
          handleError(res, err, 'putCache');
        }
      };
    };

    /**
     * POST /services/caching/api/put/:key
     * Stores a value in the cache with the specified key.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.key - The cache key to store the value under
     * @param {*} req.body - The value to store in the cache
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/caching/api/put/:key',
      authMiddleware || ((req, res, next) => next()),
      createPutHandler(cache)
    );

    /**
     * POST /services/caching/api/:instanceName/put/:key
     * Stores a value in a named cache instance with the specified key.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The cache instance name
     * @param {string} req.params.key - The cache key to store the value under
     * @param {*} req.body - The value to store in the cache
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/caching/api/:instanceName/put/:key',
      authMiddleware || ((req, res, next) => next()),
      (req, res) => {
        const instanceName = req.params.instanceName;
        const cacheInstance = getServiceInstance('caching', instanceName, cache, options, providerType);
        createPutHandler(cacheInstance)(req, res);
      }
    );

    /**
     * Helper function to create get handler
     * @param {Object} cache - Cache instance
     * @returns {Function} Express route handler
     */
    const createGetHandler = (cache) => {
      return async (req, res) => {
        const key = req.params.key;
        try {
          const value = await cache.get(key);
          sendSuccess(res, { key, value });
        } catch (err) {
          handleError(res, err, 'getCache');
        }
      };
    };

    /**
     * GET /services/caching/api/get/:key
     * Retrieves a value from the cache by key.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.key - The cache key to retrieve
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/caching/api/get/:key',
      authMiddleware || ((req, res, next) => next()),
      createGetHandler(cache)
    );

    /**
     * GET /services/caching/api/:instanceName/get/:key
     * Retrieves a value from a named cache instance by key.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The cache instance name
     * @param {string} req.params.key - The cache key to retrieve
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/caching/api/:instanceName/get/:key',
      authMiddleware || ((req, res, next) => next()),
      (req, res) => {
        const instanceName = req.params.instanceName;
        const cacheInstance = getServiceInstance('caching', instanceName, cache, options, providerType);
        createGetHandler(cacheInstance)(req, res);
      }
    );

    /**
     * Helper function to create delete handler
     * @param {Object} cache - Cache instance
     * @returns {Function} Express route handler
     */
    const createDeleteHandler = (cache) => {
      return async (req, res) => {
        const key = req.params.key;
        try {
          await cache.delete(key);
          sendSuccess(res, { key });
        } catch (err) {
          handleError(res, err, 'deleteCache');
        }
      };
    };

    /**
     * DELETE /services/caching/api/delete/:key
     * Removes a value from the cache by key.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.key - The cache key to delete
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete(
      '/services/caching/api/delete/:key',
      authMiddleware || ((req, res, next) => next()),
      createDeleteHandler(cache)
    );

    /**
     * DELETE /services/caching/api/:instanceName/delete/:key
     * Removes a value from a named cache instance by key.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The cache instance name
     * @param {string} req.params.key - The cache key to delete
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete(
      '/services/caching/api/:instanceName/delete/:key',
      authMiddleware || ((req, res, next) => next()),
      (req, res) => {
        const instanceName = req.params.instanceName;
        const cacheInstance = getServiceInstance('caching', instanceName, cache, options, providerType);
        createDeleteHandler(cacheInstance)(req, res);
      }
    );

    /**
     * GET /services/caching/api/status
     * Returns the operational status of the caching service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/caching/api/status', (req, res) => {
      eventEmitter.emit('api-cache-status', 'caching api running');
      sendStatus(res, 'caching api running', { provider: providerType, instance: currentInstanceName });
    });

    /**
     * GET /services/caching/api/instances
     * Returns a list of all available caching service instances.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/caching/api/instances', (req, res) => {
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
          const additionalInstances = ServiceRegistry.listInstances('caching');
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

        eventEmitter.emit('api-cache-instances', `retrieved ${instances.length} instances`);
        sendSuccess(res, { instances, total: instances.length });
      } catch (error) {
        eventEmitter.emit('api-cache-instances-error', error.message);
        handleError(res, error, 'listInstances');
      }
    });

    // Helper function to create list handler
    const createListHandler = (cache) => {
      return (req, res) => {
        try {
          const analytics = cache.getAnalytics ? cache.getAnalytics() : [];
          eventEmitter.emit('api-cache-list',
              `retrieved ${analytics.length} analytics entries`);
          sendSuccess(res, { data: analytics, total: analytics.length });
        } catch (err) {
          eventEmitter.emit('api-cache-list-error', err.message);
          handleError(res, err, 'listAnalytics');
        }
      };
    };

    /**
     * GET /services/caching/api/list
     * Retrieves analytics data for cache operations including hit counts and access times.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/caching/api/list', authMiddleware || ((req, res, next) => next()), createListHandler(cache));

    /**
     * GET /services/caching/api/:instanceName/list
     * Retrieves analytics data for a named cache instance including hit counts and access times.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The cache instance name
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/caching/api/:instanceName/list',
      authMiddleware || ((req, res, next) => next()),
      (req, res) => {
        const instanceName = req.params.instanceName;
        const cacheInstance = getServiceInstance('caching', instanceName, cache, options, providerType);
        createListHandler(cacheInstance)(req, res);
      }
    );

    // Helper function to create analytics handler
    const createAnalyticsHandler = (cache) => {
      return async (req, res) => {
        try {
          if (!cache.analytics) {
            return sendStatus(res, 'Analytics not available', { available: false }, 503);
          }

          const stats = cache.analytics.getStats();
          const hitDistribution = cache.analytics.getHitDistribution(50);
          const timeline = cache.analytics.getTimeline(10);
          const keyList = cache.analytics.getKeyList(100);
          const topMisses = cache.analytics.getTopMisses(50);

          sendSuccess(res, {
            stats,
            hitDistribution,
            timeline,
            keyList,
            topMisses
          });
        } catch (error) {
          handleError(res, error, 'getAnalytics');
        }
      };
    };

    /**
     * GET /services/caching/api/analytics
     * Returns comprehensive analytics data for cache operations.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/caching/api/analytics', createAnalyticsHandler(cache));

    /**
     * GET /services/caching/api/:instanceName/analytics
     * Returns comprehensive analytics data for a named cache instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The cache instance name
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/caching/api/:instanceName/analytics',
      (req, res) => {
        const instanceName = req.params.instanceName;
        const cacheInstance = getServiceInstance('caching', instanceName, cache, options, providerType);
        createAnalyticsHandler(cacheInstance)(req, res);
      }
    );

    /**
     * GET /services/caching/api/settings
     * Retrieves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/caching/api/settings', async (req, res) => {
      try {
        const settings = await cache.getSettings();
        sendSuccess(res, settings);
      } catch (err) {
        eventEmitter.emit('api-cache-settings-error', err.message);
        handleError(res, err, 'getSettings');
      }
    });

     /**
     * POST /services/caching/api/settings
     * Updates the settings for the caching service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/caching/api/settings', async (req, res) => {
      const message = req.body;
      if (message) {
        try {
          await cache.saveSettings(message);
          sendSuccess(res, {}, 'Settings saved successfully');
        } catch (err) {
          handleError(res, err, 'saveSettings');
        }
      } else {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Settings are required');
      }
    });

    /**
     * POST /services/caching/api/bulk/delete
     * Deletes multiple cache keys in bulk.
     */
    app.post('/services/caching/api/bulk/delete', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const { keys, instanceName, dryRun } = req.body;
        if (!Array.isArray(keys) || keys.length === 0) {
          return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'keys must be a non-empty array');
        }
        const cacheInstance = instanceName ? getServiceInstance('caching', providerType, cache, { instanceName }, providerType) : cache;
        const result = await BulkOperations.execute(keys, async (key) => {
          await cacheInstance.remove(key);
          return { key, deleted: true };
        }, { dryRun: dryRun === true });
        sendSuccess(res, result, 'Bulk delete completed');
      } catch (err) {
        handleError(res, err, { operation: 'bulk-delete' });
      }
    });

    /**
     * POST /services/caching/api/bulk/update
     * Updates cache entries in bulk.
     */
    app.post('/services/caching/api/bulk/update', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const { items, instanceName, dryRun } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
          return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'items must be a non-empty array');
        }
        const cacheInstance = instanceName ? getServiceInstance('caching', providerType, cache, { instanceName }, providerType) : cache;
        const result = await BulkOperations.execute(items, async (item) => {
          await cacheInstance.set(item.key, item.value, item.ttl);
          return { key: item.key, updated: true };
        }, { dryRun: dryRun === true });
        sendSuccess(res, result, 'Bulk update completed');
      } catch (err) {
        handleError(res, err, { operation: 'bulk-update' });
      }
    });

    /**
     * GET /services/caching/api/health
     * Returns health status of the caching service.
     */
    app.get('/services/caching/api/health', async (req, res) => {
      try {
        const result = await healthCheck.check({ service: cache });
        const statusCode = result.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(result);
      } catch (err) {
        handleError(res, err, { operation: 'health-check' });
      }
    });

    /**
     * GET /services/caching/api/audit
     * Retrieves audit log entries for caching operations
     */
    app.get('/services/caching/api/audit', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const filters = {
          service: 'caching',
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
        handleError(res, error, { operation: 'caching-audit-query' });
      }
    });

    /**
     * POST /services/caching/api/audit/export
     * Exports audit logs in specified format
     */
    app.post('/services/caching/api/audit/export', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const format = req.query.format || 'json';
        const filters = {
          service: 'caching',
          limit: parseInt(req.query.limit) || 10000
        };

        const exported = auditLog.export(format, filters);
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('audit-logs', format);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'caching-audit-export' });
      }
    });

    /**
     * GET /services/caching/api/export
     * Exports cache statistics and keys in specified format
     */
    app.get('/services/caching/api/export', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const format = req.query.format || 'json';
        const data = cache.getStats ? await cache.getStats() : { note: 'Cache stats not available for this provider' };

        const exported = DataExporter[`to${format.charAt(0).toUpperCase() + format.slice(1).toUpperCase()}`]?.(data) ||
                        DataExporter.toJSON(data);
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('cache-export', format);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'caching-export' });
      }
    });

    /**
     * POST /services/caching/api/import
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
    app.post('/services/caching/api/import', authMiddleware || ((req, res, next) => next()), async (req, res) => {
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
        handleError(res, error, { operation: 'caching-import' });
      }
    });

    // Serve static files from the views directory for caching service
    app.use('/services/caching/api/swagger', express.static(path.join(__dirname,'swagger')));

    // Advise that we have loaded routes
    eventEmitter.emit('cache:loading routes', {
      folder: path.join(__dirname),
    });

  }
};
