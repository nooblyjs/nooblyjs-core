/**
 * @fileoverview Search engine API routes for Express.js application.
 * Provides RESTful endpoints for document indexing, search operations,
 * content removal, and service status monitoring with UUID-based keys.
 * Supports multiple named indexes for organizing different types of searchable content.
 *
 * @author NooblyJS Core Team
 * @version 1.0.15
 * @since 1.0.0
 */

'use strict';

const crypto = require('crypto');
const analytics = require('../modules/analytics');

/**
 * Configures and registers search routes with the Express application.
 * Sets up endpoints for search index management and query operations.
 * All endpoints support an optional 'searchContainer' query parameter or field.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} search - The search provider instance with add/remove/search methods
 * @return {void}
 */
module.exports = (options, eventEmitter, search) => {
  if (options['express-app'] && search) {
    const app = options['express-app'];

    /**
     * POST /services/searching/api/add/
     * Adds content to the search index with an auto-generated UUID key.
     *
     * @param {express.Request} req - Express request object
     * @param {*} req.body - The content to add to the search index
     * @param {string} [req.body.searchContainer] - Optional index name (from body)
     * @param {string} [req.query.searchContainer] - Optional index name (from query)
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/searching/api/add/', async (req, res) => {
      const key = crypto.randomUUID();
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const { searchContainer: containerFromBody, ...value } = body;
      const searchContainer = containerFromBody || req.query.searchContainer;

      try {
        const added = await search.add(key, value, searchContainer);
        if (added) {
          res.status(200).send('OK');
        } else {
          res.status(400).send('Bad Request: Key already exists.');
        }
      } catch (error) {
        res.status(500).send(error.message);
      }
    });

    /**
     * DELETE /services/searching/api/delete/:key
     * Removes content from the search index by key.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.key - The UUID key of content to remove
     * @param {string} [req.query.searchContainer] - Optional index name
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete('/services/searching/api/delete/:key', async (req, res) => {
      const key = req.params.key;
      const searchContainer = req.query.searchContainer;

      try {
        const removed = await search.remove(key, searchContainer);
        if (removed) {
          res.status(200).send('OK');
        } else {
          res.status(404).send('Not Found: Key not found.');
        }
      } catch (error) {
        res.status(500).send(error.message);
      }
    });

    /**
     * GET /services/searching/api/search/:term
     * Performs a search query against the indexed content.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.term - The search term/query string
     * @param {string} [req.query.searchContainer] - Optional index name to search within
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/searching/api/search/:term', async (req, res) => {
      const term = req.params.term;
      const searchContainer = req.query.searchContainer;

      if (term) {
        try {
          const results = await search.search(term, searchContainer);
          res.status(200).json(results);
        } catch (err) {
          res.status(500).send(err.message);
        }
      } else {
        res.status(400).send('Bad Request: Missing query');
      }
    });

    /**
     * GET /services/searching/api/status
     * Returns the operational status of the search service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/searching/api/status', (req, res) => {
      eventEmitter.emit('api-searching-status', 'searching api running');
      res.status(200).json('searching api is running');
    });

    /**
     * GET /services/searching/api/indexes
     * Returns a list of all available indexes.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/searching/api/indexes', (req, res) => {
      try {
        const indexNames = search.listIndexes();
        const indexes = indexNames.map((name) => {
          const stats = search.getIndexStats(name) || { size: 0 };
          return {
            name,
            count: stats.size || stats.indexedItems || 0
          };
        });

        res.status(200).json({ indexes });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * GET /services/searching/api/indexes/:searchContainer/stats
     * Returns statistics for a specific index.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.searchContainer - The name of the index
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/searching/api/indexes/:searchContainer/stats', (req, res) => {
      try {
        const searchContainer = req.params.searchContainer;
        const stats = search.getIndexStats(searchContainer);

        if (stats) {
          res.status(200).json(stats);
        } else {
          res.status(404).json({ error: 'Index not found' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * DELETE /services/searching/api/indexes/:searchContainer
     * Deletes an entire index and all its contents.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.searchContainer - The name of the index to delete
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete('/services/searching/api/indexes/:searchContainer', (req, res) => {
      try {
        const searchContainer = req.params.searchContainer;
        const result = search.deleteIndex(searchContainer);

        if (result) {
          res.status(200).json({ message: `Index '${searchContainer}' deleted successfully` });
        } else {
          res.status(404).json({ error: 'Index not found' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * DELETE /services/searching/api/indexes/:searchContainer/clear
     * Clears all documents from a specific index without deleting the index itself.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.searchContainer - The name of the index to clear
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete('/services/searching/api/indexes/:searchContainer/clear', (req, res) => {
      try {
        const searchContainer = req.params.searchContainer;
        const result = search.clearIndex(searchContainer);

        if (result) {
          res.status(200).json({ message: `Index '${searchContainer}' cleared successfully` });
        } else {
          res.status(404).json({ error: 'Index not found' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * GET /services/searching/api/analytics
     * Returns aggregated analytics data including operation stats and search term statistics.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/searching/api/analytics', async (req, res) => {
      try {
        const searchContainer = req.query.searchContainer;
        const limit = parseInt(req.query.limit, 10);
        const [stats, analyticsData] = await Promise.all([
          search.getStats(searchContainer),
          Promise.resolve(
            analytics.getAllAnalytics({
              searchContainer,
              limit: Number.isNaN(limit) ? undefined : limit
            })
          )
        ]);

        res.status(200).json({
          ...analyticsData,
          stats
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * GET /services/searching/api/analytics/operations
     * Returns operation statistics only.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/searching/api/analytics/operations', (req, res) => {
      try {
        const searchContainer = req.query.searchContainer;
        const stats = analytics.getOperationStats(searchContainer);
        res.status(200).json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * GET /services/searching/api/analytics/terms
     * Returns search term analytics.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/searching/api/analytics/terms', (req, res) => {
      try {
        const limit = parseInt(req.query.limit, 10) || 100;
        const searchContainer = req.query.searchContainer;
        const terms = analytics.getSearchTermAnalytics(limit, searchContainer);
        res.status(200).json(terms);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * DELETE /services/searching/api/analytics
     * Clears all analytics data.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete('/services/searching/api/analytics', (req, res) => {
      try {
        analytics.clear();
        res.status(200).json({ message: 'Analytics data cleared successfully' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }
};
