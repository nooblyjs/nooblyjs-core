/**
 * @fileoverview Notification API routes for Express.js application.
 * Provides RESTful endpoints for pub/sub messaging system with topic management,
 * subscription handling, and message broadcasting capabilities.
 *
 * Supports multiple named instances of notifying service through optional
 * instance parameter in URL paths.
 *
 * @author NooblyJS Core Team
 * @version 1.0.15
 * @since 1.0.0
 */

'use strict';

/**
 * Gets the appropriate notifier instance based on instance name
 * Falls back to the provided default notifier if no instance name is specified
 *
 * @param {string} instanceName - Optional instance name
 * @param {Object} defaultNotifier - Default notifier instance
 * @param {Object} options - Options containing service registry reference
 * @param {string} providerType - Provider type for the notifying service
 * @returns {Object} Notifier instance to use
 */
function getNotifierInstance(instanceName, defaultNotifier, options, providerType = 'memory') {
  if (!instanceName || instanceName === 'default') {
    return defaultNotifier;
  }

  // Try to get from service registry if available
  const ServiceRegistry = options.ServiceRegistry;
  if (ServiceRegistry) {
    const instance = ServiceRegistry.getServiceInstance('notifying', providerType, instanceName);
    if (instance) {
      return instance;
    }
  }

  // If not found, return default
  return defaultNotifier;
}

/**
 * Configures and registers notification routes with the Express application.
 * Sets up endpoints for pub/sub messaging and subscription management.
 * Supports both default routes and instance-specific routes.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} options.ServiceRegistry - ServiceRegistry singleton for instance lookup
 * @param {string} options.instanceName - Current instance name
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} notifier - The notification provider instance
 * @param {Object=} analytics - Analytics module for topic statistics
 * @return {void}
 */
