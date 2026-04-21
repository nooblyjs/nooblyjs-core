/**
 * @fileoverview Search engine API routes for Express.js application.
 * Provides RESTful endpoints for document indexing, search operations,
 * content removal, and service status monitoring with UUID-based keys.
 * Supports multiple named indexes for organizing different types of searchable content.
 *
 * @author Noobly JS Core Team
 * @version 1.0.15
 * @since 1.0.0
 */

'use strict';

const crypto = require('crypto');
const analytics = require('../modules/analytics');
const { sendSuccess, sendError, sendStatus, ERROR_CODES, handleError } = require('../../appservice/utils/responseUtils');

/**
 * Configures and registers search routes with the Express application.
const AuditLog = require('../../appservice/modules/auditLog');
const DataExporter = require('../../appservice/utils/exportUtils');
const DataImporter = require('../../appservice/utils/importUtils');
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
    const authMiddleware = options.authMiddleware;

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
          sendSuccess(res, { key }, 'Document added to index', 201);
        } else {
          sendError(res, ERROR_CODES.DUPLICATE_FOUND, 'Key already exists');
        }
      } catch (error) {
        handleError(res, error, 'addDocument');
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
          sendSuccess(res, { key }, 'Document removed from index');
        } else {
          sendError(res, ERROR_CODES.NOT_FOUND, 'Key not found');
        }
      } catch (error) {
        handleError(res, error, 'deleteDocument');
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
          sendSuccess(res, { results });
        } catch (err) {
          handleError(res, err, 'search');
        }
      } else {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Search term is required');
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
      sendStatus(res, 'searching api running');
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

        sendSuccess(res, { indexes, total: indexes.length });
      } catch (error) {
        handleError(res, error, 'listIndexes');
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
          sendSuccess(res, stats);
        } else {
          sendError(res, ERROR_CODES.NOT_FOUND, 'Index not found');
        }
      } catch (error) {
        handleError(res, error, 'getIndexStats');
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
          sendSuccess(res, { indexName: searchContainer }, `Index '${searchContainer}' deleted successfully`);
        } else {
          sendError(res, ERROR_CODES.NOT_FOUND, 'Index not found');
        }
      } catch (error) {
        handleError(res, error, 'deleteIndex');
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
          sendSuccess(res, { indexName: searchContainer }, `Index '${searchContainer}' cleared successfully`);
        } else {
          sendError(res, ERROR_CODES.NOT_FOUND, 'Index not found');
        }
      } catch (error) {
        handleError(res, error, 'clearIndex');
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

        sendSuccess(res, {
          ...analyticsData,
          stats
        });
      } catch (error) {
        handleError(res, error, 'getAnalytics');
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
        sendSuccess(res, stats);
      } catch (error) {
        handleError(res, error, 'getOperationStats');
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
        sendSuccess(res, terms);
      } catch (error) {
        handleError(res, error, 'getSearchTermAnalytics');
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
        sendSuccess(res, {}, 'Analytics data cleared successfully');
      } catch (error) {
        handleError(res, error, 'clearAnalytics');
      }
    });

    /**
     * GET /services/searching/api/settings
     * Retrieves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/searching/api/settings', async (req, res) => {
      try {
        const settings = await search.getSettings();
        sendSuccess(res, settings);
      } catch (err) {
        eventEmitter.emit('api-searching-settings-error', err.message);
        handleError(res, err, 'getSettings');
      }
    });

     /**
     * POST /services/searching/api/settings
     * Saves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/searching/api/settings', async (req, res) => {
      const message = req.body;
      if (message) {
        try {
          await search.saveSettings(message);
          sendSuccess(res, {}, 'Settings saved successfully');
        } catch (err) {
          handleError(res, err, 'saveSettings');
        }
      } else {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Settings are required');
      }
    });

    /**
     * GET /services/searching/api/suggest/:term
     * Returns autocomplete suggestions (for token-based providers).
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.term - The search term to get suggestions for
     * @param {string} [req.query.searchContainer] - Optional container name
     * @param {string} [req.query.limit] - Max suggestions to return (default: 10)
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/searching/api/suggest/:term', (req, res) => {
      try {
        if (!search.suggest) {
          return sendError(res, ERROR_CODES.INVALID_REQUEST, 'Suggestions not supported by this search provider', undefined, 501);
        }

        const term = req.params.term;
        const searchContainer = req.query.searchContainer || 'default';
        const limit = parseInt(req.query.limit, 10) || 10;

        if (!term) {
          return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Search term is required');
        }

        const suggestions = search.suggest(term, {
          maxSuggestions: limit,
          containerName: searchContainer
        });

        sendSuccess(res, { suggestions });
      } catch (error) {
        handleError(res, error, 'getSuggestions');
      }
    });

    /**
     * GET /services/searching/api/token-stats
     * Returns token-based statistics (for token-based providers).
     *
     * @param {express.Request} req - Express request object
     * @param {string} [req.query.searchContainer] - Optional container name
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/searching/api/token-stats', (req, res) => {
      try {
        const searchContainer = req.query.searchContainer;
        const stats = search.getStats(searchContainer);

        if (!stats.totalTokens) {
          return sendError(res, ERROR_CODES.INVALID_REQUEST, 'Token statistics not available for this search provider', undefined, 501);
        }

        sendSuccess(res, stats);
      } catch (error) {
        handleError(res, error, 'getTokenStats');
      }
    });

    /**
     * POST /services/searching/api/rebuild
     * Triggers a rebuild of the search index (for token-based providers).
     *
     * @param {express.Request} req - Express request object
     * @param {string} [req.body.searchContainer] - Optional container name
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/searching/api/rebuild', (req, res) => {
      try {
        if (!search.rebuild && !search.loadFromDisk) {
          return sendError(res, ERROR_CODES.INVALID_REQUEST, 'Rebuild not supported by this search provider', undefined, 501);
        }

        const searchContainer = req.body?.searchContainer;

        // Trigger rebuild in background
        setImmediate(() => {
          if (search.rebuild) {
            search.rebuild(searchContainer).catch(error => {
              eventEmitter?.emit('search:rebuild:error', { error: error.message });
            });
          }
        });

        sendSuccess(res, {}, 'Index rebuild started in background', 202);
      } catch (error) {
        handleError(res, error, 'rebuildIndex');
      }
    });



    /**
     * GET /services/searching/api/audit
     * Retrieves audit log entries
     */
    app.get('/services/searching/api/audit', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const filters = { service: 'searching', limit: parseInt(req.query.limit) || 100 };
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
        const logs = auditLog.query(filters);
        const stats = auditLog.getStats(filters);
        sendSuccess(res, { logs, stats, total: logs.length }, 'Audit logs retrieved');
      } catch (error) {
        handleError(res, error, { operation: 'searching-audit-query' });
      }
    });

    /**
     * POST /services/searching/api/audit/export
     * Exports audit logs
     */
    app.post('/services/searching/api/audit/export', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const format = req.query.format || 'json';
        const exported = auditLog.export(format, { service: 'searching', limit: 10000 });

    /**
     * POST /services/searching/api/import
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
    app.post('/services/searching/api/import', authMiddleware || ((req, res, next) => next()), async (req, res) => {{
      try {{
        const {{ data: rawData, format = 'json' }} = req.body;
        const dryRun = req.query.dryRun === 'true';
        const conflictStrategy = req.query.conflictStrategy || 'error';

        if (!rawData) {{
          return sendError(res, ERROR_CODES.INVALID_REQUEST, 'Missing data to import');
        }}

        // Parse data based on format
        let parsedData = Array.isArray(rawData) ? rawData : rawData;
        if (typeof rawData === 'string') {{
          parsedData = DataImporter.parse(rawData, format);
        }}

        if (!Array.isArray(parsedData)) {{
          return sendError(res, ERROR_CODES.INVALID_REQUEST, 'Parsed data must be an array');
        }}

        // Dry-run mode
        if (dryRun) {{
          const dryRunResult = DataImporter.dryRun(parsedData, {{ conflictStrategy }});
          return sendSuccess(res, dryRunResult, 'Dry-run completed successfully');
        }}

        // Perform actual import
        const importHandler = async (item) => {{
          try {{
            // Service-specific import logic would go here
            return {{ success: true, type: 'new' }};
          }} catch (error) {{
            throw error;
          }}
        }};

        const result = await DataImporter.import(parsedData, importHandler, {{ conflictStrategy }});
        sendSuccess(res, result, 'Data imported successfully', 201);
      }} catch (error) {{
        handleError(res, error, {{ operation: 'searching-import' }});
      }}
    }});


        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('audit-logs', format);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'searching-audit-export' });
      }
    });

    /**
     * GET /services/searching/api/export
     * Exports service data
     */
    app.get('/services/searching/api/export', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const format = req.query.format || 'json';
        const data = { note: 'Data export available' };
        const exported = DataExporter[`to${format.charAt(0).toUpperCase() + format.slice(1)}`]?.(data) || DataExporter.toJSON(data);
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('searching-export', format);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'searching-export' });
      }
    });
  }
};
