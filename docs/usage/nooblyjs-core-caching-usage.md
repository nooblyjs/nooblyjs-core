# NooblyJS Core Caching Service Usage Guide

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

The **Caching Service** is a enterprise-grade, multi-backend caching solution that provides:

- **Multiple storage backends**: Memory, Redis, Memcached, File-based, and Cloud providers
- **Dual-mode operation**: Server-side (Node.js) and client-side (Browser JavaScript)
- **Flexible API**: Identical interface across all modes and providers
- **Auto-detection**: Automatic cloud provider configuration from environment variables
- **Analytics & Monitoring**: Built-in metrics for cache performance tracking
- **REST API**: Complete HTTP endpoints for remote cache operations

### Key Features

✓ Key-value storage with optional TTL (Time-to-Live)
✓ Batch operations for efficient multi-key handling
✓ Event-driven architecture for monitoring
✓ Settings management per provider
✓ Analytics with hit/miss tracking
✓ Zero-config cloud provider setup
✓ Seamless local/remote switching

---

## Supported Providers

| Provider | Backend | Use Case | Data Persistence |
|----------|---------|----------|------------------|
| **memory** | In-memory store | Development, testing, single-process apps | ✗ Lost on restart |
| **redis** | Redis server | Production, distributed systems | ✓ Optional |
| **memcached** | Memcached server | Distributed caching | ✓ Optional |
| **file** | File system | Persistent local cache | ✓ Automatic |
| **api** | Remote API | Consume remote cache instance | ✓ Depends on remote |
| **aws** | AWS ElastiCache (Redis) | AWS production environments | ✓ Automatic |
| **azure** | Azure Cache for Redis | Azure production environments | ✓ Automatic |
| **gcp** | GCP Cloud Memorystore | Google Cloud production environments | ✓ Automatic |
| **local** | Browser storage | Client-side JavaScript (offline-first) | ✓ Browser storage |

---

## Server-Side Usage (Node.js)

### Basic Setup

Initialize the caching service through ServiceRegistry:

```javascript
const ServiceRegistry = require('noobly-core');

// Initialize the service registry (required first)
const eventEmitter = new (require('events').EventEmitter)();
const app = require('express')();

ServiceRegistry.initialize(app, eventEmitter, {
  apiKeys: ['your-api-key'],
  requireApiKey: true
});

// Get a cache instance (memory provider by default)
const cache = ServiceRegistry.cache('memory');

// Or with options
const cache = ServiceRegistry.cache('redis', {
  host: 'localhost',
  port: 6379,
  instanceName: 'api-cache'
});
```

### Core Methods

#### PUT - Store a Value

```javascript
// Basic storage
await cache.put('user:123', { name: 'John Doe', email: 'john@example.com' });

// Storage with TTL (milliseconds)
await cache.put('session:456', { token: 'abc123' }, 3600000); // 1 hour

// Storage with TTL (seconds) - alternative format
await cache.put('temp-data', { value: 'temporary' }, 300); // 5 minutes

// Store any JSON-serializable data
await cache.put('config:app', {
  features: ['auth', 'logging', 'caching'],
  version: '1.0.14',
  debug: process.env.NODE_ENV === 'development'
});
```

#### GET - Retrieve a Value

```javascript
// Retrieve exact value
const user = await cache.get('user:123');
console.log(user.name); // 'John Doe'

// Get non-existent key returns null/undefined
const missing = await cache.get('nonexistent');
console.log(missing); // null or undefined

// Retrieve and deserialize
const config = await cache.get('config:app');
if (config && config.debug) {
  console.log('Debug mode enabled');
}
```

#### DELETE - Remove a Value

```javascript
// Delete single key
await cache.delete('user:123');

// Delete non-existent key is safe (no error)
await cache.delete('nonexistent'); // Returns successfully

// Verify deletion
const deleted = await cache.get('user:123');
console.log(deleted); // null
```

#### EXISTS - Check Key Presence

```javascript
// Check if key exists
const exists = await cache.exists('user:123');
if (exists) {
  console.log('User is cached');
} else {
  console.log('User not in cache');
}

// Useful for cache-aside pattern
async function getUser(id) {
  if (await cache.exists(`user:${id}`)) {
    return await cache.get(`user:${id}`);
  }

  // Fetch from database
  const user = await database.getUser(id);

  // Cache the result
  await cache.put(`user:${id}`, user, 3600000);

  return user;
}
```

