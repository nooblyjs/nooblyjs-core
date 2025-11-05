# NooblyJS Core Caching Service - Concise Reference

## Quick Start

```javascript
const ServiceRegistry = require('noobly-core');
const eventEmitter = new (require('events').EventEmitter)();
const app = require('express')();

// Initialize (required first)
ServiceRegistry.initialize(app, eventEmitter, {
  apiKeys: ['api-key'],
  requireApiKey: true
});

// Get cache instance
const cache = ServiceRegistry.cache('memory');
const redisCache = ServiceRegistry.cache('redis', { host: 'localhost' });
```

## Core API - All Providers

| Method | Usage | Returns |
|--------|-------|---------|
| `put(key, value, ttl?)` | Store value (TTL in ms) | Promise |
| `get(key)` | Retrieve value | Promise<value\|null> |
| `delete(key)` | Remove key | Promise |
| `exists(key)` | Check if exists | Promise<boolean> |
| `putBatch(obj)` | Store multiple | Promise |
| `getBatch(keys[])` | Get multiple | Promise<object> |
| `deleteBatch(keys[])` | Delete multiple | Promise |
| `status()` | Get health status | Promise<status> |
| `getAnalytics()` | Get metrics | Promise<stats> |
| `getSettings()` | Get provider config | Promise<settings> |

## Local-Only Methods

```javascript
// Only work with local cache
await cache.keys();          // All keys array
await cache.size();          // Entry count
await cache.clearAll();      // Empty cache
```

## Providers

| Provider | Backend | Config | Auto-Detect |
|----------|---------|--------|-------------|
| **memory** | RAM | None | N/A |
| **redis** | Redis | host, port | N/A |
| **memcached** | Memcached | host, port | N/A |
| **file** | Filesystem | dataDir | N/A |
| **api** | Remote API | apiUrl, apiKey | N/A |
| **aws** | ElastiCache | elasticacheEndpoint | Yes |
| **azure** | Cache for Redis | hostname, accessKey | Yes |
| **gcp** | Cloud Memorystore | projectId, instanceId | Yes |

## Cloud Provider Setup

### AWS ElastiCache
```javascript
const cache = ServiceRegistry.cache('aws', {
  elasticacheEndpoint: 'my-cache.region.cache.amazonaws.com',
  region: 'us-east-1',
  authToken: 'token'  // optional
});
await cache.detectClusterMode();  // Get cluster info
```

### Azure Cache for Redis
```javascript
const cache = ServiceRegistry.cache('azure', {
  hostname: 'myredis.redis.cache.windows.net',
  port: 6380,
  accessKey: 'key',
  tier: 'premium'  // or 'standard'
});
await cache.detectCacheTier();  // Get tier info
```

### GCP Cloud Memorystore
```javascript
const cache = ServiceRegistry.cache('gcp', {
  projectId: 'my-project',
  region: 'us-central1',
  instanceId: 'my-instance',
  host: '10.0.0.2',
  tier: 'standard'  // or 'basic'
});
await cache.detectMemorystoreConfig();  // Get config
```

## Common Patterns

### Cache-Aside (Read-Through)
```javascript
async function get(key, fetchFn) {
  const cached = await cache.get(key);
  if (cached) return cached;

  const data = await fetchFn();
  await cache.put(key, data, 3600000);  // 1 hour
  return data;
}

const user = await get('user:123', () => db.getUser(123));
```

### Write-Through
```javascript
async function save(key, data, saveFn) {
  const result = await saveFn(data);
  await cache.put(key, result);
  return result;
}
```

### Invalidation
```javascript
await cache.delete(`user:${id}`);
const keys = await cache.keys();
const pattern = keys.filter(k => k.startsWith('session:'));
await cache.deleteBatch(pattern);
```

## Browser Usage

### Local Cache (No Server)
```html
<script src="/services/caching/scripts"></script>
<script>
  const cache = new nooblyjsCaching();  // Local, instant, offline

  await cache.put('key', { data: 'value' });
  const data = await cache.get('key');
  const exists = await cache.exists('key');
  const size = await cache.size();
  const keys = await cache.keys();
  await cache.clearAll();
</script>
```

### Remote Cache
```javascript
const cache = new nooblyjsCaching({
  instanceName: 'default',
  baseUrl: 'https://api.example.com'
});

await cache.put('key', data);
const data = await cache.get('key');
```

### Offline-First Pattern
```javascript
const local = new nooblyjsCaching();
const remote = new nooblyjsCaching({ instanceName: 'default' });

async function getData(key) {
  try {
    const data = await remote.get(key);
    await local.put(key, data);  // Sync locally
    return data;
  } catch {
    return await local.get(key);  // Fallback
  }
}
```

## REST API

All endpoints under `/services/caching/api/`

### Authentication (pick one)
```bash
-H "x-api-key: KEY"
-H "Authorization: Bearer KEY"
?api_key=KEY
-H "api-key: KEY"
-H "Authorization: ApiKey KEY"
```

### Endpoints
```bash
GET    /status                    # No auth required
POST   /put/:key       -d '{...}' # Store
GET    /get/:key                  # Retrieve
DELETE /delete/:key               # Remove
GET    /exists/:key               # Check
POST   /putBatch       -d '{...}' # Store multiple
POST   /getBatch       -d '[...]' # Get multiple
GET    /analytics                 # Metrics
GET    /settings                  # Config
```

