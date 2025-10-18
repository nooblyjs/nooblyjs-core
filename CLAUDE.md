# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm start` - Start the main application server (app.js)
- `npm run dev:web` - Start development server with nodemon watching src/ directory
- `npm run kill` - Kill process running on port 3001

### Testing
- `npm test` - Run Jest test suite
- `npm run test-load` - Run load tests from tests/load/ directory

### Manual Testing
- API tests are available in `tests/api/` directory for manual testing with REST clients
- Example applications in `tests/` directory demonstrate service usage

## Architecture

**nooblyjs-core** is a modular Node.js backend framework that provides pluggable core services. The architecture follows a consistent factory pattern across all services:

### Core Pattern
Each service module follows this structure:
- `src/{service}/index.js` - Factory function that creates service instances
- `src/{service}/providers/` - Different implementation providers (memory, redis, s3, etc.)
- `src/{service}/routes/` - Express route definitions for REST API
- `src/{service}/views/` - Optional UI views (caching service only)

### Service Architecture
Services are initialized through the ServiceRegistry singleton with three parameters:
1. **Provider type** (string) - Determines which implementation to use (e.g., 'memory', 'redis', 'file', 'api')
2. **Options object** - Contains configuration including `'express-app'` reference and security settings
3. **EventEmitter** - Global event system for inter-service communication

### Service Registry Features
- **Dependency Injection** - Services automatically receive their required dependencies
- **Initialization Order** - Services initialize in correct order based on dependency hierarchy (4 levels)
- **Singleton Pattern** - Each service:provider combination is a singleton
- **Security** - API key authentication and session-based service authentication
- **Monitoring** - System monitoring endpoints for metrics and snapshots

### Available Services (13 total)

#### Level 0: Foundation Services (No Dependencies)

**📝 Logging Service**
- **Providers:** `memory`, `file`, `api`
- **Features:** Multiple log levels, structured logging, file rotation
- **Use case:** Application logging and monitoring

#### Level 1: Infrastructure Services (Depend on Foundation)

**🗃️ Caching Service**
- **Providers:** `memory` (inmemory), `redis`, `memcached`, `file`, `api`
- **Features:** Analytics tracking, hit/miss statistics, LRU eviction
- **Use case:** High-performance data caching with distributed cache support
- **Dependencies:** logging

**📁 Filing Service**
- **Providers:** `local`, `ftp`, `s3`, `git`, `gcp`, `sync`, `api`
- **Features:** File operations, metadata handling, cloud storage integration
- **Use case:** File upload, download, and management
- **Dependencies:** logging

**🚀 Queueing Service**
- **Providers:** `memory`, `api`
- **Features:** FIFO processing, queue size monitoring, async task handling
- **Use case:** Task queuing and background job processing
- **Dependencies:** logging

#### Level 2: Business Logic Services (Depend on Infrastructure)

**📊 Data Serving Service**
- **Providers:** `memory`, `file`, `simpledb`, `mongodb`, `documentdb`, `api`
- **Features:** CRUD operations, data persistence, simple queries
- **Use case:** Persistent key-value data storage
- **Dependencies:** logging, filing

**⚙️ Working Service**
- **Providers:** `memory`, `api`
- **Features:** Script execution, worker management, task lifecycle management
- **Use case:** Background task execution
- **Dependencies:** logging, queueing, caching

**📈 Measuring Service**
- **Providers:** `memory`, `api`
- **Features:** Time-series data, aggregation functions, date range queries
- **Use case:** Metrics collection and aggregation
- **Dependencies:** logging, queueing, caching

#### Level 3: Application Services (Depend on Business Logic)

**⏰ Scheduling Service**
- **Providers:** `memory`
- **Features:** Delayed execution, recurring tasks, callback handling
- **Use case:** Cron-like task scheduling
- **Dependencies:** logging, working

**🔍 Searching Service**
- **Providers:** `memory`, `file`, `api`
- **Features:** Object indexing, text search, query capabilities
- **Use case:** Full-text search and indexing
- **Dependencies:** logging, caching, dataservice, queueing, working, scheduling

**🔄 Workflow Service**
- **Providers:** `memory`, `api`
- **Features:** Step-based workflows, worker threads, error handling, parallel execution
- **Use case:** Multi-step workflow orchestration
- **Dependencies:** logging, queueing, scheduling, measuring, working

#### Level 4: Integration Services (Depend on Application)

**🔔 Notifying Service**
- **Providers:** `memory`, `api`
- **Features:** Topic-based messaging, multiple subscribers, event broadcasting
- **Use case:** Pub/sub notification system
- **Dependencies:** logging, queueing, scheduling

**🔐 Authentication Service**
- **Providers:** `memory`, `file`, `passport`, `google`, `api`
- **Features:** User registration/login, session management, RBAC, password hashing, OAuth
- **Use case:** User authentication and authorization
- **Dependencies:** logging, caching, dataservice

**🤖 AI Service**
- **Providers:** `claude`, `chatgpt` (openai), `ollama`, `api`
- **Features:** LLM integration, prompt management, analytics, streaming responses
- **Use case:** AI-powered features and chatbots
- **Dependencies:** logging, caching, workflow, queueing

