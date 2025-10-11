/**
 * @fileoverview A console logger implementation providing formatted logging
 * with timestamps, device identification, and event emission support.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const os = require('os');

/**
 * A class that implements a console logger with formatted output.
 * Provides methods for logging info, warning, and error messages to the console.
 * @class
 */
class logging {
  /**
   * Initializes the console logger.
   * @param {Object=} options Configuration options (unused in this implementation).
   * @param {EventEmitter=} eventEmitter Optional event emitter for log events.
   */
  constructor(options, eventEmitter) {
    /** @private @const {EventEmitter} */
    this.eventEmitter_ = eventEmitter;
  }

  /**
   * Formats the message and metadata into a log string.
   * @private
   * @param {string} message The message to log.
   * @param {*=} meta Optional metadata to include in the log.
   * @return {string} The formatted message.
   */
  formatMessage_(message, meta) {
    if (meta === undefined || meta === null) {
      return message;
    }

    // If meta is an object, stringify it nicely
    if (typeof meta === 'object') {
      try {
        const metaStr = JSON.stringify(meta, null, 2);
        return `${message} ${metaStr}`;
      } catch (err) {
        // If JSON.stringify fails, convert to string
        return `${message} ${String(meta)}`;
      }
    }

    // For primitive types, just append
    return `${message} ${meta}`;
  }

  /**
   * Logs an info message to the console with timestamp and device info.
   * @param {string} message The message to log.
   * @param {*=} meta Optional metadata to include in the log (object, string, etc.).
   * @return {Promise<void>} A promise that resolves when the message is logged.
   */
  async info(message, meta) {
    const timestamp = new Date().toISOString();
    const device = os.hostname();
    const formattedMessage = this.formatMessage_(message, meta);
    const logMessage = `${timestamp} - INFO - ${device} - ${formattedMessage}`;
    console.log(logMessage);
    if (this.eventEmitter_)
      this.eventEmitter_.emit('log:info', { message: logMessage });
  }

  /**
   * Logs a warning message to the console with timestamp and device info.
   * @param {string} message The message to log.
   * @param {*=} meta Optional metadata to include in the log (object, string, etc.).
   * @return {Promise<void>} A promise that resolves when the message is logged.
   */
  async warn(message, meta) {
    const timestamp = new Date().toISOString();
    const device = os.hostname();
    const formattedMessage = this.formatMessage_(message, meta);
    const logMessage = `${timestamp} - WARN - ${device} - ${formattedMessage}`;
    console.warn(logMessage);
    if (this.eventEmitter_)
      this.eventEmitter_.emit('log:warn', { message: logMessage });
  }

  /**
   * Logs an error message to the console with timestamp and device info.
   * @param {string} message The message to log.
   * @param {*=} meta Optional metadata to include in the log (object, string, etc.).
   * @return {Promise<void>} A promise that resolves when the message is logged.
   */
  async error(message, meta) {
    const timestamp = new Date().toISOString();
    const device = os.hostname();
    const formattedMessage = this.formatMessage_(message, meta);
    const logMessage = `${timestamp} - ERROR - ${device} - ${formattedMessage}`;
    console.error(logMessage);
    if (this.eventEmitter_)
      this.eventEmitter_.emit('log:error', { message: logMessage });
  }

  /**
   * Logs a generic message to the console with timestamp and device info.
   * @param {string} message The message to log.
   * @param {*=} meta Optional metadata to include in the log (object, string, etc.).
   * @return {Promise<void>} A promise that resolves when the message is logged.
   */
  async log(message, meta) {
    const timestamp = new Date().toISOString();
    const device = os.hostname();
    const formattedMessage = this.formatMessage_(message, meta);
    const logMessage = `${timestamp} - ${device} - ${formattedMessage}`;
    console.log(logMessage);
    if (this.eventEmitter_)
      this.eventEmitter_.emit('log:log', { message: logMessage });
  }

}

module.exports = logging;
