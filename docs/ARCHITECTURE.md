# Architecture Documentation

This document describes the architecture of Noobly JS Core, a modular Node.js backend framework providing enterprise services with singleton pattern implementation.

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Express Application                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         Middleware Layer                                ││
│  │  ┌──────────────┐  ┌───────────────────┐  ┌────────────────────────┐    ││
│  │  │ Body Parser  │  │ Session/Passport  │  │ API Key Authentication │    ││
│  │  └──────────────┘  └───────────────────┘  └────────────────────────┘    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Service Registry (Singleton)                     ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │                    Event Emitter (Global Bus)                       │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │                    Dependency Graph & Resolution                    │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │                    Service Instance Registry                        │││
│  │  │    Map<"serviceName:providerType:instanceName", ServiceInstance>    │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                           Services (17 total)                           ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            ││
│  │  │ logging │ │ caching │ │  data   │ │workflow │ │   ai    │  ...       ││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘            ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Service Registry Pattern

The `ServiceRegistry` class (`index.js`) is the central orchestrator implementing:

### Singleton Management
```javascript
// Services stored in a Map with composite keys
this.services = new Map();  // key: "serviceName:providerType:instanceName"
```

### Factory Methods
Each service type has a convenience factory method:
```javascript
registry.logger('file')       // -> getService('logging', 'file', {})
registry.cache('redis')       // -> getService('caching', 'redis', {})
registry.dataService('mongodb') // -> getService('dataservice', 'mongodb', {})
```

### Multi-Instance Support
Services can have multiple named instances:
```javascript
const sessionCache = registry.cache('redis', { instanceName: 'session-cache' });
const dataCache = registry.cache('redis', { instanceName: 'data-cache' });
```

## Dependency Injection System

### Dependency Hierarchy (5 Levels)

Dependencies are defined in `initializeServiceDependencies()` and form a directed acyclic graph:

```
Level 0 (Foundation)
├── logging          []
└── uiservice        []

Level 1 (Infrastructure)
├── caching          [logging]
├── queueing         [logging]
├── notifying        [logging]
├── appservice       [logging]
└── fetching         [logging]

Level 2 (Business Logic)
├── dataservice      [logging, queueing]
├── working          [logging, queueing, caching]
└── measuring        [logging, queueing, caching]

Level 3 (Application)
├── scheduling       [logging, working]
├── searching        [logging, caching, dataservice, queueing, working, scheduling]
├── workflow         [logging, queueing, scheduling, measuring, working]
└── filing           [logging, queueing, dataservice]

Level 4 (Integration)
├── authservice      [logging, caching, dataservice]
└── aiservice        [logging, caching, workflow, queueing]
```

### Dependency Resolution

When a service is requested, the registry:
1. Checks if instance already exists in the Map
2. Resolves dependencies recursively (topological sort)
3. Creates dependency instances with default providers
4. Injects dependencies via the `options.dependencies` object
5. Creates the requested service with all dependencies available

```javascript
// In service factory (e.g., caching/index.js)
function createCache(type, options, eventEmitter) {
  const { dependencies = {}, ...providerOptions } = options;
  const logger = dependencies.logging;  // Injected dependency
  // ...
}
```

## Service Anatomy

Each service follows a consistent structure:

```
src/{serviceName}/
├── index.js              # Factory function (entry point)
├── routes/
│   └── index.js          # REST API endpoints
├── views/
│   ├── index.js          # View registration
│   ├── index.html        # Dashboard UI
│   └── script.js         # Client-side JavaScript
├── scripts/
│   ├── index.js          # Script registration
│   └── js/index.js       # Client-side library
├── modules/
│   └── analytics.js      # Analytics tracking
└── providers/
    ├── {service}.js      # Default (memory) provider
    ├── {service}Redis.js # Redis provider
    ├── {service}Api.js   # Remote API provider
    └── ...               # Additional providers
```

### Factory Function Pattern

Every service exports a factory function:

```javascript
function createService(type, options, eventEmitter) {
  const { dependencies = {}, ...providerOptions } = options;

  let service;
  switch (type) {
    case 'redis':
      service = new ServiceRedis(providerOptions, eventEmitter);
      break;
    case 'memory':
    default:
      service = new Service(providerOptions, eventEmitter);
      break;
  }

  // Inject dependencies
  service.dependencies = dependencies;
  if (dependencies.logging) {
    service.logger = dependencies.logging;
  }

  // Initialize analytics
  service.analytics = new ServiceAnalytics(eventEmitter, options.instanceName);

  // Register routes and views
  Routes(options, eventEmitter, service);
  Views(options, eventEmitter, service);

  return service;
}

module.exports = createService;
```

### Provider Interface

All providers for a service implement a common interface:

