# NooblyJS Core Logging Service Usage Guide

## Table of Contents

1. [Overview](#overview)
2. [Supported Providers](#supported-providers)
3. [Server-Side Usage (Node.js)](#server-side-usage-nodejs)
4. [Client-Side Usage (Browser)](#client-side-usage-browser)
5. [REST API Usage](#rest-api-usage)
6. [Cloud Provider Configuration](#cloud-provider-configuration)
7. [Advanced Features](#advanced-features)
8. [Examples](#examples)

---

## Overview

The **Logging Service** is an enterprise-grade, multi-backend logging solution that provides:

- **Multiple storage backends**: Console, File system, AWS CloudWatch, Azure Monitor, and GCP Cloud Logging
- **Dual-mode operation**: Server-side (Node.js) and client-side (Browser JavaScript)
- **Local client-side logging**: Browser console logging without server dependency
- **Flexible API**: Identical interface across all modes and providers
- **Auto-detection**: Automatic cloud provider configuration from environment variables
- **Analytics & Monitoring**: Built-in metrics for log performance tracking
- **REST API**: Complete HTTP endpoints for remote logging operations
- **Swagger Documentation**: Full API documentation with interactive explorer

### Key Features

✓ Structured logging with multiple severity levels (DEBUG, INFO, WARN, ERROR)
✓ Log filtering by level with configurable minimum level
✓ Event-driven architecture for monitoring
✓ Settings management per provider
✓ Log history and analytics with statistics
✓ Zero-config cloud provider setup
✓ Seamless local/remote switching
✓ Batch processing for cloud providers
✓ Auto-flush intervals for reliable delivery
✓ Full Swagger/OpenAPI documentation

---

## Supported Providers

| Provider | Backend | Use Case | Persistence |
|----------|---------|----------|-------------|
| **memory** | In-memory buffer | Development, testing | ✗ Lost on restart |
| **file** | Local file system | Development, logs archived | ✓ File-based |
| **console** | Browser/Node console | Browser testing, dev tools | ✗ Console output |
| **api** | Remote API call | Consume remote logger instance | ✓ Depends on remote |
| **aws** | AWS CloudWatch Logs | Production on AWS | ✓ AWS managed |
| **azure** | Azure Monitor/Log Analytics | Production on Azure | ✓ Azure managed |
| **gcp** | Google Cloud Logging | Production on GCP | ✓ GCP managed |

### Provider Selection Guide

**Development:**
- Use `memory` for quick testing
- Use `console` for browser debugging
- Use `file` for persistent local logs

**Production on AWS:**
- Use `aws` provider with CloudWatch integration

**Production on Azure:**
- Use `azure` provider with Log Analytics workspace

**Production on GCP:**
- Use `gcp` provider with Cloud Logging

**Client-Side (Browser):**
- No provider needed - uses browser console directly
- Initialize with no instance name

---

## Server-Side Usage (Node.js)

### Basic Setup

Initialize the logging service through ServiceRegistry:

```javascript
const ServiceRegistry = require('noobly-core');

// Initialize the service registry (required first)
const eventEmitter = new (require('events').EventEmitter)();
const app = require('express')();

ServiceRegistry.initialize(app, eventEmitter, {
  apiKeys: ['your-api-key'],
  requireApiKey: true
});

// Get a logger instance (memory provider by default)
const logger = ServiceRegistry.logger('memory');

// Or with specific provider and options
const logger = ServiceRegistry.logger('file', {
  logDir: './.logs',
  minLogLevel: 'info',
  instanceName: 'app-logger'
});
```

### Core Methods

All logging methods are asynchronous and return Promises.

#### INFO - Informational Messages

```javascript
// Basic info message
await logger.info('User logged in successfully');

// With metadata
await logger.info('User action completed', {
  userId: 123,
  action: 'profile_update',
  duration: 245  // milliseconds
});

// Complex metadata
await logger.info('API request processed', {
  endpoint: '/api/users',
  method: 'POST',
  statusCode: 201,
  responseTime: 150,
  requestBody: { name: 'John Doe' }
});
```

#### WARN - Warning Messages

```javascript
// Basic warning
await logger.warn('Rate limit approaching');

// With warning details
await logger.warn('Unusual activity detected', {
  userId: 456,
  activity: 'multiple_failed_logins',
  attempts: 5,
  timeWindow: '5 minutes'
});

// Performance warnings
await logger.warn('Slow database query', {
  query: 'SELECT * FROM users WHERE active = true',
  duration: 3500,  // milliseconds
  threshold: 1000  // expected threshold
});
```

#### ERROR - Error Messages

```javascript
// Basic error
await logger.error('Database connection failed');

// With error details
await logger.error('Payment processing failed', {
  error: 'insufficient_funds',
  transactionId: 'txn_12345',
  amount: 99.99,
  userId: 789
});

// Error with stack trace
try {
  // some operation
} catch (err) {
  await logger.error('Operation failed', {
    error: err.message,
    stack: err.stack,
    context: 'user_registration'
  });
}
```

#### DEBUG - Debug Messages

```javascript
// Basic debug
await logger.debug('Processing request');

// With debug details
await logger.debug('Request details', {
  headers: req.headers,
  query: req.query,
  params: req.params,
  body: req.body
});

// Conditional debugging
if (process.env.NODE_ENV === 'development') {
  await logger.debug('Development mode - detailed logging', { config });
}
```

### Log Level Management

```javascript
// Get current log level
const currentLevel = logger.getLogLevel();
console.log(`Current log level: ${currentLevel}`); // 'info'

// Set minimum log level
logger.setLogLevel('debug');   // Shows all messages
logger.setLogLevel('info');    // Hides debug messages
logger.setLogLevel('warn');    // Shows only warn and error
logger.setLogLevel('error');   // Shows only error

// Only messages at or above the minimum level are logged
// Log level priority: ERROR > WARN > INFO > DEBUG
```

### Settings Management

```javascript
// Get current settings
const settings = await logger.getSettings();
console.log(settings);
// Output:
// {
//   minLogLevel: 'info',
//   prefix: '[Logger]',
//   logDir: './.logs',
//   filename: 'app.2024-01-15.log'
// }

// Update settings
await logger.saveSettings({
  minLogLevel: 'debug',
  logDir: './custom-logs'
});
```

### Analytics and History

```javascript
// Get log count
const count = logger.getLogCount();
console.log(`Total logs stored: ${count}`);

// Get analytics
const analytics = await logger.getAnalytics();
console.log(analytics);
// Output:
// {
//   totalLogs: 150,
//   debug: 45,
//   info: 65,
//   warn: 25,
//   error: 15,
//   source: 'file' // or 'memory', 'aws', etc.
// }

// Get local logs (last N entries)
const recentLogs = await logger.getLocalLogs(10);
console.log(recentLogs);
// Returns array of last 10 log entries with timestamps

// Print all logs to console
logger.printLogs();
```

### Instance Management

```javascript
// Create multiple logger instances
const appLogger = ServiceRegistry.logger('file', {
  filename: 'app.log',
  instanceName: 'app'
});

const apiLogger = ServiceRegistry.logger('file', {
  filename: 'api.log',
  instanceName: 'api'
});

const errorLogger = ServiceRegistry.logger('file', {
  filename: 'errors.log',
  minLogLevel: 'error',
  instanceName: 'errors'
});

// Use them independently
await appLogger.info('Application started');
await apiLogger.info('API endpoint called');
await errorLogger.error('Critical error occurred');
```

---

## Client-Side Usage (Browser)

### Local Client-Side Logging (No Server Needed)

Log directly to the browser console without any server dependency:

```html
<!-- Include the logging client library -->
<script src="/services/logging/scripts"></script>

<script>
  // Initialize LOCAL logger (no instance name = local mode)
  const logger = new nooblyjscorelogging();

  // Log to browser console
  logger.info('Page loaded');
  logger.warn('Warning from browser');
  logger.error('Error in application');
  logger.debug('Debug information');
</script>
```

#### Local Logger Features

```javascript
// Initialize with options
const logger = new nooblyjscorelogging({
  minLogLevel: 'info',      // Filter by level
  prefix: '[MyApp]',        // Custom prefix in console
  useGroups: true,          // Use console.group() for organization
  debug: true               // Enable debug output
});

// All methods return promises for compatibility
await logger.info('Message');

// Check current log level
const level = logger.getLogLevel();

// Change log level
logger.setLogLevel('debug');

// Get statistics
const stats = await logger.getAnalytics();
console.log(`Total logs: ${stats.totalLogs}`);

// Get recent logs
const recent = await logger.getLocalLogs(5);
console.log(recent);

// Print all logs
logger.printLogs();

// Clear log history
logger.clearLocalLogs();
```

### Remote Server Logging (Browser to Server)

Log to your server's logging service:

```html
<script src="/services/logging/scripts"></script>

<script>
  // Initialize REMOTE logger (with instance name = remote mode)
  const logger = new nooblyjscorelogging('client-app', {
    apiKey: 'your-api-key',
    minLogLevel: 'info'
  });

  // Log to server
  await logger.info('User clicked button');
  await logger.error('Form validation failed', {
    field: 'email',
    value: 'invalid-email'
  });
</script>
```

### Browser Console Output Examples

Local logging with browser console:

```javascript
const logger = new nooblyjscorelogging();

await logger.info('User logged in', {userId: 123});
// Console output: [Logger] [10:30:45] INFO  User logged in | {"userId":123}

await logger.warn('API response slow', {duration: 3000});
// Console output: [Logger] [10:30:46] WARN  API response slow | {"duration":3000}

await logger.error('Database error', {code: 'ECONNREFUSED'});
// Console output: [Logger] [10:30:47] ERROR Database error | {"code":"ECONNREFUSED"}

await logger.debug('Processing data', {items: 50});
// Console output: [Logger] [10:30:48] DEBUG Processing data | {"items":50}
```

---

## REST API Usage

### Endpoints Overview

The logging service exposes RESTful endpoints for programmatic access:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/services/logging/api/status` | Service health status |
| GET | `/services/logging/api/instances` | List all logger instances |
| POST | `/services/logging/api/info` | Log info message |
| POST | `/services/logging/api/warn` | Log warning message |
| POST | `/services/logging/api/error` | Log error message |
| GET | `/services/logging/api/logs` | Retrieve stored logs |
| GET | `/services/logging/api/stats` | Get log statistics |
| GET | `/services/logging/api/timeline` | Get activity timeline |
| GET | `/services/logging/api/settings` | Get logger settings |
| POST | `/services/logging/api/settings` | Update settings |
| GET | `/services/logging/api/swagger/docs.json` | Swagger API docs |

### Authentication

All API endpoints require authentication via one of these methods:

```bash
# Method 1: API Key in header
-H "x-api-key: YOUR_API_KEY"

# Method 2: Bearer token
-H "Authorization: Bearer YOUR_API_KEY"

# Method 3: Query parameter
?api_key=YOUR_API_KEY

# Method 4: Alternative header format
-H "api-key: YOUR_API_KEY"

# Method 5: ApiKey format
-H "Authorization: ApiKey YOUR_API_KEY"
```

### Basic Endpoints

#### Service Status

```bash
curl http://localhost:3001/services/logging/api/status \
  -H "x-api-key: YOUR_API_KEY"

# Response: "logging api running"
```

#### List Instances

```bash
curl http://localhost:3001/services/logging/api/instances \
  -H "x-api-key: YOUR_API_KEY"

# Response:
# {
#   "success": true,
#   "instances": [
#     {"name": "default", "provider": "memory", "status": "active"},
#     {"name": "app-logger", "provider": "file", "status": "active"}
#   ],
#   "total": 2
# }
```

### Logging Endpoints

#### Log Info Message

```bash
curl -X POST http://localhost:3001/services/logging/api/info \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '"User action completed"'

# Or with structured data:
curl -X POST http://localhost:3001/services/logging/api/info \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "User logged in", "userId": 123}'
```

#### Log Warning Message

```bash
curl -X POST http://localhost:3001/services/logging/api/warn \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '"Rate limit approaching"'
```

#### Log Error Message

```bash
curl -X POST http://localhost:3001/services/logging/api/error \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Database connection failed", "error": "ECONNREFUSED"}'
```

### Analytics Endpoints

#### Retrieve Logs

```bash
# Get all recent logs
curl http://localhost:3001/services/logging/api/logs \
  -H "x-api-key: YOUR_API_KEY"

# Filter by level (info, warn, error, log/debug)
curl "http://localhost:3001/services/logging/api/logs?level=error" \
  -H "x-api-key: YOUR_API_KEY"

# Response:
# {
#   "count": 5,
#   "level": "error",
#   "logs": [
#     {
#       "timestamp": "2024-01-15T10:30:47.123Z",
#       "level": "ERROR",
#       "device": "server-01",
#       "message": "Database error"
#     }
#   ]
# }
```

#### Get Statistics

```bash
curl http://localhost:3001/services/logging/api/stats \
  -H "x-api-key: YOUR_API_KEY"

# Response:
# {
#   "totalLogs": 256,
#   "error": 12,
#   "warn": 34,
#   "info": 156,
#   "log": 54,
#   "errorPercentage": 4.69,
#   "warnPercentage": 13.28,
#   "infoPercentage": 60.94,
#   "logPercentage": 21.09
# }
```

#### Get Timeline

```bash
curl http://localhost:3001/services/logging/api/timeline \
  -H "x-api-key: YOUR_API_KEY"

# Response:
# {
#   "2024-01-15T10:00:00Z": {"info": 10, "warn": 2, "error": 1},
#   "2024-01-15T10:01:00Z": {"info": 15, "warn": 3, "error": 0},
#   ...
# }
```

### Settings Endpoints

#### Get Settings

```bash
curl http://localhost:3001/services/logging/api/settings \
  -H "x-api-key: YOUR_API_KEY"

# Response:
# {
#   "description": "Console logging configuration",
#   "list": [
#     {
#       "setting": "minLogLevel",
#       "type": "list",
#       "values": ["error", "warn", "info", "log"]
#     }
#   ],
#   "minLogLevel": "info"
# }
```

#### Update Settings

```bash
curl -X POST http://localhost:3001/services/logging/api/settings \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "minLogLevel": "debug"
  }'

# Response: "OK"
```

### Instance-Specific Endpoints

All logging endpoints support instance-specific versions:

```bash
# Log to specific instance
curl -X POST http://localhost:3001/services/logging/api/app-logger/info \
  -H "x-api-key: YOUR_API_KEY" \
  -d '"Message for specific instance"'

# Get logs from specific instance
curl "http://localhost:3001/services/logging/api/app-logger/logs" \
  -H "x-api-key: YOUR_API_KEY"

# Get stats for specific instance
curl "http://localhost:3001/services/logging/api/app-logger/stats" \
  -H "x-api-key: YOUR_API_KEY"

# Get timeline for specific instance
curl "http://localhost:3001/services/logging/api/app-logger/timeline" \
  -H "x-api-key: YOUR_API_KEY"
```

### API Documentation (Swagger)

```bash
# Get OpenAPI/Swagger specification
curl http://localhost:3001/services/logging/api/swagger/docs.json \
  -H "x-api-key: YOUR_API_KEY"

# Access interactive Swagger UI
# Open browser: http://localhost:3001/services/logging
```

---

## Cloud Provider Configuration

### AWS CloudWatch

#### Prerequisites

```bash
# Install AWS SDK
npm install @aws-sdk/client-cloudwatch-logs
```

#### Environment Variables

```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_LOG_GROUP=noobly-core-logs
export AWS_LOG_STREAM=app-logs
```

#### Usage

```javascript
const ServiceRegistry = require('noobly-core');

ServiceRegistry.initialize(app, eventEmitter);

const logger = ServiceRegistry.logger('aws', {
  region: 'us-west-2',
  logGroup: 'my-app-logs',
  logStream: 'production',
  batchSize: 10,
  flushInterval: 5000
});

await logger.info('Application started', {
  version: '1.0.0',
  environment: 'production'
});
```

#### CloudWatch Features

- Automatic log group creation
- Automatic log stream creation
- Batch logging for efficiency
- Sequence token management
- Auto-flush on intervals
- Graceful error handling

#### Monitoring Logs in CloudWatch

```bash
# View logs in CloudWatch console
aws logs tail /noobly-core-logs --follow

# Filter by log stream
aws logs tail /noobly-core-logs --log-stream-name-prefix production

# Search for specific messages
aws logs filter-log-events --log-group-name /noobly-core-logs \
  --filter-pattern "ERROR"
```

### Azure Monitor

#### Prerequisites

```bash
# Install Azure SDK (optional, uses HTTP API)
npm install @azure/monitor-opentelemetry
```

#### Environment Variables

```bash
export AZURE_WORKSPACE_ID=your_workspace_id
export AZURE_SHARED_KEY=your_shared_key_base64
export AZURE_LOG_TYPE=NooblyCoreLogs
export AZURE_ENVIRONMENT=public  # or government, china, germany
```

#### Usage

```javascript
const ServiceRegistry = require('noobly-core');

ServiceRegistry.initialize(app, eventEmitter);

const logger = ServiceRegistry.logger('azure', {
  workspaceId: 'workspace-id-from-env',
  sharedKey: 'shared-key-from-env',
  logType: 'CustomLog',
  environment: 'public',
  batchSize: 10,
  flushInterval: 5000
});

await logger.info('User authentication', {
  userId: 123,
  method: 'oauth',
  provider: 'azure-ad'
});
```

#### Azure Features

- HTTP Data Collector API integration
- HMAC-SHA256 authentication
- Multi-environment support
- Structured log entries with metadata
- Batch processing
- Custom log type naming

#### Querying Logs in Azure

```kusto
// Query in Log Analytics
CustomLog_CL
| where TimeGenerated > ago(1h)
| where level_s == "ERROR"
| summarize Count=count() by message_s
```

### Google Cloud Platform (GCP)

#### Prerequisites

```bash
# Install GCP SDK
npm install @google-cloud/logging
```

#### Environment Variables

```bash
export GOOGLE_CLOUD_PROJECT=my-gcp-project
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
export GCP_LOG_NAME=noobly-core-logs
export GCP_RESOURCE=global  # or gce_instance, k8s_cluster, cloud_function
```

#### Usage

```javascript
const ServiceRegistry = require('noobly-core');

ServiceRegistry.initialize(app, eventEmitter);

const logger = ServiceRegistry.logger('gcp', {
  projectId: 'my-gcp-project',
  logName: 'app-logs',
  resource: 'gce_instance',
  batchSize: 10,
  flushInterval: 5000
});

await logger.info('Cloud function invoked', {
  functionName: 'processUserData',
  executionTime: 234,
  status: 'success'
});
```

#### GCP Features

- Native SDK integration
- Automatic severity mapping
- Resource type configuration
- Application Default Credentials support
- Batch processing
- Graceful client shutdown

#### Querying Logs in GCP

```bash
# View logs in Cloud Logging
gcloud logging read "resource.type=global" --limit 50

# Filter by severity
gcloud logging read "severity=ERROR" --limit 50

# Use advanced filters
gcloud logging read "jsonPayload.userId=123" --limit 50
```

---

## Advanced Features

### Event-Driven Monitoring

```javascript
const eventEmitter = ServiceRegistry.getEventEmitter();

// Monitor logging events
eventEmitter.on('log:info:default', (data) => {
  console.log('Info logged:', data.message);
});

eventEmitter.on('log:error:default', (data) => {
  console.log('Error logged:', data.message);
  // Send alert, trigger action, etc.
});

// Monitor API events
eventEmitter.on('api-logging-info', (data) => {
  console.log('API info request received');
});

eventEmitter.on('api-logging-settings-saved', (data) => {
  console.log('Settings saved at', data.timestamp);
});
```

### Multi-Instance Logging Strategy

```javascript
// Create specialized loggers for different purposes
const appLogger = ServiceRegistry.logger('file', {
  filename: 'app.log',
  instanceName: 'app'
});

const apiLogger = ServiceRegistry.logger('file', {
  filename: 'api.log',
  instanceName: 'api'
});

const errorLogger = ServiceRegistry.logger('aws', {
  logGroup: 'error-logs',
  instanceName: 'errors'
});

const analyticsLogger = ServiceRegistry.logger('file', {
  filename: 'analytics.log',
  instanceName: 'analytics'
});

// Use appropriately
app.use((req, res, next) => {
  await apiLogger.info('HTTP request', {
    method: req.method,
    path: req.path
  });
  next();
});

app.use((err, req, res, next) => {
  await errorLogger.error('Unhandled error', {
    error: err.message,
    stack: err.stack
  });
  res.status(500).json({error: 'Internal Server Error'});
});
```

### Conditional Logging

```javascript
// Log only in development
if (process.env.NODE_ENV === 'development') {
  await logger.debug('Detailed debugging info', config);
}

// Log only warnings and errors in production
const minLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';
logger.setLogLevel(minLevel);

// Environment-specific providers
const provider = process.env.NODE_ENV === 'production' ? 'aws' : 'file';
const logger = ServiceRegistry.logger(provider);
```

### Performance Logging

```javascript
// Time operations and log performance
async function processLargeDataset(data) {
  const startTime = Date.now();

  try {
    const result = await expensiveOperation(data);
    const duration = Date.now() - startTime;

    await logger.info('Operation completed', {
      operation: 'processLargeDataset',
      duration: duration,
      itemsProcessed: data.length,
      performanceOK: duration < 1000
    });

    return result;
  } catch (err) {
    const duration = Date.now() - startTime;
    await logger.error('Operation failed', {
      operation: 'processLargeDataset',
      duration: duration,
      error: err.message
    });
    throw err;
  }
}
```

---

## Examples

### Complete Application Example

```javascript
const express = require('express');
const ServiceRegistry = require('noobly-core');
const EventEmitter = require('events');

// Create Express app
const app = express();
app.use(express.json());

// Create event emitter
const eventEmitter = new EventEmitter();

// Initialize service registry
ServiceRegistry.initialize(app, eventEmitter, {
  apiKeys: ['demo-key-123'],
  requireApiKey: true
});

// Create loggers
const appLogger = ServiceRegistry.logger('file', {
  filename: 'app.log',
  instanceName: 'app'
});

const errorLogger = ServiceRegistry.logger('aws', {
  logGroup: 'app-errors',
  instanceName: 'errors'
});

// Middleware: Log all requests
app.use((req, res, next) => {
  appLogger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  }).catch(err => console.error('Logging error:', err));
  next();
});

// Routes
app.post('/api/users', async (req, res) => {
  try {
    const user = req.body;

    // Validate
    if (!user.email) {
      await appLogger.warn('User creation failed', {
        reason: 'missing_email',
        data: user
      });
      return res.status(400).json({error: 'Email required'});
    }

    // Create user
    const userId = Math.random().toString(36).substr(2, 9);
    await appLogger.info('User created', {userId, email: user.email});

    res.status(201).json({id: userId, ...user});
  } catch (err) {
    await errorLogger.error('User creation error', {
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({error: 'Internal server error'});
  }
});

// Error handler
app.use((err, req, res, next) => {
  errorLogger.error('Unhandled exception', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl
  }).catch(console.error);

  res.status(500).json({error: 'Internal server error'});
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  appLogger.info('Server started', {port: PORT});
});
```

### Browser Application Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <h1>Application Logs</h1>
  <button onclick="testLocalLogging()">Test Local Logging</button>
  <button onclick="testRemoteLogging()">Test Remote Logging</button>
  <pre id="output"></pre>

  <script src="/services/logging/scripts"></script>
  <script>
    // Local logger (no server dependency)
    const localLogger = new nooblyjscorelogging({
      minLogLevel: 'debug',
      prefix: '[MyApp]'
    });

    // Remote logger (sends to server)
    const remoteLogger = new nooblyjscorelogging('web-client', {
      apiKey: 'your-api-key'
    });

    async function testLocalLogging() {
      output('=== Local Logging (Browser Console) ===');
      await localLogger.info('Application initialized');
      await localLogger.debug('Debug information');
      await localLogger.warn('Warning message');
      await localLogger.error('Error occurred');

      const stats = await localLogger.getAnalytics();
      output('Stats: ' + JSON.stringify(stats, null, 2));
    }

    async function testRemoteLogging() {
      output('=== Remote Logging (Server) ===');
      await remoteLogger.info('Page loaded', {url: location.href});
      await remoteLogger.warn('User action initiated');
      await remoteLogger.error('Form validation failed', {field: 'email'});

      output('Logs sent to server');
    }

    function output(text) {
      document.getElementById('output').textContent += text + '\n';
    }

    // Log on page load
    window.addEventListener('load', async () => {
      await localLogger.info('Page loaded');
    });

    // Log on errors
    window.addEventListener('error', async (event) => {
      await localLogger.error('JavaScript error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno
      });
    });
  </script>
</body>
</html>
```

### Integration with Error Handling

```javascript
// Express error handling with logging
const { errorHandler } = require('./middleware/errorHandler');

app.use(async (err, req, res, next) => {
  const errorId = generateErrorId();

  // Log the error
  await errorLogger.error('HTTP Exception', {
    errorId: errorId,
    status: err.status || 500,
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl
  });

  // Send response with error ID
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      errorId: errorId,
      status: err.status || 500
    }
  });
});

function generateErrorId() {
  return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

---

## Troubleshooting

### No Logs Appearing

1. **Check log level**: Ensure your message level is >= minimum log level
   ```javascript
   logger.setLogLevel('debug');  // Show all messages
   ```

2. **Verify provider**: Ensure provider is initialized correctly
   ```javascript
   const settings = await logger.getSettings();
   console.log(settings);
   ```

3. **Check permissions**: File-based logging needs write permissions
   ```bash
   chmod 755 ./.logs
   ```

4. **Cloud provider credentials**: Verify environment variables are set
   ```bash
   echo $AWS_ACCESS_KEY_ID
   echo $AZURE_WORKSPACE_ID
   ```

### Cloud Provider Connection Issues

1. **AWS CloudWatch**: Verify IAM permissions for CloudWatch Logs
2. **Azure Monitor**: Verify workspace ID and shared key format
3. **GCP**: Verify service account has Cloud Logging permissions

### Performance Issues

1. **Reduce batch size**: Smaller batches flush more frequently
2. **Increase flush interval**: Batch more logs before sending
3. **Use filtering**: Higher minimum log level reduces volume
4. **Monitor analytics**: Check log volume and patterns

---

## Best Practices

✓ Use appropriate log levels for messages
✓ Include contextual metadata with logs
✓ Implement log rotation for file-based providers
✓ Monitor logs for patterns and anomalies
✓ Set reasonable minimum log levels for production
✓ Use cloud providers for production systems
✓ Implement error handling around logging calls
✓ Test logging in development before production deployment
