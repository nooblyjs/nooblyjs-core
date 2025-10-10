# Working Service - Worker Manager

The Working Service provides a robust pub/sub threaded worker manager for executing background tasks in Node.js applications. It manages a pool of worker threads with queuing, error handling, and task state tracking.

## Features

- **Thread Pool Management**: Configurable number of concurrent worker threads (default: 4)
- **Task Queuing**: Automatic queuing when all threads are busy
- **Error Handling**: Robust error handling that prevents crashes
- **Task History**: Tracks success/failure states of all completed tasks
- **Event System**: Emits events for monitoring and debugging
- **Graceful Shutdown**: Properly terminates all threads when stopped
- **API & Views**: RESTful API endpoints and web interface

## Architecture

### Components

1. **WorkerManager** (`providers/working.js`): Main worker manager class
2. **workerScript.js** (`providers/workerScript.js`): Worker thread script executor
3. **Routes** (`routes/index.js`): Express API endpoints
4. **Views** (`views/index.js`): Web interface

## Usage

### Basic Usage

```javascript
const serviceRegistry = require('./index');

// Initialize registry
serviceRegistry.initialize(app);

// Get the worker service
const worker = serviceRegistry.working();

// Start a task
worker.start(
  '/path/to/task-script.js',
  { exampleParam: 'Hello!' },
  function(status, result) {
    console.log('Task completed with status:', status);
    console.log('Result:', result);
  }
).then((taskId) => {
  console.log('Task queued with ID:', taskId);
});

// Stop the worker manager
await worker.stop();
```

### Creating a Worker Task

Worker tasks should export a `run` function that accepts data and returns a Promise:

```javascript
// task-script.js
'use strict';

async function run(data) {
  console.log('Task started with data:', data);

  // Do some work
  const result = await someAsyncOperation(data);

  return {
    success: true,
    result: result
  };
}

module.exports = { run };
```

## API Endpoints

### POST /services/working/api/run
Starts a new worker task.

**Request Body:**
```json
{
  "scriptPath": "/path/to/task-script.js",
  "data": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

**Response:**
```json
{
  "taskId": "ab845297a69f80af21b4a6000e5a758a",
  "message": "Task queued successfully"
}
```

### GET /services/working/api/status
Returns the current status of the worker manager.

**Response:**
```json
{
  "isRunning": true,
  "maxThreads": 4,
  "activeWorkers": 2,
  "queuedTasks": 3,
  "completedTasks": 15
}
```

### GET /services/working/api/history?limit=100
Returns task history (most recent first).

**Response:**
```json
[
  {
    "taskId": "ab845297a69f80af21b4a6000e5a758a",
    "scriptPath": "/path/to/task-script.js",
    "status": "completed",
    "result": { "success": true },
    "queuedAt": "2025-10-10T09:53:57.746Z",
    "startedAt": "2025-10-10T09:53:57.750Z",
    "completedAt": "2025-10-10T09:53:57.792Z"
  }
]
```

### GET /services/working/api/task/:taskId
Returns information about a specific task.

**Response:**
```json
{
  "taskId": "ab845297a69f80af21b4a6000e5a758a",
  "scriptPath": "/path/to/task-script.js",
  "status": "completed",
  "result": { "success": true },
  "queuedAt": "2025-10-10T09:53:57.746Z",
  "startedAt": "2025-10-10T09:53:57.750Z",
  "completedAt": "2025-10-10T09:53:57.792Z"
}
```

### GET /services/working/api/stop
Stops all active workers and clears the queue.

**Response:**
```json
{}
```

## Events

The WorkerManager emits the following events:

- `worker:queued` - Task added to queue
- `worker:start` - Worker thread started for a task
- `worker:status` - Worker status update (running, completed, error)
- `worker:error` - Worker encountered an error
- `worker:exit` - Worker thread exited
- `worker:exit:error` - Worker exited with error code
- `worker:callback:error` - Error in completion callback
- `worker:manager:stopping` - Manager is stopping
- `worker:manager:stopped` - Manager has stopped
- `worker-complete` - Task completed (emitted by routes)

## Configuration

Configure the worker manager when initializing the service:

```javascript
const options = {
  maxThreads: 8  // Maximum concurrent worker threads (default: 4)
};

const worker = serviceRegistry.working(options);
```

## Error Handling

The WorkerManager handles errors gracefully:

1. **Worker Errors**: Caught and stored in task history with status 'error'
2. **Script Errors**: Caught by workerScript.js and reported as status 'error'
3. **Callback Errors**: Caught and logged, doesn't affect task completion
4. **Exit Errors**: Non-zero exit codes stored as errors (unless task already completed)

All errors are:
- Stored in task history
- Emitted as events
- Passed to completion callbacks
- Logged to console

## Best Practices

1. **Always use absolute paths** for script paths
2. **Return meaningful results** from worker tasks
3. **Handle errors** in your worker task scripts
4. **Use callbacks** for real-time notifications
5. **Query task history** for audit trails
6. **Monitor events** for debugging
7. **Set appropriate maxThreads** based on your workload

## Example Application

See `app-working.js` for a complete example implementation.

## License

NooblyJS Team - Version 1.0.14
