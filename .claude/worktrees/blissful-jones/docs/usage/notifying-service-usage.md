# Notifying Service - Comprehensive Usage Guide

**Status**: Production Ready ✓
**Version**: 1.0.15
**Last Updated**: 2026-04-04

## Table of Contents

1. [Service Overview](#service-overview)
2. [Service Initialization](#service-initialization)
3. [Service API (Node.js)](#service-api-nodejs)
4. [REST API Endpoints](#rest-api-endpoints)
5. [Client Library (Browser)](#client-library-browser)
6. [Scripts & Client-Side Integration](#scripts--client-side-integration)
7. [Analytics Module](#analytics-module)
8. [Advanced Usage Patterns](#advanced-usage-patterns)
9. [Real-World Recipes](#real-world-recipes)
10. [Troubleshooting & Best Practices](#troubleshooting--best-practices)

---

## Service Overview

The **Notifying Service** implements a **pub/sub (publish-subscribe) messaging pattern** for event-driven communication. It provides topic-based message broadcasting with support for multiple subscribers, analytics tracking, and both server-side and client-side operations.

### Key Features

- **Topic-Based Messaging**: Create topics and have multiple subscribers listen for messages
- **Pub/Sub Pattern**: Publish messages to any number of subscribers on a topic
- **Event Emission**: Emits lifecycle events for integration with analytics and monitoring
- **Analytics Integration**: Track topic activity, subscriber counts, and notification metrics
- **Multi-Instance Support**: Create named instances for different messaging channels
- **Client Library**: Browser-based pub/sub with local and remote modes
- **Settings Management**: Configure behavior with maxSubscribers, messageTimeout, enableQueuing
- **RESTful API**: HTTP endpoints for all pub/sub operations
- **Error Handling**: Graceful error handling with event-based error tracking

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Notifying Service                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Topics Map: {                                               │
│    "user-events": Set(callback1, callback2, ...),           │
│    "system-alerts": Set(callback3, callback4, ...),         │
│    ...                                                       │
│  }                                                           │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                   REST API Routes                             │
├─────────────────────────────────────────────────────────────┤
│ POST   /api/topic              - Create a topic             │
│ POST   /api/subscribe/...      - Subscribe callback         │
│ POST   /api/unsubscribe/...    - Unsubscribe callback       │
│ POST   /api/notify/topic/:t    - Publish message            │
│ GET    /api/status             - Service status             │
│ GET    /api/settings           - Get settings               │
│ POST   /api/settings           - Save settings              │
│ GET    /api/analytics/...      - Topic analytics            │
│ GET    /api/instances          - List instances             │
└─────────────────────────────────────────────────────────────┘
```

### Important: Node.js vs REST API Behavior

The Notifying Service can be used in two ways, each with different semantics:

| Usage | Subscribe Type | Notify Behavior | Use Case |
|-------|---|---|---|
| **Node.js API** | Callback **Function** | Functions are invoked **synchronously** | Server-side event handling with immediate execution |
| **REST API** | Callback **URL** (string) | URLs are **stored only**, not invoked | Client discovery, external webhook infrastructure |

**Key Distinction:**
- When you subscribe via **Node.js with a function**, that function executes immediately when `notify()` is called
- When you subscribe via **REST API with a URL**, the URL is stored for reference but NOT automatically invoked
- For webhook delivery to URL callbacks, implement your own function that makes HTTP requests and subscribe that via Node.js API

---

## Service Initialization

### Basic Initialization

```javascript
const createNotifyingService = require('./src/notifying');
const EventEmitter = require('events');

const eventEmitter = new EventEmitter();

// Create default notifying service instance
const notifying = createNotifyingService('default', {
  instanceName: 'default',
  dependencies: {
    logging: logger
  }
}, eventEmitter);
```

### Multiple Named Instances

```javascript
// Create high-priority notification instance
const highPriority = createNotifyingService('default', {
  instanceName: 'high-priority',
  maxSubscribers: 200,
  messageTimeout: 3000,
  enableQueuing: true,
  dependencies: { logging }
}, eventEmitter);

// Create normal-priority instance
const normalPriority = createNotifyingService('default', {
  instanceName: 'normal-priority',
  maxSubscribers: 500,
  messageTimeout: 5000,
  enableQueuing: false,
  dependencies: { logging }
}, eventEmitter);

// Create low-priority instance
const lowPriority = createNotifyingService('default', {
  instanceName: 'low-priority',
  maxSubscribers: 1000,
  messageTimeout: 10000,
  enableQueuing: false,
  dependencies: { logging }
}, eventEmitter);
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `instanceName` | string | 'default' | Unique identifier for this instance |
| `maxSubscribers` | number | 100 | Maximum allowed subscribers per topic |
| `messageTimeout` | number | 5000 | Message processing timeout in milliseconds |
| `enableQueuing` | boolean | false | Queue messages if true |
| `dependencies.logging` | object | required | Logging service instance |

---

## Service API (Node.js)

### Core Methods

#### `createTopic(topicName)`

Creates a new topic for pub/sub messaging.

```javascript
// Create a topic
await notifying.createTopic('user-events');
await notifying.createTopic('system-alerts');

// Create topics for different notification priorities
await notifying.createTopic('order-processing');
await notifying.createTopic('payment-notifications');
await notifying.createTopic('shipping-updates');
```

**Parameters:**
- `topicName` (string): The name of the topic to create

**Returns:** Promise<void>

**Events Emitted:**
- `notification:createTopic:{instanceName}` - Topic created

---

#### `subscribe(topicName, callback)`

Subscribes a callback function to receive messages from a topic.

```javascript
// Subscribe to user events
await notifying.subscribe('user-events', (message) => {
  console.log('User event received:', message);
  // Process the event
});

// Subscribe to system alerts with context
const alertHandler = (message) => {
  if (message.severity === 'critical') {
    console.error('CRITICAL ALERT:', message);
    // Handle critical alert
  } else {
    console.warn('Alert:', message);
  }
};

await notifying.subscribe('system-alerts', alertHandler);

// Multiple subscribers on same topic
await notifying.subscribe('order-processing', (msg) => {
  console.log('[Logger] Order event:', msg.orderId);
});

await notifying.subscribe('order-processing', (msg) => {
  console.log('[Analytics] Recording order:', msg.orderId);
  analytics.trackOrderEvent(msg);
});

await notifying.subscribe('order-processing', (msg) => {
  console.log('[DB] Saving order:', msg.orderId);
  database.saveOrder(msg);
});
```

**Parameters:**
- `topicName` (string): Topic to subscribe to
- `callback` (function): Function called when message is published. Receives (message) parameter

**Returns:** Promise<void>

**Throws:** `Error` if the topic's subscriber count has reached the `maxSubscribers` limit.

**Events Emitted:**
- `notification:subscribe:{instanceName}` - Subscriber added

---

#### `unsubscribe(topicName, callback)`

Unsubscribes a callback function from a topic.

```javascript
// Create handler
const handler = (message) => {
  console.log('Message:', message);
};

// Subscribe
await notifying.subscribe('events', handler);

// Later, unsubscribe
const unsubscribed = notifying.unsubscribe('events', handler);
console.log('Unsubscribed:', unsubscribed); // true or false

// Unsubscribe non-existent callback
const result = notifying.unsubscribe('events', () => {}); // false
```

**Parameters:**
- `topicName` (string): Topic to unsubscribe from
- `callback` (function): The callback function to remove

**Returns:** boolean - True if unsubscribed, false otherwise

**Events Emitted:**
- `notification:unsubscribe:{instanceName}` - Subscriber removed

---

#### `notify(topicName, message)`

Publishes a message to all subscribers of a topic.

```javascript
// Simple message
await notifying.notify('user-events', {
  userId: 123,
  action: 'login',
  timestamp: new Date()
});

// Complex message with nested data
await notifying.notify('order-processing', {
  orderId: 'ORD-2025-001',
  customerId: 456,
  items: [
    { sku: 'ITEM-001', quantity: 2, price: 29.99 },
    { sku: 'ITEM-002', quantity: 1, price: 49.99 }
  ],
  total: 109.97,
  status: 'pending',
  timestamp: new Date().toISOString()
});

// Broadcasting to multiple subscribers
await notifying.notify('system-alerts', {
  severity: 'critical',
  component: 'database',
  message: 'Connection pool exhausted',
  timestamp: Date.now()
});

// Notification with retry information
await notifying.notify('payment-notifications', {
  transactionId: 'TXN-789',
  status: 'failed',
  reason: 'Insufficient funds',
  retryCount: 0,
  maxRetries: 3,
  nextRetryAt: new Date(Date.now() + 60000) // 1 minute
});
```

**Parameters:**
- `topicName` (string): Topic to publish to
- `message` (any): Message data to broadcast to all subscribers

**Returns:** Promise<void>

**Events Emitted:**
- `notification:notify:{instanceName}` - Message published
- `notification:notify:error:{instanceName}` - Error in callback (if handler throws)

---

### Settings Management

#### `getSettings()`

Retrieves current service settings.

```javascript
const settings = await notifying.getSettings();
console.log(settings);

// Output:
// {
//   description: "Configuration settings for the notifying service",
//   list: [
//     { setting: 'maxSubscribers', type: 'number', values: null },
//     { setting: 'messageTimeout', type: 'number', values: null },
//     { setting: 'enableQueuing', type: 'boolean', values: null }
//   ],
//   maxSubscribers: 100,
//   messageTimeout: 5000,
//   enableQueuing: false
// }
```

**Returns:** Promise<Object> - Settings configuration object

**Settings Object Structure:**

```javascript
{
  description: string,           // Description of settings
  list: Array<{                  // Available settings metadata
    setting: string,             // Setting name
    type: string,                // Data type (number, boolean, string)
    values: null | Array         // Allowed values (null = any)
  }>,
  maxSubscribers: number,        // Max subscribers per topic
  messageTimeout: number,        // Timeout in milliseconds
  enableQueuing: boolean         // Queue messages flag
}
```

---

#### `saveSettings(settings)`

Updates service settings.

```javascript
// Update single setting
await notifying.saveSettings({ maxSubscribers: 200 });

// Update multiple settings
await notifying.saveSettings({
  maxSubscribers: 500,
  messageTimeout: 3000,
  enableQueuing: true
});

// Verify changes
const updated = await notifying.getSettings();
console.log('Max subscribers:', updated.maxSubscribers); // 500
console.log('Message timeout:', updated.messageTimeout); // 3000
console.log('Queuing enabled:', updated.enableQueuing);  // true
```

**Parameters:**
- `settings` (object): Settings to update (partial update supported)

**Returns:** Promise<void>

**Supported Settings:**
- `maxSubscribers`: Maximum subscribers per topic (number)
- `messageTimeout`: Message processing timeout in ms (number)
- `enableQueuing`: Enable message queuing (boolean)

---

## REST API Endpoints

### Topic Management

#### `POST /services/notifying/api/topic`

Create a new notification topic.

```bash
curl -X POST http://localhost:3001/services/notifying/api/topic \
  -H "Content-Type: application/json" \
  -d '{"topic": "user-events"}'

# Response: 200 OK
# { "success": true }
```

**Request Body:**
```json
{
  "topic": "user-events"
}
```

**Response:**
- Status: 200 - `{ "success": true }` - Topic created successfully
- Status: 400 - `{ "error": "Missing topic" }` - Missing topic parameter
- Status: 500 - `{ "error": "message" }` - Server error

---

#### `POST /services/notifying/api/:instanceName/topic`

Create a topic in a named instance.

```bash
curl -X POST http://localhost:3001/services/notifying/api/high-priority/topic \
  -H "Content-Type: application/json" \
  -d '{"topic": "critical-alerts"}'
```

---

### Subscription Management

#### `POST /services/notifying/api/subscribe/topic/:topic`

Subscribe a callback URL to a topic.

```bash
curl -X POST http://localhost:3001/services/notifying/api/subscribe/topic/user-events \
  -H "Content-Type: application/json" \
  -d '{"callbackUrl": "https://example.com/webhooks/user-events"}'

# Response: 200 OK
# { "success": true }
```

**Request Body:**
```json
{
  "callbackUrl": "https://example.com/webhooks/user-events"
}
```

**Important Notes:** 
- Callback URLs are stored as subscription identifiers for the topic
- The service does NOT automatically invoke webhooks when messages are published
- URL callbacks are intended for client-side polling/discovery via REST API or external webhook infrastructure
- For synchronous callback execution, use the Node.js API with callback functions

---

#### `POST /services/notifying/api/unsubscribe/topic/:topic`

Unsubscribe a callback URL from a topic.

```bash
curl -X POST http://localhost:3001/services/notifying/api/unsubscribe/topic/user-events \
  -H "Content-Type: application/json" \
  -d '{"callbackUrl": "https://example.com/webhooks/user-events"}'

# Response: 200 OK
# { "success": true }
```

---

### Publishing Messages

#### `POST /services/notifying/api/notify/topic/:topic`

Publish a message to a topic.

```bash
curl -X POST http://localhost:3001/services/notifying/api/notify/topic/user-events \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "userId": 123,
      "action": "login",
      "timestamp": "2025-11-23T10:30:00Z"
    }
  }'

# Response: 200 OK
# { "success": true }
```

**Request Body:**
```json
{
  "message": {
    "userId": 123,
    "action": "login",
    "timestamp": "2025-11-23T10:30:00Z"
  }
}
```

**Important:** Messages published via REST API will notify only function-based callbacks subscribed via Node.js API. String-based callback URLs stored via REST API are not automatically invoked by the notify method. For webhook delivery to URL callbacks, use the Node.js API to register function callbacks that make HTTP requests.

---

#### `POST /services/notifying/api/:instanceName/notify/topic/:topic`

Publish to a named instance.

```bash
curl -X POST http://localhost:3001/services/notifying/api/high-priority/notify/topic/critical-alerts \
  -H "Content-Type: application/json" \
  -d '{"message": {"severity": "critical", "alert": "Database down"}}'
```

---

### Service Status & Configuration

#### `GET /services/notifying/api/status`

Get service operational status.

```bash
curl http://localhost:3001/services/notifying/api/status

# Response: 200 OK
# "notifying api running"
```

**Response:** "notifying api running"

---

#### `GET /services/notifying/api/settings`

Retrieve current service settings.

```bash
curl http://localhost:3001/services/notifying/api/settings

# Response: 200 OK
# {
#   "description": "Configuration settings for the notifying service",
#   "list": [...],
#   "maxSubscribers": 100,
#   "messageTimeout": 5000,
#   "enableQueuing": false
# }
```

---

#### `POST /services/notifying/api/settings`

Update service settings.

```bash
curl -X POST http://localhost:3001/services/notifying/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "maxSubscribers": 200,
    "messageTimeout": 3000,
    "enableQueuing": true
  }'

# Response: 200 OK
# { "success": true }
```

---

### Analytics Endpoints

#### `GET /services/notifying/api/analytics/overview`

Get aggregate statistics about all topics.

```bash
curl http://localhost:3001/services/notifying/api/analytics/overview

# Response: 200 OK
# {
#   "topics": 3,
#   "subscribers": 8,
#   "notifications": 145,
#   "lastNotificationAt": "2025-11-23T10:45:30.123Z",
#   "generatedAt": "2025-11-23T10:46:00.000Z"
# }
```

**Response Structure:**
```json
{
  "topics": 3,
  "subscribers": 8,
  "notifications": 145,
  "lastNotificationAt": "2025-11-23T10:45:30.123Z",
  "generatedAt": "2025-11-23T10:46:00.000Z"
}
```

---

#### `GET /services/notifying/api/analytics/top-topics?limit=5`

Get the most active topics.

```bash
curl "http://localhost:3001/services/notifying/api/analytics/top-topics?limit=5"

# Response: 200 OK
# {
#   "topics": [
#     {
#       "topic": "user-events",
#       "subscriberCount": 5,
#       "notificationCount": 87,
#       "lastNotificationAt": "2025-11-23T10:45:30.123Z",
#       "createdAt": "2025-11-23T08:00:00.000Z"
#     },
#     ...
#   ]
# }
```

**Query Parameters:**
- `limit` (number): Maximum number of topics to return (default: 10)

---

#### `GET /services/notifying/api/analytics/topics?limit=20`

Get detailed information about all topics.

```bash
curl "http://localhost:3001/services/notifying/api/analytics/topics?limit=20"

# Response: Same structure as top-topics but with all topics
```

---

#### `GET /services/notifying/api/instances`

List all available notifying service instances.

```bash
curl http://localhost:3001/services/notifying/api/instances

# Response: 200 OK
# {
#   "instances": ["default", "high-priority", "normal-priority"]
# }
```

---

#### `GET /services/notifying/api/swagger/docs.json`

Get OpenAPI/Swagger specification.

```bash
curl http://localhost:3001/services/notifying/api/swagger/docs.json
```

---

## Client Library (Browser)

The Notifying Service includes a browser-based JavaScript client library that supports both **local client-side pub/sub** and **remote server-side integration**.

### Local Mode (Client-Side Only)

```html
<script src="/services/notifying/scripts"></script>
<script>
  // Create local notifying service (no server required)
  const notifying = new digitaltechnologiesNotifying();

  // Create topic
  await notifying.createTopic('user-events');

  // Subscribe to events
  await notifying.subscribe('user-events', (message) => {
    console.log('Received:', message);
    document.getElementById('events').innerHTML += `<div>${JSON.stringify(message)}</div>`;
  });

  // Publish event
  await notifying.notify('user-events', {
    userId: 123,
    action: 'button-clicked',
    timestamp: new Date()
  });
</script>
```

### Remote Mode (Server Integration)

```html
<script src="/services/notifying/scripts"></script>
<script>
  // Create remote notifying service
  const remoteNotifying = new digitaltechnologiesNotifying({
    instanceName: 'default',
    baseUrl: 'http://localhost:3001'
  });

  // Create topic on server
  await remoteNotifying.createTopic('real-time-updates');

  // Subscribe with polling
  await remoteNotifying.subscribe('real-time-updates', (message) => {
    console.log('Server update:', message);
    updateDashboard(message);
  }, {
    pollingInterval: 5000  // Poll every 5 seconds
  });

  // Publish to server
  await remoteNotifying.notify('real-time-updates', {
    data: 'value',
    timestamp: new Date()
  });
</script>
```

### Client API Methods

#### `createTopic(topic)`
```javascript
await notifying.createTopic('my-topic');
```

#### `subscribe(topic, callback, options)`
```javascript
const subscription = await notifying.subscribe('my-topic', (message) => {
  console.log('Message:', message);
}, {
  pollingInterval: 5000  // For remote mode
});

console.log(subscription);
// { subscriptionId: 'local_my-topic_1_1234567890', topic: 'my-topic', status: 'subscribed' }
```

#### `unsubscribe(topic, subscriptionId, options)`
```javascript
await notifying.unsubscribe('my-topic', subscriptionId);
```

#### `notify(topic, message)`
```javascript
await notifying.notify('my-topic', { data: 'value' });
```

#### `getStatus()`
```javascript
const status = await notifying.getStatus();
console.log(status);
// Local: "local notifying service running"
// Remote: "notifying api running"
```

#### `getSubscriptions()`
```javascript
const subs = notifying.getSubscriptions();
console.log(subs);
// Local: { 'topic1': ['sub_id_1', 'sub_id_2'] }
// Remote: { 'topic1': ['sub_id_1', 'sub_id_2'] }
```

#### `getTopics()` (Local only)
```javascript
const topics = await notifying.getTopics();
console.log(topics); // ['topic1', 'topic2', 'topic3']
```

#### `getInstances()` (Remote only)
```javascript
const instances = await remoteNotifying.getInstances();
console.log(instances.instances); // ['default', 'high-priority']
```

#### `setPollingInterval(ms)` (Remote only)
```javascript
remoteNotifying.setPollingInterval(10000); // Poll every 10 seconds
```

#### `setPollingEnabled(enabled)` (Remote only)
```javascript
remoteNotifying.setPollingEnabled(false); // Disable polling
```

#### `disconnect()`
```javascript
notifying.disconnect(); // Clear all subscriptions
```

---

## Scripts & Client-Side Integration

### Loading the Client Library

The notifying service provides automatic client library serving at `/services/notifying/scripts`:

```html
<!-- Method 1: Direct script tag -->
<script src="/services/notifying/scripts"></script>

<!-- Method 2: From scripts directory -->
<script src="/services/notifying/scripts/js/index.js"></script>

<!-- Method 3: In bundlers (webpack, vite, etc.) -->
<script>
  const digitaltechnologiesNotifying = require('/services/notifying/scripts');
</script>
```

### Integration Examples

#### Real-Time Dashboard

```html
<html>
<head>
  <title>Real-Time Dashboard</title>
  <script src="/services/notifying/scripts"></script>
</head>
<body>
  <h1>Real-Time Notifications</h1>
  <div id="notifications"></div>

  <script>
    const notifying = new digitaltechnologiesNotifying({
      instanceName: 'default'
    });

    (async () => {
      await notifying.createTopic('system-updates');

      await notifying.subscribe('system-updates', (message) => {
        const div = document.createElement('div');
        div.innerHTML = `
          <p>
            <strong>${message.type}</strong>: ${message.text}
            <small>${new Date(message.timestamp).toLocaleString()}</small>
          </p>
        `;
        document.getElementById('notifications').prepend(div);
      });
    })();
  </script>
</body>
</html>
```

#### Chat Application

```html
<script src="/services/notifying/scripts"></script>
<script>
  const chat = new digitaltechnologiesNotifying({
    instanceName: 'chat-room-1',
    baseUrl: window.location.origin
  });

  const chatRoom = 'chat-messages';
  let username = 'User123';

  (async () => {
    await chat.createTopic(chatRoom);

    // Display incoming messages
    await chat.subscribe(chatRoom, (message) => {
      console.log(`${message.from}: ${message.text}`);
      appendMessageToUI(message);
    });

    // Send message
    document.getElementById('send-btn').onclick = async () => {
      const text = document.getElementById('message-input').value;
      await chat.notify(chatRoom, {
        from: username,
        text: text,
        timestamp: new Date()
      });
      document.getElementById('message-input').value = '';
    };
  })();
</script>
```

---

## Analytics Module

The Analytics Module tracks topic activity without modifying provider behavior.

### Analytics Methods

#### `getOverview()`

Returns aggregate statistics for all topics.

```javascript
const overview = await notifying.analytics.getOverview();
console.log(overview);

// {
//   topics: 5,
//   subscribers: 23,
//   notifications: 1247,
//   lastNotificationAt: "2025-11-23T10:45:30.123Z",
//   generatedAt: "2025-11-23T10:46:00.000Z"
// }
```

**Returns:** Object with aggregate metrics

---

#### `getTopTopics(limit)`

Returns the most active topics.

```javascript
const top = await notifying.analytics.getTopTopics(10);
console.log(top);

// [
//   {
//     topic: "user-events",
//     subscriberCount: 5,
//     notificationCount: 456,
//     lastNotificationAt: "2025-11-23T10:45:00.000Z",
//     createdAt: "2025-11-23T08:00:00.000Z"
//   },
//   ...
// ]
```

**Parameters:**
- `limit` (number, optional): Maximum topics to return (default: 10)

**Returns:** Array of topic statistics sorted by notification count

---

#### `getTopicDetails(limit)`

Returns all topics sorted by last activity.

```javascript
const details = await notifying.analytics.getTopicDetails(20);

// Same structure as getTopTopics but includes all topics
// Sorted by lastNotificationAt (most recent first)
```

**Parameters:**
- `limit` (number, optional): Maximum topics to return (default: 100)

**Returns:** Array of topic statistics sorted by last notification time

---

#### `destroy()`

Removes all event listeners and clears analytics stats. Call this when a notifying instance is no longer needed to prevent memory leaks.

```javascript
// When shutting down or removing an instance
analytics.destroy();
```

---

### Event-Driven Analytics

Analytics automatically tracks events:

```javascript
const eventEmitter = new EventEmitter();

// Listen for topic creation
eventEmitter.on('notification:createTopic:default', (data) => {
  console.log('Topic created:', data.topicName);
});

// Listen for subscriptions
eventEmitter.on('notification:subscribe:default', (data) => {
  console.log('New subscriber for:', data.topicName);
});

// Listen for notifications
eventEmitter.on('notification:notify:default', (data) => {
  console.log('Message published to:', data.topicName);
});

// Listen for errors
eventEmitter.on('notification:notify:error:default', (data) => {
  console.error('Notification error:', data.error);
});
```

---

## Advanced Usage Patterns

### Pattern 1: Fan-Out Broadcasting

Send one message to multiple systems.

```javascript
// Setup
await notifying.createTopic('order-placed');

// Subscribe multiple handlers
await notifying.subscribe('order-placed', async (order) => {
  // Handler 1: Log the event
  console.log('Order placed:', order.orderId);
  await logger.info('Order', { orderId: order.orderId });
});

await notifying.subscribe('order-placed', async (order) => {
  // Handler 2: Update analytics
  await analytics.recordOrderPlaced(order);
});

await notifying.subscribe('order-placed', async (order) => {
  // Handler 3: Send confirmation email
  await emailService.sendOrderConfirmation(order);
});

await notifying.subscribe('order-placed', async (order) => {
  // Handler 4: Trigger fulfillment
  await fulfillmentService.process(order);
});

// Trigger event - all handlers receive the message
await notifying.notify('order-placed', {
  orderId: 'ORD-123',
  customerId: 456,
  items: [...],
  total: 99.99
});
```

---

### Pattern 2: Conditional Message Distribution

Notify only relevant subscribers.

```javascript
// Single topic, multiple handlers with filtering
await notifying.subscribe('user-activity', (activity) => {
  if (activity.type === 'purchase') {
    // Only purchase-related handler runs
    processPurchase(activity);
  }
});

await notifying.subscribe('user-activity', (activity) => {
  if (activity.type === 'review') {
    // Only review-related handler runs
    processReview(activity);
  }
});

// Publish various activity types
await notifying.notify('user-activity', {
  userId: 123,
  type: 'purchase',
  orderId: 'ORD-001'
});

await notifying.notify('user-activity', {
  userId: 123,
  type: 'review',
  productId: 'PROD-001',
  rating: 5
});
```

---

### Pattern 3: Priority-Based Processing

Use multiple instances for different priorities.

```javascript
// Create priority queues
const critical = createNotifyingService('default', {
  instanceName: 'critical',
  maxSubscribers: 50,
  messageTimeout: 1000,
  enableQueuing: true
});

const normal = createNotifyingService('default', {
  instanceName: 'normal',
  maxSubscribers: 200,
  messageTimeout: 5000,
  enableQueuing: false
});

// Create topics on each instance
await critical.createTopic('alerts');
await normal.createTopic('notifications');

// Subscribe and process based on priority
await critical.subscribe('alerts', (alert) => {
  console.log('CRITICAL:', alert);
  immediatelyHandleAlert(alert);
});

await normal.subscribe('notifications', (notification) => {
  console.log('Normal:', notification);
  queueNotificationForProcessing(notification);
});

// Route messages based on priority
if (message.priority === 'critical') {
  await critical.notify('alerts', message);
} else {
  await normal.notify('notifications', message);
}
```

---

### Pattern 4: Event Sourcing

Use notifying for event sourcing patterns.

```javascript
// Create event topics for domain entities
await notifying.createTopic('user-events');
await notifying.createTopic('order-events');
await notifying.createTopic('payment-events');

// Subscribe event handlers
await notifying.subscribe('user-events', (event) => {
  // Event store handler
  eventStore.append(event);
});

await notifying.subscribe('user-events', (event) => {
  // Projection/read model updater
  if (event.type === 'UserCreated') {
    projection.addUser(event);
  } else if (event.type === 'UserUpdated') {
    projection.updateUser(event);
  }
});

// Emit domain events
await notifying.notify('user-events', {
  type: 'UserCreated',
  userId: 123,
  email: 'user@example.com',
  timestamp: new Date()
});

await notifying.notify('order-events', {
  type: 'OrderPlaced',
  orderId: 'ORD-001',
  userId: 123,
  timestamp: new Date()
});
```

---

## Real-World Recipes

### Recipe 1: Real-Time Inventory Updates

```javascript
const notifying = createNotifyingService('default', {
  instanceName: 'inventory',
  enableQueuing: true
});

// Create topics
await notifying.createTopic('inventory-changes');
await notifying.createTopic('low-stock-alerts');

// Subscribe inventory dashboard
await notifying.subscribe('inventory-changes', (change) => {
  updateInventoryDashboard(change);
  logInventoryChange(change);
});

// Subscribe warehouse system
await notifying.subscribe('inventory-changes', (change) => {
  syncWithWarehouseSystem(change);
});

// Subscribe low stock monitor
await notifying.subscribe('low-stock-alerts', (alert) => {
  notifyWarehouseManager(alert.sku);
  createPurchaseOrder(alert.sku);
});

// When inventory changes
app.post('/api/inventory/:sku/reduce', async (req, res) => {
  const { quantity } = req.body;
  const remaining = await inventory.reduce(req.params.sku, quantity);

  // Notify all listeners
  await notifying.notify('inventory-changes', {
    sku: req.params.sku,
    change: -quantity,
    remaining: remaining,
    timestamp: new Date()
  });

  // Alert if low stock
  if (remaining < 10) {
    await notifying.notify('low-stock-alerts', {
      sku: req.params.sku,
      remaining: remaining,
      threshold: 10
    });
  }

  res.json({ remaining });
});
```

---

### Recipe 2: Payment Processing Pipeline

```javascript
const notifying = createNotifyingService('default', {
  instanceName: 'payments',
  enableQueuing: true
});

// Setup topics
await notifying.createTopic('payment-initiated');
await notifying.createTopic('payment-processing');
await notifying.createTopic('payment-completed');
await notifying.createTopic('payment-failed');

// Step 1: Validate payment
await notifying.subscribe('payment-initiated', async (payment) => {
  console.log('[Validator] Checking payment:', payment.id);

  if (isValidPayment(payment)) {
    await notifying.notify('payment-processing', payment);
  } else {
    await notifying.notify('payment-failed', {
      ...payment,
      reason: 'Validation failed'
    });
  }
});

// Step 2: Process with payment gateway
await notifying.subscribe('payment-processing', async (payment) => {
  console.log('[Processor] Processing:', payment.id);

  try {
    const result = await paymentGateway.charge(
      payment.amount,
      payment.cardToken
    );

    await notifying.notify('payment-completed', {
      ...payment,
      transactionId: result.id,
      timestamp: new Date()
    });
  } catch (error) {
    await notifying.notify('payment-failed', {
      ...payment,
      reason: error.message
    });
  }
});

// Step 3: Update order status
await notifying.subscribe('payment-completed', async (payment) => {
  console.log('[Order Update] Marking order paid:', payment.orderId);
  await orderService.markAsPaid(payment.orderId, payment.transactionId);
});

// Step 4: Send confirmation email
await notifying.subscribe('payment-completed', async (payment) => {
  console.log('[Email] Sending confirmation:', payment.orderId);
  await emailService.sendPaymentConfirmation(payment);
});

// Step 5: Log failures
await notifying.subscribe('payment-failed', async (payment) => {
  console.log('[Logger] Recording failure:', payment.id);
  await errorLogger.recordPaymentFailure(payment);
});
```

---

### Recipe 3: Multi-Tenant Notifications

```javascript
const notifying = createNotifyingService('default', {
  instanceName: 'multi-tenant'
});

// Create per-tenant instances
const tenantNotifying = {};

async function initializeTenant(tenantId) {
  const instance = createNotifyingService('default', {
    instanceName: `tenant-${tenantId}`
  });

  tenantNotifying[tenantId] = instance;

  // Create tenant-specific topics
  await instance.createTopic(`${tenantId}-alerts`);
  await instance.createTopic(`${tenantId}-events`);

  return instance;
}

// Route tenant notifications
app.post('/api/:tenantId/notify/:topic', async (req, res) => {
  const { tenantId, topic } = req.params;
  const { message } = req.body;

  // Get or create tenant instance
  if (!tenantNotifying[tenantId]) {
    await initializeTenant(tenantId);
  }

  const instance = tenantNotifying[tenantId];
  const fullTopic = `${tenantId}-${topic}`;

  await instance.notify(fullTopic, {
    ...message,
    tenantId: tenantId,
    timestamp: new Date()
  });

  res.json({ status: 'notified' });
});
```

---

## Troubleshooting & Best Practices

### Best Practice 1: Error Handling

```javascript
// Always wrap notify in error handling
eventEmitter.on('notification:notify:error:default', (data) => {
  console.error(`Error in ${data.topicName}:`, data.error);
  // Log to external service
  errorReporter.report({
    service: 'notifying',
    topic: data.topicName,
    error: data.error,
    message: data.message
  });
});
```

### Best Practice 2: Monitoring Subscribers

The service enforces `maxSubscribers` per topic automatically. When the limit is reached, `subscribe()` throws an error:

```javascript
// maxSubscribers is enforced — no manual tracking needed
const notifying = createNotifyingService('default', {
  maxSubscribers: 50  // Default is 100
});

try {
  await notifying.subscribe('my-topic', handler);
} catch (error) {
  // Error: Max subscribers (50) reached for topic: my-topic
  console.error('Subscription limit reached:', error.message);
}

// You can also update the limit at runtime
await notifying.saveSettings({ maxSubscribers: 200 });
```

### Best Practice 3: Topic Naming Conventions

```javascript
// Use hierarchical naming
await notifying.createTopic('orders.created');
await notifying.createTopic('orders.updated');
await notifying.createTopic('orders.cancelled');
await notifying.createTopic('payments.initiated');
await notifying.createTopic('payments.completed');

// Or use domain prefixes
await notifying.createTopic('domain:user:created');
await notifying.createTopic('domain:user:updated');
await notifying.createTopic('domain:order:created');
```

### Best Practice 4: Settings Configuration

```javascript
// Set appropriate limits based on workload
const highVolume = createNotifyingService('default', {
  instanceName: 'high-volume',
  maxSubscribers: 500,
  messageTimeout: 1000,
  enableQueuing: true
});

const lowVolume = createNotifyingService('default', {
  instanceName: 'low-volume',
  maxSubscribers: 50,
  messageTimeout: 10000,
  enableQueuing: false
});
```

### Common Issues

#### Issue: Callbacks Not Triggering

**Symptom:** `notify()` is called but callbacks don't execute

**Solution:**
```javascript
// Ensure topic exists before subscribing
await notifying.createTopic('my-topic');
await notifying.subscribe('my-topic', callback);

// Check for exceptions in callbacks
await notifying.subscribe('my-topic', (msg) => {
  try {
    processMessage(msg);
  } catch (error) {
    console.error('Callback error:', error);
    // Don't let callback exceptions break the chain
  }
});
```

#### Issue: Memory Leaks from Subscriptions

**Symptom:** Memory usage grows over time

**Solution:**
```javascript
// Store subscription references
const subscriptions = new Map();

const sub = await notifying.subscribe('topic', handler);
subscriptions.set('my-sub', { topic: 'topic', handler });

// Later, clean up
for (const [id, sub] of subscriptions) {
  notifying.unsubscribe(sub.topic, sub.handler);
}
subscriptions.clear();
```

#### Issue: High Latency Between Publish and Callback

**Symptom:** Notifications are slow to reach subscribers

**Solution:**
```javascript
// Use local notifying in browser instead of polling
const local = new digitaltechnologiesNotifying(); // No instanceName
await local.subscribe('topic', (msg) => {
  // Synchronous, immediate notification
});

// If using remote, increase polling interval only when safe
remoteNotifying.setPollingInterval(1000); // Poll frequently
```

#### Issue: REST API Subscribe Not Executing Webhooks

**Symptom:** I subscribed a callback URL via REST API but webhooks aren't being called when I notify

**Root Cause:** The REST API stores callback URLs for reference only. It does NOT automatically invoke webhooks. This is by design—callback URLs are intended for client-side discovery or external webhook infrastructure.

**Solution - Option A: Use Node.js API with HTTP Function**
```javascript
// Subscribe a function that makes HTTP requests
await notifying.subscribe('my-topic', async (message) => {
  // This function executes immediately when notify() is called
  const webhookUrl = 'https://example.com/webhook';
  try {
    await axios.post(webhookUrl, { message });
  } catch (error) {
    console.error('Webhook delivery failed:', error);
  }
});

// Now when you notify, the webhook is called
await notifying.notify('my-topic', { data: 'value' });
```

**Solution - Option B: REST API for Client-Side Discovery**
```bash
# Subscribe a URL via REST API (stores it for reference)
curl -X POST http://localhost:11000/services/notifying/api/subscribe/topic/events \
  -H "Content-Type: application/json" \
  -d '{"callbackUrl": "https://example.com/webhook"}'

# Query subscribed URLs (for client-side polling or webhook infrastructure)
curl http://localhost:11000/services/notifying/api/analytics/topics
```

**Key Point:** REST API callbacks are URL strings—use Node.js API with function callbacks for immediate execution.

---

## API Quick Reference

| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `createTopic(name)` | string | Promise<void> | Create a new topic |
| `subscribe(topic, cb)` | string, function | Promise<void> | Add subscriber to topic |
| `unsubscribe(topic, cb)` | string, function | boolean | Remove subscriber |
| `notify(topic, msg)` | string, any | Promise<void> | Broadcast message |
| `getSettings()` | none | Promise<Object> | Get configuration |
| `saveSettings(settings)` | object | Promise<void> | Update configuration |

---

## Conclusion

The Notifying Service provides a powerful, flexible pub/sub messaging system suitable for:
- Event broadcasting to multiple subscribers
- Real-time dashboard updates
- Multi-system integration
- Event sourcing architectures
- Tenant isolation patterns

For more information, refer to the REST API documentation or view the service in action at `/services/notifying/` when running the application.
