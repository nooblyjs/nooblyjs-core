# NooblyJS Core - Product Requirements Document

**Version:** 1.0.14+
**Status:** Active Development
**Last Updated:** 2025-10-18
**Package:** `noobly-core` on npm
**Repository:** https://github.com/nooblyjs/nooblyjs-core

---

## 1. Executive Summary

NooblyJS Core is a comprehensive, enterprise-grade Node.js backend framework that provides **13 modular services** for building scalable applications. The framework implements a sophisticated service registry pattern with dependency injection, singleton services, and pluggable providers for different backend implementations. It supports both monolithic and distributed microservices architectures through its innovative API provider system.

**Key Differentiators:**
- **13 Enterprise Services** - Complete backend service suite from caching to AI integration
- **Dependency Injection** - Automatic 4-level hierarchical dependency management
- **Enterprise Architecture** - API providers enable distributed client-server deployments
- **Security First** - Built-in API key auth, session management, RBAC, and OAuth
- **AI-Ready** - Native integration with Claude, ChatGPT, and Ollama with token tracking
- **Developer Experience** - Web dashboards, auto-generated APIs, comprehensive docs

## 2. Product Vision

**Vision Statement:** To provide developers with the most comprehensive, flexible, and production-ready backend framework that eliminates boilerplate while enabling enterprise-grade architectures.

**Mission:** Empower developers to build scalable, secure, and intelligent applications faster by providing pre-built, battle-tested services with seamless integration, multiple deployment options, and built-in AI capabilities.

## 3. Target Users

### Primary Users
- **Backend Developers** - Node.js developers building REST APIs, GraphQL services, and web applications
- **Full-Stack Developers** - Developers needing rapid backend prototyping with integrated frontend services
- **System Architects** - Teams designing microservices, distributed systems, and enterprise architectures
- **AI Application Developers** - Developers building LLM-powered applications with token tracking and analytics

### Secondary Users
- **DevOps Engineers** - For deployment, infrastructure management, and service monitoring
- **Technical Leaders** - For architectural decision making and technology stack selection
- **Startup Teams** - For rapid MVP development with production-ready infrastructure
- **Enterprise Teams** - For building scalable, secure, multi-tenant applications

## 4. Core Features

### 4.1 Service Registry Architecture
- **Singleton Pattern Implementation** - Ensures single instance per service:provider combination
- **Dependency Injection System** - Automatic 4-level hierarchical dependency resolution
- **Centralized Service Management** - Unified `serviceRegistry` access point for all 13 services
- **Lazy Initialization** - Services are created only when requested with automatic dependency creation
- **Topological Ordering** - Services initialize in correct order based on dependency graph
- **Circular Dependency Prevention** - Framework validates and prevents circular dependencies
- **Global Event Emitter** - Inter-service communication and event broadcasting mechanism

### 4.2 Complete Service Suite (13 Services)

#### Level 0: Foundation Services
**No dependencies - can be used standalone**

##### 4.2.1 Logging Service
- **Purpose:** Application logging with multiple levels and structured output
- **Providers:** `memory`, `file`, `api`
- **Features:**
  - Multiple log levels (debug, info, warn, error)
  - Structured logging with metadata
  - File rotation support
  - Real-time log streaming
  - Remote logging via API provider
- **API Endpoints:** `/services/logging/api/*`

#### Level 1: Infrastructure Services
**Depend on Foundation (logging)**

##### 4.2.2 Caching Service
- **Purpose:** High-performance key-value caching with TTL and analytics
- **Providers:** `memory`, `inmemory`, `redis`, `memcached`, `file`, `api`
- **Features:**
  - LRU eviction policy
  - Hit/miss analytics and tracking
  - TTL (Time-To-Live) support
  - Key prefix namespacing
  - Analytics dashboard
  - Distributed caching with Redis
- **API Endpoints:** `/services/caching/api/*`
- **Dependencies:** logging

