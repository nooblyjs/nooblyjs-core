# NooblyJS Core Queueing Service - Concise Reference

## Overview

Enterprise FIFO queue service with 8 backends: memory, redis, rabbitmq, api, aws-sqs, azure, gcp-cloud-tasks, local-browser.

**Key Features**: Dual-mode (server/client), offline-first support, identical API across all providers, analytics, REST endpoints.

---

## Supported Providers

| Provider | Backend | Persistent | Distributed |
|----------|---------|-----------|------------|
| memory | In-memory | ✗ | ✗ |
| redis | Redis | ✓ | ✓ |
| rabbitmq | RabbitMQ | ✓ | ✓ |
| api | Remote API | ✓* | ✓ |
| aws | AWS SQS | ✓ | ✓ |
| azure | Azure Queue | ✓ | ✓ |
| gcp | Cloud Tasks | ✓ | ✓ |
| local | Browser Storage | ✓ | ✗ |

---

## Server-Side (Node.js)

### Setup
```javascript
const ServiceRegistry = require('noobly-core');
const app = require('express')();
const EventEmitter = require('events');

ServiceRegistry.initialize(app, new EventEmitter(), {
  apiKeys: ['your-key'],
  requireApiKey: true
});

const queue = ServiceRegistry.queue('redis', {
  host: 'localhost',
  port: 6379,
  instanceName: 'default'
});
```

### Core Methods

**Enqueue**: `await queue.enqueue('queueName', item)`
- Adds item (object or string) to FIFO queue

**Dequeue**: `const item = await queue.dequeue('queueName')`
- Returns next item or undefined if empty

**Size**: `const count = await queue.size('queueName')`
- Returns approximate queue length

**ListQueues**: `const names = await queue.listQueues()`
- Returns array of all queue names

**Purge**: `await queue.purge('queueName')`
- Removes all items from queue

**Settings**: `await queue.getSettings()` / `await queue.saveSettings(obj)`
- Get/set provider configuration

**Analytics**: `await queue.getAnalytics()`
- Returns operation counts per queue

### Examples

```javascript
// Basic workflow
await queue.enqueue('tasks', { userId: 123, action: 'email' });

let item;
while ((item = await queue.dequeue('tasks')) !== undefined) {
  console.log('Processing:', item);
}

// Monitor
const analytics = await queue.getAnalytics();
console.log(`Processed ${analytics[0].operations} operations`);

// Worker pattern
async function worker() {
  while (true) {
    const task = await queue.dequeue('tasks');
    if (!task) await new Promise(r => setTimeout(r, 1000));
    else await processTask(task);
  }
}
```

---

## Client-Side (Browser)

### Setup
```html
<script src="/services/queueing/scripts/client.js"></script>
<script>
  // Local queue (no server)
  const queue = new nooblyjscorequeueing();

  // Remote queue
  const remoteQueue = new nooblyjscorequeueing('default', {
    apiKey: 'your-key'
  });
</script>
```

### API (Same as Server)
```javascript
// Local queue
await queue.enqueue('tasks', { id: 1 });
const task = await queue.dequeue('tasks');
const size = await queue.size('tasks');
const names = await queue.listQueues();
await queue.purge('tasks');

// Sync to remote when online
window.addEventListener('online', async () => {
  let item;
  while ((item = await queue.dequeue('tasks')) !== undefined) {
    try {
      await remoteQueue.enqueue('tasks', item);
    } catch (e) {
      await queue.enqueue('tasks', item);
      break;
    }
  }
});
```

---

## REST API

### Authentication
```bash
# Headers
-H "x-api-key: YOUR_KEY"
-H "Authorization: Bearer YOUR_KEY"

# Query param
?api_key=YOUR_KEY
```

### Endpoints

**Status** (no auth)
```bash
GET /services/queueing/api/status
```

**Enqueue**
```bash
POST /services/queueing/api/enqueue/{queueName}
Content-Type: application/json
{ "task": {...} }
```

**Dequeue**
```bash
GET /services/queueing/api/dequeue/{queueName}
# Returns { success: true, data: {...} } or { success: true, data: null }
```

