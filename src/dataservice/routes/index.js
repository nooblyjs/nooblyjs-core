/**
 * @fileoverview Data service API routes for Express.js application.
 * Provides RESTful endpoints for data storage and retrieval operations
 * including put, get, delete, and status monitoring.
 *
 * @author NooblyJS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const analytics = require('../modules/analytics');
const { parseLimit } = require('../../shared/utils/validation');

/**
 * Configures and registers data service routes with the Express application.
 * Sets up endpoints for persistent data management operations.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} dataservice - The data service provider instance
 * @return {void}
 */
module.exports = (options, eventEmitter, dataservice) => {
  if (options['express-app'] && dataservice) {
    const app = options['express-app'];
    const authMiddleware = options.authMiddleware;

    /**
     * Sends a generic error response to the client while logging the full
     * error details server-side. Prevents leaking internal error details
     * (stack traces, file paths, DB driver messages) to API consumers.
     *
     * @param {express.Response} res - Express response object.
     * @param {number} status - HTTP status code to send.
     * @param {string} clientMessage - Safe, generic message for the client.
     * @param {Error} err - The original error (logged, never sent to client).
     * @param {string} operation - Operation name for server-side log context.
     * @return {void}
     */
    const sendError = (res, status, clientMessage, err, operation) => {
      if (eventEmitter) {
        eventEmitter.emit('api-dataservice-error', {
          operation,
          error: err && err.message,
          stack: err && err.stack
        });
      }
      res.status(status).json({ error: clientMessage });
    };

    // Fixed paths (status, analytics, settings) must be registered before the
    // generic /:container and /:container/:uuid routes, which would otherwise
    // capture them.

    /**
     * GET /services/dataservice/api/status
     * Returns the operational status of the data service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/dataservice/api/status', (req, res) => {
      eventEmitter.emit('api-dataservice-status', 'dataservice api running');
      res.status(200).json('dataservice api running');
    });

    /**
     * GET /services/dataservice/api/analytics
     * Returns analytics data including total stats and container statistics.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/dataservice/api/analytics', (req, res) => {
      try {
        const data = analytics.getAllAnalytics();
        res.status(200).json(data);
      } catch (error) {
        sendError(res, 500, 'Failed to retrieve analytics', error, 'analytics');
      }
    });

    /**
     * GET /services/dataservice/api/analytics/totals
     * Returns total operation statistics only.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/dataservice/api/analytics/totals', (req, res) => {
      try {
        const stats = analytics.getTotalStats();
        res.status(200).json(stats);
      } catch (error) {
        sendError(res, 500, 'Failed to retrieve analytics totals', error, 'analyticsTotals');
      }
    });

    /**
     * GET /services/dataservice/api/analytics/containers
     * Returns container analytics.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/dataservice/api/analytics/containers', (req, res) => {
      try {
        const limit = parseLimit(req.query.limit, { defaultValue: 100 });
        const containers = analytics.getContainerAnalytics(limit);
        res.status(200).json(containers);
      } catch (error) {
        sendError(res, 500, 'Failed to retrieve container analytics', error, 'analyticsContainers');
      }
    });

    /**
     * DELETE /services/dataservice/api/analytics
     * Clears all analytics data.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete('/services/dataservice/api/analytics', (req, res) => {
      try {
        analytics.clear();
        res.status(200).json({ message: 'Analytics data cleared successfully' });
      } catch (error) {
        sendError(res, 500, 'Failed to clear analytics', error, 'analyticsClear');
      }
    });

    /**
     * GET /services/dataservice/api/settings
     * Retrieves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/dataservice/api/settings', async (req, res) => {
      try {
        const settings = await dataservice.getSettings();
        res.status(200).json(settings);
      } catch (err) {
        eventEmitter.emit('api-dataservice-settings-error', err.message);
        sendError(res, 500, 'Failed to retrieve settings', err, 'getSettings');
      }
    });

    /**
     * POST /services/dataservice/api/settings
     * Updates the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/dataservice/api/settings', async (req, res) => {
      const message = req.body;
      if (message) {
        try {
          await dataservice.saveSettings(message);
          res.status(200).json({ updated: true });
        } catch (err) {
          sendError(res, 500, 'Failed to save settings', err, 'saveSettings');
        }
      } else {
        res.status(400).json({ error: 'Bad Request: Missing settings' });
      }
    });

    /**
     * POST /services/dataservice/api/:container
     * Adds data to a container and returns the generated UUID.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.container - The container to store the data in
     * @param {*} req.body - The data to store
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/dataservice/api/:container', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      const container = req.params.container;
      const jsonObject = req.body;

      try {
        // Ensure container exists
        await dataservice.createContainer(container);
      } catch (err) {
        // Container may already exist, ignore error
      }

      try {
        const uuid = await dataservice.add(container, jsonObject);
        res.status(201).json({ id: uuid });
      } catch (err) {
        sendError(res, 500, 'Failed to add object', err, 'add');
      }
    });

    /**
     * GET /services/dataservice/api/find/:container
     * Searches for objects in a container by text query.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.container - The container to search
     * @param {string} req.query.q - The search term
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/dataservice/api/find/:container', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      const container = req.params.container;
      const searchTerm = req.query.q || '';
      try {
        const results = await dataservice.find(container, searchTerm);
        res.status(200).json(results);
      } catch (err) {
        sendError(res, 500, 'Failed to search container', err, 'find');
      }
    });

    /**
     * GET /services/dataservice/api/count/:container
     * Returns the count of objects in a container.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.container - The container to count
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/dataservice/api/count/:container', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      const container = req.params.container;
      try {
        const count = await dataservice.count(container);
        res.status(200).json({ count });
      } catch (err) {
        sendError(res, 500, 'Failed to count container', err, 'count');
      }
    });

    /**
     * GET /services/dataservice/api/:container/:uuid
     * Retrieves data by UUID from a specific container in the data service system.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.container - The container to retrieve data from
     * @param {string} req.params.uuid - The UUID to retrieve data for
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/dataservice/api/:container/:uuid', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      const container = req.params.container;
      const uuid = req.params.uuid;
      try {
        const value = await dataservice.getByUuid(container, uuid);
        if (value === null) {
          return res.status(404).json({ error: 'Not found' });
        }
        res.status(200).json(value);
      } catch (err) {
        sendError(res, 500, 'Failed to retrieve object', err, 'getByUuid');
      }
    });

    /**
     * PUT /services/dataservice/api/:container/:uuid
     * Updates an existing object by UUID.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.container - The container
     * @param {string} req.params.uuid - The UUID of the object to update
     * @param {Object} req.body - The updated data
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.put('/services/dataservice/api/:container/:uuid', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      const container = req.params.container;
      const uuid = req.params.uuid;
      const jsonObject = req.body;
      try {
        const updated = await dataservice.update(container, uuid, jsonObject);
        if (updated) {
          res.status(200).json({ updated: true });
        } else {
          res.status(404).json({ error: 'Not found' });
        }
      } catch (err) {
        sendError(res, 500, 'Failed to update object', err, 'update');
      }
    });

    /**
     * DELETE /services/dataservice/api/:container/:uuid
     * Removes data by UUID from a specific container in the data service system.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.container - The container to delete data from
     * @param {string} req.params.uuid - The UUID to delete
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete('/services/dataservice/api/:container/:uuid', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      const container = req.params.container;
      const uuid = req.params.uuid;
      try {
        const success = await dataservice.remove(container, uuid);
        if (success) {
          res.status(200).json({ deleted: true });
        } else {
          res.status(404).json({ error: 'Not found' });
        }
      } catch (err) {
        sendError(res, 500, 'Failed to delete object', err, 'remove');
      }
    });


    /**
     * POST /services/dataservice/api/jsonFind/:containerName
     * Searches for objects in a container using a JavaScript predicate function.
     * The request body should contain the predicate as a string.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.containerName - The container to search in
     * @param {Object} req.body - Request body containing predicate string
     * @param {string} req.body.predicate - JavaScript predicate function as string
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/dataservice/api/jsonFind/:containerName', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      const containerName = req.params.containerName;
      const { criteria } = req.body;

      try {
        if (!criteria || typeof criteria !== 'object') {
          return res.status(400).json({ error: 'Request body must contain a "criteria" object with path/value pairs' });
        }

        // Use safe criteria-based search instead of arbitrary code execution
        const results = await dataservice.jsonFindByCriteria(containerName, criteria);
        res.status(200).json(results);
      } catch (err) {
        sendError(res, 400, 'Search failed', err, 'jsonFind');
      }
    });

    /**
     * GET /services/dataservice/api/jsonFindByPath/:containerName/:path/:value
     * Searches for objects in a container where a specific path matches a value.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.containerName - The container to search in
     * @param {string} req.params.path - The dot-notation path to search (e.g., 'user.profile.name')
     * @param {string} req.params.value - The value to match
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/dataservice/api/jsonFindByPath/:containerName/:path/:value', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      const containerName = req.params.containerName;
      const path = req.params.path;
      const value = req.params.value;

      try {
        const results = await dataservice.jsonFindByPath(containerName, path, value);
        res.status(200).json(results);
      } catch (err) {
        sendError(res, 500, 'Search failed', err, 'jsonFindByPath');
      }
    });

    /**
     * POST /services/dataservice/api/jsonFindByCriteria/:containerName
     * Searches for objects in a container using multiple criteria.
     * The request body should contain an object with path-value pairs.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.containerName - The container to search in
     * @param {Object} req.body - Request body containing criteria object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/dataservice/api/jsonFindByCriteria/:containerName', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      const containerName = req.params.containerName;
      const criteria = req.body;

      try {
        const results = await dataservice.jsonFindByCriteria(containerName, criteria);
        res.status(200).json(results);
      } catch (err) {
        sendError(res, 500, 'Search failed', err, 'jsonFindByCriteria');
      }
    });
  }
};
