# ServiceRegistry (`index.js`)

The ServiceRegistry is the backbone of the entire framework. It is exported as a **singleton** (`module.exports = new ServiceRegistry()`) and must be initialized once before any service is retrieved.

---

## Initialization

```javascript
const serviceRegistry = require('./index');
const eventEmitter = new EventEmitter();

serviceRegistry.initialize(app, eventEmitter, {
  logDir: './logs',
  dataDir: './data',
  apiKeys: ['key1', 'key2'],
  requireApiKey: true,
  excludePaths: ['/services/*/status', '/services/authservice/api/login']
});
```

### `initialize(expressApp, eventEmitter, globalOptions)`

Called once at application startup. Idempotent – subsequent calls are ignored.

**What it does:**
1. Stores the Express app and EventEmitter.
2. Normalizes security configuration (API key auth, services login auth).
3. Calls `initializeServiceDependencies()` to build the dependency graph.
4. Creates API key authentication middleware via `createApiKeyAuthMiddleware()` if keys are provided.
5. Creates services-level auth middleware via `createServicesAuthMiddleware()`.
6. Mounts the service registry landing page at `GET /services/`.
7. Mounts static file serving for `/services/`.
8. Adds system monitoring endpoints at `/services/api/monitoring/metrics` and `/services/api/monitoring/snapshot`.
9. Sets `this.initialized = true`.

**Security config normalization:**

| `globalOptions` field | Final location | Notes |
|---|---|---|
| `apiKeys` | `security.apiKeyAuth.apiKeys` | Also preserved at top-level |
| `requireApiKey` | `security.apiKeyAuth.requireApiKey` | Defaults to `true` if keys provided |
| `excludePaths` | `security.apiKeyAuth.excludePaths` | Only set if explicitly provided |
| `security.servicesAuth.requireLogin` | unchanged | Defaults to `true` |

---

## Dependency Graph

### `initializeServiceDependencies()`

Runs once (guarded by `this.dependenciesInitialized`). Populates `this.serviceDependencies` (a `Map<string, string[]>`):

```
logging      → []
uiservice    → []
caching      → ['logging']
queueing     → ['logging']
notifying    → ['logging']
appservice   → ['logging']
fetching     → ['logging']
dataservice  → ['logging', 'queueing']
working      → ['logging', 'queueing', 'caching']
measuring    → ['logging', 'queueing', 'caching']
scheduling   → ['logging', 'working']
searching    → ['logging', 'caching', 'dataservice', 'queueing', 'working', 'scheduling']
workflow     → ['logging', 'queueing', 'scheduling', 'measuring', 'working']
filing       → ['logging', 'queueing', 'dataservice']
authservice  → ['logging', 'caching', 'dataservice']
aiservice    → ['logging', 'caching', 'workflow', 'queueing']
```

Emits `dependencies:initialized` on completion.

---

## Service Lifecycle

### `getService(serviceName, providerType, options)` → `Object`

The central method for obtaining a service instance.

**Algorithm:**
1. Validates registry is initialized.
2. Constructs a cache key: `"serviceName:providerType:instanceName"` (instanceName defaults to `'default'`).
3. Returns cached instance from `this.services` (Map) if it exists.
4. Calls `resolveDependencies(serviceName)` to build an object of dependency instances, creating them recursively if not yet instantiated.
5. Merges `globalOptions + serviceOptions + { dependencies, instanceName, ServiceRegistry, providerType }`.
6. Calls `require('./src/<serviceName>')` and invokes the factory function with `(providerType, mergedOptions, eventEmitter)`.
7. Stores result in `this.services` Map.
8. Emits `service:created`.

### `resolveDependencies(serviceName, requestedProviderType)` → `Object`

Iterates over the dependency list for `serviceName`. For each dependency:
- If already in `this.services`, returns the cached instance.
- Otherwise calls `getService(depName, defaultProviderType)` recursively.

Returns a plain object `{ depName: serviceInstance, ... }`.

### `getDefaultProviderType(serviceName)` → `string`

