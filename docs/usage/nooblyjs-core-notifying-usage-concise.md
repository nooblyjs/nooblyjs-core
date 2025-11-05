# NooblyJS Notifying Service - Concise Reference
  
## Overview

Enterprise-grade pub/sub messaging with dual-mode support: local in-memory (no server) or remote distributed (server-based). Supports memory, Redis, file, and API providers.

**Key Features**: Topic-based messaging, multi-instance support, local/remote auto-detection, webhook callbacks, client-side library, analytics.

---

## Quick Start - Server-Side (Node.js)

```javascript
const ServiceRegistry = require('noobly-core');
const app = require('express')();
const EventEmitter = require('events');

ServiceRegistry.initialize(app, new EventEmitter(), {
  apiKeys: ['your-key']
});

// Memory provider (development)
const notifying = ServiceRegistry.notifying('memory');

// Redis provider (production)
const notifying = ServiceRegistry.notifying('redis', {
  host: 'localhost',
  port: 6379,
  instanceName: 'production'
});

// Core methods
await notifying.createTopic('user-events');
const subscription = await notifying.subscribe('user-events', {
  callbackUrl: 'https://example.com/webhook'
});
await notifying.notify('user-events', { type: 'login', userId: '123' });
await notifying.unsubscribe('user-events', subscription.subscriptionId);

// Utilities
const topics = await notifying.getTopics();
const subscribers = await notifying.getSubscribers('user-events');
const analytics = await notifying.getAnalytics();
await notifying.saveSettings({ retryPolicy: 'exponential', maxRetries: 3 });
const settings = await notifying.getSettings();
```

---

## Quick Start - Client-Side (Browser)

```html
<script src="/services/notifying/scripts"></script>

<script>
// LOCAL SERVICE (no instanceName) - in-memory, instant delivery
const local = new nooblyjsNotifying();

// REMOTE SERVICE (with instanceName) - server-based, persistent
const remote = new nooblyjsNotifying({ instanceName: 'production' });

// Create topic
await local.createTopic('events');

// Subscribe (local: direct callback, remote: polling)
const sub = await local.subscribe('events', (message) => {
  console.log('Received:', message);
});

// Publish
await local.notify('events', { type: 'test' });

// Get topics (local only)
const topics = await local.getTopics();

// Get subscriptions
const subs = local.getSubscriptions();

// Remote-specific
const status = await remote.getStatus();
const { instances } = await remote.getInstances();
const swagger = await remote.getSwaggerSpec();

// Polling control (remote only)
remote.setPollingInterval(5000);
remote.setPollingEnabled(true);

// Check mode
if (local.isLocalService()) console.log('Local mode');

// Cleanup
local.disconnect();
</script>
```

---

## Providers

| Provider | Backend | Use Case | Persistent | Distributed |
|----------|---------|----------|-----------|------------|
| **memory** | RAM | Dev/test | ✗ | ✗ |
| **redis** | Redis | Production | ✓ | ✓ |
| **file** | Filesystem | Local persistence | ✓ | ✗ |
| **api** | Remote HTTP | Consume remote | ✓ Remote | ✓ Remote |

---

## REST API Endpoints

```bash
# Authentication (pick one)
-H "x-api-key: KEY"
-H "Authorization: Bearer KEY"
-H "api-key: KEY"
?api_key=KEY

# Topic Management
POST /services/notifying/api/topic
  { "topic": "name" }

# Subscriptions
POST /services/notifying/api/subscribe/topic/{topic}
  { "callbackUrl": "https://..." }

POST /services/notifying/api/unsubscribe/topic/{topic}
  { "callbackUrl": "https://..." }

# Publishing
POST /services/notifying/api/notify/topic/{topic}
  { "message": { ...payload... } }

# Service
GET /services/notifying/api/status
GET /services/notifying/api/instances
GET /services/notifying/api/swagger/docs.json

# Analytics
GET /services/notifying/api/analytics/overview
GET /services/notifying/api/analytics/top-topics?limit=10
GET /services/notifying/api/analytics/topics?limit=100

# Multi-instance (prefix with instance name)
POST /services/notifying/api/{instanceName}/topic
POST /services/notifying/api/{instanceName}/notify/topic/{topic}
```

