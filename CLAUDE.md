# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Noobly JS Core is a modular Node.js backend framework providing a comprehensive set of services with singleton pattern implementation, managed through a central ServiceRegistry. The architecture is built around dependency injection and event-driven communication between services.

**Current Status**: Code has been modernized with contemporary JavaScript patterns (const/let, async/await), comprehensive JSDoc documentation across all base classes and 30+ provider files, and structured logging throughout. All refactoring committed with atomic per-file commits.

## Core Architecture

### Service Hierarchy (Dependency Layers)

Services are organized into 5 levels based on dependencies:

**Level 0 - Foundation (No dependencies):**
- `logging` - Core logging service (file, memory, API providers)

**Level 1 - Infrastructure:**
- `caching` - In-memory, Redis, Memcached, file, API providers
- `queueing` - In-memory, Redis, RabbitMQ, AWS SQS, Azure, GCP, API providers
- `notifying` - Notification service
- `appservice` - Application service base
- `fetching` - HTTP fetching with Node.js or Axios

**Level 2 - Business Logic:**
- `dataservice` - Data persistence (memory, file, MongoDB, DocumentDB, SimpleDB)
- `working` - Worker/activity execution service
- `measuring` - Metrics collection service

**Level 3 - Application:**
- `scheduling` - Task scheduling service
- `searching` - Search functionality with caching and data service
- `workflow` - Workflow/pipeline orchestration using queueing and scheduling
- `filing` - File operations (local, FTP, S3, Git, sync providers)

**Level 4 - Integration:**
- `authservice` - Authentication (file, memory, Passport, Google OAuth)
- `aiservice` - AI integration (Claude, OpenAI, Ollama)

**Additional Services:**
- `appservice` - Base application service for custom service implementations
- `uiservice` - UI service registry and management (centralizes dashboard views and navigation)
- `requesting` - HTTP requesting/client service (refactored from original architecture)

### Service Registry Pattern

`index.js` exports a singleton ServiceRegistry that:
- Manages service instantiation with dependency injection
- Maintains service dependency graph and validates for circular dependencies
- Provides factory methods (e.g., `registry.cache()`, `registry.dataService()`)
- Handles multiple named instances of the same service
- Emits events for service lifecycle (`service:created`, `api-auth-setup`, etc.)

Each service factory exports a function that accepts `(providerType, options, eventEmitter)`.

### Service Structure

Each service typically contains:
- `index.js` - Factory function that creates service instances
- `routes/index.js` - Express route handlers for REST API
- `views/` - HTML UI for the service dashboard
- `modules/` - Feature modules (analytics, helpers)
- `providers/` - Multiple implementation providers

Example service files follow this pattern:
```
src/{serviceName}/
  ├── index.js              # Factory function
  ├── routes/index.js       # API routes
  ├── views/index.html      # Dashboard UI
  ├── modules/analytics.js  # Analytics module
  └── providers/
      ├── {serviceName}.js           # Default/memory provider
      ├── {serviceName}Redis.js      # Redis provider
      └── {serviceName}Api.js        # API provider
```

### Dependency Injection

Services receive dependencies as an object in options. Example from caching:
```javascript
const { dependencies = {} } = options;
const logger = dependencies.logging;  // Access logging service
```

The ServiceRegistry automatically resolves dependencies recursively before service creation.

## Common Development Commands

**Development:**
- `npm run dev:web` - Start development server with auto-reload (watches `./src`), runs on port 11000
- `npm run dev:web:noauth` - Start development server without authentication (useful for testing)
- `npm start` - Start production server
- `npm run kill` - Kill process on port 11000 (useful when development server hangs)

**Testing:**
- `npm run tests` - Run all Jest tests (or `npm test` as alias)
- `npm run tests -- tests/unit/{service}/{service}.test.js` - Run specific service test (e.g., `npm run tests -- tests/unit/caching/cache.test.js`)
- `npm run tests -- tests/unit/{service}/` - Run all tests for a specific service (e.g., `npm run tests -- tests/unit/caching/`)
- `npm run tests -- --watch` - Run tests in watch mode (re-run on file changes)
- `npm run tests -- --coverage` - Run tests with coverage report

**Utilities & Analysis:**
- `npm run analyze-tokens` - Analyze token usage across codebase (useful for understanding scope of changes)

**Docker & Deployment:**
- `npm run docker:build` - Build Docker image locally
- `npm run docker:run` - Run Docker container on port 11000
- `npm run docker:publish` - Build, tag, and push to Docker Hub

