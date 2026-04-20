# Base Classes (`src/appservice/baseClasses/`)

All custom service implementations in the framework extend one of these five abstract base classes. They provide the foundational wiring for Express integration, dependency access, and the event emitter.

---

## Inheritance Hierarchy

```
appBase
 ├─ appServiceBase   (custom services with a baseUrl)
 ├─ appRouteBase     (custom Express route handlers with a baseUrl)
 ├─ appWorkerBase    (background workers / activities)
 └─ appDataBase      (data layer / repository classes)
```

---

## `appBase` (`baseClasses/appBase.js`)

The root abstract base. All other base classes extend this.

### Constructor: `appBase(type, options, eventEmitter)`

| Parameter | Type | Description |
|---|---|---|
| `type` | `string` | Service type identifier (e.g. `'oauth'`, `'file-store'`) |
| `options` | `Object` | Service configuration (passed through from the factory) |
| `options['express-app']` | `Express` | The Express application instance |
| `options.dependencies` | `Object` | Injected service dependencies (`logging`, `caching`, etc.) |
| `options.instanceName` | `string` | Optional instance name, default `'default'` |
| `eventEmitter` | `EventEmitter` | The global event emitter |

**Assigns:**
- `this.app` – the Express app
- `this.options` – the raw options object
- `this.eventEmitter` – the global event emitter

---

## `appServiceBase` (`baseClasses/appServiceBase.js`)

Use when building a custom service that needs to register routes and views under a base URL.

### Extends: `appBase`

### Constructor: `appServiceBase(type, options, eventEmitter)`

Calls `super()` then:
- Reads `options.baseUrl`.
- Normalizes it by appending a trailing `/` if absent.
- Assigns to `this.baseUrl`.

**Added property:**
- `this.baseUrl` – normalized URL prefix (always ends with `/`)

### Usage Pattern

```javascript
class WikiService extends appServiceBase {
  constructor(type, options, eventEmitter) {
    super(type, options, eventEmitter);
    // this.baseUrl === '/wiki/'
    this.app.get(this.baseUrl + 'page/:id', this.getPage.bind(this));
  }

  async getPage(req, res) {
    const logger = this.options?.dependencies?.logging;
    logger?.info(`[WikiService] Getting page ${req.params.id}`);
    res.json({ page: req.params.id });
  }
}
```

---

## `appRouteBase` (`baseClasses/appRouteBase.js`)

Use when building route handler classes that are separate from the service logic (e.g. controller objects).

### Extends: `appBase`

### Constructor: `appRouteBase(type, options, eventEmitter)`

Identical to `appServiceBase` – calls `super()` then normalizes `options.baseUrl` into `this.baseUrl`.

**Added property:**
- `this.baseUrl` – normalized URL prefix

### Usage Pattern

```javascript
class UserRoutes extends appRouteBase {
  constructor(type, options, eventEmitter) {
    super(type, options, eventEmitter);
    this.app.get(this.baseUrl + 'users', this.listUsers.bind(this));
    this.app.post(this.baseUrl + 'users', this.createUser.bind(this));
  }

  async listUsers(req, res) { res.json([]); }
  async createUser(req, res) { res.json({ created: true }); }
}

// Instantiate
new UserRoutes('user-api', {
  'express-app': app,
  baseUrl: '/api',
  dependencies: { logging, dataservice }
}, eventEmitter);
```

---

## `appWorkerBase` (`baseClasses/appWorkerBase.js`)

Use when building background activities executed by the working service.

### Extends: `appBase`

### Constructor: `appWorkerBase(type, options, eventEmitter)`

Calls `super()` then assigns:

| Property | Source | Default |
|---|---|---|
| `this.activityConfig` | `options.activityConfig` | `{}` |
| `this.timeout` | `options.timeout` | `300000` (5 min) |
| `this.maxRetries` | `options.maxRetries` | `3` |

### Abstract Method: `async run(data)` → `Object`

**Must be overridden.** The working service calls this method when executing the activity. Receives the accumulated workflow data, returns a result object.

```javascript
class ProcessOrderActivity extends appWorkerBase {
  async run(data) {
    const { orderId, items } = data;
    const total = items.reduce((sum, i) => sum + i.price, 0);
    return { success: true, orderId, total };
  }
}
```

The activity script at the given file path must export an instance or be consumable by `workerScript.js`.

---

## `appDataBase` (`baseClasses/appDataBase.js`)

Use when building data repository or domain model classes that encapsulate persistence logic.

### Extends: `appBase`

### Constructor: `appDataBase(type, options, eventEmitter)`

Calls `super()` then assigns:

| Property | Source | Default |
|---|---|---|
| `this.containerName` | `options.containerName` | `'default'` |
| `this.schema` | `options.schema` | `undefined` |

### Methods

#### `getDataService()` → `Object|undefined`

Convenience accessor for `this.options?.dependencies?.dataservice`. Returns the injected dataservice instance.

#### `getLogger()` → `Object|undefined`

Convenience accessor for `this.options?.dependencies?.logging`.

### Usage Pattern

```javascript
class UserRepository extends appDataBase {
  constructor(type, options, eventEmitter) {
    super(type, options, eventEmitter);
    this.containerName = options.containerName || 'users';
  }

  async createUser(userData) {
    const ds = this.getDataService();
    const log = this.getLogger();
    const user = { id: Date.now().toString(), ...userData, createdAt: new Date() };
    await ds.add(this.containerName, user);
    log?.info('[UserRepository] User created', { id: user.id });
    return user;
  }

  async findUser(name) {
    return this.getDataService().find(this.containerName, name);
  }
}

const repo = new UserRepository('user-repo', {
  'express-app': app,
  containerName: 'users',
  dependencies: { dataservice, logging }
}, eventEmitter);
```

---

## `appViewBase` (`baseClasses/appViewBase.js`)

A fifth base class for view renderers (serves HTML views for service dashboards).

> File exists at `src/appservice/baseClasses/appViewBase.js` and follows the same pattern as `appServiceBase` with URL normalization. Used internally by each service's `views/index.js`.

---

## Common Patterns Across All Base Classes

1. **Dependency access:** Always use `this.options?.dependencies?.serviceName` to access injected services.
2. **Logging:** Use optional chaining `this.options?.dependencies?.logging?.info(...)` so code runs silently when no logger is present.
3. **Event emission:** Use `this.eventEmitter?.emit('event:name', payload)` for broadcasting events.
4. **No circular dependencies:** Base classes never import from other services. Only the factory/index files wire dependencies together.

---

## Route Utility (`src/appservice/utils/routeUtils.js`)

Provides helper functions shared across route files. Check this file for any URL pattern matching or parameter extraction utilities used by service routes.
