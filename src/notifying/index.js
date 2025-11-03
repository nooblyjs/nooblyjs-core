/**
 * @fileoverview Notification Service Factory
 * Factory module for creating notification service instances.
 * Provides topic-based messaging, subscriber management, and event broadcasting.
 * 
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';
const NotificationService = require('./provider/notifying');
const NotifyingApi = require('./providers/notifyingApi');
const Routes = require('./routes');
const Views = require('./views');
const NotifyingAnalytics = require('./modules/analytics');

/**
 * Creates a notification service instance with messaging capabilities.
 * Automatically configures routes and views for the notification service.
 * @param {string} type - The notification service type ('default', 'api')
 * @param {Object} options - Configuration options for the notification service
 * @param {Object} options.dependencies - Injected service dependencies
 * @param {Object} options.dependencies.logging - Logging service instance
 * @param {Object} options.dependencies.queueing - Queueing service instance
 * @param {Object} options.dependencies.scheduling - Scheduling service instance
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {NotificationService|NotifyingApi} Notification service instance for messaging
 * @throws {Error} When unsupported notification type is provided
 * @example
 * const notifyingService = createNotificationService('default', {
 *   dependencies: { logging, queueing, scheduling }
 * }, eventEmitter);
 *
 * // Subscribe to a topic
 * notifyingService.subscribe('user_events', (message) => {
 *   console.log('Received notification:', message);
 * });
 *
 * // Publish a message to a topic
 * await notifyingService.publish('user_events', {
 *   type: 'user_created',
 *   userId: 123,
 *   timestamp: new Date()
 * });
 */
function createNotificationService(type, options, eventEmitter) {
  // Create notification service instance
  let notifying;
  let analytics = null;

  switch (type) {
    case 'api':
      notifying = new NotifyingApi(options, eventEmitter);
      break;
    case 'default':
    default:
      notifying = new NotificationService(options, eventEmitter);
      break;
  }
  analytics = new NotifyingAnalytics(eventEmitter, notifying);

  // Initialize routes and views for the notification service
  Routes(options, eventEmitter, notifying, analytics);
  Views(options, eventEmitter, notifying);

  // Expose settings methods (save provider methods before overwriting)
  const providerGetSettings = notifying.getSettings.bind(notifying);
  const providerSaveSettings = notifying.saveSettings.bind(notifying);
  const service = notifying;
  service.getSettings = providerGetSettings;
  service.saveSettings = providerSaveSettings;

  return service;
}

module.exports = createNotificationService;
