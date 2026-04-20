# Caching Service - Comprehensive Usage Guide

**Document Version**: 1.0
**Last Updated**: 2025-11-22
**Service Version**: 1.0.14+

---

## Table of Contents

1. [Overview](#overview)
2. [Service Initialization](#service-initialization)
3. [Provider Options](#provider-options)
4. [Service API (Node.js)](#service-api-nodejs)
5. [REST API Endpoints](#rest-api-endpoints)
6. [Client Library (Browser)](#client-library-browser)
7. [Analytics Module](#analytics-module)
8. [Scripts & Testing](#scripts--testing)
9. [Advanced Usage](#advanced-usage)
10. [Troubleshooting](#troubleshooting)
11. [Examples & Recipes](#examples--recipes)

---

## Overview

The **Caching Service** provides high-performance data caching with multiple backend support. It abstracts away the complexity of different caching providers (Memory, Redis, Memcached, File, API) and provides a unified interface for cache operations.

### Key Features

- **Multi-provider support**: Choose from 5 different caching backends
- **Analytics tracking**: Monitor cache hits, misses, and access patterns
- **Event-driven**: Emits events for all cache operations
- **Named instances**: Run multiple independent cache instances
- **Client library**: Browser-friendly caching library
- **RESTful API**: Complete HTTP API for cache operations

### Performance Characteristics

| Provider | Latency | Use Case | Persistence |
|----------|---------|----------|-------------|
| Memory | <1ms | Development, single-instance | No |
| Redis | 1-5ms | Production, distributed | Yes |
| Memcached | 1-5ms | Session caching, distributed | No |
| File | 5-50ms | Persistent local caching | Yes |
| API | 50-500ms | Remote cache service | Varies |

---

## Service Initialization

### Basic Setup

```javascript
const EventEmitter = require('events');
const createCacheService = require('./src/caching');
const createLoggingService = require('./src/logging');

const eventEmitter = new EventEmitter();
const logger = createLoggingService('file', {
  dependencies: {}
}, eventEmitter);

// Create cache service with memory provider
const cache = createCacheService('memory', {
  dependencies: { logging: logger }
}, eventEmitter);
```

### With Express Integration

```javascript
const express = require('express');
const app = express();
const serviceRegistry = require('./index');

// Initialize cache service with routes and views
const cache = serviceRegistry.caching('memory', {
  instanceName: 'default',
  dependencies: { logging: serviceRegistry.logging('file') }
});

// Routes and views are automatically registered:
// - GET /services/caching/api/status
// - POST /services/caching/api/put/:key
// - GET /services/caching/api/get/:key
// - DELETE /services/caching/api/delete/:key
// - GET /services/caching/api/analytics
// - GET /services/caching/api/instances
```

---

## Provider Options

### Memory Provider

**Best for**: Development, single-instance deployments, testing

```javascript
const cache = createCacheService('memory', {
  instanceName: 'app-cache',
  maxSize: 1000,  // Maximum number of entries
  ttl: 3600000,   // Default TTL in milliseconds (1 hour)
  dependencies: { logging: logger }
}, eventEmitter);
```

**Configuration Options**:
- `instanceName` (string): Unique identifier for this cache instance
- `maxSize` (number): Maximum cache entries before LRU eviction
- `ttl` (number): Default time-to-live in milliseconds
- `dependencies.logging` (object): Logging service instance

**Memory Characteristics**:
- In-process storage (no network overhead)
- LRU eviction when maxSize exceeded
- Automatic analytics tracking
- No persistence (lost on restart)

### Redis Provider

**Best for**: Production, distributed deployments, high performance

```javascript
const cache = createCacheService('redis', {
  instanceName: 'session-cache',
  host: 'redis.example.com',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  ttl: 1800000,  // 30 minutes
  dependencies: { logging: logger }
}, eventEmitter);
```

**Configuration Options**:
- `host` (string): Redis server hostname/IP
- `port` (number): Redis port (default: 6379)
- `password` (string): Redis password if required
- `db` (number): Redis database number (0-15)
- `ttl` (number): Default key expiration in milliseconds
- `family` (number): IP version (4 or 6)
- `keepAlive` (boolean): Enable TCP keep-alive
- `maxRetriesPerRequest` (number): Retry attempts

**Advantages**:
- Distributed caching across multiple servers
- Persistent storage option
- Pub/sub support
- Atomic operations
- Key expiration support

### Memcached Provider

**Best for**: High-performance distributed caching, session storage

```javascript
const cache = createCacheService('memcached', {
  instanceName: 'session-store',
  servers: ['memcached1:11211', 'memcached2:11211'],
  ttl: 600000,  // 10 minutes
  dependencies: { logging: logger }
}, eventEmitter);
```

**Configuration Options**:
- `servers` (array): Array of memcached server addresses
- `ttl` (number): Default expiration time in milliseconds
- `retries` (number): Connection retry attempts
- `timeout` (number): Connection timeout

**Advantages**:
- Extremely fast distributed caching
- Simple API
- No persistence (pure cache)
- Good for session management

### File Provider

**Best for**: Persistent local caching, development, small datasets

```javascript
const cache = createCacheService('file', {
  instanceName: 'persistent-cache',
  directory: './.application/cache',
  ttl: 86400000,  // 24 hours
  dependencies: { logging: logger }
}, eventEmitter);
```

**Configuration Options**:
- `directory` (string): Directory path for cache files
- `ttl` (number): Default file expiration in milliseconds
- `syncInterval` (number): How often to check for expired files

**Advantages**:
- Persistent storage
- No external dependencies
- File-based, human-readable
- Good for simple deployments

### API Provider

**Best for**: Remote cache service integration, microservices

```javascript
const cache = createCacheService('api', {
  instanceName: 'remote-cache',
  baseUrl: 'https://cache-service.example.com',
  apiKey: process.env.CACHE_API_KEY,
  dependencies: { logging: logger }
}, eventEmitter);
```

**Configuration Options**:
- `baseUrl` (string): Remote cache service URL
- `apiKey` (string): API authentication key
- `timeout` (number): Request timeout in milliseconds
- `retries` (number): Failed request retry attempts

**Advantages**:
- Centralized cache management
- Multi-service sharing
- Offloads caching infrastructure
- Potentially better for large deployments

---

## Service API (Node.js)

### Core Methods

#### `put(key, value) → Promise<void>`

Stores a value in the cache under the specified key.

**Parameters**:
- `key` (string): Cache key (must be non-empty string)
- `value` (*): Value to store (can be any JSON-serializable object)

**Throws**: Error if key is invalid or value is undefined

**Example**:
```javascript
// Store simple value
await cache.put('user:123', { name: 'John', email: 'john@example.com' });

// Store array
await cache.put('tags:popular', ['nodejs', 'javascript', 'caching']);

// Store nested object
await cache.put('config:app', {
  theme: 'dark',
  language: 'en',
  notifications: true
});
```

**Events Emitted**:
- `cache:put:{instanceName}` - When value is stored

---

#### `get(key) → Promise<*>`

Retrieves a value from the cache by key.

**Parameters**:
- `key` (string): Cache key to retrieve

**Returns**: Promise that resolves to the cached value, or `undefined` if not found

**Throws**: Error if key is invalid

**Example**:
```javascript
// Get value
const user = await cache.get('user:123');
console.log(user); // { name: 'John', email: 'john@example.com' }

// Get non-existent key
const missing = await cache.get('nonexistent');
console.log(missing); // undefined

// Check if value exists
const user = await cache.get('user:123');
if (user) {
  console.log('User found in cache');
} else {
  console.log('User not in cache');
}
```

**Events Emitted**:
- `cache:get:{instanceName}` - When value is retrieved (hit or miss)

---

#### `delete(key) → Promise<void>`

Removes a value from the cache.

**Parameters**:
- `key` (string): Cache key to delete

**Throws**: Error if key is invalid

**Example**:
```javascript
// Delete single key
await cache.delete('user:123');

// Delete multiple keys
await Promise.all([
  cache.delete('user:123'),
  cache.delete('user:456'),
  cache.delete('session:abc')
]);

// Safe deletion (doesn't error if not found)
try {
  await cache.delete('maybe:exists');
} catch (err) {
  console.log('Key validation failed:', err.message);
}
```

**Events Emitted**:
- `cache:delete:{instanceName}` - When value is deleted

---

#### `getAnalytics() → Array<Object>`

Retrieves analytics data for cached keys.

**Returns**: Array of analytics objects with structure:
```javascript
[
  {
    key: 'user:123',
    hits: 42,
    lastHit: '2025-11-22T10:30:45.123Z'
  },
  {
    key: 'config:app',
    hits: 15,
    lastHit: '2025-11-22T10:25:30.456Z'
  }
]
```

**Example**:
```javascript
const analytics = cache.getAnalytics();

// Find most accessed key
const topKey = analytics.reduce((max, curr) =>
  curr.hits > max.hits ? curr : max
);
console.log(`Most accessed: ${topKey.key} (${topKey.hits} hits)`);

// Calculate average hits
const avgHits = analytics.reduce((sum, a) => sum + a.hits, 0) / analytics.length;
console.log(`Average hits per key: ${avgHits}`);
```

---

#### `getSettings() → Promise<Object>`

Retrieves provider-specific settings.

**Returns**: Promise resolving to settings object

**Example**:
```javascript
const settings = await cache.getSettings();
console.log('Cache settings:', settings);

// Redis example output:
// { redisdurl: '127.0.0.1', port: 6379, ... }

// Memory example output:
// { description: 'There are no settings for this provider', list: [] }
```

---

#### `saveSettings(settings) → Promise<void>`

Saves provider-specific settings.

**Parameters**:
- `settings` (object): Settings to update

**Example**:
```javascript
// Update Redis settings
await cache.saveSettings({
  redisdurl: 'new-redis-host.example.com',
  port: 6380
});
```

---

### Advanced Methods (Analytics)

The cache instance includes an `analytics` property providing detailed metrics.

#### `cache.analytics.getStats() → Object`

Returns comprehensive statistics for all cache operations.

**Returns**: Object with structure:
```javascript
{
  totalKeys: 5,
  totalHits: 128,
  totalMisses: 23,
  totalReads: 151,
  totalWrites: 45,
  keys: {
    'user:123': {
      hitCount: 42,
      missCount: 5,
      putCount: 3,
      deleteCount: 0,
      totalReads: 47,
      totalWrites: 3,
      firstActivity: '2025-11-22T10:00:00Z',
      lastActivity: '2025-11-22T10:45:30Z'
    },
    // ... other keys
  }
}
```

**Example**:
```javascript
const stats = cache.analytics.getStats();
console.log(`Total reads: ${stats.totalReads}`);
console.log(`Total writes: ${stats.totalWrites}`);
console.log(`Hit rate: ${(stats.totalHits / stats.totalReads * 100).toFixed(2)}%`);

// Find cache efficiency
const hitRate = stats.totalHits / stats.totalReads;
if (hitRate > 0.8) {
  console.log('Cache is highly efficient!');
} else if (hitRate < 0.5) {
  console.log('Consider cache optimization');
}
```

---

#### `cache.analytics.getTopKeys(limit, sortBy) → Array`

Returns top cache keys sorted by specified metric.

**Parameters**:
- `limit` (number): Maximum keys to return (default: 10)
- `sortBy` (string): Sort metric - 'hits', 'activity', 'reads', 'writes' (default: 'hits')

**Returns**: Array of top key objects

**Example**:
```javascript
// Top 5 most-accessed keys
const topHits = cache.analytics.getTopKeys(5, 'hits');
console.log('Top accessed keys:', topHits);

// Top 10 most-active keys
const topActive = cache.analytics.getTopKeys(10, 'activity');
console.log('Most active keys:', topActive);

// Keys with most writes
const topWrites = cache.analytics.getTopKeys(20, 'writes');
console.log('Most written keys:', topWrites);
```

---

#### `cache.analytics.getTopMisses(limit) → Array`

Returns cache keys with highest miss counts.

**Parameters**:
- `limit` (number): Maximum keys to return (default: 50)

**Returns**: Array of miss objects with `key`, `missCount`, and `stats`

**Example**:
```javascript
const misses = cache.analytics.getTopMisses(10);

// Identify cache pressure points
misses.forEach(miss => {
  console.log(`${miss.key}: ${miss.missCount} misses`);
  // Consider pre-caching these items
});
```

---

#### `cache.analytics.getHitDistribution(limit) → Object`

Returns hit distribution data for charting.

**Parameters**:
- `limit` (number): Top keys to include (default: 50)

**Returns**: Object with `labels` and `data` for pie/bar charts

**Example**:
```javascript
const distribution = cache.analytics.getHitDistribution(10);
console.log('Hit distribution:');
console.log('Keys:', distribution.labels);
console.log('Hits:', distribution.data);

// Use in charting library
Chart.createChart('cache-hits', {
  type: 'pie',
  data: {
    labels: distribution.labels,
    datasets: [{
      data: distribution.data,
      backgroundColor: generateColors(distribution.labels.length)
    }]
  }
});
```

---

#### `cache.analytics.getTimeline(topN) → Object`

Returns timeline data showing cache activity over time.

**Parameters**:
- `topN` (number): Top keys to include (default: 10)

**Returns**: Object with `labels` and `datasets` for line charts

**Example**:
```javascript
const timeline = cache.analytics.getTimeline(5);
console.log('Timeline:', timeline);
// {
//   labels: ['10:00', '10:05', '10:10'],
//   datasets: [
//     { name: 'user:123', data: [5, 8, 12] },
//     { name: 'config:app', data: [2, 3, 2] }
//   ]
// }
```

---

#### `cache.analytics.getKeyList(limit) → Array`

Returns list of cache keys with their statistics.

**Parameters**:
- `limit` (number): Maximum keys to return (default: 100)

**Returns**: Array of key objects with statistics

**Example**:
```javascript
const keyList = cache.analytics.getKeyList(20);
keyList.forEach(key => {
  console.log(`${key.name}: ${key.hitCount} hits, ${key.missCount} misses`);
});
```

---

#### `cache.analytics.getKeyStats(key) → Object|null`

Returns statistics for a specific key.

**Parameters**:
- `key` (string): Cache key

**Returns**: Statistics object or null if not found

**Example**:
```javascript
const stats = cache.analytics.getKeyStats('user:123');
if (stats) {
  console.log(`Key: user:123`);
  console.log(`  Hits: ${stats.hitCount}`);
  console.log(`  Misses: ${stats.missCount}`);
  console.log(`  Last accessed: ${stats.lastActivity}`);
}
```

---

## REST API Endpoints

### Endpoints Overview

```
Default Instance Routes:
  POST   /services/caching/api/put/:key          - Store value
  GET    /services/caching/api/get/:key          - Retrieve value
  DELETE /services/caching/api/delete/:key       - Delete value
  GET    /services/caching/api/list              - Get all analytics
  GET    /services/caching/api/analytics         - Get detailed analytics
  GET    /services/caching/api/status            - Service status
  GET    /services/caching/api/instances         - List instances
  GET    /services/caching/api/settings          - Get settings
  POST   /services/caching/api/settings          - Update settings

Named Instance Routes (add instance name before operation):
  POST   /services/caching/api/:instanceName/put/:key
  GET    /services/caching/api/:instanceName/get/:key
  DELETE /services/caching/api/:instanceName/delete/:key
  GET    /services/caching/api/:instanceName/list
  GET    /services/caching/api/:instanceName/analytics
```

### Detailed Endpoint Documentation

#### PUT: Store Value

**Endpoint**: `POST /services/caching/api/put/:key`

**URL Parameters**:
- `key` (string): Cache key

**Request Body**: Any JSON-serializable value

**Response**:
- Success: `200 OK` with body `"OK"`
- Error: `500 Internal Server Error` with error message

**Example**:
```bash
# Store simple value
curl -X POST http://localhost:3001/services/caching/api/put/user:123 \
  -H "Content-Type: application/json" \
  -d '{"name": "John", "email": "john@example.com"}'

# Store array
curl -X POST http://localhost:3001/services/caching/api/put/tags \
  -H "Content-Type: application/json" \
  -d '["nodejs", "javascript", "caching"]'

# Store string
curl -X POST http://localhost:3001/services/caching/api/put/message \
  -H "Content-Type: application/json" \
  -d '"Hello, World!"'

# Named instance
curl -X POST http://localhost:3001/services/caching/api/session/put/session:abc123 \
  -H "Content-Type: application/json" \
  -d '{"userId": 123, "loginTime": "2025-11-22T10:30:00Z"}'
```

---

#### GET: Retrieve Value

**Endpoint**: `GET /services/caching/api/get/:key`

**URL Parameters**:
- `key` (string): Cache key

**Response**:
- Success: `200 OK` with cached value as JSON
- Not found: `200 OK` with `null` or `undefined`
- Error: `500 Internal Server Error`

**Example**:
```bash
# Retrieve value
curl http://localhost:3001/services/caching/api/get/user:123

# Response:
# {"name":"John","email":"john@example.com"}

# Named instance
curl http://localhost:3001/services/caching/api/session/get/session:abc123
```

---

#### DELETE: Remove Value

**Endpoint**: `DELETE /services/caching/api/delete/:key`

**URL Parameters**:
- `key` (string): Cache key

**Response**:
- Success: `200 OK` with body `"OK"`
- Error: `500 Internal Server Error`

**Example**:
```bash
# Delete value
curl -X DELETE http://localhost:3001/services/caching/api/delete/user:123

# Named instance
curl -X DELETE http://localhost:3001/services/caching/api/session/delete/session:abc123
```

---

#### GET: Service Status

**Endpoint**: `GET /services/caching/api/status`

**Response**:
```json
"caching api running"
```

**Example**:
```bash
curl http://localhost:3001/services/caching/api/status
# Response: "caching api running"
```

---

#### GET: List Instances

**Endpoint**: `GET /services/caching/api/instances`

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
      "name": "session",
      "provider": "redis",
      "status": "active"
    }
  ],
  "total": 2
}
```

**Example**:
```bash
curl http://localhost:3001/services/caching/api/instances
```

---

#### GET: List Analytics (Simple)

**Endpoint**: `GET /services/caching/api/list`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "key": "user:123",
      "hits": 42,
      "lastHit": "2025-11-22T10:45:30.123Z"
    }
  ],
  "total": 1
}
```

**Example**:
```bash
curl http://localhost:3001/services/caching/api/list
```

---

#### GET: Detailed Analytics

**Endpoint**: `GET /services/caching/api/analytics`

**Response**:
```json
{
  "stats": {
    "totalKeys": 5,
    "totalHits": 128,
    "totalMisses": 23,
    "totalReads": 151,
    "totalWrites": 45,
    "keys": { ... }
  },
  "hitDistribution": {
    "labels": ["user:123", "config:app"],
    "data": [42, 15]
  },
  "timeline": {
    "labels": ["10:00", "10:05", "10:10"],
    "datasets": [...]
  },
  "keyList": [...],
  "topMisses": [...]
}
```

**Example**:
```bash
curl http://localhost:3001/services/caching/api/analytics | jq '.stats'
```

---

#### GET/POST: Settings

**Endpoint**: `GET /services/caching/api/settings`

**Response**:
```json
{
  "description": "There are no settings for this provider",
  "list": []
}
```

**Example**:
```bash
# Get settings
curl http://localhost:3001/services/caching/api/settings

# Update settings (POST)
curl -X POST http://localhost:3001/services/caching/api/settings \
  -H "Content-Type: application/json" \
  -d '{"redisdurl": "redis.example.com"}'
```

---

## Client Library (Browser)

### Overview

The client library provides browser-based access to both local and remote cache services.

### Including the Library

```html
<!-- In your HTML -->
<script src="/services/caching/scripts"></script>

<script>
  // Library is available as window.digitalTechnologiesCaching
  const cache = new digitalTechnologiesCaching();
</script>
```

### Local Cache (Browser Storage)

For client-side only caching without server communication:

```javascript
// Create local cache instance (no instanceName)
const localCache = new digitalTechnologiesCaching();

// All operations work locally
await localCache.put('theme', 'dark');
const theme = await localCache.get('theme');
```

### Remote Cache (Server-Side)

For server-backed caching:

```javascript
// Create remote cache instance (with instanceName)
const remoteCache = new digitalTechnologiesCaching({
  instanceName: 'default',
  baseUrl: window.location.origin,  // optional
  debug: true,                        // optional
  timeout: 5000                       // optional (ms)
});

// Operations go through REST API
await remoteCache.put('user:profile', { ... });
const profile = await remoteCache.get('user:profile');
```

### Client API Methods

#### `put(key, value) → Promise<void>`

Store a value in cache.

```javascript
// Store object
await cache.put('user:123', {
  name: 'John',
  email: 'john@example.com',
  preferences: { theme: 'dark' }
});

// Store array
await cache.put('recent-posts', [
  { id: 1, title: 'Post 1' },
  { id: 2, title: 'Post 2' }
]);

// Error handling
try {
  await cache.put('key', undefined);  // Error: undefined value
} catch (err) {
  console.error('Failed:', err.message);
}
```

---

#### `get(key) → Promise<*>`

Retrieve a value from cache.

```javascript
const user = await cache.get('user:123');
if (user) {
  console.log('User:', user.name);
} else {
  console.log('User not cached');
}

// With error handling
try {
  const value = await cache.get('key');
  console.log('Value:', value);
} catch (err) {
  console.error('Retrieval failed:', err.message);
}
```

---

#### `delete(key) → Promise<void>`

Remove a value from cache.

```javascript
await cache.delete('user:123');
console.log('User cache cleared');

// Safe deletion (no error if not found)
try {
  await cache.delete('maybe-nonexistent-key');
  console.log('Deleted successfully or was not present');
} catch (err) {
  console.error('Unexpected error:', err);
}
```

---

#### `exists(key) → Promise<boolean>`

Check if a key exists in cache.

```javascript
const exists = await cache.exists('user:123');
if (exists) {
  console.log('User is cached');
} else {
  console.log('User not in cache, need to fetch');
  const user = await fetchUserFromServer(123);
  await cache.put('user:123', user);
}
```

---

#### `status() → Promise<Object>`

Get cache service status.

```javascript
const status = await cache.status();
console.log('Cache status:', status);

// Local cache response:
// { type: 'local', status: 'active', size: 5, keys: 5 }

// Remote cache response:
// "caching api running"
```

---

#### `listInstances() → Promise<Array>`

Get list of available cache instances.

```javascript
const instances = await cache.listInstances();
console.log('Available caches:', instances);

// Local instance:
// [{ name: 'local', provider: 'memory', status: 'active', type: 'local' }]

// Remote instances:
// [
//   { name: 'default', provider: 'memory', status: 'active' },
//   { name: 'session', provider: 'redis', status: 'active' }
// ]
```

---

#### `putBatch(items) → Promise<Array>`

Store multiple values (batch operation).

```javascript
const results = await cache.putBatch({
  'user:123': { name: 'John' },
  'user:456': { name: 'Jane' },
  'config:app': { theme: 'dark' }
});

console.log('Batch results:', results);
// [
//   { key: 'user:123', success: true },
//   { key: 'user:456', success: true },
//   { key: 'config:app', success: true }
// ]
```

---

#### `getBatch(keys) → Promise<Object>`

Retrieve multiple values (batch operation).

```javascript
const results = await cache.getBatch(['user:123', 'user:456', 'config:app']);
console.log('Retrieved:', results);
// {
//   'user:123': { name: 'John' },
//   'user:456': { name: 'Jane' },
//   'config:app': { theme: 'dark' }
// }

// Error handling
try {
  const results = await cache.getBatch(['key1', 'key2']);
  Object.entries(results).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
} catch (err) {
  console.error('Batch retrieval failed:', err);
}
```

---

#### `clear(keys) → Promise<Array>`

Delete multiple values (batch operation).

```javascript
const results = await cache.clear(['user:123', 'user:456', 'session:abc']);
console.log('Clear results:', results);
// [
//   { key: 'user:123', success: true },
//   { key: 'user:456', success: true },
//   { key: 'session:abc', success: true }
// ]
```

---

#### Local-Only Methods

These methods only work with local cache instances (no `instanceName`):

##### `keys() → Promise<Array<string>>`

Get all keys in local cache.

```javascript
const localCache = new digitalTechnologiesCaching(); // local
const keys = await localCache.keys();
console.log('All keys:', keys);
```

##### `size() → Promise<number>`

Get number of entries in local cache.

```javascript
const localCache = new digitalTechnologiesCaching();
const size = await localCache.size();
console.log('Cache size:', size);
```

##### `clearAll() → Promise<void>`

Clear all entries from local cache.

```javascript
const localCache = new digitalTechnologiesCaching();
await localCache.clearAll();
console.log('Local cache cleared');
```

##### `getAnalytics() → Promise<Object>`

Get local cache analytics.

```javascript
const localCache = new digitalTechnologiesCaching();
const analytics = await localCache.getAnalytics();
console.log('Analytics:', analytics);
// {
//   type: 'local',
//   size: 5,
//   keys: ['key1', 'key2', 'key3', 'key4', 'key5'],
//   uptime: 3600000,
//   memoryUsage: '1234 bytes'
// }
```

---

### Complete Browser Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Cache Demo</title>
</head>
<body>
  <h1>Caching Service Demo</h1>

  <!-- Include caching library -->
  <script src="/services/caching/scripts"></script>

  <script>
    // Create cache instance
    const cache = new digitalTechnologiesCaching({
      instanceName: 'default',
      debug: true
    });

    // Example: Cache user profile
    async function cacheUserProfile(userId) {
      try {
        // Check cache first
        const cached = await cache.get(`user:${userId}`);
        if (cached) {
          console.log('From cache:', cached);
          return cached;
        }

        // Fetch from server if not cached
        const response = await fetch(`/api/users/${userId}`);
        const user = await response.json();

        // Cache the result
        await cache.put(`user:${userId}`, user);

        return user;
      } catch (err) {
        console.error('Error:', err);
      }
    }

    // Example: Batch operations
    async function loadUserDashboard(userIds) {
      // Check cache for all users
      const cached = await cache.getBatch(
        userIds.map(id => `user:${id}`)
      );

      const missing = userIds.filter(id => !cached[`user:${id}`]);

      if (missing.length > 0) {
        // Fetch missing users from server
        const response = await fetch(`/api/users/batch?ids=${missing.join(',')}`);
        const users = await response.json();

        // Cache the results
        const toCache = {};
        users.forEach(user => {
          toCache[`user:${user.id}`] = user;
        });
        await cache.putBatch(toCache);
      }

      return { ...cached, ...toCache };
    }

    // Test the cache
    async function test() {
      console.log('=== Cache Testing ===');

      // Store values
      await cache.put('greeting', 'Hello, World!');
      await cache.put('count', 42);

      // Retrieve values
      const greeting = await cache.get('greeting');
      console.log('Greeting:', greeting);

      // Check if exists
      const exists = await cache.exists('count');
      console.log('Count exists:', exists);

      // Get status
      const status = await cache.status();
      console.log('Cache status:', status);

      // List instances
      const instances = await cache.listInstances();
      console.log('Instances:', instances);

      // Delete values
      await cache.delete('greeting');
      const deleted = await cache.get('greeting');
      console.log('After delete:', deleted);
    }

    // Run test on page load
    window.addEventListener('load', test);
  </script>
</body>
</html>
```

---

## Analytics Module

### Architecture

The Analytics module automatically tracks all cache operations and provides detailed metrics.

### Event Listeners

The module listens to cache events and records metrics:

```
Cache Events                 | Tracked As
━━━━━━━━━━━━━━━━━━━━━━━━━━┃━━━━━━━━━━
cache:get:{instanceName}     | hit or miss
cache:put:{instanceName}     | write
cache:delete:{instanceName}  | delete
```

### Metrics Tracked

Per-key metrics:
- `hitCount` - Number of successful gets
- `missCount` - Number of failed gets
- `putCount` - Number of writes
- `deleteCount` - Number of deletes
- `totalReads` - Sum of hits + misses
- `totalWrites` - Sum of puts + deletes
- `firstActivity` - ISO timestamp of first operation
- `lastActivity` - ISO timestamp of most recent operation

Aggregate metrics:
- `totalKeys` - Number of distinct keys
- `totalHits` - Total hits across all keys
- `totalMisses` - Total misses across all keys
- `totalReads` - Total read operations
- `totalWrites` - Total write operations

### Analytics Methods

Detailed documentation in [Service API](#analytics-module) section above.

### Example: Monitoring Cache Health

```javascript
// Every 10 seconds, log cache health metrics
setInterval(() => {
  const stats = cache.analytics.getStats();

  const hitRate = stats.totalHits / stats.totalReads || 0;
  const writeRate = stats.totalWrites / (stats.totalReads + stats.totalWrites) || 0;

  console.log(`=== Cache Health Report ===`);
  console.log(`Hit Rate: ${(hitRate * 100).toFixed(2)}%`);
  console.log(`Write Rate: ${(writeRate * 100).toFixed(2)}%`);
  console.log(`Total Keys: ${stats.totalKeys}`);
  console.log(`Total Operations: ${stats.totalReads + stats.totalWrites}`);

  // Alert if hit rate is low
  if (hitRate < 0.5) {
    console.warn('⚠️ Low cache hit rate detected!');
  }
}, 10000);
```

---

## Scripts & Testing

### Client Library Script

**Endpoint**: `GET /services/caching/scripts`

Serves the browser-compatible caching library.

```html
<script src="/services/caching/scripts"></script>
```

The script makes `digitalTechnologiesCaching` available globally.

### Test Page

**Endpoint**: `GET /services/caching/scripts/test`

Provides an interactive test interface for the caching service.

```bash
# Visit in browser
open http://localhost:3001/services/caching/scripts/test
```

Features:
- Visual cache operations testing
- Real-time analytics display
- Instance management UI
- Performance monitoring
- Error demonstration

---

## Advanced Usage

### Multi-Instance Caching

```javascript
// Create multiple cache instances for different purposes
const sessionCache = createCacheService('redis', {
  instanceName: 'sessions',
  ttl: 1800000,  // 30 minutes
  host: 'redis.example.com'
}, eventEmitter);

const dataCache = createCacheService('redis', {
  instanceName: 'data',
  ttl: 3600000,  // 1 hour
  host: 'redis.example.com'
}, eventEmitter);

const staticCache = createCacheService('file', {
  instanceName: 'static',
  ttl: 86400000,  // 24 hours
  directory: './.cache/static'
}, eventEmitter);

// Retrieve specific instances later
const retrieved = serviceRegistry.getServiceInstance('caching', 'redis', 'sessions');
```

### Cache Invalidation Patterns

#### Time-Based Expiration

```javascript
const cache = createCacheService('redis', {
  ttl: 3600000  // Auto-expire after 1 hour
}, eventEmitter);
```

#### Event-Based Invalidation

```javascript
// Listen to data changes and invalidate cache
eventEmitter.on('user:updated', (user) => {
  cache.delete(`user:${user.id}`);
  cache.delete(`user:email:${user.email}`);
});

eventEmitter.on('product:updated', (product) => {
  cache.delete(`product:${product.id}`);
  cache.delete('products:list');  // Invalidate list
  cache.delete('products:search');  // Invalidate search
});
```

#### Manual Invalidation

```javascript
// Clear cache on demand
async function refreshUserCache(userId) {
  await cache.delete(`user:${userId}`);
  // Next request will fetch fresh data
}

// Batch invalidation
async function clearAllUserCaches() {
  const users = await getActiveUsers();
  await Promise.all(
    users.map(u => cache.delete(`user:${u.id}`))
  );
}
```

### Cache-Aside Pattern

```javascript
async function getUserWithCache(userId) {
  // Try cache first
  let user = await cache.get(`user:${userId}`);

  if (user) {
    return user;  // Cache hit
  }

  // Cache miss: fetch from database
  user = await database.users.findById(userId);

  if (user) {
    // Store in cache for future requests
    await cache.put(`user:${userId}`, user);
  }

  return user;
}
```

### Write-Through Pattern

```javascript
async function updateUserWithCache(userId, updates) {
  // Write to database first
  const user = await database.users.update(userId, updates);

  // Then update cache
  await cache.put(`user:${userId}`, user);

  return user;
}
```

### Monitoring Cache Performance

```javascript
// Log performance metrics
function logCachePerformance() {
  const stats = cache.analytics.getStats();

  logger.info('Cache Performance', {
    hitRate: stats.totalHits / stats.totalReads,
    missRate: stats.totalMisses / stats.totalReads,
    totalKeys: stats.totalKeys,
    totalOperations: stats.totalReads + stats.totalWrites,
    topKeys: cache.analytics.getTopKeys(5, 'hits')
  });
}

// Call periodically
setInterval(logCachePerformance, 60000);
```

---

## Troubleshooting

### Common Issues

#### Issue: Cache not persisting across restarts

**Cause**: Using memory provider in production

**Solution**: Use Redis or File provider
```javascript
// Bad: Data lost on restart
const cache = createCacheService('memory', ...);

// Good: Data persists
const cache = createCacheService('redis', {
  host: 'redis.example.com'
}, ...);
```

---

#### Issue: Redis connection errors

**Cause**: Redis server not running or wrong credentials

**Solution**: Verify Redis availability
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Check connection
redis-cli -h redis.example.com -p 6379 ping
```

---

#### Issue: High memory usage

**Cause**: Memory provider cache growing unbounded

**Solution**: Configure maxSize or use Redis
```javascript
// Limit memory cache size
const cache = createCacheService('memory', {
  maxSize: 1000,  // Only keep 1000 most recent entries
  ttl: 3600000    // Expire entries after 1 hour
}, eventEmitter);
```

---

#### Issue: Slow cache operations

**Cause**: Network latency with Redis/Memcached

**Solution**: Consider local caching layer
```javascript
// Two-tier caching
const localCache = createCacheService('memory', {
  instanceName: 'local',
  maxSize: 100,
  ttl: 300000  // 5 minutes
});

const remoteCache = createCacheService('redis', {
  instanceName: 'remote',
  ttl: 3600000  // 1 hour
});

// Check local first, then remote, then origin
async function get(key) {
  let value = await localCache.get(key);
  if (value) return value;

  value = await remoteCache.get(key);
  if (value) {
    await localCache.put(key, value);
    return value;
  }

  return null;
}
```

---

#### Issue: Analytics data consuming memory

**Cause**: Too many unique keys being tracked

**Solution**: Limit analytics entries or clear periodically
```javascript
// Configure max entries
const cache = createCacheService('memory', {
  maxAnalyticsEntries: 100  // Only track top 100 keys
}, eventEmitter);

// Or clear periodically
setInterval(() => {
  cache.analytics.clear();
}, 3600000);  // Clear every hour
```

---

## Examples & Recipes

### Recipe 1: Session Management

```javascript
// Configure session cache
const sessions = createCacheService('redis', {
  instanceName: 'sessions',
  ttl: 1800000,  // 30 minutes
  host: 'redis.example.com'
}, eventEmitter);

// Create session
async function createSession(userId, data) {
  const sessionId = generateUUID();
  await sessions.put(`session:${sessionId}`, {
    userId,
    data,
    createdAt: new Date()
  });
  return sessionId;
}

// Retrieve session
async function getSession(sessionId) {
  return await sessions.get(`session:${sessionId}`);
}

// Clear session
async function deleteSession(sessionId) {
  await sessions.delete(`session:${sessionId}`);
}
```

---

### Recipe 2: API Response Caching

```javascript
// Cache API responses
const apiCache = createCacheService('redis', {
  instanceName: 'api',
  ttl: 300000  // 5 minutes
});

// Cached fetch wrapper
async function fetchWithCache(url, options = {}) {
  const cacheKey = `api:${url}:${JSON.stringify(options)}`;

  // Try cache
  let response = await apiCache.get(cacheKey);
  if (response) {
    console.log('Cache hit:', url);
    return response;
  }

  // Fetch from API
  console.log('Cache miss:', url);
  const res = await fetch(url, options);
  response = await res.json();

  // Cache response
  await apiCache.put(cacheKey, response);

  return response;
}

// Usage
const user = await fetchWithCache('/api/users/123');
```

---

### Recipe 3: Rate Limiting with Cache

```javascript
const rateLimitCache = createCacheService('memory', {
  instanceName: 'rate-limit',
  ttl: 60000  // 1 minute
});

// Rate limiting middleware
async function rateLimit(req, res, next) {
  const key = `rate-limit:${req.ip}`;
  const count = await rateLimitCache.get(key) || 0;

  if (count >= 100) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  await rateLimitCache.put(key, count + 1);
  next();
}
```

---

### Recipe 4: Distributed Cache Warming

```javascript
// Pre-load frequently accessed data
async function warmCache() {
  console.log('Warming cache...');

  // Load popular products
  const products = await database.products.findPopular(100);
  for (const product of products) {
    await cache.put(`product:${product.id}`, product);
  }

  // Load categories
  const categories = await database.categories.findAll();
  await cache.put('categories:all', categories);

  console.log('Cache warming complete');
}

// Run on startup
app.listen(3001, () => {
  warmCache().catch(console.error);
});
```

---

### Recipe 5: Cache Warming on Schedule

```javascript
const scheduler = createSchedulingService(...);

// Warm cache every hour
scheduler.scheduleCron('warm-cache', '0 * * * *', async () => {
  console.log('Scheduled cache warming');

  // Refresh popular items
  const cache = registry.caching('redis');
  const items = await database.getPopularItems();

  for (const item of items) {
    await cache.put(`item:${item.id}`, item);
  }
});
```

---

**Document End**

This comprehensive guide covers all aspects of the Caching Service including initialization, providers, APIs, client library, analytics, and real-world recipes.
