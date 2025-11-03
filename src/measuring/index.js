/**
 * @fileoverview Measuring Service Factory
 * Factory module for creating performance measuring service instances.
 * Provides metrics collection, timing, and analytics capabilities.
 * 
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const MeasuringService = require('./provider/measuring');
const MeasuringApi = require('./providers/measuringApi');
const MeasuringAnalytics = require('./modules/analytics');
const Routes = require('./routes');
const Views = require('./views');

/**
 * Creates a measuring service instance with performance monitoring capabilities.
 * Automatically configures routes and views for the measuring service.
 * @param {string} type - The measuring service type ('default', 'api')
 * @param {Object} options - Configuration options for the measuring service
 * @param {Object} options.dependencies - Injected service dependencies
 * @param {Object} options.dependencies.logging - Logging service instance
 * @param {Object} options.dependencies.queueing - Queueing service instance
 * @param {Object} options.dependencies.caching - Caching service instance
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {MeasuringService|MeasuringApi} Measuring service instance for performance monitoring
 * @throws {Error} When unsupported measuring type is provided
 * @example
 * const measuringService = createMeasuringService('default', {
 *   dependencies: { logging, queueing, caching }
 * }, eventEmitter);
 *
 * // Record a metric
 * await measuringService.record('api_response_time', 150, { endpoint: '/users' });
 *
 * // Get aggregated metrics
 * const metrics = await measuringService.getMetrics('api_response_time', {
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-12-31')
 * });
 */
function createMeasuringService(type, options, eventEmitter) {
  // Create measuring service instance
  let measuring;
  const analytics = new MeasuringAnalytics(eventEmitter);

  switch (type) {
    case 'api':
      measuring = new MeasuringApi(options, eventEmitter);
      break;
    case 'default':
    default:
      measuring = new MeasuringService(options, eventEmitter);
      break;
  }
  
  // Initialize routes and views for the measuring service
  Routes(options, eventEmitter, measuring, analytics);
  Views(options, eventEmitter, measuring);

  // Expose settings methods (save provider methods before overwriting)
  const providerGetSettings = measuring.getSettings.bind(measuring);
  const providerSaveSettings = measuring.saveSettings.bind(measuring);
  const service = measuring;
  service.getSettings = providerGetSettings;
  service.saveSettings = providerSaveSettings;

  return service;
}

module.exports = createMeasuringService;
