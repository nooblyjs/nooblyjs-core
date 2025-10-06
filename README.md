# nooblyjs-core

## Overview

**nooblyjs-core** is a modular Node.js backend framework providing a comprehensive suite of core services for building scalable, event-driven applications. It implements a service registry pattern with singleton services and abstracts common backend concerns through pluggable providers.

**Key Features:**
- **Service Registry Architecture** - Centralized service management with singleton pattern
- **Pluggable Providers** - Multiple implementation options for each service (memory, Redis, S3, file system, etc.)
- **Enterprise API Providers** - ⭐ **NEW!** All services support remote backend APIs for distributed architectures
- **Event-Driven Communication** - Global EventEmitter for inter-service communication
- **RESTful APIs** - Consistent REST endpoints for all services
- **Multiple UI Themes** - 5 different UI design implementations (glass, flat, material, minimalist, shadcn)
- **Comprehensive Testing** - Unit tests, load tests, and API tests included
- **JSDoc Documentation** - Auto-generated documentation
- **Docker Support** - Containerized deployment ready

The project is designed for extensibility and rapid prototyping, making it suitable for microservices, serverless functions, and traditional server applications.

## Exposed APIs

The following RESTful APIs are exposed via the various service modules:

### Caching
- `POST   /api/caching/put/:key` — Store a value in the cache.
- `GET    /api/caching/get/:key` — Retrieve a value from the cache.
- `DELETE /api/caching/delete/:key` — Remove a value from the cache.
- `GET    /api/caching/status` — Get cache service status.

### Data Serving
- `POST   /api/dataservice/put/:key` — Store a value in the data store.
- `GET    /api/dataservice/get/:key` — Retrieve a value from the data store.
- `DELETE /api/dataservice/delete/:key` — Remove a value from the data store.
- `GET    /api/dataservice/status` — Get data service status.

### Filing (File Management)
- `POST   /api/filing/upload/:key` — Upload a file.
- `GET    /api/filing/download/:key` — Download a file.
- `DELETE /api/filing/remove/:key` — Remove a file.
- `GET    /api/filing/status` — Get filing service status.

### Logging
- `POST   /api/logging/log` — Log a message.
- `GET    /api/logging/status` — Get logging service status.

### Measuring
- `POST   /api/measuring/measure` — Record a measurement.
- `GET    /api/measuring/status` — Get measuring service status.

### Notifying
- `POST   /api/notifying/send` — Send a notification.
- `GET    /api/notifying/status` — Get notification service status.

### Queueing
- `POST   /api/queueing/enqueue` — Add an item to the queue.
- `GET    /api/queueing/dequeue` — Remove and return the next item from the queue.
- `GET    /api/queueing/size` — Get the current queue size.
- `GET    /api/queueing/status` — Get queue service status.

### Scheduling
- `POST   /api/scheduling/schedule` — Schedule a new task.
- `DELETE /api/scheduling/cancel/:taskId` — Cancel a scheduled task.
- `GET    /api/scheduling/status` — Get scheduler status.

### Searching
- `POST   /api/searching/add/` — Add a searchable object.
- `DELETE /api/searching/delete/:key` — Remove a searchable object.
- `GET    /api/searching/search/:term` — Search for objects.
- `GET    /api/searching/status` — Get search service status.

### Workflow
- `POST   /api/workflow/defineworkflow` — Define a new workflow.
- `POST   /api/workflow/start` — Start a workflow.
- `GET    /api/workflow/status` — Get workflow service status.

### Working (Background Tasks)
- `POST   /api/working/run` — Run a background task.
- `GET    /api/working/stop` — Stop the running task.
- `GET    /api/working/status` — Get worker status.