**Load Testing:**
- `npm run test-load` - Run load tests (see `tests/load/README.md`)

**Service-Specific Development:**
- `npm run dev:filing` - Start development server with filing service configuration
- Individual test apps in `tests/app/{serviceName}/` can be run directly: `node tests/app/caching/app-caching-redis.js`

## Testing Patterns

Tests are organized into several directories:

**Test Organization:**
- `tests/unit/` - Individual service unit tests (one test file per service) - run with `npm run tests`
- `tests/api/` - API integration tests for service endpoints
- `tests/app/` - Application-level tests with service-specific configurations:
  - `tests/app/{serviceName}/app-*.js` files demonstrate specific provider configurations
  - Run individually for isolated testing: `node tests/app/caching/app-caching-redis.js`
  - Useful for testing service behavior with different backends
- `tests/load/` - Load and performance testing (see `tests/load/README.md`)
- `tests/activities/` - Activity definitions for workflow/scheduling tests

**Unit Test Structure:**

```javascript
// Setup
const createService = require('../../../src/{service}');
const EventEmitter = require('events');

describe('ServiceName', () => {
  let service;
  let mockEventEmitter;

  beforeEach(() => {
    mockEventEmitter = new EventEmitter();
    jest.spyOn(mockEventEmitter, 'emit');
    service = createService('provider-type', {
      dependencies: { logging: mockLogger }
    }, mockEventEmitter);
  });

  it('should perform operation', async () => {
    const result = await service.operation();
    expect(result).toBeDefined();
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('event:name', expectedData);
  });
});
```

**Key Testing Patterns:**
- Jest is configured in `package.json` with `forceExit: true` and `detectOpenHandles: true`
- Services emit events for major operations (use `jest.spyOn(mockEventEmitter, 'emit')` to verify)
- Use dependency injection in tests by passing mock dependencies in options
- All tests should clean up resources in `afterEach()` or `afterAll()` hooks to prevent open handles
- Run `npm run tests -- --coverage` to identify untested code paths
- Jest automatically discovers test files matching `*.test.js` patterns in `tests/` directory

## Configuration & Environment

**Local Development Setup:**
1. Ensure Node.js >= 18.0.0 is installed (tested on 18+, legacy support for 12.11.0+)
2. Run `npm install` to install all dependencies
3. Create a `.env` file in the project root (not tracked in git) with your configuration
4. Services are configured to use file-based providers by default (see `app.js` and `app-noauth.js`)
5. For service-specific testing, see test app files in `tests/app/{serviceName}/app-*.js` - these provide isolated configurations for individual services with different providers

**Port Configuration:**
- Default port: `11000` (can be overridden via `process.env.PORT`)
- Development servers run on port 11000 by default
- Use `npm run kill` to terminate the process on this port
- Use `npm run kill-test` to terminate processes on port 3101 (used by some integration tests)

**API Key Authentication:**
- Environment variables: `process.env.API_KEYS` or `process.env.KNOWLEDGEREPOSITORY_API_KEYS` (comma-separated)
- In development, if no API keys are configured, one is auto-generated and logged to console
- By default, paths like `/services/*/status`, `/services/authservice/api/login`, `/services/authservice/api/register` are excluded from authentication

**Other Configuration:**
- Session Secret: `process.env.SESSION_SECRET` (falls back to dev default `'knowledge-repository-session-secret-change-me'`)
- Log Directory: `./.application/logs` (created automatically at runtime)
- Data Directory: `./.application/data` (created automatically at runtime)

**Example .env File:**
```
PORT=11000
NODE_ENV=development
API_KEYS=dev-key-1,dev-key-2
SESSION_SECRET=your-dev-session-secret
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
```

The `app.js` file demonstrates initializing all services with file-based providers. The `app-noauth.js` file is available for testing without authentication requirements.

## Key Files and Directories

**Core Application Files:**
- `index.js` - ServiceRegistry singleton, service factory methods, dependency resolution
- `app.js` - Full-featured example application with authentication and all services
- `app-noauth.js` - Simplified example without authentication (useful for testing)
- `.env` - Environment configuration (create locally, not in git)
- `package.json` - Dependencies include Express, Redis, MongoDB, AWS/Azure/GCP SDKs, Passport, AI providers

