/**
 * @fileoverview Working Service Factory
 *
 * Singleton factory for the working service. Wires the worker manager (or
 * its API client equivalent) to its injected dependencies, mounts HTTP
 * routes and views, and exposes a stable accessor for the rest of the
 * framework.
 *
 * @author Noobly JS Core Team
 * @version 2.0.0
 * @since 1.0.0
 */

'use strict';

const WorkerProvider = require('./providers/working');
const WorkingApi = require('./providers/workingApi');
const WorkingAnalytics = require('./modules/analytics');

const Routes = require('./routes');
const Views = require('./views');

/** @type {?Object} */
let instance = null;

/** @type {?WorkingAnalytics} */
let analyticsInstance = null;

/**
 * Returns the singleton working service instance, creating it on first call.
 *
 * @param {string} type Provider type (`'default'` or `'api'`).
 * @param {!Object} options Configuration options.
 * @param {!Object=} options.dependencies Injected service dependencies.
 * @param {!Object=} options.dependencies.logging Logging service.
 * @param {!Object=} options.dependencies.queueing Queueing service (required by `default`).
 * @param {!Object=} options.dependencies.filing Filing service (optional).
 * @param {EventEmitter} eventEmitter Global event emitter.
 * @return {!Object} The working service instance.
 *
 * @example
 * const working = registry.working('default', {
 *   dependencies: { logging, queueing },
 *   maxThreads: 4,
 *   workerTimeout: 60000,
 *   maxQueueSize: 500
 * });
 *
 * const taskId = await working.start('cleanup.js', { dryRun: false });
 */
function getWorkerInstance(type, options, eventEmitter) {
  if (instance) return instance;

  const { dependencies = {}, ...providerOptions } = options || {};

  if (!analyticsInstance) {
    analyticsInstance = new WorkingAnalytics(eventEmitter);
  }

  const optionsWithDeps = { ...providerOptions, dependencies };

  switch (type) {
    case 'api':
      instance = new WorkingApi(optionsWithDeps, eventEmitter);
      break;
    case 'default':
    default:
      instance = new WorkerProvider(optionsWithDeps, eventEmitter);
      break;
  }

  // Standard logger injection — provider uses optional chaining and falls
  // silent if no logger is wired in.
  if (dependencies.logging) {
    instance.logger = dependencies.logging;
    instance.logger?.info?.('[WorkerProvider] Working service initialized', {
      provider: type,
      hasQueueing: !!dependencies.queueing,
      hasFiling: !!dependencies.filing
    });
  }

  // Keep the full dependency map available for downstream use.
  instance.dependencies = dependencies;

  Routes(options, eventEmitter, instance, analyticsInstance);
  Views(options, eventEmitter, instance);

  return instance;
}

/**
 * Resets the singleton instance. Used by tests; not part of the public API.
 * @private
 */
getWorkerInstance._reset = function () {
  if (instance && typeof instance.stop === 'function') {
    // Best-effort synchronous shutdown — fire and forget the promise.
    instance.stop().catch(() => {});
  }
  if (analyticsInstance && typeof analyticsInstance.destroy === 'function') {
    try {
      analyticsInstance.destroy();
    } catch (_) { /* best effort */ }
  }
  instance = null;
  analyticsInstance = null;
};

module.exports = getWorkerInstance;
