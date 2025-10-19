/**
 * @fileoverview Workflow orchestration API routes for Express.js application.
 * Provides RESTful endpoints for workflow definition, execution management,
 * and service status monitoring with event-driven completion callbacks.
 *
 * @author NooblyJS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

/**
 * Configures and registers workflow routes with the Express application.
 * Sets up endpoints for workflow definition and execution management.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} workflow - The workflow provider instance with define/run methods
 * @param {Object} analytics - The analytics module instance for workflow analytics
 * @return {void}
 */
module.exports = (options, eventEmitter, workflow, analytics) => {
  if (options['express-app'] && workflow) {
    const app = options['express-app'];

    /**
     * POST /services/workflow/api/defineworkflow
     * Defines a new workflow with a name and sequence of steps.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.body.name - The name of the workflow to define
     * @param {Array} req.body.steps - Array of workflow steps/tasks
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/workflow/api/defineworkflow', (req, res) => {
      const {name, steps} = req.body;
      if (name) {
        workflow
          .defineWorkflow(name, steps)
          .then((workflowId) => res.status(200).json({workflowId}))
          .catch((err) => res.status(500).send(err.message));
      } else {
        res.status(400).send('Bad Request: Missing workflow name');
      }
    });

    /**
     * POST /services/workflow/api/start
     * Starts execution of a defined workflow with optional input data.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.body.name - The name of the workflow to execute
     * @param {*} req.body.data - Input data for the workflow execution
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/workflow/api/start', (req, res) => {
      const {name, data} = req.body;
      if (name) {
        workflow
          .runWorkflow(name, data, (data) => {
            eventEmitter.emit('workflow-complete', data);
          })
          .then((workflowId) => res.status(200).json({workflowId}))
          .catch((err) => res.status(500).send(err.message));
      } else {
        res.status(400).send('Bad Request: Missing workflow name');
      }
    });

    /**
     * GET /services/workflow/api/status
     * Returns the operational status of the workflow service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/workflow/api/status', (req, res) => {
      eventEmitter.emit('api-workflow-status', 'workflow api running');
      res.status(200).json('workflow api running');
    });

    /**
     * GET /services/workflow/api/stats
     * Retrieves overall statistics about workflow executions including counts and percentages.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/workflow/api/stats', (req, res) => {
      if (!analytics) {
        return res.status(503).json({
          error: 'Analytics module not available'
        });
      }

      try {
        const stats = analytics.getStats();
        res.status(200).json(stats);
      } catch (err) {
        res.status(500).json({
          error: 'Failed to retrieve statistics',
          message: err.message
        });
      }
    });

    /**
     * GET /services/workflow/api/analytics
     * Retrieves detailed analytics for all workflows ordered by last run date.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/workflow/api/analytics', (req, res) => {
      if (!analytics) {
        return res.status(503).json({
          error: 'Analytics module not available'
        });
      }

      try {
        const workflowAnalytics = analytics.getWorkflowAnalytics();
        res.status(200).json({
          count: workflowAnalytics.length,
          workflows: workflowAnalytics
        });
      } catch (err) {
        res.status(500).json({
          error: 'Failed to retrieve workflow analytics',
          message: err.message
        });
      }
    });

    /**
     * GET /services/workflow/api/analytics/:workflowName
     * Retrieves analytics for a specific workflow by name.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/workflow/api/analytics/:workflowName(*)', (req, res) => {
      if (!analytics) {
        return res.status(503).json({
          error: 'Analytics module not available'
        });
      }

      try {
        const { workflowName } = req.params;
        const workflowAnalytics = analytics.getWorkflowAnalyticsByName(workflowName);

        if (workflowAnalytics) {
          res.status(200).json(workflowAnalytics);
        } else {
          res.status(404).json({
            error: 'Workflow not found',
            workflowName: workflowName
          });
        }
      } catch (err) {
        res.status(500).json({
          error: 'Failed to retrieve workflow analytics',
          message: err.message
        });
      }
    });

    /**
     * GET /services/workflow/api/settings
     * Retrieves the settings for the workflow service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/workflow/api/settings', (req, res) => {
      try {
        workflow.getSettings()
          .then((settings) => res.status(200).json(settings))
          .catch((err) => {
            console.log(err);
            res.status(500).json({
              error: 'Failed to retrieve settings',
              message: err.message
            });
          });
      } catch (err) {
        console.log(err);
        res.status(500).json({
          error: 'Failed to retrieve settings',
          message: err.message
        });
      }
    });

    /**
     * POST /services/workflow/api/settings
     * Saves the settings for the workflow service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/workflow/api/settings', (req, res) => {
      const message = req.body;
      if (message) {
        workflow
          .saveSettings(message)
          .then(() => res.status(200).send('OK'))
          .catch((err) => res.status(500).send(err.message));
      } else {
        res.status(400).send('Bad Request: Missing settings');
      }
    });
  }
};
