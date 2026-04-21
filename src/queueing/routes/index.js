/**
 * @fileoverview Task queue API routes for Express.js application.
 * Provides RESTful endpoints for FIFO task queue operations including
 * enqueue, dequeue, size monitoring, and service status reporting.
 *
 * Supports multiple named instances of queueing service through optional
 * instance parameter in URL paths.
 *
 * @author Noobly JS Core Team
 * @version 1.0.15
 * @since 1.0.0
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getServiceInstance } = require('../../appservice/utils/routeUtils');
const { sendSuccess, sendError, sendStatus, ERROR_CODES, handleError } = require('../../appservice/utils/responseUtils');
const AuditLog = require('../../appservice/modules/auditLog');
const DataExporter = require('../../appservice/utils/exportUtils');
const DataImporter = require('../../appservice/utils/importUtils');

/**
 * Configures and registers queueing routes with the Express application.
 * Sets up endpoints for task queue management operations with support for multiple named queues.
 * Supports both default routes and instance-specific routes.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} options.ServiceRegistry - ServiceRegistry singleton for instance lookup
 * @param {string} options.instanceName - Current instance name
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} queue - The queue provider instance with enqueue/dequeue methods
 * @return {void}
 */
module.exports = (options, eventEmitter, queue) => {
  if (options['express-app'] && queue) {
    const app = options['express-app'];
    const authMiddleware = options.authMiddleware;
    const currentInstanceName = options.instanceName || 'default';
    const ServiceRegistry = options.ServiceRegistry;
    const providerType = options.providerType || 'memory';

    // Initialize audit logging for queueing service
    const auditLog = new AuditLog({ maxEntries: 5000, retention: { days: 90 } });

    /**
     * GET /services/queueing/scripts
     * Serves the client-side JavaScript library for consuming the queueing service API
     * Allows front-end applications to interact with the queueing service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/queueing/scripts', (req, res) => {
      try {
        const scriptPath = path.join(__dirname, '..', 'scripts', 'client.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        res.setHeader('Content-Type', 'application/javascript');
        res.status(200).send(scriptContent);
        eventEmitter.emit('api-queueing-scripts-served', 'Queueing script library served');
      } catch (error) {
        eventEmitter.emit('api-queueing-scripts-error', error.message);
        res.status(500).json({
          success: false,
          error: 'Failed to load script library',
          message: error.message
        });
      }
    });

    /**
     * GET /services/queueing/api/swagger/docs.json
     * Serves the Swagger/OpenAPI documentation JSON for the queueing service API
     * Contains complete API specification for API clients and documentation tools.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/queueing/api/swagger/docs.json', (req, res) => {
      try {
        const docsPath = path.join(__dirname, 'swagger', 'docs.json');
        const docsContent = fs.readFileSync(docsPath, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(docsContent);
        eventEmitter.emit('api-queueing-swagger-docs-served', 'Queueing Swagger documentation served');
      } catch (error) {
        eventEmitter.emit('api-queueing-swagger-docs-error', error.message);
        res.status(500).json({
          success: false,
          error: 'Failed to load Swagger documentation',
          message: error.message
        });
      }
    });

    /**
     * Creates an async handler for enqueue operations
     * @param {Object} queue - Queue instance
     * @returns {Function} Express middleware function
     */
    const createEnqueueHandler = (queue) => {
      return async (req, res) => {
        const { queueName } = req.params;
        const { task } = req.body;
        if (!queueName) {
          return res.status(400).json({ error: 'Bad Request: Missing queue name' });
        }
        if (task) {
          try {
            await queue.enqueue(queueName, task);
            eventEmitter.emit('api-queueing-enqueue', { queueName });
            res.status(200).json({ success: true });
          } catch (err) {
            eventEmitter.emit('api-queueing-enqueue-error', { error: err.message });
            res.status(500).json({ error: err.message });
          }
        } else {
          res.status(400).json({ error: 'Bad Request: Missing task' });
        }
      };
    };

    /**
     * POST /services/queueing/api/enqueue/:queueName
     * Adds a task to the end of the specified queue for processing.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.queueName - The name of the queue
     * @param {*} req.body.task - The task object to add to the queue
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/queueing/api/enqueue/:queueName',
      authMiddleware || ((req, res, next) => next()),
      createEnqueueHandler(queue)
    );

    /**
     * POST /services/queueing/api/:instanceName/enqueue/:queueName
     * Adds a task to the end of a named queue instance for processing.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The queue instance name
     * @param {string} req.params.queueName - The name of the queue
     * @param {*} req.body.task - The task object to add to the queue
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/queueing/api/:instanceName/enqueue/:queueName',
      authMiddleware || ((req, res, next) => next()),
      (req, res) => {
        const instanceName = req.params.instanceName;
        const queueInstance = getServiceInstance('queueing', instanceName, queue, options, providerType);
        createEnqueueHandler(queueInstance)(req, res);
      }
    );

    /**
     * Creates an async handler for dequeue operations
     * @param {Object} queue - Queue instance
     * @returns {Function} Express middleware function
     */
    const createDequeueHandler = (queue) => {
      return async (req, res) => {
        const { queueName } = req.params;
        if (!queueName) {
          return res.status(400).json({ error: 'Bad Request: Missing queue name' });
        }
        try {
          const task = await queue.dequeue(queueName);
          eventEmitter.emit('api-queueing-dequeue', { queueName });
          res.status(200).json(task);
        } catch (err) {
          eventEmitter.emit('api-queueing-dequeue-error', { error: err.message });
          res.status(500).json({ error: err.message });
        }
      };
    };

    /**
     * GET /services/queueing/api/dequeue/:queueName
     * Removes and returns the next task from the front of the specified queue.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.queueName - The name of the queue
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/queueing/api/dequeue/:queueName',
      authMiddleware || ((req, res, next) => next()),
      createDequeueHandler(queue)
    );

    /**
     * GET /services/queueing/api/:instanceName/dequeue/:queueName
     * Removes and returns the next task from the front of a named queue instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The queue instance name
     * @param {string} req.params.queueName - The name of the queue
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/queueing/api/:instanceName/dequeue/:queueName',
      authMiddleware || ((req, res, next) => next()),
      (req, res) => {
        const instanceName = req.params.instanceName;
        const queueInstance = getServiceInstance('queueing', instanceName, queue, options, providerType);
        createDequeueHandler(queueInstance)(req, res);
      }
    );

    /**
     * Creates an async handler for size operations
     * @param {Object} queue - Queue instance
     * @returns {Function} Express middleware function
     */
    const createSizeHandler = (queue) => {
      return async (req, res) => {
        const { queueName } = req.params;
        if (!queueName) {
          return res.status(400).json({ error: 'Bad Request: Missing queue name' });
        }
        try {
          const size = await queue.size(queueName);
          eventEmitter.emit('api-queueing-size', { queueName });
          res.status(200).json(size);
        } catch (err) {
          eventEmitter.emit('api-queueing-size-error', { error: err.message });
          res.status(500).json({ error: err.message });
        }
      };
    };

    /**
     * GET /services/queueing/api/size/:queueName
     * Returns the current number of tasks in the specified queue.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.queueName - The name of the queue
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/queueing/api/size/:queueName',
      authMiddleware || ((req, res, next) => next()),
      createSizeHandler(queue)
    );

    /**
     * GET /services/queueing/api/:instanceName/size/:queueName
     * Returns the current number of tasks in a named queue instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The queue instance name
     * @param {string} req.params.queueName - The name of the queue
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/queueing/api/:instanceName/size/:queueName',
      authMiddleware || ((req, res, next) => next()),
      (req, res) => {
        const instanceName = req.params.instanceName;
        const queueInstance = getServiceInstance('queueing', instanceName, queue, options, providerType);
        createSizeHandler(queueInstance)(req, res);
      }
    );

    /**
     * Creates an async handler for list operations
     * @param {Object} queue - Queue instance
     * @returns {Function} Express middleware function
     */
    const createListHandler = (queue) => {
      return async (req, res) => {
        try {
          const queues = await queue.listQueues();
          eventEmitter.emit('api-queueing-list', { count: queues.length });
          res.status(200).json(queues);
        } catch (err) {
          eventEmitter.emit('api-queueing-list-error', { error: err.message });
          res.status(500).json({ error: err.message });
        }
      };
    };

    /**
     * GET /services/queueing/api/queues
     * Returns a list of all queue names.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/queueing/api/queues',
      authMiddleware || ((req, res, next) => next()),
      createListHandler(queue)
    );

    /**
     * GET /services/queueing/api/:instanceName/queues
     * Returns a list of all queue names from a named queue instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The queue instance name
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/queueing/api/:instanceName/queues',
      authMiddleware || ((req, res, next) => next()),
      (req, res) => {
        const instanceName = req.params.instanceName;
        const queueInstance = getServiceInstance('queueing', instanceName, queue, options, providerType);
        createListHandler(queueInstance)(req, res);
      }
    );

    /**
     * Creates an async handler for purge operations
     * @param {Object} queue - Queue instance
     * @returns {Function} Express middleware function
     */
    const createPurgeHandler = (queue) => {
      return async (req, res) => {
        const { queueName } = req.params;
        if (!queueName) {
          return res.status(400).json({ error: 'Bad Request: Missing queue name' });
        }
        try {
          await queue.purge(queueName);
          eventEmitter.emit('api-queueing-purge', { queueName });
          res.status(200).json({ success: true });
        } catch (err) {
          eventEmitter.emit('api-queueing-purge-error', { error: err.message });
          res.status(500).json({ error: err.message });
        }
      };
    };

    /**
     * DELETE /services/queueing/api/purge/:queueName
     * Purges all items from the specified queue.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.queueName - The name of the queue to purge
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete(
      '/services/queueing/api/purge/:queueName',
      authMiddleware || ((req, res, next) => next()),
      createPurgeHandler(queue)
    );

    /**
     * DELETE /services/queueing/api/:instanceName/purge/:queueName
     * Purges all items from a named queue instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The queue instance name
     * @param {string} req.params.queueName - The name of the queue to purge
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete(
      '/services/queueing/api/:instanceName/purge/:queueName',
      authMiddleware || ((req, res, next) => next()),
      (req, res) => {
        const instanceName = req.params.instanceName;
        const queueInstance = getServiceInstance('queueing', instanceName, queue, options, providerType);
        createPurgeHandler(queueInstance)(req, res);
      }
    );

    /**
     * GET /services/queueing/api/status
     * Returns the operational status of the queueing service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/queueing/api/status', (req, res) => {
      eventEmitter.emit('api-queueing-status', 'queueing api running');
      sendStatus(res, 'queueing api running', { provider: providerType, instance: currentInstanceName });
    });

    /**
     * GET /services/queueing/api/instances
     * Returns a list of all available queueing service instances.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/queueing/api/instances', (req, res) => {
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
          const additionalInstances = ServiceRegistry.listInstances('queueing');
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

        eventEmitter.emit('api-queueing-instances', `retrieved ${instances.length} instances`);
        res.status(200).json({
          success: true,
          instances: instances,
          total: instances.length
        });
      } catch (error) {
        eventEmitter.emit('api-queueing-instances-error', error.message);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Helper function to create analytics handler
    const createAnalyticsHandler = (queue) => {
      return async (req, res) => {
        try {
          if (!queue.analytics) {
            return res.status(503).json({ error: 'Analytics not available' });
          }

          const stats = queue.analytics.getStats();
          const distribution = queue.analytics.getDistribution();
          const timeline = queue.analytics.getTimeline(10);
          const queueList = await queue.analytics.getQueueList(queue, 100);

          res.status(200).json({
            stats: stats,
            distribution: distribution,
            timeline: timeline,
            queueList: queueList
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      };
    };

    /**
     * GET /services/queueing/api/analytics
     * Returns analytics data for queue operations.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/queueing/api/analytics', createAnalyticsHandler(queue));

    /**
     * GET /services/queueing/api/:instanceName/analytics
     * Returns analytics data for a named queue instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The queue instance name
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/queueing/api/:instanceName/analytics',
      (req, res) => {
        const instanceName = req.params.instanceName;
        const queueInstance = getServiceInstance('queueing', instanceName, queue, options, providerType);
        createAnalyticsHandler(queueInstance)(req, res);
      }
    );

    /**
     * GET /services/queueing/api/settings
     * Retrieves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/queueing/api/settings', async (req, res) => {
      try {
        const settings = await queue.getSettings();
        res.status(200).json(settings);
      } catch (err) {
        eventEmitter.emit('api-queueing-settings-error', err.message);
        res.status(500).json({
          error: 'Failed to retrieve settings',
          message: err.message
        });
      }
    });

    /**
     * POST /services/queueing/api/settings
     * Saves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/queueing/api/settings', async (req, res) => {
      const message = req.body;
      if (message) {
        try {
          await queue.saveSettings(message);
          eventEmitter.emit('api-queueing-settings-saved', { timestamp: Date.now() });
          res.status(200).json({ success: true });
        } catch (err) {
          eventEmitter.emit('api-queueing-settings-save-error', err.message);
          res.status(500).json({ error: err.message });
        }
      } else {
        res.status(400).json({ error: 'Bad Request: Missing settings' });
      }
    });

    /**
     * GET /services/queueing/api/audit
     * Retrieves audit log entries
     */
    app.get('/services/queueing/api/audit', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const filters = { service: 'queueing', limit: parseInt(req.query.limit) || 100 };
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
        const logs = auditLog.query(filters);
        const stats = auditLog.getStats(filters);
        sendSuccess(res, { logs, stats, total: logs.length }, 'Audit logs retrieved');
      } catch (error) {
        handleError(res, error, { operation: 'queueing-audit-query' });
      }
    });

    /**
     * POST /services/queueing/api/audit/export
     * Exports audit logs
     */
    app.post('/services/queueing/api/audit/export', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const format = req.query.format || 'json';
        const exported = auditLog.export(format, { service: 'queueing', limit: 10000 });

    /**
     * POST /services/queueing/api/import
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
    app.post('/services/queueing/api/import', authMiddleware || ((req, res, next) => next()), async (req, res) => {{
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
        handleError(res, error, {{ operation: 'queueing-import' }});
      }}
    }});


        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('audit-logs', format);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'queueing-audit-export' });
      }
    });

    /**
     * GET /services/queueing/api/export
     * Exports queue statistics
     */
    app.get('/services/queueing/api/export', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const format = req.query.format || 'json';
        const data = queue.getStats ? await queue.getStats() : { note: 'Stats not available' };
        const exported = DataExporter[`to${format.charAt(0).toUpperCase() + format.slice(1)}`]?.(data) || DataExporter.toJSON(data);
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('queue-stats', format);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'queueing-export' });
      }
    });
  }
};