module.exports = (options, eventEmitter, notifier, analytics) => {
  if (options['express-app'] && notifier) {
    const app = options['express-app'];
    const authMiddleware = options.authMiddleware;
    const currentInstanceName = options.instanceName || 'default';
    const ServiceRegistry = options.ServiceRegistry;
    const providerType = options.providerType || 'memory';

    /**
     * Helper function to create topic handler
     * @param {Object} notifier - Notifier instance
     * @returns {Function} Express route handler
     */
    const createTopicHandler = (notifier) => {
      return async (req, res) => {
        const { topic } = req.body;
        if (topic) {
          try {
            await notifier.createTopic(topic);
            res.status(200).send('OK');
          } catch (err) {
            res.status(500).send(err.message);
          }
        } else {
          res.status(400).send('Bad Request: Missing topic');
        }
      };
    };

    /**
     * POST /services/notifying/api/topic
     * Creates a new notification topic for pub/sub messaging.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.body.topic - The topic name to create
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/notifying/api/topic',
      authMiddleware || ((req, res, next) => next()),
      createTopicHandler(notifier)
    );

    /**
     * POST /services/notifying/api/:instanceName/topic
     * Creates a new notification topic in a named instance for pub/sub messaging.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The notifier instance name
     * @param {string} req.body.topic - The topic name to create
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/notifying/api/:instanceName/topic',
      authMiddleware || ((req, res, next) => next()),
      (req, res) => {
        const instanceName = req.params.instanceName;
        const notifierInstance = getNotifierInstance(instanceName, notifier, options, providerType);
        createTopicHandler(notifierInstance)(req, res);
      }
    );

    /**
     * Helper function to create subscribe handler
     * @param {Object} notifier - Notifier instance
     * @returns {Function} Express route handler
     */
    const createSubscribeHandler = (notifier) => {
      return async (req, res) => {
        const topic = req.params.topic;
        const { callbackUrl } = req.body;
        if (topic && callbackUrl) {
          try {
            await notifier.subscribe(topic, callbackUrl);
            res.status(200).send('OK');
          } catch (err) {
            res.status(500).send(err.message);
          }
        } else {
          res.status(400).send('Bad Request: Missing topic or callback URL');
        }
      };
    };

    /**
     * POST /services/notifying/api/subscribe/topic/:topic
     * Subscribes a callback URL to receive notifications from a topic.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.topic - The topic to subscribe to
     * @param {string} req.body.callbackUrl - The callback URL for notifications
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/notifying/api/subscribe/topic/:topic',
      authMiddleware || ((req, res, next) => next()),
      createSubscribeHandler(notifier)
    );

    /**
     * POST /services/notifying/api/:instanceName/subscribe/topic/:topic
     * Subscribes a callback URL to a topic in a named instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The notifier instance name
     * @param {string} req.params.topic - The topic to subscribe to
     * @param {string} req.body.callbackUrl - The callback URL for notifications
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/notifying/api/:instanceName/subscribe/topic/:topic',
      authMiddleware || ((req, res, next) => next()),
      (req, res) => {
        const instanceName = req.params.instanceName;
        const notifierInstance = getNotifierInstance(instanceName, notifier, options, providerType);
        createSubscribeHandler(notifierInstance)(req, res);
      }
    );

    /**
     * Helper function to create unsubscribe handler
     * @param {Object} notifier - Notifier instance
     * @returns {Function} Express route handler
     */
    const createUnsubscribeHandler = (notifier) => {
      return async (req, res) => {
        const topic = req.params.topic;
        const { callbackUrl } = req.body;
        if (topic && callbackUrl) {
          try {
            await notifier.unsubscribe(topic, callbackUrl);
            res.status(200).send('OK');
          } catch (err) {
            res.status(500).send(err.message);
          }
        } else {
          res.status(400).send('Bad Request: Missing topic or callback URL');
        }
      };
    };

    /**
     * POST /services/notifying/api/unsubscribe/topic/:topic
     * Unsubscribes a callback URL from a topic's notifications.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.topic - The topic to unsubscribe from
     * @param {string} req.body.callbackUrl - The callback URL to remove
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/notifying/api/unsubscribe/topic/:topic',
      authMiddleware || ((req, res, next) => next()),
      createUnsubscribeHandler(notifier)
    );

    /**
     * POST /services/notifying/api/:instanceName/unsubscribe/topic/:topic
     * Unsubscribes a callback URL from a topic in a named instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The notifier instance name
     * @param {string} req.params.topic - The topic to unsubscribe from
     * @param {string} req.body.callbackUrl - The callback URL to remove
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/notifying/api/:instanceName/unsubscribe/topic/:topic',
      authMiddleware || ((req, res, next) => next()),
      (req, res) => {
        const instanceName = req.params.instanceName;
        const notifierInstance = getNotifierInstance(instanceName, notifier, options, providerType);
        createUnsubscribeHandler(notifierInstance)(req, res);
      }
    );

    /**
     * Helper function to create notify handler
     * @param {Object} notifier - Notifier instance
     * @returns {Function} Express route handler
     */
    const createNotifyHandler = (notifier) => {
      return async (req, res) => {
        const topic = req.params.topic;
        const { message } = req.body;
        if (topic && message) {
          try {
            await notifier.notify(topic, message);
            res.status(200).send('OK');
          } catch (err) {
            res.status(500).send(err.message);
          }
        } else {
          res.status(400).send('Bad Request: Missing topic or message');
        }
      };
    };

    /**
     * POST /services/notifying/api/notify/topic/:topic
     * Sends a notification message to all subscribers of a topic.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.topic - The topic to send notification to
     * @param {*} req.body.message - The message to broadcast to subscribers
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/notifying/api/notify/topic/:topic',
      authMiddleware || ((req, res, next) => next()),
      createNotifyHandler(notifier)
    );

    /**
     * POST /services/notifying/api/:instanceName/notify/topic/:topic
     * Sends a notification message to subscribers of a topic in a named instance.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.instanceName - The notifier instance name
     * @param {string} req.params.topic - The topic to send notification to
     * @param {*} req.body.message - The message to broadcast to subscribers
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/notifying/api/:instanceName/notify/topic/:topic',
      authMiddleware || ((req, res, next) => next()),
      (req, res) => {
        const instanceName = req.params.instanceName;
        const notifierInstance = getNotifierInstance(instanceName, notifier, options, providerType);
        createNotifyHandler(notifierInstance)(req, res);
      }
    );

    /**
     * GET /services/notifying/api/status
     * Returns the operational status of the notification service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/notifying/api/status', (req, res) => {
      eventEmitter.emit('api-notifying-status', 'notifying api running');
      res.status(200).json('notifying api running');
    });

    if (analytics) {
      /**
       * Helper function to get analytics for an instance
       * @param {string} instanceName - Instance name
       * @returns {Object} Analytics instance
       */
      const getAnalyticsInstance = (instanceName) => {
        if (!instanceName || instanceName === 'default') {
          return analytics;
        }

        // Try to get from service registry if available
        const notifierInstance = ServiceRegistry ? ServiceRegistry.getServiceInstance('notifying', providerType, instanceName) : null;
        if (notifierInstance && notifierInstance.analytics) {
          return notifierInstance.analytics;
        }

        // Return default analytics
        return analytics;
      };

      app.get('/services/notifying/api/analytics/overview', (req, res) => {
        try {
          const overview = analytics.getOverview();
          res.status(200).json(overview);
        } catch (error) {
          res.status(500).json({
            error: 'Failed to retrieve notifying overview',
            message: error.message,
          });
        }
      });

      app.get('/services/notifying/api/:instanceName/analytics/overview', (req, res) => {
        try {
          const instanceName = req.params.instanceName;
          const analyticsInstance = getAnalyticsInstance(instanceName);
          const overview = analyticsInstance.getOverview();
          res.status(200).json(overview);
        } catch (error) {
          res.status(500).json({
            error: 'Failed to retrieve notifying overview',
            message: error.message,
          });
        }
      });

      app.get('/services/notifying/api/analytics/top-topics', (req, res) => {
        try {
          const limit = parseInt(req.query.limit, 10);
          const topics = analytics.getTopTopics(Number.isNaN(limit) ? undefined : limit);
          res.status(200).json({
            topics,
          });
        } catch (error) {
          res.status(500).json({
            error: 'Failed to retrieve top topics',
            message: error.message,
          });
        }
      });

      app.get('/services/notifying/api/:instanceName/analytics/top-topics', (req, res) => {
        try {
          const instanceName = req.params.instanceName;
          const analyticsInstance = getAnalyticsInstance(instanceName);
          const limit = parseInt(req.query.limit, 10);
          const topics = analyticsInstance.getTopTopics(Number.isNaN(limit) ? undefined : limit);
          res.status(200).json({
            topics,
          });
        } catch (error) {
          res.status(500).json({
            error: 'Failed to retrieve top topics',
            message: error.message,
          });
        }
      });

      app.get('/services/notifying/api/analytics/topics', (req, res) => {
        try {
          const limit = parseInt(req.query.limit, 10);
          const topics = analytics.getTopicDetails(Number.isNaN(limit) ? undefined : limit);
          res.status(200).json({
            topics,
          });
        } catch (error) {
          res.status(500).json({
            error: 'Failed to retrieve topic list',
            message: error.message,
          });
        }
      });

      app.get('/services/notifying/api/:instanceName/analytics/topics', (req, res) => {
        try {
          const instanceName = req.params.instanceName;
          const analyticsInstance = getAnalyticsInstance(instanceName);
          const limit = parseInt(req.query.limit, 10);
          const topics = analyticsInstance.getTopicDetails(Number.isNaN(limit) ? undefined : limit);
          res.status(200).json({
            topics,
          });
        } catch (error) {
          res.status(500).json({
            error: 'Failed to retrieve topic list',
            message: error.message,
          });
        }
      });
    }

    /**
     * GET /services/notifying/api/settings
     * Retrieves the settings for the notifying service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/notifying/api/settings', async (req, res) => {
      try {
        const settings = await notifier.getSettings();
        res.status(200).json(settings);
      } catch (err) {
        eventEmitter.emit('api-notifying-settings-error', err.message);
        res.status(500).json({
          error: 'Failed to retrieve settings',
          message: err.message
        });
      }
    });

    /**
     * POST /services/notifying/api/settings
     * Saves the settings for the notifying service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/notifying/api/settings', async (req, res) => {
      const message = req.body;
      if (message) {
        try {
          await notifier.saveSettings(message);
          res.status(200).send('OK');
        } catch (err) {
          res.status(500).send(err.message);
        }
      } else {
        res.status(400).send('Bad Request: Missing settings');
      }
    });

    /**
     * GET /services/notifying/api/instances
     * Returns a list of all available notifying service instances.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/notifying/api/instances', (req, res) => {
      try {
        if (!ServiceRegistry) {
          res.status(200).json({
            instances: ['default']
          });
          return;
        }

        const instances = new Set();
        // Iterate through all services in the registry
        for (const key of ServiceRegistry.services.keys()) {
          const [serviceName, provider, instanceName] = key.split(':');
          if (serviceName === 'notifying' && provider === providerType) {
            instances.add(instanceName);
          }
        }

        res.status(200).json({
          instances: Array.from(instances).sort()
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to retrieve instances',
          message: error.message
        });
      }
    });
  }
};