##### 4.2.3 Filing Service
- **Purpose:** File upload, download, and management across multiple storage backends
- **Providers:** `local`, `ftp`, `s3`, `git`, `gcp`, `sync`, `api`
- **Features:**
  - Upload/download operations
  - Metadata handling
  - Cloud storage integration (AWS S3, Google Cloud)
  - Git repository operations
  - File synchronization
  - Multipart upload support
- **API Endpoints:** `/services/filing/api/*`
- **Dependencies:** logging

##### 4.2.4 Queueing Service
- **Purpose:** FIFO task queue management for async processing
- **Providers:** `memory`, `api`
- **Features:**
  - FIFO processing
  - Named queues support
  - Queue size monitoring
  - Async task handling
  - Queue purging
- **API Endpoints:** `/services/queueing/api/*`
- **Dependencies:** logging

#### Level 2: Business Logic Services
**Depend on Infrastructure services**

##### 4.2.5 Data Service
- **Purpose:** UUID-based JSON document storage with advanced search
- **Providers:** `memory`, `file`, `simpledb`, `mongodb`, `documentdb`, `api`
- **Features:**
  - Container-based organization
  - Auto-generated UUID identifiers
  - JSON search with custom predicates
  - Path-based queries (nested object support)
  - Multi-criteria search
  - NoSQL-style document storage
- **API Endpoints:** `/services/dataservice/api/*`
- **Dependencies:** logging, filing

##### 4.2.6 Working Service
- **Purpose:** Background task execution with worker threads
- **Providers:** `memory`, `api`
- **Features:**
  - Script execution in worker threads
  - Task lifecycle management
  - Worker pool management
  - Error handling and recovery
  - Task status tracking
- **API Endpoints:** `/services/working/api/*`
- **Dependencies:** logging, queueing, caching

##### 4.2.7 Measuring Service
- **Purpose:** Metrics collection and aggregation
- **Providers:** `memory`, `api`
- **Features:**
  - Time-series data collection
  - Aggregation functions (sum, avg, min, max)
  - Date range queries
  - Performance monitoring
  - Custom metric types
- **API Endpoints:** `/services/measuring/api/*`
- **Dependencies:** logging, queueing, caching

#### Level 3: Application Services
**Depend on Business Logic services**

##### 4.2.8 Scheduling Service
- **Purpose:** Cron-like task scheduling with worker threads
- **Providers:** `memory`
- **Features:**
  - Delayed execution
  - Recurring tasks with intervals
  - Callback support
  - Task cancellation
  - Analytics tracking
- **API Endpoints:** `/services/scheduling/api/*`
- **Dependencies:** logging, working

##### 4.2.9 Searching Service
- **Purpose:** Full-text search and indexing
- **Providers:** `memory`, `file`, `api`
- **Features:**
  - Object indexing
  - Full-text search
  - Query capabilities
  - Index management
  - Search result ranking
- **API Endpoints:** `/services/searching/api/*`
- **Dependencies:** logging, caching, dataservice, queueing, working, scheduling

##### 4.2.10 Workflow Service
- **Purpose:** Multi-step workflow orchestration
- **Providers:** `memory`, `api`
- **Features:**
  - Sequential step execution
  - Worker threads for steps
  - Error handling and recovery
  - Parallel execution support
  - Workflow analytics
  - Step retry logic
- **API Endpoints:** `/services/workflow/api/*`
- **Dependencies:** logging, queueing, scheduling, measuring, working

#### Level 4: Integration Services
**Depend on Application services - highest level**

##### 4.2.11 Notifying Service
- **Purpose:** Pub/sub messaging and event broadcasting
- **Providers:** `memory`, `api`
- **Features:**
  - Topic-based messaging
  - Multiple subscribers per topic
  - Event broadcasting
  - Async notification delivery
  - Subscription management
- **API Endpoints:** `/services/notifying/api/*`
- **Dependencies:** logging, queueing, scheduling

