# Working Service (`src/working/`)

**Dependency level:** 2 – Business Logic
**Dependencies:** `logging`, `queueing`, `caching`

The working service is the task execution engine. It manages a pool of Node.js worker threads that run activity scripts in isolated contexts. Both the workflow service and the scheduling service delegate actual execution to this service.

---

## Factory (`src/working/index.js`)

```javascript
const worker = registry.working('memory');
```

### `getWorkerInstance(type, options, eventEmitter)` → `WorkerManager` (singleton)

The factory maintains a **module-level singleton** (`let instance = null`). Once created, all subsequent calls return the same instance regardless of options.

| `type` value | Provider class |
|---|---|
| `'memory'` / `'default'` (default) | `WorkerManager` |
| `'api'` | `WorkingApi` |

**After creating the provider:**
1. Creates `WorkingAnalytics` singleton.
2. Injects `logger` with `instance.log()` helper.
3. Injects `instance.dependencies`.
4. Registers REST routes and dashboard view.
5. Exposes `getSettings` / `saveSettings` from the provider.

**Reset (testing only):** `getWorkerInstance._reset()` clears the singleton.

---

## WorkerManager (`src/working/providers/working.js`)

Class: `WorkerManager`

The core of the working service. Manages a pool of Node.js `worker_threads` with a queue-backed scheduling system. All settings changes are logged via the injected logging service.

### Constructor Options

| Option | Default | Description |
|---|---|---|
| `maxThreads` | `4` | Maximum concurrent worker threads |
| `activitiesFolder` | `'activities'` | Base folder for resolving relative script paths |
| `workerTimeout` | `300000` | Worker timeout in ms (setting only) |
| `maxQueueSize` | `1000` | Max queue size (setting only) |
| `enableLogging` | `true` | Enable logging (setting only) |
| `dependencies.queueing` | — | Required: queueing service for task lifecycle queues |

### Queue Names (internal constants)

| Constant | Queue Name | Purpose |
|---|---|---|
| `QUEUE_INCOMING_` | `nooblyjs-core-working-incoming` | Tasks waiting to execute |
| `QUEUE_COMPLETE_` | `nooblyjs-core-working-complete` | Completed tasks |
| `QUEUE_ERROR_` | `nooblyjs-core-working-error` | Failed tasks |

### Queue Processor

A `setInterval` fires every 1 second (`startQueueProcessor_()`). Each tick:
1. Checks if `activeWorkers_.size < maxThreads_`.
2. Dequeues one task from `QUEUE_INCOMING_` per available slot.
3. Calls `executeTask_(task)` for each dequeued task.

---

### Methods

#### `async start(scriptPath, data, completionCallback)` → `taskId: string`

The primary API. Queues a task for execution.

**Flow:**
1. Validates `isRunning_` and `queueService_` are available.
2. Calls `resolveActivityPath_(scriptPath)` to get an absolute path.
3. Generates a unique `taskId` via `crypto.randomBytes(16).toString('hex')`.
4. Creates a task object: `{ id, scriptPath, originalScriptPath, data, completionCallback, queuedAt }`.
5. Enqueues the task to `QUEUE_INCOMING_`.
6. Emits `worker:queued` with `{ taskId, scriptPath, queueName, queueLength }`.
7. Returns `taskId`.

The actual execution happens asynchronously when the queue processor picks it up.

#### `async resolveActivityPath_(scriptPath)` → `string` (private)

- If `scriptPath` is absolute, returns it unchanged.
- Otherwise resolves relative to `activitiesFolder_` (from `process.cwd()`).
- If `filingService_` is available, verifies the resolved path exists via `fs.access()`.
- Throws `Error` if file not found.

#### `async executeTask_(task)` (private)

Spawns a `new Worker(workerScript.js)` passing the task via `worker.postMessage({ type: 'start', scriptPath, data })`.

**Worker lifecycle:**
- `worker.on('message')` – receives `{ type: 'status', status, data }` messages:
  - `status === 'completed'` → stores result in `taskHistory_`, enqueues to `QUEUE_COMPLETE_`, calls `completionCallback('completed', result)`, calls `cleanupWorker_()`.
  - `status === 'error'` → same but for `QUEUE_ERROR_`.
- `worker.on('error')` – handles uncaught worker errors, enqueues to `QUEUE_ERROR_`, calls callback with `'error'`.
- `worker.on('exit')` – handles non-zero exit codes for tasks not already in history.

#### `async stop()` → `void`

Stops the queue processor, terminates all active workers, clears `activeWorkers_`.

Emits: `worker:manager:stopping`, `worker:manager:stopped`

#### `async getStatus()` → `Object`

Returns:
```javascript
{
  isRunning: boolean,
  maxThreads: number,
  activeWorkers: number,
  queues: { incoming, complete, error },
  completedTasks: number
}
```

#### `async getTaskHistory(limit)` → `Array`

Returns the last `limit` (default: 100) completed tasks from `taskHistory_`, sorted newest first.

Each entry: `{ taskId, scriptPath, status, result, queuedAt, startedAt, completedAt }`

#### `async getTask(taskId)` → `Object | null`

Returns a specific task's history entry, or `null`.

---

## WorkingApi (`src/working/providers/workingApi.js`)

Class: `WorkingApi`

