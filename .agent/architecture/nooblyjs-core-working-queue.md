# Working Service - Queueing Service Integration

## Overview
The working service has been successfully updated to use the queueing service for task management instead of an internal queue.

## Changes Made

### 1. Working Provider (`src/working/providers/working.js`)

#### Constructor Changes
- **Removed**: Internal `taskQueue_` array
- **Added**: `queueService_` reference from injected dependencies
- **Added**: `queueProcessorInterval_` for tracking the interval timer
- **Added**: Automatic start of queue processor on initialization

#### New Methods
- `startQueueProcessor_()`: Starts a 1-second interval that checks for available threads and processes queued tasks
- `stopQueueProcessor_()`: Stops the queue processor interval

#### Modified Methods
- `start()`: Now enqueues tasks to the queueing service instead of internal array
- `processQueue_()`: Now async, dequeues from queueing service while threads are available
- `executeTask_()`: Now async to support queue service calls
- `cleanupWorker_()`: Removed automatic queue processing (handled by interval)
- `stop()`: Now stops the queue processor and checks queue size from queueing service
- `getStatus()`: Now queries queueing service for queue size

### 2. Working Service Factory (`src/working/index.js`)

#### Changes
- Dependencies are now passed during provider construction (in `optionsWithDeps`)
- Logging now includes `hasQueueing` flag to verify queueing service availability

### 3. Dependency Configuration (`index.js`)

Already configured:
```javascript
this.serviceDependencies.set('working', ['logging','queueing','caching']);
```

## How It Works

### Task Flow
1. **Enqueue**: When `worker.start()` is called, the task is added to the queueing service
2. **Process**: Every 1 second, the queue processor checks if there are available worker threads
3. **Dequeue**: If threads are available and tasks are queued, tasks are dequeued and executed
4. **Complete**: When a worker completes, the thread becomes available for the next task

### Key Features
- ✅ Respects `maxThreads` limit (default: 4 concurrent workers)
- ✅ Tasks are processed in FIFO order (First In, First Out)
- ✅ Automatic processing every 1 second
- ✅ Proper cleanup when service stops

## Testing

### Test Results
```
Status after queueing 5 tasks:
- isRunning: true
- maxThreads: 4
- activeWorkers: 0
- queuedTasks: 5
- completedTasks: 0

Status after 2 seconds:
- isRunning: true
- maxThreads: 4
- activeWorkers: 4  ← Only 4 workers active (respecting maxThreads)
- queuedTasks: 1    ← 1 task waiting for available thread
- completedTasks: 0
```

### Example Usage
```javascript
const serviceRegistry = require('./index');
const worker = serviceRegistry.working();

// Tasks are automatically queued and processed
await worker.start(
  '/path/to/task.js',
  { data: 'example' },
  (status, result) => {
    console.log('Task completed:', status, result);
  }
);

// Check status
const status = await worker.getStatus();
console.log(status);
```

## Benefits

1. **Separation of Concerns**: Task queueing logic is now handled by the dedicated queueing service
2. **Scalability**: Could easily swap to a different queue implementation (Redis, RabbitMQ, etc.)
3. **Consistency**: Uses the same queueing service as other parts of the application
4. **Visibility**: Queue status can be monitored through the queueing service
5. **Reliability**: 1-second interval ensures tasks are processed even if events are missed

## Configuration

The working service now requires the queueing service as a dependency. This is automatically handled by the service registry's dependency injection system.

```javascript
// Automatically injected by service registry
const worker = serviceRegistry.working();
```

## Architecture Alignment

This change aligns with the NooblyJS architecture where:
- **Level 1** (Infrastructure): Queueing service
- **Level 2** (Business Logic): Working service depends on queueing service

This follows the dependency hierarchy defined in the service registry.