##### 4.2.12 Authentication Service
- **Purpose:** User authentication, authorization, and session management
- **Providers:** `memory`, `file`, `passport`, `google`, `api`
- **Features:**
  - User registration and login
  - Password hashing (bcrypt)
  - Session management
  - Role-based access control (RBAC)
  - OAuth 2.0 integration (Google)
  - Passport.js strategies
  - Token validation
  - Default admin/user accounts (memory provider)
- **API Endpoints:** `/services/authservice/api/*`
- **Dependencies:** logging, caching, dataservice

##### 4.2.13 AI Service
- **Purpose:** LLM integration with token tracking and analytics
- **Providers:** `claude`, `chatgpt`, `ollama`, `api`
- **Features:**
  - Claude 3.5 Sonnet integration
  - OpenAI GPT-4 integration
  - Ollama local LLM support
  - Prompt management
  - Token usage tracking
  - Cost estimation
  - Usage analytics by model
  - Streaming responses
  - Session tracking
- **API Endpoints:** `/services/ai/api/*`
- **Dependencies:** logging, caching, workflow, queueing

### 4.3 Enterprise API Provider Architecture
**Distributed Microservices Support**

All 13 services support the `api` provider, enabling enterprise client-server architectures:

**Use Cases:**
- Frontend applications consuming backend service APIs
- Microservices architecture with separated concerns
- Distributed systems with independent scaling
- Multi-tenant applications with shared backend services

**Features:**
- Transparent API calls (same interface as local providers)
- Configurable API roots and timeouts
- API key authentication support
- Seamless switching between local and remote providers
- Load balancing and failover support

**Configuration:**
```javascript
// Frontend client using remote services
const cache = serviceRegistry.cache('api', {
  apiRoot: 'https://backend.example.com',
  apiKey: process.env.BACKEND_API_KEY,
  timeout: 5000
});

const dataService = serviceRegistry.dataService('api', {
  apiRoot: 'https://backend.example.com',
  apiKey: process.env.BACKEND_API_KEY
});
```

### 4.4 RESTful API Layer
Complete auto-generated REST API endpoints for all services:

**API Structure:**
- **URL Pattern:** `/services/{service}/api/{operation}`
- **Standard HTTP Methods:** GET, POST, PUT, DELETE
- **Request/Response:** JSON format
- **Authentication:** Multiple methods (x-api-key, Bearer, ApiKey, query params)
- **Status Endpoints:** `/services/{service}/api/status` (public by default)

**Features:**
- Consistent error responses with error codes
- Comprehensive request validation
- Automatic route registration on service initialization
- Configurable authentication exclusions
- Built-in CORS support

### 4.5 Web Interface & Dashboards

**Service Management Dashboard:** `/services/`
- Centralized service overview
- Real-time service status
- System monitoring metrics
- Protected by session authentication

**Individual Service Dashboards:**
- Each service has its own management interface
- Interactive API testing
- Analytics and metrics visualization
- Responsive design (mobile and desktop)
- Swagger/OpenAPI documentation

**System Monitoring:** `/services/api/monitoring/*`
- Real-time metrics endpoint
- System snapshots
- Performance analytics
- Resource usage tracking

### 4.6 Security Features

**API Key Authentication:**
- Configurable requirement per environment
- Auto-generation in development mode
- Multiple authentication methods (5 supported)
- Flexible path exclusions
- Event-based security logging

**Session-Based Authentication:**
- Express session integration
- Passport.js strategies
- Cookie management
- Session expiration
- Protected dashboard access

**Role-Based Access Control (RBAC):**
- User role management
- Permission system
- Role assignment APIs
- Default roles (admin, user)

**OAuth Integration:**
- Google OAuth 2.0 support
- Passport strategy integration
- Callback URL configuration
- Token validation

**Password Security:**
- Bcrypt hashing with salt rounds
- Secure password storage
- Password strength validation