HTTP-based wrapper that proxies working operations to a remote working service. Used for distributed task execution across services.

### Constructor Options

| Option | Default | Description |
|---|---|---|
| `url` | `'http://localhost:3000'` | Base URL of the remote working service |
| `apikey` | `null` | API key for authentication (optional) |
| `timeout` | `30000` | Request timeout in milliseconds |
| `retryLimit` | `3` | Maximum retry attempts |

### Methods

This provider implements a different interface than `WorkerManager`. Key methods:

- `async submitJob(job)` – Submit a job to remote service
- `async getJobStatus(jobId)` – Get job status
- `async cancelJob(jobId)` – Cancel a running job
- `async listJobs(filter)` – List jobs with optional filters
- `async getStats()` – Get remote service statistics
- `async retryJob(jobId)` – Retry a failed job
- `async getSettings()` / `async saveSettings(settings)` – Configuration

All operations emit events via `eventEmitter_` including success and error events.

---

## Worker Script (`src/working/providers/workerScript.js`)

The script that actually runs inside each worker thread. It:
1. Listens for `{ type: 'start', scriptPath, data }` via `parentPort.on('message')`.
2. Dynamically `require()`s the activity script at `scriptPath`.
3. Calls the exported function (or `run()` method) with `data`.
4. Posts `{ type: 'status', status: 'completed', data: result }` back on success.
5. Posts `{ type: 'status', status: 'error', data: error.message }` on failure.

---

## Activity Script Contract

An activity script run by a worker must export a function or object with a `run(data)` method:

```javascript
// Option 1: Default export function
module.exports = async function(data) {
  return { processed: true, input: data };
};

// Option 2: Object with run()
module.exports = {
  run: async function(data) {
    return { processed: true };
  }
};
```

---

## Events

| Event | Payload |
|---|---|
| `worker:queued` | `{ taskId, scriptPath, originalScriptPath, queueName, queueLength }` |
| `worker:start` | `{ taskId, scriptPath, data, activeWorkers, incomingQueueSize }` |
| `worker:status` | `{ taskId, status, data }` |
| `worker:error` | `{ taskId, error }` |
| `worker:exit` | `{ taskId, code }` |
| `worker:exit:error` | `{ taskId, code }` |
| `worker:manager:stopping` | `{ incomingQueueSize, activeWorkers }` |
| `worker:manager:stopped` | — |
| `worker:queue:error` | `{ taskId, error }` |
| `worker:callback:error` | `{ taskId, error }` |

---

## Analytics Module (`src/working/modules/analytics.js`)

The `WorkingAnalytics` class tracks per-task and overall execution statistics via event listeners.

### Methods

#### `getStats()` → `Object`

Returns overall statistics with totals, counts, and percentages.

#### `getTaskAnalytics()` → `Array<Object>`

Returns analytics for all tracked tasks sorted by most recent first.

#### `getTaskAnalyticsByPath(scriptPath)` → `?Object`

Returns analytics for a specific task script, or `null` if not found.

#### `clear()` → `void`

Clears all stored analytics data.

#### `destroy()` → `void`

Removes all event listeners and clears analytics data. Should be called when analytics module is no longer needed to prevent memory leaks.

---

## Required Dependencies

The working service requires:
- **`queueing`** – Queueing service (mandatory) for managing task lifecycle queues (`QUEUE_INCOMING_`, `QUEUE_COMPLETE_`, `QUEUE_ERROR_`)

Optional dependencies:
- **`logging`** – Logging service (recommended) for structured logging of settings changes and service initialization

---

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `workerTimeout` | number | `300000` | Max execution time per worker (ms) |
| `maxQueueSize` | number | `1000` | Max items in incoming queue |
| `enableLogging` | boolean | `true` | Enable worker logging |

---

## Routes

Mounted at `/services/working/api/`. All error responses return JSON format `{ error: "message" }`. Success responses return JSON `{ success: true }` or data object.

| Method | Path | Description | Response Format |
|---|---|---|---|
| `POST` | `/services/working/api/run` | Start background task | JSON: `{ taskId, message }` |
| `GET` | `/services/working/api/stop` | Stop worker manager | JSON: `{ success: true }` |
| `GET` | `/services/working/api/status` | Current worker status | JSON: status object |
| `GET` | `/services/working/api/history` | Task history | JSON array |
| `GET` | `/services/working/api/task/:id` | Specific task status | JSON: task object or `{ error }` |
| `GET` | `/services/working/api/stats` | Task statistics | JSON: stats object |
| `GET` | `/services/working/api/analytics` | Detailed task analytics | JSON: analytics array |
| `GET` | `/services/working/api/analytics/:scriptPath` | Script-specific analytics | JSON: analytics object or `{ error }` |
| `GET` | `/services/working/api/settings` | Get settings | JSON: settings object |
| `POST` | `/services/working/api/settings` | Update settings | JSON: `{ success: true }` |

---

## Usage

```javascript
// Execute an activity
const taskId = await worker.start(
  '/path/to/activities/process-order.js',
  { orderId: 42, items: [...] },
  (status, result) => {
    if (status === 'completed') console.log('Done:', result);
    if (status === 'error') console.error('Failed:', result);
  }
);

// Check status
const status = await worker.getStatus();
console.log(`Active: ${status.activeWorkers}, Queued: ${status.queues.incoming}`);
```
