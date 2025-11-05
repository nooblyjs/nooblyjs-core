# NooblyJS Core Queueing Service Usage Guide

## Table of Contents

1. [Overview](#overview)
2. [Supported Providers](#supported-providers)
3. [Server-Side Usage (Node.js)](#server-side-usage-nodejs)
4. [Client-Side Usage (Browser)](#client-side-usage-browser)
5. [REST API Usage](#rest-api-usage)
6. [Provider Configuration](#provider-configuration)
7. [Advanced Features](#advanced-features)
8. [Examples](#examples)

---

## Overview

The **Queueing Service** is an enterprise-grade, multi-backend task queue solution that provides:

- **Multiple storage backends**: Memory, Redis, RabbitMQ, File-based, and Cloud providers (AWS SQS, Azure Queue Storage, GCP Cloud Tasks)
- **Dual-mode operation**: Server-side (Node.js) and client-side (Browser JavaScript)
- **Local-first development**: Built-in in-memory queue for offline-first client applications
- **Flexible API**: Identical FIFO interface across all modes and providers
- **Auto-detection**: Automatic cloud provider configuration from environment variables
- **Analytics & Monitoring**: Built-in metrics for queue operation tracking
- **REST API**: Complete HTTP endpoints for remote queue operations

### Key Features

✓ FIFO queue operations (enqueue, dequeue)
✓ Multiple named queues per instance
✓ Batch operations support
✓ Event-driven architecture for monitoring
✓ Settings management per provider
✓ Analytics with operation tracking
✓ Zero-config cloud provider setup
✓ Seamless local/remote switching
✓ Both sync (client) and async (server) APIs

---

## Supported Providers

| Provider | Backend | Use Case | Data Persistence | Distributed |
|----------|---------|----------|------------------|-------------|
| **memory** | In-memory store | Development, testing, single-process | ✗ Lost on restart | ✗ Single process |
| **redis** | Redis server | Production, distributed systems | ✓ Optional | ✓ Yes |
| **rabbitmq** | RabbitMQ broker | Enterprise messaging | ✓ Automatic | ✓ Yes |
| **api** | Remote API | Consume remote queue instance | ✓ Depends on remote | ✓ Remote |
| **aws** | AWS SQS | AWS production environments | ✓ Automatic | ✓ Yes |
| **azure** | Azure Queue Storage | Azure production environments | ✓ Automatic | ✓ Yes |
| **gcp** | GCP Cloud Tasks | Google Cloud production environments | ✓ Automatic | ✓ Yes |
| **local** | Browser storage | Client-side JavaScript (offline-first) | ✓ Browser storage | ✗ Client-only |

---

## Server-Side Usage (Node.js)

### Basic Setup

Initialize the queueing service through ServiceRegistry:

```javascript
const ServiceRegistry = require('noobly-core');

// Initialize the service registry (required first)
const eventEmitter = new (require('events').EventEmitter)();
const app = require('express')();

ServiceRegistry.initialize(app, eventEmitter, {
  apiKeys: ['your-api-key'],
  requireApiKey: true
});

// Get a queue instance (memory provider by default)
const queue = ServiceRegistry.queue('memory');

// Or with options
const queue = ServiceRegistry.queue('redis', {
  host: 'localhost',
  port: 6379,
  instanceName: 'task-queue'
});
```

### Core Methods

#### ENQUEUE - Add an Item to Queue

```javascript
// Basic enqueue
await queue.enqueue('tasks', { userId: 123, action: 'send-email' });

// Enqueue to different queues
await queue.enqueue('notifications', { type: 'sms', phone: '+1234567890' });
await queue.enqueue('reports', { reportId: 'monthly-2024', format: 'pdf' });

// Enqueue complex objects
await queue.enqueue('jobs', {
  type: 'video-processing',
  videoId: 'vid-456',
  resolutions: ['720p', '1080p', '4k'],
  priority: 'high',
  metadata: {
    userId: 789,
    timestamp: new Date().toISOString()
  }
});

// Enqueue strings directly
await queue.enqueue('messages', 'Process this message');
```

#### DEQUEUE - Get Next Item from Queue

```javascript
// Dequeue from queue (FIFO - first-in-first-out)
const task = await queue.dequeue('tasks');
if (task) {
  console.log('Processing task:', task);
  // Process the task
} else {
  console.log('Queue is empty');
}

// Dequeue with processing
async function processQueue() {
  let task;
  while ((task = await queue.dequeue('tasks')) !== undefined) {
    console.log('Processing:', task);
    // Handle task processing
    try {
      await handleTask(task);
    } catch (error) {
      // Re-queue on failure
      await queue.enqueue('tasks', task);
    }
  }
}

// Dequeue from multiple queues
async function processAllQueues() {
  const queues = ['notifications', 'reports', 'jobs'];
  for (const queueName of queues) {
    const item = await queue.dequeue(queueName);
    if (item) {
      await processItem(queueName, item);
    }
  }
}
```

#### SIZE - Get Queue Length

```javascript
// Get queue size
const count = await queue.size('tasks');
console.log(`Queue has ${count} items`);

// Monitor queue health
async function monitorQueues() {
  const queues = ['tasks', 'notifications', 'reports'];
  for (const queueName of queues) {
    const size = await queue.size(queueName);
    console.log(`${queueName}: ${size} items`);
  }
}

// Alert on queue backup
const taskQueueSize = await queue.size('tasks');
if (taskQueueSize > 1000) {
  console.warn('Task queue backup detected!');
  // Scale up workers
}
```

#### LISTQUEUES - Get All Queue Names

```javascript
// List all queues
const allQueues = await queue.listQueues();
console.log('Available queues:', allQueues);
// Output: ['tasks', 'notifications', 'reports', 'jobs']

// Check if queue exists
const queues = await queue.listQueues();
if (queues.includes('tasks')) {
  console.log('Tasks queue exists');
}

// List queues and their sizes
async function getQueueStats() {
  const queues = await queue.listQueues();
  const stats = {};
  for (const queueName of queues) {
    stats[queueName] = await queue.size(queueName);
  }
  return stats;
}
```

#### PURGE - Clear All Items from Queue

```javascript
// Clear entire queue
await queue.purge('tasks');
console.log('Tasks queue cleared');

// Purge with confirmation
async function safeQueuePurge(queueName) {
  const size = await queue.size(queueName);
  console.log(`Purging ${size} items from ${queueName}`);
  await queue.purge(queueName);
  console.log('Purge complete');
}

// Bulk purge
async function purgeAllQueues() {
  const queues = await queue.listQueues();
  for (const queueName of queues) {
    await queue.purge(queueName);
  }
  console.log('All queues purged');
}
```

### Settings Management

```javascript
// Get current settings
const settings = await queue.getSettings();
console.log('Queue settings:', settings);

// Save new settings
await queue.saveSettings({
  visibilityTimeout: 60,
  messageRetentionPeriod: 86400
});
```

### Analytics & Monitoring

```javascript
// Get operation analytics
const analytics = await queue.getAnalytics();
console.log('Analytics:', analytics);
// Output: [
//   { queueName: 'tasks', operations: 156, lastActivity: '2024-01-15T10:30:00Z' },
//   { queueName: 'notifications', operations: 42, lastActivity: '2024-01-15T10:29:45Z' }
// ]

// Monitor queue operations
async function monitorOperations() {
  setInterval(async () => {
    const analytics = await queue.getAnalytics();
    analytics.forEach(stat => {
      console.log(`${stat.queueName}: ${stat.operations} ops`);
    });
  }, 5000);
}
```

---

## Client-Side Usage (Browser)

The queueing service includes a browser-compatible JavaScript client library for offline-first applications.

### Basic Setup

Include the script in your HTML:

```html
<script src="/services/queueing/scripts/client.js"></script>
```

### Client-Side API

#### Local Queue (No Server Required)

```javascript
// Create local queue (no server needed)
const localQueue = new nooblyjscorequeueing();

// Enqueue items
await localQueue.enqueue('tasks', {
  id: 1,
  title: 'Complete form',
  timestamp: new Date().toISOString()
});

// Dequeue items
const task = await localQueue.dequeue('tasks');
if (task) {
  console.log('Processing:', task);
}

// Get queue size
const size = await localQueue.size('tasks');
console.log(`${size} items in queue`);

// List all queues
const queues = await localQueue.listQueues();
console.log('Available queues:', queues);

// Purge queue
await localQueue.purge('tasks');
```

#### Remote Queue (Server Connection)

```javascript
// Create remote queue connection
const remoteQueue = new nooblyjscorequeueing('default', {
  apiKey: 'your-api-key',
  debug: true
});

// Use identical API
await remoteQueue.enqueue('tasks', { userId: 123 });
const task = await remoteQueue.dequeue('tasks');
const size = await remoteQueue.size('tasks');
```

#### Offline-First Pattern

```javascript
// Hybrid approach: local fallback with sync
const queue = new nooblyjscorequeueing(); // Local mode by default

// Try to use remote, fallback to local
async function enqueueWithFallback(queueName, item) {
  try {
    const remoteQueue = new nooblyjscorequeueing('production');
    await remoteQueue.enqueue(queueName, item);
  } catch (error) {
    // Fallback to local queue
    const localQueue = new nooblyjscorequeueing();
    await localQueue.enqueue(queueName, item);
    console.log('Item queued locally, will sync when online');
  }
}

// Sync local queue to remote when online
async function syncQueues() {
  const localQueue = new nooblyjscorequeueing();
  const remoteQueue = new nooblyjscorequeueing('production');

  let item;
  while ((item = await localQueue.dequeue('tasks')) !== undefined) {
    try {
      await remoteQueue.enqueue('tasks', item);
    } catch (error) {
      // Re-queue locally if sync fails
      await localQueue.enqueue('tasks', item);
      break;
    }
  }
}

// Listen for online/offline events
window.addEventListener('online', () => {
  console.log('Back online, syncing queues...');
  syncQueues();
});
```

---

## REST API Usage

The queueing service exposes complete REST API endpoints for HTTP-based access.

### Authentication

All API endpoints require authentication. Choose one method:

```bash
# Method 1: X-API-Key header
curl -H "x-api-key: YOUR_KEY" https://api.example.com/services/queueing/api/...

# Method 2: Authorization Bearer
curl -H "Authorization: Bearer YOUR_KEY" https://api.example.com/services/queueing/api/...

# Method 3: Query parameter
curl "https://api.example.com/services/queueing/api/...?api_key=YOUR_KEY"
```

### Core Endpoints

#### Service Status (No Auth Required)

```bash
GET /services/queueing/api/status

# Response
{
  "success": true,
  "status": "operational",
  "provider": "redis",
  "instance": "default"
}
```

#### ENQUEUE - Add Item to Queue

```bash
POST /services/queueing/api/enqueue/{queueName}
Content-Type: application/json

{
  "task": {
    "userId": 123,
    "action": "send-email",
    "priority": "high"
  }
}

# Response
{
  "success": true,
  "message": "Item enqueued successfully",
  "queueName": "tasks",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Example with curl:

```bash
curl -X POST \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"task": {"id": 1, "type": "email"}}' \
  https://api.example.com/services/queueing/api/enqueue/tasks
```

#### DEQUEUE - Get Next Item

```bash
GET /services/queueing/api/dequeue/{queueName}

# Response
{
  "success": true,
  "data": {
    "userId": 123,
    "action": "send-email",
    "priority": "high"
  }
}

# Empty queue response
{
  "success": true,
  "data": null
}
```

Example with curl:

```bash
curl -H "x-api-key: your-key" \
  https://api.example.com/services/queueing/api/dequeue/tasks
```

#### SIZE - Get Queue Size

```bash
GET /services/queueing/api/size/{queueName}

# Response
{
  "success": true,
  "data": 42
}
```

#### LISTQUEUES - List All Queues

```bash
GET /services/queueing/api/queues

# Response
{
  "success": true,
  "data": ["tasks", "notifications", "reports", "jobs"]
}
```

#### PURGE - Clear Queue

```bash
DELETE /services/queueing/api/purge/{queueName}

# Response
{
  "success": true,
  "message": "Queue purged successfully",
  "queueName": "tasks"
}
```

#### ANALYTICS - Get Operation Stats

```bash
GET /services/queueing/api/analytics

# Response
{
  "success": true,
  "data": [
    {
      "queueName": "tasks",
      "operations": 156,
      "lastActivity": "2024-01-15T10:30:00Z"
    },
    {
      "queueName": "notifications",
      "operations": 42,
      "lastActivity": "2024-01-15T10:29:45Z"
    }
  ]
}
```

#### SETTINGS - Get/Save Configuration

```bash
# Get settings
GET /services/queueing/api/settings

# Response
{
  "success": true,
  "data": {
    "description": "Queue settings",
    "visibilityTimeout": 30,
    "messageRetentionPeriod": 345600
  }
}

# Save settings
POST /services/queueing/api/settings
Content-Type: application/json

{
  "visibilityTimeout": 60,
  "messageRetentionPeriod": 604800
}
```

---

## Provider Configuration

### Memory Provider (Default)

Best for: Development, testing, single-process applications

```javascript
const queue = ServiceRegistry.queue('memory');

// No configuration needed
// All data is lost on process restart
```

### Redis Provider

Best for: Production distributed systems

```javascript
const queue = ServiceRegistry.queue('redis', {
  host: 'localhost',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  instanceName: 'prod-queue'
});
```

Environment variables:
- `REDIS_HOST` - Redis server hostname
- `REDIS_PORT` - Redis server port
- `REDIS_PASSWORD` - Redis authentication password

### RabbitMQ Provider

Best for: Enterprise messaging with complex routing

```javascript
const queue = ServiceRegistry.queue('rabbitmq', {
  host: 'localhost',
  port: 5672,
  username: 'guest',
  password: 'guest',
  vhost: '/',
  instanceName: 'enterprise-queue'
});
```

### AWS SQS Provider

Best for: AWS-hosted applications

```javascript
const queue = ServiceRegistry.queue('aws', {
  region: 'us-east-1',
  accountId: '123456789012',
  queueNamePrefix: 'prod',
  visibilityTimeout: 30,
  messageRetentionPeriod: 345600
});
```

Environment variables:
- `AWS_REGION` - AWS region
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_ACCOUNT_ID` - AWS account ID

### Azure Queue Storage Provider

Best for: Azure-hosted applications

```javascript
const queue = ServiceRegistry.queue('azure', {
  accountName: 'mystorageaccount',
  queueNamePrefix: 'prod',
  visibilityTimeout: 30,
  messageTimeToLive: 604800
});
```

Environment variables:
- `AZURE_STORAGE_CONNECTION_STRING` - Azure storage connection string
- `AZURE_STORAGE_ACCOUNT_NAME` - Storage account name

### GCP Cloud Tasks Provider

Best for: Google Cloud Platform applications

```javascript
const queue = ServiceRegistry.queue('gcp', {
  projectId: 'my-gcp-project',
  region: 'us-central1',
  queue: 'default',
  maxRetries: 5,
  httpTarget: 'https://api.example.com/tasks'
});
```

Environment variables:
- `GOOGLE_CLOUD_PROJECT` - GCP project ID
- `GCP_REGION` - GCP region
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account JSON

---

## Advanced Features

### Event-Driven Monitoring

```javascript
const eventEmitter = ServiceRegistry.getEventEmitter();

// Monitor enqueue operations
eventEmitter.on('queue:enqueue:default', (data) => {
  console.log('Item enqueued:', data.queueName, data.item);
});

// Monitor dequeue operations
eventEmitter.on('queue:dequeue:default', (data) => {
  console.log('Item dequeued:', data.queueName, data.item);
});

// Monitor purge operations
eventEmitter.on('queue:purge:default', (data) => {
  console.log('Queue purged:', data.queueName);
});

// Monitor validation errors
eventEmitter.on('queue:validation-error:default', (data) => {
  console.log('Validation error in', data.method, ':', data.error);
});
```

### Multi-Instance Setup

```javascript
// Different instances for different workloads
const taskQueue = ServiceRegistry.queue('redis', {
  host: 'queue-host-1',
  instanceName: 'tasks'
});

const notificationQueue = ServiceRegistry.queue('redis', {
  host: 'queue-host-2',
  instanceName: 'notifications'
});

const reportQueue = ServiceRegistry.queue('aws', {
  region: 'us-west-2',
  instanceName: 'reports'
});
```

### Worker Pattern

```javascript
// Long-running worker for processing queue
async function startWorker(queueName, handler, options = {}) {
  const {
    batchSize = 1,
    interval = 1000,
    maxRetries = 3
  } = options;

  const queue = ServiceRegistry.queue('redis');
  let consecutiveEmpty = 0;

  while (true) {
    let processed = 0;

    for (let i = 0; i < batchSize; i++) {
      const item = await queue.dequeue(queueName);
      if (!item) break;

      try {
        await handler(item);
        processed++;
        consecutiveEmpty = 0;
      } catch (error) {
        // Retry logic
        console.error('Processing failed:', error);
        // Re-queue for retry
        await queue.enqueue(queueName, item);
      }
    }

    if (processed === 0) {
      consecutiveEmpty++;
      // Back off when queue is empty
      await new Promise(resolve =>
        setTimeout(resolve, interval * Math.min(consecutiveEmpty, 10))
      );
    }
  }
}

// Usage
startWorker('email-tasks', async (task) => {
  console.log('Sending email to:', task.email);
  await sendEmail(task);
}, { batchSize: 10, interval: 500 });
```

### Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(handler, options = {}) {
    this.handler = handler;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(item) {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }

    try {
      const result = await this.handler(item);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      setTimeout(() => {
        this.state = 'HALF_OPEN';
        this.failures = 0;
      }, this.resetTimeout);
    }
  }
}

// Usage
const breaker = new CircuitBreaker(async (task) => {
  return await processTask(task);
}, { failureThreshold: 3, resetTimeout: 30000 });

const queue = ServiceRegistry.queue('redis');
async function safeWorker() {
  let item;
  while ((item = await queue.dequeue('tasks')) !== undefined) {
    try {
      await breaker.execute(item);
    } catch (error) {
      console.error('Processing failed:', error);
      await queue.enqueue('tasks-failed', item);
    }
  }
}
```

---

## Examples

### Email Queue System

```javascript
// Enqueue email tasks
async function sendEmailLater(email, subject, body) {
  const queue = ServiceRegistry.queue('redis', { instanceName: 'emails' });

  await queue.enqueue('pending-emails', {
    to: email,
    subject: subject,
    body: body,
    createdAt: new Date().toISOString(),
    attempts: 0
  });

  console.log(`Email queued for ${email}`);
}

// Worker to process emails
async function emailWorker() {
  const queue = ServiceRegistry.queue('redis', { instanceName: 'emails' });

  while (true) {
    const emailTask = await queue.dequeue('pending-emails');

    if (!emailTask) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }

    try {
      emailTask.attempts++;

      // Send email using your email service
      await sendRealEmail(emailTask.to, emailTask.subject, emailTask.body);

      console.log(`Email sent to ${emailTask.to}`);
    } catch (error) {
      console.error(`Failed to send email to ${emailTask.to}:`, error);

      // Retry up to 3 times
      if (emailTask.attempts < 3) {
        await queue.enqueue('pending-emails', emailTask);
      } else {
        // Move to dead letter queue
        await queue.enqueue('failed-emails', emailTask);
      }
    }
  }
}

// Start worker
emailWorker();
```

### Batch Processing System

```javascript
// Enqueue batch jobs
async function enqueueBatchJob(dataItems) {
  const queue = ServiceRegistry.queue('redis');

  const batch = {
    id: generateBatchId(),
    items: dataItems,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  await queue.enqueue('batch-jobs', batch);
  console.log(`Batch ${batch.id} enqueued with ${dataItems.length} items`);
}

// Process batches
async function batchProcessor() {
  const queue = ServiceRegistry.queue('redis');

  while (true) {
    const batch = await queue.dequeue('batch-jobs');

    if (!batch) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      continue;
    }

    try {
      console.log(`Processing batch ${batch.id}...`);

      const results = await Promise.all(
        batch.items.map(item => processItem(item))
      );

      // Store or send results
      await storeBatchResults(batch.id, results);

      console.log(`Batch ${batch.id} completed`);
    } catch (error) {
      console.error(`Batch ${batch.id} failed:`, error);
      // Re-queue for retry
      await queue.enqueue('batch-jobs', batch);
    }
  }
}
```

### Real-Time Notifications

```javascript
// Client-side: Queue notifications locally
function queueNotification(message) {
  const queue = new nooblyjscorequeueing(); // Local queue

  queue.enqueue('notifications', {
    message: message,
    timestamp: new Date().toISOString(),
    read: false
  });

  return queue.size('notifications');
}

// Server-side: Sync to remote
async function syncNotificationsToServer() {
  const localQueue = new nooblyjscorequeueing();
  const serverQueue = new nooblyjscorequeueing('production');

  let notification;
  while ((notification = await localQueue.dequeue('notifications')) !== undefined) {
    try {
      await serverQueue.enqueue('notifications', notification);
    } catch (error) {
      // Re-queue locally if sync fails
      await localQueue.enqueue('notifications', notification);
      throw error;
    }
  }
}

// HTML integration
document.querySelector('#notify-btn').addEventListener('click', () => {
  const size = queueNotification('New notification!');
  console.log(`Notification queued (total: ${size})`);
});

// Auto-sync when online
window.addEventListener('online', syncNotificationsToServer);
```

---

## Best Practices

### 1. Always Check Queue Before Dequeue

```javascript
// ✓ Good: Check if queue has items
const hasItems = (await queue.size('tasks')) > 0;
if (hasItems) {
  const task = await queue.dequeue('tasks');
}

// ✓ Also good: Handle undefined gracefully
const task = await queue.dequeue('tasks');
if (task) {
  await processTask(task);
}
```

### 2. Use Prefixes for Queue Organization

```javascript
// Organize queues by type
await queue.enqueue('email:welcome', { ... });
await queue.enqueue('email:password-reset', { ... });
await queue.enqueue('sms:otp', { ... });
await queue.enqueue('notification:push', { ... });
```

### 3. Add Context to Queue Items

```javascript
// Include processing context
await queue.enqueue('tasks', {
  id: generateId(),
  type: 'process-video',
  data: { videoId: '123' },
  priority: 'high',
  createdAt: new Date().toISOString(),
  maxRetries: 3,
  timeout: 300000 // 5 minutes
});
```

### 4. Monitor Queue Health

```javascript
async function healthCheck() {
  const queue = ServiceRegistry.queue('redis');
  const queues = await queue.listQueues();

  const health = {};
  for (const queueName of queues) {
    const size = await queue.size(queueName);
    health[queueName] = {
      size: size,
      healthy: size < 1000 // Alert if > 1000
    };
  }

  return health;
}
```

### 5. Implement Proper Error Handling

```javascript
async function processWithErrorHandling(queue, queueName, handler) {
  try {
    const item = await queue.dequeue(queueName);
    if (!item) return;

    try {
      await handler(item);
    } catch (processingError) {
      // Log error
      console.error('Processing error:', processingError);

      // Retry or move to dead letter queue
      if (item.retries < 3) {
        item.retries = (item.retries || 0) + 1;
        await queue.enqueue(queueName, item);
      } else {
        await queue.enqueue(`${queueName}-dead-letter`, item);
      }
    }
  } catch (dequeueError) {
    console.error('Dequeue error:', dequeueError);
  }
}
```
