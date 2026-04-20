/**
 * @fileoverview Scheduling Service Factory
 *
 * Singleton factory for the scheduling service. Wires the scheduler provider
 * to its injected dependencies, mounts the HTTP routes and views, and exposes
 * a stable accessor for the rest of the framework.
 *
 * @author Noobly JS Core Team
 * @version 2.0.0
 * @since 1.0.0
 */

'use strict';

const SchedulerProvider = require('./providers/scheduling');
const Routes = require('./routes');
const Views = require('./views');

/** @type {?SchedulerProvider} */
let instance = null;

/**
 * Returns the singleton scheduling service instance, creating it on first call.
 *
 * @param {string} type Provider type (currently only `'memory'` / `'default'`).
 * @param {!Object} options Configuration options.
 * @param {!Object=} options.dependencies Injected service dependencies.
 * @param {!Object=} options.dependencies.logging Logging service.
 * @param {!Object=} options.dependencies.measuring Measuring service.
 * @param {!Object=} options.dependencies.queueing Queueing service.
 * @param {!Object=} options.dependencies.working Working service (required to execute tasks).
 * @param {EventEmitter} eventEmitter Global event emitter.
 * @return {!SchedulerProvider}
 *
 * @example
 * const scheduler = registry.scheduling('memory', {
 *   dependencies: { logging, working },
 *   maxConcurrentJobs: 20,
 *   retryAttempts: 2,
 *   jobTimeout: 60000
 * });
 *
 * await scheduler.start('cleanup', 'cleanup.js', 3600);
 * await scheduler.startCron({ scriptPath: 'report.js' }, '0 9 * * 1-5', 'weekday-report');
 */
function getSchedulerInstance(type, options, eventEmitter) {
  if (instance) return instance;

  const { dependencies = {}, ...providerOptions } = options || {};

  instance = new SchedulerProvider(providerOptions, eventEmitter, dependencies.working);

  // Standard logger injection — provider uses optional chaining and falls
  // silent if no logger is wired in.
  if (dependencies.logging) {
    instance.logger = dependencies.logging;
    instance.logger?.info?.('[SchedulerProvider] Scheduling service initialized', {
      provider: type,
      hasMeasuring: !!dependencies.measuring,
      hasQueueing: !!dependencies.queueing,
      hasWorking: !!dependencies.working
    });
  }

  // Keep the full dependency map available for downstream use (e.g. routes
  // that need access to other services).
  instance.dependencies = dependencies;

  // Mount HTTP routes and static views if an Express app was supplied.
  Routes(options, eventEmitter, instance);
  Views(options, eventEmitter, instance);

  return instance;
}

/**
 * Resets the singleton instance. Used by tests; not part of the public API.
 * @private
 */
getSchedulerInstance._reset = () => {
  if (instance && typeof instance.shutdown === 'function') {
    // Best-effort synchronous shutdown — fire and forget the promise.
    instance.shutdown().catch(() => {});
  }
  instance = null;
};

module.exports = getSchedulerInstance;
