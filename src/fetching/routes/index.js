/**
 * @fileoverview Fetching API routes for Express.js application.
 * Provides RESTful endpoints for fetch operations including fetch,
 * status monitoring, and analytics retrieval.
 *
 * @author NooblyJS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

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
            return res.status(400).json({
              success: false,
              error: 'URL is required'
            });
          }

          const response = await fetching.fetch(url, options);

          res.status(200).json({
            success: true,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
          });
        } catch (error) {
          eventEmitter.emit('api-fetching-error', error.message);
          res.status(500).json({
            success: false,
            error: error.message
          });
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

          res.status(200).json({
            success: true,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
          });
        } catch (error) {
          eventEmitter.emit('api-fetching-error', error.message);
          res.status(500).json({
            success: false,
            error: error.message
          });
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
      res.status(200).json({
        success: true,
        status: 'fetching api running',
        timestamp: new Date().toISOString()
      });
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
          return res.status(503).json({ error: 'Analytics not available' });
        }

        const stats = fetching.analytics.getStats();
        const urlDistribution = fetching.analytics.getUrlDistribution(50);
        const timeline = fetching.analytics.getTimeline(10);
        const urlList = fetching.analytics.getUrlList(100);
        const topErrors = fetching.analytics.getTopErrors(50);

        res.status(200).json({
          success: true,
          stats: stats,
          urlDistribution: urlDistribution,
          timeline: timeline,
          urlList: urlList,
          topErrors: topErrors
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
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
          return res.status(503).json({
            success: false,
            error: 'Analytics not available'
          });
        }

        const analytics = fetching.getAnalytics();
        eventEmitter.emit('api-fetching-list',
            `retrieved ${analytics.length} analytics entries`);
        res.status(200).json({
          success: true,
          data: analytics,
          total: analytics.length
        });
      } catch (err) {
        eventEmitter.emit('api-fetching-list-error', err.message);
        res.status(500).json({
          success: false,
          error: err.message
        });
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
    app.get('/services/fetching/api/settings', (req, res) => {
      try {
        fetching.getSettings().then((settings) => {
          res.status(200).json({
            success: true,
            data: settings
          });
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve settings',
          message: err.message
        });
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
    app.post('/services/fetching/api/settings', (req, res) => {
      const message = req.body;
      if (message) {
        fetching
          .saveSettings(message)
          .then(() => res.status(200).json({
            success: true,
            message: 'Settings saved successfully'
          }))
          .catch((err) => res.status(500).json({
            success: false,
            error: err.message
          }));
      } else {
        res.status(400).json({
          success: false,
          error: 'Bad Request: Missing settings'
        });
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
        if (fetching.clear) {
          await fetching.clear();
          res.status(200).json({
            success: true,
            message: 'Cache cleared successfully'
          });
        } else {
          res.status(503).json({
            success: false,
            error: 'Cache clear not available'
          });
        }
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });
  }
};
