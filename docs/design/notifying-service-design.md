# Notifying Service (`src/notifying/`)

**Dependency level:** 1 – Infrastructure
**Dependencies:** `logging`
**Last Updated:** 2026-04-04

Provides topic-based publish/subscribe messaging. Services or external clients can subscribe to named topics and receive notifications when messages are published to those topics.

---

## Factory (`src/notifying/index.js`)

```javascript
const notifier = registry.notifying('memory');

// Multiple named instances
const highPriority = registry.notifying('memory', { instanceName: 'high' });
const normal = registry.notifying('memory', { instanceName: 'normal' });
```

### `createNotificationService(type, options, eventEmitter)` → notification instance

| `type` value | Provider class | Backend |
|---|---|---|
| `'memory'` / `'default'` (default) | `NotificationService` | In-process pub/sub |
| `'api'` | `NotifyingApi` | Remote notification API |

**After creating the provider:**
1. Initialises logger from `options.dependencies.logging`.
2. Creates `NotifyingAnalytics` with the instance name for per-instance stats.
3. Registers REST routes, dashboard view, and client-side scripts.
4. Exposes `getSettings` / `saveSettings`.

**Required Dependencies:**
- `logging` - Logging service instance (required)

---

## NotificationService Provider (`src/notifying/providers/notifying.js`)

### Constructor

```javascript
new NotificationService(options, eventEmitter)
```

- `this.topics` – `Map<string, Set<Function>>` mapping topic names to subscriber callback sets.
- `this.instanceName_` – from `options.instanceName`, default `'default'`.
- `this.logger` – extracted from `options.dependencies.logging`; uses optional chaining (`this.logger?.info(...)`) so operations continue silently when unavailable.
- `this.settings.maxSubscribers` – maximum subscribers per topic (default: 100). Enforced on `subscribe()`.
- `this.settings.messageTimeout` – message processing timeout in ms (default: 5000).
- `this.settings.enableQueuing` – queue messages flag (default: false).

### Methods

#### `async createTopic(topicName)` → `void`

Creates a new topic if it doesn't already exist. Initialises an empty `Set` of subscribers.

**Events emitted:** `notification:createTopic:{instanceName}`

#### `async subscribe(topicName, callback)` → `void`

Subscribes a callback (function or string) to a topic. Auto-creates the topic if it doesn't exist (via `await this.createTopic()`).

- `topicName` – string topic name.
- `callback` – Either:
  - **Function** (Node.js API): Function called with `(message)` when the topic is notified
  - **String** (REST API): Callback URL for webhook-style notifications

**Throws:** `Error` if the topic's subscriber count has reached `maxSubscribers`.

**Node.js Example (callback function):**
```javascript
await notifier.subscribe('user-events', (message) => {
  console.log('Received:', message);
});
```

**REST API Example (callback URL):**
```bash
curl -X POST http://localhost:11000/services/notifying/api/subscribe/topic/user-events \
  -H "Content-Type: application/json" \
  -d '{"callbackUrl": "https://example.com/webhooks/events"}'
```

**Events emitted:** `notification:subscribe:{instanceName}`

**Note:** When using callback URLs via REST API, the URL is stored as a string subscriber. The service does not automatically invoke webhooks on notify; callback URLs are intended for client-side consumption or webhook infrastructure outside this service.

#### `unsubscribe(topicName, callback)` → `boolean`

Removes a specific callback function from a topic's subscriber set.

- Returns `true` if the callback was found and removed.
- Returns `false` if the topic doesn't exist or the callback wasn't subscribed.

**Events emitted:** `notification:unsubscribe:{instanceName}` (only when a subscriber is actually removed)

#### `async notify(topicName, message)` → `void`

Publishes a message to all subscribers of a topic. 

- For **function callbacks**: Each callback is called with the message. Errors are caught and logged via `this.logger?.error()` without breaking the notification chain.
- For **string callbacks (URLs)**: URLs are not automatically invoked; they are available to client-side polling or external webhook infrastructure.

