/**
 * @fileoverview Request Service Factory
 * Factory module for creating queue service instances.
 * Provides message queuing, task scheduling, and job management capabilities.
 * 
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const Analytics = require('./modules/analytics');
const Routes = require('./routes');
const Views = require('./views');

/**
 * Creates a request service instance with the specified provider and dependency injection.
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
function createRequest(type, options, eventEmitter) {
  const { dependencies = {}, ...providerOptions } = options;
  const logger = dependencies.logging;
  const cache = dependencies.caching;
  const dataStore = dependencies.dataservice;
  
  // Instantiate the request object to use
  let request;

  // Initialize routes and views for the queue service
  Routes(options, eventEmitter, request);
  Views(options, eventEmitter, request);

  return queue;
}

module.exports = createRequest;