```javascript
class CacheProvider {
  constructor(options, eventEmitter) { }

  async put(key, value) { }
  async get(key) { }
  async delete(key) { }

  getAnalytics() { }
  async getSettings() { }
  async saveSettings(settings) { }
}
```

## Request Flow

### HTTP Request Lifecycle

```
Client Request
     │
     ▼
┌─────────────────┐
│  Express App    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                   Middleware Chain                       │
│  ┌───────────┐  ┌──────────┐  ┌─────────────────────┐  │
│  │bodyParser │→ │ session  │→ │ apiKeyAuth (if req) │  │
│  └───────────┘  └──────────┘  └─────────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           Service Route Handler                          │
│  /services/{serviceName}/api/{operation}                 │
│                                                          │
│  1. Extract parameters from request                      │
│  2. Get service instance (from registry or default)      │
│  3. Call provider method                                 │
│  4. Emit event for analytics                             │
│  5. Return JSON response                                 │
└─────────────────────────────────────────────────────────┘
```

### Service Call Flow

```
Application Code
     │
     │  registry.cache('redis', { instanceName: 'api-cache' })
     ▼
┌─────────────────────────────────────────────────────────┐
│                   ServiceRegistry                        │
│                                                          │
│  1. Check Map for "caching:redis:api-cache"             │
│  2. If not found:                                        │
│     a. Resolve dependencies (logging)                    │
│     b. Load factory: require('./src/caching')           │
│     c. Call factory(type, mergedOptions, eventEmitter)  │
│     d. Store in Map                                      │
│  3. Return service instance                              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Service Instance                        │
│                                                          │
│  cache.put('key', value)                                │
│     │                                                    │
│     ├─► Provider.put()    (actual storage)              │
│     ├─► trackOperation()  (analytics)                   │
│     └─► eventEmitter.emit('cache:put:api-cache', {...}) │
└─────────────────────────────────────────────────────────┘
```

## Event-Driven Architecture

### Global Event Emitter

All services share a global EventEmitter for:
- Inter-service communication
- Analytics tracking
- Lifecycle notifications
- Debugging and monitoring

### Event Naming Conventions

```
{service}:{operation}:{instanceName}   # Service operations
  cache:put:default
  cache:get:api-cache
  log:info:default

{service}:created                      # Lifecycle events
workflow:defined
workflow:start
workflow:complete
workflow:error

api-auth-setup                         # System events
api-auth-warning
dependencies:initialized
```

### Event Flow Example

```
┌──────────────┐     emit('cache:put:default')      ┌─────────────────┐
│ CacheService │ ──────────────────────────────────►│  EventEmitter   │
└──────────────┘                                    └────────┬────────┘
                                                             │
                    ┌────────────────────────────────────────┼────────────────────────────────────────┐
                    │                                        │                                        │
                    ▼                                        ▼                                        ▼
           ┌───────────────┐                      ┌───────────────────┐                    ┌─────────────────┐
           │CacheAnalytics │                      │ LoggingService    │                    │ CustomListener  │
           │ (stats track) │                      │ (audit logging)   │                    │ (app-specific)  │
           └───────────────┘                      └───────────────────┘                    └─────────────────┘
```

## Security Architecture

### Authentication Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Security Middleware                                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    API Key Authentication                            │   │
│  │  • Header: x-api-key, Authorization: Bearer, ApiKey                 │   │
│  │  • Query: ?apiKey=...                                                │   │
│  │  • Configurable exclude paths (e.g., /status endpoints)             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Services Authentication                           │   │
│  │  • Session-based login for UI dashboards                            │   │
│  │  • Passport.js integration (local, Google OAuth)                    │   │
│  │  • Configurable via security.servicesAuth.requireLogin              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Middleware Chain Setup

```javascript
// In ServiceRegistry.initialize()
this.authMiddleware = createApiKeyAuthMiddleware({
  apiKeys,
  requireApiKey,
  excludePaths
}, eventEmitter);

this.servicesAuthMiddleware = createServicesAuthMiddleware(this);

// Route protection
app.get('/services/', this.servicesAuthMiddleware, handler);
app.post('/services/caching/api/put/:key', authMiddleware, handler);
```

## Data Flow Patterns

### Provider Abstraction

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Service Consumer                                     │
│                                                                             │
│  const dataService = registry.dataService('mongodb');                       │
│  await dataService.create('users', { name: 'John' });                       │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     │ Unified Interface
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DataService Factory                                  │
│                                                                             │
│  switch(type) {                                                             │
│    case 'mongodb':  return new DataServiceMongoDB(...)                      │
│    case 'file':     return new DataServiceFiles(...)                        │
│    case 'memory':   return new DataService(...)                             │
│  }                                                                          │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
     ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
     │   MongoDB       │   │   File System   │   │   In-Memory     │
     │   Provider      │   │   Provider      │   │   Provider      │
     └─────────────────┘   └─────────────────┘   └─────────────────┘