- `topicName` – string topic name.
- `message` – any value (object, string, number, etc.).

```javascript
await notifier.notify('user-events', {
  type: 'user_registered',
  userId: 'abc123',
  email: 'alice@example.com',
  timestamp: new Date().toISOString()
});
```

**Events emitted per successful callback:** `notification:notify:{instanceName}`
**Events emitted per failed callback:** `notification:notify:error:{instanceName}` with `{ topicName, message, error }`

**Note on Webhook URLs:** When callbacks are URLs (stored via REST API), they are not automatically invoked by the notify method. URL callbacks are intended for client-side discovery via REST API queries, allowing external systems to poll or implement their own webhook infrastructure.

#### `async getSettings()` → `Object`

Returns the settings object including `description`, `list` (metadata), `maxSubscribers`, `messageTimeout`, `enableQueuing`.

#### `async saveSettings(settings)` → `void`

Updates settings. Only keys present in `settings.list` are updated. Logs each change via `this.logger?.info()`.

---

## NotifyingApi Provider (`src/notifying/providers/notifyingApi.js`)

Delegates notification operations to a remote notification service via HTTP (axios). Suitable for distributed deployments where notification routing is handled centrally.

### Constructor

```javascript
new NotifyingApi(options, eventEmitter)
```

- `this.apiRoot` – from `options.apiRoot` or `options.api`, default `'http://localhost:3000'`.
- `this.logger` – extracted from `options.dependencies.logging`.
- `this.client` – axios instance configured with `baseURL`, `timeout`, and optional `X-API-Key` header.

### Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `url` | string | `'http://localhost:3000'` | Remote API base URL |
| `timeout` | number | `10000` | Request timeout in ms |
| `retryLimit` | number | `3` | Maximum retry attempts |

When `saveSettings()` updates `url` or `timeout`, the axios client is automatically rebuilt with the new values.

### Methods

| Method | Description |
|---|---|
| `send(notification)` | Core method — sends notification with `channel`, `recipient`, `subject`, `message`, `options` |
| `sendEmail(to, subject, message, options)` | Convenience wrapper for email channel |
| `sendSMS(to, message, options)` | Convenience wrapper for SMS channel |
| `sendPush(to, title, message, options)` | Convenience wrapper for push channel |
| `getHistory(query)` | Retrieves notification delivery history with optional filters |
| `getSettings()` | Returns current settings |
| `saveSettings(settings)` | Updates settings and rebuilds axios client if URL/timeout changed |

---

## Analytics (`src/notifying/modules/analytics.js`)

### `NotifyingAnalytics(eventEmitter, notifier, instanceName)`

Tracks per-topic statistics without mutating provider behaviour. Supports instance-specific analytics tracking.

**Initialisation:**
1. Seeds state from existing provider topics via `initializeFromProvider_()`.
2. Wraps the provider's `notify()` method to capture publish events once per call via `wrapNotifier_()`.
3. Registers instance-qualified event listeners for `createTopic`, `subscribe`, `unsubscribe`, `notify`.

**Per-topic stats tracked:**

| Field | Type | Description |
|---|---|---|
| `topic` | string | Topic name |
| `subscriberCount` | number | Current subscriber count (synced from provider) |
| `notificationCount` | number | Total notifications published |
| `lastNotificationAt` | number\|null | Timestamp of last notification |
| `lastNotificationIso` | string\|null | ISO string of last notification |
| `lastUpdated` | number | Last stats update timestamp |
| `createdAt` | number | Topic creation timestamp |

### Methods

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `getOverview()` | — | `{ topics, subscribers, notifications, lastNotificationAt, generatedAt }` | Aggregate statistics |
| `getTopTopics(limit)` | number (default: 10) | `Array<Object>` | Topics sorted by notification count |
| `getTopicDetails(limit)` | number (default: 100) | `Array<Object>` | Topics sorted by last notification time |
| `destroy()` | — | void | Removes all event listeners and clears stats to prevent memory leaks |