**Project Directories:**
- `src/` - Service implementations organized by service name
- `tests/` - Test suite including unit tests, API tests, load tests, and app-level tests
- `tests/activities/` - Activity definitions used by workflow and scheduling services
- `scripts/` - Utility scripts for analysis and code generation
  - `count-tokens.js` - Analyze token usage across the codebase
  - `build-class-inventory.js` - Generate CSS class inventory
  - `prefix-css-classes.js` - Prefix CSS classes (for namespace isolation)
- `docs/` - Documentation including usage guides and product requirements
- `public/` - Static assets served by Express
- `.application/` - Runtime directories for logs and data (created automatically)
- `certs/` - SSL certificates for development (if needed)

## Important Implementation Notes

**Logging Pattern (Post-Refactoring):**
All server-side code now routes messages through the logging service using optional chaining to fail silently:
```javascript
// Correct pattern (used throughout refactored code)
this.logger?.info(`[${this.constructor.name}] Operation completed`, {
  setting: 'value',
  error: error?.message,
  contextKey: 'contextValue'
});

// Deprecated pattern (no longer used)
console.log('Operation completed'); // Do not use in new code
```
When logger is unavailable (e.g., worker threads), operations continue silently. The logging service receives all messages with structured metadata for filtering and analysis.

**Analytics Module Pattern:**
Services use an analytics module to track metrics. Example: `LogAnalytics` in `src/logging/modules/analytics.js` tracks log counts by level and emits analytics data. Cloud providers have enhanced analytics methods that return provider-specific metrics (e.g., AWS ElastiCache cluster mode, Azure tier detection).

**Provider Flexibility:**
Many services support multiple providers. Always verify the provider type exists before using it:
- `logging`: memory, file, api
- `caching`: memory, redis, memcached, file, api, **aws (ElastiCache), azure (Redis), gcp (Memorystore)**
- `queueing`: memory, redis, rabbitmq, **aws (SQS), azure (Queue Storage), gcp (Cloud Tasks)**, api
- `dataservice`: memory, file, mongodb, documentdb, simpledb
- `filing`: local, ftp, s3, git, sync
- `authservice`: file, memory, passport, google

**JSDoc & Documentation Standards:**
All base classes and provider files now include comprehensive JSDoc documentation following Google JavaScript Style Guide:
- File headers with @fileoverview, @author, @version, @since
- Class documentation with @class, @abstract, @extends tags
- Constructor and method documentation with @param (typed), @return, @throws
- Usage examples with @example blocks
- Properties documented with @type and @protected/@private visibility

When adding new methods or services, follow this pattern:
```javascript
/**
 * Brief description of what method does.
 * Additional context about behavior and constraints.
 *
 * @param {Type} paramName - Description of parameter
 * @param {Type} [optionalParam] - Optional parameter with default
 * @return {Promise<ReturnType>} Description of return value
 * @throws {Error} When specific error condition occurs
 *
 * @example
 * const result = await service.method(param);
 *
 * @example
 * // Advanced usage
 * const result = await service.method(param, { option: true });
 */
```

**Routes & Views:**
Each service automatically registers routes in its `routes/index.js` and serves a UI dashboard. The ServiceRegistry handles mounting these at `/services/{serviceName}/*`. All routes should include JSDoc documentation for the factory function and use structured error handling with logging.

**Workflow Service UI:**
The Workflow Service includes an interactive **UI tab** (`src/workflow/views/index.html`) for managing workflows without code:
- **Left Navigation**: Browse all defined workflows with search functionality
- **Workflow Editor**: View/edit workflow definitions and steps
- **Executions Tab**: Monitor execution history with status filtering (Completed, Running, Error)
- **Details Panel**: View execution data in collapsible right panel
- **Workflow Creator**: Interactive form to create new workflows with custom steps
- **Responsive Design**: Adapts to mobile/tablet screens
Layout: Left nav (resizable) → Main content (editor/list) → Right panel (execution details, collapsible)

**Scheduling Service UI:**
The Scheduling Service includes an interactive **UI tab** (`src/scheduling/views/index.html`) for managing schedules without code:
- **Left Navigation**: Browse all defined schedules with search functionality and "New Schedule" button
- **Schedule Editor**: View schedule details including ID, CRON expression, creation date, and status
- **Activity Definition**: View the JSON activity definition that will be executed on schedule
- **Executions Tab**: Monitor execution history with status filtering (Completed, Running, Error)
- **Schedule Creator**: Interactive form to create new schedules with:
  - Schedule name field
  - CRON expression with common presets (Every Hour, Daily, Weekly, Monthly)
  - JSON activity definition editor with format helper
