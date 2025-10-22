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

// Providers
const WorkerProvider = require('./providers/working');
const WorkingApi = require('./providers/workingApi');
const WorkingAnalytics = require('./modules/analytics');

// Views
const Routes = require('./routes');
const Views = require('./views');

// The worker provider
let instance = null;

// The analytics object
let analyticsInstance = null;

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

  // Create analytics instance if it doesn't exist
  if (!analyticsInstance) {
    analyticsInstance = new WorkingAnalytics(eventEmitter);
  }

  // Create singleton instance if it doesn't exist
  if (!instance) {
    // Merge dependencies into providerOptions so they're available during construction
    const optionsWithDeps = {
      ...providerOptions,
      dependencies
    };

    switch (type) {
      case 'api':
        instance = new WorkingApi(optionsWithDeps, eventEmitter);
        break;
      case 'default':
      default:
        instance = new WorkerProvider(optionsWithDeps, eventEmitter);
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
        hasLogging: true,
        hasQueueing: !!dependencies.queueing
      });
    }

    // Store dependencies for potential use by provider
    instance.dependencies = dependencies;

    // Initialize routes and views for the working service
    Routes(options, eventEmitter, instance, analyticsInstance);
    Views(options, eventEmitter, instance);

    // Expose settings methods (save provider methods before overwriting)
    const providerGetSettings = instance.getSettings.bind(instance);
    const providerSaveSettings = instance.saveSettings.bind(instance);
    instance.getSettings = providerGetSettings;
    instance.saveSettings = providerSaveSettings;
  }

  return instance;
}

/**
 * Reset the singleton instance (primarily for testing)
 * @private
 */
getWorkerInstance._reset = function() {
  instance = null;
  analyticsInstance = null;
};

module.exports = getWorkerInstance;
