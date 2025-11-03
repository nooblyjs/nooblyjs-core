/**
 * @fileoverview Request Service Factory
 * Factory module for creating HTTP request service instances.
 * Provides HTTP/HTTPS request handling, response processing, and analytics.
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
 * Automatically configures routes and views for the request service.
 * @param {string} type - The request provider type ('default', 'api')
 * @param {Object} options - Configuration options for the request service
 * @param {Object} options.dependencies - Injected service dependencies
 * @param {Object} options.dependencies.logging - Logging service instance
 * @param {Object} options.dependencies.caching - Caching service instance
 * @param {Object} options.dependencies.dataservice - DataService service instance
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {Object} Request service instance with specified provider
 * @throws {Error} When unsupported request type is provided
 * @example
 * const requestService = createRequest('default', {
 *   dependencies: { logging, caching, dataservice }
 * }, eventEmitter);
 *
 * // Make an HTTP request
 * const response = await requestService.get('https://api.example.com/data');
 */
function createRequest(type, options, eventEmitter) {
  const { dependencies = {}, ...providerOptions } = options;
  const logger = dependencies.logging;
  const cache = dependencies.caching;
  const dataStore = dependencies.dataservice;

  // TODO: Instantiate the request provider object
  let request = {};

  // Inject logging dependency into request service
  if (logger) {
    request.logger = logger;
    request.log = (level, message, meta = {}) => {
      if (typeof logger[level] === 'function') {
        logger[level](`[REQUEST:${type.toUpperCase()}] ${message}`, meta);
      }
    };

    // Log request service initialization
    request.log('info', 'Request service initialized', {
      provider: type,
      hasLogging: true,
      hasCaching: !!cache,
      hasDataStore: !!dataStore
    });
  }

  // Store all dependencies for potential use by provider
  request.dependencies = dependencies;

  // Initialize analytics module
  if (eventEmitter) {
    request.analytics = new Analytics(eventEmitter);

    if (logger) {
      request.log('info', 'Request analytics initialized', {
        provider: type
      });
    }
  }

  // Initialize routes and views for the request service
  Routes(options, eventEmitter, request);
  Views(options, eventEmitter, request);

  return request;
}

module.exports = createRequest;