#### BATCH OPERATIONS

```javascript
// Store multiple values at once
await cache.putBatch({
  'user:1': { name: 'Alice' },
  'user:2': { name: 'Bob' },
  'user:3': { name: 'Charlie' }
});

// Retrieve multiple values at once
const users = await cache.getBatch(['user:1', 'user:2', 'user:3']);
console.log(users['user:1'].name); // 'Alice'

// Delete multiple values
await cache.deleteBatch(['user:1', 'user:2', 'user:3']);
```

#### KEYS - Get All Keys (Local Cache Only)

```javascript
// Get all cached keys
const allKeys = await cache.keys();
console.log(allKeys); // ['user:1', 'user:2', 'config:app', ...]

// Find specific patterns (requires custom filtering)
const userKeys = allKeys.filter(k => k.startsWith('user:'));
console.log(userKeys); // ['user:1', 'user:2', ...]
```

#### SIZE - Get Cache Entry Count (Local Cache Only)

```javascript
// Get number of entries
const count = await cache.size();
console.log(`Cache has ${count} entries`);

// Monitor cache growth
setInterval(async () => {
  const size = await cache.size();
  if (size > 10000) {
    console.warn('Cache is getting large:', size);
  }
}, 60000); // Check every minute
```

#### CLEAR ALL - Empty the Cache (Local Cache Only)

```javascript
// Clear all entries
await cache.clearAll();

// Verify cache is empty
const size = await cache.size(); // 0
const keys = await cache.keys(); // []
```

#### GET ANALYTICS - Performance Metrics

```javascript
// Get cache statistics
const stats = await cache.getAnalytics();

console.log(stats);
// Output:
// {
//   cacheHits: 1250,
//   cacheMisses: 340,
//   hitRate: 78.6,
//   topKeys: ['user:123', 'session:456', ...],
//   memoryUsage: '2.4 MB',
//   keys: 156,
//   size: 156
// }

// Monitor hit rate
const stats = await cache.getAnalytics();
if (stats.hitRate < 50) {
  console.warn('Cache hit rate is low:', stats.hitRate);
}
```

#### GET STATUS - Cache Health

```javascript
// Get cache status
const status = await cache.status();

console.log(status);
// Output:
// {
//   type: 'memory',
//   status: 'active',
//   size: 156,
//   keys: 156,
//   ready: true
// }
```

#### LIST INSTANCES - Available Caches

```javascript
// List all available cache instances
const instances = await cache.listInstances();

console.log(instances);
// Output:
// [
//   { name: 'default', provider: 'memory', status: 'active', type: 'local' },
//   { name: 'api-cache', provider: 'redis', status: 'active', type: 'remote' }
// ]
```

### Settings Management

```javascript
// Get provider settings
const settings = await cache.getSettings();

console.log(settings);
// Output varies by provider

// Update settings
await cache.saveSettings({
  maxmemoryPolicy: 'allkeys-lru',
  timeout: 300
});
```

---

## Client-Side Usage (Browser)

The caching library is available as a browser script for client-side applications.

### Include the Script

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
</head>
<body>
  <!-- Include NooblyJS Caching Library -->
  <script src="/services/caching/scripts"></script>

  <script>
    // Caching service is now available as: nooblyjsCaching
  </script>
</body>
</html>
```

### Local Cache (Client-Side Only, No Server)

```javascript
// Create local in-memory cache (no server needed)
const cache = new nooblyjsCaching();

// Store data
await cache.put('user:profile', {
  id: 123,
  name: 'John Doe',
  preferences: { theme: 'dark' }
});

// Retrieve data instantly (no network latency)
const profile = await cache.get('user:profile');
console.log(profile.name); // 'John Doe'

// Check existence
const exists = await cache.exists('user:profile'); // true

// Get all keys
const keys = await cache.keys(); // ['user:profile']

// Get cache size
const size = await cache.size(); // 1

// Get analytics
const stats = await cache.getAnalytics();
console.log(stats.size); // 1

// Clear all
await cache.clearAll();
```

### Remote Cache (Server-Side with Offline Fallback)

```javascript
// Create remote cache instance (connects to server)
const remoteCache = new nooblyjsCaching({
  instanceName: 'default',
  baseUrl: 'https://api.example.com',
  timeout: 5000
});

