# nooblyjs-core

**Version:** 1.0.9
**License:** ISC
**Repository:** https://github.com/nooblyjs/nooblyjs-core

---

## Overview

**nooblyjs-core** is a comprehensive, modular Node.js backend framework that provides **13 enterprise-grade services** through a unified Service Registry architecture. Built for scalability and flexibility, it supports multiple provider backends (memory, Redis, MongoDB, S3, Claude AI, etc.) and enables both monolithic and distributed microservices architectures.

**Key Features:**
- 🏗️ **Service Registry Pattern** - Singleton services with automatic dependency injection
- 🔌 **Pluggable Providers** - Switch between memory, Redis, S3, MongoDB, and more
- 🌐 **Enterprise API Architecture** - Remote service consumption for distributed systems
- 🔐 **Built-in Security** - API key authentication, session management, RBAC, OAuth 2.0
- 📊 **Real-time Analytics** - Built-in monitoring and metrics for caching and queueing
- 🎨 **Web Dashboards** - Service management UIs with 5 themes
- 🤖 **AI Integration** - Claude 3.5, GPT-4, and Ollama support with token tracking
- 📝 **Auto-generated APIs** - RESTful endpoints for all 13 services
- 🔄 **4-Level Dependency Hierarchy** - Automatic service dependency resolution
- 🧪 **Comprehensive Testing** - Unit, load, and API tests included

