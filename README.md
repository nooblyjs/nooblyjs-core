# NooblyJS Core

**Version:** 1.0.14+
**License:** ISC
**Repository:** https://github.com/nooblyjs/nooblyjs-core
**Package:** `noobly-core` on npm

---

## Overview

**NooblyJS Core** is a comprehensive, modular Node.js backend framework providing **14 enterprise-grade services** through a unified Service Registry architecture. Built for scalability and flexibility, it supports multiple provider backends (memory, Redis, MongoDB, S3, Claude AI, etc.) and enables both monolithic and distributed microservices architectures.

**Key Features:**
- 🏗️ **Service Registry Pattern** - Singleton services with automatic dependency injection
- 🔌 **Pluggable Providers** - Switch between memory, Redis, S3, MongoDB, and more
- 🌐 **Enterprise API Architecture** - Remote service consumption for distributed systems
- 🔐 **Built-in Security** - API key authentication, session management, RBAC, OAuth 2.0
- 📊 **Real-time Analytics** - Built-in monitoring and metrics for services
- 🎨 **Web Dashboards** - Service management UIs at `/services/`
- 🤖 **AI Integration** - Claude 3.5, GPT-4, and Ollama support with token tracking
- 📝 **Auto-generated APIs** - RESTful endpoints for all services
- 🔄 **4-Level Dependency Hierarchy** - Automatic service dependency resolution
- 🧪 **Comprehensive Testing** - Unit, load, and API tests included

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [All 14 Services](#all-14-services)
- [Service Providers](#service-providers)
- [Enterprise Architecture](#enterprise-architecture)
- [REST APIs](#rest-apis)
- [Development](#development)
- [Configuration](#configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Installation

```bash
# Install from npm
npm install noobly-core

# Or clone and run the example application
git clone https://github.com/nooblyjs/nooblyjs-core.git
cd nooblyjs-core
npm install
npm start  # Runs on http://localhost:3001
```

---

## Quick Start

### Minimal Setup

```javascript
const express = require('express');
const serviceRegistry = require('noobly-core');

const app = express();
app.use(express.json());

// STEP 1: Initialize the service registry (REQUIRED FIRST)
serviceRegistry.initialize(app);

// STEP 2: Get services you need
const cache = serviceRegistry.cache('memory');
const logger = serviceRegistry.logger('file', { logDir: './logs' });
const dataService = serviceRegistry.dataService('memory');

// STEP 3: Use services
async function demo() {
  // Caching example
  await cache.put('user:123', { name: 'John' }, 3600);
  const user = await cache.get('user:123');
  logger.info('User:', user);

  // DataService example
  const uuid = await dataService.add('users', { name: 'Jane', status: 'active' });
  logger.info('Created user:', uuid);
}

app.listen(3000, () => {
  logger.info('Server running on port 3000');
  demo();
});
```

### Production Setup with Security

```javascript
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const serviceRegistry = require('noobly-core');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup session and passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

// Initialize with security
const apiKeys = (process.env.NOOBLY_API_KEYS || '').split(',').filter(Boolean);
serviceRegistry.initialize(app, null, {
  logDir: './.noobly-core/logs',
  dataDir: './.noobly-core/data',
  apiKeys: apiKeys,
  requireApiKey: apiKeys.length > 0,
  excludePaths: ['/services/*/status', '/services/', '/public/*']
});

const logger = serviceRegistry.logger('file');
const authservice = serviceRegistry.authservice('file');
const { configurePassport } = authservice.passportConfigurator(authservice.getAuthStrategy);
configurePassport(passport);

app.listen(3000, () => {
  logger.info('Server running on port 3000');
  logger.info('Dashboard: http://localhost:3000/services/');
});
```

---

## All 14 Services

NooblyJS Core provides these 14 services organized in a 4-level dependency hierarchy:

### Level 0: Foundation (No Dependencies)

| Service | Method | Providers | Purpose |
|---------|--------|-----------|---------|
| **Logging** | `serviceRegistry.logger(provider, options)` | `memory`, `file`, `api` | Application logging with levels |

### Level 1: Infrastructure (Depend on Logging)

| Service | Method | Providers | Purpose |
|---------|--------|-----------|---------|
| **Caching** | `serviceRegistry.cache(provider, options)` | `memory`, `inmemory`, `redis`, `memcached`, `file`, `api` | High-performance key-value caching with TTL |
| **Filing** | `serviceRegistry.filing(provider, options)` | `local`, `ftp`, `s3`, `git`, `gcp`, `sync`, `api` | File upload/download/management |
| **Queueing** | `serviceRegistry.queue(provider, options)` | `memory`, `api` | FIFO task queue management |
| **Fetching** | `serviceRegistry.fetching(provider, options)` | `node`, `axios`, `api` | HTTP fetching with caching and deduplication |
| **App Service** | `serviceRegistry.appservice(type, options)` | `basic` | Auto-load application structure from src/ directories |

### Level 2: Business Logic (Depend on Infrastructure)

| Service | Method | Providers | Purpose |
|---------|--------|-----------|---------|
| **DataService** | `serviceRegistry.dataService(provider, options)` | `memory`, `file`, `mongodb`, `documentdb`, `simpledb`, `api` | UUID-based JSON document storage with search |
| **Working** | `serviceRegistry.working(provider, options)` | `memory`, `api` | Background task execution with worker threads |
| **Measuring** | `serviceRegistry.measuring(provider, options)` | `memory`, `api` | Metrics collection and aggregation |

### Level 3: Application (Depend on Business Logic)

| Service | Method | Providers | Purpose |
|---------|--------|-----------|---------|
| **Scheduling** | `serviceRegistry.scheduling(provider, options)` | `memory` | Cron-like task scheduling |
| **Searching** | `serviceRegistry.searching(provider, options)` | `memory`, `file`, `api` | Full-text search and indexing |
| **Workflow** | `serviceRegistry.workflow(provider, options)` | `memory`, `api` | Multi-step workflow orchestration |

### Level 4: Integration (Depend on Application)

| Service | Method | Providers | Purpose |
|---------|--------|-----------|---------|
| **Notifying** | `serviceRegistry.notifying(provider, options)` | `memory`, `api` | Pub/sub messaging system |
| **Auth Service** | `serviceRegistry.authservice(provider, options)` | `memory`, `file`, `passport`, `google`, `api` | User authentication, RBAC, OAuth 2.0 |
| **AI Service** | `serviceRegistry.aiservice(provider, options)` | `claude`, `chatgpt`, `ollama`, `api` | LLM integration with token tracking |

---

## Service Providers

### Caching Service Providers

```javascript
// Memory (development)
const cache = serviceRegistry.cache('memory');

// Redis (production distributed)
const cache = serviceRegistry.cache('redis', {
  host: 'localhost',
  port: 6379,
  password: 'secret',
  keyPrefix: 'myapp:'
});

// Memcached
const cache = serviceRegistry.cache('memcached', {
  servers: ['localhost:11211']
});

// File-based
const cache = serviceRegistry.cache('file', {
  dataDir: './.noobly-core/cache'
});

// Remote API
const cache = serviceRegistry.cache('api', {
  apiRoot: 'https://backend.example.com',
  apiKey: process.env.BACKEND_API_KEY
});
```

### DataService Providers

```javascript
// Memory
const dataService = serviceRegistry.dataService('memory');

// File-based (JSON files in containers)
const dataService = serviceRegistry.dataService('file', {
  dataDir: './.noobly-core/data'
});

// MongoDB
const dataService = serviceRegistry.dataService('mongodb', {
  connectionString: 'mongodb://localhost:27017',
  database: 'myapp'
});

// AWS DocumentDB
const dataService = serviceRegistry.dataService('documentdb', {
  connectionString: 'mongodb+srv://...',
  database: 'myapp'
});

// AWS SimpleDB
const dataService = serviceRegistry.dataService('simpledb', {
  region: 'us-east-1',
  domain: 'myapp'
});

// Remote API
const dataService = serviceRegistry.dataService('api', {
  apiRoot: 'https://backend.example.com',
  apiKey: process.env.BACKEND_API_KEY
});
```

### Filing Service Providers

```javascript
// Local filesystem
const filing = serviceRegistry.filing('local', {
  dataDir: './uploads'
});

// AWS S3
const filing = serviceRegistry.filing('s3', {
  bucket: 'my-bucket',
  region: 'us-east-1',
  accessKeyId: process.env.AWS_KEY,
  secretAccessKey: process.env.AWS_SECRET
});

// Google Cloud Storage
const filing = serviceRegistry.filing('gcp', {
  projectId: 'my-project',
  bucket: 'my-bucket',
  keyFilename: process.env.GCP_KEY_FILE
});

// FTP
const filing = serviceRegistry.filing('ftp', {
  host: 'ftp.example.com',
  user: 'username',
  password: 'password'
});

// Git repository
const filing = serviceRegistry.filing('git', {
  repoPath: '/path/to/repo',
  basePath: 'files/'
});

// Remote API
const filing = serviceRegistry.filing('api', {
  apiRoot: 'https://backend.example.com',
  apiKey: process.env.BACKEND_API_KEY
});
```

### AI Service Providers

```javascript
// Claude (Anthropic)
const ai = serviceRegistry.aiservice('claude', {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  tokensStorePath: './.noobly-core/ai-tokens.json'
});

// ChatGPT (OpenAI)
const ai = serviceRegistry.aiservice('chatgpt', {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4'
});

// Ollama (Local)
const ai = serviceRegistry.aiservice('ollama', {
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2'
});

// Remote API
const ai = serviceRegistry.aiservice('api', {
  apiRoot: 'https://backend.example.com',
  apiKey: process.env.BACKEND_API_KEY
});
```

### Auth Service Providers

```javascript
// File-based (development/production)
const auth = serviceRegistry.authservice('file', {
  dataDir: './.noobly-core/data'
});

// Memory (development only)
const auth = serviceRegistry.authservice('memory', {
  createDefaultAdmin: true  // admin:admin123, user:user123
});

// Passport Local
const auth = serviceRegistry.authservice('passport', {
  strategy: 'local'
});

// Google OAuth 2.0
const auth = serviceRegistry.authservice('google', {
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
});

// Remote API
const auth = serviceRegistry.authservice('api', {
  apiRoot: 'https://backend.example.com',
  apiKey: process.env.BACKEND_API_KEY
});
```

---

## Enterprise Architecture

NooblyJS Core supports distributed architectures where frontend applications consume backend service APIs.

### Backend Server

```javascript
const express = require('express');
const serviceRegistry = require('noobly-core');

const app = express();
app.use(express.json());

// Initialize with real providers
serviceRegistry.initialize(app, null, {
  apiKeys: [process.env.API_KEY],
  requireApiKey: true
});

// Use production providers
const cache = serviceRegistry.cache('redis', {
  host: process.env.REDIS_HOST
});

const dataService = serviceRegistry.dataService('mongodb', {
  connectionString: process.env.MONGODB_URI
});

const filing = serviceRegistry.filing('s3', {
  bucket: process.env.S3_BUCKET,
  region: process.env.AWS_REGION
});

// All APIs automatically exposed at /services/{service}/api/*
app.listen(3000);
```

### Frontend Client

```javascript
const express = require('express');
const serviceRegistry = require('noobly-core');

const app = express();
app.use(express.json());

// Initialize without exposing services
serviceRegistry.initialize(app, null, {
  exposeServices: false
});

// Use API providers to connect to backend
const cache = serviceRegistry.cache('api', {
  apiRoot: 'https://backend.example.com',
  apiKey: process.env.BACKEND_API_KEY
});

const dataService = serviceRegistry.dataService('api', {
  apiRoot: 'https://backend.example.com',
  apiKey: process.env.BACKEND_API_KEY
});

// Use services transparently - calls go to backend
app.get('/api/user/:id', async (req, res) => {
  try {
    const user = await cache.get(`user:${req.params.id}`);
    if (!user) {
      const userData = await dataService.getByUuid('users', req.params.id);
      await cache.put(`user:${req.params.id}`, userData, 3600);
      return res.json(userData);
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(4000);
```

---

## REST APIs

All services expose RESTful APIs under `/services/{service}/api/*`.

### Authentication Methods

```bash
# Method 1: x-api-key header (recommended)
curl -H "x-api-key: YOUR_KEY" http://localhost:3001/services/caching/api/get/mykey

# Method 2: Authorization Bearer
curl -H "Authorization: Bearer YOUR_KEY" http://localhost:3001/...

# Method 3: Query parameter
curl "http://localhost:3001/services/caching/api/get/mykey?api_key=YOUR_KEY"

# Method 4: api-key header
curl -H "api-key: YOUR_KEY" http://localhost:3001/...

# Method 5: Authorization ApiKey
curl -H "Authorization: ApiKey YOUR_KEY" http://localhost:3001/...
```

### Caching API

```bash
# Store data with TTL
POST /services/caching/api/put/:key
Content-Type: application/json
x-api-key: YOUR_KEY
{"value": {...}, "ttl": 3600}

# Retrieve data
GET /services/caching/api/get/:key
x-api-key: YOUR_KEY

# Delete data
DELETE /services/caching/api/delete/:key
x-api-key: YOUR_KEY

# List all keys with analytics
GET /services/caching/api/list
x-api-key: YOUR_KEY

# Get analytics
GET /services/caching/api/analytics
x-api-key: YOUR_KEY
```

### DataService API

```bash
# Insert document (returns UUID)
POST /services/dataservice/api/:container
Content-Type: application/json
x-api-key: YOUR_KEY
{"name": "John", "email": "john@example.com"}

# Retrieve by UUID
GET /services/dataservice/api/:container/:uuid
x-api-key: YOUR_KEY

# Delete by UUID
DELETE /services/dataservice/api/:container/:uuid
x-api-key: YOUR_KEY

# JSON Search - Custom predicate
POST /services/dataservice/api/jsonFind/:container
{"predicate": "obj.status === 'active'"}

# JSON Search - By path
GET /services/dataservice/api/jsonFindByPath/:container/:path/:value

# JSON Search - Multi-criteria
POST /services/dataservice/api/jsonFindByCriteria/:container
{"status": "active", "profile.role": "developer"}
```

### Filing API

```bash
# Upload file
POST /services/filing/api/upload/:path
Content-Type: multipart/form-data
x-api-key: YOUR_KEY
[file data]

# Download file
GET /services/filing/api/download/:path
x-api-key: YOUR_KEY

# Delete file
DELETE /services/filing/api/remove/:path
x-api-key: YOUR_KEY
```

### Queue API

```bash
# Enqueue task
POST /services/queueing/api/enqueue/:queueName
Content-Type: application/json
x-api-key: YOUR_KEY
{"task": {...}}

# Dequeue task
GET /services/queueing/api/dequeue/:queueName
x-api-key: YOUR_KEY

# Queue size
GET /services/queueing/api/size/:queueName
x-api-key: YOUR_KEY

# List all queues
GET /services/queueing/api/queues
x-api-key: YOUR_KEY
```

### AI Service API

```bash
# Send prompt
POST /services/ai/api/prompt
Content-Type: application/json
x-api-key: YOUR_KEY
{"prompt": "...", "maxTokens": 500, "temperature": 0.7}

# Get analytics
GET /services/ai/api/analytics
x-api-key: YOUR_KEY
```

### Scheduling API

```bash
# Schedule task
POST /services/scheduling/api/schedule
Content-Type: application/json
x-api-key: YOUR_KEY
{"taskName": "backup", "scriptPath": "/path/script.js", "intervalSeconds": 3600}

# Cancel task
DELETE /services/scheduling/api/cancel/:taskName
x-api-key: YOUR_KEY

# Get analytics
GET /services/scheduling/api/analytics
x-api-key: YOUR_KEY
```

### Workflow API

```bash
# Define workflow
POST /services/workflow/api/defineworkflow
Content-Type: application/json
x-api-key: YOUR_KEY
{"name": "myWorkflow", "steps": ["/path/step1.js", "/path/step2.js"]}

# Start execution
POST /services/workflow/api/start
Content-Type: application/json
x-api-key: YOUR_KEY
{"name": "myWorkflow", "data": {...}}
```

---

## Development

### Commands

```bash
# Start main application
npm start

# Start with auto-reload
npm run dev:web

# Run tests
npm test

# Run load tests
npm run test-load

# Kill process on port 3001
npm run kill
```

### Project Structure

```
nooblyjs-core/
├── index.js                    # ServiceRegistry singleton
├── app.js                      # Main application
├── package.json
├── README.md
├── CLAUDE.md                   # Claude Code guidance
├── src/                        # Services organized by service
│   ├── {service}/
│   │   ├── index.js           # Service factory
│   │   ├── providers/         # Provider implementations
│   │   ├── routes/            # Express routes
│   │   └── views/             # UI views (if applicable)
│   └── views/                 # Centralized dashboard
├── tests/                      # Test suite
│   ├── unit/
│   ├── load/
│   ├── api/
│   └── app-*.js
└── .noobly-core/              # Runtime data
    ├── logs/
    └── data/
```

---

## Configuration

### Initialization Options

```javascript
serviceRegistry.initialize(app, eventEmitter, {
  // Logging
  logDir: './.noobly-core/logs',

  // Data persistence
  dataDir: './.noobly-core/data',

  // API Key authentication
  apiKeys: ['key1', 'key2'],
  requireApiKey: true,
  excludePaths: ['/services/*/status', '/public/*'],

  // Security configuration
  security: {
    apiKeyAuth: {
      apiKeys: ['key1'],
      requireApiKey: true,
      excludePaths: ['/health']
    },
    servicesAuth: {
      enabled: true
    }
  }
});
```

### Environment Variables

```bash
# Required
NODE_ENV=production
SESSION_SECRET=your-secret-here
NOOBLY_API_KEYS=key1,key2,key3

# Optional - Services
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret

# AI Services
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OLLAMA_URL=http://localhost:11434

# AWS Services
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=my-bucket
AWS_REGION=us-east-1

# Google Services
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=...
```

---

## Testing

```bash
# Run all tests
npm test

# Run specific test
npm test -- service-name

# Run load tests
npm run test-load

# Run with coverage
npm test -- --coverage
```

Test files are located in:
- `tests/unit/` - Jest unit tests
- `tests/load/` - Load testing scripts
- `tests/api/` - API test files for REST clients

---

## Troubleshooting

### ServiceRegistry Not Initialized
- Ensure `serviceRegistry.initialize(app)` is called **before** getting services
- Check that Express app is passed correctly

### Cache Not Working
- Verify Redis connection if using redis provider
- Check TTL values are set appropriately
- Confirm data isn't exceeding size limits

### DataService Issues
- Ensure container name is specified in all operations
- Check that file permissions are correct for file-based provider
- Verify MongoDB connection string if using MongoDB provider

### API Key Authentication Errors
- Check API key is in apiKeys array
- Verify key is passed in correct header/parameter
- Check path isn't in excludePaths

### AI Service Errors
- Confirm API keys are set in constructor options
- Check token limits aren't exceeded
- Verify network connectivity to AI provider

### File Upload Failures
- Ensure base directory exists for local provider
- Check S3 credentials and bucket permissions
- Verify file size limits

---

## Web Interface

Access the service management dashboard at: `http://localhost:3001/services/`

The dashboard provides:
- Overview of all services
- Individual service management UIs
- API testing interfaces
- Analytics and metrics
- Service status monitoring

---

## Documentation

- **Comprehensive Guide**: See `docs/nooblyjs-core-usage-guide.md`
- **Architecture Guide**: See `docs/nooblyjs-core-architecture.md`
- **Concise Reference**: See `docs/nooblyjs-core-usage-guide-concise.md`
- **Example Apps**: See `tests/app-*.js` for working examples

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Create a feature branch
2. Make your changes
3. Add tests for new functionality
4. Submit a pull request

---

## License

ISC License - See LICENSE file for details

---

## Support

- **GitHub Issues**: https://github.com/nooblyjs/nooblyjs-core/issues
- **Documentation**: https://github.com/nooblyjs/nooblyjs-core#readme
- **NPM Package**: https://www.npmjs.com/package/noobly-core