// Use same API as local cache
await remoteCache.put('data:key', { value: 'stored on server' });
const data = await remoteCache.get('data:key');

// Optional: Offline-first pattern with fallback
const localCache = new nooblyjsCaching();

async function cacheAside(key, fetchFn) {
  // Try local cache first
  let data = await localCache.get(key);
  if (data) {
    console.log('Found in local cache');
    return data;
  }

  try {
    // Try remote cache
    data = await remoteCache.get(key);
    if (data) {
      // Store locally for offline access
      await localCache.put(key, data);
      return data;
    }
  } catch (error) {
    console.log('Remote cache unavailable, using fallback');
  }

  // Fetch from source
  data = await fetchFn();

  // Store in both caches
  await localCache.put(key, data);
  try {
    await remoteCache.put(key, data);
  } catch {
    console.log('Could not sync to remote cache');
  }

  return data;
}

// Usage
const user = await cacheAside('user:123', () =>
  fetch('/api/users/123').then(r => r.json())
);
```

### Switching Between Local and Remote

```javascript
// Environment-aware cache selection
let cache;

if (process.env.NODE_ENV === 'development') {
  // Development: instant in-memory cache
  cache = new nooblyjsCaching({ debug: true });
} else {
  // Production: server-backed cache
  cache = new nooblyjsCaching({
    instanceName: 'default',
    baseUrl: window.location.origin
  });
}

// Same code works for both!
await cache.put('data', { test: true });
const data = await cache.get('data');
console.log(data); // { test: true }
```

### Use Cases

#### Session Storage
```javascript
const sessionCache = new nooblyjsCaching();

// Store user session without server
await sessionCache.put('session:current', {
  userId: 123,
  role: 'admin',
  loginTime: new Date()
});

// Retrieve session
const session = await sessionCache.get('session:current');
if (session && session.role === 'admin') {
  console.log('User is admin');
}
```

#### Form Draft Persistence
```javascript
const cache = new nooblyjsCaching();

// Auto-save form draft
document.getElementById('articleForm').addEventListener('input', async (e) => {
  const formData = new FormData(e.target);
  const draft = Object.fromEntries(formData);
  await cache.put('draft:article', draft);
});

// Restore draft on page load
window.addEventListener('load', async () => {
  const draft = await cache.get('draft:article');
  if (draft) {
    Object.entries(draft).forEach(([key, value]) => {
      const field = document.querySelector(`[name="${key}"]`);
      if (field) field.value = value;
    });
  }
});
```

#### API Response Caching
```javascript
const cache = new nooblyjsCaching();

async function fetchWithCache(url, cacheKey, ttl = 3600000) {
  // Check cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    console.log('Using cached response');
    return cached;
  }

  // Fetch from API
  const response = await fetch(url);
  const data = await response.json();

  // Cache the response
  await cache.put(cacheKey, data, ttl);

  return data;
}

// Usage
const users = await fetchWithCache(
  '/api/users',
  'api:users',
  3600000 // 1 hour
);
```

#### Offline-First Applications
```javascript
const cache = new nooblyjsCaching();
const remoteCache = new nooblyjsCaching({ instanceName: 'default' });

async function getData(key) {
  try {
    // Try remote first
    const data = await remoteCache.get(key);
    // Save to local cache
    await cache.put(key, data);
    return data;
  } catch {
    // Fall back to local cache
    const data = await cache.get(key);
    if (!data) {
      throw new Error('Data unavailable offline');
    }
    return data;
  }
}

// Create fully offline-capable app
window.addEventListener('online', async () => {
  console.log('Back online! Syncing cache...');
  const keys = await cache.keys();
  for (const key of keys) {
    const data = await cache.get(key);
    try {
      await remoteCache.put(key, data);
    } catch {
      console.log(`Could not sync ${key}`);
    }
  }
});
```

---

## REST API Usage

The caching service provides complete REST endpoints for remote operations.

### Base Endpoint

All endpoints are under `/services/caching/api/`

### Authentication

Use one of these methods:

```bash
# Method 1: x-api-key header
curl -H "x-api-key: YOUR_KEY" \
  http://localhost:3001/services/caching/api/status

