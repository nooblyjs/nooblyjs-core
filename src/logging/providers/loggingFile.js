/**
 * @fileoverview A file logger implementation providing formatted logging
 * to files with timestamps, device identification, and event emission support.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * A class that implements a file logger with formatted output.
 * Provides methods for logging info, warning, and error messages to files.
 * @class
 */
class loggingFile {
  /**
   * Initializes the file logger with target filename.
   * @param {Object=} options Configuration options for the file logger.
   * @param {string=} options.filename The name of the file to log to (defaults to 'app.YYYY-MM-DD.log').
   * @param {string=} options.logDir Directory to store log files (defaults to './.logs').
   * @param {EventEmitter=} eventEmitter Optional event emitter for log events.
   */
  constructor(options = {}, eventEmitter) {
    this.settings = {};
    this.settings.desciption = "The setting that are needed is the minloglevel and logDir"
    this.settings.list = [
      {setting: "minLogLevel", type: "list", values : ['error', 'warn', 'info', 'log']}, 
      {setting: "logDir", type: "string", values : ['/.logs/']}
    ];
    this.settings.logDir = options.logDir || './.logs';
    
    const defaultFilename = options.filename || this.generateDefaultFilename_();
    this.filename_ = path.isAbsolute(defaultFilename) 
      ? defaultFilename 
      : path.join(this.settings.logDir, defaultFilename);
    this.eventEmitter_ = eventEmitter;
    
    if (options && options.log){
      this.settings.minLogLevel = options.log.level || 'info';
    }
    
    // Ensure log directory exists
    this.initializeLogDir_();
  }

  /**
   * Determines the priority of a log level.
   * @param {} level 
   * @returns 
   */
  determineLogLevelPriority(level) {
    const levels = ['error', 'warn', 'info', 'log'];
    return levels.indexOf(level);
  }

  /**
   * Determines if a message should be logged based on its level and the minimum log level.
   * @param {*} level 
   * @returns 
   */
  shouldLog(level) {
    if (!this.settings.minLogLevel) {
      return true; 
    }
    const messagePriority = this.determineLogLevelPriority(level);
    const minPriority = this.determineLogLevelPriority(this.settings.minLogLevel);
    return messagePriority <= minPriority;
  } 


  /**
   * Generates a default log filename with current date.
   * @return {string} Generated filename in format app.YYYY-MM-DD.log
   * @private
   */
  generateDefaultFilename_() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `app.${year}-${month}-${day}.log`;
  }

  /**
   * Initializes the log directory if it doesn't exist.
   * @private
   */
  initializeLogDir_() {
    try {
      if (!fs.existsSync(this.settings.logDir)) {
        fs.mkdirSync(this.settings.logDir, { recursive: true });
      }
    } catch (error) {
      // If we can't create the directory, fall back to current directory
      console.warn(`Could not create log directory ${this.settings.logDir}: ${error.message}`);
    }
  }

  /**
   * Logs an info message to a file with timestamp and device info.
   * @param {string} message The message to log.
   * @return {Promise<void>} A promise that resolves when the message is logged.
   * @throws {Error} When file write operation fails.
   */
  async info(message) {
     if (!this.shouldLog('info')) {
      return;
    }
    const timestamp = new Date().toISOString();
    const os = require('os');
    const device = os.hostname();
    const logMessage = `${timestamp} - INFO - ${device} - ${message}`;
    fs.appendFileSync(this.filename_, logMessage + '\n');
    if (this.eventEmitter_)
      this.eventEmitter_.emit('log:info', { filename: this.filename_, message: logMessage });
  }

  /**
   * Logs a warning message to a file with timestamp and device info.
   * @param {string} message The message to log.
   * @return {Promise<void>} A promise that resolves when the message is logged.
   * @throws {Error} When file write operation fails.
   */
  async warn(message) {
     if (!this.shouldLog('warn')) {
      return;
    }
    const timestamp = new Date().toISOString();
    const os = require('os');
    const device = os.hostname();
    const logMessage = `${timestamp} - WARN - ${device} - ${message}`;
    fs.appendFileSync(this.filename_, logMessage + '\n');
    if (this.eventEmitter_)
      this.eventEmitter_.emit('log:warn', { filename: this.filename_, message: logMessage });
  }

  /**
   * Logs an error message to a file with timestamp and device info.
   * @param {string} message The message to log.
   * @return {Promise<void>} A promise that resolves when the message is logged.
   * @throws {Error} When file write operation fails.
   */
  async error(message) {
    if (!this.shouldLog('error')) {
      return;
    }
    const timestamp = new Date().toISOString();
    const os = require('os');
    const device = os.hostname();
    const logMessage = `${timestamp} - ERROR - ${device} - ${message}`;
    fs.appendFileSync(this.filename_, logMessage + '\n');
    if (this.eventEmitter_)
      this.eventEmitter_.emit('log:error', { filename: this.filename_, message: logMessage });
  }

  /**
   * Logs a generic message to a file.
   * @param {string} message The message to log.
   * @return {Promise<void>} A promise that resolves when the message is logged.
   * @throws {Error} When file write operation fails.
   */
  async log(message) {
    if (!this.shouldLog('log')) {
      return;
    }
    fs.appendFileSync(this.filename_, message + '\n');
    if (this.eventEmitter_)
      this.eventEmitter_.emit('log:log', { filename: this.filename_, message: message });
  }

  /**
   * Get all our settings
   */
  async getSettings(){
    return this.settings;
  }

  /**
   * Set all our settings
   */
  async saveSettings(settings){
    for (var i=0; i < this.settings.list.length; i++){
      if (settings[this.settings.list[i].setting] != null){
        this.settings[this.settings.list[i].setting] = settings[this.settings.list[i].setting] 
        console.log(this.settings.list[i].setting + ' changed to :' + settings[this.settings.list[i].setting]  )
      }
    }
  }

}

module.exports = loggingFile;
