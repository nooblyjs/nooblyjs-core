/**
 * @fileoverview Task queue API routes for Express.js application.
 * Provides RESTful endpoints for FIFO task queue operations including
 * enqueue, dequeue, size monitoring, and service status reporting.
 *
 * @author NooblyJS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

/**
 * Configures and registers queueing routes with the Express application.
 * Sets up endpoints for task queue management operations with support for multiple named queues.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} queue - The queue provider instance with enqueue/dequeue methods
 * @return {void}
 */
module.exports = (options, eventEmitter, queue) => {
  if (options['express-app'] && queue) {
    const app = options['express-app'];

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
    app.post('/services/queueing/api/enqueue/:queueName', (req, res) => {
      const {queueName} = req.params;
      const {task} = req.body;
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
    });

    /**
     * GET /services/queueing/api/dequeue/:queueName
     * Removes and returns the next task from the front of the specified queue.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.queueName - The name of the queue
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/queueing/api/dequeue/:queueName', (req, res) => {
      const {queueName} = req.params;
      if (!queueName) {
        return res.status(400).send('Bad Request: Missing queue name');
      }
      queue
        .dequeue(queueName)
        .then((task) => res.status(200).json(task))
        .catch((err) => res.status(500).send(err.message));
    });

    /**
     * GET /services/queueing/api/size/:queueName
     * Returns the current number of tasks in the specified queue.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.queueName - The name of the queue
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/queueing/api/size/:queueName', (req, res) => {
      const {queueName} = req.params;
      if (!queueName) {
        return res.status(400).send('Bad Request: Missing queue name');
      }
      queue
        .size(queueName)
        .then((size) => res.status(200).json(size))
        .catch((err) => res.status(500).send(err.message));
    });

    /**
     * GET /services/queueing/api/queues
     * Returns a list of all queue names.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/queueing/api/queues', (req, res) => {
      queue
        .listQueues()
        .then((queues) => res.status(200).json(queues))
        .catch((err) => res.status(500).send(err.message));
    });

    /**
     * DELETE /services/queueing/api/purge/:queueName
     * Purges all items from the specified queue.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.queueName - The name of the queue to purge
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete('/services/queueing/api/purge/:queueName', (req, res) => {
      const {queueName} = req.params;
      if (!queueName) {
        return res.status(400).send('Bad Request: Missing queue name');
      }
      queue
        .purge(queueName)
        .then(() => res.status(200).send('OK'))
        .catch((err) => res.status(500).send(err.message));
    });

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
     * GET /services/queueing/api/analytics
     * Returns analytics data for queue operations.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/queueing/api/analytics', async (req, res) => {
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
    });
  }
};