### Authentication
- `POST   /api/authservice/register` — Register a new user account.
- `POST   /api/authservice/login` — Authenticate user and create session.
- `POST   /api/authservice/logout` — Logout user and invalidate session.
- `POST   /api/authservice/validate` — Validate session token.
- `GET    /api/authservice/users` — List all users (admin only).
- `GET    /api/authservice/users/:username` — Get specific user info.
- `PUT    /api/authservice/users/:username` — Update user information.
- `DELETE /api/authservice/users/:username` — Delete user account.
- `POST   /api/authservice/users/:username/role` — Assign role to user.
- `GET    /api/authservice/roles` — List all available roles.
- `GET    /api/authservice/roles/:role/users` — Get users in specific role.
- `GET    /api/authservice/status` — Get authentication service status.
- `GET    /api/authservice/google` — Initiate Google OAuth flow.
- `GET    /api/authservice/google/callback` — Handle Google OAuth callback.

---

Each API is designed to be stateless and can be integrated independently. For more details on request/response formats and provider configuration, see the documentation in the `docs/` folder.

## Core Services & Providers

### 🗃️ Caching Service
**Purpose:** High-performance data caching with analytics
**Providers:**
- `memory` - In-memory cache with LRU eviction
- `redis` - Redis-backed distributed cache with analytics
- `memcached` - Memcached-backed cache
- `api` - **Remote backend API** (Enterprise Architecture)

**Features:** Analytics tracking, hit/miss statistics, automatic eviction

### 📊 Data Serving Service
**Purpose:** Persistent key-value data storage
**Providers:**
- `memory` - In-memory data store
- `simpledb` - SimpleDB integration
- `file` - File system-based storage
- `mongodb` - MongoDB database
- `documentdb` - AWS DocumentDB
- `api` - **Remote backend API** (Enterprise Architecture)

**Features:** CRUD operations, data persistence, simple query capabilities

### 📁 Filing Service
**Purpose:** File upload, download, and management
**Providers:**
- `local` - Local file system storage
- `ftp` - FTP server integration
- `s3` - AWS S3 cloud storage
- `git` - Git repository storage
- `gcp` - Google Cloud Platform storage
- `sync` - Synchronized file storage
- `api` - **Remote backend API** (Enterprise Architecture)

**Features:** File operations, metadata handling, cloud storage integration

### 📝 Logging Service
**Purpose:** Application logging and monitoring
**Providers:**
- `console` - Console output logging
- `file` - File-based logging with rotation
- `api` - **Remote backend API** (Enterprise Architecture)

**Features:** Multiple log levels, structured logging, file rotation

### 📈 Measuring Service
**Purpose:** Metrics collection and aggregation
**Providers:**
- `memory` - In-memory metrics storage

**Features:** Time-series data, aggregation functions, date range queries

### 🔔 Notifying Service
**Purpose:** Pub/sub messaging and notifications
**Providers:**
- `memory` - In-memory pub/sub system

**Features:** Topic-based messaging, multiple subscribers, event broadcasting

### 🚀 Queueing Service
**Purpose:** Task queuing and background job processing
**Providers:**
- `memory` - In-memory FIFO queue (InMemoryQueue)

**Features:** FIFO processing, queue size monitoring, async task handling

### ⏰ Scheduling Service
**Purpose:** Cron-like task scheduling
**Providers:**
- `memory` - In-memory scheduler

**Features:** Delayed execution, recurring tasks, callback handling

### 🔍 Searching Service
**Purpose:** Full-text search and indexing
**Providers:**
- `memory` - In-memory search index

**Features:** Object indexing, text search, query capabilities

### 🔄 Workflow Service
**Purpose:** Multi-step workflow orchestration
**Providers:**
- `memory` - In-memory workflow engine

**Features:** Step-based workflows, worker threads, error handling, parallel execution

### ⚙️ Working Service
**Purpose:** Background task execution
**Providers:**
- `memory` - In-memory worker system

**Features:** Script execution, worker management, task lifecycle management

### 🔐 Authentication Service
**Purpose:** User authentication and authorization
**Providers:**
- `memory` - In-memory user storage with default admin/user accounts
- `passport` - Passport.js local strategy integration
- `google` - Google OAuth 2.0 authentication

**Features:** User registration/login, session management, role-based access control, password hashing, token validation, OAuth integration

---

## 🏢 Enterprise Architecture with API Providers

**NEW in v1.0.14:** All services now support the `'api'` provider type, enabling enterprise client-server architectures.

### What are API Providers?

