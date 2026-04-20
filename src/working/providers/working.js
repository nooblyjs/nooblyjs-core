/**
 * @fileoverview Production worker manager.
 *
 * Owns a pool of `worker_threads` Workers and dispatches queued tasks to
 * them. Tasks are persisted in three named queues from the injected queueing
 * service so the lifecycle is observable from outside the process:
 *
 *   - `nooblyjs-core-working-incoming` — tasks waiting to start
 *   - `nooblyjs-core-working-complete` — finished successfully
 *   - `nooblyjs-core-working-error`    — finished in error
 *
 * Behaviour is governed by three settings, each enforced at runtime:
 *
 *   - `workerTimeout` — wall-clock budget per task in ms; an exceeded task is
 *     terminated, recorded as an error, and the worker slot freed.
 *   - `maxQueueSize`  — refuses new `start()` calls when the incoming queue
 *     is at the cap, returning a structured error rather than silently
 *     growing memory.
 *   - `enableLogging` — gates the structured logger calls so high-volume
 *     deployments can opt out of per-task log lines.
 *
 * The queue processor is a 1-second interval that is `unref()`'d so it does
 * not keep the Node event loop alive on its own — long-running services
 * still tick, but unit tests and short-lived scripts exit cleanly.
 *
 * @author Noobly JS Core Team
 * @version 2.0.0
 * @since 1.0.0
 */

'use strict';

const { Worker } = require('worker_threads');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

/** @const {number} Queue processor poll interval in ms. */
const QUEUE_TICK_MS = 1000;

/** @const {number} Max task history entries kept in memory. */
const TASK_HISTORY_LIMIT = 1000;

/**
 * Production-grade worker manager.
 *
 * @class
 */
