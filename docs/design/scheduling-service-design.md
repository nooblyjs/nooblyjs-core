# Scheduling Service (`src/scheduling/`)

**Dependency level:** 3 – Application
**Dependencies:** `logging`, `working`

Provides time-based task execution. Tasks can be scheduled at fixed intervals (seconds) or using CRON expressions. Execution is delegated to the working service.

---

## Factory (`src/scheduling/index.js`)

```javascript
const scheduler = registry.scheduling('memory');
```

### `getSchedulerInstance(type, options, eventEmitter)` → `SchedulerProvider` (singleton)

Maintains a **module-level singleton**. Once created, subsequent calls return the same instance.

| `type` value | Notes |
|---|---|
| `'memory'` (default) | `SchedulerProvider` – in-process interval-based scheduling |

**After creating:**
1. Passes `dependencies.working` as the working service to `SchedulerProvider`.
2. Injects `logger` with `instance.log()` helper.
3. Injects `instance.dependencies`.
4. Registers REST routes and dashboard view.
5. Exposes `getSettings` / `saveSettings`.

**Reset (testing):** `getSchedulerInstance._reset()` clears the singleton.

---

## SchedulerProvider (`src/scheduling/providers/scheduling.js`)

Class: `SchedulerProvider`

### Constructor

```javascript
new SchedulerProvider(options, eventEmitter, workingService)
```

- Requires `workingService` – throws `Error` if not provided.
- `this.tasks_` – `Map<taskName, taskInfo>` of all active scheduled tasks.
- `this.worker_` – the working service instance.

### Settings

| Setting | Default | Description |
|---|---|---|
| `maxConcurrentJobs` | `10` | Max jobs running concurrently |
| `retryAttempts` | `3` | Retries on failure |
| `jobTimeout` | `30000` | Timeout per job execution (ms) |

---

### Methods

#### `async start(taskName, scriptPath, dataOrInterval, intervalSeconds?, executionCallback?)` → `void`

Schedules a recurring task at a fixed interval.

**Calling patterns:**
```javascript
// 3 args: start(name, path, intervalSeconds)
await scheduler.start('cleanup', '/tasks/cleanup.js', 3600);

// 4 args: start(name, path, intervalSeconds, callback)
await scheduler.start('cleanup', '/tasks/cleanup.js', 3600, (status, data) => {});

// 5 args: start(name, path, data, intervalSeconds, callback)
await scheduler.start('cleanup', '/tasks/cleanup.js', { verbose: true }, 3600, callback);
```

**Validation:**
- `taskName` must be a non-empty string.
- `scriptPath` must be a non-empty string.
- `interval` must be a positive number.
- `callback` must be a function if provided.
- Silently returns (emits `scheduler:start:error`) if task already exists.

**Execution flow:**
1. Defines `executeTask()` which calls `this.worker_.start(scriptPath, data, callback)`.
2. Calls `executeTask()` immediately (first execution runs right away).
3. Calls `setInterval(executeTask, interval * 1000)` for recurring execution.
4. Stores `{ intervalId, scriptPath, executionCallback }` in `this.tasks_`.
5. Emits `scheduler:started` with `{ taskName, scriptPath, intervalSeconds }`.

**Analytics tracking:** `trackScheduleStarted`, `trackScheduleRunning`, `trackScheduleCompleted`, `trackScheduleError` per execution.

#### `async startCron(task, cron, taskName?)` → `void`

Registers a CRON-based schedule. Stores the CRON expression and task definition for retrieval via the API/UI. Does **not** actually execute the task on a timer in the current implementation — it records the schedule for external display and future CRON execution integration.

```javascript
await scheduler.startCron(
  { type: 'send-report', recipients: ['admin@example.com'] },
  '0 9 * * 1',   // Every Monday at 9am
  'weekly-report'
);
```

Stores: `{ type: 'cron', task, cron, createdAt, metadata }` in `this.tasks_`.

Emits: `scheduler:started` with `{ taskName, cron, task }`.

Throws if task name already exists.

#### `async cancel(taskId)` → `void`

Cancels a scheduled task by name. Clears the interval (for interval tasks) and removes from `this.tasks_`.

Emits: `scheduler:stopped` with `{ taskName: taskId }`.

#### `async stop(taskName?)` → `void`

- If `taskName` is provided: stops that specific task (clears interval).
- If no `taskName`: stops all tasks and calls `this.worker_.stop()`.

Emits: `scheduler:stopped` for each stopped task.

Validates that `taskName`, if given, is a non-empty string.

#### `async isRunning(taskName?)` → `boolean`

- If `taskName` given: returns `this.tasks_.has(taskName)`.
- If no `taskName`: returns `this.tasks_.size > 0`.

#### `async getSettings()` / `async saveSettings(settings)`

Standard settings get/save. `saveSettings` emits `scheduler:setting-changed` for each modified setting.

---

## Analytics (`src/scheduling/modules/analytics.js`)

Module-level singleton tracking:
- Number of schedules started/stopped
- Per-schedule execution counts
- Completed / error counts per schedule

---

## Events

| Event | Payload |
|---|---|
| `scheduler:started` | `{ taskName, scriptPath, intervalSeconds }` or `{ taskName, cron, task }` |
| `scheduler:stopped` | `{ taskName }` |
| `scheduler:taskExecuted` | `{ taskName, scriptPath, status, data }` |
| `scheduler:validation-error` | `{ method, error, taskName, ... }` |
| `scheduler:start:error` | `{ taskName, error }` |
| `scheduler:setting-changed` | `{ setting, value }` |

---

## Routes

Mounted at `/services/scheduling/api/`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/services/scheduling/api/status` | Service status |
| `GET` | `/services/scheduling/api/schedules` | List all schedules |
| `GET` | `/services/scheduling/api/analytics` | Scheduling analytics |
| `POST` | `/services/scheduling/api/start` | Start a new schedule |
| `POST` | `/services/scheduling/api/startcron` | Register a CRON schedule |
| `POST` | `/services/scheduling/api/stop` | Stop a schedule |
| `POST` | `/services/scheduling/api/settings` | Update settings |

---

## Client-Side Script (`src/scheduling/scripts/js/index.js`)

Browser-loadable class for interacting with the scheduling API.

---

## Usage

```javascript
// Run a cleanup script every hour
await scheduler.start(
  'hourly-cleanup',
  '/tasks/cleanup.js',
  3600,
  (status, result) => {
    if (status === 'error') log.error('Cleanup failed', result);
  }
);

// Register a CRON schedule (stored for display / future execution)
await scheduler.startCron(
  { type: 'generate-report', format: 'pdf' },
  '0 8 * * *',    // Daily at 8am
  'daily-report'
);

// Stop a specific schedule
await scheduler.stop('hourly-cleanup');

// Check if any schedule is running
const running = await scheduler.isRunning();
```
