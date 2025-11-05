# NooblyJS Core Notifying Service Usage Guide
 
## Table of Contents

1. [Overview](#overview)
2. [Supported Providers](#supported-providers)
3. [Server-Side Usage (Node.js)](#server-side-usage-nodejs)
4. [Client-Side Usage (Browser JavaScript)](#client-side-usage-browser-javascript)
5. [REST API Usage](#rest-api-usage)
6. [Provider Configuration](#provider-configuration)
7. [Script Library Usage](#script-library-usage)
8. [Advanced Features](#advanced-features)
9. [Examples](#examples)

---

## Overview

The **Notifying Service** is an enterprise-grade, multi-backend pub/sub messaging solution that provides:

- **Multiple storage backends**: Memory, Redis, File-based, and API providers
- **Dual-mode operation**: Server-side (Node.js) and client-side (Browser JavaScript)
- **Local-first client-side pub/sub**: In-memory topic management without server dependency
- **Remote server-based messaging**: Persistent pub/sub with multi-instance support
- **Flexible API**: Identical interface across all modes and providers
- **Auto-detection**: Intelligent mode selection based on configuration
- **Analytics & Monitoring**: Built-in metrics for topic and notification tracking
- **REST API**: Complete HTTP endpoints for remote operations
- **Client Library**: Lightweight JavaScript library for web applications

### Key Features

✓ Topic-based pub/sub messaging
✓ Multiple named instances for topic isolation
✓ Subscriber callback management
✓ Local in-memory service (zero network latency)
✓ Remote persistent service (distributed messaging)
✓ Event-driven architecture for monitoring
✓ Settings management per instance
✓ Analytics with notification counting
✓ Zero-config auto-detection for mode selection
✓ Webhook callback support for server subscriptions
✓ Seamless local/remote switching
✓ Comprehensive client-side JavaScript library

---

## Supported Providers

| Provider | Backend | Use Case | Data Persistence | Distributed |
|----------|---------|----------|------------------|-------------|
| **memory** | In-memory store | Development, testing, single-instance | ✗ Lost on restart | ✗ Single process |
| **redis** | Redis server | Production, distributed systems | ✓ Optional | ✓ Yes |
| **file** | File system | Persistent local messaging | ✓ Automatic | ✗ Single process |
| **api** | Remote API | Consume remote notifying instance | ✓ Depends on remote | ✓ Remote |

### Provider Selection Guide

- **memory**: Perfect for development and testing. No external dependencies.
- **redis**: Best for production environments with multiple processes/servers.
- **file**: Good for single-process deployments needing persistence.
- **api**: Use when connecting to a remote notifying service instance.

---

## Server-Side Usage (Node.js)

### Basic Setup

Initialize the notifying service through ServiceRegistry:

```javascript
const ServiceRegistry = require('noobly-core');
const EventEmitter = require('events');

// Initialize the service registry (required first)
const eventEmitter = new EventEmitter();
const app = require('express')();

ServiceRegistry.initialize(app, eventEmitter, {
  apiKeys: ['your-api-key'],
  requireApiKey: true
});

// Get a notifying instance (memory provider by default)
const notifying = ServiceRegistry.notifying('memory');

// Or with Redis provider for production
const notifying = ServiceRegistry.notifying('redis', {
  host: 'localhost',
  port: 6379,
  instanceName: 'production'
});
```

### Core Methods

#### CREATE TOPIC - Create a New Topic

```javascript
// Create a topic
await notifying.createTopic('user-events');

// Create multiple topics
await notifying.createTopic('order-notifications');
await notifying.createTopic('system-alerts');
```

#### SUBSCRIBE - Subscribe to a Topic

```javascript
// Subscribe with callback URL (webhook)
const subscription = await notifying.subscribe('user-events', {
  callbackUrl: 'https://example.com/webhooks/user-events'
});
// Returns: { subscriptionId: 'sub-123', topic: 'user-events', status: 'subscribed' }

// Unsubscribe from topic
await notifying.unsubscribe('user-events', subscription.subscriptionId);

// Subscribe multiple callbacks to same topic
await notifying.subscribe('user-events', {
  callbackUrl: 'https://service1.com/webhook'
});
await notifying.subscribe('user-events', {
  callbackUrl: 'https://service2.com/webhook'
});
```

#### NOTIFY - Publish a Notification

```javascript
// Publish a notification to all subscribers
await notifying.notify('user-events', {
  type: 'user-login',
  userId: '123',
  timestamp: new Date().toISOString()
});

// Publish complex objects
await notifying.notify('order-notifications', {
  type: 'order-placed',
  orderId: 'ORD-456',
  items: [
    { sku: 'ITEM1', quantity: 2 },
    { sku: 'ITEM2', quantity: 1 }
  ],
  total: 99.99
});
```

#### GET SUBSCRIBERS - Get Topic Subscribers

```javascript
// Get all subscribers for a topic
const subscribers = await notifying.getSubscribers('user-events');
// Returns array of subscriber objects with callbackUrls
```

#### GET TOPICS - Get All Topics

```javascript
// Get all topics
const topics = await notifying.getTopics();
// Returns: ['user-events', 'order-notifications', 'system-alerts']

// Get topics with details (memory provider)
const topicsWithDetails = await notifying.getTopics('user-events');
```

#### SAVE/GET SETTINGS

```javascript
// Save service settings
await notifying.saveSettings({
  retryPolicy: 'exponential',
  maxRetries: 3,
  timeout: 5000
});

// Get current settings
const settings = await notifying.getSettings();
```

#### ANALYTICS - Get Service Metrics

```javascript
// Get overall analytics
const analytics = await notifying.getAnalytics();
// Returns: { topics: 5, subscribers: 12, notificationsSent: 150, ... }

// Get specific topic analytics
const topicAnalytics = await notifying.getAnalytics('user-events');
// Returns: { topic: 'user-events', subscribers: 3, notificationsSent: 50, ... }
```

---

## Client-Side Usage (Browser JavaScript)

### Installation

Include the script in your HTML file:

```html
<script src="/services/notifying/scripts"></script>
```

### Dual-Mode Auto-Detection

The client library automatically detects mode based on `instanceName`:

```javascript
// LOCAL SERVICE (no instanceName) - in-memory, no server dependency
const localNotifying = new nooblyjsNotifying();

// REMOTE SERVICE (with instanceName) - connects to server
const remoteNotifying = new nooblyjsNotifying({ instanceName: 'production' });

// Force local mode
const forcedLocal = new nooblyjsNotifying({ useLocal: true });
```

### Local Client-Side Pub/Sub (No Server)

Create local topics and subscribe with direct callbacks:

```javascript
// Create local notifying instance
const notifying = new nooblyjsNotifying();

// Create a topic
await notifying.createTopic('user-actions');

// Subscribe to topic with callback
await notifying.subscribe('user-actions', (message) => {
  console.log('User action received:', message);
  // Callback fires immediately when message is published
});

// Publish notification (calls all subscribers synchronously)
await notifying.notify('user-actions', {
  action: 'button-clicked',
  timestamp: new Date()
});

// Get all local topics
const topics = await notifying.getTopics();
console.log('Topics:', topics); // ['user-actions']

// Get active subscriptions
const subs = notifying.getSubscriptions();
console.log('Subscriptions:', subs);

// Unsubscribe from topic
await notifying.unsubscribe('user-actions', subscriptionId);

// Disconnect and clean up
notifying.disconnect();
```

**Use Local Service When:**
- ✅ You need instant, in-memory event communication
- ✅ Building component communication patterns
- ✅ You don't need persistence across page reloads
- ✅ You want zero network latency
- ✅ Single-page application (SPA) internal messaging

### Remote Server-Based Pub/Sub

Connect to server and use polling-based message delivery:

```javascript
// Create remote notifying instance
const notifying = new nooblyjsNotifying({ instanceName: 'production' });

// Create a server-side topic
await notifying.createTopic('server-events');

// Subscribe with callback (uses polling by default)
const subscription = await notifying.subscribe('server-events', (message) => {
  console.log('Server message:', message);
});

// Publish notification to server
await notifying.notify('server-events', {
  type: 'user-login',
  userId: '123'
});

// Control polling behavior
notifying.setPollingEnabled(true);  // Enable/disable polling
notifying.setPollingInterval(5000); // Poll every 5 seconds

// Get available instances
const { instances } = await notifying.getInstances();
console.log('Instances:', instances); // ['default', 'production', 'staging']

// Get Swagger API specification
const swaggerSpec = await notifying.getSwaggerSpec();
console.log('API Spec:', swaggerSpec);

// Get service status
const status = await notifying.getStatus();
console.log('Status:', status); // "notifying api running"

// Unsubscribe from topic
await notifying.unsubscribe('server-events', subscription.subscriptionId);

// Disconnect and stop polling
notifying.disconnect();
```

**Use Remote Service When:**
- ✅ You need distributed messaging across clients
- ✅ You want persistent message storage
- ✅ You need multi-instance support
- ✅ You require cross-page or cross-browser communication
- ✅ You need to survive page reloads

### Check Service Mode

```javascript
// Check if instance is local or remote
const localNotifying = new nooblyjsNotifying();
if (localNotifying.isLocalService()) {
  console.log('Using local in-memory service');
}

const remoteNotifying = new nooblyjsNotifying({ instanceName: 'api' });
if (!remoteNotifying.isLocalService()) {
  console.log('Using remote server-based service');
}
```

---

## REST API Usage

All notifying endpoints are available via REST API at `/services/notifying/api/`.

### Authentication

Include API key via one of these methods:

```bash
# Method 1: x-api-key header
curl -H "x-api-key: YOUR_API_KEY" http://localhost:3001/services/notifying/api/status

# Method 2: Authorization header
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:3001/services/notifying/api/status

# Method 3: Query parameter
curl http://localhost:3001/services/notifying/api/status?api_key=YOUR_API_KEY

# Method 4: api-key header
curl -H "api-key: YOUR_API_KEY" http://localhost:3001/services/notifying/api/status

# Method 5: ApiKey Authorization
curl -H "Authorization: ApiKey YOUR_API_KEY" http://localhost:3001/services/notifying/api/status
```

### Create Topic

```bash
POST /services/notifying/api/topic
Content-Type: application/json

{
  "topic": "user-notifications"
}
```

### Subscribe to Topic

```bash
POST /services/notifying/api/subscribe/topic/{topic}
Content-Type: application/json

{
  "callbackUrl": "https://example.com/webhooks/notifications"
}
```

### Unsubscribe from Topic

```bash
POST /services/notifying/api/unsubscribe/topic/{topic}
Content-Type: application/json

{
  "callbackUrl": "https://example.com/webhooks/notifications"
}
```

### Publish Notification

```bash
POST /services/notifying/api/notify/topic/{topic}
Content-Type: application/json

{
  "message": {
    "type": "notification",
    "userId": "user-123",
    "content": "You have a new message"
  }
}
```

### Get Service Status

```bash
GET /services/notifying/api/status
```

### Get Available Instances

```bash
GET /services/notifying/api/instances
```

### Get Analytics Overview

```bash
GET /services/notifying/api/analytics/overview
```

### Get Top Topics

```bash
GET /services/notifying/api/analytics/top-topics?limit=10
```

### Get Topic Details

```bash
GET /services/notifying/api/analytics/topics?limit=100
```

### Get Swagger Documentation

```bash
GET /services/notifying/api/swagger/docs.json
```

### Multi-Instance Support

Add instance name to URL path for instance-specific operations:

```bash
# Create topic in 'production' instance
POST /services/notifying/api/production/topic

# Subscribe in 'staging' instance
POST /services/notifying/api/staging/subscribe/topic/{topic}

# Publish in 'default' instance
POST /services/notifying/api/default/notify/topic/{topic}

# Analytics for 'production' instance
GET /services/notifying/api/production/analytics/overview
```

---

## Provider Configuration

### Memory Provider

Best for development and testing:

```javascript
const ServiceRegistry = require('noobly-core');

// Initialize with memory provider (default)
const notifying = ServiceRegistry.notifying('memory', {
  instanceName: 'dev'
});
```

**Characteristics:**
- No external dependencies
- Fast in-memory storage
- Data lost on process restart
- Single-process only

### Redis Provider

Production-ready distributed messaging:

```javascript
const notifying = ServiceRegistry.notifying('redis', {
  host: 'localhost',
  port: 6379,
  password: 'your-password', // optional
  db: 0,
  instanceName: 'production'
});
```

**Characteristics:**
- Distributed across processes/servers
- Persistent (configurable TTL)
- High performance
- Requires Redis server

**Environment Variables:**
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=0
```

### File Provider

Persistent local storage:

```javascript
const notifying = ServiceRegistry.notifying('file', {
  dataDir: './.noobly-data/notifying',
  instanceName: 'persistent'
});
```

**Characteristics:**
- Data persists across restarts
- Single-process only
- File-based storage
- Suitable for small deployments

### API Provider

Connect to remote notifying instance:

```javascript
const notifying = ServiceRegistry.notifying('api', {
  baseUrl: 'https://api.example.com',
  apiKey: 'remote-api-key',
  headers: {
    'Authorization': 'Bearer TOKEN'
  },
  instanceName: 'remote'
});
```

**Characteristics:**
- Connects to remote server
- Proxies all operations through HTTP
- Depends on remote service availability
- Multi-instance capable

---

## Script Library Usage

### What is the Script Library?

The script library (`/services/notifying/scripts`) is a lightweight, standalone JavaScript library that provides pub/sub messaging capabilities in web browsers without requiring complex API integration.

### Installation

Include in your HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="/services/notifying/scripts"></script>
</head>
<body>
  <h1>My App</h1>
  <script>
    // Library is now available as nooblyjsNotifying
  </script>
</body>
</html>
```

### Library Features

The script library provides:

- **Local pub/sub**: In-memory messaging (no server)
- **Remote pub/sub**: Server-based distributed messaging
- **Auto-detection**: Switches automatically based on configuration
- **Polling support**: Background polling for server updates
- **Subscription management**: Track and manage subscriptions
- **Status monitoring**: Check service health
- **Error handling**: Comprehensive error messages

### Complete Example: Component Communication

```html
<!DOCTYPE html>
<html>
<head>
  <title>Local Pub/Sub Component Communication</title>
  <script src="/services/notifying/scripts"></script>
</head>
<body>
  <h1>Component Communication Example</h1>

  <section id="sender">
    <h2>Sender Component</h2>
    <button onclick="sendMessage()">Send Message</button>
  </section>

  <section id="receiver">
    <h2>Receiver Component</h2>
    <div id="messages"></div>
  </section>

  <script>
    // Create local notifying service
    const notifying = new nooblyjsNotifying();

    async function initialize() {
      // Create topic for component communication
      await notifying.createTopic('app-events');

      // Receiver component subscribes to events
      await notifying.subscribe('app-events', (message) => {
        console.log('Received:', message);

        // Display message
        const messagesDiv = document.getElementById('messages');
        const p = document.createElement('p');
        p.textContent = `${message.type}: ${message.data}`;
        messagesDiv.appendChild(p);
      });
    }

    // Sender component sends events
    async function sendMessage() {
      await notifying.notify('app-events', {
        type: 'button-click',
        data: 'User clicked the button',
        timestamp: new Date().toISOString()
      });
    }

    // Initialize on page load
    window.addEventListener('load', initialize);
  </script>
</body>
</html>
```

### Complete Example: Distributed Messaging

```html
<!DOCTYPE html>
<html>
<head>
  <title>Remote Pub/Sub Distributed Messaging</title>
  <script src="/services/notifying/scripts"></script>
</head>
<body>
  <h1>Distributed Messaging Example</h1>

  <div>
    <input type="text" id="messageInput" placeholder="Enter message">
    <button onclick="publishMessage()">Publish</button>
  </div>

  <div id="inbox"></div>

  <script>
    // Create remote notifying service
    const notifying = new nooblyjsNotifying({ instanceName: 'production' });

    async function initialize() {
      try {
        // Create server-side topic
        await notifying.createTopic('user-messages');

        // Subscribe to receive messages from other clients
        await notifying.subscribe('user-messages', (message) => {
          console.log('New message:', message);
          displayMessage(message);
        });

        // Set polling interval (default 5 seconds)
        notifying.setPollingInterval(3000); // Check every 3 seconds

        console.log('Connected to message bus');
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    }

    async function publishMessage() {
      const input = document.getElementById('messageInput');
      const text = input.value.trim();

      if (!text) return;

      try {
        await notifying.notify('user-messages', {
          text: text,
          sender: `User-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString()
        });
        input.value = '';
      } catch (error) {
        console.error('Failed to publish:', error);
      }
    }

    function displayMessage(message) {
      const inbox = document.getElementById('inbox');
      const div = document.createElement('div');
      div.style.cssText = 'border:1px solid #ccc; padding:10px; margin:5px 0;';
      div.innerHTML = `
        <strong>${message.sender}</strong>: ${message.text}
        <br><small>${new Date(message.timestamp).toLocaleTimeString()}</small>
      `;
      inbox.appendChild(div);
      inbox.scrollTop = inbox.scrollHeight;
    }

    // Initialize on page load
    window.addEventListener('load', initialize);

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      notifying.disconnect();
    });
  </script>
</body>
</html>
```

---

## Advanced Features

### Event Monitoring

Listen to service events:

```javascript
const EventEmitter = require('events');
const ServiceRegistry = require('noobly-core');

const eventEmitter = new EventEmitter();

ServiceRegistry.initialize(app, eventEmitter, {
  apiKeys: ['your-key']
});

// Listen to notification events
eventEmitter.on('notifying:notify', (data) => {
  console.log('Notification sent to:', data.topic);
  console.log('Message:', data.message);
  console.log('Subscribers notified:', data.subscriberCount);
});

// Listen to subscription events
eventEmitter.on('notifying:subscribe', (data) => {
  console.log('New subscriber on topic:', data.topic);
  console.log('Callback URL:', data.callbackUrl);
});

// Listen to topic creation
eventEmitter.on('notifying:topic:created', (data) => {
  console.log('Topic created:', data.topic);
});
```

### Webhook Callbacks

Server subscriptions use webhook callbacks to deliver messages:

```javascript
// Server-side subscription with webhook
const subscription = await notifying.subscribe('order-events', {
  callbackUrl: 'https://example.com/webhooks/orders'
});

// When a notification is published, this URL receives a POST:
// POST https://example.com/webhooks/orders
// Content-Type: application/json
// {
//   "topic": "order-events",
//   "message": {
//     "type": "order-placed",
//     "orderId": "ORD-123"
//   },
//   "timestamp": "2024-11-05T12:00:00Z"
// }
```

### Multiple Instances

Use multiple named instances for topic isolation:

```javascript
const ServiceRegistry = require('noobly-core');

// Production instance
const prodNotifying = ServiceRegistry.notifying('redis', {
  instanceName: 'production'
});

// Staging instance
const stagingNotifying = ServiceRegistry.notifying('redis', {
  instanceName: 'staging'
});

// Development instance
const devNotifying = ServiceRegistry.notifying('memory', {
  instanceName: 'development'
});

// Each instance manages topics independently
await prodNotifying.createTopic('prod-events');
await stagingNotifying.createTopic('staging-events');
await devNotifying.createTopic('dev-events');

// No cross-contamination between instances
```

### Retry Policies

Configure notification retry behavior:

```javascript
// Save settings with retry policy
await notifying.saveSettings({
  retryPolicy: 'exponential', // or 'linear', 'fixed'
  maxRetries: 5,
  retryInterval: 1000, // milliseconds
  timeout: 5000
});
```

### Polling Configuration

For client-side remote subscriptions:

```javascript
const notifying = new nooblyjsNotifying({ instanceName: 'api' });

// Enable polling with custom interval
notifying.setPollingEnabled(true);
notifying.setPollingInterval(10000); // Poll every 10 seconds

// Check polling status
if (notifying.pollingEnabled) {
  console.log('Polling is enabled, interval:', notifying.pollingInterval);
}

// Disable polling to reduce network usage
notifying.setPollingEnabled(false);
```

---

## Examples

### Example 1: Real-Time User Notifications

```javascript
// Server-side: Create topic and notify
const notifying = ServiceRegistry.notifying('redis', {
  instanceName: 'live'
});

await notifying.createTopic('user-notifications');

// Send notification when user logs in
app.post('/api/login', async (req, res) => {
  const { userId } = req.body;

  await notifying.notify('user-notifications', {
    type: 'user-login',
    userId: userId,
    message: `${userId} logged in`,
    timestamp: new Date()
  });

  res.json({ success: true });
});

// Client-side: Receive notifications
const notifying = new nooblyjsNotifying({ instanceName: 'live' });

await notifying.createTopic('user-notifications');
await notifying.subscribe('user-notifications', (notification) => {
  console.log(`${notification.userId} is online`);
  updateUserList();
});
```

### Example 2: Order Status Updates

```javascript
// Server publishes order updates
const orderTopic = 'order-updates';
await notifying.createTopic(orderTopic);

app.post('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // Update database...
  await updateOrderInDB(id, status);

  // Notify subscribers
  await notifying.notify(orderTopic, {
    orderId: id,
    status: status,
    updatedAt: new Date()
  });

  res.json({ success: true });
});

// External service webhook subscription
await notifying.subscribe(orderTopic, {
  callbackUrl: 'https://shipping-provider.com/webhook/order-updates'
});
```

### Example 3: Real-Time Chat

```javascript
// Create chat channel pub/sub
const chatTopic = 'chat:room-123';
const notifying = new nooblyjsNotifying();

await notifying.createTopic(chatTopic);

// Subscribe to chat messages
await notifying.subscribe(chatTopic, (message) => {
  addChatMessage(message.user, message.text, message.timestamp);
});

// Publish chat message
function sendChatMessage(text) {
  notifying.notify(chatTopic, {
    user: currentUser.name,
    text: text,
    timestamp: new Date().toISOString()
  });
}
```

### Example 4: System-Wide Events

```javascript
// Using local service for component communication
const events = new nooblyjsNotifying();

// Create system event topics
await events.createTopic('auth-events');
await events.createTopic('error-events');
await events.createTopic('config-events');

// Navigation component publishes route changes
function navigateTo(route) {
  events.notify('route-change', { route, timestamp: new Date() });
  window.location.hash = route;
}

// Multiple components subscribe to auth events
const authComponent = new nooblyjsNotifying();
await authComponent.subscribe('auth-events', (event) => {
  if (event.type === 'logout') {
    showLoginForm();
  }
});

const headerComponent = new nooblyjsNotifying();
await headerComponent.subscribe('auth-events', (event) => {
  if (event.type === 'login') {
    updateUserDisplay(event.user);
  }
});
```

---

## Best Practices

### 1. Choose the Right Mode

```javascript
// Local for single-page app internal communication
const local = new nooblyjsNotifying();

// Remote for multi-client distributed messaging
const remote = new nooblyjsNotifying({ instanceName: 'api' });
```

### 2. Handle Errors Properly

```javascript
try {
  await notifying.subscribe('events', (msg) => {
    // Handle message
  });
} catch (error) {
  console.error('Subscription failed:', error.message);
  // Implement retry logic or fallback
}
```

### 3. Clean Up Resources

```javascript
// When component unmounts or app closes
notifying.disconnect();
```

### 4. Use Meaningful Topic Names

```javascript
// Good: Descriptive, hierarchical naming
await notifying.createTopic('user:login');
await notifying.createTopic('order:created');
await notifying.createTopic('payment:failed');

// Avoid: Vague names
// await notifying.createTopic('event');
// await notifying.createTopic('notification');
```

### 5. Limit Polling Frequency

```javascript
// Don't poll too frequently (causes network overhead)
notifying.setPollingInterval(30000); // 30 seconds is reasonable

// Disable when not needed
notifying.setPollingEnabled(false);
```

### 6. Implement Message Validation

```javascript
await notifying.subscribe('events', (message) => {
  // Validate message structure
  if (!message.type || !message.data) {
    console.warn('Invalid message received:', message);
    return;
  }

  // Process valid message
  handleEvent(message);
});
```

---

## Troubleshooting

### Issue: Client Library Not Loading

**Solution:**
```bash
# Verify the endpoint is accessible
curl http://localhost:3001/services/notifying/scripts

# Check that notifying service is initialized
# Check application logs for errors
```

### Issue: Messages Not Being Received

**For Local Service:**
```javascript
// Ensure subscriber is registered before publishing
const notifying = new nooblyjsNotifying();
await notifying.createTopic('events');

// Subscribe first
let receivedCount = 0;
await notifying.subscribe('events', (msg) => {
  receivedCount++;
});

// Then publish
await notifying.notify('events', { data: 'test' });
console.log('Received:', receivedCount); // Should be 1
```

**For Remote Service:**
```javascript
// Check polling is enabled
notifying.setPollingEnabled(true);

// Check polling interval isn't too long
notifying.setPollingInterval(5000);

// Check network connectivity in browser DevTools
```

### Issue: High Memory Usage

**Solution:**
```javascript
// Disconnect unused instances
notifying.disconnect();

// Limit message queue size
await notifying.saveSettings({
  maxQueueSize: 100,
  pruneInterval: 60000
});

// Use remote service for persistent storage instead of local
```

### Issue: WebSocket or Polling Issues

**Solution:**
```javascript
// Check CORS headers
const notifying = new nooblyjsNotifying({
  baseUrl: 'http://localhost:3001',
  headers: {
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Verify API key is being sent
const notifying = new nooblyjsNotifying({
  headers: {
    'x-api-key': 'your-api-key'
  }
});
```

---

## Performance Considerations

### Local Service
- ✅ Instant message delivery (synchronous)
- ✅ No network overhead
- ✅ Ideal for high-frequency messaging
- ❌ Limited to single page/window
- ❌ No persistence across reloads

### Remote Service
- ✅ Multi-client communication
- ✅ Persistent across page reloads
- ✅ Distributed messaging
- ❌ Network latency
- ❌ Polling overhead

### Optimization Tips

1. **Use local service for internal component communication**
2. **Use remote service only when distributed messaging is needed**
3. **Adjust polling intervals based on message frequency**
4. **Disable polling when application is not active**
5. **Implement message batching for high-volume publishing**
6. **Use Redis provider for production distributed systems**

---

## API Reference

For complete API documentation, visit:

```
GET /services/notifying/api/swagger/docs.json
```

Or access the interactive Swagger UI:

```
GET /services/notifying/
```

---

## Support & Resources

- **Swagger Documentation**: `/services/notifying/api/swagger/docs.json`
- **Client Library Examples**: `/services/notifying/scripts/example.html`
- **Installation Guide**: See `INSTALLATION.md` in scripts folder
- **GitHub**: https://github.com/nooblyjs/nooblyjs-core
- **NPM**: https://www.npmjs.com/package/noobly-core
