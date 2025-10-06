/**
 * @fileoverview Working Service Factory
 * Singleton factory module for creating worker service instances.
 * Provides background task execution, worker thread management, and job processing.
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

// TODO - we need to work on how data is passed to the script

const WorkerProvider = require('./providers/working');
const WorkingApi = require('./providers/workingApi');
const Routes = require('./routes');
const Views = require('./views');

/** @type {WorkerProvider} */
let instance = null;

/**
 * Returns the singleton instance of the worker service with dependency injection.
 * Automatically configures routes and views for the working service.
 * @param {string} type - The worker service type ('default', 'api')
 * @param {Object} options - Configuration options for the worker service
 * @param {Object} options.dependencies - Injected service dependencies
 * @param {Object} options.dependencies.logging - Logging service instance
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {WorkerProvider|WorkingApi} The singleton worker service instance
 */
function getWorkerInstance(type, options, eventEmitter) {
  const { dependencies = {}, ...providerOptions } = options;
  const logger = dependencies.logging;

  // Create singleton instance if it doesn't exist
  if (!instance) {
    switch (type) {
      case 'api':
        instance = new WorkingApi(providerOptions, eventEmitter);
        break;
      case 'default':
      default:
        instance = new WorkerProvider(providerOptions, eventEmitter);
        break;
    }

    // Inject logging dependency into working service
    if (logger) {
      instance.logger = logger;
      instance.log = (level, message, meta = {}) => {
        if (typeof logger[level] === 'function') {
          logger[level](`[WORKING:${type.toUpperCase()}] ${message}`, meta);
        }
      };

      // Log working service initialization
      instance.log('info', 'Working service initialized', {
        provider: type,
        hasLogging: true
      });
    }

    // Store dependencies for potential use by provider
    instance.dependencies = dependencies;

    // Initialize routes and views for the working service
    Routes(options, eventEmitter, instance);
    Views(options, eventEmitter, instance);
  }

  return instance;
}

/**
 * Reset the singleton instance (primarily for testing)
 * @private
 */
getWorkerInstance._reset = function() {
  instance = null;
};

module.exports = getWorkerInstance;