**Size**
```bash
GET /services/queueing/api/size/{queueName}
# Returns { success: true, data: 42 }
```

**List Queues**
```bash
GET /services/queueing/api/queues
# Returns { success: true, data: ["queue1", "queue2"] }
```

**Purge**
```bash
DELETE /services/queueing/api/purge/{queueName}
```

**Analytics**
```bash
GET /services/queueing/api/analytics
# Returns { success: true, data: [{queueName, operations, lastActivity}, ...] }
```

**Settings**
```bash
GET /services/queueing/api/settings
POST /services/queueing/api/settings
Content-Type: application/json
{ "setting": "value" }
```

---

## Provider Configuration

### Memory
```javascript
const queue = ServiceRegistry.queue('memory');
```

### Redis
```javascript
const queue = ServiceRegistry.queue('redis', {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0
});
```

### RabbitMQ
```javascript
const queue = ServiceRegistry.queue('rabbitmq', {
  host: 'localhost',
  port: 5672,
  username: 'guest',
  password: 'guest',
  vhost: '/'
});
```

### AWS SQS
```javascript
const queue = ServiceRegistry.queue('aws', {
  region: process.env.AWS_REGION || 'us-east-1',
  accountId: process.env.AWS_ACCOUNT_ID,
  queueNamePrefix: 'prod',
  visibilityTimeout: 30
});
// Env: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ACCOUNT_ID
```

### Azure Queue Storage
```javascript
const queue = ServiceRegistry.queue('azure', {
  accountName: 'myaccount',
  queueNamePrefix: 'prod',
  visibilityTimeout: 30
});
// Env: AZURE_STORAGE_CONNECTION_STRING
```

### GCP Cloud Tasks
```javascript
const queue = ServiceRegistry.queue('gcp', {
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  region: 'us-central1',
  httpTarget: 'https://api.example.com/tasks'
});
// Env: GOOGLE_CLOUD_PROJECT, GOOGLE_APPLICATION_CREDENTIALS
```

---

## Event Monitoring

```javascript
const emitter = ServiceRegistry.getEventEmitter();

emitter.on('queue:enqueue:default', ({queueName, item}) => {
  console.log(`Enqueued to ${queueName}:`, item);
});

emitter.on('queue:dequeue:default', ({queueName, item}) => {
  console.log(`Dequeued from ${queueName}:`, item);
});

emitter.on('queue:purge:default', ({queueName}) => {
  console.log(`Purged ${queueName}`);
});
```

---

## Advanced Patterns

### Worker with Retry
```javascript
async function worker(queueName, handler, maxRetries = 3) {
  while (true) {
    const item = await queue.dequeue(queueName);
    if (!item) {
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    item.retries = (item.retries || 0) + 1;
    try {
      await handler(item);
    } catch (err) {
      if (item.retries < maxRetries) {
        await queue.enqueue(queueName, item);
      } else {
        await queue.enqueue(`${queueName}-dlq`, item);
      }
    }
  }
}

worker('tasks', async (task) => {
  console.log('Processing:', task);
  // Your processing logic
});
```

### Circuit Breaker
```javascript
class CircuitBreaker {
  constructor(fn, { threshold = 5, timeout = 60000 } = {}) {
    this.fn = fn;
    this.failures = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.open = false;
  }

  async call(item) {
    if (this.open) throw new Error('Circuit open');
    try {
      const result = await this.fn(item);
      this.failures = 0;
      return result;
    } catch (err) {
      this.failures++;
      if (this.failures >= this.threshold) {
        this.open = true;
        setTimeout(() => { this.open = false; this.failures = 0; }, this.timeout);
      }
      throw err;
    }
  }
}

const breaker = new CircuitBreaker(async (task) => {
  return await externalService(task);
});
```

### Batch Processing
```javascript
async function batchProcessor(queueName, batchSize = 10) {
  const batch = [];
  let item;

  while ((item = await queue.dequeue(queueName)) !== undefined) {
    batch.push(item);
    if (batch.length >= batchSize) {
      await processBatch(batch);
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    await processBatch(batch);
  }
}

async function processBatch(items) {
  const results = await Promise.all(items.map(item => processItem(item)));
  console.log(`Processed ${items.length} items`);
}
```

