# NooblyJS Core Logging Service - LLM Reference

## Quick Overview

The **Logging Service** provides multi-backend logging with:
- 7 providers: memory, file, console, api, aws (CloudWatch), azure (Monitor), gcp (Cloud Logging)
- Dual-mode: Server (Node.js) and Client (Browser)
- Local browser logging without server dependency
- RESTful API with analytics
- Full Swagger documentation at `/services/logging`

---

## Providers

| Provider | Use Case | Persistence |
|----------|----------|-------------|
| **memory** | Testing, development | ✗ |
| **file** | Local logging, archives | ✓ |
| **console** | Browser debugging | ✗ |
| **api** | Remote logger consumption | ✓ Depends |
| **aws** | Production on AWS (CloudWatch) | ✓ |
| **azure** | Production on Azure (Monitor) | ✓ |
| **gcp** | Production on GCP (Cloud Logging) | ✓ |

---

## Server-Side Usage (Node.js)

### Setup

```javascript
const ServiceRegistry = require('noobly-core');
const EventEmitter = require('events');
const express = require('express');

const app = express();
const eventEmitter = new EventEmitter();

ServiceRegistry.initialize(app, eventEmitter, {
  apiKeys: ['your-api-key'],
  requireApiKey: true
});

// Create logger
const logger = ServiceRegistry.logger('memory');
// or: ServiceRegistry.logger('file', { logDir: './.logs' });
// or: ServiceRegistry.logger('aws', { region: 'us-east-1' });
```

### Core Methods (Async)

```javascript
// Log at different levels
await logger.info('User logged in', { userId: 123 });
await logger.warn('Rate limit approaching', { count: 95, limit: 100 });
await logger.error('Database failed', { error: 'ECONNREFUSED' });
await logger.debug('Debug info', { config: {} });

// Level management
logger.setLogLevel('debug');      // Show all
logger.setLogLevel('warn');       // Only warn & error
const currentLevel = logger.getLogLevel();

// Settings
const settings = await logger.getSettings();
await logger.saveSettings({ minLogLevel: 'info' });

// Analytics
const count = logger.getLogCount();
const stats = await logger.getAnalytics();
const recent = await logger.getLocalLogs(10);
logger.printLogs();
```

### Multiple Instances

```javascript
const appLogger = ServiceRegistry.logger('file', {
  filename: 'app.log',
  instanceName: 'app'
});

const errorLogger = ServiceRegistry.logger('aws', {
  logGroup: 'errors',
  instanceName: 'errors'
});

await appLogger.info('Started');
await errorLogger.error('Failed');
```

---

## Client-Side Usage (Browser)

### Local Logging (No Server)

```html
<script src="/services/logging/scripts"></script>
<script>
  // Initialize without instance name = local mode
  const logger = new nooblyjscorelogging({
    minLogLevel: 'debug',
    prefix: '[MyApp]',
    useGroups: false
  });

  // Logs to browser console
  await logger.info('Page loaded');
  await logger.warn('Warning');
  await logger.error('Error');
  await logger.debug('Debug');

  const stats = await logger.getAnalytics();
  const recent = await logger.getLocalLogs(5);
  logger.printLogs();
</script>
```

### Remote Logging (to Server)

```javascript
// Initialize with instance name = remote mode
const logger = new nooblyjscorelogging('web-app', {
  apiKey: 'your-api-key'
});

await logger.info('User action', { action: 'clicked' });
await logger.error('Form failed', { field: 'email' });
```

---

## REST API

### Authentication (any method)
```bash
-H "x-api-key: YOUR_KEY"
-H "Authorization: Bearer YOUR_KEY"
?api_key=YOUR_KEY
```

### Endpoints

```bash
# Status & Management
GET    /services/logging/api/status
GET    /services/logging/api/instances

# Logging
POST   /services/logging/api/info      (body: "message" or {message, data})
POST   /services/logging/api/warn      (body: "message" or {message, data})
POST   /services/logging/api/error     (body: "message" or {message, data})
GET    /services/logging/api/logs      (?level=error|warn|info|log)

# Analytics
GET    /services/logging/api/stats     (counts and percentages)
GET    /services/logging/api/timeline  (activity per minute)

# Settings
GET    /services/logging/api/settings
POST   /services/logging/api/settings  (body: {minLogLevel, ...})

# Documentation
GET    /services/logging/api/swagger/docs.json

# Instance-Specific (add /:instanceName before endpoint)
POST   /services/logging/api/app-logger/info
GET    /services/logging/api/app-logger/logs
GET    /services/logging/api/app-logger/stats
```

### Examples

```bash
# Log info
curl -X POST http://localhost:3001/services/logging/api/info \
  -H "x-api-key: demo" \
  -H "Content-Type: application/json" \
  -d '"User action"'

# Get error logs
curl "http://localhost:3001/services/logging/api/logs?level=error" \
  -H "x-api-key: demo"

# Get stats
curl http://localhost:3001/services/logging/api/stats \
  -H "x-api-key: demo"
```

---

## Cloud Providers

### AWS CloudWatch

```bash
# Environment
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
```

```javascript
const logger = ServiceRegistry.logger('aws', {
  region: 'us-east-1',
  logGroup: 'my-logs',
  logStream: 'prod',
  batchSize: 10,
  flushInterval: 5000
});

// Logs batched to CloudWatch automatically
```

