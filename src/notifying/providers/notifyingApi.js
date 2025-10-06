/**
 * @fileoverview API-based notifying service implementation that proxies requests to a remote notifying service.
 * Allows client applications to consume backend notification API endpoints for enterprise systems.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.14
 */

'use strict';

const axios = require('axios');

/**
 * A class that implements notification operations via HTTP API calls to a remote service.
 * Provides methods for sending notifications through various channels via REST endpoints.
 * @class
 */
class NotifyingApi {
  /**
   * Initializes the Notifying API client with configuration.
   * @param {Object} options Configuration options for the API client.
   * @param {string} options.apiRoot The root URL of the backend API service.
   * @param {string=} options.apiKey Optional API key for authenticated requests.
   * @param {number=} options.timeout Request timeout in milliseconds (default: 10000).
   * @param {EventEmitter=} eventEmitter Optional event emitter for notifying events.
   */
  constructor(options = {}, eventEmitter) {
    this.apiRoot = options.apiRoot || 'http://localhost:3000';
    this.apiKey = options.apiKey || null;
    this.timeout = options.timeout || 10000;
    this.eventEmitter_ = eventEmitter;

    // Configure axios instance
    this.client = axios.create({
      baseURL: this.apiRoot,
      timeout: this.timeout,
      headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {}
    });
  }

  /**
   * Sends a notification via the remote notifying API.
   * @param {Object} notification The notification object.
   * @param {string} notification.channel The notification channel (email, sms, push, etc.).
   * @param {string} notification.recipient The recipient identifier.
   * @param {string} notification.subject The notification subject.
   * @param {string} notification.message The notification message.
   * @param {Object=} notification.options Additional options.
   * @return {Promise<Object>} A promise that resolves to the notification result.
   */
  async send(notification) {
    try {
      const response = await this.client.post('/services/notifying/api/send', notification);
      if (this.eventEmitter_)
        this.eventEmitter_.emit('notifying:send', { channel: notification.channel, recipient: notification.recipient });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('notifying:error', { operation: 'send', error: error.message });
      throw error;
    }
  }

  /**
   * Sends an email notification via the remote notifying API.
   * @param {string} to The recipient email address.
   * @param {string} subject The email subject.
   * @param {string} message The email message.
   * @param {Object=} options Additional email options.
   * @return {Promise<Object>} A promise that resolves to the email result.
   */
  async sendEmail(to, subject, message, options = {}) {
    return this.send({ channel: 'email', recipient: to, subject, message, options });
  }

  /**
   * Sends an SMS notification via the remote notifying API.
   * @param {string} to The recipient phone number.
   * @param {string} message The SMS message.
   * @param {Object=} options Additional SMS options.
   * @return {Promise<Object>} A promise that resolves to the SMS result.
   */
  async sendSMS(to, message, options = {}) {
    return this.send({ channel: 'sms', recipient: to, subject: '', message, options });
  }

  /**
   * Sends a push notification via the remote notifying API.
   * @param {string} to The recipient device identifier.
   * @param {string} title The notification title.
   * @param {string} message The notification message.
   * @param {Object=} options Additional push notification options.
   * @return {Promise<Object>} A promise that resolves to the push notification result.
   */
  async sendPush(to, title, message, options = {}) {
    return this.send({ channel: 'push', recipient: to, subject: title, message, options });
  }

  /**
   * Gets notification history from the remote notifying API.
   * @param {Object=} query Query parameters.
   * @return {Promise<Array>} A promise that resolves to the notification history.
   */
  async getHistory(query = {}) {
    try {
      const response = await this.client.get('/services/notifying/api/history', { params: query });
      return response.data;
    } catch (error) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('notifying:error', { operation: 'getHistory', error: error.message });
      throw error;
    }
  }
}

module.exports = NotifyingApi;