---

## Event Monitoring

```javascript
const eventEmitter = new EventEmitter();
ServiceRegistry.initialize(app, eventEmitter);

eventEmitter.on('notifying:notify', ({ topic, message, subscriberCount }) => {
  console.log(`Notified ${subscriberCount} subscribers on ${topic}`);
});

eventEmitter.on('notifying:subscribe', ({ topic, callbackUrl }) => {
  console.log(`New subscriber on ${topic}`);
});

eventEmitter.on('notifying:topic:created', ({ topic }) => {
  console.log(`Topic created: ${topic}`);
});
```

---

## Local vs Remote Decision

**Use Local (`new nooblyjsNotifying()`) when:**
- Single-page app component communication
- Zero network latency needed
- No persistence required
- Internal event bus

**Use Remote (`new nooblyjsNotifying({ instanceName: 'api' })`) when:**
- Multi-client distributed messaging
- Persistent message storage needed
- Cross-page/cross-window communication
- Survive page reloads
- Multi-instance support required

---

## Configuration Examples

### Memory Provider
```javascript
ServiceRegistry.notifying('memory', { instanceName: 'dev' })
```

### Redis Provider
```javascript
ServiceRegistry.notifying('redis', {
  host: 'localhost',
  port: 6379,
  password: 'optional',
  db: 0,
  instanceName: 'production'
})

// Env vars: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB
```

### File Provider
```javascript
ServiceRegistry.notifying('file', {
  dataDir: './.noobly-data/notifying',
  instanceName: 'persistent'
})
```

### API Provider
```javascript
ServiceRegistry.notifying('api', {
  baseUrl: 'https://api.example.com',
  apiKey: 'remote-key',
  headers: { 'Authorization': 'Bearer TOKEN' },
  instanceName: 'remote'
})
```

---

## Complete Examples

### Real-Time Component Communication (Local)
```javascript
const notifying = new nooblyjsNotifying();

// Initialization
await notifying.createTopic('app-events');

// Component A publishes
function handleUserAction() {
  notifying.notify('app-events', {
    action: 'button-clicked',
    component: 'header'
  });
}

// Component B listens
await notifying.subscribe('app-events', (event) => {
  if (event.action === 'button-clicked') {
    updateState();
  }
});

// Cleanup
window.addEventListener('beforeunload', () => notifying.disconnect());
```

### Distributed System (Remote)
```javascript
// Server: Send order updates
const notifying = ServiceRegistry.notifying('redis', {
  instanceName: 'live'
});

await notifying.createTopic('orders');

app.post('/api/orders/:id/status', async (req, res) => {
  const { status } = req.body;

  // Notify all connected clients
  await notifying.notify('orders', {
    orderId: req.params.id,
    status: status,
    updatedAt: new Date()
  });

  res.json({ success: true });
});

// Client: Subscribe to updates
const notifying = new nooblyjsNotifying({ instanceName: 'live' });
await notifying.createTopic('orders');
await notifying.subscribe('orders', (update) => {
  console.log(`Order ${update.orderId} is now ${update.status}`);
  refreshOrderDisplay();
});
```

### Webhook Integration
```javascript
// Server: Subscribe external service via webhook
const notifying = ServiceRegistry.notifying('redis');

await notifying.createTopic('payment-events');
await notifying.subscribe('payment-events', {
  callbackUrl: 'https://accounting-service.com/webhooks/payments'
});

// When notification is published, external service receives:
// POST https://accounting-service.com/webhooks/payments
// {
//   "topic": "payment-events",
//   "message": { "type": "payment-received", "amount": 100 },
//   "timestamp": "2024-11-05T12:00:00Z"
// }
```

---

## Multiple Instances