### Main Application Files
- `index.js` - ServiceRegistry class that manages all services with singleton pattern
- `app.js` - Main application demonstrating all services with security configuration
- Services auto-register Express routes under `/services/{service}/api/*` paths
- Service management UI available at `/services/` (requires authentication)
- Public landing page served from `public/` directory

### Current Features & Capabilities

#### Security Features
- **API Key Authentication** - Optional API key requirement with configurable exclusion paths
- **Session-based Auth** - Service management UI protected by session authentication
- **Role-based Access Control (RBAC)** - User roles and permissions system
- **OAuth Integration** - Google OAuth 2.0 support via passport strategy
- **Password Security** - Bcrypt password hashing with salt rounds
- **Auto-generated Keys** - Development API keys auto-generated if not configured

#### Service Registry
- Singleton pattern implementation for all services
- Global event emitter for inter-service communication
- Dependency injection with 4-level hierarchy (Foundation → Infrastructure → Business Logic → Application → Integration)
- Topological sort for initialization order
- Circular dependency detection and validation
- Dynamic service initialization with pluggable providers
- Service lifecycle management (initialize, reset, list services)

#### API Provider Architecture (Enterprise)
- **Remote Service APIs** - All services support 'api' provider for client-server architecture
- **Distributed Systems** - Frontend can consume backend service APIs
- **Transparent Usage** - Same API whether using local or remote providers
- **Microservices Ready** - Separate frontend and backend deployment

#### Service Views & Monitoring
- **Individual Service UIs** - Each service has its own management interface
- **System Monitoring** - Real-time metrics and system snapshots via `/services/api/monitoring/*`
- **Service Dashboard** - Centralized service management at `/services/`
- **Analytics** - Built-in analytics for caching, AI prompts, and more

#### Provider Implementations
- **Memory providers** - Fast in-memory implementations for all services
- **Redis integration** - Distributed caching with analytics
- **MongoDB/DocumentDB** - NoSQL database support for data persistence
- **AWS S3 integration** - Cloud file storage with full S3 API support
- **GCP Storage** - Google Cloud Platform file storage
- **FTP support** - File transfer protocol for legacy systems
- **Git integration** - Git repository as file storage backend
- **File system providers** - Local file operations
- **Memcached support** - Alternative caching backend
- **API providers** - Remote backend API consumption for all services

#### Advanced Features
- **Worker Threads** - Workflow service uses worker threads for step execution
- **Event-driven architecture** - All services communicate via global EventEmitter
- **Load balancing ready** - Stateless APIs suitable for horizontal scaling
- **Testing suite** - Comprehensive unit, load, and API tests included
- **Example Applications** - Multiple example apps demonstrating service usage

### REST API Structure
All services expose consistent REST endpoints under `/services/{service}/api/*`:
- `GET /services/{service}/api/status` - Service health check (public by default)
- Service-specific CRUD operations following RESTful conventions
- Protected by API key authentication (configurable with excludePaths)
- See README.md for complete API documentation

### File Organization
```
/workspaces/nooblyjs-core/
├── index.js                    # ServiceRegistry singleton
├── app.js                      # Main application with all services
├── package.json                # Dependencies and scripts
├── README.md                   # Comprehensive documentation
├── CLAUDE.md                   # This file
├── GEMINI.md                   # Gemini AI guidance
├── public/                     # Public landing page assets
├── src/                        # Source code organized by service
│   ├── {service}/
│   │   ├── index.js           # Service factory
│   │   ├── providers/         # Provider implementations
│   │   ├── routes/            # Express route definitions
│   │   └── views/             # Service UI views
│   └── views/                 # Centralized service dashboard
├── tests/                      # Testing suite
│   ├── unit/                  # Jest unit tests by service
│   ├── load/                  # Load testing scripts
│   ├── api/                   # API test files
│   ├── activities/            # Activity-based tests
│   └── app-*.js               # Example applications
└── .noobly-core/              # Runtime data directory
    ├── logs/                  # Log files
    └── data/                  # Persistent data
```

### Configuration & Environment

#### Required Environment Variables
- `NOOBLY_API_KEYS` or `API_KEYS` - Comma-separated API keys for authentication
- `SESSION_SECRET` - Secret for Express session encryption
- `NODE_ENV` - Set to 'production' to disable auto-generated dev API keys

#### Optional Environment Variables
- `PORT` - Server port (default: 3001)
- `aiapikey` - Anthropic API key for Claude AI service
- `OLLAMA_URL` - Ollama server URL (default: http://localhost:11434)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_CALLBACK_URL` - Google OAuth callback URL

#### Configuration Objects
```javascript
const options = {
  logDir: './logs',              // Log file directory
  dataDir: './data',             // Data file directory
  apiKeys: ['key1', 'key2'],     // API keys for authentication
  requireApiKey: true,           // Enforce API key requirement
  excludePaths: [                // Paths exempt from API key auth
    '/services/*/status',
    '/services/',
    '/services/authservice/api/login'
  ],
  security: {                    // Nested security configuration
    apiKeyAuth: { ... },
    servicesAuth: { ... }
  }
};
```

### Module System
- Uses CommonJS modules (`"type": "commonjs"`)
- All services use `module.exports` syntax
- Jest configured with `forceExit` and `detectOpenHandles` for proper cleanup
- Node.js version requirement: >=12.11.0