**Important:** Call `destroy()` when a notifying instance is no longer needed to prevent event listener memory leaks.

---

## Routes

Mounted at `/services/notifying/api/`. All routes support instance-specific variants at `/services/notifying/api/:instanceName/...`.

All successful mutation responses return JSON `{ success: true }`. All error responses return JSON `{ error: "message" }`.

| Method | Path | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/status` | Service status | — | `"notifying api running"` |
| `POST` | `/topic` | Create a topic | `{ topic }` | `{ success: true }` |
| `POST` | `/subscribe/topic/:topic` | Subscribe callback URL to topic | `{ callbackUrl }` | `{ success: true }` |
| `POST` | `/unsubscribe/topic/:topic` | Unsubscribe callback URL | `{ callbackUrl }` | `{ success: true }` |
| `POST` | `/notify/topic/:topic` | Publish message to topic | `{ message }` | `{ success: true }` |
| `GET` | `/settings` | Get settings | — | Settings object |
| `POST` | `/settings` | Update settings | Settings object | `{ success: true }` |
| `GET` | `/analytics/overview` | Aggregate analytics | — | Overview object |
| `GET` | `/analytics/top-topics` | Most active topics | `?limit=N` | `{ topics: [...] }` |
| `GET` | `/analytics/topics` | All topic details | `?limit=N` | `{ topics: [...] }` |
| `GET` | `/instances` | List all instances | — | `{ instances: [...] }` |
| `GET` | `/swagger/docs.json` | OpenAPI specification | — | Swagger JSON |

**Error responses:**
- `400` – Missing required parameters (e.g., `{ error: "Missing topic" }`)
- `500` – Server error (e.g., `{ error: "error message" }`)

---

## Client-Side Script (`src/notifying/scripts/js/index.js`)

Browser-loadable `digitaltechnologiesNotifying` class supporting both local (in-memory) and remote (HTTP API) pub/sub.

| Mode | Trigger | Backend |
|---|---|---|
| Local | No `instanceName` or `useLocal: true` | In-memory `LocalNotifyingService` singleton |
| Remote | `instanceName` provided | HTTP fetch to `/services/notifying/api/...` |

Remote mode uses polling (`setInterval`) to check for new notifications. Polling can be controlled via `setPollingEnabled(bool)` and `setPollingInterval(ms)`. Call `disconnect()` to clear all subscriptions and stop polling.

---

## Multi-Instance Usage

```javascript
// Create two notification channels
const alertsChannel = registry.notifying('memory', { instanceName: 'alerts' });
const auditChannel = registry.notifying('memory', { instanceName: 'audit' });

// Subscribe on alerts channel
await alertsChannel.subscribe('system-alerts', async (msg) => {
  await sendSlackMessage('#alerts', msg.text);
});

// Subscribe on audit channel
await auditChannel.subscribe('user-actions', async (msg) => {
  await writeAuditLog(msg);
});

// Publish to different channels
await alertsChannel.notify('system-alerts', {
  severity: 'critical',
  text: 'Database connection failed'
});

await auditChannel.notify('user-actions', {
  userId: '42',
  action: 'deleted_record',
  recordId: 'rec_789'
});
```

---

## Usage Pattern

```javascript
// Setup subscribers at application start
await notifier.subscribe('order-placed', async (order) => {
  await fulfillmentService.process(order);
});

await notifier.subscribe('order-placed', async (order) => {
  await emailService.sendConfirmation(order.customerEmail);
});

// Trigger from business logic
await notifier.notify('order-placed', {
  orderId: 'ord_12345',
  items: [...],
  customerEmail: 'customer@example.com',
  total: 149.99
});
// Both subscribers receive the notification
```