### Azure Monitor

```bash
# Environment
export AZURE_WORKSPACE_ID=...
export AZURE_SHARED_KEY=...
```

```javascript
const logger = ServiceRegistry.logger('azure', {
  workspaceId: process.env.AZURE_WORKSPACE_ID,
  sharedKey: process.env.AZURE_SHARED_KEY,
  logType: 'CustomLog',
  environment: 'public',  // or: government, china, germany
  batchSize: 10,
  flushInterval: 5000
});
```

### GCP Cloud Logging

```bash
# Environment
export GOOGLE_CLOUD_PROJECT=my-project
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

```javascript
const logger = ServiceRegistry.logger('gcp', {
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  logName: 'app-logs',
  resource: 'global',  // or: gce_instance, k8s_cluster, cloud_function
  batchSize: 10,
  flushInterval: 5000
});
```

---

## Log Levels

Priority: **ERROR > WARN > INFO > DEBUG**

When `minLogLevel = 'warn'`: Only warn and error messages are logged
When `minLogLevel = 'debug'`: All messages are logged

```javascript
logger.setLogLevel('debug');   // Show everything
logger.setLogLevel('info');    // Hide debug
logger.setLogLevel('warn');    // Only warn, error
logger.setLogLevel('error');   // Only error
```

---

## Event Monitoring

```javascript
const eventEmitter = ServiceRegistry.getEventEmitter();

eventEmitter.on('log:info:default', (data) => {
  console.log('Info logged:', data.message);
});

eventEmitter.on('log:error:default', (data) => {
  // Handle error
});

eventEmitter.on('api-logging-settings-saved', (data) => {
  console.log('Settings changed at', data.timestamp);
});
```

---

## Common Patterns

### Application with Multiple Loggers

```javascript
const appLogger = ServiceRegistry.logger('file', {
  filename: 'app.log',
  instanceName: 'app'
});

const errorLogger = ServiceRegistry.logger('aws', {
  logGroup: 'errors',
  instanceName: 'errors'
});

const auditLogger = ServiceRegistry.logger('file', {
  filename: 'audit.log',
  instanceName: 'audit'
});

// Express middleware
app.use((req, res, next) => {
  appLogger.info('Request', { method: req.method, path: req.path }).catch(console.error);
  next();
});

app.post('/api/users', async (req, res) => {
  try {
    const user = await createUser(req.body);
    await auditLogger.info('User created', { userId: user.id, email: user.email });
    res.json(user);
  } catch (err) {
    await errorLogger.error('User creation failed', { error: err.message });
    res.status(500).json({ error: 'Failed' });
  }
});
```

### Conditional Logging

```javascript
// Only log in development
if (process.env.NODE_ENV === 'development') {
  await logger.debug('Detailed info', config);
}

// Cloud provider in production, file in development
const provider = process.env.NODE_ENV === 'production' ? 'aws' : 'file';
const logger = ServiceRegistry.logger(provider);
```

### Performance Tracking

```javascript
async function processData(data) {
  const start = Date.now();
  try {
    const result = await expensive(data);
    const duration = Date.now() - start;
    await logger.info('Completed', {
      duration,
      items: data.length,
      performanceOK: duration < 1000
    });
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    await logger.error('Failed', { duration, error: err.message });
    throw err;
  }
}
```

---

## Configuration Reference

### Common Options

```javascript
{
  minLogLevel: 'info',        // error, warn, info, log/debug
  logDir: './.logs',          // File provider: directory
  filename: 'app.log',        // File provider: filename
  prefix: '[Logger]',         // Console output prefix
  useGroups: false,           // Use console.group()
  instanceName: 'default',    // Instance identifier
  batchSize: 10,              // Cloud providers: batch size
  flushInterval: 5000,        // Cloud providers: flush ms
  region: 'us-east-1',        // AWS: region
  logGroup: 'logs',           // AWS: log group name
  workspaceId: '',            // Azure: workspace ID
  sharedKey: '',              // Azure: shared key
  projectId: '',              // GCP: project ID
  logName: 'logs',            // GCP: log name
  resource: 'global'          // GCP: resource type
}
```

---

## Troubleshooting

**No logs appearing?**
- Check: `logger.setLogLevel('debug')` to see all
- Verify: `await logger.getSettings()` for config
- Check: `logger.getLogCount()` for log count
- File provider: Verify `./.logs` directory exists and is writable

**Cloud provider not working?**
- AWS: Check `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- Azure: Check `AZURE_WORKSPACE_ID`, `AZURE_SHARED_KEY`
- GCP: Check `GOOGLE_CLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS`
- Install SDK: `npm install @aws-sdk/client-cloudwatch-logs` (or Azure/GCP equivalent)

**Performance issues?**
- Reduce batch size or increase flush interval
- Increase minLogLevel to reduce volume
- Monitor: `await logger.getAnalytics()`

---

## Best Practices

✓ Use appropriate log levels (error for failures, info for events, debug for dev)
✓ Include contextual metadata with logs
✓ Use cloud providers for production systems
✓ Set higher minLogLevel in production (warn/error)
✓ Monitor log volume and patterns
✓ Test logging in development before production
✓ Implement error handling around logging calls
✓ Use multiple instances for different purposes (app, errors, audit)
✓ Leverage events for integration with monitoring systems
