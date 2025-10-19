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
 * Uses named queues for task lifecycle management:
 * - noobly-core-working-incoming: Tasks waiting to be processed
 * - noobly-core-working-complete: Successfully completed tasks
 * - noobly-core-working-error: Failed tasks
 * @class
 */
class WorkerManager {
  /**
   * Initializes the WorkerManager with worker thread management.
   * @param {Object=} options Configuration options for the worker manager.
   * @param {number=} options.maxThreads Maximum number of concurrent worker threads (default: 4).
   * @param {string=} options.activitiesFolder Path to the activities folder (default: 'activities').
   * @param {Object=} options.dependencies Injected service dependencies.
   * @param {Object=} options.dependencies.queueing Queueing service instance.
   * @param {Object=} options.dependencies.filing Filing service instance for activity resolution.
   * @param {EventEmitter=} eventEmitter Optional event emitter for worker events.
   */
  constructor(options = {}, eventEmitter) {
    /** @private {number} Maximum number of concurrent threads */
    this.maxThreads_ = options.maxThreads || 4;
    /** @private {Map} Active workers by task ID */
    this.activeWorkers_ = new Map();
    /** @private {Map} Task history with results */
    this.taskHistory_ = new Map();
    /** @private @const {EventEmitter} */
    this.eventEmitter_ = eventEmitter;
    /** @private {boolean} Manager running state */
    this.isRunning_ = true;
    /** @private {Object} Queueing service instance */
    this.queueService_ = options.dependencies?.queueing;
    /** @private {Object} Filing service instance */
    this.filingService_ = options.dependencies?.filing;
    /** @private {string} Activities folder path */
    this.activitiesFolder_ = options.activitiesFolder || options['noobly-core-activities'] || 'activities';
    /** @private {number} Queue processing interval ID */
    this.queueProcessorInterval_ = null;
    /** @private @const {string} Queue name for incoming tasks */
    this.QUEUE_INCOMING_ = 'noobly-core-working-incoming';
    /** @private @const {string} Queue name for completed tasks */
    this.QUEUE_COMPLETE_ = 'noobly-core-working-complete';
    /** @private @const {string} Queue name for error tasks */
    this.QUEUE_ERROR_ = 'noobly-core-working-error';

    // Settings configuration
    this.settings = {};
    this.settings.description = "Configuration settings for the working service";
    this.settings.list = [
      { setting: 'workerTimeout', type: 'number', values: null },
      { setting: 'maxQueueSize', type: 'number', values: null },
      { setting: 'enableLogging', type: 'boolean', values: null }
    ];
    this.settings.workerTimeout = options.workerTimeout || 300000;
    this.settings.maxQueueSize = options.maxQueueSize || 1000;
    this.settings.enableLogging = options.enableLogging !== undefined ? options.enableLogging : true;

    // Start queue processor that checks every 1 second
    this.startQueueProcessor_();
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
   * Resolves an activity script path.
   * If the path is relative (not absolute), it will be resolved from the activities folder.
   * If filing service is available, it will verify relative paths exist.
   * @private
   * @param {string} scriptPath The script path (can be relative or absolute).
   * @return {Promise<string>} A promise that resolves to the absolute script path.
   * @throws {Error} When script is not found.
   */
  async resolveActivityPath_(scriptPath) {
    // If it's already an absolute path, use it as-is (trust it exists)
    if (path.isAbsolute(scriptPath)) {
      return scriptPath;
    }

    // Build path from activities folder
    const resolvedPath = path.resolve(process.cwd(), this.activitiesFolder_, scriptPath);

    // If filing service is available, verify the relative path exists
    if (this.filingService_) {
      try {
        // Try to read the file metadata to verify it exists
        const fs = require('fs').promises;
        await fs.access(resolvedPath);
        return resolvedPath;
      } catch (error) {
        throw new Error(`Activity script not found: ${scriptPath} (resolved to: ${resolvedPath})`);
      }
    }

    return resolvedPath;
  }

  /**
   * Starts a worker task. Adds task to the incoming queue for processing.
   * @param {string} scriptPath The script path (can be relative to activities folder or absolute).
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

    if (!this.queueService_) {
      throw new Error('Queueing service is not available');
    }

    // Resolve the activity script path
    const resolvedScriptPath = await this.resolveActivityPath_(scriptPath);

    const taskId = this.generateTaskId_();
    const task = {
      id: taskId,
      scriptPath: resolvedScriptPath,
      originalScriptPath: scriptPath,
      data,
      completionCallback,
      queuedAt: new Date(),
    };

    // Add to incoming queue
    await this.queueService_.enqueue(this.QUEUE_INCOMING_, task);

    const queueSize = await this.queueService_.size(this.QUEUE_INCOMING_);

    if (this.eventEmitter_)
      this.eventEmitter_.emit('worker:queued', {
        taskId,
        scriptPath: resolvedScriptPath,
        originalScriptPath: scriptPath,
        queueName: this.QUEUE_INCOMING_,
        queueLength: queueSize
      });

    return taskId;
  }

  /**
   * Starts the queue processor that checks for available threads every 1 second.
   * @private
   */
  startQueueProcessor_() {
    if (this.queueProcessorInterval_) {
      return; // Already running
    }

    this.queueProcessorInterval_ = setInterval(async () => {
      if (this.isRunning_ && this.queueService_) {
        await this.processQueue_();
      }
    }, 1000); // Check every 1 second
  }

  /**
   * Stops the queue processor.
   * @private
   */
  stopQueueProcessor_() {
    if (this.queueProcessorInterval_) {
      clearInterval(this.queueProcessorInterval_);
      this.queueProcessorInterval_ = null;
    }
  }

  /**
   * Processes the incoming task queue, starting tasks when slots are available.
   * @private
   */
  async processQueue_() {
    if (!this.queueService_) {
      return;
    }

    // Process as many tasks as we have slots for
    while (this.activeWorkers_.size < this.maxThreads_) {
      const queueSize = await this.queueService_.size(this.QUEUE_INCOMING_);
      if (queueSize === 0) {
        break; // No more tasks to process
      }

      const task = await this.queueService_.dequeue(this.QUEUE_INCOMING_);
      if (!task) {
        break; // Queue is empty
      }

      this.executeTask_(task);
    }
  }

  /**
   * Executes a single task in a worker thread.
   * @private
   * @param {Object} task The task to execute.
   */
  async executeTask_(task) {
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
        incomingQueueSize: await this.queueService_?.size(this.QUEUE_INCOMING_) || 0,
      });