### Offline-First Pattern
```javascript
async function syncWhenOnline(localQueue, remoteQueue, queueName) {
  window.addEventListener('online', async () => {
    let item;
    while ((item = await localQueue.dequeue(queueName)) !== undefined) {
      try {
        await remoteQueue.enqueue(queueName, item);
      } catch (err) {
        await localQueue.enqueue(queueName, item);
        console.log('Sync failed, retrying later');
        break;
      }
    }
  });
}
```

---

## Best Practices

1. **Check Before Dequeue**: `if (await queue.size(q) > 0) { item = await queue.dequeue(q); }`
2. **Handle Undefined**: Always check `if (item) { ... }` after dequeue
3. **Use Queue Naming**: Prefix queues by type: `email:welcome`, `email:reset`, `sms:otp`
4. **Include Metadata**: Add `id`, `createdAt`, `retries`, `timeout` to items
5. **Monitor Health**: Check sizes regularly, alert if > threshold
6. **Implement Retries**: Re-queue failed items with retry counter
7. **Dead Letter Queue**: Move permanently failed items to DLQ
8. **Log Operations**: Emit/track all significant operations
9. **Graceful Shutdown**: Finish current batch before terminating
10. **Error Context**: Include error details when re-queueing

---

## Quick Curl Examples

```bash
# Enqueue
curl -X POST \
  -H "x-api-key: key" \
  -H "Content-Type: application/json" \
  -d '{"task":{"id":1}}' \
  http://localhost:3001/services/queueing/api/enqueue/tasks

# Dequeue
curl -H "x-api-key: key" \
  http://localhost:3001/services/queueing/api/dequeue/tasks

# Size
curl -H "x-api-key: key" \
  http://localhost:3001/services/queueing/api/size/tasks

# List
curl -H "x-api-key: key" \
  http://localhost:3001/services/queueing/api/queues

# Analytics
curl -H "x-api-key: key" \
  http://localhost:3001/services/queueing/api/analytics

# Purge
curl -X DELETE \
  -H "x-api-key: key" \
  http://localhost:3001/services/queueing/api/purge/tasks
```

---

## Environment Variables Reference

**Redis**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

**RabbitMQ**: `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASS`

**AWS**: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ACCOUNT_ID`

**Azure**: `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_ACCOUNT_NAME`

**GCP**: `GOOGLE_CLOUD_PROJECT`, `GCP_PROJECT_ID`, `GCP_REGION`, `GOOGLE_APPLICATION_CREDENTIALS`

---

## Common Workflows

### Email Queue
```javascript
// Enqueue
await queue.enqueue('emails', {to, subject, body, retries: 0});

// Worker
async function emailWorker() {
  let email;
  while ((email = await queue.dequeue('emails')) !== undefined) {
    try {
      await sendEmail(email);
    } catch (err) {
      if (email.retries < 3) {
        email.retries++;
        await queue.enqueue('emails', email);
      }
    }
  }
}
emailWorker();
```

### Task Processing
```javascript
// Enqueue task
await queue.enqueue('jobs', {
  id: Date.now(),
  type: 'video-encode',
  videoId: 'vid-123',
  quality: '720p'
});

// Process
async function processJobs() {
  let job;
  while ((job = await queue.dequeue('jobs')) !== undefined) {
    console.log(`[${job.type}] Processing ${job.videoId}`);
    await encodeVideo(job.videoId, job.quality);
  }
}
```

### Real-time Notifications
```javascript
// Client enqueues locally
const queue = new nooblyjscorequeueing();
await queue.enqueue('notifications', {
  message: 'New message!',
  timestamp: new Date().toISOString()
});

// Syncs when online
window.addEventListener('online', async () => {
  const remoteQueue = new nooblyjscorequeueing('production');
  let notif;
  while ((notif = await queue.dequeue('notifications')) !== undefined) {
    await remoteQueue.enqueue('notifications', notif);
  }
});
```
