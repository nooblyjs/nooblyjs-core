# Logging Service - Comprehensive Usage Guide

**Document Version**: 1.0
**Last Updated**: 2025-11-22
**Service Version**: 1.0.14+

---

## Table of Contents

1. [Overview](#overview)
2. [Service Initialization](#service-initialization)
3. [Provider Options](#provider-options)
4. [Service API (Node.js)](#service-api-nodejs)
5. [REST API Endpoints](#rest-api-endpoints)
6. [Client Library (Browser)](#client-library-browser)
7. [Analytics Module](#analytics-module)
8. [Scripts & Testing](#scripts--testing)
9. [Advanced Usage](#advanced-usage)
10. [Troubleshooting](#troubleshooting)
11. [Examples & Recipes](#examples--recipes)

---

## Overview

The **Logging Service** provides centralized application logging with multiple backend support. It abstracts logging complexity and provides a unified interface for capturing, storing, and retrieving logs.

### Key Features

- **Multi-provider support**: Choose from 3 different logging backends
- **Multiple log levels**: debug, info, warn, error
- **Analytics tracking**: Track log counts and distribution by level
- **Event-driven**: Emits events for all log operations
- **Named instances**: Run multiple independent logger instances
- **Client library**: Browser-friendly logging library
- **RESTful API**: Complete HTTP API for logging operations
- **Log filtering**: Filter logs by level in analytics

### Log Levels

| Level | Priority | Usage |
|-------|----------|-------|
| error | 0 (highest) | Critical errors, exceptions |
| warn | 1 | Warnings, deprecated features |
| info | 2 | General information, state changes |
| log/debug | 3 (lowest) | Detailed debugging information |

### Performance Characteristics

| Provider | Latency | Use Case | Persistence |
|----------|---------|----------|-------------|
| Memory | <1ms | Development, testing | No |
| File | 1-10ms | Production, persistent | Yes |
| API | 50-500ms | Remote logging service | Varies |

---

## Service Initialization

### Basic Setup

```javascript
const EventEmitter = require('events');
const createLoggingService = require('./src/logging');

const eventEmitter = new EventEmitter();

// Create memory-based logger
const logger = createLoggingService('memory', {
  instanceName: 'app-logger',
  level: 'info'
}, eventEmitter);

// Log messages
await logger.info('Application started');
await logger.warn('Deprecated API used');
await logger.error('Database connection failed');
await logger.debug('Processing request', { requestId: '123' });
```

### With Express Integration

```javascript
const express = require('express');
const app = express();
const serviceRegistry = require('./index');

// Initialize logging service with routes
const logger = serviceRegistry.logging('file', {
  instanceName: 'default',
  logDir: './.logs',
  level: 'info'
});

// Routes are automatically registered:
// - GET /services/logging/api/status
// - POST /services/logging/api/info
// - POST /services/logging/api/warn
// - POST /services/logging/api/error
// - GET /services/logging/api/logs
// - GET /services/logging/api/instances
// - GET /services/logging/scripts
```

---

## Provider Options

### Memory Provider

**Best for**: Development, testing, single-instance deployments

```javascript
const logger = createLoggingService('memory', {
  instanceName: 'app-logger',
  level: 'info'  // Minimum level to log
}, eventEmitter);
```

**Configuration Options**:
- `instanceName` (string): Unique identifier for this logger instance
- `level` (string): Minimum log level - 'error', 'warn', 'info', or 'log'
- `log.level` (string): Alternative way to set log level

**Characteristics**:
- In-process logging (no external dependencies)
- Logs stored only in memory
- Lost on application restart
- Best for development and testing
- Minimal overhead

---

### File Provider

**Best for**: Production, persistent logging, compliance requirements

```javascript
const logger = createLoggingService('file', {
  instanceName: 'app-logger',
  logDir: './.logs',           // Directory for log files
  filename: 'app.log',         // Optional custom filename
  maxSize: 10485760,           // 10MB, rotate when reached
  maxFiles: 5,                 // Keep 5 rotated files
  rotatePeriod: 'daily',       // Also rotate daily
  level: 'info'
}, eventEmitter);
```

**Configuration Options**:
- `logDir` (string): Directory path for log files (default: './.logs')
- `filename` (string): Custom log filename (default: 'app.YYYY-MM-DD.log')
- `maxSize` (number): Max file size in bytes before rotation (default: 10485760 = 10MB, set to 0 to disable)
- `maxFiles` (number): Max number of rotated log files to keep (default: 5)
- `rotatePeriod` (string): Rotation period: 'daily', 'hourly', or 'none' (default: 'daily')
- `level` (string): Minimum log level
- `log.level` (string): Alternative way to set log level

**Log Filename Format**:
- Default: `app.2025-11-22.log` (date-based, with automatic rotation)
- Custom: Any filename you specify

**File Structure (with rotation)**:
```
.logs/
├── app.2025-11-22.log       (current log file, ~10MB)
├── app.2025-11-22.1.log     (rotated file 1, most recent)
├── app.2025-11-22.2.log     (rotated file 2)
├── app.2025-11-22.3.log     (rotated file 3)
├── app.2025-11-22.4.log     (rotated file 4)
└── app.2025-11-22.5.log     (rotated file 5, oldest kept)
```

**Characteristics**:
- Persistent file-based logging
- Async I/O (non-blocking writes)
- Thread-safe write queue (safe for concurrent logging)
- Automatic log rotation by size and/or period
- Automatic retention policy (old files pruned)
- No external dependencies
- Excellent for production use
- Graceful error handling (rotation failures don't crash logging)

---

### API Provider

**Best for**: Remote logging service, microservices, centralized logging

```javascript
const logger = createLoggingService('api', {
  instanceName: 'app-logger',
  apiRoot: 'https://logging-service.example.com',  // or use 'api' option
  apiKey: process.env.LOGGING_API_KEY,
  timeout: 5000,
  level: 'info'
}, eventEmitter);
```

**Configuration Options**:
- `apiRoot` (string): Remote logging service base URL (aliases: `api`)
- `apiKey` (string): API authentication key (sent as `X-API-Key` header)
- `timeout` (number): Request timeout in milliseconds (default: 5000)
- `level` (string): Minimum log level

**Characteristics**:
- Remote logging service
- Centralized log management
- Network overhead
- Good for distributed systems
- Requires external service

---

## Service API (Node.js)

### Core Methods

#### `info(message, meta) → Promise<void>`

Log an informational message.

**Parameters**:
- `message` (string): Message to log
- `meta` (optional): Additional metadata (object or string)

**Example**:
```javascript
// Simple message
await logger.info('User logged in');

// With metadata
await logger.info('API request completed', {
  statusCode: 200,
  duration: 145,
  endpoint: '/api/users'
});

// With object
await logger.info('Cache initialized', {
  provider: 'redis',
  ttl: 3600,
  size: 1000
});
```

**Events Emitted**:
- `log:info:{instanceName}` - When message is logged

**Log Format**:
```
2025-11-22T10:30:45.123Z - INFO - hostname - message metadata
```

---

#### `warn(message, meta) → Promise<void>`

Log a warning message.

**Parameters**:
- `message` (string): Warning message
- `meta` (optional): Additional metadata

**Example**:
```javascript
// Deprecation warning
await logger.warn('Deprecated API endpoint used', {
  endpoint: '/old-api/users',
  replacement: '/api/v2/users'
});

// Resource warning
await logger.warn('Cache hit rate low', {
  hitRate: 0.35,
  threshold: 0.5
});

// Configuration warning
await logger.warn('Using default configuration', {
  setting: 'SESSION_SECRET',
  recommendation: 'Set in environment'
});
```

**Events Emitted**:
- `log:warn:{instanceName}` - When warning is logged

**Log Format**:
```
2025-11-22T10:30:45.123Z - WARN - hostname - message metadata
```

---

#### `error(message, meta) → Promise<void>`

Log an error message.

**Parameters**:
- `message` (string): Error message
- `meta` (optional): Error details or context

**Example**:
```javascript
// Database error
await logger.error('Database connection failed', {
  host: 'db.example.com',
  port: 5432,
  error: 'ECONNREFUSED'
});

// API error
await logger.error('Third-party API request failed', {
  service: 'payment-gateway',
  statusCode: 503,
  retryable: true
});

// Validation error
await logger.error('User input validation failed', {
  field: 'email',
  value: 'invalid-email',
  rule: 'email-format'
});
```

**Events Emitted**:
- `log:error:{instanceName}` - When error is logged

**Log Format**:
```
2025-11-22T10:30:45.123Z - ERROR - hostname - message metadata
```

---

#### `debug(message, meta) → Promise<void>`

Log a debug/generic message.

**Parameters**:
- `message` (string): Debug message
- `meta` (optional): Additional debugging info

**Example**:
```javascript
// Request debugging
await logger.debug('Processing request', {
  method: 'POST',
  path: '/api/users',
  ip: '192.168.1.1'
});

// State debugging
await logger.debug('Cache state changed', {
  oldSize: 100,
  newSize: 101,
  operation: 'put'
});

// Performance debugging
await logger.debug('Query execution', {
  query: 'SELECT * FROM users',
  duration: 45,
  rows: 1230
});
```

**Events Emitted**:
- `log:log:{instanceName}` - When debug message is logged

---

#### `log(message, meta) → Promise<void>`

Alias for `debug()`. Log a generic/debug message (identical to debug method).

**Parameters**:
- `message` (string): Log message
- `meta` (optional): Additional debugging info

**Example**:
```javascript
// Using log() as alias for debug()
await logger.log('Scheduled task executed', {
  taskName: 'cache-cleanup',
  duration: 1234
});

// log() and debug() are interchangeable
await logger.log('Processing complete');
await logger.debug('Processing complete');  // Identical behavior
```

**Events Emitted**:
- `log:log:{instanceName}` - When log message is logged

---

### Configuration Methods

#### `getSettings() → Promise<Object>`

Retrieve current logger settings.

**Returns**: Promise resolving to settings object

**Example**:
```javascript
const settings = await logger.getSettings();
console.log('Logger settings:', settings);

// Output:
// {
//   description: 'The only setting that is needed is the minloglevel',
//   list: [
//     { setting: 'minLogLevel', type: 'list', values: ['error', 'warn', 'info', 'log'] }
//   ],
//   minLogLevel: 'info'
// }
```

---

#### `saveSettings(settings) → Promise<void>`

Update logger settings.

**Parameters**:
- `settings` (object): Settings to update

**Example**:
```javascript
// Change log level
await logger.saveSettings({
  minLogLevel: 'debug'
});

// Verify change
const settings = await logger.getSettings();
console.log('New level:', settings.minLogLevel); // 'debug'
```

---

### Advanced Methods (Analytics)

The logger instance includes an `analytics` property providing log metrics and retrieval.

#### `analytics.list(level) → Array`

Retrieve logs from analytics, optionally filtered by level.

**Parameters**:
- `level` (string, optional): Filter by level - 'INFO', 'WARN', 'ERROR', 'LOG'

**Returns**: Array of log entries in newest-first order

**Example**:
```javascript
// Get all logs
const allLogs = logger.analytics.list();
console.log(`Total logs: ${allLogs.length}`);

// Get only errors
const errors = logger.analytics.list('ERROR');
console.log(`Error count: ${errors.length}`);

// Get warnings
const warnings = logger.analytics.list('WARN');
warnings.forEach(warn => {
  console.log(`${warn.timestamp}: ${warn.message}`);
});
```

**Log Entry Structure**:
```javascript
{
  level: 'INFO',
  message: '2025-11-22T10:30:45.123Z - INFO - hostname - message',
  timestamp: '2025-11-22T10:30:45.123Z',
  capturedAt: 1700641845123
}
```

---

#### `analytics.getCount() → Number`

Get total number of logs stored.

**Returns**: Total count of all logs

**Example**:
```javascript
const count = logger.analytics.getCount();
console.log(`Logs stored: ${count}`);
```

---

#### `analytics.getCountByLevel(level) → Number`

Get count of logs at specific level.

**Parameters**:
- `level` (string): Log level - 'INFO', 'WARN', 'ERROR', 'LOG'

**Returns**: Count of logs at that level

**Example**:
```javascript
const infoCount = logger.analytics.getCountByLevel('INFO');
const warnCount = logger.analytics.getCountByLevel('WARN');
const errorCount = logger.analytics.getCountByLevel('ERROR');

console.log(`Info: ${infoCount}, Warn: ${warnCount}, Error: ${errorCount}`);
```

---

#### `analytics.getStats() → Object`

Get comprehensive logging statistics.

**Returns**: Object with counts and percentages for each level

**Example**:
```javascript
const stats = logger.analytics.getStats();
console.log('Logging statistics:', stats);

// Output:
// {
//   totalLogs: 250,
//   INFO: { count: 150, percentage: 60 },
//   WARN: { count: 60, percentage: 24 },
//   ERROR: { count: 30, percentage: 12 },
//   LOG: { count: 10, percentage: 4 }
// }
```

---

#### `analytics.clear() → void`

Clear all stored logs from analytics.

**Example**:
```javascript
logger.analytics.clear();
console.log('Analytics cleared');
console.log(`Remaining logs: ${logger.analytics.getCount()}`); // 0
```

---

## REST API Endpoints

### Endpoints Overview

```
Default Instance Routes:
  POST   /services/logging/api/info            - Log info message
  POST   /services/logging/api/warn            - Log warning message
  POST   /services/logging/api/error           - Log error message
  GET    /services/logging/api/logs            - Get logs from analytics
  GET    /services/logging/api/status          - Service status
  GET    /services/logging/api/instances       - List instances
  GET    /services/logging/scripts             - Get client library

Named Instance Routes:
  POST   /services/logging/api/:instanceName/info
  POST   /services/logging/api/:instanceName/warn
  POST   /services/logging/api/:instanceName/error
  GET    /services/logging/api/:instanceName/logs
```

### Detailed Endpoint Documentation

#### POST: Log Info Message

**Endpoint**: `POST /services/logging/api/info`

**Request Body**: String or object message

**Response**:
- Success: `200 OK` with body `"OK"`
- Error: `400 Bad Request` if missing message, or `500 Internal Server Error`

**Example**:
```bash
# Log string message
curl -X POST http://localhost:3001/services/logging/api/info \
  -H "Content-Type: application/json" \
  -d '"Application started"'

# Log with object
curl -X POST http://localhost:3001/services/logging/api/info \
  -H "Content-Type: application/json" \
  -d '{"message": "User login", "userId": 123, "timestamp": "2025-11-22T10:30:00Z"}'

# Named instance
curl -X POST http://localhost:3001/services/logging/api/audit/info \
  -H "Content-Type: application/json" \
  -d '"User modified configuration"'
```

---

#### POST: Log Warning Message

**Endpoint**: `POST /services/logging/api/warn`

**Request Body**: String or object message

**Response**:
- Success: `200 OK` with body `"OK"`
- Error: `400 Bad Request` or `500 Internal Server Error`

**Example**:
```bash
curl -X POST http://localhost:3001/services/logging/api/warn \
  -H "Content-Type: application/json" \
  -d '"Cache hit rate below threshold"'
```

---

#### POST: Log Error Message

**Endpoint**: `POST /services/logging/api/error`

**Request Body**: String or object message

**Response**:
- Success: `200 OK` with body `"OK"`
- Error: `400 Bad Request` or `500 Internal Server Error`

**Example**:
```bash
curl -X POST http://localhost:3001/services/logging/api/error \
  -H "Content-Type: application/json" \
  -d '{"error": "Database connection failed", "attempt": 3, "retrying": true}'
```

---

#### GET: Retrieve Logs

**Endpoint**: `GET /services/logging/api/logs?level=ERROR`

**Query Parameters**:
- `level` (optional): Filter by level - 'INFO', 'WARN', 'ERROR', 'LOG'

**Response**:
```json
{
  "count": 5,
  "level": "ERROR",
  "logs": [
    {
      "level": "ERROR",
      "message": "2025-11-22T10:45:00.123Z - ERROR - hostname - Database error",
      "timestamp": "2025-11-22T10:45:00.123Z",
      "capturedAt": 1700642700123
    }
  ]
}
```

**Example**:
```bash
# Get all logs
curl http://localhost:3001/services/logging/api/logs

# Get only errors
curl http://localhost:3001/services/logging/api/logs?level=ERROR

# Get warnings
curl http://localhost:3001/services/logging/api/logs?level=WARN

# Get from named instance
curl http://localhost:3001/services/logging/api/audit/logs?level=INFO
```

---

#### GET: Service Status

**Endpoint**: `GET /services/logging/api/status`

**Response**:
```
"logging api running"
```

**Example**:
```bash
curl http://localhost:3001/services/logging/api/status
# Response: "logging api running"
```

---

#### GET: List Instances

**Endpoint**: `GET /services/logging/api/instances`

**Response**:
```json
{
  "success": true,
  "instances": [
    {
      "name": "default",
      "provider": "memory",
      "status": "active"
    },
    {
      "name": "audit",
      "provider": "file",
      "status": "active"
    }
  ],
  "total": 2
}
```

**Example**:
```bash
curl http://localhost:3001/services/logging/api/instances
```

---

#### GET: Client Script Library

**Endpoint**: `GET /services/logging/scripts`

**Response**: JavaScript code for client library

**Example**:
```html
<script src="/services/logging/scripts"></script>

<script>
  // Library is available as window.digitalTechnologiesLogging
  const logger = new digitalTechnologiesLogging();
</script>
```

---

## Client Library (Browser)

### Overview

The client library provides browser-based logging with optional server integration.

### Including the Library

```html
<!-- In your HTML -->
<script src="/services/logging/scripts"></script>

<script>
  // Library is available as window.digitalTechnologiesLogging
  const logger = new digitalTechnologiesLogging();
</script>
```

### Local Logging (Browser Console)

For client-side only logging without server communication:

```javascript
// Create local logger (no instanceName)
const logger = new digitalTechnologiesLogging({
  minLogLevel: 'info',
  useGroups: false,
  debug: false
});

// Logs appear in browser console
await logger.info('Page loaded');
await logger.warn('API took too long');
await logger.error('Failed to fetch user');
```

### Remote Logging (Server-Side)

For logging to server:

```javascript
// Create remote logger (with instanceName)
const logger = new digitalTechnologiesLogging({
  instanceName: 'default',
  baseUrl: window.location.origin,
  minLogLevel: 'info'
});

// Logs are sent to server REST API
await logger.info('User action');
await logger.error('Operation failed');
```

### Client API Methods

#### `info(message, meta) → Promise<void>`

Log informational message.

```javascript
await logger.info('User logged in', { userId: 123 });
await logger.info('Form submitted');
```

---

#### `warn(message, meta) → Promise<void>`

Log warning message.

```javascript
await logger.warn('Slow network detected', { latency: 2500 });
await logger.warn('Cache might be stale');
```

---

#### `error(message, meta) → Promise<void>`

Log error message.

```javascript
await logger.error('API request failed', {
  endpoint: '/api/users',
  statusCode: 500,
  error: 'Internal Server Error'
});
```

---

#### `debug(message, meta) → Promise<void>`

Log debug message.

```javascript
await logger.debug('Processing request', {
  method: 'POST',
  url: '/api/data'
});
```

---

#### Local-Only Methods

These methods only work with local logger instances:

##### `getLogs() → Array`

Get logs stored locally.

```javascript
const localLogger = new digitalTechnologiesLogging();
const logs = await localLogger.getLogs();
console.log('Local logs:', logs);
```

---

##### `clearLogs() → Promise<void>`

Clear local logs.

```javascript
await localLogger.clearLogs();
```

---

### Complete Browser Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Logging Demo</title>
</head>
<body>
  <h1>Application Logging Demo</h1>
  <button id="logBtn">Log Message</button>
  <button id="clearBtn">Clear Logs</button>

  <div id="logs"></div>

  <!-- Include logging library -->
  <script src="/services/logging/scripts"></script>

  <script>
    // Create logger
    const logger = new digitalTechnologiesLogging({
      instanceName: 'default',
      debug: true
    });

    // Log page load
    document.addEventListener('DOMContentLoaded', async () => {
      await logger.info('Page loaded', {
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    });

    // Log button clicks
    document.getElementById('logBtn').addEventListener('click', async () => {
      await logger.info('User clicked log button');

      // Show recent logs
      const response = await fetch('/services/logging/api/logs');
      const data = await response.json();

      const logsDiv = document.getElementById('logs');
      logsDiv.innerHTML = data.logs
        .slice(0, 10)
        .map(log => `<div>${log.timestamp}: ${log.level} - ${log.message}</div>`)
        .join('');
    });

    // Handle errors
    window.addEventListener('error', async (event) => {
      await logger.error('JavaScript error occurred', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', async (event) => {
      await logger.error('Unhandled promise rejection', {
        reason: event.reason.toString()
      });
    });
  </script>
</body>
</html>
```

---

## Analytics Module

### Architecture

The Analytics module automatically tracks all log operations and provides retrieval methods.

### Event Listeners

The module listens to log events and stores them:

```
Log Events                   | Tracked As
━━━━━━━━━━━━━━━━━━━━━━━━━━━┃━━━━━━━━━━
log:info:{instanceName}      | INFO
log:warn:{instanceName}      | WARN
log:error:{instanceName}     | ERROR
log:log:{instanceName}       | LOG
```

### Storage

- **Maximum Entries**: 1000 logs (rolling buffer)
- **Order**: Newest first (descending)
- **Fields per Entry**: level, message, timestamp, capturedAt

### Analytics Methods

Detailed documentation in [Advanced Methods (Analytics)](#advanced-methods-analytics) section above.

### Example: Monitoring Log Health

```javascript
// Check log distribution
setInterval(() => {
  const stats = logger.analytics.getStats();

  const errorRate = stats.ERROR.percentage;
  const warnRate = stats.WARN.percentage;

  console.log(`=== Log Health Report ===`);
  console.log(`Total logs: ${stats.totalLogs}`);
  console.log(`Error rate: ${errorRate.toFixed(2)}%`);
  console.log(`Warning rate: ${warnRate.toFixed(2)}%`);

  // Alert if error rate is high
  if (errorRate > 20) {
    console.warn('⚠️ High error rate detected!');

    // Get recent errors
    const errors = logger.analytics.list('ERROR');
    console.log('Recent errors:', errors.slice(0, 5));
  }
}, 60000);
```

---

## Scripts & UI Integration

### Client Library Script

**Endpoint**: `GET /services/logging/scripts`

Serves the browser-compatible logging library.

```html
<script src="/services/logging/scripts"></script>
```

The script makes `digitalTechnologiesLogging` available globally.

---

### Interactive Web UI

The service provides a fully-featured interactive web dashboard for managing and monitoring logging. This UI is automatically served when the service is initialized with Express routes.

**Access the UI**:
```
http://localhost:3001/services/logging/views/
```

**Features**:
- **Dashboard Tab**: Real-time log visualization with statistics and charts
  - Log level distribution (pie chart)
  - Log activity timeline (line chart)
  - Live log entries table with filtering
  - Statistics summary (counts and percentages)

- **Data Tab**: Submit and manage log entries
  - JSON log message editor with validation
  - Service status checker
  - Interactive API documentation (Swagger UI)

- **Settings Tab**: Configure logging service parameters
  - Adjust minimum log level
  - Modify logging settings
  - View service configuration

- **Instance Selector**: Switch between multiple logger instances

**Required HTML Containers for Custom Integration**:

If you want to embed the UI in your own HTML page, ensure these container elements are present:

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Include Bootstrap CSS for styling -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="/services/css/navigation.css" rel="stylesheet">
  <link href="/styles.css" rel="stylesheet">
</head>
<body>
  <!-- Navigation Sidebar -->
  <aside class="sidebar" id="navigation-sidebar"></aside>

  <!-- Main Content Area -->
  <main class="main-content">
    <!-- Page Header -->
    <div class="page-header">
      <h1 class="page-title">Logging Management</h1>
      <div>
        <label for="instanceSelector">Instance:</label>
        <select id="instanceSelector" class="form-select"></select>
        <button id="refreshInstanceBtn" class="btn btn-outline-secondary btn-sm">Refresh</button>
      </div>
    </div>

    <!-- Alert Containers -->
    <div class="alert alert-success" id="successAlert">
      <strong>Success!</strong> <span id="successMessage"></span>
    </div>
    <div class="alert alert-error" id="errorAlert">
      <strong>Error!</strong> <span id="errorMessage"></span>
    </div>

    <!-- Tab Navigation -->
    <ul class="nav nav-tabs mb-4" id="loggingTabs" role="tablist">
      <li class="nav-item">
        <button class="nav-link active" id="dashboard-tab" data-bs-toggle="tab" data-bs-target="#dashboard">
          Dashboard
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link" id="data-tab" data-bs-toggle="tab" data-bs-target="#data">
          Data
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link" id="settings-tab" data-bs-toggle="tab" data-bs-target="#settings">
          Settings
        </button>
      </li>
    </ul>

    <!-- Tab Content -->
    <div class="tab-content" id="loggingTabContent">
      <!-- Dashboard Tab -->
      <div class="tab-pane fade show active" id="dashboard" role="tabpanel">
        <!-- Dashboard content will be rendered here -->
      </div>

      <!-- Data Tab -->
      <div class="tab-pane fade" id="data" role="tabpanel">
        <!-- Data management content will be rendered here -->
      </div>

      <!-- Settings Tab -->
      <div class="tab-pane fade" id="settings" role="tabpanel">
        <!-- Settings content will be rendered here -->
      </div>
    </div>
  </main>

  <!-- Required Scripts -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="/services/js/navigation.js"></script>
  <script src="/services/logging/scripts/client.js"></script>
  <script src="/services/logging/views/script.js"></script>
</body>
</html>
```

**CSS Classes Used**:
- `.app-header` - Application header with logo and user menu
- `.app-container` - Main container for sidebar + content
- `.sidebar` - Left navigation sidebar
- `.main-content` - Main content area
- `.page-header` - Page title and controls
- `.page-content` - Content wrapper
- `.nav-tabs` - Tab navigation
- `.tab-content` - Tab content panes
- `.card` - Card component for sections
- `.alert` - Alert messages
- `.form-group`, `.form-label`, `.form-input` - Form elements
- `.btn`, `.btn-secondary` - Button styles
- `.badge` - Badge component for log levels

**Styling Notes**:
- Uses Bootstrap 5.3.2 for responsive design
- Implements a sidebar navigation pattern
- Includes responsive table styling for log entries
- Supports light and dark themes via CSS variables

---

## Advanced Usage

### Multi-Instance Logging

```javascript
// Create separate loggers for different purposes
const appLogger = createLoggingService('file', {
  instanceName: 'app',
  logDir: './.logs/app'
}, eventEmitter);

const auditLogger = createLoggingService('file', {
  instanceName: 'audit',
  logDir: './.logs/audit'
}, eventEmitter);

const errorLogger = createLoggingService('file', {
  instanceName: 'errors',
  logDir: './.logs/errors',
  level: 'error'  // Only log errors
}, eventEmitter);

// Use in application
await appLogger.info('Request processed', { duration: 145 });
await auditLogger.info('User login', { userId: 123, ip: '192.168.1.1' });
await errorLogger.error('Database error', { code: 'ECONNREFUSED' });
```

---

### Log Level Filtering

```javascript
// Only log warnings and above (errors, warnings)
const logger = createLoggingService('file', {
  level: 'warn'
}, eventEmitter);

await logger.error('Database error');      // ✓ Logged
await logger.warn('Cache miss');           // ✓ Logged
await logger.info('Request processed');    // ✗ Skipped
await logger.debug('Debug info');          // ✗ Skipped
```

---

### Structured Logging

```javascript
// Log with rich context
await logger.info('API request', {
  method: 'POST',
  path: '/api/users',
  statusCode: 201,
  duration: 145,
  userId: 123,
  timestamp: new Date().toISOString()
});

// Log with error details
await logger.error('Operation failed', {
  operation: 'user:create',
  error: error.message,
  stack: error.stack,
  input: { email: 'user@example.com' },
  context: { userId: null, ip: '192.168.1.1' }
});
```

---

### Log Aggregation

```javascript
// Aggregate logs from multiple sources
async function aggregateLogs() {
  const appLogs = appLogger.analytics.list();
  const auditLogs = auditLogger.analytics.list();
  const errorLogs = errorLogger.analytics.list();

  const allLogs = [...appLogs, ...auditLogs, ...errorLogs]
    .sort((a, b) => b.capturedAt - a.capturedAt)
    .slice(0, 100);

  return allLogs;
}
```

---

### Performance Monitoring

```javascript
// Track operation duration
async function trackOperation(name, fn) {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    await logger.info(`Operation completed: ${name}`, { duration });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    await logger.error(`Operation failed: ${name}`, {
      duration,
      error: error.message
    });

    throw error;
  }
}

// Usage
await trackOperation('database:query', async () => {
  return await db.query('SELECT * FROM users');
});
```

---

## Troubleshooting

### Issue: Logs not appearing in file

**Cause**: Log directory doesn't exist or insufficient permissions

**Solution**:
```javascript
const fs = require('node:fs');
const path = './.logs';

// Create directory manually
if (!fs.existsSync(path)) {
  fs.mkdirSync(path, { recursive: true });
}

// Then create logger
const logger = createLoggingService('file', {
  logDir: path
}, eventEmitter);
```

---

### Issue: High memory usage

**Cause**: Analytics storing all logs in memory

**Solution**: Clear logs periodically
```javascript
// Clear every hour
setInterval(() => {
  logger.analytics.clear();
}, 3600000);
```

---

### Issue: Logs not reaching API

**Cause**: API endpoint misconfigured or network error

**Solution**:
```bash
# Verify endpoint is running
curl http://localhost:3001/services/logging/api/status

# Check logs manually
curl http://localhost:3001/services/logging/api/logs
```

---

### Issue: Log level filtering not working

**Cause**: Incorrect level name

**Solution**:
```javascript
// Correct: Use lowercase when setting
const logger = createLoggingService('memory', {
  level: 'info'  // Correct
}, eventEmitter);

// Incorrect
const logger = createLoggingService('memory', {
  level: 'INFO'  // Wrong - should be lowercase
}, eventEmitter);

// When querying analytics, use UPPERCASE
const errors = logger.analytics.list('ERROR');  // Correct
```

---

## Examples & Recipes

### Recipe 1: Application Lifecycle Logging

```javascript
const logger = createLoggingService('file', {
  logDir: './.logs',
  level: 'info'
}, eventEmitter);

// Log startup
logger.info('Application starting', {
  version: '1.0.0',
  environment: process.env.NODE_ENV,
  pid: process.pid
});

// Log requests
app.use(async (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    await logger.info('HTTP request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration
    });
  });

  next();
});

// Log errors
app.use(async (err, req, res, next) => {
  await logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(500).json({ error: 'Internal Server Error' });
});

// Log shutdown
process.on('SIGTERM', async () => {
  await logger.info('Application shutting down', {
    reason: 'SIGTERM',
    uptime: process.uptime()
  });

  process.exit(0);
});
```

---

### Recipe 2: Audit Logging

```javascript
const auditLogger = createLoggingService('file', {
  instanceName: 'audit',
  logDir: './.logs/audit'
}, eventEmitter);

// Log user actions
async function logUserAction(userId, action, details) {
  await auditLogger.info(`User action: ${action}`, {
    userId,
    action,
    timestamp: new Date().toISOString(),
    ...details
  });
}

// Usage
await logUserAction(123, 'UPDATE_PROFILE', {
  fields: ['email', 'phone'],
  ip: req.ip,
  userAgent: req.get('user-agent')
});

await logUserAction(123, 'DELETE_ACCOUNT', {
  reason: 'user_requested',
  backupLocation: 's3://backups/user-123'
});
```

---

### Recipe 3: Error Tracking

```javascript
const errorLogger = createLoggingService('file', {
  instanceName: 'errors',
  logDir: './.logs/errors',
  level: 'error'
}, eventEmitter);

// Central error handler
async function handleError(error, context) {
  await errorLogger.error('Application error', {
    errorType: error.constructor.name,
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  });

  // Send alert if critical
  if (error.isCritical) {
    await sendAlert(`CRITICAL ERROR: ${error.message}`);
  }
}

// Usage
try {
  await databaseOperation();
} catch (error) {
  await handleError(error, {
    operation: 'databaseOperation',
    userId: req.user?.id
  });
}
```

---

### Recipe 4: Performance Logging

```javascript
const perfLogger = createLoggingService('memory', {
  instanceName: 'performance'
}, eventEmitter);

// Log query performance
async function queryWithLogging(query, params) {
  const startTime = Date.now();

  try {
    const result = await database.query(query, params);
    const duration = Date.now() - startTime;

    await perfLogger.info('Database query', {
      duration,
      query: query.substring(0, 100),
      rowsReturned: result.length,
      slow: duration > 1000
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    await perfLogger.error('Database query failed', {
      duration,
      query: query.substring(0, 100),
      error: error.message
    });
    throw error;
  }
}
```

---

**Document End**

This comprehensive guide covers all aspects of the Logging Service including initialization, providers, APIs, client library, analytics, and real-world recipes.
