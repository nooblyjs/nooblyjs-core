# Caching Service (`src/caching/`)

**Dependency level:** 1 – Infrastructure
**Dependencies:** `logging`

Provides a key-value cache with multiple backend options. Used by many higher-level services for performance optimization.

---

## Factory (`src/caching/index.js`)

```javascript
const cache = registry.cache('memory');
const redisCache = registry.cache('redis', { instanceName: 'session', host: 'redis.internal' });
```

### `createCache(type, options, eventEmitter)` → cache instance

| `type` value | Provider class | Backend |
|---|---|---|
| `'memory'` (default) | `Cache` | JavaScript object (in-process) |
| `'redis'` | `CacheRedis` | Redis server |
| `'memcached'` | `CacheMemcached` | Memcached server |
| `'file'` | `CacheFile` | Local filesystem |
| `'api'` | `CacheApi` | Remote HTTP cache API |
| `'aws'` | via `cachingAWS.js` | AWS ElastiCache |
| `'azure'` | via `cachingAzure.js` | Azure Cache for Redis |
| `'gcp'` | via `cachingGCP.js` | GCP Memorystore |

**After creating the provider:**
1. Injects `logger` and adds `cache.log(level, message, meta)` helper.
2. Attaches `cache.dependencies`.
3. Creates `CacheAnalytics` instance attached to `cache.analytics`.
4. Registers REST routes, dashboard view, and client-side scripts.

---

## Memory Provider (`src/caching/providers/caching.js`)

Class: `Cache`

### Constructor

```javascript
new Cache(options, eventEmitter)
```

- `this.cache_` – plain object used as key-value store.
- `this.analytics_` – `Map` with up to 100 LRU entries tracking key hit counts.
- `this.instanceName_` – from `options.instanceName` or `'default'`.

### Core Methods

#### `async put(key, value)` → `void`

Stores a value. Validates:
- `key` must be a non-empty string.
- `value` must not be `undefined`.

Emits: `cache:put:<instanceName>` with `{ key, value, instance }`

Throws: `Error` if validation fails (also emits `cache:validation-error:<instanceName>`).

#### `async get(key)` → `value | undefined`

Retrieves a value. Validates `key` is a non-empty string.

Returns `undefined` if not found.

Emits: `cache:get:<instanceName>` with `{ key, value, instance }`

#### `async delete(key)` → `void`

Removes a key. Validates `key` is a non-empty string.

Emits: `cache:delete:<instanceName>` with `{ key, instance }`

#### `getAnalytics()` → `Array<{ key, hits, lastHit }>`

Returns analytics for all tracked keys. Each entry has:
- `key` – the cache key
- `hits` – number of get/put operations
- `lastHit` – ISO timestamp of last access

### Analytics Internals

- `trackOperation_(key)` – records a hit or creates a new entry.
- `removeLeastRecentlyUsed_()` – evicts the oldest entry when the 100-entry limit is reached.

### Settings

No configurable settings for the memory provider (empty settings list).

---

## Redis Provider (`src/caching/providers/cachingRedis.js`)

Wraps the `redis` npm package. Connects to a Redis server for distributed caching.

**Key options:** `host`, `port`, `password`, `db`, `tls`

---

## Memcached Provider (`src/caching/providers/cachingMemcached.js`)

Wraps the `memcached` npm package. Suitable for simple distributed caching.

**Key options:** `servers` (array of `host:port` strings), `options`

---

## File Provider (`src/caching/providers/cachingFile.js`)

Stores cache entries as JSON files on disk. Slower than in-memory but survives process restarts.

**Key options:** `cacheDir`

---

## Cloud Providers

### AWS ElastiCache (`src/caching/providers/cachingAWS.js`)

Additional method: `detectClusterMode()` → `{ mode, endpoint, port, region, tlsEnabled }`

### Azure Cache for Redis (`src/caching/providers/cachingAzure.js`)

Additional method: `detectCacheTier()` → `{ tier, estimatedTier, maxMemory, usedMemory, resourceGroup, resourceName }`

### GCP Memorystore (`src/caching/providers/cachingGCP.js`)

Additional method: `detectMemorystoreConfig()` → `{ tier, estimatedTier, memorySizeGb, projectId, region, instanceId, network }`

---

## Analytics (`src/caching/modules/analytics.js`)

Listens to cache events and tracks:
- Total operations
- Hit rate
- Most-accessed keys

---

## Routes

Mounted at `/services/caching/api/`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/services/caching/api/status` | Service status |
| `GET` | `/services/caching/api/analytics` | Cache analytics and hit stats |
| `GET` | `/services/caching/api/get/:key` | Get a cached value |
| `POST` | `/services/caching/api/put` | Store a value (`{ key, value }`) |
| `DELETE` | `/services/caching/api/delete/:key` | Delete a cached entry |
| `POST` | `/services/caching/api/settings` | Update settings |

---

## Client-Side Script (`src/caching/scripts/js/index.js`)

A browser-loadable JavaScript class for interacting with the cache API from front-end code.

---

## Usage

```javascript
// Store
await cache.put('user:42', { name: 'Alice', role: 'admin' });

// Retrieve
const user = await cache.get('user:42');

// Delete
await cache.delete('user:42');

// Analytics
const stats = cache.analytics.getAnalytics();
```