## 5. Technical Requirements

### 5.1 Runtime Requirements
- **Node.js:** Version >=12.11.0
- **Express.js:** ^4.19.2 - Web framework foundation
- **Module System:** CommonJS (`"type": "commonjs"`)
- **Package Manager:** npm or yarn

### 5.2 Core Dependencies

#### Web Framework & Middleware
- `express` (^4.19.2) - Web application framework
- `body-parser` (^1.20.2) - Request body parsing
- `express-session` (^1.17.3) - Session management
- `passport` (^0.7.0) - Authentication middleware
- `passport-local` (^1.0.0) - Local authentication strategy
- `passport-google-oauth20` (^2.0.0) - Google OAuth strategy

#### Data & Storage
- `uuid` (^11.1.0) - UUID generation for data service
- `mongodb` (^6.19.0) - MongoDB database driver
- `ioredis` (^5.6.1) - Redis client for caching
- `memjs` (^1.3.0) - Memcached client
- `aws-sdk` (^2.1620.0) - AWS S3 and SimpleDB
- `@aws-sdk/client-s3` (^3.614.0) - AWS SDK v3 for S3
- `@google-cloud/storage` (^7.17.0) - Google Cloud Storage

#### File Operations
- `multer` (^2.0.2) - File upload middleware
- `ftp` (^0.3.10) - FTP client
- `simple-git` (^3.28.0) - Git operations
- `rimraf` (^6.0.1) - File deletion utility

#### AI & External Services
- `@anthropic-ai/sdk` (^0.60.0) - Anthropic Claude SDK
- `@anthropic-ai/claude-code` (^1.0.81) - Claude Code integration
- `openai` (^5.16.0) - OpenAI GPT integration
- `@google/gemini-cli` (^0.1.22) - Google Gemini integration
- `axios` (^1.7.7) - HTTP client for API providers
- `node-fetch` (^3.3.2) - Fetch API for Node.js

#### Utilities
- `dotenv` (^17.2.1) - Environment variable management
- `tslib` (^2.6.2) - TypeScript runtime helpers

### 5.3 Development Dependencies
- `jest` (^30.0.3) - Testing framework
- `nock` (^13.5.6) - HTTP mocking for tests
- `supertest` (^7.1.4) - API integration testing
- `nodemon` (^3.1.10) - Development auto-reload
- `ioredis-mock` (^8.9.0) - Redis mocking for tests

### 5.4 Environment Variables

**Required:**
- `NOOBLY_API_KEYS` or `API_KEYS` - Comma-separated API keys
- `SESSION_SECRET` - Session encryption secret
- `NODE_ENV` - Environment (development/production)

