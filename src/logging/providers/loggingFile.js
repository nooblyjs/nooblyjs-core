/**
 * @fileoverview A production-grade file logger with async I/O, rolling logs, and thread safety.
 * Features: size-based rotation, period-based rotation (daily/hourly), automatic file pruning,
 * and serial write queue to prevent async race conditions.
 * @author Noobly JS Team
 * @version 1.1.0
 * @since 1.0.0
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('os');

/**
 * A production-grade file logger with rolling log support.
 * Provides async logging with size and period-based file rotation.
 * All file operations are serialized through a promise queue to ensure thread safety.
 * @class
 */
class loggingFile {
  /**
   * Initializes the file logger with async I/O and rolling log support.
   * @param {Object=} options Configuration options for the file logger.
   * @param {string=} options.filename The name of the file to log to (defaults to 'app.YYYY-MM-DD.log').
   * @param {string=} options.logDir Directory to store log files (defaults to '.logs').
   * @param {string=} options.instanceName Instance name suffix for event emission (defaults to 'default').
   * @param {Object=} options.log Logging level configuration.
   * @param {string=} options.log.level Minimum log level ('error', 'warn', 'info', 'log').
   * @param {number=} options.maxSize Maximum file size in bytes before rotation (default: 10 MB, 0 = disabled).
   * @param {number=} options.maxFiles Maximum number of rotated files to keep (default: 5).
   * @param {string=} options.rotatePeriod Rotation period: 'daily', 'hourly', or 'none' (default: 'daily').
   * @param {EventEmitter=} eventEmitter Optional event emitter for log events.
   */
  constructor(options = {}, eventEmitter) {
    this.settings = {};
    this.settings.description = 'File logger with rolling log support. Settings: minLogLevel, logDir, maxSize, maxFiles, rotatePeriod';
    this.settings.list = [
      { setting: 'minLogLevel', type: 'list', values: ['error', 'warn', 'info', 'log'] },
      { setting: 'logDir', type: 'string', values: ['.logs'] },
      { setting: 'maxSize', type: 'number', values: [10485760] },
      { setting: 'maxFiles', type: 'number', values: [5] },
      { setting: 'rotatePeriod', type: 'list', values: ['daily', 'hourly', 'none'] }
    ];

    this.settings.logDir = options.logDir || '.logs';
    this.settings.maxSize = (options.maxSize !== undefined) ? options.maxSize : 10 * 1024 * 1024;
    this.settings.maxFiles = (options.maxFiles !== undefined) ? options.maxFiles : 5;
    this.settings.rotatePeriod = options.rotatePeriod || 'daily';

    const defaultFilename = options.filename || this.generateDefaultFilename_();
    this.filename_ = path.isAbsolute(defaultFilename)
      ? defaultFilename
      : path.join(this.settings.logDir, defaultFilename);

    this.eventEmitter_ = eventEmitter;
    this.instanceName_ = (options && options.instanceName) || 'default';

    if (options && options.log) {
      this.settings.minLogLevel = options.log.level || 'info';
    }

    // Initialize async write queue (promise chain for serialization)
    this.writeQueue_ = Promise.resolve();

    // Current rotation period key (for period-based rotation)
    this.currentPeriodKey_ = this._computePeriodKey_();

    // Ensure log directory exists (synchronous, done once at startup)
    this.initializeLogDir_();
  }

  /**
   * Determines the priority of a log level.
   * @param {string} level The log level
   * @return {number} Index in priority order (0 = highest, 3 = lowest)
   */
  determineLogLevelPriority(level) {
    const levels = ['error', 'warn', 'info', 'log'];
    return levels.indexOf(level);
  }

  /**
   * Determines if a message should be logged based on its level and the minimum log level.
   * @param {string} level The log level to check
   * @return {boolean} True if the message should be logged
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
   * Synchronous operation (called in constructor).
   * @private
   */
  initializeLogDir_() {
    try {
      if (!fs.existsSync(this.settings.logDir)) {
        fs.mkdirSync(this.settings.logDir, { recursive: true });
      }
    } catch (error) {
      process.stderr.write(`Could not create log directory ${this.settings.logDir}: ${error.message}\n`);
    }
  }