### Examples
```bash
# Put
curl -X POST http://localhost:3001/services/caching/api/put/user:123 \
  -H "x-api-key: KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"John"}'

# Get
curl http://localhost:3001/services/caching/api/get/user:123 \
  -H "x-api-key: KEY"

# Analytics
curl http://localhost:3001/services/caching/api/analytics \
  -H "x-api-key: KEY"
```

## Environment Variables

```bash
# Redis
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=password

# AWS
ELASTICACHE_ENDPOINT=my-cache.region.cache.amazonaws.com
ELASTICACHE_PORT=6379
AWS_REGION=us-east-1
ELASTICACHE_AUTH_TOKEN=token

# Azure
AZURE_REDIS_HOSTNAME=myredis.redis.cache.windows.net
AZURE_REDIS_PORT=6380
AZURE_REDIS_ACCESS_KEY=key
AZURE_RESOURCE_GROUP=resource-group
AZURE_RESOURCE_NAME=myredis
AZURE_REDIS_TIER=premium

# GCP
GOOGLE_CLOUD_PROJECT=my-project
GCP_REGION=us-central1
GCP_INSTANCE_ID=my-instance
GCP_REDIS_HOST=10.0.0.2
GCP_REDIS_PORT=6379
GCP_REDIS_AUTH_TOKEN=token
GCP_INSTANCE_TIER=standard
GCP_MEMORY_SIZE_GB=4
GCP_NETWORK=default
```

## Analytics Response
```javascript
{
  cacheHits: 1250,
  cacheMisses: 340,
  hitRate: 78.6,
  topKeys: ['key1', 'key2'],
  memoryUsage: '2.4 MB',
  keys: 156,
  size: 156
}
```

## Status Response
```javascript
{
  type: 'memory',       // Provider type
  status: 'active',     // Health status
  size: 156,           // Number of entries
  keys: 156,
  ready: true
}
```

## Multiple Instances
```javascript
const sessions = ServiceRegistry.cache('memory', { instanceName: 'sessions' });
const data = ServiceRegistry.cache('redis', { instanceName: 'data', host: 'localhost' });
const files = ServiceRegistry.cache('file', { instanceName: 'persistent' });

// Each independent
await sessions.put('sess:1', {...});
await data.put('data:key', {...});
await files.put('config', {...});
```

## Event Monitoring
```javascript
const emitter = ServiceRegistry.getEventEmitter();

emitter.on('cache:hit', (data) => console.log('Hit:', data.key));
emitter.on('cache:miss', (data) => console.log('Miss:', data.key));
emitter.on('cache:put', (data) => console.log('Put:', data.key));
emitter.on('cache:delete', (data) => console.log('Delete:', data.key));
emitter.on('cache:error', (data) => console.error('Error:', data.error));
```

## Best Practices

1. Set appropriate TTL values (avoid stale data)
2. Monitor hit rate regularly via analytics
3. Use batch operations for multiple keys
4. Implement cache invalidation on data changes
5. Handle errors gracefully with fallbacks
6. Use cloud providers for production environments
7. Secure REST API with authentication
8. Document cache key naming conventions
9. Test offline scenarios for browser apps
10. Track metrics and adjust configuration

## Complete Example
```javascript
const ServiceRegistry = require('noobly-core');
const app = require('express')();
const eventEmitter = new (require('events').EventEmitter)();

ServiceRegistry.initialize(app, eventEmitter, { apiKeys: ['key'] });

const cache = ServiceRegistry.cache('redis', { host: 'localhost' });

app.get('/api/users/:id', async (req, res) => {
  const cached = await cache.get(`user:${req.params.id}`);
  if (cached) return res.json(cached);

  const user = await db.getUser(req.params.id);
  await cache.put(`user:${req.params.id}`, user, 3600000);
  res.json(user);
});

app.post('/api/users/:id', async (req, res) => {
  const user = await db.updateUser(req.params.id, req.body);
  await cache.delete(`user:${req.params.id}`);  // Invalidate
  res.json(user);
});

// Monitor
setInterval(async () => {
  const stats = await cache.getAnalytics();
  console.log(`Hit rate: ${stats.hitRate}%`);
}, 60000);

app.listen(3001);
```

## Browser Example
```html
<script src="/services/caching/scripts"></script>
<script>
  const cache = new nooblyjsCaching();  // Local cache

  // Auto-save form draft
  document.getElementById('form').addEventListener('input', async (e) => {
    const data = new FormData(e.target);
    await cache.put('draft:form', Object.fromEntries(data));
  });

  // Restore draft on load
  window.addEventListener('load', async () => {
    const draft = await cache.get('draft:form');
    if (draft) {
      Object.entries(draft).forEach(([k, v]) => {
        document.querySelector(`[name="${k}"]`).value = v;
      });
    }
  });

  // List cached items
  async function showCacheStatus() {
    const size = await cache.size();
    const keys = await cache.keys();
    console.log(`${size} items cached:`, keys);
  }
</script>
```

## Troubleshooting

```javascript
// Check status
const status = await cache.status();
if (status.status !== 'active') throw new Error('Cache down');

// Check analytics
const stats = await cache.getAnalytics();
if (stats.hitRate < 50) console.warn('Low hit rate');

// Check settings
const settings = await cache.getSettings();
console.log(settings);

// Verify connection
try {
  await cache.put('test', 'value');
  await cache.delete('test');
} catch (err) {
  console.error('Cache unavailable:', err.message);
}
```

---

**For detailed documentation, see: `/docs/usage/nooblyjs-core-caching-usage.md`**
