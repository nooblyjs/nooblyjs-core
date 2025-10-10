/**
 * @fileoverview Logging Service Factory
 * Factory module for creating logging service instances with multiple provider support.
 * Supports console and file-based logging with configurable levels and formatting.
 * 
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const logging = require('./providers/logging');
const loggingFile = require('./providers/loggingFile');
const loggingApi = require('./providers/loggingApi');
const Routes = require('./routes');
const Views = require('./views');
const LogAnalytics = require('./modules/analytics');

/**
 * Creates a logging service instance with the specified provider.
 * Automatically configures routes and views for the logging service.
 * @param {string} type - The logging provider type ('memory', 'file', 'api')
 * @param {Object} options - Provider-specific configuration options
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {logging|loggingFile|loggingApi} Logging service instance with specified provider
 */
function createLogger(type, options, eventEmitter) {
  let logger;

  // Initialize analytics module to capture logs
  let analytics = null;
  if (eventEmitter) {
    analytics = new LogAnalytics(eventEmitter);
  }

  // Create logger instance based on provider type
  switch (type) {
    case 'file':
      logger = new loggingFile(options, eventEmitter);
      break;
    case 'api':
      logger = new loggingApi(options, eventEmitter);
      break;
    case 'memory':
    default:
      logger = new logging(options, eventEmitter);
      break;
  }

  // Initialize routes and views for the logging service
  Routes(options, eventEmitter, logger, analytics);
  Views(options, eventEmitter, logger);

  return logger;
}

module.exports = createLogger;
