# Queueing Service (`src/queueing/`)

**Dependency level:** 1 – Infrastructure
**Dependencies:** `logging`

Provides a FIFO message queue used throughout the framework for task management, worker thread coordination, and asynchronous job processing.

---

## Factory (`src/queueing/index.js`)

```javascript
const queue = registry.queue('memory');
const redisQueue = registry.queue('redis', { host: 'redis.internal', port: 6379 });
```

### `createQueue(type, options, eventEmitter)` → queue instance

| `type` value | Provider class | Backend | Lazy-loaded |
|---|---|---|---|
| `'memory'` (default) | `Queueing` | JavaScript Map (in-process) | No |
| `'redis'` | `QueueingRedis` | Redis lists | No |
| `'rabbitmq'` | `QueueingRabbitMQ` | RabbitMQ / AMQP | No |
| `'api'` | `QueueingApi` | Remote HTTP queue API | No |
| `'aws'` | `QueueingAWS` | AWS SQS | Yes |
| `'azure'` | `QueueingAzure` | Azure Queue Storage | Yes |
| `'gcp'` | `QueueingGCP` | GCP Cloud Tasks | Yes |

**Cloud Provider Lazy-Loading:** AWS, Azure, and GCP providers are lazy-loaded on demand. The respective SDKs are only required when those providers are selected, preventing unnecessary dependencies.

**After creating the provider:**
1. Injects `logger` with `queue.log(level, message, meta)` helper.
2. Optionally injects `queue.cache` (caching service) and `queue.dataStore` (dataservice).
3. Creates `QueueAnalytics` instance at `queue.analytics`.
4. Registers REST routes and dashboard view.

---

## Memory Provider (`src/queueing/providers/queueing.js`)

The in-process queue implementation, used by default and by the working service for task lifecycle management.

### Core Methods

#### `async enqueue(queueName, data)` → `void`

Pushes `data` onto the named queue. Creates the queue automatically if it doesn't exist.

#### `async dequeue(queueName)` → `data | null`

Removes and returns the front item from the named queue. Returns `null` if empty.

#### `async size(queueName)` → `number`

Returns the current number of items in the named queue. Returns `0` for non-existent queues.

#### `async peek(queueName)` → `data | null`

Returns the front item without removing it.

#### `async clear(queueName)` → `void`

Empties the named queue.

#### `async listQueues()` → `string[]`

Returns all queue names currently in use.

---

## Named Queues Used Internally

The working service uses three reserved queue names:

| Queue Name | Purpose |
|---|---|
| `digital-technologies-core-working-incoming` | Tasks waiting to be picked up by a worker thread |
| `digital-technologies-core-working-complete` | Tasks that completed successfully |
| `digital-technologies-core-working-error` | Tasks that failed |

---

## Input Validation

All queue providers validate queue names before operations:

#### `validateQueueName_(queueName, method)` (private)

- Throws `Error` if queue name is not a non-empty string
- Emits `queue:validation-error:{instanceName}` event on validation failure
- Called automatically by `enqueue()`, `dequeue()`, `size()`, and `purge()` methods

---

## Redis Provider (`src/queueing/providers/queueingRedis.js`)

Uses Redis `RPUSH` / `LPOP` for FIFO ordering. Supports persistent queuing across process restarts.

**Key options:** 
- `host` – Redis hostname (default: `'127.0.0.1'`)
- `port` – Redis port (default: `6379`)
- `redisurl` – Alternative option name (also accepts `redisdurl` for backward compatibility)
- `redisport` – Alternative option name

**Settings Logging:** All setting changes are logged via the injected logging service with `this.logger?.info()`.

---

## RabbitMQ Provider (`src/queueing/providers/queueingRabbitMQ.js`)

Uses the `amqplib` package. Suitable for inter-service queuing in a microservice architecture.

**Key options:** 
- `rabbitmqUrl` – AMQP connection URL (default: `'amqp://localhost'`)

**Settings Logging:** All setting changes are logged via the injected logging service.

---

## API Provider (`src/queueing/providers/queueingApi.js`)

HTTP-based wrapper that proxies queue operations to a remote queueing service. Supports distributed queueing across services.

**Constructor Options:**
- `api` or `url` – Remote API base URL (default: `'http://localhost:3000'`)
- `apiKey` or `apikey` – API key for authentication (optional)
- `timeout` – Request timeout in milliseconds (default: `5000`)

