/**
 * @fileoverview Provides a worker manager with queue support and thread pooling
 * for executing tasks with lifecycle management, status tracking, and event emission support.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const { Worker } = require('worker_threads');
const path = require('path');
const crypto = require('crypto');

/**
 * A class that manages multiple worker threads with queue support.
 * Provides methods for starting, stopping, and monitoring worker status.
 * @class
 */
class WorkerManager {
  /**
   * Initializes the WorkerManager with worker thread management.
   * @param {Object=} options Configuration options for the worker manager.
   * @param {number=} options.maxThreads Maximum number of concurrent worker threads (default: 4).
   * @param {EventEmitter=} eventEmitter Optional event emitter for worker events.
   */
  constructor(options = {}, eventEmitter) {
    /** @private {number} Maximum number of concurrent threads */
    this.maxThreads_ = options.maxThreads || 4;
    /** @private {Array} Queue of pending tasks */
    this.taskQueue_ = [];
    /** @private {Map} Active workers by task ID */
    this.activeWorkers_ = new Map();
    /** @private {Map} Task history with results */
    this.taskHistory_ = new Map();
    /** @private @const {EventEmitter} */
    this.eventEmitter_ = eventEmitter;
    /** @private {boolean} Manager running state */
    this.isRunning_ = true;
  }

  /**
   * Generates a unique task ID.
   * @private
   * @return {string} A unique task ID.
   */
  generateTaskId_() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Starts a worker task. If no slots are available, queues the task.
   * @param {string} scriptPath The absolute path to the script to execute in the worker.
   * @param {Object} data The data to be passed to the worker thread.
   * @param {Function=} completionCallback Optional callback function to be called on completion.
   * @return {Promise<string>} A promise that resolves with the task ID.
   */
  async start(scriptPath, data, completionCallback) {
    if (!this.isRunning_) {
      const error = 'Worker manager is stopped';
      if (this.eventEmitter_)
        this.eventEmitter_.emit('worker:start:error', { scriptPath, error });
      throw new Error(error);
    }

    const taskId = this.generateTaskId_();
    const task = {
      id: taskId,
      scriptPath,
      data,
      completionCallback,
      queuedAt: new Date(),
    };

    // Add to queue
    this.taskQueue_.push(task);

    if (this.eventEmitter_)
      this.eventEmitter_.emit('worker:queued', {
        taskId,
        scriptPath,
        queueLength: this.taskQueue_.length
      });

    // Try to process the queue
    this.processQueue_();

    return taskId;
  }

  /**
   * Processes the task queue, starting tasks when slots are available.
   * @private
   */
  processQueue_() {
    // Process as many tasks as we have slots for
    while (this.taskQueue_.length > 0 && this.activeWorkers_.size < this.maxThreads_) {
      const task = this.taskQueue_.shift();
      this.executeTask_(task);
    }
  }

