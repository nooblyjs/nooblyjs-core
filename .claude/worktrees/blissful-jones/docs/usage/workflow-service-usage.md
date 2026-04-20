# Workflow Service - Comprehensive Usage Guide

**Document Version**: 1.0
**Last Updated**: 2025-11-22
**Status**: Complete ✓

---

## Table of Contents

1. [Service Overview](#service-overview)
2. [Service Initialization](#service-initialization)
3. [Service API (Node.js)](#service-api-nodejs)
4. [REST API Endpoints](#rest-api-endpoints)
5. [Web UI Interface](#web-ui-interface)
6. [Analytics Module](#analytics-module)
7. [Advanced Usage Patterns](#advanced-usage-patterns)
8. [Examples & Recipes](#examples--recipes)
9. [Troubleshooting](#troubleshooting)

---

## Service Overview

The **Workflow Service** provides orchestration and coordination of multi-step workflows with sequential or parallel execution, callback support, and comprehensive analytics. It enables complex business processes with automatic step execution, event-driven tracking, and detailed execution metrics.

### Key Features

- **Multi-Step Workflows**: Define workflows with multiple sequential steps
- **Step Orchestration**: Sequential or parallel execution of workflow steps
- **Worker Thread Integration**: Executes steps via the Working service
- **Callback Support**: Optional execution callbacks for step progress tracking
- **Event-Driven**: Full event emission for all workflow operations
- **Analytics Module**: Workflow execution statistics and performance metrics
- **Step Management**: Start, track, and monitor workflow execution
- **Settings Management**: Configurable step limits and timeouts
- **Error Tracking**: Track failed step executions and workflow errors

### Architecture

```
┌─────────────────────────────────────────┐
│     Workflow Service                    │
├─────────────────────────────────────────┤
│  Workflow Registry (Multiple Workflows) │
│  ├─ Workflow 1  (N steps)               │
│  ├─ Workflow 2  (M steps)               │
│  └─ Workflow N  (K steps)               │
├─────────────────────────────────────────┤
│  Step Execution                         │
│  └─ Delegates execution to Working      │
│     Service (worker threads)            │
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
const createWorkflow = require('./src/workflow');
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

// Create workflow service
const workflow = createWorkflow('memory', {
  dependencies: { working },
  maxSteps: 50,
  timeoutPerStep: 60000,
  parallelExecution: false
}, eventEmitter);

console.log('Workflow service initialized');
```

### With Full Dependencies

```javascript
const createLogging = require('./src/logging');
const createWorkflow = require('./src/workflow');
const createWorking = require('./src/working');
const createQueueing = require('./src/queueing');
const createScheduling = require('./src/scheduling');
const createMeasuring = require('./src/measuring');

const eventEmitter = new EventEmitter();

// Create all dependencies
const logging = createLogging('file', { logDir: './.logs' }, eventEmitter);
const queueing = createQueueing('memory', {}, eventEmitter);
const working = createWorking('default', {
  dependencies: { logging, queueing },
  maxThreads: 4
}, eventEmitter);
const scheduling = createScheduling('memory', {
  dependencies: { working },
  maxConcurrentJobs: 10
}, eventEmitter);
const measuring = createMeasuring('memory', {}, eventEmitter);

// Create workflow service with dependencies
const workflow = createWorkflow('memory', {
  dependencies: {
    logging: logging,
    queueing: queueing,
    scheduling: scheduling,
    measuring: measuring,
    working: working
  },
  maxSteps: 50,
  timeoutPerStep: 60000,
  parallelExecution: false
}, eventEmitter);

console.log('Workflow service initialized with dependencies');
```

---

## Service API (Node.js)

### Core Methods

#### `defineWorkflow(workflowName, steps)`

Defines a new workflow with specified steps.

**Parameters**:
- `workflowName` (string, required) - Unique name for the workflow
- `steps` (array, required) - Array of file paths to step implementations

**Returns**: `Promise<void>`

**Throws**: Error if workflow name is invalid or steps array is empty

**Example**:

```javascript
// Define a simple workflow
await workflow.defineWorkflow('order-processing', [
  'steps/validate-order.js',
  'steps/charge-payment.js',
  'steps/send-confirmation.js'
]);

// Define a workflow with data transformation steps
await workflow.defineWorkflow('data-pipeline', [
  'steps/extract-data.js',
  'steps/transform-data.js',
  'steps/validate-output.js',
  'steps/load-database.js'
]);

// Define a workflow with conditional steps
await workflow.defineWorkflow('email-campaign', [
  'steps/fetch-users.js',
  'steps/segment-audience.js',
  'steps/generate-content.js',
  'steps/send-emails.js',
  'steps/track-metrics.js'
]);
```

---

#### `runWorkflow(workflowName, data, [statusCallback])`

Executes a defined workflow with the provided initial data.

**Parameters**:
- `workflowName` (string, required) - Name of the workflow to execute
- `data` (any, required) - Initial data for the first step
- `statusCallback` (function, optional) - Callback for progress updates: `(status) => {}`

**Returns**: `Promise<void>`

**Throws**: Error if workflow not found or step execution fails

**Status Callback Parameters**:
- `status` (string) - One of: 'step_start', 'step_end', 'step_error', 'workflow_complete'
- `stepName` (string) - Name of the current step
- `stepPath` (string) - File path of the current step
- `data` (any) - Current step data
- `error` (string) - Error message (if status is 'step_error')
- `finalData` (any) - Final workflow result (if status is 'workflow_complete')

**Example**:

```javascript
// Run workflow with initial data
await workflow.runWorkflow('order-processing', {
  orderId: 12345,
  items: [
    { id: 1, price: 100 },
    { id: 2, price: 50 }
  ],
  customerId: 789
});

// Run workflow with status callback
await workflow.runWorkflow('data-pipeline',
  { sourceFile: '/data/raw-data.csv' },
  (status) => {
    console.log(`Step: ${status.stepName}`);
    if (status.status === 'step_error') {
      console.error('Error:', status.error);
    }
    if (status.status === 'workflow_complete') {
      console.log('Final data:', status.finalData);
    }
  }
);

// Run workflow with detailed progress tracking
const trackingCallback = (status) => {
  if (status.status === 'step_start') {
    console.log(`Starting: ${status.stepName}`);
  } else if (status.status === 'step_end') {
    console.log(`Completed: ${status.stepName}`);
    console.log('Output:', status.data);
  } else if (status.status === 'step_error') {
    console.error(`Failed: ${status.stepName} - ${status.error}`);
  } else if (status.status === 'workflow_complete') {
    console.log('Workflow finished with result:', status.finalData);
  }
};

await workflow.runWorkflow('email-campaign',
  { campaignId: 'camp-001' },
  trackingCallback
);
```

---

#### `getSettings()`

Retrieves current service settings.

**Returns**: `Promise<Object>`

**Example**:

```javascript
const settings = await workflow.getSettings();
console.log('Max steps:', settings.maxSteps);
console.log('Timeout per step:', settings.timeoutPerStep);
console.log('Parallel execution:', settings.parallelExecution);
```

---

#### `saveSettings(settings)`

Updates service settings.

**Parameters**:
- `settings` (Object) - Settings to update

**Example**:

```javascript
await workflow.saveSettings({
  maxSteps: 100,
  timeoutPerStep: 120000,
  parallelExecution: true
});
```

---

## REST API Endpoints

### Workflow Definition

#### `POST /services/workflow/api/defineworkflow`

Defines a new workflow.

**Request Body**:
```json
{
  "name": "order-processing",
  "steps": [
    "steps/validate-order.js",
    "steps/charge-payment.js",
    "steps/send-confirmation.js"
  ]
}
```

**Response**:
```
Status: 200 OK
Body: {"workflowId": "order-processing"}
```

---

### Workflow Execution

#### `POST /services/workflow/api/start`

Starts execution of a defined workflow.

**Request Body**:
```json
{
  "name": "order-processing",
  "data": {
    "orderId": 12345,
    "items": [
      { "id": 1, "price": 100 }
    ],
    "customerId": 789
  }
}
```

**Response**:
```
Status: 200 OK
Body: {"workflowId": "order-processing-1700656800000-abc123def456"}
```

---

### Service Status

#### `GET /services/workflow/api/status`

Returns service operational status.

**Response**:
```
Status: 200 OK
Body: "workflow api running"
```

---

### Analytics Endpoints

#### `GET /services/workflow/api/stats`

Returns overall workflow statistics.

**Response**:
```json
{
  "total": 45,
  "counts": {
    "completed": 42,
    "errors": 3,
    "active": 0
  },
  "percentages": {
    "completed": 93.33,
    "errors": 6.67,
    "active": 0.00
  },
  "lastRun": "2025-11-22T15:30:45.000Z"
}
```

---

#### `GET /services/workflow/api/analytics`

Returns detailed analytics for all workflows.

**Response**:
```json
{
  "count": 3,
  "workflows": [
    {
      "workflowName": "order-processing",
      "runCount": 25,
      "completedCount": 24,
      "errorCount": 1,
      "lastRun": "2025-11-22T15:30:45.000Z",
      "averageDuration": 2500,
      "activeCount": 0
    },
    {
      "workflowName": "data-pipeline",
      "runCount": 15,
      "completedCount": 15,
      "errorCount": 0,
      "lastRun": "2025-11-22T15:25:30.000Z",
      "averageDuration": 5000,
      "activeCount": 0
    },
    {
      "workflowName": "email-campaign",
      "runCount": 5,
      "completedCount": 3,
      "errorCount": 2,
      "lastRun": "2025-11-22T15:20:15.000Z",
      "averageDuration": 3000,
      "activeCount": 0
    }
  ]
}
```

**cURL Example**:

```bash
curl http://localhost:3001/services/workflow/api/analytics
```

---

#### `GET /services/workflow/api/analytics/:workflowName`

Returns analytics for a specific workflow.

**Response**:
```json
{
  "workflowName": "order-processing",
  "runCount": 25,
  "completedCount": 24,
  "errorCount": 1,
  "lastRun": "2025-11-22T15:30:45.000Z",
  "averageDuration": 2500,
  "activeCount": 0
}
```

---

### Settings Endpoints

#### `GET /services/workflow/api/settings`

Retrieves workflow service settings.

**Response**:
```json
{
  "description": "Configuration settings for the workflow service",
  "list": [
    { "setting": "maxSteps", "type": "number", "values": null },
    { "setting": "timeoutPerStep", "type": "number", "values": null },
    { "setting": "parallelExecution", "type": "boolean", "values": null }
  ],
  "maxSteps": 50,
  "timeoutPerStep": 60000,
  "parallelExecution": false
}
```

---

#### `POST /services/workflow/api/settings`

Updates workflow service settings.

**Request Body**:
```json
{
  "maxSteps": 100,
  "timeoutPerStep": 120000,
  "parallelExecution": true
}
```

**Response**:
```
Status: 200 OK
Body: "OK"
```

---

## Web UI Interface

The Workflow Service includes a comprehensive **UI tab** in the service dashboard (`/services/workflow`) that provides an interactive interface for managing workflows without writing code.

### UI Features

#### 1. Workflow Management
- **Left Navigation Panel**: Browse all defined workflows with real-time search
- **Workflow Selection**: Click any workflow to view its details and execution history
- **New Workflow Creation**: Button to create new workflows with custom steps

#### 2. Workflow Editor
When you select a workflow, the editor displays two tabs:

**Details Tab**:
- View workflow definition
- Display workflow steps
- Edit workflow settings (via API)
- Save changes

**Executions Tab**:
- View execution history (top 50 executions)
- Filter by status: All, Completed, Running, Error
- Click execution to see detailed data and results
- View start time and execution duration

#### 3. Workflow Creation Form
Create new workflows with:
- **Workflow Name**: Unique identifier for the workflow
- **Initial Steps**: Add multiple steps with form builder
- **Real-time Validation**: Form validation before submission
- **Success Feedback**: Confirmation when workflow is created

#### 4. Execution Details Panel
- Right-side collapsible panel for execution information
- View complete execution data in JSON format
- Expandable/collapsible design for space optimization
- Shows input data, output data, and execution metadata

### How to Use the UI

#### Navigate to the UI Tab
1. Open the Workflow Service dashboard: `http://localhost:3001/services/workflow`
2. Click the **UI** tab in the navigation

#### View Existing Workflows
1. The left panel shows all defined workflows
2. Use the search box to filter workflows by name
3. Click on any workflow to see its details
4. View execution history in the Executions tab

#### Create a New Workflow
1. Click the **New Workflow** button in the left panel
2. Enter a workflow name (e.g., "order-processing")
3. Click **Add Step** to define each step in the workflow
4. Enter step names (e.g., "validate-order", "charge-payment")
5. Click **Create Workflow** to save

#### Monitor Workflow Executions
1. Select a workflow from the left panel
2. Click the **Executions** tab
3. Use filter buttons to show: All, Completed, Running, or Error executions
4. Click any row to view full execution details in the right panel
5. View input data, output data, and error messages if applicable

### UI Components

```
┌─────────────────────────────────────────────────────────────┐
│ Workflow Service > UI Tab                                   │
├──────────────┬──────────────────────────────┬────────────────┤
│   Workflows  │                              │    Details     │
│              │     Workflow Editor          │    (Collapsed) │
│  • order-    │  ┌─────────────────────────┐ │                │
│    processing│  │ Details | Executions   │ │ • Expandable   │
│  • data-     │  ├─────────────────────────┤ │ • Shows JSON   │
│    pipeline  │  │ Workflow Definition     │ │   data         │
│  • email-    │  │ - Steps: [...]          │ │ • Execution    │
│    campaign  │  │ - Save Changes          │ │   metadata     │
│              │  │                         │ │                │
│  [Search]    │  │ Execution History       │ │ [Toggle]       │
│  [+ New]     │  │ Status | Started | ... │ │                │
│              │  │ ✓ | 2025-11-22 | ...  │ │                │
│              │  │ ✓ | 2025-11-21 | ...  │ │                │
│              │  └─────────────────────────┘ │                │
└──────────────┴──────────────────────────────┴────────────────┘
```

### Keyboard Shortcuts & Tips

- **Search**: Start typing in the search box to filter workflows
- **Refresh**: Click the refresh button to reload workflow list
- **Filter Executions**: Use the status buttons to filter execution history
- **View Details**: Click any execution row to expand details in the right panel
- **Responsive**: UI adapts to mobile and tablet screens

---

## Analytics Module

The Workflow Service includes built-in analytics that track:

- **Run Count**: Total number of executions
- **Completed Count**: Successfully completed executions
- **Error Count**: Failed executions
- **Last Run**: Most recent execution timestamp
- **Average Duration**: Average execution time in milliseconds
- **Active Count**: Currently executing workflows

### Analytics Methods

**`getStats()`**
Returns overall statistics across all workflows with counts and percentages

**`getWorkflowAnalytics()`**
Returns detailed analytics for all workflows ordered by most recent execution

**`getWorkflowAnalyticsByName(workflowName)`**
Returns analytics for a specific workflow

---

## Advanced Usage Patterns

### 1. Data Transformation Pipeline

```javascript
// Define a workflow that transforms data through multiple steps
async function setupDataPipeline() {
  await workflow.defineWorkflow('data-transformation', [
    'steps/extract-source.js',    // Reads data from source
    'steps/clean-data.js',         // Removes nulls/duplicates
    'steps/normalize-values.js',   // Standardizes format
    'steps/enrich-data.js',        // Adds calculated fields
    'steps/validate-output.js',    // Verifies data quality
    'steps/export-target.js'       // Writes to destination
  ]);

  // Run with initial source configuration
  await workflow.runWorkflow('data-transformation',
    {
      sourceType: 'csv',
      sourcePath: '/data/raw.csv',
      targetPath: '/data/clean.csv'
    },
    (status) => {
      if (status.status === 'step_end') {
        console.log(`Transformed: ${status.stepName}`);
      }
    }
  );
}
```

### 2. Conditional Workflow Execution

```javascript
class ConditionalWorkflow {
  constructor(workflow) {
    this.workflow = workflow;
  }

  async runWithConditions(workflowName, data, conditions) {
    const callback = (status) => {
      if (status.status === 'step_end') {
        // Check if conditions are met for next step
        const nextStepCondition = conditions[status.stepName];
        if (nextStepCondition && !nextStepCondition(status.data)) {
          console.log(`Skipping next step for ${status.stepName}`);
        }
      }
    };

    await this.workflow.runWorkflow(workflowName, data, callback);
  }
}

// Usage
const conditionalWf = new ConditionalWorkflow(workflow);
await conditionalWf.runWithConditions('order-processing',
  { orderId: 123 },
  {
    'Step 1: validate-order.js': (data) => data.isValid === true,
    'Step 2: charge-payment.js': (data) => data.totalAmount > 0
  }
);
```

### 3. Workflow with Error Recovery

```javascript
async function runWorkflowWithRetry(workflowName, data, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Execution attempt ${attempt}/${maxRetries}`);

      await workflow.runWorkflow(workflowName, data, (status) => {
        if (status.status === 'step_error') {
          lastError = status.error;
          console.error(`Step failed: ${status.error}`);
        }
      });

      return; // Success
    } catch (error) {
      lastError = error.message;

      if (attempt === maxRetries) {
        console.error(`Workflow failed after ${maxRetries} attempts`);
        throw error;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

### 4. Workflow with Progress Monitoring

```javascript
class WorkflowMonitor {
  constructor(workflow) {
    this.workflow = workflow;
    this.progress = { current: 0, total: 0 };
  }

  async runWithMonitoring(workflowName, data, totalSteps) {
    this.progress.total = totalSteps;
    this.progress.current = 0;

    const callback = (status) => {
      if (status.status === 'step_end') {
        this.progress.current++;
        const percentage = Math.round((this.progress.current / this.progress.total) * 100);
        console.log(`Progress: ${percentage}% [${this.progress.current}/${this.progress.total}]`);
      }
    };

    await this.workflow.runWorkflow(workflowName, data, callback);
  }
}

// Usage
const monitor = new WorkflowMonitor(workflow);
await monitor.runWithMonitoring('order-processing',
  { orderId: 123 },
  3  // Total number of steps
);
```

---

## Examples & Recipes

### Recipe: Order Processing Workflow

```javascript
async function setupOrderProcessing(workflow) {
  // Define the order processing workflow
  await workflow.defineWorkflow('order-processing', [
    'steps/validate-order.js',
    'steps/check-inventory.js',
    'steps/calculate-tax.js',
    'steps/charge-payment.js',
    'steps/send-confirmation.js'
  ]);

  // Execute the workflow
  await workflow.runWorkflow('order-processing',
    {
      orderId: 'ORD-12345',
      customerId: 'CUST-789',
      items: [
        { sku: 'ITEM-1', quantity: 2, price: 100 },
        { sku: 'ITEM-2', quantity: 1, price: 150 }
      ],
      shippingAddress: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001'
      }
    },
    (status) => {
      if (status.status === 'step_start') {
        console.log(`Processing step: ${status.stepName}`);
      } else if (status.status === 'step_end') {
        console.log(`Completed step: ${status.stepName}`);
      } else if (status.status === 'workflow_complete') {
        console.log('Order confirmed:', status.finalData);
      } else if (status.status === 'step_error') {
        console.error('Order processing failed:', status.error);
      }
    }
  );
}
```

### Recipe: Data Processing Pipeline

```javascript
async function setupDataProcessing(workflow) {
  // Define multi-step data processing
  await workflow.defineWorkflow('data-etl', [
    'steps/extract-data.js',
    'steps/transform-data.js',
    'steps/validate-data.js',
    'steps/load-database.js',
    'steps/notify-completion.js'
  ]);

  // Run ETL pipeline
  const results = [];
  await workflow.runWorkflow('data-etl',
    {
      source: 'api',
      sourceUrl: 'https://api.example.com/data',
      targetTable: 'processed_data',
      batchSize: 1000
    },
    (status) => {
      results.push({
        step: status.stepName,
        status: status.status,
        timestamp: new Date().toISOString()
      });

      if (status.status === 'workflow_complete') {
        console.log('ETL Pipeline Complete');
        console.log('Results:', results);
      }
    }
  );

  return results;
}
```

### Recipe: Document Processing Workflow

```javascript
async function setupDocumentProcessing(workflow) {
  await workflow.defineWorkflow('document-processing', [
    'steps/upload-document.js',
    'steps/extract-text.js',
    'steps/analyze-content.js',
    'steps/classify-document.js',
    'steps/store-metadata.js',
    'steps/send-notification.js'
  ]);

  // Process documents
  await workflow.runWorkflow('document-processing',
    {
      documentId: 'DOC-001',
      documentType: 'invoice',
      filePath: '/uploads/invoice.pdf',
      userId: 'user-123'
    },
    (status) => {
      if (status.status === 'step_error') {
        console.error(`Document processing failed at ${status.stepName}: ${status.error}`);
      }
      if (status.status === 'workflow_complete') {
        console.log('Document processed successfully');
      }
    }
  );
}
```

---

## Troubleshooting

### Issue: Workflow Not Found

**Symptoms**: "Workflow 'xxx' not found" error

**Causes**:
- Workflow not defined before execution
- Workflow name mismatch

**Solutions**:

```javascript
// Verify workflow is defined
const workflows = await workflow.getSettings();
console.log('Defined workflows:', Object.keys(workflows.workflows || {}));

// Define the workflow first
await workflow.defineWorkflow('my-workflow', ['step1.js', 'step2.js']);

// Then run it
await workflow.runWorkflow('my-workflow', {});
```

---

### Issue: Step Execution Fails

**Symptoms**: "Step execution failed" error

**Causes**:
- Step file not found
- Step file has syntax errors
- Step returns error status
- Working service not available

**Solutions**:

```javascript
// Check step files exist
const path = require('node:path');
const fs = require('node:fs').promises;

async function validateSteps(stepPaths) {
  for (const stepPath of stepPaths) {
    try {
      await fs.access(stepPath);
      console.log(`✓ Step exists: ${stepPath}`);
    } catch (error) {
      console.error(`✗ Step not found: ${stepPath}`);
    }
  }
}

// Use error callback
await workflow.runWorkflow('my-workflow', {}, (status) => {
  if (status.status === 'step_error') {
    console.error(`Step failed: ${status.stepName}`);
    console.error(`Error: ${status.error}`);
  }
});
```

---

### Issue: High Memory Usage

**Symptoms**: Memory continuously growing

**Causes**:
- Large data objects passed between steps
- Too many concurrent workflows
- Callbacks retaining references

**Solutions**:

```javascript
// Monitor workflow execution
const stats = await workflow.getSettings();
const analytics = workflow.analytics;

if (analytics) {
  const workflowStats = analytics.getStats();
  console.log('Active workflows:', workflowStats.counts.active);
  console.log('Completed:', workflowStats.counts.completed);
}

// Limit concurrent executions
await workflow.saveSettings({
  maxSteps: 10,  // Reduce max steps
  timeoutPerStep: 30000  // Reduce timeout
});
```

---

## Interactive Web UI

The Workflow Service provides an interactive web dashboard for managing and monitoring workflows. This UI is automatically served when the service is initialized with Express routes.

**Access the UI**:
```
http://localhost:3001/services/workflow/views/
```

**Features**:
- **Left Navigation Panel** - Browse all defined workflows with search
  - Workflow names with visual indicators
  - "New Workflow" button for creating workflows
  - Search functionality for filtering

- **Workflow Editor** - View and edit workflow definitions
  - Workflow ID and metadata
  - Workflow steps display
  - Execution history
  - Step details and configuration

- **Executions Tab** - Monitor execution history
  - Status filtering (Completed, Running, Error)
  - Execution timestamps and duration
  - Execution data viewer in collapsible right panel
  - Step-by-step execution details

- **Details Panel** - Right-side collapsible panel
  - View execution data in JSON format
  - Workflow configuration details
  - Step execution status

- **Workflow Creator** - Interactive form for new workflows
  - Workflow name input
  - Custom step configuration
  - JSON definition editor with format helper

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
        <h1 class="page-title">Workflow Management</h1>
        <p class="page-subtitle">Define and orchestrate multi-step workflows</p>
      </div>
    </div>

    <!-- Alert Containers -->
    <div class="alert alert-success" id="successAlert">
      <strong>Success!</strong> <span id="successMessage"></span>
    </div>
    <div class="alert alert-error" id="errorAlert">
      <strong>Error!</strong> <span id="errorMessage"></span>
    </div>

    <!-- Main Content Grid with Resizable Panels -->
    <div class="workflow-container" style="display: grid; grid-template-columns: 250px 1fr 350px; gap: 1rem; height: calc(100vh - 300px);">
      <!-- Left Panel: Workflow Navigation -->
      <div id="workflowNav" class="workflow-list-panel" style="overflow-y: auto; border-right: 1px solid #dee2e6;">
        <!-- Navigation items rendered here -->
      </div>

      <!-- Center Panel: Workflow Details and Editor -->
      <div id="workflowContent" class="workflow-content-panel" style="overflow-y: auto;">
        <!-- Workflow details and editor rendered here -->
      </div>

      <!-- Right Panel: Execution Details (Collapsible) -->
      <div id="workflowDetails" class="workflow-details-panel" style="overflow-y: auto; border-left: 1px solid #dee2e6; display: none;">
        <!-- Execution details rendered here -->
      </div>
    </div>
  </main>

  <!-- Required Scripts -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
  <script src="/services/js/navigation.js"></script>
  <script src="/services/workflow/scripts/client.js"></script>
  <script src="/services/workflow/views/script.js"></script>
</body>
</html>
```

**Required HTML Element IDs:**
- `#navigation-sidebar` - Sidebar navigation container
- `#successAlert`, `#successMessage` - Success notification containers
- `#errorAlert`, `#errorMessage` - Error notification containers
- `#workflowNav` - Left panel for workflow list and search
- `#workflowContent` - Center panel for workflow editor and details
- `#workflowDetails` - Right panel for execution details (collapsible)

**Required CSS Classes:**
- `.workflow-container` - Main grid container
- `.workflow-list-panel` - Left navigation panel
- `.workflow-content-panel` - Center content panel
- `.workflow-details-panel` - Right details panel
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
- `/services/workflow/scripts/client.js` - Client library
- `/services/workflow/views/script.js` - Dashboard script

**Layout Notes:**
- Three-panel layout: Left nav (25%) → Center editor (50%) → Right details (25%)
- Right panel is collapsible and shows execution/workflow details
- All panels are vertically scrollable
- Responsive design collapses on smaller screens

---

## Best Practices

1. **Define workflows once, run multiple times** - Define workflows during initialization
2. **Keep steps focused** - Each step should have a single responsibility
3. **Implement error handling** - Use status callback to handle step errors
4. **Monitor execution** - Check analytics regularly
5. **Set appropriate timeouts** - Prevent long-running hangs with reasonable timeouts
6. **Test steps independently** - Verify each step works before adding to workflow
7. **Document workflow steps** - Clearly comment what each step does
8. **Use meaningful names** - Descriptive workflow and step names aid debugging
9. **Handle large data** - Be careful with large objects between steps
10. **Log important events** - Enable debugging and monitoring

---

**Documentation Complete** ✓

For questions, see the [documentation index](./README.md).
