/**
 * @fileoverview Provides a singleton scheduler for executing tasks at intervals
 * using worker threads with task management and event emission support.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const analytics = require('../modules/analytics');

/**
 * A class that manages scheduling and execution of tasks in worker threads.
 * Provides methods for starting, stopping, and monitoring scheduled tasks.
 * Uses the working service for task execution via dependency injection.
 * @class
 */
class SchedulerProvider {
  /**
   * Initializes the SchedulerProvider with task storage and worker instance.
   * @param {Object=} options Configuration options for the scheduler.
   * @param {EventEmitter=} eventEmitter Optional event emitter for scheduler events.
   * @param {Object=} workingService Working service instance for task execution.
   */
  constructor(options, eventEmitter, workingService) {
    /** @private @const {EventEmitter} */
    this.eventEmitter_ = eventEmitter;
    /** @private @const {!Map<string, !Object>} */
    this.tasks_ = new Map();
    /** @private @const {WorkerProvider} */
    this.worker_ = workingService;

    if (!this.worker_) {
      throw new Error('Working service is required for SchedulerProvider');
    }

    // Settings configuration
    this.settings = {};
    this.settings.description = "Configuration settings for the scheduling service";
    this.settings.list = [
      { setting: 'maxConcurrentJobs', type: 'number', values: null },
      { setting: 'retryAttempts', type: 'number', values: null },
      { setting: 'jobTimeout', type: 'number', values: null }
    ];
    this.settings.maxConcurrentJobs = options.maxConcurrentJobs || 10;
    this.settings.retryAttempts = options.retryAttempts || 3;
    this.settings.jobTimeout = options.jobTimeout || 30000;
  }

  /**
   * Starts the scheduler to execute a script at a given interval.
   * @param {string} taskName The name of the task to schedule.
   * @param {string} scriptPath The absolute path to the Node.js file to execute.
   * @param {*|number} dataOrInterval The data to pass to the script, or interval if 3 args provided.
   * @param {number=} intervalSeconds The interval in seconds at which to execute the script.
   * @param {Function=} executionCallback Optional callback function to be called on each execution.
   * @return {Promise<void>} A promise that resolves when the task is started.
   * @throws {Error} When a task with the same name is already scheduled.
   */
  async start(taskName, scriptPath, dataOrInterval, intervalSeconds, executionCallback) {
    // Handle different calling patterns for backward compatibility
    let data, interval, callback;
    
    if (arguments.length === 3) {
      // start(taskName, scriptPath, intervalSeconds)
      data = null;
      interval = dataOrInterval;
      callback = undefined;
    } else if (arguments.length === 4) {
      // start(taskName, scriptPath, intervalSeconds, executionCallback)
      data = null;
      interval = dataOrInterval;
      callback = intervalSeconds;
    } else {
      // start(taskName, scriptPath, data, intervalSeconds, executionCallback)
      data = dataOrInterval;
      interval = intervalSeconds;
      callback = executionCallback;
    }
    if (this.tasks_.has(taskName)) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('scheduler:start:error', {
          taskName,
          error: 'Task already scheduled.',
        });
      return;
    }

    const executeTask = () => {
      // Track as running when execution starts
      analytics.trackScheduleRunning(taskName);

      this.worker_.start(scriptPath, data, (status, data) => {
        // Track completion or error based on status
        if (status === 'completed' || status === 'success') {
          analytics.trackScheduleCompleted(taskName);
        } else if (status === 'error' || status === 'failed') {
          analytics.trackScheduleError(taskName);
        } else {
          // Default to completed for other statuses
          analytics.trackScheduleCompleted(taskName);
        }

        if (callback) {
          callback(status, data);
        }
        if (this.eventEmitter_)
          this.eventEmitter_.emit('scheduler:taskExecuted', {
            taskName,
            scriptPath,
            status,
            data,
          });
      });
    };

    // Execute immediately and then at intervals
    executeTask();
    const intervalId = setInterval(executeTask, interval * 1000);
    this.tasks_.set(taskName, {
      intervalId,
      scriptPath,
      executionCallback: callback,
    });

    // Track schedule as started
    analytics.trackScheduleStarted(taskName);

    if (this.eventEmitter_)
      this.eventEmitter_.emit('scheduler:started', {
        taskName,
        scriptPath,
        intervalSeconds: interval,
      });
  }

  /**
   * Stops a specific task or all tasks if no task name is provided.
   * @param {string=} taskName The name of the task to stop (optional).
   * @return {Promise<void>} A promise that resolves when the task(s) are stopped.
   */
  async stop(taskName) {
    if (taskName) {
      if (this.tasks_.has(taskName)) {
        const task = this.tasks_.get(taskName);
        clearInterval(task.intervalId);
        this.tasks_.delete(taskName);

        // Track schedule as stopped
        analytics.trackScheduleStopped(taskName);

        if (this.eventEmitter_)
          this.eventEmitter_.emit('scheduler:stopped', { taskName });
      }
    } else {
      this.tasks_.forEach((task, name) => {
        clearInterval(task.intervalId);

        // Track each schedule as stopped
        analytics.trackScheduleStopped(name);

        if (this.eventEmitter_)
          this.eventEmitter_.emit('scheduler:stopped', { taskName: name });
      });
      this.tasks_.clear();
      // Stop the worker when stopping all tasks
      if (this.worker_ && this.worker_.stop) {
        this.worker_.stop();
      }
    }
  }

  /**
   * Checks if a specific task or any task is running.
   * @param {string=} taskName The name of the task to check (optional).
   * @return {Promise<boolean>} A promise that resolves to true if the task(s) are running, false otherwise.
   */
  async isRunning(taskName) {
    if (taskName) {
      return this.tasks_.has(taskName);
    }
    return this.tasks_.size > 0;
  }

  /**
   * Get all settings for the scheduling service.
   * @return {Promise<Object>} A promise that resolves to the settings object.
   */
  async getSettings() {
    return this.settings;
  }

  /**
   * Save settings for the scheduling service.
   * @param {Object} settings The settings to save.
   * @return {Promise<void>} A promise that resolves when settings are saved.
   */
  async saveSettings(settings) {
    for (let i = 0; i < this.settings.list.length; i++) {
      if (settings[this.settings.list[i].setting] != null) {
        this.settings[this.settings.list[i].setting] = settings[this.settings.list[i].setting];
        if (this.eventEmitter_) {
          this.eventEmitter_.emit('scheduler:setting-changed', {
            setting: this.settings.list[i].setting,
            value: settings[this.settings.list[i].setting]
          });
        }
      }
    }
  }
}

module.exports = SchedulerProvider;