  /**
   * Executes a single task in a worker thread.
   * @private
   * @param {Object} task The task to execute.
   */
  executeTask_(task) {
    const worker = new Worker(path.resolve(__dirname, './workerScript.js'));

    const workerInfo = {
      worker,
      task,
      startedAt: new Date(),
    };

    this.activeWorkers_.set(task.id, workerInfo);

    if (this.eventEmitter_)
      this.eventEmitter_.emit('worker:start', {
        taskId: task.id,
        scriptPath: task.scriptPath,
        data: task.data,
        activeWorkers: this.activeWorkers_.size,
        queueLength: this.taskQueue_.length,
      });

    worker.on('message', (message) => {
      if (message.type === 'status') {
        if (this.eventEmitter_)
          this.eventEmitter_.emit('worker:status', {
            taskId: task.id,
            status: message.status,
            data: message.data,
          });

        if (message.status === 'completed' || message.status === 'error') {
          // Store in task history
          this.taskHistory_.set(task.id, {
            taskId: task.id,
            scriptPath: task.scriptPath,
            status: message.status,
            result: message.data,
            queuedAt: task.queuedAt,
            startedAt: workerInfo.startedAt,
            completedAt: new Date(),
          });

          // Call completion callback
          if (task.completionCallback) {
            try {
              task.completionCallback(message.status, message.data);
            } catch (err) {
              console.error('Error in completion callback:', err);
              if (this.eventEmitter_)
                this.eventEmitter_.emit('worker:callback:error', {
                  taskId: task.id,
                  error: err.message
                });
            }
          }

          // Clean up this worker
          this.cleanupWorker_(task.id);
        }
      }
    });

    worker.on('error', (err) => {
      console.error('Worker error:', err);

      // Store error in task history
      this.taskHistory_.set(task.id, {
        taskId: task.id,
        scriptPath: task.scriptPath,
        status: 'error',
        error: err.message,
        queuedAt: task.queuedAt,
        startedAt: workerInfo.startedAt,
        completedAt: new Date(),
      });

      if (this.eventEmitter_)
        this.eventEmitter_.emit('worker:error', {
          taskId: task.id,
          error: err.message
        });

      // Call completion callback with error
      if (task.completionCallback) {
        try {
          task.completionCallback('error', err.message);
        } catch (callbackErr) {
          console.error('Error in completion callback:', callbackErr);
        }
      }

      this.cleanupWorker_(task.id);
    });

    worker.on('exit', (code) => {
      // Only treat non-zero exit codes as errors if the task wasn't already marked as completed
      const taskInHistory = this.taskHistory_.get(task.id);
      if (code !== 0 && (!taskInHistory || taskInHistory.status !== 'completed')) {
        const errorMsg = `Worker exited with code ${code}`;
        console.error(errorMsg);

        // Only store if not already in history (error handler may have already stored it)
        if (!taskInHistory) {
          this.taskHistory_.set(task.id, {
            taskId: task.id,
            scriptPath: task.scriptPath,
            status: 'error',
            error: errorMsg,
            queuedAt: task.queuedAt,
            startedAt: workerInfo.startedAt,
            completedAt: new Date(),
          });

          if (task.completionCallback) {
            try {
              task.completionCallback('error', errorMsg);
            } catch (err) {
              console.error('Error in completion callback:', err);
            }
          }
        }

        if (this.eventEmitter_)
          this.eventEmitter_.emit('worker:exit:error', {
            taskId: task.id,
            code
          });
      }

      if (this.eventEmitter_)
        this.eventEmitter_.emit('worker:exit', {
          taskId: task.id,
          code
        });

      this.cleanupWorker_(task.id);
    });

    // Send the task to the worker
    worker.postMessage({
      type: 'start',
      scriptPath: task.scriptPath,
      data: task.data,
    });
  }

  /**
   * Cleans up a worker and processes the next queued task.
   * @private
   * @param {string} taskId The task ID to clean up.
   */
  cleanupWorker_(taskId) {
    const workerInfo = this.activeWorkers_.get(taskId);
    if (workerInfo) {
      try {
        workerInfo.worker.terminate();
      } catch (err) {
        // Worker may already be terminated
      }
      this.activeWorkers_.delete(taskId);
    }

    // Process next task in queue
    if (this.isRunning_) {
      this.processQueue_();
    }
  }

  /**
   * Stops the worker manager and terminates all active workers.
   * @return {Promise<void>} A promise that resolves when all workers are stopped.
   */
  async stop() {
    this.isRunning_ = false;

    // Clear the queue
    const queuedTasks = this.taskQueue_.length;
    this.taskQueue_ = [];

    if (this.eventEmitter_)
      this.eventEmitter_.emit('worker:manager:stopping', {
        queuedTasks,
        activeWorkers: this.activeWorkers_.size
      });

    // Terminate all active workers
    const terminationPromises = [];
    for (const [taskId, workerInfo] of this.activeWorkers_.entries()) {
      terminationPromises.push(
        new Promise((resolve) => {
          try {
            workerInfo.worker.terminate().then(resolve).catch(resolve);
          } catch (err) {
            resolve();
          }
        })
      );
    }

    await Promise.all(terminationPromises);
    this.activeWorkers_.clear();

    if (this.eventEmitter_)
      this.eventEmitter_.emit('worker:manager:stopped');
  }

  /**
   * Gets the current status of the worker manager.
   * @return {Promise<Object>} A promise that resolves to the current status.
   */
  async getStatus() {
    return {
      isRunning: this.isRunning_,
      maxThreads: this.maxThreads_,
      activeWorkers: this.activeWorkers_.size,
      queuedTasks: this.taskQueue_.length,
      completedTasks: this.taskHistory_.size,
    };
  }

  /**
   * Gets the task history.
   * @param {number=} limit Maximum number of recent tasks to return.
   * @return {Promise<Array>} A promise that resolves to an array of task history entries.
   */
  async getTaskHistory(limit = 100) {
    const history = Array.from(this.taskHistory_.values())
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, limit);
    return history;
  }

  /**
   * Gets a specific task's information from history.
   * @param {string} taskId The task ID.
   * @return {Promise<?Object>} A promise that resolves to the task info or null.
   */
  async getTask(taskId) {
    return this.taskHistory_.get(taskId) || null;
  }
}

module.exports = WorkerManager;
