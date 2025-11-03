/**
 * @fileoverview Notification API routes for Express.js application.
 * Provides RESTful endpoints for pub/sub messaging system with topic management,
 * subscription handling, and message broadcasting capabilities.
 *
 * @author NooblyJS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

/**
 * Configures and registers notification routes with the Express application.
 * Sets up endpoints for pub/sub messaging and subscription management.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} notifier - The notification provider instance
 * @param {Object=} analytics - Analytics module for topic statistics
 * @return {void}
 */
module.exports = (options, eventEmitter, notifier, analytics) => {
  if (options['express-app'] && notifier) {
    const app = options['express-app'];

    /**
     * POST /services/notifying/api/topic
     * Creates a new notification topic for pub/sub messaging.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.body.topic - The topic name to create
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/notifying/api/topic', async (req, res) => {
      const {topic} = req.body;
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
    });

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
    app.post('/services/notifying/api/subscribe/topic/:topic', async (req, res) => {
      const topic = req.params.topic;
      const {callbackUrl} = req.body;
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
    });

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
    app.post('/services/notifying/api/unsubscribe/topic/:topic', async (req, res) => {
      const topic = req.params.topic;
      const {callbackUrl} = req.body;
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
    });

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
    app.post('/services/notifying/api/notify/topic/:topic', async (req, res) => {
      const topic = req.params.topic;
      const {message} = req.body;
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
    });

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
  }
};
