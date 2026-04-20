/**
 * @fileoverview Notification API routes for Express.js application.
 * Provides RESTful endpoints for pub/sub messaging system with topic management,
 * subscription handling, and message broadcasting capabilities.
 *
 * Supports multiple named instances of notifying service through optional
 * instance parameter in URL paths.
 *
 * @author Noobly JS Core Team
 * @version 1.0.15
 * @since 1.0.0
 */

'use strict';

const { getServiceInstance } = require('../../appservice/utils/routeUtils');
const { sendSuccess, sendError, sendStatus, ERROR_CODES, handleError } = require('../../appservice/utils/responseUtils');

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
            sendSuccess(res, { topic }, 'Topic created successfully', 201);
          } catch (err) {
            handleError(res, err, 'createTopic');
          }
        } else {
          sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Topic name is required');
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
        const notifierInstance = getServiceInstance('notifying', instanceName, notifier, options, providerType);
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
            sendSuccess(res, { topic, callbackUrl }, 'Subscription created successfully');
          } catch (err) {
            handleError(res, err, 'subscribe');
          }
        } else {
          sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Topic and callback URL are required');
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
        const notifierInstance = getServiceInstance('notifying', instanceName, notifier, options, providerType);
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
            sendSuccess(res, { topic, callbackUrl }, 'Subscription removed successfully');
          } catch (err) {
            handleError(res, err, 'unsubscribe');
          }
        } else {
          sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Topic and callback URL are required');
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
        const notifierInstance = getServiceInstance('notifying', instanceName, notifier, options, providerType);
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
            sendSuccess(res, { topic }, 'Notification sent successfully');
          } catch (err) {
            handleError(res, err, 'notify');
          }
        } else {
          sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Topic and message are required');
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
        const notifierInstance = getServiceInstance('notifying', instanceName, notifier, options, providerType);
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
      sendStatus(res, 'notifying api running', { provider: providerType, instance: currentInstanceName });
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
          sendSuccess(res, overview);
        } catch (error) {
          handleError(res, error, 'getAnalyticsOverview');
        }
      });

      app.get('/services/notifying/api/:instanceName/analytics/overview', (req, res) => {
        try {
          const instanceName = req.params.instanceName;
          const analyticsInstance = getAnalyticsInstance(instanceName);
          const overview = analyticsInstance.getOverview();
          sendSuccess(res, overview);
        } catch (error) {
          handleError(res, error, 'getAnalyticsOverview');
        }
      });

      app.get('/services/notifying/api/analytics/top-topics', (req, res) => {
        try {
          const limit = parseInt(req.query.limit, 10);
          const topics = analytics.getTopTopics(Number.isNaN(limit) ? undefined : limit);
          sendSuccess(res, { topics });
        } catch (error) {
          handleError(res, error, 'getTopTopics');
        }
      });

      app.get('/services/notifying/api/:instanceName/analytics/top-topics', (req, res) => {
        try {
          const instanceName = req.params.instanceName;
          const analyticsInstance = getAnalyticsInstance(instanceName);
          const limit = parseInt(req.query.limit, 10);
          const topics = analyticsInstance.getTopTopics(Number.isNaN(limit) ? undefined : limit);
          sendSuccess(res, { topics });
        } catch (error) {
          handleError(res, error, 'getTopTopics');
        }
      });

      app.get('/services/notifying/api/analytics/topics', (req, res) => {
        try {
          const limit = parseInt(req.query.limit, 10);
          const topics = analytics.getTopicDetails(Number.isNaN(limit) ? undefined : limit);
          sendSuccess(res, { topics });
        } catch (error) {
          handleError(res, error, 'getTopicDetails');
        }
      });

      app.get('/services/notifying/api/:instanceName/analytics/topics', (req, res) => {
        try {
          const instanceName = req.params.instanceName;
          const analyticsInstance = getAnalyticsInstance(instanceName);
          const limit = parseInt(req.query.limit, 10);
          const topics = analyticsInstance.getTopicDetails(Number.isNaN(limit) ? undefined : limit);
          sendSuccess(res, { topics });
        } catch (error) {
          handleError(res, error, 'getTopicDetails');
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
        sendSuccess(res, settings);
      } catch (err) {
        eventEmitter.emit('api-notifying-settings-error', err.message);
        handleError(res, err, 'getSettings');
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
          sendSuccess(res, {}, 'Settings saved successfully');
        } catch (err) {
          handleError(res, err, 'saveSettings');
        }
      } else {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Settings are required');
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
          sendSuccess(res, { instances: ['default'] });
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

        sendSuccess(res, { instances: Array.from(instances).sort() });
      } catch (error) {
        handleError(res, error, 'listInstances');
      }
    });

    /**
     * GET /services/notifying/api/swagger/docs.json
     * Returns the OpenAPI/Swagger specification for the Notifying Service API.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/notifying/api/swagger/docs.json', (req, res) => {
      try {
        const swaggerDocs = require('./swagger/docs.json');
        sendSuccess(res, swaggerDocs);
      } catch (error) {
        handleError(res, error, 'getSwaggerDocs');
      }
    });
  }
};