  /**
   * Computes the current rotation period key for period-based rotation.
   * @return {string} Period key: "YYYY-MM-DD" (daily), "YYYY-MM-DD-HH" (hourly), or "" (none)
   * @private
   */
  _computePeriodKey_() {
    if (this.settings.rotatePeriod === 'none') {
      return '';
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    if (this.settings.rotatePeriod === 'hourly') {
      const hour = String(now.getHours()).padStart(2, '0');
      return `${year}-${month}-${day}-${hour}`;
    }

    // daily
    return `${year}-${month}-${day}`;
  }

  /**
   * Formats a log message with timestamp, level, and device info.
   * @param {string} level The log level ('info', 'warn', 'error', or 'log')
   * @param {string} message The log message text
   * @param {*=} meta Optional metadata to include
   * @return {string} Formatted log line
   * @private
   */
  _formatLogLine_(level, message, meta) {
    const timestamp = new Date().toISOString();
    const device = os.hostname();

    // Formatted log: timestamp - LEVEL - device - message
    let logMessage = `${timestamp} - ${level.toUpperCase()} - ${device} - ${message}`;

    // Append metadata if present
    if (meta !== undefined && meta !== null) {
      try {
        logMessage += ' ' + JSON.stringify(meta);
      } catch (err) {
        logMessage += ' [unserializable metadata]';
      }
    }

    return logMessage;
  }

  /**
   * Emits a log event through the event emitter.
   * @param {string} level The log level
   * @param {string} logMessage The formatted log message
   * @private
   */
  _emitLogEvent_(level, logMessage) {
    if (this.eventEmitter_) {
      const eventName = `log:${level}:${this.instanceName_}`;
      this.eventEmitter_.emit(eventName, { filename: this.filename_, message: logMessage });
    }
  }

  /**
   * Enqueues an async operation into the write queue for serialization.
   * All file I/O is serialized through this queue to prevent race conditions.
   * @param {Function} fn An async function to execute
   * @return {Promise} A promise that resolves when the operation completes
   * @private
   */
  _enqueue_(fn) {
    this.writeQueue_ = this.writeQueue_
      .then(fn)
      .catch(() => {
        // Swallow queue errors to prevent permanent rejection state
        // Individual operations handle their own errors internally
      });
    return this.writeQueue_;
  }

  /**
   * Writes a log entry to the file (async, queued).
   * @param {string} logMessage The formatted log message
   * @return {Promise<void>}
   * @private
   */
  async _writeEntry_(logMessage) {
    await fs.promises.appendFile(this.filename_, logMessage + '\n');
  }

  /**
   * Checks if log rotation is needed (by period or size) and performs rotation if necessary.
   * Called after every write.
   * @return {Promise<void>}
   * @private
   */
  async _checkRotation_() {
    // Period-based rotation check
    if (this.settings.rotatePeriod !== 'none') {
      const currentKey = this._computePeriodKey_();
      if (currentKey !== this.currentPeriodKey_) {
        await this._rotateLogs_();
        this.currentPeriodKey_ = currentKey;
        return; // After rotation, size check against empty file is not needed
      }
    }

    // Size-based rotation check
    if (this.settings.maxSize > 0) {
      const stat = await fs.promises.stat(this.filename_);
      if (stat.size >= this.settings.maxSize) {
        await this._rotateLogs_();
      }
    }
  }

  /**
   * Constructs the path to a rotated log file.
   * @param {number} index The rotation index (1, 2, 3, ...)
   * @return {string} The rotated file path
   * @private
   */
  _rotatedPath_(index) {
    const ext = path.extname(this.filename_);
    const base = this.filename_.slice(0, -ext.length);
    return `${base}.${index}${ext}`;
  }

  /**
   * Checks if a file exists (async).
   * @param {string} filePath The path to check
   * @return {Promise<boolean>} True if the file exists
   * @private
   */
  async _fileExists_(filePath) {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Performs log rotation: shifts all rotated files down by index, renames active file to .1.
   * Then prunes old files beyond maxFiles.
   * @return {Promise<void>}
   * @private
   */
  async _rotateLogs_() {
    // Shift rotated files down: work from highest index to lowest
    // This ensures we never overwrite a file we haven't moved yet
    for (let i = this.settings.maxFiles - 1; i >= 1; i--) {
      const src = this._rotatedPath_(i);
      const dst = this._rotatedPath_(i + 1);
      const exists = await this._fileExists_(src);
      if (exists) {
        try {
          await fs.promises.rename(src, dst);
        } catch (err) {
          // Silently skip rename errors (file may have been deleted)
          // Continue with next file
        }
      }
    }

    // Rename active file to .1
    const activeExists = await this._fileExists_(this.filename_);
    if (activeExists) {
      try {
        await fs.promises.rename(this.filename_, this._rotatedPath_(1));
      } catch (err) {
        // If rename fails, continue; next write will create a new file
      }
    }

    // Delete files beyond maxFiles (pruning)
    await this._pruneOldLogs_();
  }

  /**
   * Deletes log files at indices greater than maxFiles to enforce retention policy.
   * @return {Promise<void>}
   * @private
   */
  async _pruneOldLogs_() {
    for (let i = this.settings.maxFiles + 1; ; i++) {
      const target = this._rotatedPath_(i);
      const exists = await this._fileExists_(target);
      if (!exists) break; // Stop at first gap
      try {
        await fs.promises.unlink(target);
      } catch (err) {
        // Silently ignore deletion errors; may have been deleted by another process
        break;
      }
    }
  }

  /**
   * Core write operation: formats message, emits event, queues write and rotation check.
   * @param {string} level The log level
   * @param {string} message The log message
   * @param {*=} meta Optional metadata
   * @return {Promise<void>}
   * @private
   */
  async _writeLog_(level, message, meta) {
    const logMessage = this._formatLogLine_(level, message, meta);
    this._emitLogEvent_(level, logMessage); // Emit synchronously before queue

    return this._enqueue_(async () => {
      try {
        await this._writeEntry_(logMessage);
      } catch (writeErr) {
        this._emitLogEvent_('warn', `File write failed: ${writeErr.message}`);
        return; // Exit on write failure, don't attempt rotation
      }

      try {
        await this._checkRotation_();
      } catch (rotErr) {
        this._emitLogEvent_('warn', `Log rotation failed: ${rotErr.message}`);
        // Continue; logging continues to current file despite rotation failure
      }
    });
  }

  /**
   * Logs an info message to a file with async I/O and rolling log support.
   * @param {string} message The message to log
   * @param {*=} meta Optional metadata to include
   * @return {Promise<void>} A promise that resolves when the message is logged
   */
  async info(message, meta) {
    if (!this.shouldLog('info')) {
      return;
    }
    return this._writeLog_('info', message, meta);
  }

  /**
   * Logs a warning message to a file with async I/O and rolling log support.
   * @param {string} message The message to log
   * @param {*=} meta Optional metadata to include
   * @return {Promise<void>} A promise that resolves when the message is logged
   */
  async warn(message, meta) {
    if (!this.shouldLog('warn')) {
      return;
    }
    return this._writeLog_('warn', message, meta);
  }

  /**
   * Logs an error message to a file with async I/O and rolling log support.
   * @param {string} message The message to log
   * @param {*=} meta Optional metadata to include
   * @return {Promise<void>} A promise that resolves when the message is logged
   */
  async error(message, meta) {
    if (!this.shouldLog('error')) {
      return;
    }
    return this._writeLog_('error', message, meta);
  }

  /**
   * Logs a debug message to a file with async I/O and rolling log support.
   * @param {string} message The message to log
   * @param {*=} meta Optional metadata to include
   * @return {Promise<void>} A promise that resolves when the message is logged
   */
  async debug(message, meta) {
    if (!this.shouldLog('log')) {
      return;
    }
    return this._writeLog_('log', message, meta);
  }

  /**
   * Logs a generic message to a file with async I/O and rolling log support (alias for debug).
   * @param {string} message The message to log
   * @param {*=} meta Optional metadata to include
   * @return {Promise<void>} A promise that resolves when the message is logged
   */
  async log(message, meta) {
    return this.debug(message, meta);
  }

  /**
   * Retrieves the current settings object.
   * @return {Promise<Object>} The settings object
   */
  async getSettings() {
    return this.settings;
  }

  /**
   * Saves updated settings.
   * @param {Object} settings Updated settings to save
   * @return {Promise<void>}
   */
  async saveSettings(settings) {
    for (let i = 0; i < this.settings.list.length; i++) {
      const settingName = this.settings.list[i].setting;
      if (settings[settingName] != null) {
        this.settings[settingName] = settings[settingName];
      }
    }
  }
}

module.exports = loggingFile;