| Service | Default provider |
|---|---|
| logging | `'memory'` |
| filing | `'local'` |
| measuring | `'memory'` |
| caching | `'memory'` |
| dataservice | `'memory'` |
| working | `'memory'` |
| queueing | `'memory'` |
| scheduling | `'memory'` |
| searching | `'memory'` |
| workflow | `'memory'` |
| notifying | `'memory'` |
| authservice | `'file'` |
| aiservice | `'claude'` |
| fetching | `'node'` |
| uiservice | `'default'` |

---

## Validation

### `validateDependencies()` → `boolean`

Runs a topological sort via `getServiceInitializationOrder()`. Throws if circular dependencies exist.

### `getServiceInitializationOrder()` → `string[]`

DFS-based topological sort of the dependency graph. Throws `Error` on circular dependency. Used internally for validation.

---

## Factory Shorthand Methods

All delegate to `getService()`:

| Method | Service name | Default provider |
|---|---|---|
| `cache(type, opts)` | `'caching'` | `'memory'` |
| `logger(type, opts)` | `'logging'` | `'memory'` |
| `uiservice(type, opts)` | `'uiservice'` | `'default'` |
| `dataService(type, opts)` | `'dataservice'` | `'memory'` |
| `filing(type, opts)` | `'filing'` | `'local'` |
| `filer(type, opts)` | `'filing'` | `'local'` (alias) |
| `measuring(type, opts)` | `'measuring'` | `'memory'` |
| `notifying(type, opts)` | `'notifying'` | `'memory'` |
| `queue(type, opts)` | `'queueing'` | `'memory'` |
| `scheduling(type, opts)` | `'scheduling'` | `'memory'` |
| `searching(type, opts)` | `'searching'` | `'memory'` |
| `workflow(type, opts)` | `'workflow'` | `'memory'` |
| `working(type, opts)` | `'working'` | `'memory'` |
| `fetching(type, opts)` | `'fetching'` | `'node'` |
| `aiservice(type, opts)` | `'aiservice'` | `'claude'` |
| `authservice(type, opts)` | `'authservice'` | `'file'` (special: returns any existing instance if no type given) |
| `appservice(type, opts)` | `'appservice'` | — |

---

## Instance Management

### `getServiceInstance(serviceName, providerType, instanceName)` → `Object|null`

Retrieves an already-created named instance without creating a new one.

```javascript
const redisCache = registry.getServiceInstance('caching', 'redis', 'session-cache');
```

### `listServices()` → `string[]`

Returns all registered service keys in the format `"serviceName:providerType:instanceName"`.

### `listInstances(serviceName)` → `Array<{ serviceName, providerType, instanceName, key }>`

Returns all instances of a given service.

### `reset()`

Clears all service instances and resets `initialized` to `false`. Used in testing.

### `resetService(serviceName)` → `number`

Removes all instances of a service. Returns the count of instances removed.

### `resetServiceInstance(serviceName, providerType, instanceName)` → `boolean`

Removes a specific named instance. Returns `true` if the key existed.

---

## Utility

### `generateApiKey(length)` → `string`

Delegates to the auth middleware's `generateApiKey` helper. Default length: 32.

### `getEventEmitter()` → `EventEmitter`

Returns the shared global event emitter.

---

## Monitoring Routes (Auto-mounted)

| Route | Auth | Response |
|---|---|---|
| `GET /services/api/monitoring/metrics` | servicesAuth | `systemMonitoring.getMetrics()` |
| `GET /services/api/monitoring/snapshot` | servicesAuth | `systemMonitoring.getCurrentSnapshot()` |

---

## Multi-Instance Example

```javascript
// Create two named Redis cache instances
const sessionCache = registry.getService('caching', 'redis', {
  instanceName: 'session',
  host: 'redis-session.internal'
});

const apiCache = registry.getService('caching', 'redis', {
  instanceName: 'api',
  host: 'redis-api.internal'
});

// Keys: 'caching:redis:session' and 'caching:redis:api'
registry.listServices();
// → ['caching:redis:session', 'caching:redis:api']
```
