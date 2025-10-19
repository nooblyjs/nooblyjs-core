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
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {MeasuringService|MeasuringApi} Measuring service instance for performance monitoring
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
