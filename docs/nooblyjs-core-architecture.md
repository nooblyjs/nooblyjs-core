# NooblyJS Core - Architecture Guide

**Version:** 1.0.14+
**Last Updated:** 2024-11-04

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Design Patterns](#core-design-patterns)
3. [Service Hierarchy](#service-hierarchy)
4. [Dependency Injection](#dependency-injection)
5. [Provider Architecture](#provider-architecture)
6. [REST API Architecture](#rest-api-architecture)
7. [Security Architecture](#security-architecture)
8. [Event System](#event-system)
9. [Directory Structure](#directory-structure)
10. [Data Flow](#data-flow)
11. [Performance](#performance)
12. [Scalability](#scalability)

---

## System Overview

NooblyJS Core is a modular, service-oriented backend framework built on Node.js and Express. It provides a unified way to access 14 enterprise-grade services through a centralized Service Registry.

### Key Characteristics

- **Modular**: Each service is self-contained with clear interfaces
- **Pluggable**: Multiple provider implementations per service
- **Declarative**: Service dependencies managed automatically
- **Extensible**: Easy to add new services or providers
- **Observable**: Built-in analytics and event system
- **Secure**: Multi-layer authentication and authorization
- **Testable**: Designed for isolated unit and integration testing

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Express Application                          │
│                         (app.js or custom)                          │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │    ServiceRegistry (Singleton)│
                    │  - Manages all services       │
                    │  - Handles initialization     │
                    │  - Routes API requests        │
                    └───────────────────────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
                ▼                   ▼                   ▼
          ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
          │  Service 1   │   │  Service 2   │   │ Service N... │
          │(e.g., Cache) │   │(e.g., Data)  │   │              │
          └──────────────┘   └──────────────┘   └──────────────┘
                │                   │                   │
                ▼                   ▼                   ▼
          ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
          │ Providers    │   │ Providers    │   │ Providers    │
          │ (memory,     │   │ (memory,     │   │ (memory,     │
          │  redis,      │   │  file,       │   │  api, ...)   │
          │  api, ...)   │   │  mongodb)    │   │              │
          └──────────────┘   └──────────────┘   └──────────────┘
                │                   │                   │
                ▼                   ▼                   ▼
          External Systems: Redis, MongoDB, S3, Anthropic API, etc.
```

---

## Core Design Patterns

### 1. Singleton Pattern

**ServiceRegistry** and certain services (Working, Scheduling) are singletons:

```javascript
// Only one instance exists throughout the application
const serviceRegistry = require('noobly-core');
const reg1 = serviceRegistry;
const reg2 = require('noobly-core');
// reg1 === reg2  (same instance)
```

**Benefits:**
- Consistent state across the application
- Single point of configuration
- Reduced memory overhead
- Centralized service management

### 2. Factory Pattern

Each service exports a factory function that creates instances:

```javascript
// src/caching/index.js
module.exports = (dependencies) => {
  return {
    async put(key, value, ttl) { ... },
    async get(key) { ... },
    async delete(key) { ... }
  };
};
```

**Benefits:**
- Consistent creation process
- Easy to add new providers
- Dependency injection at creation
- Service composition

### 3. Dependency Injection

Services receive their dependencies automatically via constructor injection:

```javascript
// src/workflow/index.js receives its dependencies
module.exports = ({
  logging,           // Level 0
  queueing,          // Level 1
  scheduling,        // Level 3
  measuring,         // Level 2
  working            // Level 2
}) => {
  // All dependencies automatically injected
  // Can use them in methods
};
```

**Hierarchy Ensures:**
- No circular dependencies possible
- Correct initialization order
- Clear dependency graph
- Automatic resource cleanup

### 4. Provider Pattern

Each service supports multiple backends with identical APIs:

```javascript
// Development: use memory
const cache = serviceRegistry.cache('memory');

// Production: switch to Redis without changing app code
const cache = serviceRegistry.cache('redis', {host: 'redis.prod.com'});

// Same API:
await cache.put('key', value, ttl);
const data = await cache.get('key');
```

**Benefits:**
- Easy environment switching (dev → staging → prod)
- Provider-specific optimizations
- Progressive enhancement (start with memory, add Redis later)
- Testing with mock providers

### 5. Event-Driven Architecture

Services communicate via global EventEmitter:

```javascript
const eventEmitter = serviceRegistry.getEventEmitter();

// Services emit events
eventEmitter.emit('cache:put', {key, value, ttl});
eventEmitter.emit('ai:usage', {tokens, cost});

// Other services listen
eventEmitter.on('cache:put', (data) => {
  console.log('Cache updated:', data.key);
});
```

**Benefits:**
- Loose coupling between services
- Easy to add monitoring
- Services don't need to know about each other
- Custom business logic via event handlers

---

## Service Hierarchy

Services are organized in a **4-level dependency hierarchy** ensuring no circular dependencies and proper initialization order:

### Level 0: Foundation (No Dependencies)

```
Logging
└─ Application logging with multiple output targets
```

### Level 1: Infrastructure (Depend on Foundation)

```
├─ Caching       (depends on: Logging)
├─ Filing        (depends on: Logging)
├─ Queueing      (depends on: Logging)
├─ Fetching      (depends on: Logging)
└─ App Service   (depends on: Logging)
```

### Level 2: Business Logic (Depend on Infrastructure)

```
├─ DataService   (depends on: Logging, Filing)
├─ Working       (depends on: Logging, Queueing, Caching)
└─ Measuring     (depends on: Logging, Queueing, Caching)
```

### Level 3: Application (Depend on Business Logic)

```
├─ Scheduling    (depends on: Logging, Working)
├─ Searching     (depends on: Logging, Caching, DataService, Queueing, Working, Scheduling)
└─ Workflow      (depends on: Logging, Queueing, Scheduling, Measuring, Working)
```

### Level 4: Integration (Depend on Application)

```
├─ Notifying     (depends on: Logging, Queueing, Scheduling)
├─ Auth Service  (depends on: Logging, Caching, DataService)
└─ AI Service    (depends on: Logging, Caching, Workflow, Queueing)
```

**Topological Sorting:**
The registry uses topological sort to determine initialization order, ensuring all dependencies are available before a service initializes.

---

## Dependency Injection

### How It Works

1. **Service Request**: When you call `serviceRegistry.cache('memory')`, the registry:
   - Checks if this service:provider combination already exists (singleton)
   - If not, determines all dependencies using the hierarchy
   - Initializes dependencies in correct order
   - Creates service with dependencies passed in

2. **Automatic Resolution**: Dependencies are resolved automatically:

```javascript
// You request searching service
const searching = serviceRegistry.searching('memory');

// Registry automatically initializes:
// 1. Logging (Level 0)
// 2. Caching, Filing, Queueing (Level 1)
// 3. DataService, Working, Measuring (Level 2)
// 4. Scheduling (Level 3, required by Searching)
// 5. Searching (Level 3)
// And passes all required services to Searching constructor
```

3. **Circular Dependency Prevention**: The 4-level hierarchy makes circular dependencies impossible.

### Dependency Map

```javascript
{
  logging: {level: 0, dependsOn: []},
  caching: {level: 1, dependsOn: ['logging']},
  filing: {level: 1, dependsOn: ['logging']},
  queueing: {level: 1, dependsOn: ['logging']},
  fetching: {level: 1, dependsOn: ['logging']},
  dataservice: {level: 2, dependsOn: ['logging', 'filing']},
  working: {level: 2, dependsOn: ['logging', 'queueing', 'caching']},
  measuring: {level: 2, dependsOn: ['logging', 'queueing', 'caching']},
  scheduling: {level: 3, dependsOn: ['logging', 'working']},
  searching: {level: 3, dependsOn: ['logging', 'caching', 'dataservice', 'queueing', 'working', 'scheduling']},
  workflow: {level: 3, dependsOn: ['logging', 'queueing', 'scheduling', 'measuring', 'working']},
  notifying: {level: 4, dependsOn: ['logging', 'queueing', 'scheduling']},
  authservice: {level: 4, dependsOn: ['logging', 'caching', 'dataservice']},
  aiservice: {level: 4, dependsOn: ['logging', 'caching', 'workflow', 'queueing']}
}
```

---

## Provider Architecture

Each service can have multiple provider implementations. Providers are selected at runtime:

### Provider Selection

```javascript
// Provider specified in second parameter
const cache = serviceRegistry.cache('redis', options);
const dataService = serviceRegistry.dataService('mongodb', options);
const filing = serviceRegistry.filing('s3', options);

// Default provider if not specified
const cache = serviceRegistry.cache('memory');
```

### Provider Locations

All providers follow the same pattern:

```
src/{service}/providers/
├── memory.js     # In-memory provider
├── redis.js      # Redis provider
├── file.js       # File system provider
├── mongodb.js    # MongoDB provider
└── api.js        # Remote API provider
```

### Provider Interface

Every provider must implement the same methods as the service:

```javascript
// src/caching/providers/redis.js
module.exports = (options) => {
  // Initialize Redis client
  const redis = require('redis').createClient(options);

  return {
    async put(key, value, ttl) {
      // Redis-specific implementation
    },
    async get(key) {
      // Redis-specific implementation
    },
    // ... other methods
    getAnalytics() {
      // Return provider-specific metrics
    }
  };
};
```

### Available Providers by Service

| Service | Providers |
|---------|-----------|
| Logging | memory, file, api |
| Caching | memory, inmemory, redis, memcached, file, api |
| Filing | local, ftp, s3, git, gcp, sync, api |
| Queueing | memory, api |
| DataService | memory, file, mongodb, documentdb, simpledb, api |
| Fetching | node, axios, api |
| Working | memory, api |
| Measuring | memory, api |
| Scheduling | memory |
| Searching | memory, file, api |
| Workflow | memory, api |
| Notifying | memory, api |
| Auth Service | memory, file, passport, google, api |
| AI Service | claude, chatgpt, ollama, api |

---

## REST API Architecture

### Route Structure

All services automatically expose REST endpoints:

```
/services/{service}/api/{operation}
```

### Route Registration

Each service registers its routes via `src/{service}/routes/index.js`:

```javascript
// src/caching/routes/index.js
module.exports = (express, service, prefix, middleware) => {
  const router = express.Router();

  // GET /services/caching/api/get/:key
  router.get('/get/:key', middleware.apiKeyCheck, async (req, res) => {
    try {
      const value = await service.get(req.params.key);
      res.json({success: true, data: value});
    } catch (error) {
      res.status(404).json({error: error.message});
    }
  });

  return router;
};
```

### API Registration Flow

1. **Initialization**: `serviceRegistry.initialize(app)`
2. **Service Creation**: Services are created on-demand
3. **Route Mounting**: Routes automatically mounted to Express app
4. **Middleware Integration**: Authentication middleware applied
5. **Error Handling**: Consistent error response format

### Authentication Layers

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────┐
│  API Key Authentication Middleware  │
│  (Check x-api-key header, etc.)     │
│  (Bypass if in excludePaths)        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Service UI Authentication          │
│  (Session + Passport for /services/ │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Service Handler                     │
│  (Execute service method)            │
└─────────────────────────────────────┘
    │
    ▼
HTTP Response
```

---

## Security Architecture

### 3-Layer Authentication

#### Layer 1: API Key Authentication
- **Where**: Protects `/services/*/api/*` endpoints
- **How**: Validates header or query parameter
- **Methods**: x-api-key, Authorization header, query param
- **Config**: `apiKeys` and `requireApiKey` options

```javascript
// Configure
serviceRegistry.initialize(app, null, {
  apiKeys: ['production-key-1', 'production-key-2'],
  requireApiKey: true,
  excludePaths: ['/health', '/services/*/status']
});

// Use
fetch('/services/caching/api/get/mykey', {
  headers: {'x-api-key': 'production-key-1'}
});
```

#### Layer 2: Session Authentication
- **Where**: Protects service UI at `/services/`
- **How**: Express session + Passport
- **Storage**: Memory or configured session store
- **Users**: Created and managed by Auth Service

```javascript
// Set up before initialization
app.use(session({...}));
app.use(passport.initialize());
app.use(passport.session());

// Auth service handles login/logout
const auth = serviceRegistry.authservice('file');
const {configurePassport} = auth.passportConfigurator(auth.getAuthStrategy);
configurePassport(passport);
```

#### Layer 3: User Authorization (RBAC)
- **Where**: Within Auth Service
- **How**: Role-based access control
- **Roles**: admin, user, custom roles
- **OAuth**: Google OAuth 2.0 support

```javascript
// Check user role
if (req.user.role === 'admin') {
  // Admin-only operation
}

// Or use auth service methods
const admins = await auth.getUsersInRole('admin');
```

### Security Best Practices

1. **Always use API keys in production**
2. **Use environment variables for credentials**
3. **Exclude public paths from API key requirement**
4. **Enable HTTPS in production**
5. **Use strong session secrets**
6. **Regularly rotate API keys**
7. **Monitor authentication events**

---

## Event System

### Global EventEmitter

Services emit events that other services can listen to:

```javascript
const eventEmitter = serviceRegistry.getEventEmitter();

// Services emit events
eventEmitter.emit('cache:put', {key: 'user:123', ttl: 3600});
eventEmitter.emit('ai:usage', {tokens: 1500, cost: 0.015});

// Applications can listen
eventEmitter.on('cache:put', (data) => {
  console.log('Cache updated:', data.key);
  // Custom business logic
});
```

### Common Events

| Event | Data | Service |
|-------|------|---------|
| cache:put | {key, value, ttl} | Caching |
| cache:get | {key, hit} | Caching |
| ai:usage | {tokens, cost} | AI Service |
| data:added | {container, uuid} | DataService |
| workflow:complete | {name, result} | Workflow |
| task:complete | {taskId, result} | Working |

### Event Patterns

```javascript
const eventEmitter = serviceRegistry.getEventEmitter();

// Listen to specific event
eventEmitter.on('cache:put', (data) => { ... });

// Listen to all events of a service
eventEmitter.on('cache:*', (data) => { ... });

// Listen to all events (debugging)
eventEmitter.on('*', (event, data) => { ... });

// Emit custom events
eventEmitter.emit('custom:event', {data: 'value'});
```

---

## Directory Structure

```
nooblyjs-core/
├── index.js                    # ServiceRegistry (main export)
├── app.js                      # Example application
├── package.json
├── README.md                   # User documentation
├── CLAUDE.md                   # Development guidance
├── LICENSE
│
├── src/                        # All services
│   ├── {service}/
│   │   ├── index.js           # Factory function
│   │   ├── providers/         # Multiple implementations
│   │   │   ├── memory.js
│   │   │   ├── redis.js
│   │   │   ├── file.js
│   │   │   ├── mongodb.js
│   │   │   └── api.js
│   │   ├── routes/            # Express routes
│   │   │   └── index.js
│   │   └── views/             # Optional UI
│   │       └── index.js
│   │
│   ├── logging/               # Level 0
│   ├── caching/               # Level 1
│   ├── filing/
│   ├── queueing/
│   ├── fetching/
│   ├── appservice/
│   ├── dataservice/           # Level 2
│   ├── working/
│   ├── measuring/
│   ├── scheduling/            # Level 3
│   ├── searching/
│   ├── workflow/
│   ├── notifying/             # Level 4
│   ├── authservice/
│   ├── aiservice/
│   │
│   └── views/                 # Centralized UI
│       ├── index.js           # Main dashboard
│       └── modules/
│           ├── monitoring.js
│           └── ...
│
├── tests/                      # Test suite
│   ├── unit/                  # Jest tests by service
│   │   ├── caching.test.js
│   │   ├── dataservice.test.js
│   │   └── ...
│   ├── load/                  # Load testing
│   ├── api/                   # API test files
│   └── app-*.js               # Example applications
│
├── docs/                       # Documentation
│   ├── nooblyjs-core-architecture.md
│   ├── nooblyjs-core-usage-guide.md
│   └── nooblyjs-core-usage-guide-concise.md
│
└── .noobly-core/              # Runtime data
    ├── logs/                  # Log files
    └── data/                  # Persistent data
```

---

## Data Flow

### Request Flow

```
1. HTTP Request arrives at Express
   └─ POST /services/caching/api/put/mykey

2. ServiceRegistry routes request to service route handler
   └─ src/caching/routes/index.js

3. Route handler checks authentication
   └─ API key validation

4. Route handler calls service method
   └─ await caching.put('mykey', value, ttl)

5. Service calls provider implementation
   └─ Redis provider stores in Redis

6. Service emits event
   └─ eventEmitter.emit('cache:put', {...})

7. Response sent to client
   └─ HTTP 200 with result
```

### Service Initialization Flow

```
1. Application calls serviceRegistry.initialize(app)
   └─ Registry marks itself as initialized

2. Application calls serviceRegistry.cache('redis', options)
   └─ Registry checks if 'cache:redis' singleton exists

3. If not exists:
   a. Determine cache's dependencies: [logging]
   b. Initialize dependencies:
      i. Create logging service (Level 0)
   c. Create cache provider
      i. Require redis.js provider file
      ii. Pass options to provider factory
   d. Store as singleton in services Map

4. Return cache service instance
   └─ Application can now use cache methods
```

### Dependency Resolution Flow

```
Request: searchService = registry.searching('memory')

1. Check if 'searching:memory' singleton exists
   └─ If yes, return cached instance

2. If not, resolve dependencies:
   a. Logging (Level 0) - no deps
   b. Caching (Level 1) - depends on logging
   c. Filing (Level 1) - depends on logging
   d. Queueing (Level 1) - depends on logging
   e. DataService (Level 2) - depends on logging, filing
   f. Working (Level 2) - depends on logging, queueing, caching
   g. Scheduling (Level 3) - depends on logging, working
   h. Searching (Level 3) - depends on all above

3. Initialize each in order, storing each as singleton

4. Pass dependencies to Searching factory
   └─ searching factory function receives:
      {logging, caching, dataservice, queueing, working, scheduling, ...}

5. Return Searching instance
```

---

## Performance

### Optimization Strategies

#### Caching with Redis
- Use Redis for distributed caching across multiple processes
- Cache frequently accessed data with appropriate TTL
- Implement cache-aside pattern for databases

#### Connection Pooling
- Redis and MongoDB providers use connection pools
- Reuse connections instead of creating new ones
- Configured via provider options

#### In-Memory Analytics
- Services track metrics in memory
- Lightweight and fast
- Expose via getAnalytics() method

#### Lazy Initialization
- Services only initialized when first requested
- Reduces startup time for applications using subset of services
- All dependencies initialized on-demand

### Performance Metrics

Monitor performance using:
```javascript
const cache = serviceRegistry.cache('redis');
const analytics = cache.getAnalytics();
// {
//   hitCount: 1500,
//   missCount: 250,
//   hitRatio: 0.857,
//   avgAccessTime: 2.3,
//   topKeys: [{key: '...', hits: 100}, ...]
// }
```

---

## Scalability

### Horizontal Scaling

**Stateless Design**: Services can run on multiple processes/machines:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  App Instance 1 │  │  App Instance 2 │  │  App Instance N │
│  (Memory cache) │  │  (Memory cache) │  │  (Memory cache) │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Shared Redis    │ (or other external service)
                    └───────────────────┘
```

### Vertical Scaling

**Provider Selection**:
- Start with memory providers for development
- Add Redis for better performance
- Upgrade to MongoDB for complex queries
- Use S3 for unlimited file storage

### Distributed Architecture

**API Providers** allow frontend apps to consume backend APIs:

```
┌────────────────────┐           ┌────────────────────┐
│  Frontend App 1    │ ─ API ──> │  Backend App       │
│  (memory cache)    │           │  (redis cache)     │
└────────────────────┘           │  (mongodb data)    │
                                 │  (s3 files)       │
┌────────────────────┐           └────────────────────┘
│  Frontend App 2    │ ─ API ──────────┘
│  (memory cache)    │
└────────────────────┘
```

---

## Summary

NooblyJS Core provides:

1. **Modular Architecture**: 14 independent services
2. **Flexible Providers**: Multiple backend implementations
3. **Automatic Dependencies**: Declarative dependency injection
4. **Secure by Default**: 3-layer authentication
5. **Observable**: Event system and analytics
6. **Scalable**: Horizontal and vertical scaling support
7. **Extensible**: Easy to add services or providers
8. **Tested**: Comprehensive test suite included

The architecture supports everything from simple monolithic applications to complex distributed microservices systems.