API providers allow your frontend applications to consume remote backend service APIs instead of using local providers. This enables:

- **Microservices Architecture** - Separate frontend and backend services
- **Distributed Systems** - Scale services independently
- **Security** - Keep sensitive data and operations on the backend
- **Load Balancing** - Multiple clients can share backend resources
- **Flexibility** - Switch between local and remote services easily

### Quick Example

**Backend Server** (hosts actual services):
```javascript
const serviceRegistry = require('noobly-core');
const app = express();

serviceRegistry.initialize(app, {
  apiKeys: ['your-api-key'],
  requireApiKey: true
});

// Use real providers (Redis, MongoDB, S3, etc.)
const cache = serviceRegistry.cache('redis', {
  host: 'localhost',
  port: 6379
});
```

**Frontend Client** (consumes APIs):
```javascript
const serviceRegistry = require('noobly-core');
const app = express();

serviceRegistry.initialize(app, {
  exposeServices: false  // Client mode
});

// Use API provider to connect to backend
const cache = serviceRegistry.cache('api', {
  apiRoot: 'https://backend.example.com',
  apiKey: 'your-api-key'
});

// Use exactly as before - transparent API calls!
await cache.put('user:123', userData);
const user = await cache.get('user:123');
```

### Supported Services

All 12 core services support API providers:
- ✅ Caching (`api`)
- ✅ Data Service (`api`)
- ✅ Filing (`api`)
- ✅ Logging (`api`)
- ✅ AI Service (`api`)
- ✅ Auth Service (`api`)
- ✅ Measuring (`api`)
- ✅ Notifying (`api`)
- ✅ Queueing (`api`)
- ✅ Searching (`api`)
- ✅ Workflow (`api`)
- ✅ Working (`api`)

### Example Application

See [`tests/examples/api-provider-example.js`](tests/examples/api-provider-example.js) for a complete working example with both backend and frontend.

**Run the example:**
```bash
node tests/examples/api-provider-example.js
```

For comprehensive documentation, see:
- **Usage Guide**: [`docs/nooblyjs-core-usage-guide.md`](docs/nooblyjs-core-usage-guide.md) - Section "Enterprise Architecture with API Providers"
- **Testing Guide**: [`tests/unit/API_PROVIDER_TESTING.md`](tests/unit/API_PROVIDER_TESTING.md) - Complete testing documentation

---

## Installation

Install **nooblyjs-core** via npm:

```bash
npm install noobly-core
```

## Quick Start

```javascript
const express = require('express');
const serviceRegistry = require('noobly-core');

const app = express();

// Initialize the service registry
serviceRegistry.initialize(app);

// Get services with desired providers
const cache = serviceRegistry.cache('redis', { host: 'localhost', port: 6379 });
const logger = serviceRegistry.logger('file', { filename: 'app.log' });
const queue = serviceRegistry.queue('memory');
const auth = serviceRegistry.authservice('memory', { createDefaultAdmin: true });

// Use the services
await cache.put('user:123', { name: 'John', role: 'admin' });
const user = await cache.get('user:123');

logger.info('User retrieved from cache', user);

queue.enqueue({ task: 'sendEmail', userId: 123 });

// Authenticate users
const loginResult = await auth.authenticateUser('admin', 'admin123');
const session = loginResult.session;

app.listen(3000, () => {
  logger.info('Server running on port 3000');
});
```

## Development

Start the development server with sample application:

```bash
npm run dev
```

This starts a server with all services initialized and provides web interfaces at:
- `/` - Glass theme UI (default)
- `/flat` - Flat design UI  
- `/material` - Material design UI
- `/minimalist` - Minimalist UI
- `/shadcn` - Shadcn-inspired UI

## Testing

Run the complete test suite:

```bash
npm test              # Unit tests
npm run test-load     # Load tests
```

API testing files are available in `tests/api/` for manual testing with REST clients.

## Building & Publishing

Build and package the project:

```bash
npm run build
```

This command:
- Generates JSDoc documentation
- Bumps the version number
- Transpiles code with Babel to `dist/`
- Creates an npm package in `package/`
