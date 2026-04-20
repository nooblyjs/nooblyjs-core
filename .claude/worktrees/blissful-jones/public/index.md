header

  icon: /images/s-tech-logo-colour.png
  title: Digital Technologies Core
  links: [Services](/services/) [Bitbucket](https://bitbucket.org/shopritelabs/digital-technologies-core/src)

---

hero-banner

  title: Digital Technologies Core
  subtitle: Enterprise-Grade Modular Node.js Backend Framework — Production-ready services with dependency injection, event-driven architecture, and comprehensive tooling.

---

## Welcome to Digital Technologies Core

A powerful, production-ready backend framework providing a complete suite of services with singleton pattern implementation, managed through a central ServiceRegistry. Build sophisticated applications with minimal boilerplate.

**Version**: 2.0.1 | **Status**: Production Ready | **License**: Shoprite Owned

---

## Quick Overview

```container
  left
### 🏗️ Architecture at a Glance

Digital Technologies Core uses a **5-level dependency hierarchy** to organize services:

- **Level 0**: Foundation (Logging)
- **Level 1**: Infrastructure (Caching, Queueing, Fetching, Notifying)
- **Level 2**: Business Logic (Data, Workers, Metrics)
- **Level 3**: Application (Scheduling, Workflows, Search, Filing)
- **Level 4**: Integration (Authentication, AI)

right

This layered approach ensures clean dependencies, easy testing, and seamless service composition.

### 🔧 30+ Production-Ready Services

Out-of-the-box services for:
- **Data Persistence** - File, MongoDB, DocumentDB, SimpleDB
- **Caching** - Memory, Redis, Memcached, AWS ElastiCache, Azure Redis, GCP Memorystore
- **Queueing** - In-memory, Redis, RabbitMQ, AWS SQS, Azure Queue, GCP Cloud Tasks
- **Workflows & Scheduling** - Task automation, CRON jobs, visual workflow editor
- **Search** - Full-text search with analytics and caching
- **File Operations** - Local, FTP, S3, Git, Sync providers
- **Authentication** - File, Memory, Passport, OAuth (Google)
- **AI Integration** - Claude, OpenAI, Ollama
- **Logging & Monitoring** - Structured logging, metrics, real-time dashboards

```

## Core Capabilities

```container

  left

  ### Dependency Injection
  Automatic resolution of service dependencies with circular dependency detection. Services initialize in dependency order with clean, testable patterns.

  ### Event-Driven Architecture
  Comprehensive EventEmitter integration for service lifecycle. Emit and listen to events for decoupled, reactive applications.

  ### Multi-Provider Support
  Each service supports multiple backends. Switch implementations effortlessly:
  - Testing: In-memory providers
  - Development: File-based providers
  - Production: Cloud or external services

  right

  ### Built-in Authentication
  Multiple auth strategies including file-based, memory, Passport.js, and OAuth. Sessions and API key management included.

  ### AI-Powered Features
  Native integration with Claude, OpenAI, and Ollama. Handle prompts, completions, and context management seamlessly.

  ### Observability & Monitoring
  Structured logging, metrics collection, and monitoring endpoints. Track service lifecycle, performance, and health in real-time.

```

## Key Features

```three-column
  left
### Advanced Task Queueing
Production-grade task queues with:
- In-memory and Redis implementations
- AWS SQS integration
- RabbitMQ support
- Azure Queue Storage & GCP Cloud Tasks
- Job persistence and retry logic
- Execution monitoring
  middle
### Intelligent Caching
Multi-tier caching strategy:
- Memory cache with LRU eviction
- Redis & Memcached support
- AWS ElastiCache cluster mode detection
- Azure Redis tier detection
- GCP Memorystore integration
- Analytics and hit rate monitoring
  right
### Flexible Data Persistence
Transparent backend switching:
- File-based storage
- MongoDB integration
- AWS DocumentDB
- AWS SimpleDB
- In-memory data structures
- Query & filter APIs
- Automatic index management
```

```three-column
  left
### Workflow Orchestration
Build complex automation:
- Visual workflow editor
- Conditional logic & branching
- Parallel task execution
- API integrations
- Data transformation
- Execution history & monitoring
- Real-time status tracking
```

## Getting Started

### Installation & Setup
```bash
npm install
npm run dev:web          # Start with auth (port 11000)
npm run dev:web:noauth   # Start without auth (testing)
```

### Configuration
Create a `.env` file for local development:
```
PORT=11000
NODE_ENV=development
API_KEYS=dev-key-1,dev-key-2
SESSION_SECRET=your-session-secret
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
```

### Create Your First Service
Services use factory pattern with dependency injection:
```javascript
const registry = require('./index');
const cache = registry.cache('redis', {
  dependencies: { logging: logger }
});
```

### Development Commands
```bash
# Development
npm run dev:web              # Start with authentication
npm run dev:web:noauth       # Start without auth

# Testing
npm run tests                # Run all tests
npm run tests -- --watch     # Watch mode
npm run tests -- --coverage  # Coverage report

# Docker
npm run docker:build         # Build image
npm run docker:run           # Run container
npm run docker:publish       # Push to Docker Hub

# Utilities
npm run kill                 # Kill port 11000
npm run analyze-tokens       # Analyze token usage
```

---

## Documentation

### Core Documentation

```wiki-link
path: /ARCHITECTURE.md
title: Architecture Guide
subtitle: System design and patterns
content: Deep dive into microservice architecture, dependency layers, service registry pattern, and component interaction.

---

path: /API REFERENCE.md
title: API Reference
subtitle: Complete endpoint documentation
content: Comprehensive reference for all API endpoints, parameters, authentication, request/response formats, and error handling.

---

path: /PRODUCT REQUIREMENTS.md
title: Product Requirements
subtitle: Features and specifications
content: Complete product specification document outlining all features, requirements, and system capabilities.

---

path: /USER GUIDE.md
title: User Guide
subtitle: Getting started and tutorials
content: Step-by-step guides for setting up your environment, creating services, and building workflows.

---

path: /USAGE GUIDE.md
title: Usage Guide
subtitle: In-depth usage documentation
content: Detailed explanations of core concepts, service patterns, configuration, and practical examples.

---

path: /USAGE GUIDE CONCISE.md
title: Quick Reference
subtitle: Concise usage guide
content: Quick reference with essential commands, common patterns, and frequently used operations.
```

---

## Service Documentation

### Infrastructure & Core Services

```wiki-link
path: /usage/logging-service-usage.md
title: Logging Service
subtitle: Structured logging and monitoring
content: Complete guide to logging service with file, memory, and API providers. Includes log filtering, analytics, and best practices.

---

path: /usage/caching-service-usage.md
title: Caching Service
subtitle: Multi-provider caching system
content: In-memory, Redis, Memcached, and cloud caching. Configuration, TTL management, analytics, and performance tuning.

---

path: /usage/queueing-serice-usage.md
title: Queueing Service
subtitle: Reliable message queuing
content: Task queues with Redis, RabbitMQ, AWS SQS, Azure Queue, and GCP Cloud Tasks. Job processing and monitoring.

---

path: /usage/fetching-service-usage.md
title: Fetching Service
subtitle: HTTP client with caching
content: HTTP requests with Node.js or Axios. Request/response handling, error management, and caching integration.

---

path: /usage/notifying-service-usage.md
title: Notifying Service
subtitle: Notification delivery system
content: Send notifications through multiple channels. Configuration and integration patterns.
```

---

### Business Logic Services

```wiki-link
path: /usage/data-service-usage.md
title: Data Service
subtitle: Multi-backend data persistence
content: Data persistence with file, MongoDB, DocumentDB, and SimpleDB. CRUD operations, querying, and schema management.

---

path: /usage/measuring-service-usage.md
title: Measuring Service
subtitle: Metrics collection and aggregation
content: Collect and aggregate metrics. Real-time monitoring and analytics. Dashboard integration.

---

path: /usage/working-service-usage.md
title: Working Service
subtitle: Activity and worker execution
content: Execute activities and workers. Background job processing. Result handling and error management.
```

---

### Application Services

```wiki-link
path: /usage/scheduling-service-usage.md
title: Scheduling Service
subtitle: Task scheduling and CRON jobs
content: Schedule tasks with CRON expressions. Execution tracking, timezone support, and dashboard management.

---

path: /usage/searching-service-usage.md
title: Searching Service
subtitle: Full-text and indexed search
content: Full-text search with indexing, analytics, and caching. Search suggestions and advanced filtering.

---

path: /usage/workflow-service-usage.md
title: Workflow Service
subtitle: Workflow orchestration and automation
content: Build complex workflows visually. Steps, branching, parallel execution, API integration, and monitoring.

---

path: /usage/filing-service-usage.md
title: Filing Service
subtitle: File operations and storage
content: File management with local, FTP, S3, Git, and sync providers. Upload, download, synchronization.
```

---

### Integration Services

```wiki-link
path: /usage/auth-service-usage.md
title: Authentication Service
subtitle: User authentication and authorization
content: User management with file, memory, or Passport providers. OAuth integration, session management, token handling.

---

path: /usage/secure-email-auth-usage.md
title: Secure Email Authentication
subtitle: Email-based authentication flow
content: Secure email authentication implementation. OTP generation, verification, and user management.

---

path: /usage/ai-service-usage.md
title: AI Service
subtitle: AI model integration
content: Integrate Claude, OpenAI, and Ollama. Prompts, completions, context management, and token tracking.
```

---

## Reference & Guides

### Markdown Reference
Complete guide to creating beautiful documentation pages using custom markdown blocks:

```wiki-link
path: /usage/markdown-reference.md
title: Markdown Reference
subtitle: Custom blocks and formatting guide
content: Complete documentation for all custom markdown blocks including headers, footers, cards, wiki-links, layouts, diagrams, and more.
```

---

## Monitoring & Analytics

Monitor your application with built-in endpoints:

- `GET /services/api/monitoring/metrics` - System metrics
- `GET /services/api/monitoring/snapshot` - Current state snapshot
- Service dashboards at `/services/{serviceName}/`

Each service exposes analytics:
```javascript
const stats = cache.analytics.getAnalytics();
// Returns: { hits, misses, hitRate, etc. }
```

---

## Architecture Patterns

### Service Registry Pattern
```javascript
const registry = require('./index');

// Get service instances
const logger = registry.logger('file');
const cache = registry.cache('redis');
const data = registry.dataService('mongodb');

// Named instances for multiple configurations
const sessionCache = registry.cache('redis', {
  instanceName: 'session-cache'
});
```

### Structured Logging Pattern
```javascript
this.logger?.info(`[${this.constructor.name}] Operation completed`, {
  setting: value,
  duration: elapsed,
  error: error?.message
});
```

### Dependency Injection
Services receive dependencies as configuration:
```javascript
const service = registry.service('name', {
  dependencies: {
    logging: logger,
    caching: cache
  }
});
```

---

## Technology Stack

- **Runtime**: Node.js 18.0.0+ (legacy support: 12.11.0+)
- **Web Framework**: Express.js 4.x
- **Authentication**: Passport.js with multiple strategies
- **Storage**: MongoDB, Redis, Memcached, AWS/Azure/GCP SDKs
- **AI Providers**: Anthropic Claude, OpenAI, Ollama
- **Queue Systems**: RabbitMQ, Redis, AWS SQS, Azure Queue, GCP Cloud Tasks
- **Testing**: Jest with full coverage support
- **Documentation**: JSDoc with method-level specifications
- **Containerization**: Docker support included

---

## Security Features

✅ **API Key Authentication** - Built-in API key management
✅ **OAuth Integration** - Google OAuth support out-of-the-box
✅ **Session Management** - Secure session handling with configurable secrets
✅ **Password Security** - Hash-based authentication with file/memory providers
✅ **HTTPS Ready** - SSL certificate support for development
✅ **Input Validation** - Structured data validation across services
✅ **Error Handling** - Secure error messages without data leakage

---

## Performance Considerations

```three-column
  left
### Caching Strategy
- Use Redis/Memcached for distributed caching in production
- Configure appropriate TTLs
- Monitor cache hit rates via analytics
  middle
### Database Optimization
- Use MongoDB for document-heavy workloads
- Index frequently queried fields
- Use SimpleDB for lightweight data
right
### Queue Configuration
- Use Redis or RabbitMQ for reliable delivery
- Implement dead-letter queues
- Monitor queue depth and processing times
```

### Workflow Optimization
- Break large workflows into smaller steps
- Use caching for frequently accessed data
- Implement retry logic for transient failures



## Troubleshooting

### Service Initialization Fails
```javascript
// Check dependency validation
try {
  registry.validateDependencies();
} catch (error) {
  console.error('Dependency validation failed:', error.message);
}
```

### Cache Not Working
```javascript
const cache = registry.cache('memory');
console.log('Cache initialized:', cache !== null);
const stats = cache.analytics.getAnalytics();
console.log('Cache stats:', stats);
```

### Port Already in Use
```bash
npm run kill              # Kill port 11000
npm run kill-test        # Kill port 3101
```

---

## Contributing

To contribute to Digital Technologies Core:

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Write tests for your changes
3. Run tests: `npm test`
4. Use atomic commits with conventional messages:
   - `feat(service): add new feature`
   - `fix(service): resolve specific bug`
   - `refactor(service): improve code structure`
5. Push and open a pull request

---

## Support & Resources

- 📖 **Documentation** - Comprehensive guides in `/docs` directory
- 🔧 **API Reference** - Complete endpoint documentation
- 🏗️ **Architecture Guide** - System design and patterns
- 💻 **Source Code** - Well-commented, JSDoc-documented code
- 🐛 **Issue Tracking** - GitHub issues for bug reports
- 💬 **Discussions** - Community questions and answers

---

## Next Steps

1. **Explore Services** - Visit `/services/` to access service dashboards
2. **Read Documentation** - Start with User Guide or Quick Reference
3. **Try Examples** - See `/tests/app/` for working examples
4. **Build Something** - Create your first service using the factory pattern

---

## Environment Configuration

### Development
```bash
npm run dev:web          # With authentication
npm run dev:web:noauth   # Without authentication (testing)
```

### Testing
```bash
npm run tests            # Run all tests
npm run tests -- --coverage  # With coverage report
```

### Production
```bash
npm start                # Start production server
npm run docker:publish   # Build and push Docker image
```

---

**Version**: 2.0.1
**Last Updated**: February 2026
**Status**: Production Ready
**License**: ISC

footer

  icon: /images/s-tech-logo-colour.png
  title: Digital Technologies Knowledge Platform
  subtitle: © 2026 Digital Technologies. All rights reserved. This information is proprietary to Shoprite Checkers (Pty) Ltd and is confidential.
  links: [Bitbucket](https://bitbucket.org/shopritelabs/digital-technologies-core/src) [Documentation](/) [Contact](mailto:srbooysen@shoprite.co.za)

---