**Methods:** Same interface as memory/Redis providers (`enqueue`, `dequeue`, `size`, `purge`, `listQueues`, `getSettings`, `saveSettings`)

**Event Emission:** All operations emit events via `eventEmitter_` including success and error events (e.g., `queue:enqueue:{instanceName}`, `queue:error:{instanceName}`)

---

## Cloud Providers

- **AWS SQS** (`queueingAWS.js`) – uses the AWS SDK v3 `@aws-sdk/client-sqs` (lazy-loaded)
- **Azure Queue Storage** (`queueingAzure.js`) – uses `@azure/storage-queue` (lazy-loaded)
- **GCP Cloud Tasks** (`queueingGCP.js`) – uses `@google-cloud/tasks` (lazy-loaded)

Each cloud provider has its own `listQueues()` method returning provider-specific queue metadata.

---

## Analytics (`src/queueing/modules/analytics.js`)

The `QueueAnalytics` class tracks:
- Total enqueue / dequeue counts
- Per-queue statistics
- Error rates
- Activity history

### Methods

#### `getStats()` → `Object`

Returns overall statistics with counts and percentages.

#### `getDistribution()` → `Object`

Returns label/data arrays for pie chart visualization.

#### `getTimeline(topN)` → `Object`

Returns timeline data for the top N queues with activity over time.

#### `getTopQueues(limit)` → `Array`

Returns top queues by activity.

#### `getQueueList(queueService, limit)` → `Promise<Array>`

Gets current queue list with sizes from the queue service.

#### `destroy()` → `void`

Removes all event listeners and clears analytics data. Should be called when the analytics module is no longer needed to prevent memory leaks in long-running applications.

**Event Listener Management:** Listeners are stored by name in `this.listeners_` for proper cleanup on `destroy()`.

---

## Routes

Mounted at `/services/queueing/api/`. All error responses return JSON format `{ error: "message" }`. Success responses return JSON `{ success: true }` or data object.

| Method | Path | Description | Response Format |
|---|---|---|---|
| `POST` | `/services/queueing/api/enqueue/:queueName` | Enqueue a message | JSON: `{ success: true }` |
| `GET` | `/services/queueing/api/dequeue/:queueName` | Dequeue a message | JSON: task object or null |
| `GET` | `/services/queueing/api/size/:queueName` | Size of named queue | JSON: number |
| `GET` | `/services/queueing/api/queues` | List all queues | JSON array |
| `DELETE` | `/services/queueing/api/purge/:queueName` | Clear a queue | JSON: `{ success: true }` |
| `GET` | `/services/queueing/api/status` | Service status | JSON: status object |
| `GET` | `/services/queueing/api/analytics` | Queue analytics | JSON: analytics data |
| `GET` | `/services/queueing/api/settings` | Get settings | JSON: settings object |
| `POST` | `/services/queueing/api/settings` | Update settings | JSON: `{ success: true }` |

### Instance-Specific Routes

All routes support instance names via path segment:
```
POST /services/queueing/api/:instanceName/enqueue/:queueName
GET  /services/queueing/api/:instanceName/dequeue/:queueName
GET  /services/queueing/api/:instanceName/size/:queueName
DELETE /services/queueing/api/:instanceName/purge/:queueName
GET /services/queueing/api/:instanceName/analytics
```

---

## Event Names

All queue events are qualified by instance name to support multiple queue instances:

| Event | Payload | Example |
|---|---|---|
| `queue:enqueue:{instanceName}` | `{ queueName, item }` | `queue:enqueue:default` |
| `queue:dequeue:{instanceName}` | `{ queueName, item }` | `queue:dequeue:default` |
| `queue:purge:{instanceName}` | `{ queueName }` | `queue:purge:default` |
| `queue:validation-error:{instanceName}` | `{ method, error, queueName }` | `queue:validation-error:default` |
| `queue:error:{instanceName}` | `{ operation, error }` | `queue:error:default` |

---

## Client-Side Script (`src/queueing/scripts/client.js`)

Browser-loadable script for interacting with the queue API from front-end code.

---

## Usage

```javascript
// Enqueue a task
await queue.enqueue('email-jobs', {
  to: 'user@example.com',
  subject: 'Welcome',
  body: 'Hello!'
});

// Dequeue and process
const job = await queue.dequeue('email-jobs');
if (job) {
  await sendEmail(job);
}

// Check queue depth
const depth = await queue.size('email-jobs');
console.log(`${depth} emails pending`);
```
