/**
 * @fileoverview Scheduling Service Factory
 * Singleton factory module for creating scheduler service instances.
 * Provides task scheduling, cron job management, and timed execution capabilities.
 * 
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const SchedulerProvider = require('./providers/scheduling');
const Routes = require('./routes');
const Views = require('./views');

/** @type {SchedulerProvider} */
let instance = null;

/**
 * Returns the singleton instance of the scheduler service.
 * Automatically configures routes and views for the scheduling service.
 * @param {string} type - The scheduler service type (e.g., 'memory')
 * @param {Object} options - Configuration options for the scheduler service
 * @param {Object} options.dependencies - Injected service dependencies
 * @param {Object} options.dependencies.logging - Logging service instance
 * @param {Object} options.dependencies.measuring - Measuring service instance
 * @param {Object} options.dependencies.queueing - Queueing service instance
 * @param {Object} options.dependencies.working - Working service instance
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {SchedulerProvider} The singleton scheduler service instance
 */
function getSchedulerInstance(type, options, eventEmitter) {
  // Create singleton instance if it doesn't exist
  if (!instance) {
    const { dependencies = {}, ...providerOptions } = options;
    instance = new SchedulerProvider(providerOptions, eventEmitter, dependencies.working);

    // Inject dependencies for logging
    if (dependencies.logging) {
      instance.logger = dependencies.logging;
      instance.log = (level, message, meta = {}) => {
        if (typeof dependencies.logging[level] === 'function') {
          dependencies.logging[level](`[SCHEDULING:${type.toUpperCase()}] ${message}`, meta);
        }
      };

      // Log scheduler service initialization
      instance.log('info', 'Scheduling service initialized', {
        provider: type,
        hasLogging: true,
        hasMeasuring: !!dependencies.measuring,
        hasQueueing: !!dependencies.queueing,
        hasWorking: !!dependencies.working
      });
    }

    // Store all dependencies for potential use
    instance.dependencies = dependencies;

    // Initialize routes and views for the scheduling service
    Routes(options, eventEmitter, instance);
    Views(options, eventEmitter, instance);
  }

  return instance;
}

/**
 * Resets the singleton instance for testing purposes.
 * @private
 */
getSchedulerInstance._reset = () => {
  instance = null;
};

module.exports = getSchedulerInstance;