```

### Workflow Execution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Workflow Service                                     │
│                                                                             │
│  1. defineWorkflow('order', [step1.js, step2.js, step3.js])                │
│  2. runWorkflow('order', { orderId: 123 })                                 │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Sequential Step Execution                               │
│                                                                             │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐                              │
│  │ Step 1  │ ──► │ Step 2  │ ──► │ Step 3  │                              │
│  │validate │     │ charge  │     │ notify  │                              │
│  └────┬────┘     └────┬────┘     └────┬────┘                              │
│       │               │               │                                     │
│       │ emit          │ emit          │ emit                               │
│       ▼               ▼               ▼                                     │
│  workflow:step:start/end for each step                                     │
│  workflow:complete when finished                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Uses Working Service
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Working Service                                      │
│                                                                             │
│  Executes each step file in isolation with data passing                    │
│  Handles timeouts, retries, and error reporting                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## REST API Structure

### URL Pattern
```
/services/{serviceName}/api/{operation}[/{instanceName}][/{parameters}]
```

### Standard Endpoints

Every service typically exposes:

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/services/{service}/api/status` | GET | No | Health check |
| `/services/{service}/api/analytics` | GET | Yes | Service metrics |
| `/services/{service}/api/settings` | GET | Yes | Configuration |
| `/services/{service}/api/settings` | POST | Yes | Update config |
| `/services/{service}/api/instances` | GET | Yes | List instances |

### Service-Specific Examples

```
# Caching
POST /services/caching/api/put/:key
GET  /services/caching/api/get/:key
DELETE /services/caching/api/delete/:key
GET  /services/caching/api/:instanceName/get/:key  # Named instance

# DataService
GET  /services/dataservice/api/:collection
POST /services/dataservice/api/:collection
GET  /services/dataservice/api/:collection/:id
PUT  /services/dataservice/api/:collection/:id
DELETE /services/dataservice/api/:collection/:id

# Workflow
POST /services/workflow/api/define
POST /services/workflow/api/run/:workflowName
GET  /services/workflow/api/definitions
GET  /services/workflow/api/executions/:workflowName
```

## UI Dashboard Architecture

### Dashboard Structure

Each service provides a web dashboard at `/services/{serviceName}/`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Service Dashboard                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Tab Navigation: Dashboard | UI | Data | Settings                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌───────────────┐  ┌─────────────────────────────────────────────────┐   │
│  │               │  │                                                   │   │
│  │  Left Nav     │  │  Main Content Area                               │   │
│  │  (Items List) │  │  (Operations, Forms, Results)                    │   │
│  │               │  │                                                   │   │
│  │  - Search     │  │                                                   │   │
│  │  - Item 1     │  │                                                   │   │
│  │  - Item 2     │  │                                                   │   │
│  │  - Item 3     │  │                                                   │   │
│  │               │  │                                                   │   │
│  └───────────────┘  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Static File Serving

```javascript
// In views/index.js
app.use('/services/{serviceName}', express.static(path.join(__dirname)));

// Files served:
// /services/caching/             -> views/index.html
// /services/caching/script.js    -> views/script.js
// /services/caching/styles.css   -> views/styles.css
```

## Monitoring & Observability

### System Monitoring

```javascript
// Endpoints provided by ServiceRegistry
GET /services/api/monitoring/metrics   // CPU, memory, uptime
GET /services/api/monitoring/snapshot  // Current system state
```

### Service Analytics

Each service tracks its own analytics:

```javascript
// Analytics module pattern
class ServiceAnalytics {
  constructor(eventEmitter, instanceName) {
    // Subscribe to service events
    eventEmitter.on(`service:operation:${instanceName}`, this.track.bind(this));
  }

  getStats() { }
  getTimeline(count) { }
  getHitDistribution(count) { }
}
```

## Extension Points

### Adding a New Service

1. Create service directory: `src/newservice/`
2. Implement factory function: `src/newservice/index.js`
3. Add providers: `src/newservice/providers/`
4. Register routes: `src/newservice/routes/index.js`
5. Add views: `src/newservice/views/`
6. Define dependencies in `index.js:initializeServiceDependencies()`
7. Add factory method in `ServiceRegistry` class

### Adding a New Provider

1. Create provider class implementing service interface
2. Add case in factory switch statement
3. Export from providers directory if needed
4. Add tests in `tests/unit/{service}/`

### Custom Middleware

```javascript
// Add custom middleware before service initialization
app.use('/services/*', customMiddleware);

// Or configure via options
serviceRegistry.initialize(app, eventEmitter, {
  security: {
    apiKeyAuth: { /* custom config */ },
    servicesAuth: { /* custom config */ }
  }
});
```
