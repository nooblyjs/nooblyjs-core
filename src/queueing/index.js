/**
 * @fileoverview Queue Service Factory
 * Factory module for creating queue service instances.
 * Provides message queuing, task scheduling, and job management capabilities.
 * 
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const Queueing = require('./providers/queueing');
const QueueingApi = require('./providers/queueingApi');
const QueueAnalytics = require('./modules/analytics');
const Routes = require('./routes');
const Views = require('./views');

/**
 * Creates a queue service instance with the specified provider and dependency injection.
 * Automatically configures routes and views for the queue service.
 * @param {string} type - The queue provider type ('memory', 'api')
 * @param {Object} options - Configuration options for the queue service
 * @param {Object} options.dependencies - Injected service dependencies
 * @param {Object} options.dependencies.logging - Logging service instance
 * @param {Object} options.dependencies.caching - Caching service instance
 * @param {Object} options.dependencies.dataservice - DataService service instance
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {InMemoryQueue|QueueingApi} Queue service instance with specified provider
 * @throws {Error} When unsupported queue type is provided
 */
function createQueue(type, options, eventEmitter) {
  const { dependencies = {}, ...providerOptions } = options;
  const logger = dependencies.logging;
  const cache = dependencies.caching;
  const dataStore = dependencies.dataservice;

  let queue;

  // Create queue instance based on provider type
  switch (type) {
    case 'api':
      queue = new QueueingApi(providerOptions, eventEmitter);
      break;
    case 'memory':
    default:
      queue = new Queueing(providerOptions, eventEmitter);
      break;
  }

  // Inject dependencies into queue service
  if (logger) {
    queue.logger = logger;
    queue.log = (level, message, meta = {}) => {
      if (typeof logger[level] === 'function') {
        logger[level](`[QUEUE:${type.toUpperCase()}] ${message}`, meta);
      }
    };

    // Log queue service initialization
    queue.log('info', 'Queue service initialized', {
      provider: type,
      hasLogging: true,
      hasCaching: !!cache,
      hasDataStore: !!dataStore
    });
  }

  // Inject caching dependency for performance optimizations
  if (cache) {
    queue.cache = cache;
  }

  // Inject datastore dependency for persistence
  if (dataStore) {
    queue.dataStore = dataStore;
  }

  // Store all dependencies for potential use by provider
  queue.dependencies = dependencies;

  // Initialize analytics module
  if (eventEmitter) {
    queue.analytics = new QueueAnalytics(eventEmitter);

    if (logger) {
      queue.log('info', 'Queue analytics initialized', {
        provider: type
      });
    }
  }

  // Initialize routes and views for the queue service
  Routes(options, eventEmitter, queue);
  Views(options, eventEmitter, queue);

  return queue;
}

module.exports = createQueue;
