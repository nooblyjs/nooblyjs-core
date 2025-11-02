/**
 * @fileoverview Task queue API routes for Express.js application.
 * Provides RESTful endpoints for FIFO task queue operations including
 * enqueue, dequeue, size monitoring, and service status reporting.
 *
 * Supports multiple named instances of queueing service through optional
 * instance parameter in URL paths.
 *
 * @author NooblyJS Core Team
 * @version 1.0.15
 * @since 1.0.0
 */

'use strict';

/**
 * Gets the appropriate queue instance based on instance name
 * Falls back to the provided default queue if no instance name is specified
 *
 * @param {string} instanceName - Optional instance name
 * @param {Object} defaultQueue - Default queue instance
 * @param {Object} options - Options containing service registry reference
 * @param {string} providerType - Provider type for the queue service
 * @returns {Object} Queue instance to use
 */
function getQueueInstance(instanceName, defaultQueue, options, providerType = 'memory') {
  if (!instanceName || instanceName === 'default') {
    return defaultQueue;
  }

  // Try to get from service registry if available
  const ServiceRegistry = options.ServiceRegistry;
  if (ServiceRegistry) {
    const instance = ServiceRegistry.getServiceInstance('queueing', providerType, instanceName);
    if (instance) {
      return instance;
    }
  }

  // If not found, return default
  return defaultQueue;
}

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

    // Helper function to create enqueue handler
    const createEnqueueHandler = (queue) => {
      return (req, res) => {
        const { queueName } = req.params;
        const { task } = req.body;
        if (!queueName) {
          return res.status(400).send('Bad Request: Missing queue name');
        }
        if (task) {
          queue
            .enqueue(queueName, task)
            .then(() => res.status(200).send('OK'))
            .catch((err) => res.status(500).send(err.message));
        } else {
          res.status(400).send('Bad Request: Missing task');
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
        const queueInstance = getQueueInstance(instanceName, queue, options, providerType);
        createEnqueueHandler(queueInstance)(req, res);
      }
    );

    // Helper function to create dequeue handler
    const createDequeueHandler = (queue) => {
      return (req, res) => {
        const { queueName } = req.params;
        if (!queueName) {
          return res.status(400).send('Bad Request: Missing queue name');
        }
        queue
          .dequeue(queueName)
          .then((task) => res.status(200).json(task))
          .catch((err) => res.status(500).send(err.message));
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
        const queueInstance = getQueueInstance(instanceName, queue, options, providerType);
        createDequeueHandler(queueInstance)(req, res);
      }
    );

    // Helper function to create size handler
    const createSizeHandler = (queue) => {
      return (req, res) => {
        const { queueName } = req.params;
        if (!queueName) {
          return res.status(400).send('Bad Request: Missing queue name');
        }
        queue
          .size(queueName)
          .then((size) => res.status(200).json(size))
          .catch((err) => res.status(500).send(err.message));
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
        const queueInstance = getQueueInstance(instanceName, queue, options, providerType);
        createSizeHandler(queueInstance)(req, res);
      }
    );

    // Helper function to create list handler
    const createListHandler = (queue) => {
      return (req, res) => {
        queue
          .listQueues()
          .then((queues) => res.status(200).json(queues))
          .catch((err) => res.status(500).send(err.message));
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
        const queueInstance = getQueueInstance(instanceName, queue, options, providerType);
        createListHandler(queueInstance)(req, res);
      }
    );

    // Helper function to create purge handler
    const createPurgeHandler = (queue) => {
      return (req, res) => {
        const { queueName } = req.params;
        if (!queueName) {
          return res.status(400).send('Bad Request: Missing queue name');
        }
        queue
          .purge(queueName)
          .then(() => res.status(200).send('OK'))
          .catch((err) => res.status(500).send(err.message));
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
        const queueInstance = getQueueInstance(instanceName, queue, options, providerType);
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
      res.status(200).json('queueing api running');
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
        const queueInstance = getQueueInstance(instanceName, queue, options, providerType);
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
    app.get('/services/queueing/api/settings', (req, res) => {
      try {
        queue.getSettings().then((settings) => res.status(200).json(settings));
      } catch (err) {
        console.log(err);
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
    app.post('/services/queueing/api/settings', (req, res) => {
      const message = req.body;
      if (message) {
        queue
          .saveSettings(message)
          .then(() => res.status(200).send('OK'))
          .catch((err) => res.status(500).send(err.message));
      } else {
        res.status(400).send('Bad Request: Missing settings');
      }
    });
  }
};
