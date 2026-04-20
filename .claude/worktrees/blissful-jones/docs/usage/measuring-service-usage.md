# MeasuringService - Comprehensive Usage Guide

**Version:** 1.0.15
**Last Updated:** 2026-04-04
**Status:** Production Ready ✓

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Service Overview](#service-overview)
3. [Creating and Configuring MeasuringService](#creating-and-configuring-measuringservice)
4. [Service API - Node.js](#service-api---nodejs)
5. [Providers](#providers)
6. [REST API Endpoints](#rest-api-endpoints)
7. [Analytics Module](#analytics-module)
8. [Web UI Dashboard](#web-ui-dashboard)
9. [Event System](#event-system)
10. [Settings Management](#settings-management)
11. [Advanced Usage Patterns](#advanced-usage-patterns)
12. [Examples and Recipes](#examples-and-recipes)
13. [Troubleshooting & Best Practices](#troubleshooting--best-practices)

---

## Quick Start

The MeasuringService is a metrics collection and aggregation service for tracking measurements across your application.

### Installation & Basic Usage

```javascript
const createMeasuringService = require('./src/measuring');
const EventEmitter = require('events');

// Create event emitter
const eventEmitter = new EventEmitter();

// Create measuring service (default in-memory provider)
const measuring = createMeasuringService('default', {
  dependencies: { logging: logger },
  dataRetention: 30,        // Retain data for 30 days
  aggregationInterval: 60,  // Aggregate every 60 seconds
  metricsLimit: 1000        // Track up to 1000 metrics
}, eventEmitter);

// Add a metric measurement
measuring.add('response_time', 125);  // 125ms
measuring.add('response_time', 98);
measuring.add('response_time', 142);

// Query metrics
const today = new Date();
const tomorrow = new Date(today.getTime() + 24*60*60*1000);

const measurements = measuring.list('response_time', today, tomorrow);
console.log('Total measurements:', measurements.length);

const total = measuring.total('response_time', today, tomorrow);
console.log('Total response time:', total, 'ms');

const average = measuring.average('response_time', today, tomorrow);
console.log('Average response time:', average, 'ms');

// Get analytics
const stats = measuring.analytics.getUniqueMetricCount();
console.log('Metrics being tracked:', stats);

const topMetrics = measuring.analytics.getTopMetricsByCount(5);
console.log('Top 5 metrics:', topMetrics);
```

---

## Service Overview

### Key Features

The MeasuringService provides:

- **Simple Metric Recording** - Add measurements to named metrics with automatic timestamps
- **Data Aggregation** - Calculate sums and averages over date ranges
- **Real-Time Analytics** - Track top metrics and recent activity automatically
- **REST API** - Full HTTP API for remote metric operations
- **Web Dashboard** - Professional UI for viewing metrics and configuring settings
- **Event-Driven** - Emits events for all metric operations
- **Flexible Storage** - In-memory default or remote API provider
- **Settings Management** - Configurable data retention, aggregation, and limits

### Typical Use Cases

1. **Performance Monitoring** - Track API response times, database query durations
2. **Business Metrics** - Count user actions, revenue, transactions
3. **System Monitoring** - CPU usage, memory, disk I/O measurements
4. **Analytics** - User activity, feature usage, engagement metrics
5. **SLA Tracking** - Calculate uptime, availability metrics
6. **Cost Analysis** - Track resource consumption and costs

### Architecture

```
┌─────────────────────────────────────┐
│   Application Code                   │
│   measuring.add('metric_name', val) │
└──────────────┬──────────────────────┘
               │
       ┌───────▼────────┐
       │  MeasuringAPI  │  (Express Route Handlers)
       └───────┬────────┘
               │
   ┌───────────┴────────────────┐
   │                            │
┌──▼──────────────┐   ┌────────▼───────┐
│  Default        │   │  API Provider  │
│  Provider       │   │  (HTTP Proxy)  │
│  (In-Memory)    │   └────────┬───────┘
└──┬──────────────┘            │
   │                            │
   └───────────┬────────────────┘
               │
        ┌──────▼──────┐
        │  Analytics  │  (Real-time tracking)
        │  Module     │
        └─────────────┘
```

---

## Creating and Configuring MeasuringService

### Factory Function

```javascript
const measuring = createMeasuringService(type, options, eventEmitter);
```

### Parameters

**`type`** (string, required)
- `'default'` - In-memory provider (fast, local storage)
- `'api'` - Remote API provider (uses HTTP to remote backend)

**`options`** (Object, optional)
- `dependencies` (Object) - Injected services
  - `logging` - Logger service for operations
  - `queueing` - Optional queue service
  - `caching` - Optional cache service
- `dataRetention` (number) - Days to retain metrics (default: 30)
- `aggregationInterval` (number) - Seconds between aggregation (default: 60)
- `metricsLimit` (number) - Maximum metrics to track (default: 1000)
- `apiRoot` (string) - For API provider, root URL (default: http://localhost:3000)
- `apiKey` (string) - For API provider, authentication key
- `timeout` (number) - Request timeout in ms (default: 5000)

**`eventEmitter`** (EventEmitter, optional)
- Node.js EventEmitter for lifecycle events
- If not provided, no events will be emitted

### Configuration Examples

#### In-Memory Provider (Default)

```javascript
const measuring = createMeasuringService('default', {
  dependencies: { logging: logger },
  dataRetention: 30,
  aggregationInterval: 60,
  metricsLimit: 1000
}, eventEmitter);
```

#### API Provider

```javascript
const measuring = createMeasuringService('api', {
  dependencies: { logging: logger },
  apiRoot: 'https://metrics.example.com',
  apiKey: 'your-api-key',
  timeout: 10000
}, eventEmitter);
```

#### Minimal Configuration

```javascript
const measuring = createMeasuringService('default');
// Uses all defaults, no logging, no events
```

---

## Service API - Node.js

### Core Methods

#### `add(metricName: string, value: number): void`

Add a measurement to a metric.

```javascript
// Simple measurement
measuring.add('page_load_time', 1250);

// In a performance monitoring context
const startTime = performance.now();
// ... do something ...
const duration = performance.now() - startTime;
measuring.add('operation_duration', duration);

// Tracking user actions
measuring.add('user_login', 1);
measuring.add('user_logout', 1);
measuring.add('product_purchase', 99.99);

// Memory and system metrics
measuring.add('memory_usage_mb', process.memoryUsage().heapUsed / 1024 / 1024);
measuring.add('cpu_usage_percent', Math.random() * 100);
```

**Behavior:**
- Creates metric if it doesn't exist
- Stores value with current timestamp
- Emits `measuring:add` event
- No return value

---

#### `list(metricName: string, startDate: Date, endDate: Date): Array`

Retrieve all measurements for a metric within a date range.

```javascript
const today = new Date();
const tomorrow = new Date(today.getTime() + 24*60*60*1000);

const measurements = measuring.list('response_time', today, tomorrow);
// Returns: [{value: 125, timestamp: Date}, {value: 98, timestamp: Date}, ...]

// Last hour
const oneHourAgo = new Date(Date.now() - 60*60*1000);
const recentMetrics = measuring.list('events', oneHourAgo, new Date());

// Entire month
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
const monthlyData = measuring.list('sales', monthStart, monthEnd);
```

**Returns:**
- Array of measurement objects: `[{value: number, timestamp: Date}, ...]`
- Empty array if no measurements found in range
- Date range is inclusive on both ends

---

#### `total(metricName: string, startDate: Date, endDate: Date): number`

Calculate the sum of all measurements for a metric in a date range.

```javascript
const today = new Date();
const tomorrow = new Date(today.getTime() + 24*60*60*1000);

const totalTime = measuring.total('response_time', today, tomorrow);
console.log('Total response time:', totalTime, 'ms');

const totalRevenue = measuring.total('revenue', today, tomorrow);
console.log('Daily revenue:', totalRevenue, '$');

const totalPageViews = measuring.total('page_views', today, tomorrow);
console.log('Page views today:', totalPageViews);

// Average by count
const measurements = measuring.list('events', today, tomorrow);
const total = measuring.total('events', today, tomorrow);
const average = total / measurements.length; // 0 if empty
```

**Returns:**
- Sum of all values in the range (number)
- 0 if no measurements found

---

#### `average(metricName: string, startDate: Date, endDate: Date): number`

Calculate the average (mean) of all measurements for a metric in a date range.

```javascript
const today = new Date();
const tomorrow = new Date(today.getTime() + 24*60*60*1000);

const avgResponseTime = measuring.average('response_time', today, tomorrow);
console.log('Average response time:', avgResponseTime, 'ms');

const avgOrderValue = measuring.average('order_value', today, tomorrow);
console.log('Average order value:', avgOrderValue, '$');

// Track SLA compliance
const avgLatency = measuring.average('api_latency', today, tomorrow);
if (avgLatency > 500) {
  console.warn('SLA violation: average latency above 500ms threshold');
}
```

**Returns:**
- Average value (number)
- 0 if no measurements found

---

#### `async getSettings(): Promise<Object>`

Retrieve current service settings.

```javascript
const settings = await measuring.getSettings();
console.log(settings);
// Output:
// {
//   description: "Configuration settings for the measuring service",
//   list: [
//     { setting: 'dataRetention', type: 'number', values: null },
//     { setting: 'aggregationInterval', type: 'number', values: null },
//     { setting: 'metricsLimit', type: 'number', values: null }
//   ],
//   dataRetention: 30,
//   aggregationInterval: 60,
//   metricsLimit: 1000
// }

// Check current settings
const settings = await measuring.getSettings();
console.log('Data retention period:', settings.dataRetention, 'days');
console.log('Aggregation interval:', settings.aggregationInterval, 'seconds');
console.log('Max metrics:', settings.metricsLimit);
```

**Returns:**
- Settings object with description, list of configurable settings, and current values

---

#### `async saveSettings(settings: Object): Promise<void>`

Update service settings.

```javascript
// Update data retention to 60 days
await measuring.saveSettings({
  dataRetention: 60
});

// Update multiple settings
await measuring.saveSettings({
  dataRetention: 60,
  aggregationInterval: 120,  // 2 minutes
  metricsLimit: 2000
});

// With error handling
try {
  await measuring.saveSettings({
    dataRetention: 365,
    aggregationInterval: 300
  });
  console.log('Settings updated successfully');
} catch (error) {
  console.error('Failed to save settings:', error.message);
}
```

**Behavior:**
- Updates configuration persisted in service
- Validates against settings.list
- Logs changes via `this.logger?.info()` (silent if logger unavailable)
- No return value

---

### Analytics Methods

The service provides real-time analytics through the `analytics` module:

#### `measuring.analytics.getUniqueMetricCount(): number`

Returns the count of distinct metrics being tracked.

```javascript
measuring.add('page_views', 1);
measuring.add('page_views', 1);
measuring.add('user_clicks', 1);
measuring.add('api_calls', 1);

const count = measuring.analytics.getUniqueMetricCount();
console.log('Tracking', count, 'different metrics');  // Output: Tracking 3 different metrics
```

---

#### `measuring.analytics.getMeasurementCount(): number`

Returns the total count of all measurements across all metrics.

```javascript
measuring.add('page_views', 1);
measuring.add('page_views', 1);
measuring.add('user_clicks', 1);

const count = measuring.analytics.getMeasurementCount();
console.log('Total measurements:', count);  // Output: Total measurements: 3
```

---

#### `measuring.analytics.getTopMetricsByCount(limit: number = 10): Array`

Returns top metrics sorted by frequency (most measured first).

```javascript
const topMetrics = measuring.analytics.getTopMetricsByCount(5);
console.log('Top 5 metrics:', topMetrics);
// Output: [
//   {
//     metric: 'page_views',
//     count: 1250,
//     lastCaptured: '2025-11-23T10:30:45.123Z',
//     lastValue: 1,
//     totalValue: 1250
//   },
//   {
//     metric: 'api_calls',
//     count: 850,
//     lastCaptured: '2025-11-23T10:30:44.456Z',
//     lastValue: 1,
//     totalValue: 850
//   },
//   ...
// ]
```

**Parameters:**
- `limit` (number, default 10) - Number of top metrics to return (max: 100)

---

#### `measuring.analytics.getTopMetricsByRecency(limit: number = 100): Array`

Returns top metrics sorted by most recent measurement time.

```javascript
const recentMetrics = measuring.analytics.getTopMetricsByRecency(20);
// Returns 20 metrics most recently updated
```

**Parameters:**
- `limit` (number, default 100) - Number of metrics to return (max: 250)

---

#### `measuring.analytics.getRecentHistory(limit: number = 50): Array`

Returns the most recent measurements across all metrics.

```javascript
const history = measuring.analytics.getRecentHistory(100);
console.log('Recent activity:', history);
// Output: [
//   {
//     metric: 'api_calls',
//     value: 1,
//     capturedAt: '2025-11-23T10:30:45.123Z'
//   },
//   {
//     metric: 'page_views',
//     value: 1,
//     capturedAt: '2025-11-23T10:30:44.456Z'
//   },
//   ...
// ]

// Track recent user activity
const recentActivity = measuring.analytics.getRecentHistory(50);
recentActivity.forEach(entry => {
  console.log(`${entry.metric}: ${entry.value} at ${entry.capturedAt}`);
});
```

**Parameters:**
- `limit` (number, default 50) - Number of recent entries to return (max: 1000)

---

#### `measuring.analytics.destroy(): void`

Removes all event listeners and clears analytics stats/history. Call this when a measuring instance is no longer needed to prevent memory leaks.

```javascript
// When shutting down or removing an instance
measuring.analytics.destroy();
```

---

## Providers

### Default Provider (In-Memory)

The default provider stores metrics in memory, providing fast, local metric storage.

**Best For:**
- Development and testing
- Single-server deployments
- Metrics that don't require persistence
- High-frequency metric recording

**Characteristics:**
- Fast (no network overhead)
- Data lost on process restart
- Single-instance data
- Configurable size limits

**Configuration:**

```javascript
const measuring = createMeasuringService('default', {
  dependencies: { logging: logger },
  dataRetention: 30,        // How long to keep data (days)
  aggregationInterval: 60,  // Aggregation frequency (seconds)
  metricsLimit: 1000        // Max distinct metrics to track
}, eventEmitter);
```

**Example: Tracking Request Metrics**

```javascript
const express = require('express');
const app = express();

const measuring = createMeasuringService('default', {
  dependencies: { logging: logger }
});

// Middleware to track request metrics
app.use((req, res, next) => {
  const startTime = performance.now();

  res.on('finish', () => {
    const duration = performance.now() - startTime;
    measuring.add('request_duration_ms', duration);
    measuring.add(`requests_${res.statusCode}`, 1);
  });

  next();
});

// Query metrics
setInterval(async () => {
  const now = new Date();
  const oneHourAgo = new Date(now - 60*60*1000);

  const avgLatency = measuring.average('request_duration_ms', oneHourAgo, now);
  console.log('Average request latency (1hr):', avgLatency.toFixed(2), 'ms');
}, 60000);
```

---

### API Provider

The API provider proxies metric operations to a remote MeasuringService backend via HTTP.

**Best For:**
- Distributed systems
- Multiple server instances
- Centralized metric collection
- Persistent metric storage

**Characteristics:**
- Network-based (requires connectivity)
- Centralized data
- Supports multiple clients
- Persistent storage option

**Configuration:**

```javascript
const measuring = createMeasuringService('api', {
  dependencies: { logging: logger },
  apiRoot: 'https://metrics.example.com',  // Backend URL
  apiKey: process.env.METRICS_API_KEY,     // Authentication
  timeout: 10000                            // Request timeout (ms)
}, eventEmitter);
```

**Supported Operations:**

1. **Increment Counter**
```javascript
await measuring.increment('user_registrations', 1, {
  source: 'web',
  country: 'US'
});
```

2. **Record Gauge**
```javascript
await measuring.gauge('active_users', 1250, {
  region: 'us-west-2'
});
```

3. **Record Timing**
```javascript
const duration = performance.now() - startTime;
await measuring.timing('database_query_ms', duration, {
  query_type: 'select',
  database: 'users'
});
```

4. **Record Histogram**
```javascript
await measuring.histogram('response_size_kb', 125, {
  endpoint: '/api/users'
});
```

---

## REST API Endpoints

### POST /services/measuring/api/add

Add a measurement to a metric.

**Request:**
```bash
curl -X POST http://localhost:3000/services/measuring/api/add \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "metric": "response_time",
    "value": 125
  }'
```

**Request Body:**
```javascript
{
  "metric": "response_time",  // Required: metric name
  "value": 125               // Required: numeric value
}
```

**Response:**
```javascript
// 200 OK
{ "success": true }
```

**Error Responses:**
```javascript
// 400 Bad Request
{ "error": "Missing metric" }
// or
{ "error": "Missing or invalid value" }

// 500 Server Error
{ "error": "error message" }
```

---

### GET /services/measuring/api/list/:metric/:datestart/:dateend

List all measurements for a metric within a date range.

**Request:**
```bash
curl -X GET "http://localhost:3000/services/measuring/api/list/response_time/2025-11-23/2025-11-24" \
  -H "x-api-key: your-api-key"
```

**Parameters:**
- `metric` (string) - Metric name
- `datestart` (string) - Start date (ISO 8601 format: YYYY-MM-DD)
- `dateend` (string) - End date (ISO 8601 format: YYYY-MM-DD)

**Response:**
```javascript
[
  {
    "value": 125,
    "timestamp": "2025-11-23T10:30:45.123Z"
  },
  {
    "value": 98,
    "timestamp": "2025-11-23T10:31:02.456Z"
  }
]
```

---

### GET /services/measuring/api/total/:metric/:datestart/:dateend

Calculate the sum of measurements for a metric.

**Request:**
```bash
curl -X GET "http://localhost:3000/services/measuring/api/total/revenue/2025-11-23/2025-11-24" \
  -H "x-api-key: your-api-key"
```

**Response:**
```javascript
// 200 OK - Returns the sum as a bare number
5432.50
```

---

### GET /services/measuring/api/average/:metric/:datestart/:dateend

Calculate the average of measurements for a metric.

**Request:**
```bash
curl -X GET "http://localhost:3000/services/measuring/api/average/response_time/2025-11-23/2025-11-24" \
  -H "x-api-key: your-api-key"
```

**Response:**
```javascript
// 200 OK - Returns the average as a bare number
112.75
```

---

### GET /services/measuring/api/status

Check if the measuring service is running.

**Request:**
```bash
curl -X GET http://localhost:3000/services/measuring/api/status \
  -H "x-api-key: your-api-key"
```

**Response:**
```javascript
// 200 OK
"measuring api running"
```

---

### GET /services/measuring/api/analytics/summary

Get analytics summary for dashboard display.

**Request:**
```bash
curl -X GET "http://localhost:3000/services/measuring/api/analytics/summary?topLimit=10&recentLimit=100&historyLimit=50" \
  -H "x-api-key: your-api-key"
```

**Query Parameters:**
- `topLimit` (number, 1-100, default 10) - Number of top metrics
- `recentLimit` (number, 1-250, default 100) - Number of recent metrics
- `historyLimit` (number, 1-250, default 50) - Number of history entries

**Response:**
```javascript
{
  "totals": {
    "uniqueMetrics": 5,
    "totalMeasurements": 1250
  },
  "topByActivity": [
    {
      "metric": "page_views",
      "count": 500,
      "lastCaptured": "2025-11-23T10:30:45.123Z",
      "lastValue": 1,
      "totalValue": 500
    }
  ],
  "topByRecency": [...],
  "recentHistory": [...]
}
```

---

### GET /services/measuring/api/settings

Retrieve current service settings.

**Request:**
```bash
curl -X GET http://localhost:3000/services/measuring/api/settings \
  -H "x-api-key: your-api-key"
```

**Response:**
```javascript
{
  "description": "Configuration settings for the measuring service",
  "list": [
    { "setting": "dataRetention", "type": "number", "values": null },
    { "setting": "aggregationInterval", "type": "number", "values": null },
    { "setting": "metricsLimit", "type": "number", "values": null }
  ],
  "dataRetention": 30,
  "aggregationInterval": 60,
  "metricsLimit": 1000
}
```

---

### POST /services/measuring/api/settings

Update service settings.

**Request:**
```bash
curl -X POST http://localhost:3000/services/measuring/api/settings \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "dataRetention": 60,
    "aggregationInterval": 120,
    "metricsLimit": 2000
  }'
```

**Request Body:**
```javascript
{
  "dataRetention": 60,          // Days to retain metrics
  "aggregationInterval": 120,   // Seconds between aggregation
  "metricsLimit": 2000          // Max metrics to track
}
```

**Response:**
```javascript
// 200 OK
{ "success": true }

// 400 Bad Request
{ "error": "Missing settings" }

// 500 Server Error
{ "error": "error message" }
```

---

## Analytics Module

The analytics module automatically tracks metric activity in real-time, providing insights into which metrics are being recorded and how frequently.

### Real-Time Tracking

Analytics automatically listen to all metric events:

```javascript
// Automatically tracked when you call these:
measuring.add('response_time', 125);
measuring.list('metrics', startDate, endDate);
measuring.total('revenue', startDate, endDate);
measuring.average('latency', startDate, endDate);
```

### Available Methods

```javascript
// Count distinct metrics
const uniqueCount = measuring.analytics.getUniqueMetricCount();
console.log('Tracking metrics:', uniqueCount);

// Total measurements across all metrics
const totalCount = measuring.analytics.getMeasurementCount();
console.log('Total measurements:', totalCount);

// Top metrics by frequency
const topByCount = measuring.analytics.getTopMetricsByCount(10);
topByCount.forEach(metric => {
  console.log(`${metric.metric}: ${metric.count} measurements`);
});

// Top metrics by recency
const topByRecency = measuring.analytics.getTopMetricsByRecency(20);
topByRecency.forEach(metric => {
  console.log(`${metric.metric}: last captured at ${metric.lastCaptured}`);
});

// Recent activity
const recent = measuring.analytics.getRecentHistory(100);
recent.forEach(entry => {
  console.log(`${entry.metric} = ${entry.value} at ${entry.capturedAt}`);
});
```

### Analytics Data Structures

**Metric Statistics Object:**
```javascript
{
  metric: "string",              // Metric name
  count: number,                 // Total measurements for this metric
  lastCaptured: "ISO 8601 date", // When last measurement was added
  lastValue: number,             // Most recent value
  totalValue: number             // Sum of all values
}
```

**History Entry:**
```javascript
{
  metric: "string",              // Metric name
  value: number,                 // Measured value
  capturedAt: "ISO 8601 date"   // Timestamp of measurement
}
```

---

## Web UI Dashboard

### Dashboard Tab

The dashboard provides an overview of metrics activity:

**Cards:**
- **Metrics Overview** - Shows total measurements and unique metric count
- **Top Metrics by Activity** - Lists the 10 most frequently measured metrics
- **Top Metrics (Recent Activity)** - Shows 100 most recently updated metrics
- **Auto-refresh** - Button to manually refresh data

**Features:**
- Real-time activity tracking
- Sortable metrics tables
- Visual indicators of metric frequency
- Last update timestamp

### Data Tab

Record measurements and interact with the API:

**Sections:**
1. **Record Measurement**
   - Metric name input
   - Metric value input
   - Submit button
   - Response display

2. **Service Status**
   - Checks if service is running
   - Shows status and timestamp

3. **API Documentation**
   - Swagger UI with all endpoints
   - Try-it-out feature
   - Request/response examples

### Settings Tab

Manage service configuration:

**Features:**
- Dynamic form generation based on settings.list
- Supports various input types: text, number, date, select
- Save/Reload buttons
- Current settings display
- Success/error notifications

### UI Tab

Interactive metrics viewer and analysis tool:

**Features:**
- **Left Navigation Panel** - Searchable list of all metrics with value counts
- **Center Content Area** - Detailed metric statistics and values display
- **Metrics Statistics** - Real-time calculations of average, maximum, and minimum values
- **Date/Time Filtering** - Filter metrics by date range for precise analysis
- **Metrics Data Table** - Complete history of metric values with timestamps
- **Active Metric Highlighting** - Visual indication of selected metric
- **Responsive Design** - Works on desktop and tablet devices

**Three-Panel Layout:**
1. **Left Panel** - Metric names with counts (searchable with live filtering)
2. **Center Panel** - Selected metric statistics (avg/max/min) and value history table
3. **Optional Right Panel** - Reserved for future subscription/detailed info

**Usage:**
1. Click on any metric name in the left panel to select it
2. View statistical summary (average, max, min) at the top of center panel
3. Use date range selector to filter values by time period
4. View complete measurement history in the table below
5. Use search to quickly find metrics by name pattern

### HTML Container Integration

The web UI is fully self-contained and requires specific HTML elements to function. Use this template to integrate the UI into your application:

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Required CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="/services/css/navigation.css" rel="stylesheet">
  <link href="/styles.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
  <!-- Navigation Sidebar -->
  <aside class="sidebar" id="navigation-sidebar"></aside>

  <!-- Main Content Area -->
  <main class="main-content">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Measuring Service</h1>
        <p class="page-subtitle">Track and analyze application metrics</p>
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
    <ul class="nav nav-tabs mb-4" id="measuringTabs" role="tablist">
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
        <button class="nav-link" id="ui-tab" data-bs-toggle="tab" data-bs-target="#ui">
          UI
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link" id="settings-tab" data-bs-toggle="tab" data-bs-target="#settings">
          Settings
        </button>
      </li>
    </ul>

    <!-- Tab Content -->
    <div class="tab-content" id="measuringTabContent">
      <!-- Dashboard Tab -->
      <div class="tab-pane fade show active" id="dashboard" role="tabpanel">
        <!-- Dashboard cards and charts rendered here -->
      </div>

      <!-- Data Tab -->
      <div class="tab-pane fade" id="data" role="tabpanel">
        <!-- Measurement form and API documentation rendered here -->
      </div>

      <!-- UI Tab -->
      <div class="tab-pane fade" id="ui" role="tabpanel" style="display: flex; height: 600px;">
        <!-- Three-panel layout for metrics visualization -->
        <div id="metricsNav" style="width: 25%; border-right: 1px solid #dee2e6;"></div>
        <div id="metricsContent" style="width: 75%; padding: 1rem;"></div>
      </div>

      <!-- Settings Tab -->
      <div class="tab-pane fade" id="settings" role="tabpanel">
        <!-- Settings form rendered here -->
      </div>
    </div>
  </main>

  <!-- Required Scripts -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
  <script src="/services/js/navigation.js"></script>
  <script src="/services/measuring/scripts/client.js"></script>
  <script src="/services/measuring/views/script.js"></script>
</body>
</html>
```

**Required HTML Element IDs:**
- `#navigation-sidebar` - Sidebar navigation container
- `#successAlert`, `#successMessage` - Success notification container and message
- `#errorAlert`, `#errorMessage` - Error notification container and message
- `#measuringTabs` - Tab navigation container
- `#dashboard-tab`, `#data-tab`, `#ui-tab`, `#settings-tab` - Individual tab buttons
- `#dashboard`, `#data`, `#ui`, `#settings` - Tab content panes
- `#measuringTabContent` - Tab content wrapper

**For UI Tab Specifically:**
- `#metricsNav` - Left panel for metric selection (width: 25%)
- `#metricsContent` - Center panel for statistics and data (width: 75%)

**Required CSS Files:**
- Bootstrap 5.3.2 (CDN)
- `/services/css/navigation.css` - Navigation styling
- `/styles.css` - Global application styles

**Required JavaScript Libraries:**
- Bootstrap 5.3.2 JS Bundle (CDN)
- Chart.js 4.4.0 (CDN) - For chart rendering
- Swagger UI Bundle (CDN) - For API documentation
- `/services/measuring/scripts/client.js` - Client library
- `/services/measuring/views/script.js` - Dashboard script

---

## Event System

The MeasuringService emits events for all operations, allowing you to monitor and react to metric activities.

### Available Events

**Core Events:**

1. **`measuring:add`** - Emitted when a metric is added
```javascript
eventEmitter.on('measuring:add', (data) => {
  console.log('Metric added:', data.metricName, '=', data.measure.value);
});
```

2. **`measuring:list`** - Emitted when metrics are listed
```javascript
eventEmitter.on('measuring:list', (data) => {
  console.log('Metrics retrieved for:', data.metricName);
});
```

3. **`measuring:total`** - Emitted when total is calculated
```javascript
eventEmitter.on('measuring:total', (data) => {
  console.log('Total calculated for:', data.metricName);
});
```

4. **`measuring:average`** - Emitted when average is calculated
```javascript
eventEmitter.on('measuring:average', (data) => {
  console.log('Average calculated for:', data.metricName);
});
```

**API Provider Events:**

5. **`measuring:increment`** - Counter incremented
6. **`measuring:gauge`** - Gauge recorded
7. **`measuring:timing`** - Timing recorded
8. **`measuring:histogram`** - Histogram recorded

**Error Events:**

9. **`measuring:error`** - Operation error
```javascript
eventEmitter.on('measuring:error', (error) => {
  console.error('Measuring error:', error);
});
```

10. **`api-measuring-status`** - Status endpoint called
11. **`api-measuring-settings-error`** - Settings error

### Event Monitoring Example

```javascript
const eventEmitter = new EventEmitter();

// Monitor all measuring events
eventEmitter.on('measuring:add', (data) => {
  console.log(`[METRIC] ${data.metricName} = ${data.measure.value}`);
});

eventEmitter.on('measuring:average', (data) => {
  console.log(`[AVERAGE] ${data.metricName} calculated`);
});

eventEmitter.on('measuring:error', (error) => {
  console.error(`[ERROR] ${error}`);
});

const measuring = createMeasuringService('default', {}, eventEmitter);

// Now all operations will be logged
measuring.add('response_time', 125);  // Logs: [METRIC] response_time = 125
```

---

## Settings Management

### Configurable Settings

**dataRetention** (number)
- How many days to retain historical metrics
- Default: 30 days
- Valid range: 1-365

**aggregationInterval** (number)
- How frequently to aggregate metrics (seconds)
- Default: 60 seconds
- Valid range: 1-3600

**metricsLimit** (number)
- Maximum distinct metrics to track
- Default: 1000
- Valid range: 100-10000

### Getting Settings

```javascript
const settings = await measuring.getSettings();
console.log('Current Settings:');
console.log('- Data Retention:', settings.dataRetention, 'days');
console.log('- Aggregation Interval:', settings.aggregationInterval, 'seconds');
console.log('- Metrics Limit:', settings.metricsLimit);

// Check a specific setting
if (settings.dataRetention < 60) {
  console.warn('Data retention is less than 60 days - consider increasing');
}
```

### Updating Settings

```javascript
// Update single setting
await measuring.saveSettings({
  dataRetention: 60
});

// Update multiple settings
await measuring.saveSettings({
  dataRetention: 90,
  aggregationInterval: 120,
  metricsLimit: 2000
});

// With validation
try {
  await measuring.saveSettings({
    dataRetention: 365,
    aggregationInterval: 300
  });
  console.log('Settings saved successfully');
} catch (error) {
  console.error('Failed to save settings:', error.message);
}
```

### API Endpoint Examples

```bash
# Get settings
curl -X GET http://localhost:3000/services/measuring/api/settings \
  -H "x-api-key: your-api-key"

# Update settings
curl -X POST http://localhost:3000/services/measuring/api/settings \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "dataRetention": 90,
    "aggregationInterval": 120,
    "metricsLimit": 2000
  }'
```

---

## Advanced Usage Patterns

### Pattern 1: Performance Monitoring

Track API performance metrics across your application:

```javascript
const express = require('express');
const measuring = createMeasuringService('default', {});

// Express middleware for performance tracking
const performanceTracker = (req, res, next) => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;

  res.on('finish', () => {
    const duration = performance.now() - startTime;
    const memoryDelta = process.memoryUsage().heapUsed - startMemory;

    // Track metrics
    measuring.add(`route_${req.route?.path || 'unknown'}_duration_ms`, duration);
    measuring.add(`route_${req.route?.path || 'unknown'}_status_${res.statusCode}`, 1);
    measuring.add(`memory_delta_bytes`, memoryDelta);

    // Log slow requests
    if (duration > 1000) {
      console.warn(`Slow request: ${req.path} took ${duration}ms`);
    }
  });

  next();
};

app.use(performanceTracker);
```

### Pattern 2: Business Analytics

Track business metrics and KPIs:

```javascript
// Track user activities
measuring.add('user_registration', 1);
measuring.add('user_login', 1);
measuring.add('user_logout', 1);
measuring.add('user_profile_update', 1);

// Track transactions
measuring.add('transaction_amount', 99.99);  // Record transaction
measuring.add('transaction_success', 1);     // Count successes
measuring.add('transaction_failure', 0);     // Count failures

// Track feature usage
measuring.add('feature_export_used', 1);
measuring.add('feature_filter_applied', 1);
measuring.add('feature_sort_used', 1);

// Query daily metrics
const today = new Date();
const tomorrow = new Date(today.getTime() + 24*60*60*1000);

const dailyRevenue = measuring.total('transaction_amount', today, tomorrow);
const registrations = measuring.total('user_registration', today, tomorrow);
const loginCount = measuring.total('user_login', today, tomorrow);

console.log(`Daily Report:
  Revenue: $${dailyRevenue}
  Registrations: ${registrations}
  Active Users: ${loginCount}`);
```

### Pattern 3: SLA Monitoring

Monitor Service Level Agreement metrics:

```javascript
// Record API response times
measuring.add('api_response_time_ms', responseTime);

// Check SLA compliance
async function checkSLACompliance() {
  const now = new Date();
  const oneHourAgo = new Date(now - 60*60*1000);

  // Target: 95% requests under 200ms
  const measurements = measuring.list('api_response_time_ms', oneHourAgo, now);
  const underThreshold = measurements.filter(m => m.value < 200).length;
  const percentage = (underThreshold / measurements.length) * 100;

  console.log(`SLA Compliance: ${percentage.toFixed(2)}% of requests under 200ms`);

  if (percentage < 95) {
    console.warn('⚠️ SLA VIOLATION: Not meeting 95% target');
    // Send alert
  }
}

setInterval(checkSLACompliance, 60*60*1000);  // Check every hour
```

### Pattern 4: Alert Generation

Generate alerts based on metric thresholds:

```javascript
function setupMetricAlerts() {
  // Alert if response time exceeds threshold
  eventEmitter.on('measuring:add', (data) => {
    if (data.metricName === 'response_time' && data.measure.value > 1000) {
      console.error(`🚨 ALERT: Slow response detected! ${data.measure.value}ms`);
      // Send to monitoring system
    }
  });

  // Monitor error rates
  setInterval(async () => {
    const now = new Date();
    const oneMinuteAgo = new Date(now - 60*1000);

    const totalRequests = measuring.total('requests_count', oneMinuteAgo, now);
    const errorRequests = measuring.total('requests_5xx', oneMinuteAgo, now);
    const errorRate = (errorRequests / totalRequests) * 100;

    if (errorRate > 5) {
      console.error(`🚨 ALERT: Error rate ${errorRate.toFixed(2)}% exceeds threshold!`);
    }
  }, 60*1000);
}
```

### Pattern 5: Data Aggregation and Reporting

Generate periodic reports from metrics:

```javascript
async function generateDailyReport() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const report = {
    date: today.toISOString().split('T')[0],
    metrics: measuring.analytics.getTopMetricsByCount(20),
    summary: {
      totalMetrics: measuring.analytics.getUniqueMetricCount(),
      totalMeasurements: measuring.analytics.getMeasurementCount()
    }
  };

  // Add calculated metrics
  report.performance = {
    avgResponseTime: measuring.average('response_time', today, tomorrow),
    totalRequests: measuring.total('request_count', today, tomorrow)
  };

  report.business = {
    revenue: measuring.total('transaction_amount', today, tomorrow),
    transactions: measuring.total('transaction_count', today, tomorrow),
    newUsers: measuring.total('user_registration', today, tomorrow)
  };

  // Save report
  await saveReportToDatabase(report);
  console.log('Daily report generated:', report);
}

// Run daily at 1 AM
schedule.scheduleJob('0 1 * * *', generateDailyReport);
```

---

## Examples and Recipes

### Example 1: API Response Time Monitoring

```javascript
const measuring = createMeasuringService('default', {
  dependencies: { logging: logger }
});

// Middleware to track all requests
app.use((req, res, next) => {
  const startTime = performance.now();

  res.on('finish', () => {
    const duration = performance.now() - startTime;
    measuring.add('api_response_time', duration);
    measuring.add(`api_response_${res.statusCode}`, 1);
  });

  next();
});

// Endpoint to check performance
app.get('/health/performance', (req, res) => {
  const now = new Date();
  const oneHourAgo = new Date(now - 60*60*1000);

  const avgTime = measuring.average('api_response_time', oneHourAgo, now);
  const totalRequests = measuring.total('api_response_200', oneHourAgo, now) +
                       measuring.total('api_response_201', oneHourAgo, now);

  res.json({
    averageResponseTime: avgTime.toFixed(2),
    totalRequests: totalRequests,
    status: avgTime < 500 ? 'healthy' : 'degraded'
  });
});
```

### Example 2: Database Query Performance

```javascript
const measuring = createMeasuringService('default', {});

async function executeQuery(sql, params = []) {
  const startTime = performance.now();

  try {
    const result = await db.query(sql, params);
    const duration = performance.now() - startTime;

    measuring.add('database_query_time_ms', duration);
    measuring.add('database_query_success', 1);

    return result;
  } catch (error) {
    measuring.add('database_query_error', 1);
    throw error;
  }
}

// Monitor queries
setInterval(() => {
  const now = new Date();
  const fiveMinutesAgo = new Date(now - 5*60*1000);

  const avgQueryTime = measuring.average('database_query_time_ms', fiveMinutesAgo, now);
  const errorCount = measuring.total('database_query_error', fiveMinutesAgo, now);

  console.log(`Database Performance (5min):
    Avg Query Time: ${avgQueryTime.toFixed(2)}ms
    Errors: ${errorCount}`);
}, 5*60*1000);
```

### Example 3: User Activity Tracking

```javascript
const measuring = createMeasuringService('default', {});

// Track user actions
function trackUserAction(userId, action, metadata = {}) {
  measuring.add(`user_action_${action}`, 1);
  measuring.add(`user_${userId}_actions`, 1);

  // Track specific properties
  if (metadata.duration) {
    measuring.add(`action_${action}_duration_ms`, metadata.duration);
  }
}

// Usage
trackUserAction('user123', 'page_view');
trackUserAction('user123', 'button_click', { duration: 250 });
trackUserAction('user456', 'purchase', { duration: 5000 });

// Generate user activity report
app.get('/reports/user-activity', (req, res) => {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24*60*60*1000);

  const stats = measuring.analytics.getTopMetricsByCount(20);
  const activities = stats
    .filter(s => s.metric.startsWith('user_action_'))
    .map(s => ({
      action: s.metric.replace('user_action_', ''),
      count: s.count
    }));

  res.json({ activityReport: activities });
});
```

### Example 4: Centralized Metrics with API Provider

```javascript
const measuring = createMeasuringService('api', {
  apiRoot: 'https://metrics.example.com',
  apiKey: process.env.METRICS_API_KEY
}, eventEmitter);

// Send metrics to central server
async function recordMetric(name, value) {
  try {
    await measuring.increment(name, value, {
      service: 'service-a',
      environment: process.env.NODE_ENV,
      version: '1.0.0'
    });
  } catch (error) {
    console.error('Failed to record metric:', error);
  }
}

// Record various metrics
recordMetric('api_requests', 1);
recordMetric('database_queries', 1);
recordMetric('cache_hits', 1);
```

---

## Troubleshooting & Best Practices

### Common Issues

**Q: Metrics not appearing in analytics?**
- Ensure metrics are being added: `measuring.add()`
- Check that EventEmitter is provided to service
- Verify analytics are initialized: `measuring.analytics`

**Q: Performance impact from measuring service?**
- Use appropriate `metricsLimit` setting
- Archive old data regularly
- Consider using API provider for distribution

**Q: Date range queries return empty?**
- Ensure metrics were added within the date range
- Check that dates are in ISO 8601 format
- Verify date range is inclusive (start and end included)

**Q: Settings not persisting?**
- Settings persist in memory during process lifetime
- Use API provider or database integration for persistence
- Call `await measuring.saveSettings()` before shutdown

### Best Practices

1. **Use Meaningful Metric Names**
   - Use snake_case: `response_time_ms`, `user_login_count`
   - Include units when relevant: `_ms`, `_bytes`, `_percent`
   - Use consistent naming conventions

2. **Sample High-Frequency Metrics**
   - Don't record every single event
   - Use sampling for high-frequency operations
   - Adjust `metricsLimit` based on needs

3. **Monitor Analytics Growth**
   ```javascript
   const uniqueCount = measuring.analytics.getUniqueMetricCount();
   if (uniqueCount > 800) {
     console.warn('Approaching metrics limit!');
   }
   ```

4. **Clean Up Periodically**
   - Configure appropriate `dataRetention`
   - Archive metrics to database for long-term analysis
   - Clear old metrics regularly

5. **Use Events for Monitoring**
   ```javascript
   eventEmitter.on('measuring:error', (error) => {
     // Handle measurement errors
     logger.error('Measuring error:', error);
   });
   ```

6. **Test Date Ranges**
   ```javascript
   // Always use proper date objects
   const startDate = new Date('2025-11-23');
   const endDate = new Date('2025-11-24');
   const measurements = measuring.list('metric_name', startDate, endDate);
   ```

### Performance Optimization

1. **For High-Volume Metrics:**
   - Use default provider for fast local recording
   - Batch API calls with API provider
   - Implement sampling strategy

2. **For Distributed Systems:**
   - Use API provider with central metrics backend
   - Aggregate metrics client-side before sending
   - Use tags/labels for dimensional analysis

3. **Memory Management:**
   - Adjust `metricsLimit` based on cardinality
   - Monitor `analytics.getMeasurementCount()`
   - Archive metrics periodically

---

## Summary

The MeasuringService provides a simple yet powerful way to track metrics throughout your application. Key takeaways:

- **Simple API**: `add()`, `list()`, `total()`, `average()`
- **Real-time Analytics**: Automatic tracking of metric activity
- **Flexible Storage**: In-memory default or remote API provider
- **Professional Dashboard**: Built-in UI for viewing and managing metrics
- **Event-Driven**: Full event emissions for integration
- **Production-Ready**: Configurable limits, retention, and aggregation

Use the service to monitor performance, track business metrics, ensure SLA compliance, and gain insights into your application's behavior.

---

**For more information, visit the FetchingService section or contact the Digital Technologies team.**
