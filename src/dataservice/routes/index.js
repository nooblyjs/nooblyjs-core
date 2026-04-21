/**
 * @fileoverview Data service API routes for Express.js application.
 * Provides RESTful endpoints for data storage and retrieval operations
 * including put, get, delete, and status monitoring.
 *
 * @author Noobly JS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const analytics = require('../modules/analytics');
const AuditLog = require('../../appservice/modules/auditLog');
const DataExporter = require('../../appservice/utils/exportUtils');
const DataImporter = require('../../appservice/utils/importUtils');
const BulkOperations = require('../../appservice/utils/bulkOperations');
const HealthCheck = require('../../appservice/utils/healthCheck');
const { sendSuccess, sendError, sendStatus, ERROR_CODES, handleError } = require('../../appservice/utils/responseUtils');

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

    // Initialize audit logging for dataservice
    const auditLog = new AuditLog({ maxEntries: 5000, retention: { days: 90 } });
    const healthCheck = new HealthCheck('dataservice', { dependencies: [] });

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
        sendSuccess(res, { id: uuid }, 'Data added successfully', 201);
      } catch (err) {
        handleError(res, err, 'addData');
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
        sendSuccess(res, { results });
      } catch (err) {
        handleError(res, err, 'findData');
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
        sendSuccess(res, { count });
      } catch (err) {
        handleError(res, err, 'countData');
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
          return sendError(res, ERROR_CODES.NOT_FOUND, 'Data not found', { container, uuid });
        }
        sendSuccess(res, value);
      } catch (err) {
        handleError(res, err, 'getByUuid');
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
          sendSuccess(res, { uuid }, 'Data updated successfully');
        } else {
          sendError(res, ERROR_CODES.NOT_FOUND, 'Data not found', { container, uuid });
        }
      } catch (err) {
        handleError(res, err, 'updateData');
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
          sendSuccess(res, { uuid }, 'Data deleted successfully');
        } else {
          sendError(res, ERROR_CODES.NOT_FOUND, 'Data not found', { container, uuid });
        }
      } catch (err) {
        handleError(res, err, 'deleteData');
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
          return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Request body must contain a "criteria" object with path/value pairs');
        }

        // Use safe criteria-based search instead of arbitrary code execution
        const results = await dataservice.jsonFindByCriteria(containerName, criteria);
        sendSuccess(res, { results });
      } catch (err) {
        handleError(res, err, 'jsonFind');
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
        sendSuccess(res, { results });
      } catch (err) {
        handleError(res, err, 'jsonFindByPath');
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
        sendSuccess(res, { results });
      } catch (err) {
        handleError(res, err, 'jsonFindByCriteria');
      }
    });

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
      sendStatus(res, 'dataservice api running');
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
        sendSuccess(res, data);
      } catch (error) {
        handleError(res, error, 'getAnalytics');
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
        sendSuccess(res, stats);
      } catch (error) {
        handleError(res, error, 'getTotalStats');
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
        const limit = parseInt(req.query.limit) || 100;
        const containers = analytics.getContainerAnalytics(limit);
        sendSuccess(res, { containers, total: containers.length });
      } catch (error) {
        handleError(res, error, 'getContainerAnalytics');
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
        sendSuccess(res, {}, 'Analytics data cleared successfully');
      } catch (error) {
        handleError(res, error, 'clearAnalytics');
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
        sendSuccess(res, settings);
      } catch (err) {
        eventEmitter.emit('api-dataservice-settings-error', err.message);
        handleError(res, err, 'getSettings');
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
          sendSuccess(res, {}, 'Settings saved successfully');
        } catch (err) {
          handleError(res, err, 'saveSettings');
        }
      } else {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Settings are required');
      }
    });

    /**
     * POST /services/dataservice/api/bulk/delete
     * Deletes multiple items from a container in bulk.
     */
    app.post('/services/dataservice/api/bulk/delete', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const { ids, container, dryRun } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
          return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'ids must be a non-empty array');
        }
        if (!container) {
          return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'container is required');
        }
        const result = await BulkOperations.execute(ids, async (id) => {
          await dataService.remove(container, id);
          return { id, deleted: true };
        }, { dryRun: dryRun === true });
        sendSuccess(res, result, 'Bulk delete completed');
      } catch (err) {
        handleError(res, err, { operation: 'bulk-delete' });
      }
    });

    /**
     * POST /services/dataservice/api/bulk/update
     * Updates multiple items in bulk.
     */
    app.post('/services/dataservice/api/bulk/update', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const { items, container, dryRun } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
          return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'items must be a non-empty array');
        }
        if (!container) {
          return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'container is required');
        }
        const result = await BulkOperations.execute(items, async (item) => {
          await dataService.put(container, item.id, item);
          return { id: item.id, updated: true };
        }, { dryRun: dryRun === true });
        sendSuccess(res, result, 'Bulk update completed');
      } catch (err) {
        handleError(res, err, { operation: 'bulk-update' });
      }
    });

    /**
     * GET /services/dataservice/api/health
     * Returns health status of the dataservice.
     */
    app.get('/services/dataservice/api/health', async (req, res) => {
      try {
        const result = await healthCheck.check({ service: dataService });
        const statusCode = result.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(result);
      } catch (err) {
        handleError(res, err, { operation: 'health-check' });
      }
    });

    /**
     * GET /services/dataservice/api/audit
     * Retrieves audit log entries for dataservice operations
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/dataservice/api/audit', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const filters = {
          service: 'dataservice',
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
        handleError(res, error, { operation: 'dataservice-audit-query' });
      }
    });

    /**
     * POST /services/dataservice/api/audit/export
     * Exports audit logs in specified format
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.query.format - Export format (json, csv, jsonl)
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/dataservice/api/audit/export', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const format = req.query.format || 'json';
        const filters = {
          service: 'dataservice',
          limit: parseInt(req.query.limit) || 10000
        };

        const exported = auditLog.export(format, filters);
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('audit-logs', format);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'dataservice-audit-export' });
      }
    });

    /**
     * GET /services/dataservice/api/export
     * Exports dataservice data in specified format
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.query.format - Export format (json, csv, xml, jsonl)
     * @param {string} req.query.container - Container to export (optional, exports all if not specified)
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/dataservice/api/export', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const format = req.query.format || 'json';
        const container = req.query.container;

        let data = [];

        if (container) {
          data = await dataservice.find(container, {});
        } else {
          // Export all containers
          const containers = await dataservice.listContainers();
          const exportData = {};

          for (const containerName of containers) {
            try {
              exportData[containerName] = await dataservice.find(containerName, {});
            } catch (err) {
              // Skip containers that error
            }
          }

          data = exportData;
        }

        const exported = DataExporter[`to${format.charAt(0).toUpperCase() + format.slice(1).toUpperCase()}`]?.(data) ||
                        DataExporter.toJSON(data);
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename(`data-export-${container || 'all'}`, format);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'dataservice-export' });
      }
    });

    /**
     * POST /services/dataservice/api/import
     * Imports data from specified format into containers
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.body.format - Import format (json, csv, xml, jsonl)
     * @param {string|Array} req.body.data - Data to import (string or array)
     * @param {string} req.body.container - Target container name
     * @param {string} req.query.dryRun - Dry-run mode (true/false)
     * @param {string} req.query.conflictStrategy - Conflict handling (error, skip, update)
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/dataservice/api/import', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const { data: rawData, format = 'json', container = 'default' } = req.body;
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

        // Validate format
        if (!Array.isArray(parsedData)) {
          return sendError(res, ERROR_CODES.INVALID_REQUEST, 'Parsed data must be an array');
        }

        // Ensure container exists
        try {
          await dataservice.createContainer(container);
        } catch (err) {
          // Container may already exist, ignore error
        }

        // Dry-run mode
        if (dryRun) {
          const existingData = await dataservice.find(container, {});
          const dryRunResult = DataImporter.dryRun(parsedData, {
            existingData,
            conflictStrategy,
            uniqueFields: ['id']
          });

          return sendSuccess(res, dryRunResult, 'Dry-run completed successfully');
        }

        // Perform actual import
        let imported = 0;
        let failed = 0;
        const importHandler = async (item) => {
          try {
            // Check for conflict
            if (item.id) {
              const existing = await dataservice.find(container, item.id);
              if (existing && existing.length > 0) {
                if (conflictStrategy === 'error') {
                  return { success: false, conflict: true, reason: 'Item with this ID already exists' };
                } else if (conflictStrategy === 'skip') {
                  return { success: true, type: 'skipped' };
                } else if (conflictStrategy === 'update') {
                  await dataservice.update(container, existing[0]._id || item.id, item);
                  return { success: true, type: 'updated' };
                }
              }
            }

            // Add new item
            await dataservice.add(container, item);
            return { success: true, type: 'new' };
          } catch (error) {
            throw error;
          }
        };

        const result = await DataImporter.import(parsedData, importHandler, { conflictStrategy, dryRun: false });
        sendSuccess(res, result, 'Data imported successfully', 201);
      } catch (error) {
        handleError(res, error, { operation: 'dataservice-import' });
      }
    });

    /**
     * Record an operation to the audit log (internal use)
     */
    dataservice.recordAudit = (operation, details) => {
      auditLog.record({
        operation,
        service: 'dataservice',
        resourceType: details.resourceType || 'data',
        resourceId: details.resourceId || null,
        userId: details.userId || 'system',
        status: details.status || 'SUCCESS',
        errorMessage: details.errorMessage || null,
        duration: details.duration || 0,
        before: details.before,
        after: details.after
      });
    };
  }
};
