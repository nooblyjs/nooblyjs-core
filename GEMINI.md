# Noobly JS Core - Agent Instructions

This document provides essential context and instructions for AI agents working on the **Noobly JS Core** project.

## Project Overview
Noobly JS Core is a modular Node.js backend framework built using a singleton `ServiceRegistry` pattern. It provides a suite of enterprise-grade services (caching, logging, data, filing, workflow, AI, etc.) that can be used independently or as a cohesive framework.

### Architecture & Service Hierarchy
Services are organized into a 5-level dependency hierarchy. The `ServiceRegistry` (in `index.js`) manages these dependencies and ensures they are initialized in the correct order.

| Level | Classification | Services | Description |
|-------|----------------|----------|-------------|
| **0** | **Foundation** | `logging` | No dependencies. The base for all other services. |
| **1** | **Infrastructure** | `caching`, `queueing`, `notifying`, `fetching`, `appservice` | Depend only on Level 0. |
| **2** | **Business Logic**| `dataservice`, `working`, `measuring` | Depend on Levels 0 and 1. |
| **3** | **Application** | `scheduling`, `searching`, `workflow`, `filing` | Depend on Levels 0, 1, and 2. |
| **4** | **Integration** | `authservice`, `aiservice` | Depend on all lower levels. |

### Key Technologies
- **Runtime:** Node.js (>= 12.11.0)
- **Web Framework:** Express.js
- **Testing:** Jest, Supertest, Nock
- **Cloud/External:** AWS (S3, SQS), Azure (Identity, Queue), Google Cloud (Storage), MongoDB, Redis, RabbitMQ
- **AI:** Anthropic (Claude), OpenAI, Ollama

## Development Conventions

### Service Structure
Each service is located in `src/{serviceName}/` and follows a consistent factory pattern:
1.  `index.js`: The factory function that initializes the service and its providers.
2.  `modules/`: Internal logic and utility modules.
3.  `providers/`: Implementations for different backends (e.g., `memory.js`, `redis.js`, `mongodb.js`).
4.  `routes/`: Express route definitions for the service's REST API.
5.  `views/`: HTML/JS/CSS for the service's web dashboard.

### Base Classes & Auto-Discovery
The `appservice` (`src/appservice/index.js`) provides base classes for building applications:
- `appViewBase.js`, `appRouteBase.js`, `appWorkerBase.js`, `appServiceBase.js`, `appDataBase.js`
- It automatically discovers and mounts files from `src/services/`, `src/data/`, `src/routes/`, `src/views/`, and `src/activities/`.

### Singleton Pattern
Always use the `ServiceRegistry` to obtain service instances:
```javascript
const serviceRegistry = require('./index');
const logger = serviceRegistry.logger('file');
const cache = serviceRegistry.cache('memory');
```

### Event-Driven Communication
Services should emit and listen to events via the global `EventEmitter` provided during initialization.
- Format: `service:action` (e.g., `cache:set`, `auth:login`).

### Testing Standards
- **Unit Tests:** Located in `tests/unit/`.
- **API Tests:** Located in `tests/api/`.
- **Load Tests:** Located in `tests/load/`.
- **Mocks:** Use `nock` for HTTP requests and `ioredis-mock` for Redis.

## Key Commands

| Command | Description |
|---------|-------------|
| `npm start` | Run the main application (`app.js`) |
| `npm run dev:web` | Run in development mode with nodemon |
| `npm run dev:web:noauth` | Run development mode without authentication (`app-noauth.js`) |
| `npm test` | Run all Jest tests |
| `npm run test-load` | Run load tests |
| `npm run docker:build` | Build the Docker image |
| `npm run kill` | Kill process running on the default port |

## Repository Structure
- `index.js`: The `ServiceRegistry` singleton.
- `app.js`: Main entry point/example app.
- `src/`: Core service implementations.
- `docs/`: Comprehensive markdown documentation.
- `tests/`: All test suites.
- `scripts/`: Utility scripts for development and maintenance.
- `public/`: Static assets for the web interface.

## Critical Files for Reference
- `package.json`: Dependencies and scripts.
- `README.md`: High-level overview and usage examples.
- `docs/ARCHITECTURE.md`: Detailed architectural design.
- `src/appservice/index.js`: Base classes and auto-discovery logic.