# Method 2: Bearer token
curl -H "Authorization: Bearer YOUR_KEY" \
  http://localhost:3001/services/caching/api/status

# Method 3: api-key query parameter
curl http://localhost:3001/services/caching/api/status?api_key=YOUR_KEY

# Method 4: api-key header
curl -H "api-key: YOUR_KEY" \
  http://localhost:3001/services/caching/api/status

# Method 5: ApiKey Authorization header
curl -H "Authorization: ApiKey YOUR_KEY" \
  http://localhost:3001/services/caching/api/status
```

### Endpoints

#### Status (No Auth Required)

```bash
GET /services/caching/api/status

# Example
curl http://localhost:3001/services/caching/api/status

# Response
{
  "type": "memory",
  "status": "active",
  "size": 0,
  "keys": 0,
  "ready": true
}
```

#### PUT - Store Value

```bash
POST /services/caching/api/put/:key

# Example
curl -X POST http://localhost:3001/services/caching/api/put/user:123 \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -d '{"name": "John Doe", "email": "john@example.com"}'

# Response
OK
```

#### GET - Retrieve Value

```bash
GET /services/caching/api/get/:key

# Example
curl http://localhost:3001/services/caching/api/get/user:123 \
  -H "x-api-key: YOUR_KEY"

# Response
{"name": "John Doe", "email": "john@example.com"}
```

#### DELETE - Remove Value

```bash
DELETE /services/caching/api/delete/:key

# Example
curl -X DELETE http://localhost:3001/services/caching/api/delete/user:123 \
  -H "x-api-key: YOUR_KEY"

# Response
OK
```

#### EXISTS - Check Key

```bash
GET /services/caching/api/exists/:key

# Example
curl http://localhost:3001/services/caching/api/exists/user:123 \
  -H "x-api-key: YOUR_KEY"

# Response
{
  "key": "user:123",
  "exists": true
}
```

#### BATCH PUT - Store Multiple

```bash
POST /services/caching/api/putBatch

# Example
curl -X POST http://localhost:3001/services/caching/api/putBatch \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -d '{
    "user:1": {"name": "Alice"},
    "user:2": {"name": "Bob"},
    "user:3": {"name": "Charlie"}
  }'

# Response
OK
```

#### BATCH GET - Retrieve Multiple

```bash
POST /services/caching/api/getBatch

# Example
curl -X POST http://localhost:3001/services/caching/api/getBatch \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -d '["user:1", "user:2", "user:3"]'

# Response
{
  "user:1": {"name": "Alice"},
  "user:2": {"name": "Bob"},
  "user:3": {"name": "Charlie"}
}
```

#### ANALYTICS - Get Metrics

```bash
GET /services/caching/api/analytics

# Example
curl http://localhost:3001/services/caching/api/analytics \
  -H "x-api-key: YOUR_KEY"

# Response
{
  "cacheHits": 1250,
  "cacheMisses": 340,
  "hitRate": 78.6,
  "topKeys": ["user:123", "session:456"],
  "memoryUsage": "2.4 MB",
  "keys": 156,
  "size": 156
}
```

#### SETTINGS - Get Configuration

```bash
GET /services/caching/api/settings

# Example
curl http://localhost:3001/services/caching/api/settings \
  -H "x-api-key: YOUR_KEY"

# Response (varies by provider)
{
  "description": "Memory cache settings",
  "list": [],
  "memory": {
    "type": "memory",
    "entries": 156,
    "memory": "2.4 MB"
  }
}
```

---

## Provider Configuration

### Memory Provider (Default)

Best for: Development, testing, single-process applications

```javascript
const cache = ServiceRegistry.cache('memory', {
  maxSize: 1000,           // Maximum entries
  ttl: 3600000,           // Default TTL (1 hour)
  instanceName: 'default'
});

// No external dependencies
// Zero configuration needed
```

### Redis Provider

Best for: Production, distributed systems, persistent caching

```javascript
const cache = ServiceRegistry.cache('redis', {
  host: 'localhost',                    // Redis server host
  port: 6379,                          // Redis server port
  password: 'your-password',           // Optional auth
  instanceName: 'api-cache',
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100
});

// Environment variable alternative
process.env.REDIS_HOST = 'redis.example.com';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = 'your-password';