```javascript
// Create isolated instances
const prod = ServiceRegistry.notifying('redis', { instanceName: 'production' });
const staging = ServiceRegistry.notifying('redis', { instanceName: 'staging' });
const dev = ServiceRegistry.notifying('memory', { instanceName: 'dev' });

// Topics per instance don't conflict
await prod.createTopic('events');
await staging.createTopic('events');
await dev.createTopic('events');

// Access via REST with instance prefix
POST /services/notifying/api/production/topic
POST /services/notifying/api/staging/notify/topic/events
GET /services/notifying/api/dev/analytics/overview
```

---

## Advanced Configuration

### Retry Policy
```javascript
await notifying.saveSettings({
  retryPolicy: 'exponential', // linear, fixed, exponential
  maxRetries: 5,
  retryInterval: 1000,
  timeout: 5000
});
```

### Polling Settings (Client)
```javascript
notifying.setPollingEnabled(true);
notifying.setPollingInterval(10000); // 10 seconds
```

### Event Listeners
```javascript
const eventEmitter = ServiceRegistry.getEventEmitter();

eventEmitter.on('notifying:notify', (data) => {
  console.log(`${data.subscriberCount} subscribers notified`);
});
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Library not loading | Verify `/services/notifying/scripts` endpoint |
| Messages not received (local) | Ensure subscribe before publish |
| Messages not received (remote) | Enable polling: `setPollingEnabled(true)` |
| CORS errors | Add custom headers with API key |
| High memory | Call `disconnect()` on instances |
| Polling overhead | Increase interval: `setPollingInterval(30000)` |

---

## Best Practices

1. **Choose mode wisely**: Local for single-page, remote for distributed
2. **Name topics clearly**: `user:login`, `order:created`, not just `event`
3. **Validate messages**: Check type/data before processing
4. **Handle errors**: Wrap subscribe/notify in try-catch
5. **Clean up**: Call `disconnect()` when done
6. **Polling frequency**: 5-30 seconds typical, don't poll too fast
7. **Use Redis in production**: Memory provider loses data on restart
8. **Monitor events**: Hook into EventEmitter for observability

---

## API Reference Summary

### Core Methods (All Providers)
- `createTopic(name)` - Create topic
- `subscribe(topic, callback|options)` - Subscribe
- `unsubscribe(topic, subscriptionId)` - Unsubscribe
- `notify(topic, message)` - Publish
- `getTopics()` - List topics
- `getSubscribers(topic)` - Get subscribers
- `saveSettings(config)` - Update settings
- `getSettings()` - Get settings
- `getAnalytics([topic])` - Get metrics

### Client Library Methods (Browser)
- `createTopic(topic)` - Same as server
- `subscribe(topic, callback, options)` - Subscribe with callback
- `notify(topic, message)` - Publish message
- `unsubscribe(topic, subscriptionId)` - Unsubscribe
- `getTopics()` - Get local topics only
- `getSubscriptions()` - Get active subscriptions
- `isLocalService()` - Check if local mode
- `getStatus()` - Remote only: check service health
- `getInstances()` - Remote only: list instances
- `getSwaggerSpec()` - Remote only: get API docs
- `setPollingInterval(ms)` - Remote: adjust polling
- `setPollingEnabled(bool)` - Remote: enable/disable polling
- `disconnect()` - Clean up

---

## Performance Notes

- **Local**: Instant delivery, no network, single-page only
- **Remote**: Network latency, polling overhead, multi-client support
- **Redis**: Distributed, high-performance, requires server
- **Memory**: Fast, loses data on restart, single-process
- **File**: Persistent, slower, single-process

Choose based on requirements: speed vs persistence vs distribution.

---

## Resources

- Full documentation: `docs/usage/nooblyjs-core-notifying-usage.md`
- API spec: `/services/notifying/api/swagger/docs.json`
- Examples: `/services/notifying/scripts/example.html`
- GitHub: https://github.com/nooblyjs/nooblyjs-core
