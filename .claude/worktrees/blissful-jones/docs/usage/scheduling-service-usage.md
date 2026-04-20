# Scheduling Service - Comprehensive Usage Guide

**Document Version**: 1.0
**Last Updated**: 2025-11-22
**Status**: Complete ✓

---

## Table of Contents

1. [Service Overview](#service-overview)
2. [Service Initialization](#service-initialization)
3. [Service API (Node.js)](#service-api-nodejs)
4. [REST API Endpoints](#rest-api-endpoints)
5. [Analytics Module](#analytics-module)
6. [Advanced Usage Patterns](#advanced-usage-patterns)
7. [Examples & Recipes](#examples--recipes)
8. [Troubleshooting](#troubleshooting)

---

## Service Overview

The **Scheduling Service** provides recurring task scheduling and cron-based job execution. It enables periodic background tasks with automatic execution, event-driven tracking, and comprehensive analytics.

### Key Features

- **Interval-Based Scheduling**: Schedule tasks to run at fixed intervals
- **Recurring Tasks**: Automatic repeated execution with configurable intervals
- **Worker Thread Integration**: Executes tasks via the Working service
- **Callback Support**: Optional execution callbacks for result handling
- **Event-Driven**: Full event emission for all scheduling operations
- **Analytics Module**: Task execution statistics and performance metrics
- **Task Management**: Start, stop, and check task status
- **Settings Management**: Configurable job limits and timeouts
- **Error Tracking**: Track failed executions separately

### Architecture

```
┌─────────────────────────────────────────┐
│     Scheduling Service                  │
├─────────────────────────────────────────┤
│  Task Registry (Multiple Tasks)         │
│  ├─ Task 1  (interval timer 1)          │
│  ├─ Task 2  (interval timer 2)          │
│  └─ Task N  (interval timer N)          │
├─────────────────────────────────────────┤
│  Worker Integration                     │
│  └─ Delegates execution to Working      │
│     Service                             │
├─────────────────────────────────────────┤
│  Analytics Module (Event-Driven)        │
│  ├─ Execution Tracking                  │
│  ├─ Statistics Collection               │
│  └─ Performance Metrics                 │
└─────────────────────────────────────────┘
```

---

## Service Initialization

### Basic Setup

```javascript
const EventEmitter = require('events');
const createScheduling = require('./src/scheduling');
const createWorking = require('./src/working');
const createQueueing = require('./src/queueing');

// Create event emitter
const eventEmitter = new EventEmitter();

// Create required dependencies
const queueing = createQueueing('memory', {}, eventEmitter);
const working = createWorking('default', {
  dependencies: { queueing },
  maxThreads: 4
}, eventEmitter);

// Create scheduling service
const scheduling = createScheduling('memory', {
  dependencies: { working }
}, eventEmitter);

console.log('Scheduling service initialized');
```

### With Full Dependencies

```javascript
const createLogging = require('./src/logging');
const createScheduling = require('./src/scheduling');
const createWorking = require('./src/working');
const createQueueing = require('./src/queueing');

const eventEmitter = new EventEmitter();

// Create all dependencies
const logging = createLogging('file', { logDir: './.logs' }, eventEmitter);
const queueing = createQueueing('memory', {}, eventEmitter);
const working = createWorking('default', {
  dependencies: { logging, queueing },
  maxThreads: 4
}, eventEmitter);

// Create scheduling service with dependencies
const scheduling = createScheduling('memory', {
  dependencies: {
    logging: logging,
    working: working
  },
  maxConcurrentJobs: 10,
  retryAttempts: 3,
  jobTimeout: 30000
}, eventEmitter);

console.log('Scheduling service initialized with dependencies');
```

---

## Service API (Node.js)

### Core Methods

#### `start(taskName, scriptPath, [data], intervalSeconds, [executionCallback])`

Starts a recurring scheduled task.

**Parameters**:
- `taskName` (string, required) - Unique name for this task
- `scriptPath` (string, required) - Path to the script to execute
- `data` (any, optional) - Data to pass to the script
- `intervalSeconds` (number, required) - Interval in seconds between executions
- `executionCallback` (function, optional) - Callback: `(status, result) => {}`

**Returns**: `Promise<void>`

**Throws**: Error if task already exists or parameters invalid

**Example**:

```javascript
// Simple scheduled task (runs every hour)
await scheduling.start('hourly-cleanup', 'tasks/cleanup.js', 3600);

// Task with data
await scheduling.start('process-batch', 'tasks/batch-processor.js', {
  batchSize: 100,
  timeout: 60000
}, 1800); // Every 30 minutes

// Task with callback
await scheduling.start(
  'monitor-health',
  'tasks/health-check.js',
  { alertEmail: 'admin@example.com' },
  300, // Every 5 minutes
  (status, result) => {
    if (status === 'error') {
      console.error('Health check failed:', result);
    }
  }
);
```

---

#### `stop([taskName])`

Stops a specific task or all scheduled tasks.

**Parameters**:
- `taskName` (string, optional) - Name of task to stop. If omitted, stops all tasks.

**Returns**: `Promise<void>`

**Example**:

```javascript
// Stop specific task
await scheduling.stop('hourly-cleanup');

// Stop all tasks
await scheduling.stop();
```

---

#### `isRunning([taskName])`

Checks if a task or any tasks are currently running.

**Parameters**:
- `taskName` (string, optional) - Task name. If omitted, checks if any tasks running.

**Returns**: `Promise<boolean>`

**Example**:

```javascript
const isRunning = await scheduling.isRunning('hourly-cleanup');
if (isRunning) {
  console.log('Task is active');
}

// Check if any tasks running
const anyRunning = await scheduling.isRunning();
if (anyRunning) {
  console.log('Some tasks are scheduled');
}
```

---

#### `getSettings()`

Retrieves current service settings.

**Returns**: `Promise<Object>`

**Example**:

```javascript
const settings = await scheduling.getSettings();
console.log('Max concurrent jobs:', settings.maxConcurrentJobs);
console.log('Retry attempts:', settings.retryAttempts);
console.log('Job timeout:', settings.jobTimeout);
```

---

#### `saveSettings(settings)`

Updates service settings.

**Parameters**:
- `settings` (Object) - Settings to update

**Example**:

```javascript
await scheduling.saveSettings({
  maxConcurrentJobs: 20,
  retryAttempts: 5,
  jobTimeout: 60000
});
```

---

## REST API Endpoints

### Task Scheduling

#### `POST /services/scheduling/api/schedule`

Schedules a task to run at specified intervals.

**Request Body**:
```json
{
  "task": "monthly-report",
  "cron": "0 0 1 * * *"
}
```

**Response**:
```
Status: 200 OK
Body: "OK"
```

---

### Task Management

#### `DELETE /services/scheduling/api/cancel/:taskId`

Cancels a scheduled task.

**Response**:
```
Status: 200 OK
Body: "OK"
```

---

### Service Status

#### `GET /services/scheduling/api/status`

Returns service operational status.

**Response**:
```
Status: 200 OK
Body: "scheduling api running"
```

---

### Analytics Endpoints

#### `GET /services/scheduling/api/analytics`

Returns complete analytics for all scheduled tasks.

**Response**:
```json
{
  "totals": {
    "schedules": 5,
    "pending": 0,
    "running": 2,
    "completed": 45,
    "error": 3
  },
  "schedules": [
    {
      "schedule": "hourly-cleanup",
      "pending": 0,
      "running": 1,
      "completed": 10,
      "error": 0,
      "lastRun": "2025-11-22T15:30:45.000Z"
    }
  ]
}
```

**cURL Example**:

```bash
curl http://localhost:3001/services/scheduling/api/analytics
```

---

#### `GET /services/scheduling/api/analytics/totals`

Returns aggregate statistics across all tasks.

**Response**:
```json
{
  "schedules": 5,
  "pending": 0,
  "running": 2,
  "completed": 45,
  "error": 3
}
```

---

#### `GET /services/scheduling/api/analytics/schedules`

Returns detailed schedule information.

---

## Analytics Module

The Scheduling Service includes built-in analytics that track:

- **Pending**: Tasks waiting to execute
- **Running**: Tasks currently executing
- **Completed**: Successfully completed executions
- **Error**: Failed executions
- **Last Run**: Most recent execution timestamp

### Analytics Methods

**`getStats(taskName)`**
Returns statistics for a specific task

**`getTotalStats()`**
Returns aggregated statistics across all tasks

**`getAllAnalytics()`**
Returns complete analytics data with all schedules

---

## Advanced Usage Patterns

### 1. Cascading Task Execution

```javascript
// Chain multiple tasks with dependencies
async function setupCascadingTasks() {
  // Task 1: Gather data (runs every hour)
  await scheduling.start('gather-data', 'tasks/gather.js', 3600);

  // Task 2: Process data (runs every 2 hours)
  await scheduling.start(
    'process-data',
    'tasks/process.js',
    { source: 'gathered-data' },
    7200
  );

  // Task 3: Generate report (runs every day)
  await scheduling.start(
    'generate-report',
    'tasks/report.js',
    { source: 'processed-data' },
    86400 // 24 hours
  );

  console.log('Cascading tasks configured');
}
```

---

### 2. Conditional Task Execution

```javascript
class ConditionalScheduler {
  constructor(scheduling, eventEmitter) {
    this.scheduling = scheduling;
    this.eventEmitter = eventEmitter;
    this.conditions = new Map();
  }

  async startConditional(taskName, scriptPath, interval, condition) {
    await this.scheduling.start(
      taskName,
      scriptPath,
      {},
      interval,
      (status, result) => {
        if (condition && condition(status, result)) {
          console.log(`Condition met for ${taskName}`);
        }
      }
    );
  }

  async stopIfCondition(taskName, condition) {
    const isRunning = await this.scheduling.isRunning(taskName);

    if (isRunning && condition()) {
      await this.scheduling.stop(taskName);
    }
  }
}

// Usage
const conditionalScheduler = new ConditionalScheduler(scheduling, eventEmitter);

// Start task only if certain condition is met
await conditionalScheduler.startConditional(
  'backup-db',
  'tasks/backup.js',
  3600, // Every hour
  (status, result) => status === 'completed' && result.size > 1000
);
```

---

## Examples & Recipes

### Recipe: Database Maintenance Schedule

```javascript
async function setupDatabaseMaintenance(scheduling) {
  // Daily cleanup
  await scheduling.start(
    'daily-cleanup',
    'tasks/db-cleanup.js',
    { action: 'cleanup', tables: ['logs', 'sessions'] },
    86400, // Every 24 hours
    (status, result) => {
      if (status === 'error') {
        console.error('Cleanup failed:', result);
        // Could trigger alert here
      } else {
        console.log('Cleanup completed successfully');
      }
    }
  );

  // Weekly optimization
  await scheduling.start(
    'weekly-optimize',
    'tasks/db-optimize.js',
    { action: 'optimize', vacuum: true },
    604800 // Every 7 days
  );

  // Hourly backups
  await scheduling.start(
    'hourly-backup',
    'tasks/db-backup.js',
    { type: 'incremental', retention: '7d' },
    3600
  );

  console.log('Database maintenance schedule active');
}
```

---

### Recipe: Monitoring & Alerting

```javascript
async function setupMonitoring(scheduling, alertService) {
  // Health check every 5 minutes
  await scheduling.start(
    'health-check',
    'tasks/health-monitor.js',
    { endpoints: ['/api/health', '/api/status'] },
    300,
    async (status, result) => {
      if (status === 'error') {
        await alertService.sendAlert({
          level: 'critical',
          message: `Health check failed: ${result}`,
          timestamp: new Date()
        });
      } else if (result.unhealthy > 0) {
        await alertService.sendAlert({
          level: 'warning',
          message: `${result.unhealthy} endpoints unhealthy`,
          timestamp: new Date()
        });
      }
    }
  );

  console.log('Monitoring system active');
}
```

---

## Troubleshooting

### Issue: Tasks Not Executing

**Symptoms**: Tasks scheduled but never executed

**Causes**:
- Working service not initialized
- Invalid script paths
- Worker thread pool exhausted

**Solutions**:

```javascript
// Verify dependencies
const isRunning = await scheduling.isRunning();
console.log('Scheduling active:', isRunning);

// Check status
const status = await scheduling.getSettings();
console.log('Max concurrent:', status.maxConcurrentJobs);

// Verify script path exists
const path = require('node:path');
const fs = require('node:fs').promises;

try {
  await fs.access('tasks/my-task.js');
  console.log('Script exists');
} catch (error) {
  console.error('Script not found');
}
```

---

### Issue: High Memory Usage

**Symptoms**: Memory continuously growing

**Causes**:
- Task callbacks retaining references
- Large result data
- Too many scheduled tasks

**Solutions**:

```javascript
// Monitor active tasks
setInterval(async () => {
  const isAnyRunning = await scheduling.isRunning();
  const stats = await scheduling.getSettings();
  console.log('Active:', isAnyRunning, 'Max:', stats.maxConcurrentJobs);
}, 60000);

// Clean up callbacks
await scheduling.stop(); // Stop all tasks
```

---

## Interactive Web UI

The Scheduling Service provides an interactive web dashboard for managing and monitoring schedules. This UI is automatically served when the service is initialized with Express routes.

**Access the UI**:
```
http://localhost:3001/services/scheduling/views/
```

**Features**:
- **Left Navigation Panel** - Browse all defined schedules with search
  - Schedule names with visual indicators
  - "New Schedule" button for creating schedules
  - Search functionality for filtering

- **Center Editor Panel** - View and manage schedule details
  - Schedule ID and metadata
  - CRON expression display
  - Activity definition JSON viewer
  - Creation date and status

- **Executions Tab** - Monitor execution history
  - Status filtering (Completed, Running, Error)
  - Execution timestamp and duration
  - Result details

- **Schedule Creator** - Interactive form for new schedules
  - Schedule name input
  - CRON expression with common presets:
    - Every Hour
    - Daily at midnight
    - Weekly on Monday
    - Monthly on 1st
  - JSON activity definition editor with format helper

### HTML Container Integration

To integrate the UI into your own HTML page, ensure these required container elements are present:

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Required CSS -->
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
      <div>
        <h1 class="page-title">Scheduling Management</h1>
        <p class="page-subtitle">Create and manage scheduled tasks</p>
      </div>
    </div>

    <!-- Alert Containers -->
    <div class="alert alert-success" id="successAlert">
      <strong>Success!</strong> <span id="successMessage"></span>
    </div>
    <div class="alert alert-error" id="errorAlert">
      <strong>Error!</strong> <span id="errorMessage"></span>
    </div>

    <!-- Main Content Grid -->
    <div class="schedule-container" style="display: grid; grid-template-columns: 250px 1fr; gap: 1rem;">
      <!-- Left Panel: Schedule Navigation -->
      <div id="scheduleNav" class="schedule-list-panel">
        <!-- Navigation items rendered here -->
      </div>

      <!-- Right Panel: Schedule Details -->
      <div id="scheduleContent" class="schedule-content-panel">
        <!-- Schedule details and tabs rendered here -->
      </div>
    </div>
  </main>

  <!-- Required Scripts -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
  <script src="/services/js/navigation.js"></script>
  <script src="/services/scheduling/scripts/client.js"></script>
  <script src="/services/scheduling/views/script.js"></script>
</body>
</html>
```

**Required HTML Element IDs:**
- `#navigation-sidebar` - Sidebar navigation container
- `#successAlert`, `#successMessage` - Success notification containers
- `#errorAlert`, `#errorMessage` - Error notification containers
- `#scheduleNav` - Left panel for schedule list and search
- `#scheduleContent` - Right panel for schedule details, editor, and executions

**Required CSS Classes:**
- `.schedule-container` - Main grid container
- `.schedule-list-panel` - Left navigation panel
- `.schedule-content-panel` - Right content panel
- `.alert` - Alert messages
- `.form-group`, `.form-label`, `.form-input` - Form elements
- `.btn`, `.btn-secondary` - Button styles
- `.card` - Card component for sections

**Required CSS Files:**
- Bootstrap 5.3.2 (CDN)
- `/services/css/navigation.css` - Navigation styling
- `/styles.css` - Global application styles

**Required JavaScript Libraries:**
- Bootstrap 5.3.2 JS Bundle (CDN)
- Swagger UI Bundle (CDN) - For API documentation
- `/services/scheduling/scripts/client.js` - Client library
- `/services/scheduling/views/script.js` - Dashboard script

---

## Best Practices

1. **Use descriptive task names** - Aids debugging and monitoring
2. **Keep intervals reasonable** - Avoid too-frequent execution
3. **Implement error handling** - Use callbacks to handle failures
4. **Monitor analytics** - Track execution patterns
5. **Set appropriate timeouts** - Prevent long-running hangs
6. **Test scripts independently** - Verify before scheduling
7. **Use dependent tasks** - Chain related operations
8. **Clean up old tasks** - Stop unused scheduled tasks
9. **Log important events** - Enable debugging
10. **Document schedule** - Keep track of all scheduled tasks

---

**Documentation Complete** ✓

For questions, see the [documentation index](./README.md).