const cache = ServiceRegistry.cache('redis');
```

### Memcached Provider

Best for: Distributed caching, simple key-value storage

```javascript
const cache = ServiceRegistry.cache('memcached', {
  host: 'localhost',
  port: 11211,
  username: 'user',
  password: 'password',
  instanceName: 'cache'
});
```

### File Provider

Best for: Local persistent caching, offline mode

```javascript
const cache = ServiceRegistry.cache('file', {
  dataDir: './.cache',      // Directory for cache files
  ttl: 86400000,           // 24 hours
  instanceName: 'file-cache'
});

// Cache survives process restart
// All data stored in .cache directory
```

### API Provider

Best for: Consuming a remote cache service

```javascript
const cache = ServiceRegistry.cache('api', {
  apiUrl: 'http://cache-server:3001/services/caching/api',
  apiKey: 'your-api-key',
  timeout: 5000,
  instanceName: 'remote'
});
```

### AWS ElastiCache Provider

Best for: AWS production environments with managed Redis

```javascript
const cache = ServiceRegistry.cache('aws', {
  elasticacheEndpoint: 'my-cache.abc123.ng.0001.use1.cache.amazonaws.com',
  elasticachePort: 6379,
  region: 'us-east-1',
  authToken: 'your-auth-token',  // Optional for encrypted clusters
  tls: true,                      // Enable TLS
  instanceName: 'aws-cache'
});

// Auto-detect from environment
process.env.ELASTICACHE_ENDPOINT = 'my-cache.abc123.ng.0001.use1.cache.amazonaws.com';
process.env.ELASTICACHE_PORT = '6379';
process.env.AWS_REGION = 'us-east-1';
process.env.ELASTICACHE_AUTH_TOKEN = 'your-auth-token';

const cache = ServiceRegistry.cache('aws');

// Detect cluster mode
const clusterInfo = await cache.detectClusterMode();
console.log(clusterInfo.mode); // 'cluster' or 'single-node'
```

### Azure Cache for Redis Provider

Best for: Azure production environments with managed Redis

```javascript
const cache = ServiceRegistry.cache('azure', {
  connectionString: 'myredis.redis.cache.windows.net:6379,password=XXX,ssl=True',
  // OR individual settings:
  hostname: 'myredis.redis.cache.windows.net',
  port: 6380,
  accessKey: 'your-access-key',
  resourceGroup: 'my-resource-group',
  resourceName: 'myredis',
  tier: 'premium',  // 'standard' or 'premium'
  ssl: true,
  instanceName: 'azure-cache'
});

// Auto-detect from environment
process.env.AZURE_REDIS_HOSTNAME = 'myredis.redis.cache.windows.net';
process.env.AZURE_REDIS_PORT = '6380';
process.env.AZURE_REDIS_ACCESS_KEY = 'your-access-key';
process.env.AZURE_RESOURCE_GROUP = 'my-resource-group';
process.env.AZURE_RESOURCE_NAME = 'myredis';
process.env.AZURE_REDIS_TIER = 'premium';

const cache = ServiceRegistry.cache('azure');

// Detect tier
const tierInfo = await cache.detectCacheTier();
console.log(tierInfo.tier); // 'standard' or 'premium'
```

### GCP Cloud Memorystore Provider

Best for: Google Cloud production environments

```javascript
const cache = ServiceRegistry.cache('gcp', {
  projectId: 'my-project-123456',
  region: 'us-central1',
  instanceId: 'my-redis-instance',
  host: '10.0.0.2',
  port: 6379,
  authToken: 'your-auth-token',
  tier: 'standard',  // 'basic' or 'standard'
  memorySizeGb: 4,
  network: 'default',
  enableAuth: true,
  instanceName: 'gcp-cache'
});

// Auto-detect from environment
process.env.GOOGLE_CLOUD_PROJECT = 'my-project-123456';
process.env.GCP_REGION = 'us-central1';
process.env.GCP_INSTANCE_ID = 'my-redis-instance';
process.env.GCP_REDIS_HOST = '10.0.0.2';
process.env.GCP_REDIS_PORT = '6379';
process.env.GCP_REDIS_AUTH_TOKEN = 'your-auth-token';
process.env.GCP_INSTANCE_TIER = 'standard';
process.env.GCP_MEMORY_SIZE_GB = '4';
process.env.GCP_NETWORK = 'default';

