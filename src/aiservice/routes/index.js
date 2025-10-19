/**
 * @fileoverview AI API routes for Express.js application.
 * Provides RESTful endpoints for AI operations, prompt processing, and analytics retrieval.
 * 
 * @author NooblyJS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

/**
 * Configures and registers AI service routes with the Express application.
 * Sets up endpoints for AI operations and monitoring.
 * 
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
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
      res.status(200).json({
        status: status,
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
          return res.status(503).json({
            error: 'AI service is disabled - API key not configured',
            enabled: false
          });
        }

        const { prompt, options = {}, username } = req.body;

        if (!prompt || typeof prompt !== 'string') {
          return res.status(400).json({ error: 'Prompt is required and must be a string' });
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

        res.status(200).json(response);
      } catch (error) {
        if (eventEmitter) {
          eventEmitter.emit('api-ai-error', { error: error.message });
        }
        res.status(500).json({ error: error.message });
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
        res.status(200).json(payload);
      } catch (error) {
        if (eventEmitter) {
          eventEmitter.emit('api-ai-error', { error: error.message });
        }
        res.status(500).json({ error: error.message });
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
          res.status(200).json({ models });
        } else {
          res.status(200).json({ 
            message: 'Model listing not supported by this provider',
            currentModel: aiService.model_ 
          });
        }
      } catch (error) {
        eventEmitter.emit('api-ai-error', { error: error.message });
        res.status(500).json({ error: error.message });
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
          res.status(200).json({ 
            healthy: isRunning,
            provider: aiService.constructor.name 
          });
        } else {
          res.status(200).json({ 
            healthy: true,
            provider: aiService.constructor.name 
          });
        }
      } catch (error) {
        res.status(500).json({ 
          healthy: false,
          error: error.message 
        });
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
    app.get('/services/ai/api/settings', (req, res) => {
      try {
        const settings = aiService.getSettings().then((settings)=> res.status(200).json(settings));
      } catch (err) {
        console.log(err);
        res.status(500).json({
          error: 'Failed to retrieve settings',
          message: err.message
        });
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
    app.post('/services/ai/api/settings', (req, res) => {
      const message = req.body;
      if (message) {
        aiService
          .saveSettings(message)
          .then(() => res.status(200).send('OK'))
          .catch((err) => res.status(500).send(err.message));
      } else {
        res.status(400).send('Bad Request: Missing settings');
      }
    });

  }
};