- **Responsive Design**: Three-panel layout (left nav, center editor, collapsible right panel)
Layout: Left nav (schedules list) → Center content (details/executions/create form)

**Searching Service UI:**
The Searching Service includes multiple interactive tabs (`src/searching/views/index.html`):
- **Dashboard Tab**: Analytics and statistics for search operations
- **UI Tab**: End-user document search interface
  - **Search Box** with real-time autocomplete suggestions (debounced 300ms)
  - **Index Selector Dropdown**: Choose specific search index or search all
  - **Search Suggestions Dropdown**: Dynamically populated from indexed documents
  - **Results Display**: Shows matching documents with formatted content
  - **Key Features**:
    - Type-ahead search with instant suggestions
    - Click suggestions to auto-fill search box
    - Index-specific searching
    - Press Enter to execute search
    - Results displayed with document fields and values
    - Clear button to reset search state
    - Custom events (`searchUIResults`, `searchUIResultSelected`) for application integration
- **Data Operations Tab**: Index management, CRUD operations, and API testing
- **Settings Tab**: Service configuration interface
  - **Dynamic form generation** based on available settings from API
  - **Type-aware form fields**: text, number, date, select/dropdown, etc.
  - **Settings rendering** with descriptions and helper text
  - **Save/Reload buttons** for managing settings persistence
  - Form submission to `/api/settings` endpoint
- **Client-Side Library** (`src/searching/scripts/js/index.js`):
  - Supports both remote (server) and local (browser-only) search
  - Methods: `search()`, `addDocument()`, `deleteDocument()`, `getSuggestions()`
  - Usage: `new searchService({ provider: 'remote' })` for server-side or `new searchService()` for client-side
- **Responsive Design**: Single-column layout with search header, suggestions, and results area
Layout: Content header → Search box with index dropdown and suggestions → Results container

**Multi-Instance Support:**
Services support named instances via `instanceName` option. Retrieve specific instances with:
```javascript
registry.getService('caching', 'redis', { instanceName: 'session-cache' });
registry.getServiceInstance('caching', 'redis', 'session-cache');  // Retrieve existing
```

Use named instances when you need:
- **Multiple caches with different TTLs** - Session cache (1 hour TTL) vs application cache (24 hour TTL)
- **Separate persistence backends** - One database for transactions, another for analytics
- **Service isolation** - Different services using the same provider type with separate configurations
- **Failover strategies** - Primary and secondary instances of the same service

Example: Setting up separate session and data caches:
```javascript
const sessionCache = registry.cache('redis', {
  instanceName: 'sessions',
  ttl: 3600,  // 1 hour
  host: 'localhost'
});

const dataCache = registry.cache('redis', {
  instanceName: 'data',
  ttl: 86400,  // 24 hours
  host: 'localhost'
});
```

## Provider Selection Guide

Choose providers based on deployment context and requirements:

**Caching Service:**
- `memory` - Development, testing, single-instance deployments (fast, no external deps)
- `file` - Low-volume caching, development, basic persistence needs
- `redis` - Production distributed systems, high-throughput, excellent performance
- `memcached` - Legacy systems, distributed environments where Redis is unavailable
- `aws`, `azure`, `gcp` - Cloud-native deployments with managed caching services

**Data Service:**
- `file` - Development, testing, configuration storage, small datasets
- `memory` - Unit testing, ephemeral data, prototyping
- `mongodb` - Document-heavy workloads, nested structures, flexible schemas (production)
- `documentdb` - AWS-hosted MongoDB-compatible option
- `simpledb` - AWS SimpleDB for lightweight structured data

**Queueing Service:**
- `memory` - Development, testing, single-instance processing
- `redis` - Production systems with reliable message delivery required
- `rabbitmq` - Enterprise message queuing with advanced routing
- `aws`, `azure`, `gcp` - Cloud-native queue services for serverless architectures

**Logging Service:**
- `memory` - Testing only (logs lost on restart)
- `file` - Development and production (local file persistence to `./.application/logs/`)
- `api` - Centralized logging backends (Datadog, ELK, etc.)

## Service Configuration Best Practices

When initializing services, pass configuration through options:

```javascript
// Example: Cache with specific configuration
const cache = registry.cache('redis', {
  instanceName: 'session-cache',  // Named instance for multiple instances of same type
  ttl: 3600,                       // Time-to-live in seconds
  host: 'localhost',               // Provider-specific options
  port: 6379,
  dependencies: { logging: logger }
});

// Example: Data service with MongoDB
const dataService = registry.dataService('mongodb', {
  connectionString: 'mongodb://localhost:27017',
  database: 'production_db',
  dependencies: { logging: logger }
});
```

Refer to individual provider files in `src/{serviceName}/providers/` for complete option signatures.

## Service Interaction Patterns

**Cross-Service Communication:**
Services interact primarily through:
1. **Dependency Injection** - Services pass dependencies during initialization
2. **Event Emitter** - Global event emitter for asynchronous notifications
3. **Direct API Calls** - Services call each other's methods when needed

**Common Service Dependencies:**
```javascript
// Workflow depends on queueing and scheduling
const workflow = registry.workflow('memory', {
  dependencies: {
    logging: loggerService,
    queueing: queueService,
    scheduling: schedulingService,
    dataservice: dataService
  }
});

// Searching enhances results with caching
const searching = registry.searching('memory', {
  dependencies: {
    logging: loggerService,
    caching: cacheService,
    dataservice: dataService
  }
});
```

Services automatically resolve their dependencies when passed to the ServiceRegistry; you typically don't need to manually inject unless creating services directly.

## Important Notes for Contributors

**Requesting Service:**
The requesting service has been refactored and its functionality is being consolidated with the fetching service. Avoid creating new dependencies on the requesting service; use the fetching service instead for HTTP operations.

**Linting and Code Quality:**
Currently, there is no linting script configured (no ESLint or similar). Code quality is maintained through:
- Comprehensive JSDoc comments for all public methods
- Structured logging with optional chaining pattern
- Consistent use of const/let instead of var
- Tests verifying functionality and preventing regressions

**Feature Branches:**
When making changes, create atomic, focused commits with conventional commit messages:
- `feat(service-name): add new feature`
- `fix(service-name): resolve specific bug`
- `refactor(service-name): improve code structure`
- `test(service-name): add test coverage`
- `docs(service-name): update documentation`

## Debugging & Troubleshooting

**Debug a Specific Service in Isolation:**
1. Run the appropriate test app: `node tests/app/serviceName/app-*.js`
2. Access the service dashboard at `http://localhost:11000/services/serviceName/`
3. Use browser DevTools or add logging to trace execution
4. Check `./.application/logs/` for file-based logs

**Monitor Service Initialization:**
```javascript
// Listen to service creation events
eventEmitter.on('service:created', (data) => {
  console.log(`Service initialized: ${data.serviceName}:${data.providerType}`);
  console.log(`Dependencies: ${data.dependencies?.join(', ')}`);
});

// Validate dependencies before proceeding
try {
  registry.validateDependencies();
} catch (err) {
  console.error('Dependency issues:', err.message);
}
```

**Common Issues & Solutions:**
- **Service won't start**: Check environment variables, verify external services (Redis, MongoDB) are running if needed
- **Tests timeout**: Increase Jest timeout or check for unresolved promises; run `npm run tests -- --detectOpenHandles`
- **Memory growth**: Monitor event listener cleanup; services should emit lifecycle events for proper teardown
- **Port conflicts**: Use `npm run kill` or `npm run kill-test` to free ports 11000 and 3101
- **Cache misses**: Verify provider is correctly initialized and TTL settings are appropriate

## Error Handling & Common Patterns

**Service Initialization Errors:**
- Always validate dependencies are properly initialized before accessing a service
- Use `serviceRegistry.validateDependencies()` to check for circular dependencies or missing dependencies
- If a service fails to initialize, check environment variables and ensure all required providers are available

**Event Emitter Usage:**
- Services communicate via a global EventEmitter - listen to events for lifecycle notifications
- Common events: `service:created`, `api-auth-setup`, `cache:hit`, `cache:miss`, `log:info`, `auth:login`, etc.
- Be aware that event listeners are not removed automatically; use `.off()` or `.removeListener()` to prevent memory leaks

**Provider-Specific Issues:**
- Some tests are disabled requiring external services (Redis, Memcached, MongoDB) - see "Known Test Patterns & Disabled Tests" below
- File-based providers work without external dependencies but are slower than Redis/Memcached
- MongoDB providers require connection string configuration and a running MongoDB instance

**Async/Await Best Practices:**
- All data operations are asynchronous - always use `await` when calling service methods
- All service factory functions return service instances; actual operations return Promises
- Error handling: wrap service calls in try/catch or use `.catch()` on Promises