    worker.on('message', async (message) => {
      if (message.type === 'status') {
        if (this.eventEmitter_)
          this.eventEmitter_.emit('worker:status', {
            taskId: task.id,
            status: message.status,
            data: message.data,
          });

        if (message.status === 'completed' || message.status === 'error') {
          const taskResult = {
            taskId: task.id,
            scriptPath: task.scriptPath,
            status: message.status,
            result: message.data,
            queuedAt: task.queuedAt,
            startedAt: workerInfo.startedAt,
            completedAt: new Date(),
          };

          // Store in task history
          this.taskHistory_.set(task.id, taskResult);

          // Add to appropriate queue based on status
          if (this.queueService_) {
            try {
              if (message.status === 'completed') {
                await this.queueService_.enqueue(this.QUEUE_COMPLETE_, taskResult);
              } else if (message.status === 'error') {
                await this.queueService_.enqueue(this.QUEUE_ERROR_, taskResult);
              }
            } catch (err) {
              console.error('Error adding task to result queue:', err);
              if (this.eventEmitter_)
                this.eventEmitter_.emit('worker:queue:error', {
                  taskId: task.id,
                  error: err.message
                });
            }
          }

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

    worker.on('error', async (err) => {
      console.error('Worker error:', err);

      const taskResult = {
        taskId: task.id,
        scriptPath: task.scriptPath,
        status: 'error',
        error: err.message,
        queuedAt: task.queuedAt,
        startedAt: workerInfo.startedAt,
        completedAt: new Date(),
      };

      // Store error in task history
      this.taskHistory_.set(task.id, taskResult);

      // Add to error queue
      if (this.queueService_) {
        try {
          await this.queueService_.enqueue(this.QUEUE_ERROR_, taskResult);
        } catch (queueErr) {
          console.error('Error adding task to error queue:', queueErr);
          if (this.eventEmitter_)
            this.eventEmitter_.emit('worker:queue:error', {
              taskId: task.id,
              error: queueErr.message
            });
        }
      }

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

    worker.on('exit', async (code) => {
      // Only treat non-zero exit codes as errors if the task wasn't already marked as completed
      const taskInHistory = this.taskHistory_.get(task.id);
      if (code !== 0 && (!taskInHistory || taskInHistory.status !== 'completed')) {
        const errorMsg = `Worker exited with code ${code}`;
        console.error(errorMsg);

        // Only store if not already in history (error handler may have already stored it)
        if (!taskInHistory) {
          const taskResult = {
            taskId: task.id,
            scriptPath: task.scriptPath,
            status: 'error',
            error: errorMsg,
            queuedAt: task.queuedAt,
            startedAt: workerInfo.startedAt,
            completedAt: new Date(),
          };

          this.taskHistory_.set(task.id, taskResult);

          // Add to error queue
          if (this.queueService_) {
            try {
              await this.queueService_.enqueue(this.QUEUE_ERROR_, taskResult);
            } catch (queueErr) {
              console.error('Error adding task to error queue:', queueErr);
              if (this.eventEmitter_)
                this.eventEmitter_.emit('worker:queue:error', {
                  taskId: task.id,
                  error: queueErr.message
                });
            }
          }

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
    // Note: Cannot pass functions directly, worker will use parentPort for logging
    worker.postMessage({
      type: 'start',
      scriptPath: task.scriptPath,
      data: task.data,
    });
  }

  /**
   * Cleans up a worker. Queue processing is handled by the interval.
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

    // Queue processing is now handled by the 1-second interval in startQueueProcessor_
  }

  /**
   * Stops the worker manager and terminates all active workers.
   * @return {Promise<void>} A promise that resolves when all workers are stopped.
   */
  async stop() {
    this.isRunning_ = false;

    // Stop the queue processor
    this.stopQueueProcessor_();

    // Get queue sizes before stopping
    const incomingQueueSize = this.queueService_
      ? await this.queueService_.size(this.QUEUE_INCOMING_)
      : 0;

    if (this.eventEmitter_)
      this.eventEmitter_.emit('worker:manager:stopping', {
        incomingQueueSize,
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
   * Gets the current status of the worker manager including all queue sizes.
   * @return {Promise<Object>} A promise that resolves to the current status.
   */
  async getStatus() {
    let incomingQueueSize = 0;
    let completeQueueSize = 0;
    let errorQueueSize = 0;

    if (this.queueService_) {
      incomingQueueSize = await this.queueService_.size(this.QUEUE_INCOMING_);
      completeQueueSize = await this.queueService_.size(this.QUEUE_COMPLETE_);
      errorQueueSize = await this.queueService_.size(this.QUEUE_ERROR_);
    }

    return {
      isRunning: this.isRunning_,
      maxThreads: this.maxThreads_,
      activeWorkers: this.activeWorkers_.size,
      queues: {
        incoming: incomingQueueSize,
        complete: completeQueueSize,
        error: errorQueueSize,
      },
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

  /**
   * Get all settings for the working service.
   * @return {Promise<Object>} A promise that resolves to the settings object.
   */
  async getSettings() {
    return this.settings;
  }

  /**
   * Save settings for the working service.
   * @param {Object} settings The settings to save.
   * @return {Promise<void>} A promise that resolves when settings are saved.
   */
  async saveSettings(settings) {
    for (let i = 0; i < this.settings.list.length; i++) {
      if (settings[this.settings.list[i].setting] != null) {
        this.settings[this.settings.list[i].setting] = settings[this.settings.list[i].setting];
        console.log(this.settings.list[i].setting + ' changed to: ' + settings[this.settings.list[i].setting]);
      }
    }
  }
}

module.exports = WorkerManager;
