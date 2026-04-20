# Working Service - Comprehensive Usage Guide

**Document Version**: 1.0
**Last Updated**: 2025-11-22
**Status**: Complete ✓

---

## Table of Contents

1. [Service Overview](#service-overview)
2. [Service Initialization](#service-initialization)
3. [Provider Options](#provider-options)
4. [Service API (Node.js)](#service-api-nodejs)
5. [REST API Endpoints](#rest-api-endpoints)
6. [Analytics Module](#analytics-module)
7. [Advanced Usage Patterns](#advanced-usage-patterns)
8. [Examples & Recipes](#examples--recipes)
9. [Troubleshooting](#troubleshooting)

---

## Service Overview

The **Working Service** provides background task execution and worker thread management. It enables long-running operations, CPU-intensive computations, and asynchronous job processing with automatic queue management, task tracking, and comprehensive analytics.

### Key Features

- **Worker Thread Management**: Automatic thread pooling with configurable thread limits
- **Queue-Based Processing**: Built-in task queues for incoming, completed, and error tasks
- **Task Lifecycle Management**: Complete tracking from queuing through completion or failure
- **Callback Support**: Optional completion callbacks for task status updates
- **Event-Driven**: Automatic event emission for all worker operations
- **Analytics Module**: Comprehensive task statistics and performance metrics
- **Task History**: Persistent tracking of completed and failed tasks
- **Dependency Injection**: Integration with queueing service for task management
- **Settings Management**: Configurable worker timeout, queue size, and logging

### Architecture

```
┌─────────────────────────────────────────┐
│     Working Service                     │
├─────────────────────────────────────────┤
│  Worker Pool (Configurable Threads)     │
│  ├─ Worker 1  (execution)               │
│  ├─ Worker 2  (execution)               │
│  └─ Worker N  (execution)               │
├─────────────────────────────────────────┤
│  Queue Management (3 Queues)            │
│  ├─ Incoming Queue (pending tasks)      │
│  ├─ Complete Queue (successful tasks)   │
│  └─ Error Queue (failed tasks)          │
├─────────────────────────────────────────┤
│  Task History & Analytics               │
│  ├─ Task tracking by scriptPath         │
│  ├─ Performance metrics                 │
│  └─ Statistics & reporting              │
└─────────────────────────────────────────┘
```

### Performance Characteristics

| Feature | Capability |
|---------|-----------|
| **Max Concurrent Workers** | Configurable (default: 4) |
| **Queue Management** | Automatic via Queueing Service |
| **Task History** | In-memory storage |
| **Execution Model** | Synchronous (per worker) |
| **Callback Support** | Yes, with error handling |
| **Event Tracking** | Full lifecycle events |
| **Analytics** | Real-time statistics |

---

## Required Dependencies

The working service **requires** the following dependencies:

- **Queueing Service** (mandatory) – Used for managing task lifecycle queues (incoming, complete, error)

Optional dependencies:
- **Logging Service** (recommended) – Enables structured logging of service initialization and settings changes

If the queueing service is not provided, the `start()` method will throw an error at runtime.

---

## Service Initialization

### Basic Setup

```javascript
const EventEmitter = require('events');
const createWorking = require('./src/working');
const createQueueing = require('./src/queueing');

// Create event emitter
const eventEmitter = new EventEmitter();

// Create queueing service (required dependency)
const queueing = createQueueing('memory', {}, eventEmitter);

// Create working service
const working = createWorking('default', {
  dependencies: { queueing },
  maxThreads: 4
}, eventEmitter);

console.log('Working service initialized');
```

### With Full Dependencies

```javascript
const createLogging = require('./src/logging');
const createQueueing = require('./src/queueing');
const createWorking = require('./src/working');

const eventEmitter = new EventEmitter();

// Create all dependencies
const logging = createLogging('file', { logDir: './.logs' }, eventEmitter);
const queueing = createQueueing('memory', {}, eventEmitter);

// Create working service with all dependencies
const working = createWorking('default', {
  dependencies: {
    logging: logging,
    queueing: queueing
  },
  maxThreads: 8,
  workerTimeout: 300000,
  maxQueueSize: 1000,
  enableLogging: true
}, eventEmitter);

console.log('Working service initialized with dependencies');
```

---

## Provider Options

### Default Provider

Executes tasks in Node.js worker threads with queue-based management.

```javascript
const working = createWorking('default', {
  maxThreads: 4,
  workerTimeout: 300000,
  maxQueueSize: 1000,
  enableLogging: true,
  dependencies: { queueing }
}, eventEmitter);
```

**Configuration Options**:
- `maxThreads` (number, default: 4) - Maximum concurrent worker threads
- `workerTimeout` (number, default: 300000) - Task timeout in milliseconds
- `maxQueueSize` (number, default: 1000) - Maximum queue size
- `enableLogging` (boolean, default: true) - Enable logging
- `dependencies.queueing` (required) - Queueing service instance

---

### API Provider

Remote worker service via HTTP. Uses a different interface than the default provider.

```javascript
const working = createWorking('api', {
  url: 'http://worker-service.example.com',
  apikey: 'xxxx-xxxx-xxxx',
  timeout: 30000,
  retryLimit: 3
}, eventEmitter);
```

**Configuration Options**:
- `url` (string, default: 'http://localhost:3000') - Base URL of remote working service
- `apikey` (string, optional) - API key for authentication
- `timeout` (number, default: 30000) - Request timeout in milliseconds
- `retryLimit` (number, default: 3) - Maximum retry attempts

**Note**: The API provider has a different method interface than the default provider. Use `submitJob()`, `getJobStatus()`, `cancelJob()`, `listJobs()`, `getStats()`, and `retryJob()` instead of `start()`, `getStatus()`, `stop()`, etc.

---

## Service API (Node.js)

### Core Methods

#### `start(scriptPath, data, completionCallback)`

Starts a background worker task.

**Parameters**:
- `scriptPath` (string, required) - Path to the script to execute (relative to activities folder or absolute)
- `data` (any, optional) - Data to pass to the worker
- `completionCallback` (function, optional) - Callback function: `(status, result) => {}`

**Returns**: `Promise<string>` - Task ID

**Status Values**: `'completed'`, `'error'`

**Example**:

```javascript
// Simple task
const taskId = await working.start('tasks/process-data.js');

// Task with data
const taskId = await working.start('tasks/transform.js', {
  input: 'data',
  options: { format: 'json' }
});

// Task with completion callback
const taskId = await working.start(
  'tasks/heavy-computation.js',
  { numbers: [1, 2, 3, 4, 5] },
  (status, result) => {
    if (status === 'completed') {
      console.log('Task finished:', result);
    } else if (status === 'error') {
      console.error('Task failed:', result);
    }
  }
);

console.log('Task queued with ID:', taskId);
```

---

#### `stop()`

Stops the working service and terminates all active workers.

**Returns**: `Promise<void>`

**Example**:

```javascript
// Graceful shutdown
await working.stop();
console.log('Working service stopped');
```

---

#### `getStatus()`

Returns the current status of the working service.

**Returns**: `Promise<Object>` with structure:
```javascript
{
  isRunning: boolean,
  maxThreads: number,
  activeWorkers: number,
  queues: {
    incoming: number,      // Tasks waiting
    complete: number,      // Completed tasks
    error: number          // Failed tasks
  },
  completedTasks: number   // Total task history entries
}
```

**Example**:

```javascript
const status = await working.getStatus();
console.log('Working service status:');
console.log(`  Running: ${status.isRunning}`);
console.log(`  Active workers: ${status.activeWorkers}/${status.maxThreads}`);
console.log(`  Pending tasks: ${status.queues.incoming}`);
console.log(`  Completed: ${status.queues.complete}`);
console.log(`  Failed: ${status.queues.error}`);
```

---

#### `getTaskHistory(limit = 100)`

Returns recent task execution history.

**Parameters**:
- `limit` (number, default: 100) - Maximum number of tasks to return

**Returns**: `Promise<Array>` - Array of task history entries

**Task History Entry**:
```javascript
{
  taskId: string,
  scriptPath: string,
  status: 'completed' | 'error',
  result: any,           // Task result or error message
  queuedAt: Date,
  startedAt: Date,
  completedAt: Date
}
```

**Example**:

```javascript
// Get last 10 completed tasks
const history = await working.getTaskHistory(10);

history.forEach(task => {
  console.log(`Task ${task.taskId}: ${task.status}`);
  console.log(`  Script: ${task.scriptPath}`);
  console.log(`  Duration: ${task.completedAt - task.startedAt}ms`);
});
```

---

#### `getTask(taskId)`

Gets information about a specific task.

**Parameters**:
- `taskId` (string, required) - The task ID

**Returns**: `Promise<?Object>` - Task info or null if not found

**Example**:

```javascript
const task = await working.getTask('abc123def456');
if (task) {
  console.log('Task found:', task);
} else {
  console.log('Task not found');
}
```

---

#### `getSettings()`

Retrieves current working service settings.

**Returns**: `Promise<Object>` - Settings object

**Example**:

```javascript
const settings = await working.getSettings();
console.log('Worker timeout:', settings.workerTimeout);
console.log('Max threads:', settings.maxThreads);
```

---

#### `saveSettings(settings)`

Updates working service settings. All setting changes are logged via the logging service.

**Parameters**:
- `settings` (Object, required) - Settings to update

**Example**:

```javascript
await working.saveSettings({
  workerTimeout: 600000,
  enableLogging: true
});
console.log('Settings updated');
```

---

## REST API Endpoints

### Response Format Standards

All API endpoints follow consistent response formats:

**Success Response**:
- HTTP 200 – JSON object with data or `{ success: true }`
- Content-Type: `application/json`

**Error Response**:
- HTTP 400 (Bad Request) – Missing required fields: `{ error: "message" }`
- HTTP 404 (Not Found) – Resource not found: `{ error: "message" }`
- HTTP 500 (Server Error) – Unexpected error: `{ error: "message" }`
- Content-Type: `application/json`

### Task Execution

#### `POST /services/working/api/run`

Starts a background worker task. Task is queued for execution and returns immediately with a task ID.

**Request Body**:
```json
{
  "scriptPath": "tasks/process.js",
  "data": { "input": "value" }
}
```

**Success Response** (HTTP 200):
```json
{
  "taskId": "abc123def456",
  "message": "Task queued successfully"
}
```

**Error Response** (HTTP 400/500):
```json
{
  "error": "Bad Request: Missing scriptPath"
}
```

**cURL Example**:

```bash
curl -X POST http://localhost:3001/services/working/api/run \
  -H "Content-Type: application/json" \
  -d '{
    "scriptPath": "tasks/heavy-computation.js",
    "data": { "numbers": [1, 2, 3, 4, 5] }
  }'
```

---

### Service Management

#### `GET /services/working/api/status`

Returns the operational status of the working service.

**Response**:
```json
{
  "isRunning": true,
  "maxThreads": 4,
  "activeWorkers": 1,
  "queues": {
    "incoming": 3,
    "complete": 45,
    "error": 2
  },
  "completedTasks": 50
}
```

**cURL Example**:

```bash
curl http://localhost:3001/services/working/api/status
```

---

#### `GET /services/working/api/stop`

Stops the working service and terminates all active workers.

**Response**:
```json
{
  "success": true
}
```

**cURL Example**:

```bash
curl http://localhost:3001/services/working/api/stop
```

---

### Task Information

#### `GET /services/working/api/history?limit=100`

Returns task execution history.

**Query Parameters**:
- `limit` (number, default: 100) - Maximum tasks to return

**Response**:
```json
[
  {
    "taskId": "abc123",
    "scriptPath": "/path/to/script.js",
    "status": "completed",
    "result": { "output": "value" },
    "queuedAt": "2025-11-22T10:00:00Z",
    "startedAt": "2025-11-22T10:00:01Z",
    "completedAt": "2025-11-22T10:00:05Z"
  }
]
```

**cURL Example**:

```bash
curl "http://localhost:3001/services/working/api/history?limit=50"
```

---

#### `GET /services/working/api/task/:taskId`

Gets information about a specific task.

**Success Response** (HTTP 200):
```json
{
  "taskId": "abc123",
  "scriptPath": "/path/to/script.js",
  "status": "completed",
  "result": { "output": "value" },
  "queuedAt": "2025-11-22T10:00:00Z",
  "startedAt": "2025-11-22T10:00:01Z",
  "completedAt": "2025-11-22T10:00:05Z"
}
```

**Error Response** (HTTP 404 if not found):
```json
{
  "error": "Task not found"
}
```

**cURL Example**:

```bash
curl http://localhost:3001/services/working/api/task/abc123
```

---

### Analytics

#### `GET /services/working/api/stats`

Retrieves overall task statistics.

**Response**:
```json
{
  "total": 150,
  "counts": {
    "completed": 145,
    "errors": 3,
    "active": 2
  },
  "percentages": {
    "completed": 96.67,
    "errors": 2.00,
    "active": 1.33
  },
  "lastRun": "2025-11-22T15:30:45.000Z"
}
```

**cURL Example**:

```bash
curl http://localhost:3001/services/working/api/stats
```

---

## Analytics Module

### Methods

#### `getStats()`

Returns overall task execution statistics.

**Returns**:
```javascript
{
  total: number,              // Total tasks run
  counts: {
    completed: number,        // Successfully completed
    errors: number,           // Failed tasks
    active: number            // Currently running
  },
  percentages: {
    completed: number,        // Percentage completed
    errors: number,           // Percentage failed
    active: number            // Percentage active
  },
  lastRun: ISO8601 timestamp
}
```

---

#### `getTaskAnalytics()`

Returns detailed analytics for each unique task script.

**Returns**: `Array<Object>`
```javascript
[
  {
    scriptPath: string,
    runCount: number,
    completedCount: number,
    errorCount: number,
    averageDuration: number,  // milliseconds
    lastRun: ISO8601 timestamp,
    activeCount: number       // Currently running
  }
]
```

---

#### `getTaskAnalyticsByPath(scriptPath)`

Returns analytics for a specific task script.

**Parameters**:
- `scriptPath` (string) - The script path

**Returns**: `?Object` - Task analytics or null if not found

---

#### `clear()`

Clears all stored analytics data.

---

#### `destroy()`

Removes all event listeners and clears analytics data. Should be called when the analytics module is no longer needed to prevent memory leaks in long-running applications.

**Example**:

```javascript
// When shutting down the application
await working.stop();

if (working.analytics) {
  working.analytics.destroy();
}
```

---

## Advanced Usage Patterns

### 1. Batch Task Processing

```javascript
async function processBatchTasks(tasks) {
  const taskIds = [];

  for (const task of tasks) {
    const taskId = await working.start(task.script, task.data);
    taskIds.push(taskId);
  }

  // Monitor completion
  const completedTasks = new Set();

  while (completedTasks.size < taskIds.length) {
    for (const taskId of taskIds) {
      if (!completedTasks.has(taskId)) {
        const task = await working.getTask(taskId);
        if (task && ['completed', 'error'].includes(task.status)) {
          completedTasks.add(taskId);
          console.log(`Task ${taskId}: ${task.status}`);
        }
      }
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  return await working.getTaskHistory(taskIds.length);
}

// Usage
const results = await processBatchTasks([
  { script: 'process1.js', data: { id: 1 } },
  { script: 'process2.js', data: { id: 2 } },
  { script: 'process3.js', data: { id: 3 } }
]);
```

---

### 2. Long-Running Task with Progress Updates

```javascript
class LongRunningTaskManager {
  constructor(working, eventEmitter) {
    this.working = working;
    this.eventEmitter = eventEmitter;
    this.taskProgress = new Map();
  }

  async startLongTask(scriptPath, data) {
    const taskId = await this.working.start(
      scriptPath,
      data,
      (status, result) => {
        this.taskProgress.set(taskId, { status, result });
        this.eventEmitter.emit('task:complete', { taskId, status, result });
      }
    );

    return taskId;
  }

  getProgress(taskId) {
    return this.taskProgress.get(taskId) || { status: 'pending' };
  }

  async waitForCompletion(taskId, timeoutMs = 300000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const task = await this.working.getTask(taskId);

      if (task && ['completed', 'error'].includes(task.status)) {
        return task;
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    throw new Error(`Task ${taskId} timeout after ${timeoutMs}ms`);
  }
}

// Usage
const taskManager = new LongRunningTaskManager(working, eventEmitter);
const taskId = await taskManager.startLongTask('heavy-computation.js', { data: 'large' });
const result = await taskManager.waitForCompletion(taskId);
console.log('Task completed:', result);
```

---

## Examples & Recipes

### Recipe: Image Processing Pipeline

```javascript
const imageProcessingPipeline = {
  tasks: [
    'resize.js',
    'watermark.js',
    'compress.js',
    'optimize.js'
  ],

  async processImage(imagePath) {
    let currentData = { path: imagePath };

    for (const script of this.tasks) {
      console.log(`Processing with ${script}...`);

      const taskId = await working.start(script, currentData);

      // Wait for completion
      let completed = false;
      while (!completed) {
        const task = await working.getTask(taskId);

        if (task) {
          if (task.status === 'completed') {
            currentData = task.result;
            completed = true;
            console.log(`  ✓ ${script} completed`);
          } else if (task.status === 'error') {
            throw new Error(`${script} failed: ${task.result}`);
          }
        }

        await new Promise(r => setTimeout(r, 500));
      }
    }

    return currentData;
  }
};

// Usage
const result = await imageProcessingPipeline.processImage('/path/to/image.jpg');
console.log('Image processing complete:', result);
```

---

## Troubleshooting

### Issue: Tasks Stuck in Queue

**Symptoms**: Tasks enqueued but never executed

**Causes**:
- Worker threads crashed
- Queueing service not properly initialized
- Max threads limit reached

**Solutions**:

```javascript
// Monitor queue status
setInterval(async () => {
  const status = await working.getStatus();

  if (status.queues.incoming > 0 && status.activeWorkers < status.maxThreads) {
    console.warn('Tasks pending but workers idle!');
  }
}, 60000);

// Increase thread count if needed
await working.saveSettings({
  maxThreads: 8
});
```

---

### Issue: High Memory Usage

**Symptoms**: Memory continuously growing

**Causes**:
- Task history not being cleared
- Large data in completed tasks

**Solutions**:

```javascript
// Periodically clean old task history
setInterval(async () => {
  // Note: Working service keeps task history in memory
  // Consider implementing a cleanup mechanism in your application
  const status = await working.getStatus();

  if (status.completedTasks > 10000) {
    console.warn('Large task history. Consider archiving or clearing old tasks.');
  }
}, 3600000);
```

---

## Best Practices

1. **Always provide a queueing service** - Working service requires queueing
2. **Monitor active workers** - Check status periodically
3. **Handle callbacks properly** - Avoid blocking operations in callbacks
4. **Set appropriate timeouts** - Configure based on your task duration
5. **Monitor queue depth** - Alert if incoming queue grows
6. **Use task IDs for tracking** - Store for later retrieval
7. **Implement error handling** - Check task status regularly
8. **Clean up old tasks** - Manage task history size
9. **Test with sample tasks** - Ensure script paths are correct
10. **Log all operations** - Enable logging for debugging

---

**Documentation Complete** ✓

For questions, see the [documentation index](./README.md).