## Code Quality & Refactoring Status

**Completed Refactoring (4 Phases):**
1. **Phase 1**: Replaced 28 `var` declarations with `const`/`let` in 14 core provider files
2. **Phase 2**: Routed ~85 console.* calls through logging service with structured metadata in 13 cloud provider and dataservice files
3. **Phase 3**: Added 470+ lines of comprehensive JSDoc to 6 base classes (appBase, appServiceBase, appRouteBase, appViewBase, appWorkerBase, appDataBase)
4. **Phase 4**: Documented all 30+ provider files with method-level JSDoc including @param, @return, @throws, @example

**Code Style Requirements:**
- ✅ Use `const`/`let` (no `var`)
- ✅ Use `async/await` (no Promise chains)
- ✅ Use `this.logger?.info()` for logging (no `console.log`, `console.warn`, `console.error`)
- ✅ Add JSDoc for all public methods and classes
- ✅ Use structured logging metadata with error/context information
- ✅ Optional chaining (`?.`) to fail silently when logger unavailable

**Test Patterns & Disabled Tests:**
Some tests are disabled (`.disable.js` or `.disabled.js`):
- `tests/unit/filing/filing.disabled.js`
- `tests/unit/caching/cacheRedis.disabled.js` - Requires Redis
- `tests/unit/caching/cacheMemcached.disable.js` - Requires Memcached
- `tests/unit/dataservice/simpleDb.disabled.js` - Requires SimpleDB
- `tests/unit/integration/apiKeyIntegration.disabled.js`

These typically require external services or specific configuration. Run the enabled tests with `npm run tests` to verify changes don't break existing functionality.

## Debugging & Monitoring

The ServiceRegistry provides monitoring endpoints at `/services/api/monitoring/`:
- `GET /services/api/monitoring/metrics` - System metrics
- `GET /services/api/monitoring/snapshot` - Current snapshot

All services emit lifecycle events through the global EventEmitter. Monitor these for debugging:
```javascript
const eventEmitter = new EventEmitter();
eventEmitter.on('service:created', (data) => console.log('Service created:', data));
eventEmitter.on('api-auth-setup', (data) => console.log('Auth configured:', data));
```

## Skill Commands

This repository has configured skill commands available in Claude Code:

### `/refactor` - Refactor Codebase for Modern Standards
Refactors selected code or entire codebase to use modern JavaScript best practices:
- Replace Promise chains with async/await
- Use const/let instead of var
- Remove console.log statements (use logging service)
- Add comprehensive JSDoc documentation
- Add input validation and error handling
- Use destructuring and template literals
- Maintain 100% backward compatibility

**Note**: This project has already completed a comprehensive 4-phase refactoring covering var declarations, console.log routing through logging service, and JSDoc documentation for base classes and 30+ provider files. For future contributions, follow the refactoring patterns established: use `this.logger?.info()` with structured metadata instead of console statements.

### `/security-audit` - Security Audit
Performs security analysis on selected code to identify vulnerabilities:
- SQL injection, XSS, command injection detection
- Sensitive data exposure (API keys, tokens)
- Insecure cryptography and authentication
- Input validation issues
- Dependency vulnerabilities

### `/generate-swagger` - Generate Swagger Documentation
Generates OpenAPI/Swagger documentation from code:
- Parses service endpoints and route handlers
- Extracts parameter and response types from JSDoc
- Generates OpenAPI 3.0 specification
- Creates interactive API documentation

### `/update-docs` - Update Documentation
Updates project documentation to reflect code changes:
- Regenerates documentation from JSDoc comments
- Updates service usage guides
- Updates API references
- Maintains documentation consistency with code

Use these commands when working on significant features or refactoring efforts.

## Refactoring Patterns & Best Practices

### Logging Service Integration

When adding logging to server-side code, use the optional chaining pattern that fails silently:

```javascript
// ✅ CORRECT: Structured logging with metadata
this.logger?.info(`[${this.constructor.name}] Operation completed`, {
  setting: this.settings.name,
  newValue: newValue,
  duration: endTime - startTime
});

// ✅ CORRECT: Warning with error context
this.logger?.warn(`[${this.constructor.name}] Fallback triggered`, {
  error: error.message,
  provider: this.provider_,
  operation: 'getClusterMode'
});

// ❌ INCORRECT: Console statements (deprecated)
console.log('Operation completed');
console.warn('Fallback triggered:', error.message);

// ❌ INCORRECT: Logging without context
this.logger?.info('Setting changed'); // No metadata about which setting
```

