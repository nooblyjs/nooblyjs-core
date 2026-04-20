/**
 * @fileoverview Workflow orchestration API routes for Express.js application.
 * Provides RESTful endpoints for workflow definition, execution management,
 * and service status monitoring with event-driven completion callbacks.
 *
 * @author Noobly JS Core Team
 * @version 1.0.15
 * @since 1.0.0
 */

'use strict';

const path = require('node:path');
const express = require('express');
const { sendSuccess, sendError, sendStatus, ERROR_CODES, handleError } = require('../../appservice/utils/responseUtils');

/**
 * Configures and registers workflow routes with the Express application.
 * Sets up endpoints for workflow definition and execution management.
const AuditLog = require('../../appservice/modules/auditLog');
const DataExporter = require('../../appservice/utils/exportUtils');
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
    app.post('/services/workflow/api/defineworkflow', async (req, res) => {
      const {name, steps} = req.body;
      if (!name) {
        return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Workflow name is required');
      }

      try {
        const workflowId = await workflow.defineWorkflow(name, steps);
        sendSuccess(res, { workflowId }, 'Workflow defined successfully', 201);
      } catch (err) {
        handleError(res, err, 'defineWorkflow');
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
    app.post('/services/workflow/api/start', async (req, res) => {
      const {name, data} = req.body;
      if (!name) {
        return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Workflow name is required');
      }

      try {
        const workflowId = await workflow.runWorkflow(name, data, (data) => {
          eventEmitter.emit('workflow-complete', data);
        });
        sendSuccess(res, { workflowId }, 'Workflow started', 202);
      } catch (err) {
        handleError(res, err, 'runWorkflow');
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
      sendStatus(res, 'workflow api running', { provider: 'memory' });
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
    app.get('/services/workflow/api/settings', async (req, res) => {
      try {
        const settings = await workflow.getSettings();
        res.status(200).json(settings);
      } catch (err) {
        eventEmitter.emit('api-workflow-settings-error', err.message);
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
    app.post('/services/workflow/api/settings', async (req, res) => {
      const message = req.body;
      if (message) {
        try {
          await workflow.saveSettings(message);
          res.status(200).send('OK');
        } catch (err) {
          res.status(500).send(err.message);
        }
      } else {
        res.status(400).send('Bad Request: Missing settings');
      }
    });

    // ========== Workflow Definition Endpoints ==========

    /**
     * GET /services/workflow/api/definitions
     * Retrieves all workflow definitions.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/workflow/api/definitions', (req, res) => {
      try {
        if (!workflow.definitionContainer) {
          return res.status(503).json({ error: 'Definition container not available' });
        }

        const definitions = workflow.definitionContainer.getAll();
        res.status(200).json({
          count: definitions.length,
          definitions
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    /**
     * GET /services/workflow/api/definitions/:workflowName
     * Retrieves a specific workflow definition.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/workflow/api/definitions/:workflowName(*)', (req, res) => {
      try {
        if (!workflow.definitionContainer) {
          return res.status(503).json({ error: 'Definition container not available' });
        }

        const { workflowName } = req.params;
        const definition = workflow.definitionContainer.get(workflowName);

        if (!definition) {
          return res.status(404).json({
            error: 'Workflow definition not found',
            workflowName
          });
        }

        res.status(200).json(definition);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    /**
     * PUT /services/workflow/api/definitions/:workflowName
     * Updates a workflow definition's steps.
     *
     * @param {express.Request} req - Express request object
     * @param {Array<string>} req.body.steps - New steps array
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.put('/services/workflow/api/definitions/:workflowName(*)', async (req, res) => {
      try {
        if (!workflow.definitionContainer) {
          return res.status(503).json({ error: 'Definition container not available' });
        }

        const { workflowName } = req.params;
        const { steps, metadata } = req.body;

        if (!workflow.definitionContainer.exists(workflowName)) {
          return res.status(404).json({
            error: 'Workflow definition not found',
            workflowName
          });
        }

        let definition;
        if (steps && Array.isArray(steps) && steps.length > 0) {
          definition = workflow.definitionContainer.updateSteps(workflowName, steps);
          // Also update in working workflows map
          workflow.workflows.set(workflowName, steps);
        }

        if (metadata && typeof metadata === 'object') {
          definition = workflow.definitionContainer.updateMetadata(workflowName, metadata);
        }

        res.status(200).json(definition || workflow.definitionContainer.get(workflowName));
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    /**
     * DELETE /services/workflow/api/definitions/:workflowName
     * Deletes a workflow definition.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete('/services/workflow/api/definitions/:workflowName(*)', (req, res) => {
      try {
        if (!workflow.definitionContainer) {
          return res.status(503).json({ error: 'Definition container not available' });
        }

        const { workflowName } = req.params;

        if (!workflow.definitionContainer.exists(workflowName)) {
          return res.status(404).json({
            error: 'Workflow definition not found',
            workflowName
          });
        }

        workflow.definitionContainer.delete(workflowName);
        workflow.workflows.delete(workflowName);

        res.status(200).json({
          success: true,
          message: `Workflow '${workflowName}' deleted`,
          workflowName
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ========== Workflow Execution Endpoints ==========

    /**
     * GET /services/workflow/api/executions/:workflowName
     * Retrieves execution history for a specific workflow.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.query.status - Filter by status (completed, running, error)
     * @param {number} req.query.limit - Max results (default: 50)
     * @param {number} req.query.offset - Pagination offset (default: 0)
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/workflow/api/executions/:workflowName(*)', (req, res) => {
      try {
        if (!workflow.executionContainer) {
          return res.status(503).json({ error: 'Execution container not available' });
        }

        const { workflowName } = req.params;
        const { status, limit, offset } = req.query;

        const options = {
          status: status || undefined,
          limit: parseInt(limit, 10) || 50,
          offset: parseInt(offset, 10) || 0
        };

        const result = workflow.executionContainer.getExecutions(workflowName, options);

        res.status(200).json({
          workflowName,
          ...result
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    /**
     * GET /services/workflow/api/executions/:workflowName/:executionId
     * Retrieves details of a specific workflow execution.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/workflow/api/executions/:workflowName(*)/execution/:executionId(*)', (req, res) => {
      try {
        if (!workflow.executionContainer) {
          return res.status(503).json({ error: 'Execution container not available' });
        }

        const { workflowName, executionId } = req.params;

        const execution = workflow.executionContainer.getExecution(workflowName, executionId);

        if (!execution) {
          return res.status(404).json({
            error: 'Execution not found',
            workflowName,
            executionId
          });
        }

        res.status(200).json(execution);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    /**
     * GET /services/workflow/api/executions/:workflowName/stats
     * Retrieves execution statistics for a workflow.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/workflow/api/executions/:workflowName(*)/stats', (req, res) => {
      try {
        if (!workflow.executionContainer) {
          return res.status(503).json({ error: 'Execution container not available' });
        }

        const { workflowName } = req.params;

        const stats = workflow.executionContainer.getStats(workflowName);

        res.status(200).json({
          workflowName,
          ...stats
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    /**
     * DELETE /services/workflow/api/executions/:workflowName
     * Deletes executions for a workflow based on criteria.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.query.older_than - ISO timestamp, delete older
     * @param {string} req.query.status - Delete only this status
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete('/services/workflow/api/executions/:workflowName(*)', (req, res) => {
      try {
        if (!workflow.executionContainer) {
          return res.status(503).json({ error: 'Execution container not available' });
        }

        const { workflowName } = req.params;
        const { older_than, status } = req.query;

        const options = {
          older_than: older_than || undefined,
          status: status || undefined
        };

        const deleted = workflow.executionContainer.deleteExecutions(workflowName, options);

        res.status(200).json({
          success: true,
          message: `Deleted ${deleted} execution(s)`,
          workflowName,
          deleted
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Serve static files from the views directory for caching service
    app.use('/services/workflow/api/swagger', express.static(path.join(__dirname,'swagger')));



    /**
     * GET /services/workflow/api/audit
     * Retrieves audit log entries
     */
    app.get('/services/workflow/api/audit', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const filters = { service: 'workflow', limit: parseInt(req.query.limit) || 100 };
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
        const logs = auditLog.query(filters);
        const stats = auditLog.getStats(filters);
        sendSuccess(res, { logs, stats, total: logs.length }, 'Audit logs retrieved');
      } catch (error) {
        handleError(res, error, { operation: 'workflow-audit-query' });
      }
    });

    /**
     * POST /services/workflow/api/audit/export
     * Exports audit logs
     */
    app.post('/services/workflow/api/audit/export', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const format = req.query.format || 'json';
        const exported = auditLog.export(format, { service: 'workflow', limit: 10000 });
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('audit-logs', format);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'workflow-audit-export' });
      }
    });

    /**
     * GET /services/workflow/api/export
     * Exports service data
     */
    app.get('/services/workflow/api/export', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const format = req.query.format || 'json';
        const data = { note: 'Data export available' };
        const exported = DataExporter[`to${format.charAt(0).toUpperCase() + format.slice(1)}`]?.(data) || DataExporter.toJSON(data);
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('workflow-export', format);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'workflow-export' });
      }
    });
  }
};
