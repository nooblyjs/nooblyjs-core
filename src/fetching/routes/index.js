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
  }
};
