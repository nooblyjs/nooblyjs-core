# Queueing Service - Comprehensive Usage Guide

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
6. [Client Library (Browser)](#client-library-browser)
7. [Analytics Module](#analytics-module)
8. [Scripts & Testing](#scripts--testing)
9. [Advanced Usage Patterns](#advanced-usage-patterns)
10. [Examples & Recipes](#examples--recipes)
11. [Troubleshooting](#troubleshooting)

---

## Service Overview

The **Queueing Service** provides FIFO (First-In-First-Out) message queue functionality with multiple backend providers. It enables task queuing, message processing, and asynchronous job management with full analytics and monitoring capabilities.

### Key Features

- **Multiple Providers**: Memory, Redis, RabbitMQ, AWS SQS, Azure Queue, GCP Pub/Sub, and API-based
- **FIFO Queue Operations**: Reliable message ordering with enqueue/dequeue
- **Named Queues**: Create unlimited independent queues within a single service instance
- **Multi-Instance Support**: Run multiple queueing service instances with different configurations
- **Event-Driven**: Automatic event emission for all queue operations
- **Analytics Module**: Track queue metrics, activity timelines, and distribution
- **Dependency Injection**: Integrate with logging, caching, and data persistence services
- **REST API**: Full HTTP API for remote queue operations
- **Browser Client**: JavaScript library for client-side queue operations

### Architecture

```
┌─────────────────────────────────────────┐
│     Queueing Service                    │
├─────────────────────────────────────────┤
│  Memory │ Redis │ RabbitMQ │ Cloud ... │
├─────────────────────────────────────────┤
│  Named Queues (Multiple)                │
│  ├─ queue1: [task1, task2, task3]       │
│  ├─ queue2: [message1, message2]        │
│  └─ queueN: [...]                       │
├─────────────────────────────────────────┤
│  Analytics Module (Event-Driven)        │
│  ├─ Operation Tracking                  │
│  ├─ Metrics Collection                  │
│  └─ Timeline & Distribution              │
└─────────────────────────────────────────┘
```

### Performance Characteristics

| Provider | Throughput | Persistence | Latency | Cost |
|----------|-----------|-------------|---------|------|
| **Memory** | Very High | No | <1ms | Free |
| **Redis** | High | Optional | <5ms | Low |
| **RabbitMQ** | High | Yes | <10ms | Medium |
| **AWS SQS** | High | Yes | 10-50ms | Low |
| **Azure Queue** | High | Yes | 10-50ms | Low |
| **GCP Pub/Sub** | High | Yes | 10-50ms | Low |
| **API** | Variable | Varies | Variable | Variable |

---

## Service Initialization

### Basic Setup (Memory Provider)

```javascript
const EventEmitter = require('events');
const createQueueing = require('./src/queueing');

// Create event emitter for inter-service communication
const eventEmitter = new EventEmitter();

// Create queue service with memory provider
const queue = createQueueing('memory', {
  instanceName: 'default'
}, eventEmitter);

// Queue is now ready to use
console.log('Queue service initialized');
```

### Setup with Dependencies

```javascript
const createLogging = require('./src/logging');
const createCaching = require('./src/caching');
const createDataService = require('./src/dataservice');
const createQueueing = require('./src/queueing');

const eventEmitter = new EventEmitter();

// Create dependent services
const logging = createLogging('file', { logDir: './.logs' }, eventEmitter);
const caching = createCaching('memory', {}, eventEmitter);
const dataservice = createDataService('file', { dataDir: './.data' }, eventEmitter);

// Create queue service with dependencies
const queue = createQueueing('memory', {
  instanceName: 'task-queue',
  dependencies: {
    logging: logging,
    caching: caching,
    dataservice: dataservice
  }
}, eventEmitter);

console.log('Queue service with dependencies ready');
```

### Named Instances

```javascript
// Create multiple queue instances with different configurations
const defaultQueue = createQueueing('memory', {
  instanceName: 'default'
}, eventEmitter);

const priorityQueue = createQueueing('redis', {
  instanceName: 'priority-queue',
  host: 'localhost',
  port: 6379
}, eventEmitter);

const archiveQueue = createQueueing('memory', {
  instanceName: 'archive-queue'
}, eventEmitter);

// Use them independently
await defaultQueue.enqueue('tasks', { id: 1 });
await priorityQueue.enqueue('urgent', { priority: 'high' });
await archiveQueue.enqueue('archived', { date: '2025-11-22' });
```

---

## Provider Options

The queueing service supports 7 different provider types, each optimized for different deployment scenarios:

**Available Providers**:
- **Memory** (`'memory'`) – In-process queue, no persistence
- **Redis** (`'redis'`) – Distributed queue with Redis backend
- **RabbitMQ** (`'rabbitmq'`) – Enterprise message broker
- **API** (`'api'`) – HTTP proxy to remote queue service
- **AWS SQS** (`'aws'`) – AWS Simple Queue Service (lazy-loaded)
- **Azure Queue** (`'azure'`) – Azure Queue Storage (lazy-loaded)
- **GCP Cloud Tasks** (`'gcp'`) – Google Cloud Tasks (lazy-loaded)

**Note**: Cloud providers (AWS, Azure, GCP) are lazy-loaded, meaning their SDKs are only required when those providers are selected.

### Memory Provider

In-memory queue store. Best for development and single-process deployments.

```javascript
const queue = createQueueing('memory', {
  instanceName: 'default'
}, eventEmitter);
```

**Configuration Options**:
- `instanceName` (string, default: 'default') - Unique instance identifier

**Characteristics**:
- Data lost on process restart
- No persistence
- Ultra-low latency
- No external dependencies

---

### Redis Provider

Persistent queue using Redis backend. Excellent for distributed systems.

```javascript
const queue = createQueueing('redis', {
  instanceName: 'redis-queue',
  redisurl: 'localhost',
  redisport: 6379
}, eventEmitter);
```

**Configuration Options**:
- `instanceName` (string, default: 'default') - Unique instance identifier
- `redisurl` (string, default: '127.0.0.1') - Redis server hostname
- `redisport` (number, default: 6379) - Redis server port
- `redisdurl` (string, deprecated) - Alias for `redisurl` (for backward compatibility)

**Settings Logging**: All setting changes are logged via the injected logging service.

**Characteristics**:
- Persistent storage
- Multi-process safe
- Good performance
- Requires Redis server running

---

### RabbitMQ Provider

Enterprise message broker with advanced routing.

```javascript
const queue = createQueueing('rabbitmq', {
  instanceName: 'rabbitmq-queue',
  rabbitmqUrl: 'amqp://localhost'
}, eventEmitter);
```

**Configuration Options**:
- `instanceName` (string, default: 'default') - Unique instance identifier
- `rabbitmqUrl` (string, default: 'amqp://localhost') - RabbitMQ AMQP connection URL

**Settings Logging**: All setting changes are logged via the injected logging service.

**Characteristics**:
- Enterprise-grade reliability
- Complex routing rules
- Persistent by default
- Requires RabbitMQ server

---

### Cloud Providers (AWS, Azure, GCP)

#### AWS SQS

```javascript
const queue = createQueueing('aws', {
  instanceName: 'sqs-queue',
  region: 'us-east-1'
}, eventEmitter);
```

#### Azure Queue Storage

```javascript
const queue = createQueueing('azure', {
  instanceName: 'azure-queue',
  accountName: 'storageaccount',
  accountKey: 'xxxx'
}, eventEmitter);
```

#### GCP Pub/Sub

```javascript
const queue = createQueueing('gcp', {
  instanceName: 'pubsub-queue',
  projectId: 'my-project'
}, eventEmitter);
```

---

### API Provider

Remote queue service via HTTP. Proxies all queue operations to a remote queueing service.

```javascript
const queue = createQueueing('api', {
  instanceName: 'remote-queue',
  url: 'http://queue-service.example.com',
  apikey: 'xxxx-xxxx-xxxx',
  timeout: 5000
}, eventEmitter);
```

**Configuration Options**:
- `instanceName` (string, default: 'default') - Unique instance identifier
- `url` or `api` (string, default: 'http://localhost:3000') - Remote queue service base URL
- `apikey` or `apiKey` (string, optional) - API key for authentication
- `timeout` (number, default: 5000) - Request timeout in milliseconds

**Characteristics**:
- All operations are HTTP requests to remote service
- Same interface as local providers (enqueue, dequeue, size, etc.)
- Event emission via remote service
- Suitable for distributed queue access
- Requires remote queueing service availability

---

## Service API (Node.js)

### Input Validation

All queue providers validate queue names before operations:

- **Queue Name Validation**: Queue names must be non-empty strings
- **Error Handling**: Invalid queue names throw an `Error` with message: `"Invalid queue name: must be a non-empty string"`
- **Event Emission**: Validation errors emit `queue:validation-error:{instanceName}` events

**Example**:

```javascript
try {
  // This will throw an error - queue name is empty
  await queue.enqueue('', { data: 'test' });
} catch (error) {
  console.error('Validation error:', error.message);
  // Error: Invalid queue name: must be a non-empty string
}

// Valid queue names
await queue.enqueue('email-tasks', { to: 'user@example.com' });
await queue.enqueue('my-queue-123', { id: 456 });
```

---

### Core Methods

#### `enqueue(queueName, item)`

Adds a task to the end of the specified queue.

**Parameters**:
- `queueName` (string, required) - Name of the queue
- `item` (any, required) - Task object or message to enqueue

**Returns**: `Promise<void>`

**Throws**: Error if queueName is invalid or item is undefined

**Example**:

```javascript
// Enqueue a simple task
await queue.enqueue('email-tasks', {
  type: 'send-email',
  to: 'user@example.com',
  subject: 'Welcome'
});

// Enqueue with metadata
await queue.enqueue('process-orders', {
  orderId: 'ORD-123',
  userId: 'USER-456',
  amount: 99.99,
  timestamp: new Date().toISOString()
});

// Enqueue multiple items
const tasks = [
  { id: 1, action: 'process' },
  { id: 2, action: 'validate' },
  { id: 3, action: 'complete' }
];

for (const task of tasks) {
  await queue.enqueue('workflow-tasks', task);
}
```

**Event Emitted**: `queue:enqueue:{instanceName}`

---

#### `dequeue(queueName)`

Removes and returns the first task from the specified queue.

**Parameters**:
- `queueName` (string, required) - Name of the queue

**Returns**: `Promise<any>` - Task object or undefined if queue is empty

**Throws**: Error if queueName is invalid

**Example**:

```javascript
// Dequeue a single task
const task = await queue.dequeue('email-tasks');
if (task) {
  console.log('Processing task:', task);
  // Process the task
  await sendEmail(task.to, task.subject);
} else {
  console.log('Queue is empty');
}

// Dequeue with error handling
try {
  const item = await queue.dequeue('process-orders');
  if (item) {
    await processOrder(item);
  }
} catch (error) {
  console.error('Dequeue failed:', error.message);
}

// Continuous processing loop
const processQueue = async () => {
  while (true) {
    const task = await queue.dequeue('workflow-tasks');
    if (!task) {
      // Queue empty, wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }

    try {
      await executeTask(task);
    } catch (error) {
      console.error('Task execution failed:', error);
      // Re-enqueue failed task for retry
      await queue.enqueue('failed-tasks', {
        ...task,
        error: error.message,
        retryCount: (task.retryCount || 0) + 1
      });
    }
  }
};

processQueue().catch(console.error);
```

**Event Emitted**: `queue:dequeue:{instanceName}`

---

#### `size(queueName)`

Returns the current number of tasks in the specified queue.

**Parameters**:
- `queueName` (string, required) - Name of the queue

**Returns**: `Promise<number>` - Current queue size

**Throws**: Error if queueName is invalid

**Example**:

```javascript
// Check queue size
const size = await queue.size('email-tasks');
console.log(`Queue has ${size} tasks`);

// Conditional processing
const tasksWaiting = await queue.size('process-orders');
if (tasksWaiting > 100) {
  console.log('Queue is backing up, consider adding workers');
}

// Monitor queue depth
setInterval(async () => {
  const sizes = {};
  const queueNames = await queue.listQueues();

  for (const name of queueNames) {
    sizes[name] = await queue.size(name);
  }

  console.log('Queue sizes:', sizes);
}, 5000);
```

**Event Emitted**: `queue:size:{instanceName}`

---

#### `listQueues()`

Returns a list of all queue names in this service instance.

**Parameters**: None

**Returns**: `Promise<Array<string>>` - Array of queue names

**Example**:

```javascript
// Get all queues
const allQueues = await queue.listQueues();
console.log('Active queues:', allQueues);
// Output: ['email-tasks', 'process-orders', 'workflow-tasks']

// List with stats
const queueList = await queue.listQueues();
const stats = {};

for (const queueName of queueList) {
  stats[queueName] = {
    size: await queue.size(queueName)
  };
}

console.log('Queue statistics:', stats);
```

---

#### `purge(queueName)`

Removes all tasks from the specified queue.

**Parameters**:
- `queueName` (string, required) - Name of the queue

**Returns**: `Promise<void>`

**Throws**: Error if queueName is invalid

**Example**:

```javascript
// Clear a queue
await queue.purge('failed-tasks');
console.log('Failed tasks queue cleared');

// Conditional purge
const size = await queue.size('temp-queue');
if (size > 1000) {
  console.log('Queue is too large, purging old items');
  await queue.purge('temp-queue');
}
```

**Event Emitted**: `queue:purge:{instanceName}`

---

#### `getSettings()`

Retrieves the current settings for the queue service.

**Parameters**: None

**Returns**: `Promise<Object>` - Settings object

**Example**:

```javascript
const settings = await queue.getSettings();
console.log('Current settings:', settings);
// Output: { description: "There are no settings defined for the in memory queue", list: [] }
```

---

#### `saveSettings(settings)`

Updates the queue service settings.

**Parameters**:
- `settings` (Object, required) - Settings object to save

**Returns**: `Promise<void>`

**Example**:

```javascript
await queue.saveSettings({
  maxQueueSize: 10000,
  enablePersistence: true
});
```

---

## REST API Endpoints

All endpoints support both JSON requests and responses, with proper error handling and event emission.

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

### Enqueue Operations

#### `POST /services/queueing/api/enqueue/:queueName`

Adds a task to the default queue instance.

**Path Parameters**:
- `queueName` (string) - Name of the queue

**Request Body**:
```json
{
  "task": { "your": "data" }
}
```

**Response** (Success - HTTP 200):
```json
{
  "success": true
}
```

**Response** (Error - HTTP 400):
```json
{
  "error": "Bad Request: Missing queue name"
}
```

**cURL Example**:

```bash
curl -X POST http://localhost:3001/services/queueing/api/enqueue/email-tasks \
  -H "Content-Type: application/json" \
  -d '{
    "task": {
      "to": "user@example.com",
      "subject": "Welcome"
    }
  }'
```

---

#### `POST /services/queueing/api/:instanceName/enqueue/:queueName`

Adds a task to a named queue instance.

**Path Parameters**:
- `instanceName` (string) - Queue service instance name
- `queueName` (string) - Name of the queue

**Request Body**:
```json
{
  "task": { "your": "data" }
}
```

**cURL Example**:

```bash
curl -X POST http://localhost:3001/services/queueing/api/priority-queue/enqueue/urgent-tasks \
  -H "Content-Type: application/json" \
  -d '{"task": {"priority": "high", "action": "process"}}'
```

---

### Dequeue Operations

#### `GET /services/queueing/api/dequeue/:queueName`

Removes and returns the next task from the default queue instance.

**Path Parameters**:
- `queueName` (string) - Name of the queue

**Response** (Success):
```json
{
  "to": "user@example.com",
  "subject": "Welcome"
}
```

**Response** (Empty Queue):
```json
null
```

**cURL Example**:

```bash
curl http://localhost:3001/services/queueing/api/dequeue/email-tasks
```

---

#### `GET /services/queueing/api/:instanceName/dequeue/:queueName`

Removes and returns the next task from a named queue instance.

**Path Parameters**:
- `instanceName` (string) - Queue service instance name
- `queueName` (string) - Name of the queue

**cURL Example**:

```bash
curl http://localhost:3001/services/queueing/api/priority-queue/dequeue/urgent-tasks
```

---

### Queue Size Operations

#### `GET /services/queueing/api/size/:queueName`

Returns the number of tasks in the default queue instance.

**Path Parameters**:
- `queueName` (string) - Name of the queue

**Response**:
```json
42
```

**cURL Example**:

```bash
curl http://localhost:3001/services/queueing/api/size/email-tasks
```

---

#### `GET /services/queueing/api/:instanceName/size/:queueName`

Returns the number of tasks in a named queue instance.

**cURL Example**:

```bash
curl http://localhost:3001/services/queueing/api/priority-queue/size/urgent-tasks
```

---

### Queue Listing

#### `GET /services/queueing/api/queues`

Lists all queue names in the default instance.

**Response**:
```json
["email-tasks", "process-orders", "workflow-tasks"]
```

**cURL Example**:

```bash
curl http://localhost:3001/services/queueing/api/queues
```

---

#### `GET /services/queueing/api/:instanceName/queues`

Lists all queue names in a named instance.

**cURL Example**:

```bash
curl http://localhost:3001/services/queueing/api/priority-queue/queues
```

---

### Purge Operations

#### `DELETE /services/queueing/api/purge/:queueName`

Removes all tasks from a queue in the default instance.

**Path Parameters**:
- `queueName` (string) - Name of the queue to purge

**Response** (Success - HTTP 200):
```json
{
  "success": true
}
```

**Response** (Error - HTTP 400):
```json
{
  "error": "Bad Request: Missing queue name"
}
```

**cURL Example**:

```bash
curl -X DELETE http://localhost:3001/services/queueing/api/purge/failed-tasks
```

---

#### `DELETE /services/queueing/api/:instanceName/purge/:queueName`

Removes all tasks from a queue in a named instance.

**cURL Example**:

```bash
curl -X DELETE http://localhost:3001/services/queueing/api/priority-queue/purge/temporary-tasks
```

---

### Status & Metadata

#### `GET /services/queueing/api/status`

Returns the operational status of the queueing service.

**Response**:
```json
"queueing api running"
```

**cURL Example**:

```bash
curl http://localhost:3001/services/queueing/api/status
```

---

#### `GET /services/queueing/api/instances`

Lists all available queueing service instances.

**Response**:
```json
{
  "success": true,
  "instances": [
    {
      "name": "default",
      "provider": "memory",
      "status": "active"
    },
    {
      "name": "priority-queue",
      "provider": "redis",
      "status": "active"
    }
  ],
  "total": 2
}
```

**cURL Example**:

```bash
curl http://localhost:3001/services/queueing/api/instances
```

---

### Analytics Endpoints

#### `GET /services/queueing/api/analytics`

Returns comprehensive analytics for the default queue instance.

**Response**:
```json
{
  "stats": {
    "totalQueues": 3,
    "queues": {
      "email-tasks": {
        "enqueueCount": 150,
        "dequeueCount": 142,
        "purgeCount": 0,
        "totalMessages": 150,
        "firstActivity": "2025-11-22T10:00:00.000Z",
        "lastActivity": "2025-11-22T15:30:45.000Z"
      }
    }
  },
  "distribution": {
    "labels": ["email-tasks", "process-orders", "workflow-tasks"],
    "data": [150, 87, 42]
  },
  "timeline": {
    "labels": ["10:00", "11:00", "12:00"],
    "datasets": [
      {
        "name": "email-tasks",
        "data": [45, 38, 67]
      }
    ]
  },
  "queueList": [
    {
      "name": "email-tasks",
      "currentSize": 8,
      "totalEnqueued": 150,
      "totalDequeued": 142,
      "totalMessages": 150
    }
  ]
}
```

**cURL Example**:

```bash
curl http://localhost:3001/services/queueing/api/analytics
```

---

#### `GET /services/queueing/api/:instanceName/analytics`

Returns analytics for a named queue instance.

**cURL Example**:

```bash
curl http://localhost:3001/services/queueing/api/priority-queue/analytics
```

---

### Settings Endpoints

#### `GET /services/queueing/api/settings`

Retrieves current settings.

**Response**:
```json
{
  "description": "There are no settings defined for the in memory queue",
  "list": []
}
```

---

#### `POST /services/queueing/api/settings`

Updates service settings.

**Request Body**:
```json
{
  "setting1": "value1",
  "setting2": "value2"
}
```

**Response** (Success - HTTP 200):
```json
{
  "success": true
}
```

**Response** (Error - HTTP 400):
```json
{
  "error": "Bad Request: Missing settings"
}
```

**cURL Example**:

```bash
curl -X POST http://localhost:3001/services/queueing/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "workerTimeout": 600000,
    "enableLogging": true
  }'
```

---

## Client Library (Browser)

The queueing service provides a JavaScript client library for browser-based queue operations.

### Loading the Library

```html
<script src="/services/queueing/scripts"></script>
```

### Modes of Operation

The client library supports two modes:

1. **Local Mode** (no instance name): Client-side in-memory queues
2. **Remote Mode** (with instance name): Server-side queue operations via REST API

### Local Mode (In-Memory)

```javascript
// Create a local queue (no server communication)
const queue = new QueueingClient();

// Enqueue items
queue.enqueue('tasks', { id: 1, action: 'process' });
queue.enqueue('tasks', { id: 2, action: 'validate' });

// Dequeue items
const item = queue.dequeue('tasks');
console.log('Processing:', item);

// Check queue size
const size = queue.size('tasks');
console.log(`Queue size: ${size}`);

// List all queues
const allQueues = queue.listQueues();
console.log('Queues:', allQueues);

// Purge a queue
queue.purge('tasks');
```

---

### Remote Mode (Server-Side)

```javascript
// Create a remote queue instance (connects to server)
const queue = new QueueingClient('default');

// Enqueue (remote operation)
await queue.enqueue('email-tasks', {
  to: 'user@example.com',
  subject: 'Welcome'
});

// Dequeue (remote operation)
const task = await queue.dequeue('email-tasks');
if (task) {
  console.log('Processing:', task);
}

// Get size (remote operation)
const size = await queue.size('email-tasks');
console.log(`Queue size: ${size}`);

// List queues (remote operation)
const queueList = await queue.listQueues();
console.log('Queues:', queueList);

// Purge queue (remote operation)
await queue.purge('failed-tasks');
```

---

### Complete Browser Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Queueing Service Demo</title>
  <script src="/services/queueing/scripts"></script>
</head>
<body>
  <h1>Queue Management</h1>

  <div>
    <h2>Add Task</h2>
    <input type="text" id="taskInput" placeholder="Task description">
    <button onclick="addTask()">Enqueue</button>
  </div>

  <div>
    <h2>Process Task</h2>
    <button onclick="processTask()">Dequeue</button>
    <p id="currentTask"></p>
  </div>

  <div>
    <h2>Queue Status</h2>
    <p>Queue Size: <span id="queueSize">0</span></p>
    <button onclick="updateSize()">Refresh</button>
  </div>

  <script>
    // Create remote queue client
    const queue = new QueueingClient('default');

    async function addTask() {
      const input = document.getElementById('taskInput');
      const task = input.value.trim();

      if (task) {
        await queue.enqueue('browser-tasks', {
          description: task,
          timestamp: new Date().toISOString()
        });
        input.value = '';
        updateSize();
      }
    }

    async function processTask() {
      const task = await queue.dequeue('browser-tasks');
      const display = document.getElementById('currentTask');

      if (task) {
        display.innerHTML = JSON.stringify(task, null, 2);
      } else {
        display.innerHTML = 'No tasks in queue';
      }

      updateSize();
    }

    async function updateSize() {
      const size = await queue.size('browser-tasks');
      document.getElementById('queueSize').textContent = size;
    }

    // Initial load
    updateSize();
  </script>
</body>
</html>
```

---

## Analytics Module

The queueing service includes a built-in analytics module that automatically tracks all queue operations.

### Methods

#### `getStats()`

Returns aggregate statistics for all queues.

**Returns**:
```javascript
{
  totalQueues: 3,
  queues: {
    "email-tasks": {
      enqueueCount: 150,
      dequeueCount: 142,
      purgeCount: 0,
      totalMessages: 150,
      firstActivity: "2025-11-22T10:00:00.000Z",
      lastActivity: "2025-11-22T15:30:45.000Z"
    },
    // ... more queues
  }
}
```

---

#### `getQueueStats(queueName)`

Returns statistics for a specific queue.

**Parameters**:
- `queueName` (string) - Name of the queue

**Returns**:
```javascript
{
  enqueueCount: 150,
  dequeueCount: 142,
  purgeCount: 0,
  totalMessages: 150,
  firstActivity: "2025-11-22T10:00:00.000Z",
  lastActivity: "2025-11-22T15:30:45.000Z"
}
```

---

#### `getDistribution()`

Returns message distribution across all queues for visualization.

**Returns**:
```javascript
{
  labels: ["email-tasks", "process-orders", "workflow-tasks"],
  data: [150, 87, 42]
}
```

---

#### `getTopQueues(limit = 10)`

Returns the most active queues sorted by total operations.

**Returns**:
```javascript
[
  {
    name: "email-tasks",
    totalActivity: 292,
    enqueueCount: 150,
    dequeueCount: 142,
    totalMessages: 150
  },
  // ... more queues
]
```

---

#### `getTimeline(topN = 10)`

Returns timeline data showing queue activity over time.

**Returns**:
```javascript
{
  labels: ["10:00", "11:00", "12:00", "13:00"],
  datasets: [
    {
      name: "email-tasks",
      data: [45, 38, 67, 42]
    },
    {
      name: "process-orders",
      data: [20, 15, 25, 18]
    }
  ]
}
```

---

#### `getQueueList(queueService, limit = 100)`

Returns detailed information for all queues with current sizes.

**Parameters**:
- `queueService` (Object, optional) - Queue service instance for real-time data
- `limit` (number, default: 100) - Maximum queues to return

**Returns**:
```javascript
[
  {
    name: "email-tasks",
    currentSize: 8,
    totalEnqueued: 150,
    totalDequeued: 142,
    totalMessages: 150,
    stats: { /* full stats object */ }
  },
  // ... more queues
]
```

---

#### `getQueueCount()`

Returns the total number of tracked queues.

**Returns**: `number`

---

#### `clear()`

Clears all stored analytics data (not the queue data itself).

**Returns**: `void`

---

#### `destroy()`

Removes all event listeners and clears analytics data. Should be called when the analytics module is no longer needed to prevent memory leaks in long-running applications.

**Returns**: `void`

**Example**:

```javascript
// When shutting down the application
if (queue && queue.analytics) {
  queue.analytics.destroy();
  console.log('Analytics cleaned up');
}
```

---

### Analytics Examples

```javascript
// Get all statistics
const allStats = queue.analytics.getStats();
console.log(`Total queues: ${allStats.totalQueues}`);

// Find most active queue
const topQueues = queue.analytics.getTopQueues(1);
if (topQueues.length > 0) {
  const busiest = topQueues[0];
  console.log(`Busiest queue: ${busiest.name} (${busiest.totalActivity} ops)`);
}

// Monitor queue health
setInterval(() => {
  const distribution = queue.analytics.getDistribution();
  console.log('Queue distribution:', distribution);

  const timeline = queue.analytics.getTimeline(5);
  console.log('Recent activity:', timeline);
}, 60000); // Every minute

// Get detailed queue information
const queueList = await queue.analytics.getQueueList(queue);
queueList.forEach(info => {
  console.log(`${info.name}: ${info.currentSize} items, ${info.totalEnqueued} total added`);
});
```

---

## Scripts & Testing

### NPM Commands

```bash
# Run queueing service tests
npm test -- tests/unit/queueing/

# Run specific queueing test
npm test -- tests/unit/queueing/inMemoryQueue.test.js

# Run with coverage
npm test -- --coverage tests/unit/queueing/

# Run in watch mode
npm test -- --watch tests/unit/queueing/
```

### Load Testing

```bash
# Run queue load tests
npm run test-load -- tests/load/queueing/loadTest.js
```

### Manual Testing

```bash
# Start development server
npm run dev:web

# Access queueing service UI
# http://localhost:3001/services/queueing/

# Test endpoints with curl
curl http://localhost:3001/services/queueing/api/status

# View API documentation
curl http://localhost:3001/services/queueing/api/swagger/docs.json
```

---

## Advanced Usage Patterns

### 1. Work Queue Pattern

Process tasks from a queue with multiple workers:

```javascript
class QueueWorker {
  constructor(queue, queueName, workerId) {
    this.queue = queue;
    this.queueName = queueName;
    this.workerId = workerId;
    this.running = false;
  }

  async start() {
    this.running = true;
    console.log(`Worker ${this.workerId} started`);

    while (this.running) {
      try {
        const task = await this.queue.dequeue(this.queueName);

        if (!task) {
          // Queue empty, wait
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        console.log(`Worker ${this.workerId} processing:`, task);
        await this.processTask(task);

      } catch (error) {
        console.error(`Worker ${this.workerId} error:`, error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async processTask(task) {
    // Simulate work
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(`Worker ${this.workerId} completed task`);
        resolve();
      }, Math.random() * 5000);
    });
  }

  stop() {
    this.running = false;
    console.log(`Worker ${this.workerId} stopped`);
  }
}

// Create multiple workers
const workers = [];
for (let i = 1; i <= 4; i++) {
  const worker = new QueueWorker(queue, 'tasks', i);
  worker.start().catch(console.error);
  workers.push(worker);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  workers.forEach(w => w.stop());
});
```

---

### 2. Priority Queue Pattern

Implement priority-based processing:

```javascript
async function enqueueWithPriority(task, priority = 'normal') {
  const priorities = ['low', 'normal', 'high', 'urgent'];
  const queueName = `tasks-${priority}`;

  await queue.enqueue(queueName, {
    ...task,
    priority: priority,
    enqueuedAt: new Date().toISOString()
  });
}

async function dequeueByPriority() {
  const priorityOrder = ['urgent', 'high', 'normal', 'low'];

  for (const priority of priorityOrder) {
    const queueName = `tasks-${priority}`;
    const size = await queue.size(queueName);

    if (size > 0) {
      return await queue.dequeue(queueName);
    }
  }

  return null;
}

// Use priority queue
await enqueueWithPriority({ action: 'send-email' }, 'normal');
await enqueueWithPriority({ action: 'alert-admin' }, 'urgent');

const task = await dequeueByPriority();
// Processes 'alert-admin' first
```

---

### 3. Dead Letter Queue Pattern

Handle failed tasks:

```javascript
const MAX_RETRIES = 3;

async function processWithRetry(task, queueName) {
  const maxRetries = task.retryCount || 0;

  try {
    await executeTask(task);
    console.log('Task succeeded');
  } catch (error) {
    if (maxRetries < MAX_RETRIES) {
      // Re-enqueue for retry
      task.retryCount = maxRetries + 1;
      task.lastError = error.message;
      await queue.enqueue(queueName, task);
      console.log(`Task re-queued (retry ${maxRetries + 1}/${MAX_RETRIES})`);
    } else {
      // Send to dead letter queue
      await queue.enqueue('dead-letter', {
        ...task,
        failedAt: new Date().toISOString(),
        finalError: error.message
      });
      console.log('Task sent to dead letter queue');
    }
  }
}

// Monitor dead letter queue
async function monitorDeadLetterQueue() {
  const dlqSize = await queue.size('dead-letter');
  if (dlqSize > 0) {
    console.warn(`Dead letter queue has ${dlqSize} items`);
  }
}
```

---

### 4. Scheduled Batch Processing

Process queued items in batches at intervals:

```javascript
class BatchProcessor {
  constructor(queue, queueName, batchSize = 10) {
    this.queue = queue;
    this.queueName = queueName;
    this.batchSize = batchSize;
    this.interval = null;
  }

  start(intervalMs = 30000) {
    this.interval = setInterval(() => this.processBatch(), intervalMs);
    console.log(`Batch processor started (interval: ${intervalMs}ms)`);
  }

  async processBatch() {
    const batch = [];

    for (let i = 0; i < this.batchSize; i++) {
      const item = await this.queue.dequeue(this.queueName);
      if (!item) break;
      batch.push(item);
    }

    if (batch.length > 0) {
      console.log(`Processing batch of ${batch.length} items`);
      await this.processBatchItems(batch);
    }
  }

  async processBatchItems(batch) {
    // Process all items in batch
    const results = await Promise.all(batch.map(item =>
      this.processItem(item).catch(err => ({ error: err }))
    ));

    console.log(`Batch complete:`, results);
  }

  async processItem(item) {
    // Placeholder for actual processing
    return new Promise(resolve =>
      setTimeout(() => resolve({ success: true, item }), 100)
    );
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log('Batch processor stopped');
    }
  }
}

// Use batch processor
const processor = new BatchProcessor(queue, 'batch-jobs', 20);
processor.start(60000); // Process every minute

process.on('SIGTERM', () => processor.stop());
```

---

## Examples & Recipes

### Real-World Recipe: Email Queue

```javascript
// Initialize queue for email tasks
const emailQueue = createQueueing('redis', {
  instanceName: 'email-service',
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
}, eventEmitter);

// Email task enqueuer
async function queueEmail(recipient, subject, body) {
  await emailQueue.enqueue('outgoing-emails', {
    id: `${Date.now()}-${Math.random()}`,
    recipient,
    subject,
    body,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    status: 'pending'
  });
}

// Email processor worker
async function startEmailWorker() {
  while (true) {
    try {
      const email = await emailQueue.dequeue('outgoing-emails');

      if (!email) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      try {
        await sendEmailViaProvider(email);
        console.log(`Email sent to ${email.recipient}`);
      } catch (error) {
        if (email.retryCount < 3) {
          email.retryCount++;
          email.lastError = error.message;
          await emailQueue.enqueue('outgoing-emails', email);
        } else {
          await emailQueue.enqueue('failed-emails', {
            ...email,
            failedAt: new Date().toISOString(),
            finalError: error.message
          });
        }
      }
    } catch (error) {
      console.error('Worker error:', error);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

// Start worker
startEmailWorker().catch(console.error);

// Monitor queue health
setInterval(async () => {
  const stats = emailQueue.analytics.getQueueStats('outgoing-emails');
  const failedStats = emailQueue.analytics.getQueueStats('failed-emails');

  if (stats) {
    console.log(`Pending emails: ${stats.totalMessages - stats.dequeueCount}`);
  }
  if (failedStats) {
    console.log(`Failed emails: ${failedStats.totalMessages}`);
  }
}, 60000);
```

---

### Recipe: Job Scheduler Queue

```javascript
// Job scheduling queue
const jobQueue = createQueueing('memory', {
  instanceName: 'job-scheduler'
}, eventEmitter);

// Schedule a job for later
async function scheduleJob(job, delayMs) {
  setTimeout(async () => {
    await jobQueue.enqueue('scheduled-jobs', {
      id: job.id,
      type: job.type,
      data: job.data,
      scheduledFor: new Date(Date.now() + delayMs).toISOString(),
      executedAt: null
    });
  }, delayMs);
}

// Job executor
async function executeScheduledJobs() {
  while (true) {
    const job = await jobQueue.dequeue('scheduled-jobs');

    if (job) {
      console.log(`Executing job: ${job.id}`);

      try {
        await executeJobHandler[job.type](job.data);
        job.executedAt = new Date().toISOString();
        job.status = 'completed';
      } catch (error) {
        job.error = error.message;
        job.status = 'failed';
      }

      await jobQueue.enqueue('job-history', job);
    } else {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

const executeJobHandler = {
  'email': async (data) => { /* send email */ },
  'report': async (data) => { /* generate report */ },
  'backup': async (data) => { /* backup data */ }
};

startJobExecutor().catch(console.error);

// Expose scheduling API
async function queueJobLater(jobType, data, delaySeconds) {
  const delayMs = delaySeconds * 1000;
  await scheduleJob({
    id: `job-${Date.now()}`,
    type: jobType,
    data
  }, delayMs);

  return `Job scheduled for ${new Date(Date.now() + delayMs)}`;
}
```

---

## Troubleshooting

### Issue: Tasks Stuck in Queue

**Symptoms**: Queue size grows but never decreases

**Causes**:
- Worker process crashed or stopped
- Worker stuck on a task
- Tasks failing silently

**Solutions**:

```javascript
// Monitor queue growth
setInterval(async () => {
  const size = await queue.size('tasks');
  const stats = queue.analytics.getQueueStats('tasks');

  if (stats && size > 100) {
    const unprocessed = stats.totalMessages - stats.dequeueCount;
    console.warn(`Queue has ${unprocessed} unprocessed items!`);

    // Alert or escalate
    await notifyAdmins(`Queue buildup detected: ${unprocessed} items`);
  }
}, 60000);

// Add task timeout protection
async function processTaskWithTimeout(task, timeoutMs = 30000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Task timeout')), timeoutMs)
  );

  try {
    await Promise.race([processTask(task), timeoutPromise]);
  } catch (error) {
    if (error.message === 'Task timeout') {
      console.error('Task exceeded timeout:', task);
      await queue.enqueue('timed-out-tasks', task);
    } else {
      throw error;
    }
  }
}
```

---

### Issue: Memory Usage Increasing

**Symptoms**: Process memory grows continuously

**Causes**:
- Analytics buffer not cleared
- Memory provider queue retaining old items
- Event listeners not cleaned up

**Solutions**:

```javascript
// Clear old analytics periodically
setInterval(() => {
  queue.analytics.clear();
  console.log('Analytics cleared');
}, 24 * 60 * 60 * 1000); // Daily

// Monitor memory usage
setInterval(() => {
  const used = process.memoryUsage();
  console.log({
    heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
    heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB'
  });
}, 60000);

// Archive old queue items
async function archiveOldQueues() {
  const queueNames = await queue.listQueues();

  for (const name of queueNames) {
    const stats = queue.analytics.getQueueStats(name);
    if (stats && stats.lastActivity < Date.now() - 30 * 24 * 60 * 60 * 1000) {
      await queue.purge(name);
      console.log(`Archived queue: ${name}`);
    }
  }
}
```

---

### Issue: Redis Connection Failures

**Symptoms**: `ECONNREFUSED` errors with Redis provider

**Causes**:
- Redis server not running
- Network connectivity issues
- Incorrect host/port configuration

**Solutions**:

```javascript
// Implement connection retry logic
async function createQueueWithRetry(maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const q = createQueueing('redis', {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        connectTimeout: 5000
      }, eventEmitter);

      console.log('Queue connected successfully');
      return q;
    } catch (error) {
      console.error(`Connection attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        await new Promise(r =>
          setTimeout(r, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }

  throw new Error('Failed to connect to Redis after all retries');
}

// Health check endpoint
app.get('/health/queue', async (req, res) => {
  try {
    await queue.enqueue('health-check', { timestamp: Date.now() });
    const item = await queue.dequeue('health-check');
    res.json({ status: 'healthy', timestamp: Date.now() });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

---

### Issue: High Latency

**Symptoms**: Slow enqueue/dequeue operations

**Causes**:
- Network latency with cloud providers
- CPU bottleneck processing tasks
- Database operations in handlers

**Solutions**:

```javascript
// Use memory provider for local work
const localQueue = createQueueing('memory', {}, eventEmitter);

// Use Redis for distributed work
const distributedQueue = createQueueing('redis', {
  host: process.env.REDIS_HOST
}, eventEmitter);

// Monitor operation timing
class TimedQueue {
  constructor(queue) {
    this.queue = queue;
  }

  async timedEnqueue(queueName, item) {
    const start = performance.now();
    const result = await this.queue.enqueue(queueName, item);
    const duration = performance.now() - start;

    if (duration > 100) {
      console.warn(`Slow enqueue: ${duration.toFixed(2)}ms`);
    }

    return result;
  }

  async timedDequeue(queueName) {
    const start = performance.now();
    const result = await this.queue.dequeue(queueName);
    const duration = performance.now() - start;

    if (duration > 100) {
      console.warn(`Slow dequeue: ${duration.toFixed(2)}ms`);
    }

    return result;
  }
}
```

---

## Best Practices

1. **Always handle dequeue returning null** - Queues may be empty
2. **Implement retry logic** - Network operations can fail
3. **Monitor queue depth** - Set up alerts for queue buildup
4. **Use appropriate providers**:
   - Memory: Single-process applications
   - Redis: Distributed systems, low latency
   - RabbitMQ: Enterprise messaging
   - Cloud: Multi-region deployments
5. **Implement dead-letter queues** - Capture permanently failed tasks
6. **Log all operations** - Use the logging service for debugging
7. **Set reasonable timeouts** - Prevent tasks from hanging indefinitely
8. **Archive or purge old queues** - Manage memory usage
9. **Test failure scenarios** - Don't assume queues always work
10. **Monitor analytics** - Track queue health metrics

---

**Documentation Complete** ✓

For questions or issues, see the [main documentation index](./README.md).