### Variable Declaration

Replace all `var` with `const` or `let` with appropriate scoping:

```javascript
// ✅ CORRECT: Use const for values that don't change
const maxRetries = 5;
const settings = await this.getSettings();

// ✅ CORRECT: Use let for loop counters and reassigned values
for (let i = 0; i < settings.list.length; i++) {
  if (settings.list[i].setting != null) {
    this.settings[settings.list[i].setting] = newValue;
  }
}

// ❌ INCORRECT: var declarations (deprecated)
var i = 0;
var settings = { ... };
```

### JSDoc for New Methods

All new public methods should include comprehensive JSDoc:

```javascript
/**
 * Retrieves all queue names from the specified region.
 * Lists all Cloud Task queues in the configured region with optional filtering.
 *
 * @return {Promise<Array<string>>} A promise that resolves to an array of queue names
 * @throws {Error} If the list operation fails
 *
 * @example
 * // List all queues
 * const queues = await provider.listQueues();
 * console.log(`Found ${queues.length} queues`);
 */
async listQueues() {
  try {
    // implementation
  } catch (err) {
    this.logger?.error(`[${this.constructor.name}] Failed to list queues`, {
      error: err.message
    });
    throw err;
  }
}
```

### Cloud Provider Configuration

Cloud providers include detection methods for their specific features:

```javascript
// AWS: Detect ElastiCache cluster mode
const config = await cacheAWS.detectClusterMode();
// Returns: { mode, endpoint, port, region, tlsEnabled }

// Azure: Detect Cache tier
const tierInfo = await cacheAzure.detectCacheTier();
// Returns: { tier, estimatedTier, maxMemory, usedMemory, resourceGroup, resourceName }

// GCP: Detect Memorystore configuration
const memConfig = await cacheGCP.detectMemorystoreConfig();
// Returns: { tier, estimatedTier, memorySizeGb, projectId, region, instanceId, network }
```

### Git Workflow for Changes

Follow this pattern when making changes:

1. Make changes to one or more files
2. Run tests: `npm test`
3. Create atomic commit with conventional format:
   ```bash
   git commit -m "refactor(service-name): brief description of change"
   # Examples:
   # git commit -m "refactor(caching): replace console.warn with logger in cachingAWS.js"
   # git commit -m "docs(workflow): add JSDoc to executeWorkflow method"
   # git commit -m "fix(dataservice): handle null values in saveSettings"
   ```
4. Tag phase completion if applicable:
   ```bash
   git tag refactor-phase-4-complete
   ```

### When to Create New Services

Follow these principles before creating a new service:

1. **Check existing services** - Determine if functionality exists or can be added to existing service
2. **Follow the factory pattern** - Create `src/newservice/index.js` as factory function
3. **Support multiple providers** - Include at least a memory/default provider and one external provider
4. **Implement standard structure**:
   - `index.js` - Factory with dependency injection
   - `routes/index.js` - REST API endpoints
   - `views/index.html` - UI dashboard
   - `providers/` - Multiple backend implementations
   - `modules/analytics.js` - Metrics tracking
5. **Register in ServiceRegistry** - Add factory method to root `index.js`
6. **Document dependencies** - Clearly state what services this depends on
7. **Add comprehensive tests** - Unit tests for each provider type

### Performance Considerations

**Per-Service Optimization:**

**Logging:**
- Structured logging has minimal performance impact (~0.1ms per call with optional chaining)
- Avoid logging in tight loops; batch or log periodically instead
- File-based logging slower than memory, consider external services (Datadog, ELK) for high-volume production

**Caching:**
- Memory caching fastest for single instances but doesn't scale across processes
- Redis provides both speed and distribution; use for session/distributed caches
- Monitor cache hit rates via analytics; <30% hit rate indicates poor TTL or strategy
- Set appropriate TTLs to prevent stale data and memory bloat

**Data Service:**
- File-based persistence adequate for development but slow for production workloads
- MongoDB handles large datasets and complex queries efficiently
- Add database indices on frequently queried fields
- Use connection pooling for cloud providers

**Workflow & Scheduling:**
- Use queueing for long-running steps instead of blocking execution
- Break large workflows into smaller steps with explicit checkpoints
- Monitor execution times to identify bottleneck steps
- Use caching for frequently accessed data within workflow steps

