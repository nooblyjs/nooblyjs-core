/**
 * @fileoverview Caching API routes for Express.js application.
 * Provides RESTful endpoints for cache operations including put, get, delete,
 * status monitoring, and analytics retrieval.
 *
 * Supports multiple named instances of caching service through optional
 * instance parameter in URL paths.
 *
 * @author NooblyJS Core Team
 * @version 1.0.15
 * @since 1.0.0
 */

'use strict';

/**
 * Gets the appropriate cache instance based on instance name
 * Falls back to the provided default cache if no instance name is specified
 *
 * @param {string} instanceName - Optional instance name
 * @param {Object} defaultCache - Default cache instance
 * @param {Object} options - Options containing service registry reference
 * @param {string} providerType - Provider type for the cache service
 * @returns {Object} Cache instance to use
 */
function getCacheInstance(instanceName, defaultCache, options, providerType = 'memory') {
  if (!instanceName || instanceName === 'default') {
    return defaultCache;
  }

  // Try to get from service registry if available
  const ServiceRegistry = options.ServiceRegistry;
  if (ServiceRegistry) {
    const instance = ServiceRegistry.getServiceInstance('caching', providerType, instanceName);
    if (instance) {
      return instance;
    }
  }

  // If not found, return default
  return defaultCache;
}

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
          res.status(200).send('OK');
        } catch (err) {
          res.status(500).send(err.message);
        }
      };
    };

    /**
     * PUT /services/caching/api/put/:key
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
     * PUT /services/caching/api/:instanceName/put/:key
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
        const cacheInstance = getCacheInstance(instanceName, cache, options, providerType);
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
          res.status(200).json(value);
        } catch (err) {
          res.status(500).send(err.message);
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
        const cacheInstance = getCacheInstance(instanceName, cache, options, providerType);
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
          res.status(200).send('OK');
        } catch (err) {
          res.status(500).send(err.message);
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
        const cacheInstance = getCacheInstance(instanceName, cache, options, providerType);
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
      res.status(200).json('caching api running');
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
        res.status(200).json({
          success: true,
          instances: instances,
          total: instances.length
        });
      } catch (error) {
        eventEmitter.emit('api-cache-instances-error', error.message);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Helper function to create list handler
    const createListHandler = (cache) => {
      return (req, res) => {
        try {
          const analytics = cache.getAnalytics ? cache.getAnalytics() : [];
          eventEmitter.emit('api-cache-list',
              `retrieved ${analytics.length} analytics entries`);
          res.status(200).json({
            success: true,
            data: analytics,
            total: analytics.length,
          });
        } catch (err) {
          eventEmitter.emit('api-cache-list-error', err.message);
          res.status(500).json({
            success: false,
            error: err.message,
          });
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
        const cacheInstance = getCacheInstance(instanceName, cache, options, providerType);
        createListHandler(cacheInstance)(req, res);
      }
    );

    // Helper function to create analytics handler
    const createAnalyticsHandler = (cache) => {
      return async (req, res) => {
        try {
          if (!cache.analytics) {
            return res.status(503).json({ error: 'Analytics not available' });
          }

          const stats = cache.analytics.getStats();
          const hitDistribution = cache.analytics.getHitDistribution(50);
          const timeline = cache.analytics.getTimeline(10);
          const keyList = cache.analytics.getKeyList(100);
          const topMisses = cache.analytics.getTopMisses(50);

          res.status(200).json({
            stats: stats,
            hitDistribution: hitDistribution,
            timeline: timeline,
            keyList: keyList,
            topMisses: topMisses
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
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
        const cacheInstance = getCacheInstance(instanceName, cache, options, providerType);
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
        res.status(200).json(settings);
      } catch (err) {
        eventEmitter.emit('api-cache-settings-error', err.message);
        res.status(500).json({
          error: 'Failed to retrieve settings',
          message: err.message
        });
      }
    });

     /**
     * POST /services/caching/api/settings
     * Retrieves the settings
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
          res.status(200).send('OK');
        } catch (err) {
          res.status(500).send(err.message);
        }
      } else {
        res.status(400).send('Bad Request: Missing settings');
      }
    });

    /**
     * GET /services/caching/scriptlibrary
     * Serves the client-side caching library as JavaScript
     * This endpoint returns the nooblyjsCaching library for use in web applications.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     * @example
     * // Include in HTML:
     * <script src="/services/caching/scriptlibrary"></script>
     *
     * // Use in JavaScript:
     * const cache = new nooblyjsCaching({ instanceName: 'default' });
     * cache.put('key', { data: 'value' });
     * cache.get('key').then(data => console.log(data));
     */
    app.get('/services/caching/scriptlibrary', (req, res) => {
      const fs = require('fs');
      const path = require('path');

      try {
        // Read the client library file
        const libraryPath = path.join(__dirname, '../scriptlibrary/index.js');
        const libraryCode = fs.readFileSync(libraryPath, 'utf8');

        // Set appropriate headers for JavaScript
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.setHeader('X-Content-Type-Options', 'nosniff');

        res.status(200).send(libraryCode);
      } catch (error) {
        eventEmitter.emit('api-caching-scriptlibrary-error', error.message);
        res.status(500).json({
          error: 'Failed to load caching library',
          message: error.message
        });
      }
    });

    /**
     * GET /services/caching/scriptlibrary/test
     * Serves the interactive test page for the caching library
     * Provides a user-friendly interface for testing all caching operations.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     * @example
     * // Visit in browser:
     * // http://localhost:3001/services/caching/scriptlibrary/test
     */
    app.get('/services/caching/scriptlibrary/test', (req, res) => {
      const fs = require('fs');
      const path = require('path');

      try {
        // Read the test HTML file
        const testPath = path.join(__dirname, '../scriptlibrary/test.html');
        const testHTML = fs.readFileSync(testPath, 'utf8');

        // Set appropriate headers for HTML
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.setHeader('X-Content-Type-Options', 'nosniff');

        res.status(200).send(testHTML);
      } catch (error) {
        eventEmitter.emit('api-caching-scriptlibrary-test-error', error.message);
        res.status(500).json({
          error: 'Failed to load caching library test page',
          message: error.message
        });
      }
    });
  }
};
