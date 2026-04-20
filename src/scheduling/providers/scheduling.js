/**
 * @fileoverview Production scheduling provider.
 *
 * Manages two kinds of scheduled tasks:
 *  - Interval tasks: fixed-period repeating jobs (`start()`)
 *  - CRON tasks: standard 5-field cron expressions (`startCron()`)
 *
 * Both kinds dispatch their work to the injected `working` service so the
 * scheduler itself never blocks the event loop. Tasks are governed by the
 * provider's settings:
 *  - `maxConcurrentJobs`: hard cap on simultaneous executions across the
 *    whole scheduler. Excess fires are skipped (and recorded) rather than
 *    queued, to prevent runaway pile-up if the worker pool is saturated.
 *  - `retryAttempts`: per-execution retry budget on failure (no retry on
 *    timeout — see below).
 *  - `jobTimeout`: per-execution wall-clock budget in milliseconds. If
 *    exceeded the execution is recorded as an error and not retried.
 *
 * @author Noobly JS Core Team
 * @version 2.0.0
 * @since 1.0.0
 */

'use strict';

const analytics = require('../modules/analytics');
const { parseCron, matches, isValid } = require('./cronExpression');

/** @const {number} How often to evaluate cron expressions, in ms (1 minute). */
const CRON_TICK_MS = 60 * 1000;

/**
 * Production-grade scheduler provider.
 *
 * @class
 */