const cache = ServiceRegistry.cache('gcp');

// Detect configuration
const config = await cache.detectMemorystoreConfig();
console.log(config.tier); // 'basic' or 'standard'
```

---

## Advanced Features

### Cache-Aside Pattern

Implement read-through caching:

```javascript
async function cacheAside(key, fetchFn, ttl = 3600000) {
  // Check cache
  const cached = await cache.get(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  // Fetch from source
  const data = await fetchFn();

  // Cache the result
  if (data !== null && data !== undefined) {
    await cache.put(key, data, ttl);
  }

  return data;
}

// Usage
const user = await cacheAside(
  `user:${id}`,
  () => database.getUser(id),
  3600000
);
```

### Write-Through Pattern

Update both cache and database:

```javascript
async function saveWithCache(key, data, saveFn) {
  // Update database
  const result = await saveFn(data);

  // Update cache
  await cache.put(key, result);

  return result;
}

// Usage
await saveWithCache(`user:${id}`, userData, (data) =>
  database.updateUser(id, data)
);
```

### Invalidation Patterns

```javascript
// Invalidate single key
await cache.delete(`user:${userId}`);

// Invalidate multiple related keys
const userKeys = await cache.keys();
const relatedKeys = userKeys.filter(k => k.startsWith(`user:${userId}:`));
await cache.deleteBatch(relatedKeys);

// Invalidate pattern (if supported)
await cache.delete(`session:*`); // May not work with all providers

// Clear everything
await cache.clearAll();
```

### Event Monitoring

```javascript
const eventEmitter = ServiceRegistry.getEventEmitter();

// Listen for cache hits
eventEmitter.on('cache:hit', (data) => {
  console.log('Cache hit:', data.key);
});

// Listen for cache misses
eventEmitter.on('cache:miss', (data) => {
  console.log('Cache miss:', data.key);
});

// Listen for put operations
eventEmitter.on('cache:put', (data) => {
  console.log('Stored:', data.key);
});

// Listen for delete operations
eventEmitter.on('cache:delete', (data) => {
  console.log('Deleted:', data.key);
});

// Listen for errors
eventEmitter.on('cache:error', (data) => {
  console.error('Cache error:', data.error);
});
```

### Multiple Instances

```javascript
// Create multiple cache instances with different providers
const sessionCache = ServiceRegistry.cache('memory', {
  instanceName: 'sessions'
});

const dataCache = ServiceRegistry.cache('redis', {
  instanceName: 'data',
  host: 'redis-server'
});

const fileCache = ServiceRegistry.cache('file', {
  instanceName: 'persistent',
  dataDir: './.data-cache'
});

// Use each independently
await sessionCache.put('session:123', sessionData);
await dataCache.put('data:key', largeData);
await fileCache.put('config', configData);
```

---

## Examples

### Complete Application Example

```javascript
const express = require('express');
const events = require('events');
const ServiceRegistry = require('noobly-core');

const app = express();
const eventEmitter = new events.EventEmitter();

// Initialize service registry
ServiceRegistry.initialize(app, eventEmitter, {
  apiKeys: ['dev-key-123'],
  requireApiKey: true,
  excludePaths: ['/health', '/status']
});

// Create cache instances
const sessionCache = ServiceRegistry.cache('memory', {
  instanceName: 'sessions'
});

const redisCache = ServiceRegistry.cache('redis', {
  host: process.env.REDIS_HOST || 'localhost',
  instanceName: 'data'
});

// Helper: Cache-aside fetch
async function getCachedData(key, fetchFn) {
  const cached = await redisCache.get(key);
  if (cached) return cached;

  const data = await fetchFn();
  await redisCache.put(key, data, 3600000); // 1 hour
  return data;
}

// Middleware: Session handling
app.use(async (req, res, next) => {
  const sessionId = req.cookies?.sessionId;
  if (sessionId) {
    req.session = await sessionCache.get(`session:${sessionId}`);
  }
  next();
});

// Routes
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await getCachedData(
      `user:${req.params.id}`,
      () => fetchUserFromDB(req.params.id)
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users/:id', async (req, res) => {
  try {
    const user = await updateUserInDB(req.params.id, req.body);

    // Invalidate cache
    await redisCache.delete(`user:${req.params.id}`);

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Monitor cache performance
setInterval(async () => {
  const stats = await redisCache.getAnalytics();
  console.log(`Cache hit rate: ${stats.hitRate}%`);
  if (stats.hitRate < 50) {
    console.warn('Low cache hit rate detected');
  }
}, 60000); // Every minute

app.listen(3001, () => {
  console.log('Server running on port 3001');
  console.log('Cache service configured');
});
```

### Browser Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todo App with Local Caching</title>
</head>
<body>
  <div id="app">
    <h1>Todo App</h1>
    <input id="todoInput" type="text" placeholder="Add a todo...">
    <button id="addBtn">Add</button>
    <ul id="todoList"></ul>
    <button id="clearBtn">Clear All</button>
  </div>

  <script src="/services/caching/scripts"></script>
  <script>
    // Local cache instance
    const cache = new nooblyjsCaching();

    // Initialize from cache
    async function init() {
      const todos = await cache.get('todos');
      if (todos) {
        renderTodos(todos);
      }
    }

    // Render todos
    function renderTodos(todos = []) {
      const list = document.getElementById('todoList');
      list.innerHTML = todos
        .map((todo, i) => `
          <li>
            ${todo.text}
            <button onclick="deleteTodo(${i})">Delete</button>
          </li>
        `)
        .join('');
    }

    // Add todo
    document.getElementById('addBtn').addEventListener('click', async () => {
      const input = document.getElementById('todoInput');
      const text = input.value.trim();
      if (!text) return;

      // Get current todos
      let todos = await cache.get('todos') || [];

      // Add new todo
      todos.push({
        text: text,
        completed: false,
        createdAt: new Date()
      });

      // Save to cache
      await cache.put('todos', todos);

      // Render
      renderTodos(todos);
      input.value = '';
    });

    // Delete todo
    window.deleteTodo = async (index) => {
      let todos = await cache.get('todos') || [];
      todos.splice(index, 1);
      await cache.put('todos', todos);
      renderTodos(todos);
    };

    // Clear all
    document.getElementById('clearBtn').addEventListener('click', async () => {
      await cache.delete('todos');
      renderTodos([]);
    });

    // Initialize on load
    init();
  </script>
</body>
</html>
```

---

## Troubleshooting

### Cache Not Working

```javascript
// Check cache status
const status = await cache.status();
console.log(status);

// Check if cache is ready
if (status.status !== 'active') {
  console.error('Cache is not ready');
}
```

### Low Hit Rate

```javascript
// Get analytics
const stats = await cache.getAnalytics();
console.log(`Hit rate: ${stats.hitRate}%`);
console.log(`Hits: ${stats.cacheHits}, Misses: ${stats.cacheMisses}`);

// Check top keys
console.log('Top keys:', stats.topKeys);
```

### Memory Issues

```javascript
// Get memory usage
const stats = await cache.getAnalytics();
console.log(`Memory: ${stats.memoryUsage}`);

// Clear if needed
if (stats.size > 10000) {
  await cache.clearAll();
  console.log('Cache cleared');
}
```

### Connection Errors (Redis/Memcached)

```javascript
// Check status
const info = await cache.getConnectionInfo();
console.log(info);

// Verify provider settings
const settings = await cache.getSettings();
console.log(settings);
```

---

## Best Practices

1. **Use TTL appropriately**: Set reasonable TTL values to prevent stale data
2. **Monitor hit rate**: Regularly check analytics to validate caching strategy
3. **Implement cache invalidation**: Clear cache when data changes
4. **Use batch operations**: For multiple keys, use putBatch/getBatch for efficiency
5. **Choose provider wisely**: Match provider to your use case and infrastructure
6. **Handle errors gracefully**: Implement fallback logic for cache failures
7. **Secure access**: Use API keys and authentication in production
8. **Document cache keys**: Maintain consistent naming conventions
9. **Test offline scenarios**: Especially for browser-based apps
10. **Monitor performance**: Track cache metrics and adjust configuration

---

## Summary

The NooblyJS Caching Service provides a comprehensive, flexible solution for caching across:

- **Server-side (Node.js)** with multiple backends
- **Client-side (Browser)** with local and remote modes
- **Cloud providers** (AWS, Azure, GCP)
- **REST API** for remote operations

Choose the provider that best fits your infrastructure and requirements, and leverage the consistent API across all modes and providers.
