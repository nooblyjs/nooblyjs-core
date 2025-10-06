/**
 * @fileoverview AI Service Factory
 * Factory module for creating AI service instances with multiple provider support.
 * Supports claude, chatgpt, ollama.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const AIClaude = require('./provider/aiclaude');
const AIOpenAI = require('./provider/aiopenai');
const AIOllama = require('./provider/aiollama');
const AIApi = require('./provider/aiApi');

const Routes = require('./routes');
const Views = require('./views');

/**
 * Creates an AI service instance with the specified provider and dependency injection.
 * Automatically configures routes and views for the AI service.
 * @param {string} type - The AI provider type ('claude', 'chatgpt', 'ollama', 'api')
 * @param {Object} options - Provider-specific configuration options
 * @param {Object} options.dependencies - Injected service dependencies
 * @param {Object} options.dependencies.logging - Logging service instance
 * @param {Object} options.dependencies.caching - Caching service instance
 * @param {Object} options.dependencies.workflow - Workflow service instance
 * @param {Object} options.dependencies.queueing - Queueing service instance
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {AIClaude|AIOpenAI|AIOllama|AIApi} AI service instance with specified provider
 * @throws {Error} When unsupported AI provider type is provided
 */
function createAIService(type, options, eventEmitter) {
  const { dependencies = {}, ...providerOptions } = options;
  const logger = dependencies.logging;
  const cache = dependencies.caching;
  const workflow = dependencies.workflow;
  const queueing = dependencies.queueing;

  let aiservice;

  // Create AI service instance based on provider type
  switch (type) {
    case 'claude':
      aiservice = new AIClaude(providerOptions, eventEmitter);
      break;
    case 'chatgpt':
      aiservice = new AIOpenAI(providerOptions, eventEmitter);
      break;
    case 'ollama':
      aiservice = new AIOllama(providerOptions, eventEmitter);
      break;
    case 'api':
      aiservice = new AIApi(providerOptions, eventEmitter);
      break;
    default:
      throw new Error(`Unsupported AI provider type: ${type}`);
  }

  // Inject dependencies into AI service
  if (logger) {
    aiservice.logger = logger;
    aiservice.log = (level, message, meta = {}) => {
      if (typeof logger[level] === 'function') {
        logger[level](`[AI:${type.toUpperCase()}] ${message}`, meta);
      }
    };

    // Log AI service initialization
    aiservice.log('info', 'AI service initialized', {
      provider: type,
      hasLogging: true,
      hasCaching: !!cache,
      hasWorkflow: !!workflow,
      hasQueueing: !!queueing
    });
  }

  // Inject caching dependency for response caching
  if (cache) {
    aiservice.cache = cache;
  }

  // Inject workflow dependency for complex AI pipelines
  if (workflow) {
    aiservice.workflow = workflow;
  }

  // Inject queueing dependency for async AI processing
  if (queueing) {
    aiservice.queueing = queueing;
  }

  // Store all dependencies for potential use by provider
  aiservice.dependencies = dependencies;

  // Initialize routes and views for the AI service
  Routes(options, eventEmitter, aiservice);
  Views(options, eventEmitter, aiservice);

  return aiservice;
}

module.exports = createAIService;
