/**
 * @fileoverview AI API routes for Express.js application.
 * Provides RESTful endpoints for AI operations, prompt processing, and analytics retrieval.
 * 
 * @author Noobly JS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const { sendSuccess, sendError, sendStatus, ERROR_CODES, handleError } = require('../../appservice/utils/responseUtils');

/**
 * Configures and registers AI service routes with the Express application.
 * Sets up endpoints for AI operations and monitoring.
 * 
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
const AuditLog = require('../../appservice/modules/auditLog');
const DataExporter = require('../../appservice/utils/exportUtils');
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} aiService - The AI provider instance
 * @param {Object=} analytics - Prompt analytics module instance
 * @return {void}
 */
module.exports = (options, eventEmitter, aiService, analytics) => {
  if (options['express-app'] && aiService) {
    const app = options['express-app'];
    const authMiddleware = options.authMiddleware;

    /**
     * GET /services/ai/api/status
     * Returns the operational status of the AI service.
     */
    app.get('/services/ai/api/status', (req, res) => {
      const status = aiService.enabled !== false ? 'ai api running' : 'ai api disabled - no api key';
      eventEmitter.emit('api-ai-status', status);
      sendStatus(res, status, {
        provider: aiService.constructor.name,
        enabled: aiService.enabled !== false,
        hasApiKey: !!aiService.client_
      });
    });

    /**
     * POST /services/ai/api/prompt
     * Sends a prompt to the AI service and returns the response.
     */
    app.post('/services/ai/api/prompt', async (req, res) => {
      try {
        // Check if AI service is enabled
        if (aiService.enabled === false) {
          return sendStatus(res, 'AI service disabled - API key not configured', { enabled: false }, 503);
        }

        const { prompt, options = {}, username } = req.body;

        if (!prompt || typeof prompt !== 'string') {
          return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Prompt is required and must be a string');
        }

        const effectiveUsername =
          (username && String(username).trim()) ||
          (options && typeof options.username === 'string' && options.username.trim()) ||
          (req.user && req.user.username) ||
          'anonymous';

        const promptOptions = {
          ...options,
          username: effectiveUsername
        };

        const response = await aiService.prompt(prompt, promptOptions);

        const usage = response?.usage || {};
        const promptTokens =
          usage.promptTokens ?? usage.prompt_tokens ?? usage.inputTokens ?? usage.input_tokens ?? 0;
        const completionTokens =
          usage.completionTokens ?? usage.completion_tokens ?? usage.outputTokens ?? usage.output_tokens ?? 0;
        const totalTokens =
          usage.totalTokens ?? usage.total_tokens ?? promptTokens + completionTokens;

        if (analytics) {
          analytics.recordPrompt({
            prompt,
            username: effectiveUsername,
            promptTokens,
            completionTokens,
            totalTokens,
            model: response?.model || promptOptions.model || null,
            provider: response?.provider || aiService.constructor.name || null,
            timestamp: Date.now()
          });
        }

        if (eventEmitter) {
          eventEmitter.emit('ai:prompt:complete', {
            prompt,
            username: effectiveUsername,
            usage,
            model: response?.model,
            provider: response?.provider,
            response
          });
          eventEmitter.emit('api-ai-prompt', { prompt, username: effectiveUsername, response });
        }

        sendSuccess(res, response);
      } catch (error) {
        if (eventEmitter) {
          eventEmitter.emit('api-ai-error', { error: error.message });
        }
        handleError(res, error, 'prompt');
      }
    });

    /**
     * GET /services/ai/api/analytics
     * Returns analytics data for the AI service.
     */
    app.get('/services/ai/api/analytics', (req, res) => {
      try {
        const limit = parseInt(req.query.limit, 10);
        const recentLimit = parseInt(req.query.recentLimit, 10);
        let payload;

        if (analytics) {
          payload = analytics.getAnalytics({
            limit: Number.isNaN(limit) ? undefined : limit,
            recentLimit: Number.isNaN(recentLimit) ? undefined : recentLimit
          });
        } else if (typeof aiService.getAnalytics === 'function') {
          payload = aiService.getAnalytics();
        } else {
          payload = {};
        }

        if (eventEmitter) {
          eventEmitter.emit('api-ai-analytics', payload);
        }
        sendSuccess(res, payload);
      } catch (error) {
        if (eventEmitter) {
          eventEmitter.emit('api-ai-error', { error: error.message });
        }
        handleError(res, error, 'getAnalytics');
      }
    });

    /**
     * GET /services/ai/api/models
     * Returns available models (for Ollama provider).
     */
    app.get('/services/ai/api/models', async (req, res) => {
      try {
        if (typeof aiService.listModels === 'function') {
          const models = await aiService.listModels();
          eventEmitter.emit('api-ai-models', models);
          sendSuccess(res, { models });
        } else {
          sendSuccess(res, {
            message: 'Model listing not supported by this provider',
            currentModel: aiService.model_
          });
        }
      } catch (error) {
        eventEmitter.emit('api-ai-error', { error: error.message });
        handleError(res, error, 'listModels');
      }
    });

    /**
     * GET /services/ai/api/health
     * Health check endpoint (for Ollama provider).
     */
    app.get('/services/ai/api/health', async (req, res) => {
      try {
        if (typeof aiService.isRunning === 'function') {
          const isRunning = await aiService.isRunning();
          sendStatus(res, isRunning ? 'healthy' : 'unhealthy', {
            healthy: isRunning,
            provider: aiService.constructor.name
          });
        } else {
          sendStatus(res, 'healthy', {
            healthy: true,
            provider: aiService.constructor.name
          });
        }
      } catch (error) {
        handleError(res, error, 'healthCheck');
      }
    });

      /**
     * GET /services/ai/api/settings
     * Retrieves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/ai/api/settings', async (req, res) => {
      try {
        const settings = await aiService.getSettings();
        sendSuccess(res, settings);
      } catch (err) {
        eventEmitter.emit('api-ai-settings-error', err.message);
        handleError(res, err, 'getSettings');
      }
    });

     /**
     * POST /services/ai/api/settings
     * Retrieves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/ai/api/settings', async (req, res) => {
      const message = req.body;
      if (message) {
        try {
          await aiService.saveSettings(message);
          sendSuccess(res, {}, 'Settings saved successfully');
        } catch (err) {
          handleError(res, err, 'saveSettings');
        }
      } else {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Settings are required');
      }
    });



    /**
     * GET /services/aiservice/api/audit
     * Retrieves audit log entries
     */
    app.get('/services/aiservice/api/audit', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const filters = { service: 'aiservice', limit: parseInt(req.query.limit) || 100 };
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
        const logs = auditLog.query(filters);
        const stats = auditLog.getStats(filters);
        sendSuccess(res, { logs, stats, total: logs.length }, 'Audit logs retrieved');
      } catch (error) {
        handleError(res, error, { operation: 'aiservice-audit-query' });
      }
    });

    /**
     * POST /services/aiservice/api/audit/export
     * Exports audit logs
     */
    app.post('/services/aiservice/api/audit/export', authMiddleware || ((req, res, next) => next()), (req, res) => {
      try {
        const format = req.query.format || 'json';
        const exported = auditLog.export(format, { service: 'aiservice', limit: 10000 });
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('audit-logs', format);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'aiservice-audit-export' });
      }
    });

    /**
     * GET /services/aiservice/api/export
     * Exports service data
     */
    app.get('/services/aiservice/api/export', authMiddleware || ((req, res, next) => next()), async (req, res) => {
      try {
        const format = req.query.format || 'json';
        const data = { note: 'Data export available' };
        const exported = DataExporter[`to${format.charAt(0).toUpperCase() + format.slice(1)}`]?.(data) || DataExporter.toJSON(data);
        const mimeType = DataExporter.getMimeType(format);
        const filename = DataExporter.getFilename('aiservice-export', format);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exported);
      } catch (error) {
        handleError(res, error, { operation: 'aiservice-export' });
      }
    });
  }
};