The project is designed for extensibility and rapid prototyping, making it suitable for microservices, serverless functions, and traditional server applications.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [All 13 Services](#all-13-services)
- [Core Services & Providers](#core-services--providers)
- [Enterprise Architecture](#enterprise-architecture-with-api-providers)
- [RESTful APIs](#restful-api-endpoints)
- [Development](#development)
- [Testing](#testing)
- [Documentation](#documentation)
- [Contributing](#contributing)
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
  await cache.put('user:123', { name: 'John', email: 'john@example.com' }, 3600);
  const user = await cache.get('user:123');
  logger.info('Retrieved user from cache:', user);

  await dataService.put('users', 'user:123', user);
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

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
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
  excludePaths: [
    '/services/*/status',
    '/services/',
    '/services/authservice/api/login',
    '/services/authservice/api/register'
  ]
});

// Get services with production providers
const cache = serviceRegistry.cache('redis', {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

const dataService = serviceRegistry.dataService('mongodb', {
  connectionString: process.env.MONGODB_URI
});

const filing = serviceRegistry.filing('s3', {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  bucket: process.env.S3_BUCKET
});

const ai = serviceRegistry.aiservice('claude', {
  apiKey: process.env.ANTHROPIC_API_KEY
});

app.listen(3001);
```

---

## All 13 Services

NooblyJS Core provides a complete suite of backend services organized in a 4-level dependency hierarchy:

| Level | Service | Purpose | Key Providers |
|-------|---------|---------|---------------|
| **0** | 📝 Logging | Application logging | memory, file, api |
| **1** | 🗃️ Caching | High-performance caching | memory, redis, memcached, file, api |
| **1** | 📁 Filing | File management | local, ftp, s3, git, gcp, api |
| **1** | 🚀 Queueing | Task queuing | memory, api |
| **2** | 📊 DataService | Key-value storage | memory, mongodb, documentdb, simpledb, file, api |
| **2** | ⚙️ Working | Background tasks | memory, api |
| **2** | 📈 Measuring | Metrics collection | memory, api |
| **3** | ⏰ Scheduling | Task scheduling | memory, api |
| **3** | 🔍 Searching | Full-text search | memory, file, api |
| **3** | 🔄 Workflow | Multi-step workflows | memory, api |
| **4** | 🔔 Notifying | Pub/sub messaging | memory, api |
| **4** | 🔐 AuthService | Authentication | memory, passport, google, file, api |
| **4** | 🤖 AIService | LLM integration | claude, chatgpt, ollama, api |

**Dependency Hierarchy:** Level 0 has no dependencies. Each higher level can depend on services from lower levels. The Service Registry automatically resolves all dependencies.

---

## Core Services & Providers

### Level 0: Foundation

#### 📝 Logging Service
**Purpose:** Application logging and monitoring

**Providers:**
- `memory` - In-memory log storage (development)
- `file` - File-based logging with rotation (production)
- `api` - Remote backend API

**Features:** Multiple log levels (error, warn, info, debug), structured logging, file rotation

```javascript
const logger = serviceRegistry.logger('file', {
  logDir: './logs',
  level: 'info'
});

logger.info('User logged in', { userId: 123, ip: '192.168.1.1' });
logger.error('Database connection failed', { error: err.message });
```

---

### Level 1: Infrastructure

#### 🗃️ Caching Service
**Purpose:** High-performance data caching with analytics

**Providers:**
- `memory` - In-memory cache with LRU eviction
- `redis` - Redis-backed distributed cache with analytics
- `memcached` - Memcached-backed cache
- `file` - File system cache
- `api` - Remote backend API

**Features:** Analytics tracking, hit/miss statistics, TTL, automatic eviction

```javascript
const cache = serviceRegistry.cache('redis', {
  host: 'localhost',
  port: 6379
});

await cache.put('user:123', userData, 3600);  // 1 hour TTL
const user = await cache.get('user:123');
const stats = cache.getAnalytics();  // Hit/miss statistics
```

#### 📁 Filing Service
**Purpose:** File upload, download, and management

**Providers:**
- `local` - Local file system storage
- `ftp` - FTP server integration
- `s3` - AWS S3 cloud storage
- `git` - Git repository storage
- `gcp` - Google Cloud Platform storage
- `api` - Remote backend API

**Features:** File operations, metadata handling, cloud storage integration

```javascript
const filing = serviceRegistry.filing('s3', {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  bucket: 'my-app-files'
});

await filing.upload('users/avatar-123.jpg', fileBuffer, metadata);
const fileData = await filing.download('users/avatar-123.jpg');
```

#### 🚀 Queueing Service
**Purpose:** Task queuing and background job processing

**Providers:**
- `memory` - In-memory FIFO queue
- `api` - Remote backend API

**Features:** FIFO processing, queue size monitoring, async task handling, analytics

```javascript
const queue = serviceRegistry.queue('memory');

queue.enqueue({ task: 'sendEmail', userId: 123, template: 'welcome' });
queue.enqueue({ task: 'generateReport', reportId: 456 });

const job = queue.dequeue();  // { task: 'sendEmail', ... }
const size = queue.size();    // Current queue size
```

---

### Level 2: Business Logic

#### 📊 DataService
**Purpose:** Persistent key-value data storage

**Providers:**
- `memory` - In-memory data store
- `mongodb` - MongoDB database
- `documentdb` - AWS DocumentDB
- `simpledb` - AWS SimpleDB
- `file` - File system-based storage
- `api` - Remote backend API

**Features:** CRUD operations, data persistence, simple query capabilities

```javascript
const dataService = serviceRegistry.dataService('mongodb', {
  connectionString: process.env.MONGODB_URI,
  database: 'myapp'
});

await dataService.put('users', 'user:123', userData);
const user = await dataService.get('users', 'user:123');
const allUsers = await dataService.getAll('users');
```

#### ⚙️ Working Service
**Purpose:** Background task execution with worker threads

**Providers:**
- `memory` - In-memory worker system
- `api` - Remote backend API

**Features:** Script execution, worker management, task lifecycle management

```javascript
const working = serviceRegistry.working('memory');

await working.execute('./tasks/process-data.js', {
  dataFile: 'input.csv',
  outputFile: 'output.json'
});
```

#### 📈 Measuring Service
**Purpose:** Metrics collection and aggregation

**Providers:**
- `memory` - In-memory metrics storage
- `api` - Remote backend API

**Features:** Time-series data, aggregation functions, date range queries

```javascript
const measuring = serviceRegistry.measuring('memory');

measuring.add('api.response_time', 145, { endpoint: '/api/users' });
measuring.add('api.requests', 1, { method: 'GET', status: 200 });

const avgResponseTime = measuring.getAverage('api.response_time');
```

---

### Level 3: Application

#### ⏰ Scheduling Service
**Purpose:** Cron-like task scheduling

**Providers:**
- `memory` - In-memory scheduler
- `api` - Remote backend API

**Features:** Delayed execution, recurring tasks, callback handling

```javascript
const scheduling = serviceRegistry.scheduling('memory');

// Run task every hour
scheduling.start('cleanup', './tasks/cleanup.js', 3600000);

// Run once after 5 minutes
scheduling.start('reminder', './tasks/send-reminder.js', 300000, { once: true });
```

#### 🔍 Searching Service
**Purpose:** Full-text search and indexing

**Providers:**
- `memory` - In-memory search index
- `file` - File-based search index
- `api` - Remote backend API

**Features:** Object indexing, text search, fuzzy matching

```javascript
const searching = serviceRegistry.searching('memory');

await searching.add({ id: 1, title: 'Node.js Guide', content: 'Learn Node.js...' });
await searching.add({ id: 2, title: 'React Tutorial', content: 'Build React apps...' });

const results = await searching.search('Node');  // [{ id: 1, ... }]
```

#### 🔄 Workflow Service
**Purpose:** Multi-step workflow orchestration

**Providers:**
- `memory` - In-memory workflow engine
- `api` - Remote backend API

**Features:** Step-based workflows, worker threads, error handling, parallel execution

```javascript
const workflow = serviceRegistry.workflow('memory');

const myWorkflow = workflow.defineWorkflow('userOnboarding', [
  { script: './workflows/create-account.js' },
  { script: './workflows/send-welcome-email.js' },
  { script: './workflows/setup-preferences.js' }
]);

await workflow.start('userOnboarding', { userId: 123, email: 'user@example.com' });
```

---

### Level 4: Integration

#### 🔔 Notifying Service
**Purpose:** Pub/sub messaging and notifications

**Providers:**
- `memory` - In-memory pub/sub system
- `api` - Remote backend API

**Features:** Topic-based messaging, multiple subscribers, event broadcasting

```javascript
const notifying = serviceRegistry.notifying('memory');

notifying.subscribe('user.created', (data) => {
  console.log('New user created:', data);
});

notifying.publish('user.created', { userId: 123, email: 'user@example.com' });
```

#### 🔐 AuthService
**Purpose:** User authentication and authorization

**Providers:**
- `memory` - In-memory user storage with default admin/user accounts
- `file` - File-based user storage
- `passport` - Passport.js local strategy integration
- `google` - Google OAuth 2.0 authentication
- `api` - Remote backend API

**Features:** User registration/login, session management, RBAC, password hashing, token validation, OAuth

```javascript
const auth = serviceRegistry.authservice('passport', {
  createDefaultAdmin: true
});

// Register new user
await auth.registerUser('john', 'john@example.com', 'securePassword123', ['user']);

// Authenticate
const result = await auth.authenticateUser('john', 'securePassword123');
if (result.success) {
  const session = result.session;
  // User is authenticated
}

// Validate session
const isValid = await auth.validateSession(session.token);
```

#### 🤖 AIService
**Purpose:** Large Language Model (LLM) integration

**Providers:**
- `claude` - Anthropic Claude 3.5 Sonnet
- `chatgpt` - OpenAI GPT-4 and GPT-3.5
- `ollama` - Local Ollama models
- `api` - Remote backend API

**Features:** Token usage tracking, cost estimation, streaming responses, conversation history

```javascript
const ai = serviceRegistry.aiservice('claude', {
  apiKey: process.env.ANTHROPIC_API_KEY
});

const response = await ai.chat([
  { role: 'user', content: 'Explain dependency injection in Node.js' }
]);

console.log(response.content);
console.log('Tokens used:', response.usage.total_tokens);

// Get analytics
const analytics = ai.getPromptAnalytics();
console.log('Total API calls:', analytics.totalCalls);
console.log('Total tokens:', analytics.totalTokens);
```

---

## Enterprise Architecture with API Providers

All 13 services support the `'api'` provider type, enabling enterprise client-server architectures.

### What are API Providers?

API providers allow applications to consume remote backend service APIs instead of using local providers. This enables:

- **Microservices Architecture** - Separate frontend and backend services
- **Distributed Systems** - Scale services independently across servers
- **Security** - Keep sensitive data and operations on the backend
- **Load Balancing** - Multiple clients can share backend resources
- **Flexibility** - Switch between local and remote services easily

### Quick Example

**Backend Server** (hosts actual services):
```javascript
const serviceRegistry = require('noobly-core');
const app = express();

serviceRegistry.initialize(app, null, {
  apiKeys: ['your-secure-api-key'],
  requireApiKey: true
});

// Use real providers (Redis, MongoDB, S3, etc.)
const cache = serviceRegistry.cache('redis', {
  host: 'localhost',
  port: 6379
});

app.listen(3001);  // Backend on port 3001
```

**Frontend Client** (consumes APIs):
```javascript
const serviceRegistry = require('noobly-core');
const app = express();

serviceRegistry.initialize(app, null, {
  exposeServices: false  // Client mode - don't expose APIs
});

// Use API provider to connect to backend
const cache = serviceRegistry.cache('api', {
  apiRoot: 'http://localhost:3001',
  apiKey: 'your-secure-api-key'
});

// Use exactly as before - transparent API calls!
await cache.put('user:123', userData);
const user = await cache.get('user:123');

app.listen(3000);  // Frontend on port 3000
```

### All Services Support API Providers

- ✅ Caching
- ✅ Filing
- ✅ DataService
- ✅ Logging
- ✅ Queueing
- ✅ Working
- ✅ Measuring
- ✅ Scheduling
- ✅ Searching
- ✅ Workflow
- ✅ Notifying
- ✅ AuthService
- ✅ AIService

---

## RESTful API Endpoints

All services expose RESTful APIs at `/services/{service}/api/*`:

### Caching API
- `POST   /services/caching/api/put/:key` - Store value with optional TTL
- `GET    /services/caching/api/get/:key` - Retrieve value
- `DELETE /services/caching/api/delete/:key` - Remove value
- `GET    /services/caching/api/status` - Get service status
- `GET    /services/caching/api/analytics` - Get cache analytics

### DataService API
- `POST   /services/dataservice/api/put` - Store data (body: { container, key, data })
- `GET    /services/dataservice/api/get/:container/:key` - Retrieve data
- `DELETE /services/dataservice/api/delete/:container/:key` - Remove data
- `GET    /services/dataservice/api/getall/:container` - Get all data in container
- `GET    /services/dataservice/api/status` - Get service status

### Filing API
- `POST   /services/filing/api/upload` - Upload file (multipart/form-data)
- `GET    /services/filing/api/download/:key` - Download file
- `DELETE /services/filing/api/remove/:key` - Remove file
- `GET    /services/filing/api/list` - List all files
- `GET    /services/filing/api/status` - Get service status

### Queueing API
- `POST   /services/queueing/api/enqueue` - Add item to queue
- `GET    /services/queueing/api/dequeue` - Remove and return next item
- `GET    /services/queueing/api/size` - Get queue size
- `DELETE /services/queueing/api/clear` - Clear queue
- `GET    /services/queueing/api/status` - Get service status

### AuthService API
- `POST   /services/authservice/api/register` - Register new user
- `POST   /services/authservice/api/login` - Login (creates session)
- `POST   /services/authservice/api/logout` - Logout (invalidates session)
- `POST   /services/authservice/api/validate` - Validate session token
- `GET    /services/authservice/api/users` - List all users (admin only)
- `GET    /services/authservice/api/users/:username` - Get user info
- `PUT    /services/authservice/api/users/:username` - Update user
- `DELETE /services/authservice/api/users/:username` - Delete user
- `POST   /services/authservice/api/users/:username/role` - Assign role
- `GET    /services/authservice/api/roles` - List all roles
- `GET    /services/authservice/api/status` - Get service status
- `GET    /services/authservice/api/google` - Initiate Google OAuth
- `GET    /services/authservice/api/google/callback` - OAuth callback

### AIService API
- `POST   /services/aiservice/api/chat` - Send chat message to LLM
- `GET    /services/aiservice/api/analytics` - Get usage analytics
- `GET    /services/aiservice/api/status` - Get service status

*See full API documentation in [`docs/nooblyjs-core-usage-guide.md`](docs/nooblyjs-core-usage-guide.md)*

---

## Development

### Start Development Server

```bash
npm start         # Start server (port 3001)
npm run dev:web   # Start with nodemon (auto-reload)
```

### Available Web Interfaces

The development server provides web dashboards at:
- `/` - Service management dashboard (default theme)
- `/services/` - Main service management interface
- `/services/{service}/` - Individual service dashboards

Multiple UI themes available for customization

### Development Scripts

```bash
npm start              # Run app.js
npm run dev:web        # Run with nodemon (watches src/)
npm run kill           # Kill process on port 3001
npm run analyze-tokens # Analyze codebase token counts
```

---

## Testing

### Run Tests

```bash
npm test               # Run Jest unit tests
npm run test-load      # Run load tests
```

### Test Organization

- **Unit Tests:** `tests/unit/` - Service-specific tests
- **Load Tests:** `tests-load/` - Performance and stress tests
- **API Tests:** `tests-api/` - Manual API testing with `.http` files
- **Integration Tests:** `tests/integration/` - Cross-service tests

### Test Coverage

All 13 services have comprehensive unit tests covering:
- Provider implementations
- API endpoints
- Dependency injection
- Error handling
- Edge cases

---

## Documentation

### Comprehensive Guides

- **[Usage Guide](docs/nooblyjs-core-usage-guide.md)** - Complete usage documentation for all services
- **[Quick Reference](docs/nooblyjs-core-usage-guide-concise.md)** - Concise guide for developers and AI assistants
- **[Requirements Document](docs/nooblyjs-core-requirements-document.md)** - Product requirements and feature specifications
- **[Dependency Architecture](docs/architecture/nooblyjs-core-dependency-architecture.md)** - Service dependency system and 4-level hierarchy
- **[Enhancement Recommendations](docs/architecture/nooblyjs-core-enhancement-recommendations.md)** - Roadmap and implementation priorities
- **[Refactoring Analysis](docs/refactoring/token-analysis-report.json)** - Code metrics and analysis reports

### Project Documentation

- **[CLAUDE.md](CLAUDE.md)** - AI assistant guidance for this project
- **[README.md](README.md)** - This file

### Analysis & Tooling

```bash
# Run token analysis
npm run analyze-tokens

# View analysis report
cat docs/refactoring/token-analysis-report.json

# View token counts by file
cat token-analysis-report.json
```

---

## Architecture Highlights

### Service Registry Pattern

The ServiceRegistry is a singleton that manages all services with automatic dependency injection:

```javascript
// ServiceRegistry automatically resolves dependencies
const serviceRegistry = require('noobly-core');

// Initialize once
serviceRegistry.initialize(app);

// Get services - dependencies auto-injected
const workflow = serviceRegistry.workflow('memory');
// Workflow automatically gets: logging, queueing, scheduling, measuring, working
```

### 4-Level Dependency Hierarchy

**Level 0 (Foundation):** Logging
**Level 1 (Infrastructure):** Caching, Filing, Queueing
**Level 2 (Business Logic):** DataService, Working, Measuring
**Level 3 (Application):** Scheduling, Searching, Workflow
**Level 4 (Integration):** Notifying, AuthService, AIService

Services can only depend on lower-level services, preventing circular dependencies.

### Provider Pattern

Each service supports multiple provider implementations:

```javascript
// Development: Use memory providers
const cache = serviceRegistry.cache('memory');

// Production: Use Redis
const cache = serviceRegistry.cache('redis', {
  host: process.env.REDIS_HOST,
  port: 6379
});

// Distributed: Use API provider
const cache = serviceRegistry.cache('api', {
  apiRoot: 'https://api.myapp.com',
  apiKey: process.env.API_KEY
});
```

### Event-Driven Communication

Global EventEmitter enables inter-service communication:

```javascript
// Service A emits event
eventEmitter.emit('user.created', { userId: 123 });

// Service B listens
eventEmitter.on('user.created', (data) => {
  // Send welcome email
});
```

---

## Environment Variables

### Required for Production

```bash
# Session secret (required for auth)
SESSION_SECRET=your-secret-here

# API keys for service protection (recommended)
NOOBLY_API_KEYS=key1,key2,key3

# Redis (if using redis provider)
REDIS_HOST=localhost
REDIS_PORT=6379

# MongoDB (if using mongodb provider)
MONGODB_URI=mongodb://localhost:27017/myapp

# AWS S3 (if using s3 provider)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=my-bucket

# AI Services (if using AI)
ANTHROPIC_API_KEY=your-claude-key
OPENAI_API_KEY=your-openai-key

# OAuth (if using Google OAuth)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/services/authservice/api/google/callback
```

### Optional Configuration

```bash
# Application
NODE_ENV=production
PORT=3001

# Logging
LOG_LEVEL=info
LOG_DIR=./logs

# Data storage
DATA_DIR=./data
```

---

## Project Structure

```
nooblyjs-core/
├── index.js                    # ServiceRegistry singleton
├── app.js                      # Main application with all services
├── package.json                # Dependencies and scripts
├── README.md                   # This documentation
├── CLAUDE.md                   # Claude AI assistant guidance
├── GEMINI.md                   # Gemini AI assistant guidance
├── public/                     # Public landing page and assets
├── src/                        # Source code (13 services)
│   ├── caching/               # Caching service (memory, redis, memcached, file, api)
│   ├── filing/                # Filing service (local, ftp, s3, git, gcp, api)
│   ├── dataservice/           # Data service (memory, file, mongodb, documentdb, api)
│   ├── logging/               # Logging service (memory, file, api)
│   ├── queueing/              # Queueing service (memory, api)
│   ├── working/               # Working service (memory, api)
│   ├── measuring/             # Measuring service (memory, api)
│   ├── scheduling/            # Scheduling service (memory, api)
│   ├── searching/             # Searching service (memory, file, api)
│   ├── workflow/              # Workflow service (memory, api)
│   ├── notifying/             # Notifying service (memory, api)
│   ├── authservice/           # Auth service (memory, file, passport, google, api)
│   └── aiservice/             # AI service (claude, chatgpt, ollama, api)
├── tests/
│   ├── unit/                  # Jest unit tests by service
│   ├── load/                  # Load testing scripts
│   ├── api/                   # API test files (.http format)
│   ├── activities/            # Activity-based integration tests
│   └── app/
│       ├── apps/              # Individual service demo applications
│       └── app-wiki/          # Full-featured wiki application
├── docs/                      # Comprehensive documentation
│   ├── refactoring/           # Analysis reports and refactoring plans
│   └── todo/                  # Feature tracking and bug reports
├── scripts/                   # Utility scripts (token analysis, etc)
└── .noobly-core/              # Runtime data directory
    ├── logs/                  # Application log files
    └── data/                  # Persistent data storage
```

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

### Development Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Run `npm run analyze-tokens` to check file sizes

---

## License

ISC License - See [LICENSE](LICENSE) file for details

---

## Links

- **Repository:** https://github.com/nooblyjs/nooblyjs-core
- **Issues:** https://github.com/nooblyjs/nooblyjs-core/issues
- **npm Package:** `noobly-core`

---

## Version History

**v1.0.9** (Current)
- All 13 services with API provider support
- Enterprise architecture with API providers for distributed systems
- Enhanced service routes and REST API endpoints for all services
- Improved test applications (wiki app, lite app, auth app)
- Refactored authentication middleware with role-based access control
- Enhanced AI service with improved prompt analytics
- Comprehensive documentation and examples
- Token analysis tooling with detailed reports
- 4-level dependency hierarchy with automatic dependency resolution
- AI service integration (Claude, GPT-4, Ollama)
- Full unit, load, and API test coverage
- Multiple UI themes for service management dashboard

---

**Built with ❤️ by the NooblyJS Team**