**Optional (Service-Specific):**
- `PORT` - Server port (default: 3001)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis configuration
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `S3_BUCKET`, `AWS_REGION` - S3 configuration
- `MONGODB_URI` - MongoDB connection string
- `ANTHROPIC_API_KEY` or `aiapikey` - Claude AI API key
- `OPENAI_API_KEY` - OpenAI API key
- `OLLAMA_URL` - Ollama server URL (default: http://localhost:11434)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
- `GOOGLE_CALLBACK_URL` - OAuth callback URL

## 6. Architecture Requirements

### 6.1 Scalability
- **Horizontal Scaling** - Stateless APIs suitable for load balancing
- **Vertical Scaling** - Configurable resource limits per service
- **Distributed Architecture** - API providers enable microservices deployment
- **Independent Service Scaling** - Each service can scale independently
- **Event-Driven Architecture** - Loose coupling through EventEmitter
- **Database Scaling** - Support for distributed databases (MongoDB, Redis clusters)

### 6.2 Reliability
- **Comprehensive Error Handling** - Try-catch blocks with detailed error messages
- **Provider Fallback** - Graceful degradation to alternative providers
- **Health Monitoring** - Built-in status endpoints for all services
- **Dependency Validation** - Circular dependency prevention
- **Initialization Order** - Topological sort ensures correct startup
- **Service Isolation** - Failures in one service don't cascade
- **Automatic Recovery** - Worker threads restart on failure

### 6.3 Performance
- **Singleton Pattern** - Efficient memory utilization, one instance per service:provider
- **Lazy Initialization** - Services created only when needed
- **Caching Layers** - Multiple caching strategies (LRU, distributed)
- **Async Operations** - Non-blocking I/O throughout
- **Worker Threads** - CPU-intensive tasks in separate threads
- **Connection Pooling** - Redis and database connection management
- **Response Caching** - Built-in cache service for API responses

### 6.4 Dependency Management
- **4-Level Hierarchy** - Foundation → Infrastructure → Business Logic → Application → Integration
- **Automatic Injection** - Dependencies resolved and injected automatically
- **Topological Ordering** - Services initialize in dependency order
- **Circular Prevention** - Framework validates dependency graph
- **Explicit Dependencies** - Clear dependency definitions per service

## 7. Deployment Requirements

### 7.1 Deployment Options
- **Standalone Node.js** - Run directly with `npm start`
- **Docker Containerization** - Containerized deployment (Dockerfile available)
- **Cloud Platforms** - AWS, Google Cloud, Azure, Heroku compatible
- **Serverless** - Can be adapted for Lambda/Cloud Functions
- **Kubernetes** - Ready for K8s orchestration

### 7.2 Environment Configuration
- **Environment Variables** - `.env` file support via dotenv
- **Runtime Configuration** - Dynamic provider selection based on env
- **Multi-Environment** - Development, staging, production configs
- **Secret Management** - Environment-based secret injection
- **Resource Limits** - Configurable memory and CPU limits

### 7.3 Production Checklist
- Set `NODE_ENV=production`
- Configure `NOOBLY_API_KEYS` with strong keys
- Set `SESSION_SECRET` to secure random value
- Configure external providers (Redis, MongoDB, S3)
- Enable HTTPS/SSL for production
- Configure firewall rules for service ports
- Set up monitoring and logging destinations
- Configure backup strategies for file-based providers

## 8. Testing Requirements

### 8.1 Test Coverage
**Comprehensive test suite included:**

- **Unit Tests** - Individual service testing (`tests/unit/`)
  - All 13 services have dedicated test files
  - Provider-specific unit tests
  - Dependency injection testing
  - Edge case coverage

- **Integration Tests** - Cross-service functionality
  - Service interaction testing
  - Workflow execution tests
  - Event emitter communication tests

- **API Tests** - HTTP endpoint validation (`tests/api/`)
  - REST API endpoint testing
  - Authentication flow testing
  - Error response validation
  - HTTP files for manual testing with REST clients

- **Load Tests** - Performance and stress testing (`tests/load/`)
  - Concurrent request handling
  - Memory leak detection
  - Response time benchmarks
  - Stress test scenarios

- **Example Applications** - Real-world usage (`tests/app-*.js`)
  - Service-specific example apps
  - Integration pattern examples
  - Use case demonstrations

### 8.2 Test Automation
- **Jest Framework** - v30.0.3 with `forceExit` and `detectOpenHandles`
- **Mock Providers** - ioredis-mock, nock for HTTP mocking
- **CI/CD Ready** - Test scripts compatible with GitHub Actions, GitLab CI
- **Code Coverage** - Target >80% coverage
- **Test Commands:**
  ```bash
  npm test           # Run all unit tests
  npm run test-load  # Run load tests
  ```

### 8.3 Testing Best Practices
- Each service has isolated test environment
- Mock external dependencies (Redis, S3, etc.)
- Use memory providers for fast testing
- Test both success and error paths
- Validate all API endpoints
- Test authentication and authorization flows

## 9. Documentation Requirements

### 9.1 Comprehensive Documentation Suite

**Included Documentation Files:**

1. **README.md** - Project overview, features, installation, quick start
2. **CLAUDE.md** - AI assistant guidance for code contributions
3. **GEMINI.md** - Gemini AI integration guide
4. **docs/nooblyjs-core-usage-guide.md** - Complete technical usage guide (human-readable)
5. **docs/nooblyjs-core-usage-guide-concise.md** - Quick reference guide (AI-optimized)
6. **docs/nooblyjs-core-requirements-document.md** - This PRD document
7. **API Documentation** - Auto-generated from JSDoc comments
8. **Example Applications** - Working code examples in `tests/` directory

### 9.2 Documentation Coverage
- **All 13 Services** - Complete API reference for each service
- **All Providers** - Configuration examples for each provider type
- **Authentication Flows** - Session, API key, and OAuth documentation
- **Enterprise Architecture** - API provider and distributed system guides
- **Error Codes** - Comprehensive error code reference
- **Best Practices** - Security, performance, and deployment guides

### 9.3 Interactive Documentation
- **Web Dashboards** - Built-in service documentation at `/services/`
- **Swagger/OpenAPI** - Auto-generated API specifications
- **Example Code** - Copy-paste ready code snippets
- **HTTP Files** - API test files for REST clients (`tests/api/`)

## 10. Quality Requirements

### 10.1 Code Quality
- **Modular Architecture** - Clear separation of concerns (service, provider, routes, views)
- **Consistent Patterns** - Factory pattern for all services
- **Error Handling** - Try-catch blocks with descriptive messages
- **Code Comments** - JSDoc comments for all public APIs
- **Naming Conventions** - Clear, consistent naming across codebase

### 10.2 Maintainability
- **Semantic Versioning** - Strict semver adherence (currently v1.0.14+)
- **Backward Compatibility** - Stable API contracts, deprecation warnings
- **Extensibility** - Easy to add new providers and services
- **Plugin Architecture** - Service registry pattern supports extensions
- **Clean Dependencies** - Minimal, well-maintained dependencies

### 10.3 Security Standards
- **No Hardcoded Secrets** - All credentials via environment variables
- **Input Validation** - Request validation for all APIs
- **SQL Injection Prevention** - Parameterized queries where applicable
- **XSS Prevention** - Sanitized outputs
- **CSRF Protection** - Session-based CSRF tokens
- **Dependency Scanning** - Regular security audits

## 11. Success Metrics

### 11.1 Technical Metrics (Current Targets)
- **API Response Time:** < 50ms for cached operations, < 200ms for database operations
- **Memory Usage:** < 256MB base footprint, scalable with services used
- **Test Coverage:** > 80% code coverage across all services
- **Documentation Coverage:** > 95% API documentation complete
- **Uptime:** 99.9% availability with proper deployment
- **Concurrent Users:** Handle 1000+ concurrent requests with Redis

### 11.2 Business Metrics
- **NPM Downloads:** Track monthly download trends
- **GitHub Metrics:** Stars, forks, issues, pull requests
- **Community Engagement:** Discord/Slack community activity
- **Third-Party Providers:** Number of community-contributed providers
- **Production Deployments:** Number of production applications
- **Developer Satisfaction:** Developer survey scores

### 11.3 Feature Completion
- ✅ **13 Core Services** - All implemented and tested
- ✅ **Multi-Provider Support** - 40+ provider implementations
- ✅ **Dependency Injection** - 4-level hierarchy implemented
- ✅ **Security Features** - API keys, sessions, RBAC, OAuth
- ✅ **Enterprise Architecture** - API providers for all services
- ✅ **AI Integration** - Claude, ChatGPT, Ollama support
- ✅ **Web Dashboards** - Service management UIs
- ✅ **Comprehensive Testing** - Unit, integration, API, load tests

## 12. Roadmap & Future Development

### 12.1 Current Version (v1.0.14+) - COMPLETED ✅
- [x] 13 core services implementation
- [x] Multi-provider support (40+ providers)
- [x] Dependency injection system
- [x] REST API layer for all services
- [x] Web dashboards and monitoring
- [x] Security (API keys, sessions, RBAC, OAuth)
- [x] AI service integration (Claude, ChatGPT, Ollama)
- [x] Enterprise API providers
- [x] Authentication service with Passport
- [x] Comprehensive documentation

### 12.2 Near-Term Enhancements (v1.1.x) - PLANNED
- [ ] **GraphQL API Layer** - Alternative to REST endpoints
- [ ] **WebSocket Support** - Real-time bidirectional communication
- [ ] **Enhanced Monitoring** - Prometheus metrics export
- [ ] **Rate Limiting** - Built-in rate limiting middleware
- [ ] **API Versioning** - Support for multiple API versions
- [ ] **TypeScript Definitions** - Full TypeScript support with .d.ts files
- [ ] **CLI Tool** - Command-line interface for service management
- [ ] **Database Migrations** - Schema migration support for data service

### 12.3 Mid-Term Features (v1.2.x) - UNDER CONSIDERATION
- [ ] **Message Queue Providers** - RabbitMQ, Apache Kafka, AWS SQS
- [ ] **Additional Database Providers** - PostgreSQL, MySQL, DynamoDB
- [ ] **Service Mesh Integration** - Istio, Linkerd compatibility
- [ ] **Kubernetes Operators** - K8s native deployment
- [ ] **Distributed Tracing** - OpenTelemetry integration
- [ ] **Multi-Tenancy** - Built-in tenant isolation
- [ ] **Plugin Marketplace** - Community plugin repository
- [ ] **Visual Workflow Designer** - GUI for workflow creation

### 12.4 Long-Term Vision (v2.0+) - EXPLORATION
- [ ] **Microservices Orchestration** - Service mesh capabilities
- [ ] **Edge Computing Support** - Edge runtime compatibility
- [ ] **Blockchain Integration** - Web3 service providers
- [ ] **Real-Time Collaboration** - Operational transformation for collaborative features
- [ ] **Auto-Scaling** - Intelligent service auto-scaling
- [ ] **Machine Learning Ops** - ML model deployment and serving
- [ ] **Low-Code Interface** - Visual application builder

---

## Appendix A: Service Quick Reference

| Service | Primary Purpose | Production Provider | API Endpoint |
|---------|----------------|---------------------|--------------|
| Logging | Application logging | `file` | `/services/logging/api/*` |
| Caching | High-speed data cache | `redis` | `/services/caching/api/*` |
| Filing | File storage | `s3` or `gcp` | `/services/filing/api/*` |
| Queueing | Task queue | `memory` | `/services/queueing/api/*` |
| DataService | Document storage | `mongodb` | `/services/dataservice/api/*` |
| Working | Background jobs | `memory` | `/services/working/api/*` |
| Measuring | Metrics collection | `memory` | `/services/measuring/api/*` |
| Scheduling | Task scheduling | `memory` | `/services/scheduling/api/*` |
| Searching | Full-text search | `memory` | `/services/searching/api/*` |
| Workflow | Multi-step workflows | `memory` | `/services/workflow/api/*` |
| Notifying | Pub/sub messaging | `memory` | `/services/notifying/api/*` |
| Auth Service | Authentication | `file` or `passport` | `/services/authservice/api/*` |
| AI Service | LLM integration | `claude` or `chatgpt` | `/services/ai/api/*` |

---

## Document Control

**Document Version:** 2.0
**Last Updated:** 2025-10-18
**Status:** Active
**Next Review:** Quarterly or upon major release

**Change Log:**
- v2.0 (2025-10-18): Complete rewrite to reflect v1.0.14+ architecture
- v1.0 (Previous): Initial PRD for v1.2.2

---

*This document represents the current state of NooblyJS Core v1.0.14+ and serves as the authoritative specification for development, testing, deployment, and future planning activities.*