class SchedulerProvider {
  /**
   * @param {Object=} options Configuration options.
   * @param {number=} options.maxConcurrentJobs Cap on simultaneous executions.
   * @param {number=} options.retryAttempts Per-execution retries on failure.
   * @param {number=} options.jobTimeout Per-execution timeout in ms.
   * @param {EventEmitter=} eventEmitter Optional event emitter.
   * @param {Object=} workingService Working service used to execute tasks.
   */
  constructor(options = {}, eventEmitter, workingService) {
    /** @private @const {?EventEmitter} */
    this.eventEmitter_ = eventEmitter || null;

    /** @private @const {!Map<string, !Object>} */
    this.tasks_ = new Map();

    /** @private @const {?Object} */
    this.worker_ = workingService || null;

    /** @private {?Object} Logger injected by the factory. */
    this.logger = null;

    /** @private {number} Currently-executing jobs across all schedules. */
    this.activeJobs_ = 0;

    /** @private {?NodeJS.Timeout} Single shared timer for cron evaluation. */
    this.cronTimer_ = null;

    /** @private {?Date} Last minute boundary already evaluated. */
    this.lastCronTick_ = null;

    /** @private {boolean} Set when {@link shutdown} has been called. */
    this.shuttingDown_ = false;

    // Settings configuration. Field metadata is exposed via getSettings()
    // for use by the settings UI; the actual values live alongside it.
    this.settings = {
      description: 'Configuration settings for the scheduling service',
      list: [
        { setting: 'maxConcurrentJobs', type: 'number', values: null },
        { setting: 'retryAttempts',     type: 'number', values: null },
        { setting: 'jobTimeout',        type: 'number', values: null }
      ],
      maxConcurrentJobs: this.coerceNumber_(options.maxConcurrentJobs, 10, 1),
      retryAttempts:     this.coerceNumber_(options.retryAttempts,      3, 0),
      jobTimeout:        this.coerceNumber_(options.jobTimeout,     30000, 1)
    };

    if (!this.worker_) {
      // The original implementation threw here. We instead emit a warning
      // and degrade to a no-op execution backend, because in some test and
      // bootstrap scenarios the working service is wired in later. Calls to
      // start()/startCron() will still record schedules and emit events;
      // they simply won't dispatch real work.
      this.logger?.warn?.(
        '[SchedulerProvider] Working service not provided — schedules will be recorded but no execution will occur.'
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  /**
   * Returns the current settings object.
   * @return {Promise<!Object>} The settings.
   */
  async getSettings() {
    return this.settings;
  }

  /**
   * Updates one or more settings. Unknown keys are ignored. Each accepted
   * setting is validated against its declared type before being applied.
   *
   * @param {!Object} settings A partial settings object.
   * @return {Promise<void>}
   */
  async saveSettings(settings) {
    if (!settings || typeof settings !== 'object') return;

    for (const meta of this.settings.list) {
      const key = meta.setting;
      if (settings[key] === undefined || settings[key] === null) continue;

      const incoming = settings[key];

      if (meta.type === 'number') {
        const min = key === 'retryAttempts' ? 0 : 1;
        const value = this.coerceNumber_(incoming, this.settings[key], min);
        if (value === this.settings[key]) continue;
        this.settings[key] = value;
      } else {
        this.settings[key] = incoming;
      }

      this.eventEmitter_?.emit('scheduler:setting-changed', {
        setting: key,
        value: this.settings[key]
      });
      this.logger?.info?.('[SchedulerProvider] Setting changed', {
        setting: key,
        value: this.settings[key]
      });
    }
  }

  /**
   * Coerces a value into a positive integer with a fallback default.
   * @param {*} value The candidate value.
   * @param {number} fallback The fallback value if invalid.
   * @param {number} min Minimum allowed value (inclusive).
   * @return {number} A valid integer.
   * @private
   */
  coerceNumber_(value, fallback, min) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < min) return fallback;
    return Math.floor(n);
  }

  // ---------------------------------------------------------------------------
  // Interval scheduling — start()
  // ---------------------------------------------------------------------------

  /**
   * Starts a new interval-based scheduled task. The task fires immediately
   * once and then every `intervalSeconds` thereafter.
   *
   * Supports three calling conventions for backward compatibility:
   *   start(name, scriptPath, intervalSeconds)
   *   start(name, scriptPath, intervalSeconds, callback)
   *   start(name, scriptPath, data, intervalSeconds, callback)
   *
   * @param {string} taskName Unique task name.
   * @param {string} scriptPath Activity script path passed to the worker.
   * @param {*|number} dataOrInterval Data payload, or interval (3-arg form).
   * @param {(number|Function)=} intervalSecondsOrCallback Interval or callback.
   * @param {Function=} executionCallback Optional callback `(status, data)`.
   * @return {Promise<void>}
   * @throws {Error} On invalid arguments.
   */
  async start(taskName, scriptPath, dataOrInterval, intervalSecondsOrCallback, executionCallback) {
    this.assertTaskName_(taskName, 'start');
    this.assertScriptPath_(scriptPath, taskName);

    // Resolve calling convention.
    let data;
    let interval;
    let callback;

    if (arguments.length === 3) {
      data = null;
      interval = dataOrInterval;
      callback = undefined;
    } else if (arguments.length === 4) {
      // Distinguish (name, path, interval, callback) from
      // (name, path, data, interval). When the 3rd arg is a number we treat
      // it as the interval; the 4th must then be the callback.
      if (typeof dataOrInterval === 'number') {
        data = null;
        interval = dataOrInterval;
        callback = intervalSecondsOrCallback;
      } else {
        data = dataOrInterval;
        interval = intervalSecondsOrCallback;
        callback = undefined;
      }
    } else {
      data = dataOrInterval;
      interval = intervalSecondsOrCallback;
      callback = executionCallback;
    }

    if (typeof interval !== 'number' || !Number.isFinite(interval) || interval <= 0) {
      this.throwValidation_('start', 'Invalid interval: must be a positive number', { taskName, interval });
    }
    if (callback !== undefined && typeof callback !== 'function') {
      this.throwValidation_('start', 'Invalid callback: must be a function if provided', { taskName });
    }

    if (this.tasks_.has(taskName)) {
      this.eventEmitter_?.emit('scheduler:start:error', {
        taskName,
        error: 'Task already scheduled.'
      });
      this.logger?.warn?.('[SchedulerProvider] Task already scheduled', { taskName });
      return;
    }

    const task = {
      type: 'interval',
      name: taskName,
      scriptPath,
      data,
      callback,
      intervalSeconds: interval,
      intervalId: null,
      createdAt: new Date().toISOString()
    };

    const fire = () => this.executeTask_(task);

    // First execution runs immediately, then on the interval.
    task.intervalId = setInterval(fire, interval * 1000);
    this.tasks_.set(taskName, task);

    analytics.trackScheduleStarted(taskName);
    this.eventEmitter_?.emit('scheduler:started', {
      taskName,
      scriptPath,
      intervalSeconds: interval
    });
    this.logger?.info?.('[SchedulerProvider] Interval task started', {
      taskName,
      scriptPath,
      intervalSeconds: interval
    });

    // Fire the first execution after the task is registered so cancellation
    // during the first call still finds the task in the map.
    fire();
  }

  // ---------------------------------------------------------------------------
  // CRON scheduling — startCron()
  // ---------------------------------------------------------------------------

  /**
   * Registers a CRON-scheduled task. The task fires whenever the current time
   * matches the supplied 5-field cron expression. Internally a single shared
   * timer aligned to minute boundaries evaluates all CRON tasks.
   *
   * The `task` argument may be either:
   *  - a string script path (executed via the working service), or
   *  - an object describing the activity. If the object has a `scriptPath`
   *    property it is dispatched to the worker; otherwise it is recorded for
   *    inspection but not executed (the framework's working service does the
   *    actual dispatch in that case).
   *
   * @param {string|!Object} task The task definition.
   * @param {string} cron A standard 5-field cron expression.
   * @param {string=} taskName Optional explicit task name.
   * @param {Function=} callback Optional execution callback `(status, data)`.
   * @return {Promise<string>} The task name that was registered.
   * @throws {Error} On invalid arguments or duplicate task name.
   */
  async startCron(task, cron, taskName, callback) {
    if (task === undefined || task === null) {
      this.throwValidation_('startCron', 'Invalid task: must be a string or object', { taskName });
    }
    if (!isValid(cron)) {
      this.throwValidation_('startCron', `Invalid cron expression: "${cron}"`, { taskName, cron });
    }
    if (callback !== undefined && typeof callback !== 'function') {
      this.throwValidation_('startCron', 'Invalid callback: must be a function if provided', { taskName });
    }

    const name = taskName
      || (typeof task === 'object' && (task.name || task.type))
      || `task-${Date.now()}`;

    if (this.tasks_.has(name)) {
      throw new Error(`Task "${name}" is already scheduled`);
    }

    const parsedCron = parseCron(cron);
    const scriptPath = typeof task === 'string'
      ? task
      : (task.scriptPath || task.script || null);

    const record = {
      type: 'cron',
      name,
      task,
      scriptPath,
      data: typeof task === 'object' ? (task.data || null) : null,
      callback,
      cron,
      parsedCron,
      createdAt: new Date().toISOString(),
      lastFiredMinute: null
    };

    this.tasks_.set(name, record);
    this.ensureCronTimerStarted_();

    analytics.trackScheduleStarted(name, cron, task);
    this.eventEmitter_?.emit('scheduler:started', {
      taskName: name,
      cron,
      task
    });
    this.logger?.info?.('[SchedulerProvider] CRON task registered', {
      taskName: name,
      cron,
      executable: !!scriptPath
    });

    return name;
  }

  /**
   * Lazily starts the shared cron evaluation timer. The timer is aligned to
   * the next minute boundary and then ticks every {@link CRON_TICK_MS}.
   * @private
   */
  ensureCronTimerStarted_() {
    if (this.cronTimer_ || this.shuttingDown_) return;

    const scheduleNext = () => {
      const now = new Date();
      // Align to the next minute boundary.
      const msToNext = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      this.cronTimer_ = setTimeout(() => {
        this.evaluateCronTasks_(new Date());
        // After the first aligned tick, switch to a steady interval.
        if (!this.shuttingDown_) {
          this.cronTimer_ = setInterval(
            () => this.evaluateCronTasks_(new Date()),
            CRON_TICK_MS
          );
          // Allow Node to exit if nothing else is keeping it alive.
          if (typeof this.cronTimer_.unref === 'function') {
            this.cronTimer_.unref();
          }
        }
      }, msToNext);
      if (typeof this.cronTimer_.unref === 'function') {
        this.cronTimer_.unref();
      }
    };

    scheduleNext();
  }

  /**
   * Evaluates every registered CRON task against the supplied time and fires
   * the matching ones. Guards against double-firing within the same minute.
   *
   * @param {!Date} now The current time.
   * @private
   */
  evaluateCronTasks_(now) {
    // Round down to the current minute so duplicate ticks within a minute
    // don't trigger duplicate fires.
    const minuteKey = new Date(
      now.getFullYear(), now.getMonth(), now.getDate(),
      now.getHours(), now.getMinutes(), 0, 0
    ).getTime();

    if (this.lastCronTick_ === minuteKey) return;
    this.lastCronTick_ = minuteKey;

    for (const task of this.tasks_.values()) {
      if (task.type !== 'cron') continue;
      if (task.lastFiredMinute === minuteKey) continue;
      if (matches(task.parsedCron, now)) {
        task.lastFiredMinute = minuteKey;
        this.executeTask_(task);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------

  /**
   * Executes a single fire of a scheduled task, honouring concurrency,
   * timeout, and retry limits.
   *
   * @param {!Object} task The task record from `this.tasks_`.
   * @private
   */
  executeTask_(task) {
    if (this.shuttingDown_) return;

    if (this.activeJobs_ >= this.settings.maxConcurrentJobs) {
      analytics.trackScheduleSkipped?.(task.name);
      this.eventEmitter_?.emit('scheduler:execution-skipped', {
        taskName: task.name,
        reason: 'maxConcurrentJobs',
        activeJobs: this.activeJobs_
      });
      this.logger?.warn?.('[SchedulerProvider] Skipped execution: at concurrency cap', {
        taskName: task.name,
        maxConcurrentJobs: this.settings.maxConcurrentJobs
      });
      return;
    }

    // CRON tasks without an executable scriptPath are recorded but not run.
    if (task.type === 'cron' && !task.scriptPath) {
      analytics.trackScheduleRunning(task.name);
      analytics.trackScheduleCompleted(task.name);
      analytics.trackExecution(task.name, 'completed', { note: 'No scriptPath; recorded only.' });
      this.eventEmitter_?.emit('scheduler:taskExecuted', {
        taskName: task.name,
        cron: task.cron,
        status: 'recorded',
        data: null
      });
      return;
    }

    if (!this.worker_ || typeof this.worker_.start !== 'function') {
      analytics.trackScheduleError(task.name);
      analytics.trackExecution(task.name, 'error', { error: 'No working service available' });
      this.eventEmitter_?.emit('scheduler:taskExecuted', {
        taskName: task.name,
        scriptPath: task.scriptPath,
        status: 'error',
        data: 'No working service available'
      });
      return;
    }

    this.activeJobs_++;
    analytics.trackScheduleRunning(task.name);
    analytics.trackExecution(task.name, 'running');

    const startedAt = Date.now();
    let settled = false;
    let timeoutHandle = null;
    let attempts = 0;
    const maxAttempts = 1 + this.settings.retryAttempts;

    const finish = (status, data) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      this.activeJobs_ = Math.max(0, this.activeJobs_ - 1);

      const durationMs = Date.now() - startedAt;
      const normalised = (status === 'completed' || status === 'success') ? 'completed' : 'error';

      if (normalised === 'completed') {
        analytics.trackScheduleCompleted(task.name);
        analytics.trackExecution(task.name, 'completed', { data, durationMs });
      } else {
        analytics.trackScheduleError(task.name);
        analytics.trackExecution(task.name, 'error', { data, durationMs });
      }

      this.eventEmitter_?.emit('scheduler:taskExecuted', {
        taskName: task.name,
        scriptPath: task.scriptPath,
        status: normalised,
        data,
        durationMs,
        attempts
      });

      if (task.callback) {
        try {
          task.callback(normalised, data);
        } catch (err) {
          this.logger?.error?.('[SchedulerProvider] Task callback threw', {
            taskName: task.name,
            error: err?.message
          });
        }
      }
    };

    const tryOnce = () => {
      attempts++;
      let attemptDone = false;

      const onAttemptResult = (status, data) => {
        if (attemptDone || settled) return;
        attemptDone = true;
        const ok = status === 'completed' || status === 'success';

        if (ok) {
          finish('completed', data);
          return;
        }

        if (attempts < maxAttempts && !this.shuttingDown_) {
          this.logger?.warn?.('[SchedulerProvider] Execution failed, retrying', {
            taskName: task.name,
            attempt: attempts,
            maxAttempts
          });
          // Schedule the retry on the next tick to avoid recursive stack growth.
          setImmediate(tryOnce);
          return;
        }

        finish('error', data);
      };

      try {
        this.worker_.start(task.scriptPath, task.data, onAttemptResult);
      } catch (err) {
        onAttemptResult('error', err?.message || String(err));
      }
    };

    timeoutHandle = setTimeout(() => {
      if (settled) return;
      this.logger?.error?.('[SchedulerProvider] Execution exceeded jobTimeout', {
        taskName: task.name,
        jobTimeout: this.settings.jobTimeout
      });
      finish('error', `Job exceeded jobTimeout (${this.settings.jobTimeout}ms)`);
    }, this.settings.jobTimeout);
    if (typeof timeoutHandle.unref === 'function') timeoutHandle.unref();

    tryOnce();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle — stop / cancel / isRunning / list / get
  // ---------------------------------------------------------------------------

  /**
   * Cancels a single scheduled task by name. Equivalent to `stop(taskId)` and
   * preserved for backwards compatibility with earlier API consumers.
   *
   * @param {string} taskId The task name to cancel.
   * @return {Promise<boolean>} True if a task was removed.
   */
  async cancel(taskId) {
    if (!this.tasks_.has(taskId)) return false;
    const task = this.tasks_.get(taskId);
    if (task.intervalId) clearInterval(task.intervalId);
    this.tasks_.delete(taskId);
    analytics.trackScheduleStopped(taskId);
    this.eventEmitter_?.emit('scheduler:stopped', { taskName: taskId });
    this.maybeStopCronTimer_();
    return true;
  }

  /**
   * Stops a specific task or, if no name is given, every task. Unlike the
   * previous implementation this does NOT stop the shared working service —
   * the working service is owned by the registry and may be in use by other
   * subsystems.
   *
   * @param {string=} taskName Optional task name.
   * @return {Promise<void>}
   */
  async stop(taskName) {
    if (taskName !== undefined) {
      if (!taskName || typeof taskName !== 'string' || taskName.trim() === '') {
        this.throwValidation_('stop', 'Invalid taskName: must be a non-empty string if provided', { taskName });
      }
      if (this.tasks_.has(taskName)) {
        const task = this.tasks_.get(taskName);
        if (task.intervalId) clearInterval(task.intervalId);
        this.tasks_.delete(taskName);
        analytics.trackScheduleStopped(taskName);
        this.eventEmitter_?.emit('scheduler:stopped', { taskName });
      }
      this.maybeStopCronTimer_();
      return;
    }

    for (const [name, task] of this.tasks_.entries()) {
      if (task.intervalId) clearInterval(task.intervalId);
      analytics.trackScheduleStopped(name);
      this.eventEmitter_?.emit('scheduler:stopped', { taskName: name });
    }
    this.tasks_.clear();
    this.maybeStopCronTimer_();
  }

  /**
   * Stops the cron evaluation timer if there are no remaining cron tasks.
   * @private
   */
  maybeStopCronTimer_() {
    if (!this.cronTimer_) return;
    for (const task of this.tasks_.values()) {
      if (task.type === 'cron') return;
    }
    clearTimeout(this.cronTimer_);
    clearInterval(this.cronTimer_);
    this.cronTimer_ = null;
    this.lastCronTick_ = null;
  }

  /**
   * Reports whether a specific task or any task is currently registered.
   *
   * @param {string=} taskName Optional task name.
   * @return {Promise<boolean>}
   */
  async isRunning(taskName) {
    if (taskName) return this.tasks_.has(taskName);
    return this.tasks_.size > 0;
  }

  /**
   * Returns a snapshot of all currently registered schedules. Internal
   * fields like timer handles and parsed cron sets are stripped from the
   * output to keep it serialisable.
   *
   * @return {Promise<!Array<!Object>>}
   */
  async listSchedules() {
    const out = [];
    for (const task of this.tasks_.values()) {
      out.push(this.summariseTask_(task));
    }
    return out;
  }

  /**
   * Returns a single schedule by name, or null if not found.
   *
   * @param {string} taskName The schedule name.
   * @return {Promise<?Object>}
   */
  async getSchedule(taskName) {
    if (!this.tasks_.has(taskName)) return null;
    return this.summariseTask_(this.tasks_.get(taskName));
  }

  /**
   * Builds a serialisable summary of a task record.
   * @param {!Object} task The internal task record.
   * @return {!Object}
   * @private
   */
  summariseTask_(task) {
    const summary = {
      name: task.name,
      type: task.type,
      createdAt: task.createdAt,
      scriptPath: task.scriptPath || null
    };
    if (task.type === 'interval') {
      summary.intervalSeconds = task.intervalSeconds;
    } else if (task.type === 'cron') {
      summary.cron = task.cron;
      summary.lastFiredMinute = task.lastFiredMinute;
    }
    return summary;
  }

  /**
   * Gracefully shuts down the scheduler, releasing all timers. Intended for
   * use in test teardown and process exit handlers; the scheduler is not
   * usable after shutdown.
   *
   * @return {Promise<void>}
   */
  async shutdown() {
    this.shuttingDown_ = true;
    await this.stop();
  }

  // ---------------------------------------------------------------------------
  // Validation helpers
  // ---------------------------------------------------------------------------

  /**
   * @param {*} taskName Candidate task name.
   * @param {string} method Calling method, used for diagnostics.
   * @private
   */
  assertTaskName_(taskName, method) {
    if (!taskName || typeof taskName !== 'string' || taskName.trim() === '') {
      this.throwValidation_(method, 'Invalid taskName: must be a non-empty string', { taskName });
    }
  }

  /**
   * @param {*} scriptPath Candidate script path.
   * @param {string} taskName Task name being validated against.
   * @private
   */
  assertScriptPath_(scriptPath, taskName) {
    if (!scriptPath || typeof scriptPath !== 'string' || scriptPath.trim() === '') {
      this.throwValidation_('start', 'Invalid scriptPath: must be a non-empty string', { taskName, scriptPath });
    }
  }

  /**
   * Emits a validation error event and throws.
   * @param {string} method Calling method.
   * @param {string} message Error message.
   * @param {!Object} context Extra context for the event payload.
   * @private
   */
  throwValidation_(method, message, context) {
    const error = new Error(message);
    this.eventEmitter_?.emit('scheduler:validation-error', {
      method,
      error: message,
      ...context
    });
    throw error;
  }
}

module.exports = SchedulerProvider;