**Searching:**
- Pre-index documents on creation; avoid runtime indexing
- Use caching to avoid re-searching identical queries
- Monitor analytics to find slow or unused indices

Example logging optimization:
```javascript
// ❌ SLOW: Logs for every iteration
for (const item of largeArray) {
  this.logger?.info('Processing', { itemId: item.id });
}

// ✅ BETTER: Log periodically
for (let i = 0; i < largeArray.length; i++) {
  if (i % 1000 === 0) {
    this.logger?.info('Batch progress', { count: i, total: largeArray.length });
  }
}
```

## Performance Monitoring System

The Noobly JS Core includes a comprehensive performance monitoring system using Node.js `perf_hooks` to track system metrics and application-level operation timing.

### System Metrics Tracked

The Service Registry Dashboard automatically displays:

- **Event Loop Lag** - Detects when the event loop is blocked (indicates synchronous blocking)
- **Garbage Collection (GC)** - Tracks GC events, duration, and type
- **Heap Memory** - Monitors heap size and memory breakdown
- **Process Memory** - Tracks RSS, heap usage, external memory, ArrayBuffers
- **Operation Performance Marks** - Custom operation timing from services

### Monitoring Integration

Services can track operation performance using the PerformanceHelper:

```javascript
const performanceHelper = require('./views/modules/performanceHelper');

// Simple operation tracking
const end = performanceHelper.startOperation('operation-name', { metadata: 'context' });
try {
  // Perform operation
  end();
} catch (error) {
  end(error); // Records failed operations
}

// Automatic async measurement
const result = await performanceHelper.measureAsync('database-query', async () => {
  return await db.find();
});

// Batch operations with aggregated stats
const tracker = performanceHelper.createBatchTracker('bulk-import');
for (const item of items) {
  const end = tracker.track('import-item');
  await processItem(item);
  end();
}

// Get performance statistics
const stats = performanceHelper.getStats('operation-name');
if (stats.avg > 100) {
  logger?.warn('Slow operation detected', {
    operation: stats.name,
    average: stats.avg,
    count: stats.count
  });
}
```

### Dashboard Visualization

The Service Registry Dashboard provides:
1. **Event Loop Lag Graph** - Visual trend of blocking over time
2. **Garbage Collection Graph** - GC events and duration
3. **Heap Memory Graph** - Memory usage patterns
4. **Performance Marks Table** - All tracked operations with statistics (avg/min/max)

Performance is color-coded:
- Green: Average < 50ms (good)
- Yellow: Average 50-100ms (acceptable)
- Red: Average > 100ms (needs optimization)

### When to Use Performance Monitoring

Add performance tracking to:
- **Critical service methods** - Cache get/set, database queries, API calls
- **Long-running operations** - Batch imports, workflow execution, complex calculations
- **External service calls** - HTTP requests, cloud API calls
- **Event handlers** - Endpoints that might be called frequently

### Performance Monitoring Documentation

For detailed information, see:
- `docs/PERFORMANCE_MONITORING.md` - Complete guide with best practices
- `docs/PERFORMANCE_INTEGRATION_EXAMPLE.md` - Step-by-step integration examples
- `docs/PERFORMANCE_MONITORING_IMPLEMENTATION.md` - Technical implementation details

### Example: Integrating with Cache Service

```javascript
// src/caching/providers/caching.js
const performanceHelper = require('../../views/modules/performanceHelper');

async get(key) {
  const end = performanceHelper.startOperation('cache-get', { key });
  try {
    const value = this.cache[key]?.value;
    end();
    return value;
  } catch (error) {
    end(error);
    throw error;
  }
}

async set(key, value, ttl) {
  return performanceHelper.measureAsync('cache-set', async () => {
    this.cache[key] = { value, expiresAt: Date.now() + (ttl * 1000) };
    return true;
  }, { key, ttl });
}
```

### Performance Monitoring Benefits

1. **Identify Bottlenecks** - See which operations are slow
2. **Track Trends** - Monitor performance degradation over time
3. **Event Loop Health** - Detect synchronous blocking issues
4. **Memory Analysis** - Track heap growth and GC impact
5. **Service-Level Insights** - Understand per-operation performance characteristics

### Best Practices

- Use meaningful operation names (e.g., `cache-redis-get` not just `get`)
- Include relevant metadata for debugging correlation
- Monitor at service boundaries and critical paths
- Use batch trackers for repeated operations
- Set threshold alerts for operations with SLO requirements
- Review metrics regularly to identify trends and optimization opportunities
