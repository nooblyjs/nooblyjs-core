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
 * All endpoints support an optional 'indexName' query parameter or field.
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
     * @param {string} [req.body.indexName] - Optional index name (from body)
     * @param {string} [req.query.indexName] - Optional index name (from query)
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/searching/api/add/', (req, res) => {
      const key = crypto.randomUUID();
      const value = req.body;
      const indexName = req.body.indexName || req.query.indexName;

      if (search.add(key, value, indexName)) {
        res.status(200).send('OK');
      } else {
        res.status(400).send('Bad Request: Key already exists.');
      }
    });

    /**
     * DELETE /services/searching/api/delete/:key
     * Removes content from the search index by key.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.key - The UUID key of content to remove
     * @param {string} [req.query.indexName] - Optional index name
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete('/services/searching/api/delete/:key', (req, res) => {
      const key = req.params.key;
      const indexName = req.query.indexName;

      if (search.remove(key, indexName)) {
        res.status(200).send('OK');
      } else {
        res.status(404).send('Not Found: Key not found.');
      }
    });

    /**
     * GET /services/searching/api/search/:term
     * Performs a search query against the indexed content.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.term - The search term/query string
     * @param {string} [req.query.indexName] - Optional index name to search within
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/searching/api/search/:term', (req, res) => {
      const term = req.params.term;
      const indexName = req.query.indexName;

      if (term) {
        search
          .search(term, indexName)
          .then((results) => res.status(200).json(results))
          .catch((err) => res.status(500).send(err.message));
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
        const indexes = search.listIndexes();
        res.status(200).json(indexes);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * GET /services/searching/api/indexes/:indexName/stats
     * Returns statistics for a specific index.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.indexName - The name of the index
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/searching/api/indexes/:indexName/stats', (req, res) => {
      try {
        const indexName = req.params.indexName;
        const stats = search.getIndexStats(indexName);

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
     * DELETE /services/searching/api/indexes/:indexName
     * Deletes an entire index and all its contents.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.indexName - The name of the index to delete
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete('/services/searching/api/indexes/:indexName', (req, res) => {
      try {
        const indexName = req.params.indexName;
        const result = search.deleteIndex(indexName);

        if (result) {
          res.status(200).json({ message: `Index '${indexName}' deleted successfully` });
        } else {
          res.status(404).json({ error: 'Index not found' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * DELETE /services/searching/api/indexes/:indexName/clear
     * Clears all documents from a specific index without deleting the index itself.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.indexName - The name of the index to clear
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete('/services/searching/api/indexes/:indexName/clear', (req, res) => {
      try {
        const indexName = req.params.indexName;
        const result = search.clearIndex(indexName);

        if (result) {
          res.status(200).json({ message: `Index '${indexName}' cleared successfully` });
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
    app.get('/services/searching/api/analytics', (req, res) => {
      try {
        const data = search.getStats();
        res.status(200).json(data);
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
        const stats = analytics.getOperationStats();
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
        const limit = parseInt(req.query.limit) || 100;
        const terms = analytics.getSearchTermAnalytics(limit);
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
