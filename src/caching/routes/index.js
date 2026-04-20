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

    // Serve static files from the views directory for caching service
    app.use('/services/caching/api/swagger', express.static(path.join(__dirname,'swagger')));

    // Advise that we have loaded routes
    eventEmitter.emit('cache:loading routes', {
      folder: path.join(__dirname),
    });

  }
};