class WorkerManager {
  /**
   * @param {Object=} options Configuration options.
   * @param {number=} options.maxThreads Max concurrent worker threads (default 4).
   * @param {number=} options.workerTimeout Per-task timeout in ms (default 300000).
   * @param {number=} options.maxQueueSize Max incoming queue depth (default 1000).
   * @param {boolean=} options.enableLogging Whether to emit per-task logs (default true).
   * @param {string=} options.activitiesFolder Folder for relative script paths.
   * @param {Object=} options.dependencies Injected service dependencies.
   * @param {Object=} options.dependencies.queueing Queueing service (required).
   * @param {Object=} options.dependencies.filing Filing service (optional).
   * @param {EventEmitter=} eventEmitter Optional event emitter.
   */
  constructor(options = {}, eventEmitter) {
    /** @private @const {?EventEmitter} */
    this.eventEmitter_ = eventEmitter || null;

    /** @private {?Object} Logger injected by the factory. */
    this.logger = null;

    // Settings configuration. Field metadata is exposed via getSettings()
    // for use by the settings UI; the actual values live alongside it.
    this.settings = {
      description: 'Configuration settings for the working service',
      list: [
        { setting: 'workerTimeout', type: 'number',  values: null },
        { setting: 'maxQueueSize',  type: 'number',  values: null },
        { setting: 'enableLogging', type: 'boolean', values: null }
      ],
      workerTimeout: this.coerceNumber_(options.workerTimeout, 300000, 1000),
      maxQueueSize:  this.coerceNumber_(options.maxQueueSize,  1000,   1),
      enableLogging: options.enableLogging !== undefined ? !!options.enableLogging : true
    };

    /** @private @const {number} Maximum concurrent worker threads. */
    this.maxThreads_ = this.coerceNumber_(options.maxThreads, 4, 1);

    /** @private @const {!Map<string, !Object>} */
    this.activeWorkers_ = new Map();

    /** @private @const {!Map<string, !Object>} */
    this.taskHistory_ = new Map();

    /** @private {boolean} Manager running state. */
    this.isRunning_ = true;

    /** @private {?Object} Queueing service instance. */
    this.queueService_ = options.dependencies?.queueing || null;

    /** @private {?Object} Filing service instance. */
    this.filingService_ = options.dependencies?.filing || null;

    /** @private @const {string} Activities folder path. */
    this.activitiesFolder_ =
      options.activitiesFolder ||
      options['nooblyjs-core-activities'] ||
      'activities';

    /** @private {?NodeJS.Timeout} Queue processing interval. */
    this.queueProcessorInterval_ = null;

    /** @private @const {string} Queue name for incoming tasks. */
    this.QUEUE_INCOMING_ = 'nooblyjs-core-working-incoming';
    /** @private @const {string} Queue name for completed tasks. */
    this.QUEUE_COMPLETE_ = 'nooblyjs-core-working-complete';
    /** @private @const {string} Queue name for error tasks. */
    this.QUEUE_ERROR_ = 'nooblyjs-core-working-error';

    if (!this.queueService_) {
      // Don't throw — the factory may attach the dependency after construction
      // in some legacy code paths. Log instead and let start() raise the error
      // when actually invoked.
      this.logger?.warn?.(`[${this.constructor.name}] Queueing service not provided; start() will fail until one is supplied`);
    }

    this.startQueueProcessor_();
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  /**
   * Coerces a value to a positive number with a fallback. Used so that
   * settings posted as strings still produce valid numeric configuration.
   *
   * @private
   * @param {*} value
   * @param {number} fallback
   * @param {number=} min Minimum acceptable value (defaults to 0).
   * @return {number}
   */
  coerceNumber_(value, fallback, min = 0) {
    const n = Number(value);
    return Number.isFinite(n) && n >= min ? n : fallback;
  }

  /**
   * Returns the current settings object (with metadata).
   * @return {Promise<!Object>}
   */
  async getSettings() {
    return this.settings;
  }

  /**
   * Applies a partial settings update. Unknown keys are ignored. Each
   * accepted setting emits a `worker:setting-changed` event so observers
   * (e.g. the analytics module or external dashboards) can react.
   *
   * @param {!Object} updates
   * @return {Promise<void>}
   */
  async saveSettings(updates) {
    if (!updates || typeof updates !== 'object') return;

    for (const { setting, type } of this.settings.list) {
      if (updates[setting] == null) continue;

      let value = updates[setting];
      if (type === 'number') {
        value = this.coerceNumber_(value, this.settings[setting], 0);
      } else if (type === 'boolean') {
        value = !!value;
      }

      this.settings[setting] = value;
      this.logIf_('info', 'Setting changed', { setting, value });
      this.eventEmitter_?.emit('worker:setting-changed', { setting, value });
    }
  }

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  /**
   * Routes a log line through the injected logger if logging is enabled.
   * Falls silent if either condition is false.
   *
   * @private
   * @param {string} level
   * @param {string} message
   * @param {Object=} meta
   */
  logIf_(level, message, meta = {}) {
    if (!this.settings.enableLogging) return;
    this.logger?.[level]?.(`[${this.constructor.name}] ${message}`, meta);
  }

  // ---------------------------------------------------------------------------
  // Task lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Generates a unique task ID. Hex is used so the ID is URL-safe and easy
   * to log.
   * @private
   * @return {string}
   */
  generateTaskId_() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Resolves an activity script path to an absolute filesystem path.
   * Absolute inputs are trusted as-is; relative inputs are resolved against
   * the configured activities folder and verified to exist.
   *
   * @private
   * @param {string} scriptPath
   * @return {Promise<string>}
   * @throws {Error} If the resolved path does not exist.
   */
  async resolveActivityPath_(scriptPath) {
    if (path.isAbsolute(scriptPath)) {
      return scriptPath;
    }

    const resolvedPath = path.resolve(process.cwd(), this.activitiesFolder_, scriptPath);

    // Verify existence so we fail fast at queue time, not later inside a
    // worker. Only enforced when filing service is wired in (legacy).
    if (this.filingService_) {
      try {
        await fs.promises.access(resolvedPath);
      } catch (err) {
        throw new Error(`Activity script not found: ${scriptPath} (resolved to: ${resolvedPath})`);
      }
    }

    return resolvedPath;
  }

  /**
   * Queues a task for execution. Returns the new task ID immediately; the
   * actual worker thread is created when the queue processor next picks up
   * the task and a worker slot is free.
   *
   * @param {string} scriptPath Absolute or activities-relative script path.
   * @param {*=} data Payload passed to the worker script's `run` function.
   * @param {Function=} completionCallback Optional `(status, data) => void` callback.
   * @return {Promise<string>} The newly assigned task ID.
   * @throws {Error} If the manager is stopped, the queue is full, or the
   *   activity path cannot be resolved.
   */
  async start(scriptPath, data, completionCallback) {
    if (!this.isRunning_) {
      const error = 'Worker manager is stopped';
      this.eventEmitter_?.emit('worker:start:error', { scriptPath, error });
      throw new Error(error);
    }

    if (!this.queueService_) {
      const error = 'Queueing service is not available';
      this.eventEmitter_?.emit('worker:start:error', { scriptPath, error });
      throw new Error(error);
    }

    if (typeof scriptPath !== 'string' || scriptPath.length === 0) {
      const error = 'scriptPath must be a non-empty string';
      this.eventEmitter_?.emit('worker:start:error', { scriptPath, error });
      throw new Error(error);
    }

    // Enforce queue cap before resolving paths so a flood of bad calls cannot
    // pin the event loop on filesystem checks.
    const currentSize = await this.queueService_.size(this.QUEUE_INCOMING_);
    if (currentSize >= this.settings.maxQueueSize) {
      const error = `Incoming queue at capacity (${this.settings.maxQueueSize})`;
      this.eventEmitter_?.emit('worker:start:error', { scriptPath, error });
      this.logIf_('warn', 'Rejected task — queue full', {
        scriptPath,
        queueSize: currentSize,
        cap: this.settings.maxQueueSize
      });
      throw new Error(error);
    }

    const resolvedScriptPath = await this.resolveActivityPath_(scriptPath);

    const taskId = this.generateTaskId_();
    const task = {
      id: taskId,
      scriptPath: resolvedScriptPath,
      originalScriptPath: scriptPath,
      data,
      completionCallback,
      queuedAt: new Date()
    };

    await this.queueService_.enqueue(this.QUEUE_INCOMING_, task);
    const queueSize = await this.queueService_.size(this.QUEUE_INCOMING_);

    this.eventEmitter_?.emit('worker:queued', {
      taskId,
      scriptPath: resolvedScriptPath,
      originalScriptPath: scriptPath,
      queueName: this.QUEUE_INCOMING_,
      queueLength: queueSize
    });

    this.logIf_('info', 'Task queued', {
      taskId,
      scriptPath: resolvedScriptPath,
      queueLength: queueSize
    });

    return taskId;
  }

  // ---------------------------------------------------------------------------
  // Queue processor
  // ---------------------------------------------------------------------------

  /**
   * Starts the polling queue processor. The interval is `unref()`'d so it
   * does not keep the Node event loop alive on its own — useful for tests.
   * @private
   */
  startQueueProcessor_() {
    if (this.queueProcessorInterval_) return;

    this.queueProcessorInterval_ = setInterval(() => {
      if (!this.isRunning_ || !this.queueService_) return;
      this.processQueue_().catch((err) => {
        this.logIf_('error', 'Queue processor tick failed', { error: err?.message });
      });
    }, QUEUE_TICK_MS);

    // Don't keep the event loop alive just for the poller.
    if (typeof this.queueProcessorInterval_.unref === 'function') {
      this.queueProcessorInterval_.unref();
    }
  }

  /**
   * Stops the polling queue processor.
   * @private
   */
  stopQueueProcessor_() {
    if (this.queueProcessorInterval_) {
      clearInterval(this.queueProcessorInterval_);
      this.queueProcessorInterval_ = null;
    }
  }

  /**
   * Drains as many tasks from the incoming queue as there are free worker
   * slots, dispatching each into a fresh worker thread.
   * @return {Promise<void>}
   */
  async processQueue_() {
    if (!this.queueService_ || !this.isRunning_) return;

    while (this.activeWorkers_.size < this.maxThreads_) {
      const queueSize = await this.queueService_.size(this.QUEUE_INCOMING_);
      if (queueSize === 0) break;

      const task = await this.queueService_.dequeue(this.QUEUE_INCOMING_);
      if (!task) break;

      // Fire and forget — executeTask_ owns its own error handling.
      this.executeTask_(task);
    }
  }

  // ---------------------------------------------------------------------------
  // Worker execution
  // ---------------------------------------------------------------------------

  /**
   * Executes a single task in a fresh worker thread. Wires up message,
   * error, exit, and timeout handlers, and persists the result to either
   * the complete or error queue.
   *
   * @private
   * @param {!Object} task
   */
  async executeTask_(task) {
    let worker;
    try {
      worker = new Worker(path.resolve(__dirname, './workerScript.js'));
    } catch (err) {
      // Failure to even spawn a worker — record as error and bail.
      await this.recordError_(task, null, err.message, 'spawn');
      return;
    }

    const workerInfo = {
      worker,
      task,
      startedAt: new Date(),
      timeoutHandle: null,
      finalised: false
    };

    this.activeWorkers_.set(task.id, workerInfo);

    // Wall-clock timeout. Treats the task as errored and tears down the
    // worker even if the user code never returns. retryAttempts are not
    // honoured here because timeouts are typically unrecoverable.
    workerInfo.timeoutHandle = setTimeout(() => {
      if (workerInfo.finalised) return;
      this.handleTimeout_(workerInfo);
    }, this.settings.workerTimeout);
    if (typeof workerInfo.timeoutHandle.unref === 'function') {
      workerInfo.timeoutHandle.unref();
    }

    let incomingQueueSize = 0;
    try {
      incomingQueueSize = await this.queueService_.size(this.QUEUE_INCOMING_);
    } catch (_) { /* size is best-effort metadata */ }

    this.eventEmitter_?.emit('worker:start', {
      taskId: task.id,
      scriptPath: task.scriptPath,
      data: task.data,
      activeWorkers: this.activeWorkers_.size,
      incomingQueueSize
    });

    this.logIf_('info', 'Worker started', {
      taskId: task.id,
      scriptPath: task.scriptPath,
      activeWorkers: this.activeWorkers_.size
    });

    worker.on('message', async (message) => {
      if (!message || message.type !== 'status') return;

      this.eventEmitter_?.emit('worker:status', {
        taskId: task.id,
        status: message.status,
        data: message.data
      });

      if (message.status === 'completed' || message.status === 'error') {
        await this.finaliseTask_(workerInfo, message.status, message.data);
      }
    });

    worker.on('error', async (err) => {
      await this.recordError_(task, workerInfo, err.message, 'worker:error');
    });

    worker.on('exit', async (code) => {
      const taskInHistory = this.taskHistory_.get(task.id);
      if (code !== 0 && (!taskInHistory || taskInHistory.status !== 'completed')) {
        const errorMsg = `Worker exited with code ${code}`;
        if (!taskInHistory) {
          await this.recordError_(task, workerInfo, errorMsg, 'worker:exit');
        }
        this.eventEmitter_?.emit('worker:exit:error', { taskId: task.id, code });
      }
      this.eventEmitter_?.emit('worker:exit', { taskId: task.id, code });
      this.cleanupWorker_(task.id);
    });

    worker.postMessage({
      type: 'start',
      scriptPath: task.scriptPath,
      data: task.data
    });
  }

  /**
   * Marks a task as complete or errored, enqueues the result, fires the
   * user callback, and tears down the worker. Idempotent: subsequent calls
   * for the same workerInfo are no-ops so timeout + completion races don't
   * double-emit.
   *
   * @private
   * @param {!Object} workerInfo
   * @param {string} status `'completed'` or `'error'`.
   * @param {*} data Result payload (or error message for errors).
   */
  async finaliseTask_(workerInfo, status, data) {
    if (workerInfo.finalised) return;
    workerInfo.finalised = true;

    if (workerInfo.timeoutHandle) {
      clearTimeout(workerInfo.timeoutHandle);
      workerInfo.timeoutHandle = null;
    }

    const { task } = workerInfo;
    const taskResult = {
      taskId: task.id,
      scriptPath: task.scriptPath,
      status,
      result: status === 'completed' ? data : undefined,
      error: status === 'error' ? data : undefined,
      queuedAt: task.queuedAt,
      startedAt: workerInfo.startedAt,
      completedAt: new Date()
    };

    this.recordHistory_(taskResult);

    if (this.queueService_) {
      try {
        const queue = status === 'completed' ? this.QUEUE_COMPLETE_ : this.QUEUE_ERROR_;
        await this.queueService_.enqueue(queue, taskResult);
      } catch (err) {
        this.eventEmitter_?.emit('worker:queue:error', {
          taskId: task.id,
          error: err.message
        });
        this.logIf_('error', 'Failed to enqueue task result', {
          taskId: task.id,
          error: err.message
        });
      }
    }

    if (task.completionCallback) {
      try {
        task.completionCallback(status, data);
      } catch (err) {
        this.eventEmitter_?.emit('worker:callback:error', {
          taskId: task.id,
          error: err.message
        });
      }
    }

    this.cleanupWorker_(task.id);
  }

  /**
   * Convenience for the various error code paths (worker error event,
   * non-zero exit, spawn failure). Routes through {@link finaliseTask_} so
   * the bookkeeping stays in one place.
   *
   * @private
   * @param {!Object} task
   * @param {?Object} workerInfo Active worker info, or null if spawning failed.
   * @param {string} message Error message.
   * @param {string} source Tag identifying which handler triggered the error.
   */
  async recordError_(task, workerInfo, message, source) {
    this.eventEmitter_?.emit('worker:error', {
      taskId: task.id,
      error: message,
      source
    });
    this.logIf_('error', 'Worker errored', {
      taskId: task.id,
      error: message,
      source
    });

    if (workerInfo) {
      await this.finaliseTask_(workerInfo, 'error', message);
      return;
    }

    // No active worker (spawn failed) — write history + queue directly.
    const taskResult = {
      taskId: task.id,
      scriptPath: task.scriptPath,
      status: 'error',
      error: message,
      queuedAt: task.queuedAt,
      startedAt: new Date(),
      completedAt: new Date()
    };
    this.recordHistory_(taskResult);

    if (this.queueService_) {
      try {
        await this.queueService_.enqueue(this.QUEUE_ERROR_, taskResult);
      } catch (_) { /* best effort */ }
    }

    if (task.completionCallback) {
      try {
        task.completionCallback('error', message);
      } catch (_) { /* swallow callback errors */ }
    }
  }

  /**
   * Handles a worker timeout: terminates the worker and records the task
   * as errored with a timeout-specific message.
   *
   * @private
   * @param {!Object} workerInfo
   */
  handleTimeout_(workerInfo) {
    const { task, worker } = workerInfo;
    const message = `Worker timed out after ${this.settings.workerTimeout}ms`;

    this.eventEmitter_?.emit('worker:timeout', {
      taskId: task.id,
      timeoutMs: this.settings.workerTimeout
    });
    this.logIf_('warn', 'Worker timed out', {
      taskId: task.id,
      timeoutMs: this.settings.workerTimeout
    });

    // Terminate but don't await — finaliseTask_ runs synchronously below
    // and the exit handler will be a no-op once finalised is true.
    try {
      worker.terminate();
    } catch (_) { /* worker may already be gone */ }

    // Record before cleanupWorker_ removes the entry.
    this.finaliseTask_(workerInfo, 'error', message).catch(() => {});
  }

  /**
   * Persists a task result to the in-memory history map, evicting the
   * oldest entry if the history limit is exceeded.
   *
   * @private
   * @param {!Object} taskResult
   */
  recordHistory_(taskResult) {
    this.taskHistory_.set(taskResult.taskId, taskResult);
    if (this.taskHistory_.size > TASK_HISTORY_LIMIT) {
      const oldestKey = this.taskHistory_.keys().next().value;
      this.taskHistory_.delete(oldestKey);
    }
  }

  /**
   * Removes the worker entry and best-effort terminates the underlying
   * thread. Safe to call repeatedly.
   *
   * @private
   * @param {string} taskId
   */
  cleanupWorker_(taskId) {
    const workerInfo = this.activeWorkers_.get(taskId);
    if (!workerInfo) return;

    if (workerInfo.timeoutHandle) {
      clearTimeout(workerInfo.timeoutHandle);
      workerInfo.timeoutHandle = null;
    }

    try {
      workerInfo.worker.terminate();
    } catch (_) { /* worker may already be terminated */ }

    this.activeWorkers_.delete(taskId);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Stops the worker manager: marks it as not running, halts the queue
   * processor, and terminates all active workers in parallel. Tasks still
   * sitting in the incoming queue are left in place — when the service is
   * restarted with the same queueing backend they will be picked up again.
   *
   * @return {Promise<void>}
   */
  async stop() {
    this.isRunning_ = false;
    this.stopQueueProcessor_();

    let incomingQueueSize = 0;
    if (this.queueService_) {
      try {
        incomingQueueSize = await this.queueService_.size(this.QUEUE_INCOMING_);
      } catch (_) { /* best effort */ }
    }

    this.eventEmitter_?.emit('worker:manager:stopping', {
      incomingQueueSize,
      activeWorkers: this.activeWorkers_.size
    });
    this.logIf_('info', 'Worker manager stopping', {
      incomingQueueSize,
      activeWorkers: this.activeWorkers_.size
    });

    const terminationPromises = [];
    for (const [, workerInfo] of this.activeWorkers_.entries()) {
      if (workerInfo.timeoutHandle) {
        clearTimeout(workerInfo.timeoutHandle);
        workerInfo.timeoutHandle = null;
      }
      terminationPromises.push(
        new Promise((resolve) => {
          try {
            const result = workerInfo.worker.terminate();
            if (result && typeof result.then === 'function') {
              result.then(() => resolve()).catch(() => resolve());
            } else {
              resolve();
            }
          } catch (_) {
            resolve();
          }
        })
      );
    }

    await Promise.all(terminationPromises);
    this.activeWorkers_.clear();

    this.eventEmitter_?.emit('worker:manager:stopped');
    this.logIf_('info', 'Worker manager stopped');
  }

  // ---------------------------------------------------------------------------
  // Inspection
  // ---------------------------------------------------------------------------

  /**
   * Returns a snapshot of manager state suitable for dashboards and tests.
   * Queue sizes are read from the queueing service so they reflect what
   * external observers would also see.
   *
   * @return {Promise<!Object>}
   */
  async getStatus() {
    let incomingQueueSize = 0;
    let completeQueueSize = 0;
    let errorQueueSize = 0;

    if (this.queueService_) {
      try {
        incomingQueueSize = await this.queueService_.size(this.QUEUE_INCOMING_);
        completeQueueSize = await this.queueService_.size(this.QUEUE_COMPLETE_);
        errorQueueSize    = await this.queueService_.size(this.QUEUE_ERROR_);
      } catch (_) { /* best effort */ }
    }

    return {
      isRunning: this.isRunning_,
      maxThreads: this.maxThreads_,
      activeWorkers: this.activeWorkers_.size,
      queues: {
        incoming: incomingQueueSize,
        complete: completeQueueSize,
        error: errorQueueSize
      },
      completedTasks: this.taskHistory_.size
    };
  }

  /**
   * Returns recent task history, newest first.
   *
   * @param {number=} limit Maximum number of entries to return (default 100).
   * @return {Promise<!Array<!Object>>}
   */
  async getTaskHistory(limit = 100) {
    return Array.from(this.taskHistory_.values())
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, limit);
  }

  /**
   * Returns a single task by ID, or null if not found.
   *
   * @param {string} taskId
   * @return {Promise<?Object>}
   */
  async getTask(taskId) {
    return this.taskHistory_.get(taskId) || null;
  }
}

module.exports = WorkerManager;
