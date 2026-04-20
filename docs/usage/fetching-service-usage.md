# FetchingService Comprehensive Usage Guide

**Service Name**: Fetching Service
**Version**: 1.0.0
**Status**: Production Ready
**Last Updated**: November 23, 2025

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Service Overview](#service-overview)
3. [Creating and Configuring FetchingService](#creating-and-configuring-fetchingservice)
4. [Service API - Node.js](#service-api---nodejs)
5. [Provider Reference](#provider-reference)
6. [REST API Endpoints](#rest-api-endpoints)
7. [Analytics Module](#analytics-module)
8. [Web UI Dashboard](#web-ui-dashboard)
9. [Event System](#event-system)
10. [Settings Management](#settings-management)
11. [Advanced Usage Patterns](#advanced-usage-patterns)
12. [Examples and Recipes](#examples-and-recipes)
13. [Troubleshooting and Best Practices](#troubleshooting-and-best-practices)

---

## Quick Start

### Installation

FetchingService is built into the Noobly JS Core framework:

```bash
npm install nooblyjs-core
```

### Basic Usage

```javascript
const EventEmitter = require('events');
const serviceRegistry = require('./index.js');

// Create fetching service (default: Node.js provider)
const fetching = serviceRegistry.fetching('node', {
  cacheTime: 120,           // Cache for 2 minutes
  timeout: 30000,           // 30 second timeout
  dependencies: { logging: logger }
});

// Simple GET request
const response = await fetching.fetch('https://api.example.com/data');
console.log('Status:', response.status);
console.log('Data:', response.data);

// POST request
const result = await fetching.fetch('https://api.example.com/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: { name: 'John', email: 'john@example.com' }
});

// With cache control
const cached = await fetching.fetch('https://api.example.com/static', {
  cache: 'force-cache'   // Cache indefinitely
});

// Get analytics
const stats = fetching.analytics.getStats();
console.log('Total requests:', stats.totalRequests);
console.log('Cache hit rate:', stats.cacheHitRate + '%');
```

---

## Service Overview

The **FetchingService** is an HTTP client layer providing:

- **Multi-Provider Architecture**: Node.js native fetch or Axios
- **Smart Caching**: Request deduplication and response caching
- **Comprehensive Analytics**: Track all HTTP operations
- **Event-Driven**: Emit events on success, cache hits, errors
- **Web Dashboard**: Monitor requests in real-time
- **Flexible Configuration**: Per-request or service-level caching rules
- **NextJS Compatible**: NextJS-style cache configuration support

### Key Features

| Feature | Description |
|---------|-------------|
| **Caching** | Automatic response caching with LRU eviction (1000 entries) |
| **Deduplication** | Concurrent identical requests share response |
| **Cache Control** | `default`, `force-cache`, `no-cache`, `no-store` modes |
| **Analytics** | Real-time metrics for all URLs and operations |
| **Multi-Provider** | Node.js native fetch or Axios backend |
| **Timeout Management** | Configurable per-service or via AbortSignal |
| **Event Emission** | Success, cache-hit, dedup-hit, error events |
| **REST API** | Complete HTTP API for remote operations |
| **Web UI** | Dashboard for monitoring and testing |
| **Settings** | Runtime configuration changes |

---

## Creating and Configuring FetchingService

### Factory Function Signature

```javascript
createFetching(type, options, eventEmitter)
```

**Parameters**:
- `type` _(string)_ - Provider type: `'node'`, `'axios'`, or `'default'`
- `options` _(Object)_ - Configuration options
  - `cacheTime` _(number)_ - Default cache duration in seconds (default: 60)
  - `timeout` _(number)_ - Request timeout in milliseconds (default: 30000)
  - `axiosConfig` _(Object, optional)_ - Additional axios configuration (axios provider only)
  - `dependencies` _(Object, optional)_
    - `logging` - Logging service instance
- `eventEmitter` _(EventEmitter, optional)_ - Event emitter for lifecycle events

**Returns**: FetchingService instance with all methods

### Node.js Provider (Default)

Recommended for modern Node.js (18+) environments:

```javascript
const fetching = serviceRegistry.fetching('node', {
  cacheTime: 120,        // Cache for 2 minutes
  timeout: 45000,        // 45 second timeout
  dependencies: { logging: logger }
});
```

**Characteristics**:
- Uses Node.js native `fetch` API (18+)
- AbortSignal timeout support
- Lower memory footprint
- Minimal dependencies
- Automatic response cloning for multiple reads

### Axios Provider

Recommended for advanced HTTP configuration needs:

```javascript
const fetching = serviceRegistry.fetching('axios', {
  cacheTime: 60,
  timeout: 30000,
  axiosConfig: {
    maxRedirects: 5,
    withCredentials: true,
    responseType: 'json'
  },
  dependencies: { logging: logger }
});
```

**Characteristics**:
- Uses axios library for HTTP requests
- Advanced request/response interceptors
- Extensive ecosystem support
- Custom configuration via axiosConfig
- Pre-parsed response data

### Default Provider

Uses Node.js provider if not specified:

```javascript
const fetching = serviceRegistry.fetching('default', {
  cacheTime: 60,
  timeout: 30000
});
// Equivalent to: serviceRegistry.fetching('node', { ... })
```

---

## Service API - Node.js

### Core Methods

#### `fetch(url, options)` - Fetch URL with Caching

Fetches a URL with optional caching, deduplication, and analytics:

```javascript
const response = await fetching.fetch(url, options)
```

**Parameters**:
- `url` _(string, required)_ - Full URL to fetch
- `options` _(Object, optional)_ - Fetch configuration

**Options**:
| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `method` | string | `'GET'` | HTTP method (GET, POST, PUT, DELETE, etc.) |
| `headers` | Object | `{}` | Request headers |
| `body` | Object\|string | - | Request body (auto-serialized if object) |
| `cache` | string | `'default'` | `'default'`, `'force-cache'`, `'no-cache'`, `'no-store'` |
| `next` | Object | - | NextJS-style cache config |
| `next.revalidate` | number | - | Cache duration in seconds |
| `next.tags` | Array | - | Cache tags for grouped invalidation |

**Return Value**:

```javascript
{
  ok: boolean,           // true if status 200-299
  status: number,        // HTTP status code
  statusText: string,    // Status text
  headers: Object,       // Response headers
  data: any,             // Response body (parsed)
  url: string,           // Final URL after redirects
  _metadata: {
    cacheKey: string,    // Cache key used
    timestamp: number    // Request timestamp
  },
  clone: () => Response  // Clone method
}
```

**Examples**:

```javascript
// Simple GET
const response = await fetching.fetch('https://api.example.com/users');
console.log(response.status);        // 200
console.log(response.data);          // Array of users

// POST with JSON body
const created = await fetching.fetch('https://api.example.com/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: { name: 'Alice', email: 'alice@example.com' }
});
console.log(created.data.id);        // New user ID

// Force cache (store indefinitely)
const static = await fetching.fetch('https://cdn.example.com/config.json', {
  cache: 'force-cache'
});

// With revalidation time
const posts = await fetching.fetch('https://api.example.com/posts', {
  next: {
    revalidate: 300,     // Revalidate every 5 minutes
    tags: ['posts']      // Tag for selective invalidation
  }
});

// No cache (always fetch fresh)
const live = await fetching.fetch('https://api.example.com/live', {
  cache: 'no-store'
});
```

**Events Emitted**:
- `fetch:success` - Successful fetch completion
- `fetch:cache-hit` - Response served from cache
- `fetch:dedup-hit` - Response from deduplication cache
- `fetch:error` - Fetch error occurred

---

#### `getSettings()` - Retrieve Configuration

Gets current fetching service settings:

```javascript
const settings = await fetching.getSettings();
```

**Return Value**:

```javascript
{
  description: string,     // Provider description
  list: Array<Object>,     // Available settings schema
  cacheTime: number,       // Current cache time (seconds)
  timeout: number          // Current timeout (milliseconds)
}
```

**Example**:

```javascript
const settings = await fetching.getSettings();
console.log('Cache time:', settings.cacheTime);
console.log('Timeout:', settings.timeout);
```

---

#### `saveSettings(settings)` - Update Configuration

Updates fetching service settings:

```javascript
await fetching.saveSettings({ cacheTime: 300, timeout: 60000 })
```

**Parameters**:
- `cacheTime` _(number, optional)_ - New cache duration in seconds
- `timeout` _(number, optional)_ - New request timeout in milliseconds

**Example**:

```javascript
// Change cache time to 5 minutes and timeout to 1 minute
await fetching.saveSettings({
  cacheTime: 300,
  timeout: 60000
});
```

---

#### `clear()` - Clear All Caches

Clears request cache, deduplication cache, and analytics:

```javascript
await fetching.clear();
```

**Use Cases**:
- Diagnostics and testing
- Force fresh data
- Reset analytics
- Memory management

---

### Analytics Methods

#### `getAnalytics()` - Get Raw Analytics

Returns raw analytics data for all cached requests:

```javascript
const analytics = fetching.analytics.getAnalytics();
```

**Return Value** - Array of cached request analytics:

```javascript
[
  {
    url: string,          // Cache key
    requests: number,     // Total requests
    cacheHits: number,    // Cache hits
    dedupHits: number,    // Dedup hits
    errors: number,       // Error count
    lastRequest: string,  // ISO timestamp
    lastStatus: number    // Last HTTP status
  }
]
```

#### `getStats()` - Get Comprehensive Statistics

Gets complete analytics with percentages and aggregates:

```javascript
const stats = await fetching.analytics.getStats();
```

**Return Value**:

```javascript
{
  totalUrls: number,      // Unique URLs tracked
  totalSuccess: number,   // Successful requests
  totalCacheHits: number, // Cache hits
  totalDedupHits: number, // Dedup hits
  totalErrors: number,    // Total errors
  totalRequests: number,  // Total requests
  cacheHitRate: string,   // Percentage (XX.XX format)
  successRate: string,    // Percentage (XX.XX format)
  urls: {                 // Per-URL breakdown
    [url]: {
      successCount: number,
      cacheHitCount: number,
      dedupHitCount: number,
      errorCount: number,
      totalRequests: number,
      firstRequest: string,
      lastRequest: string,
      lastStatus: number,
      averageResponseTime: number
    }
  }
}
```

**Example**:

```javascript
const stats = await fetching.analytics.getStats();
console.log(`Total URLs: ${stats.totalUrls}`);
console.log(`Total requests: ${stats.totalRequests}`);
console.log(`Cache hit rate: ${stats.cacheHitRate}%`);
console.log(`Success rate: ${stats.successRate}%`);
```

---

#### `getUrlStats(url)` - Get Single URL Statistics

Gets statistics for a specific URL:

```javascript
const urlStats = await fetching.analytics.getUrlStats('https://api.example.com/data');
```

**Parameters**:
- `url` _(string)_ - The URL to retrieve stats for

**Return Value**: Stats object for the URL or null if not found

---

#### `getTopUrls(limit, sortBy)` - Get Top URLs

Gets top URLs sorted by specified metric:

```javascript
const topByRequests = await fetching.analytics.getTopUrls(10, 'requests');
const topByErrors = await fetching.analytics.getTopUrls(10, 'errors');
```

**Parameters**:
- `limit` _(number)_ - Number of URLs to return (default: 10)
- `sortBy` _(string)_ - Sort metric: `'requests'`, `'errors'`, `'success'`, `'cache'` (default: 'requests')

**Return Value**: Array of top URLs with statistics

---

#### `getTopErrors(limit)` - Get Most Error-Prone URLs

Gets URLs with highest error counts:

```javascript
const errorUrls = await fetching.analytics.getTopErrors(50);
```

**Return Value**: Array of URLs with error statistics

---

#### `getTimeline(topN)` - Get Activity Timeline

Gets time-based activity aggregated by minute:

```javascript
const timeline = await fetching.analytics.getTimeline(10);
```

**Return Value**:

```javascript
{
  labels: ["10:00", "10:01", "10:02", ...],
  datasets: [
    {
      name: "https://url1.com",
      data: [5, 8, 3, ...]  // Requests per minute
    }
  ]
}
```

---

#### `getUrlDistribution(limit)` - Get URL Pie Chart Data

Gets URL distribution for pie/doughnut charts:

```javascript
const distribution = await fetching.analytics.getUrlDistribution(50);
```

**Return Value**:

```javascript
{
  labels: ["url1", "url2", "url3", ...],
  data: [25, 20, 15, ...]
}
```

---

## Provider Reference

### Node.js Native Provider

**Type**: `'node'`

**Implementation**: Uses Node.js built-in `fetch` API with AbortSignal timeout

**Characteristics**:
- ✅ No external dependencies
- ✅ Native timeout support via AbortSignal
- ✅ Automatic response cloning
- ✅ LRU cache (1000 entries)
- ✅ Request deduplication
- ✅ Requires Node.js 18+

**Configuration**:

```javascript
const fetching = serviceRegistry.fetching('node', {
  cacheTime: 60,
  timeout: 30000
});
```

**Best For**:
- Modern Node.js applications (18+)
- Minimal dependency environments
- Native API preference
- Server-side rendering

---

### Axios Provider

**Type**: `'axios'`

**Implementation**: Uses axios library with response normalization

**Characteristics**:
- ✅ Advanced HTTP configuration
- ✅ Request/response interceptors
- ✅ Timeout via axios config
- ✅ Custom validation rules
- ✅ Credential handling
- ✅ Widespread ecosystem

**Configuration**:

```javascript
const fetching = serviceRegistry.fetching('axios', {
  cacheTime: 60,
  timeout: 30000,
  axiosConfig: {
    maxRedirects: 5,
    withCredentials: true,
    responseType: 'json'
  }
});
```

**Best For**:
- Complex HTTP scenarios
- Interceptor requirements
- Advanced error handling
- Legacy compatibility

---

### Provider Comparison

| Feature | Node.js | Axios |
|---------|---------|-------|
| **Dependencies** | Native | axios required |
| **Timeout** | AbortSignal | axios config |
| **Interceptors** | Limited | Full support |
| **Configuration** | Minimal | Extensive |
| **Response Format** | Fetch API | Normalized |
| **Stream Support** | ✅ | Via responseType |
| **Setup Complexity** | Low | Medium |

---

## REST API Endpoints

### `POST /services/fetching/api/fetch`

Fetch a URL via HTTP with optional caching.

**Request Body**:

```json
{
  "url": "https://api.example.com/data",
  "options": {
    "method": "GET",
    "headers": { "Authorization": "Bearer token" },
    "cache": "default"
  }
}
```

**Success Response (200)**:

```json
{
  "success": true,
  "status": 200,
  "statusText": "OK",
  "headers": { "content-type": "application/json" },
  "data": { /* response body */ }
}
```

---

### `GET /services/fetching/api/fetch/:url`

Simple GET request with base64-encoded URL.

**Request**:

```
GET /services/fetching/api/fetch/aHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20vZGF0YQ==
```

**Response (200)**:

```json
{
  "success": true,
  "status": 200,
  "data": { /* response body */ }
}
```

---

### `GET /services/fetching/api/status`

Check fetching service status.

**Response (200)**:

```json
{
  "success": true,
  "status": "fetching api running"
}
```

---

### `GET /services/fetching/api/analytics`

Get comprehensive analytics data with charts.

**Response (200)**:

```json
{
  "success": true,
  "stats": {
    "totalUrls": 5,
    "totalSuccess": 50,
    "totalCacheHits": 20,
    "totalDedupHits": 5,
    "totalErrors": 2,
    "totalRequests": 77,
    "cacheHitRate": "32.47",
    "successRate": "64.94",
    "urls": { /* detailed stats */ }
  }
}
```

---

### `GET /services/fetching/api/list`

Get analytics list for all tracked URLs.

**Response (200)**:

```json
{
  "success": true,
  "data": [
    {
      "url": "https://api.example.com/data",
      "requests": 38,
      "cacheHits": 10,
      "dedupHits": 2,
      "errors": 1
    }
  ]
}
```

---

### `GET /services/fetching/api/settings`

Get current service settings.

**Response (200)**:

```json
{
  "success": true,
  "data": {
    "description": "Node.js native fetch provider",
    "cacheTime": 60,
    "timeout": 30000
  }
}
```

---

### `POST /services/fetching/api/settings`

Update service settings.

**Request Body**:

```json
{
  "cacheTime": 120,
  "timeout": 60000
}
```

**Response (200)**:

```json
{
  "success": true,
  "message": "Settings saved successfully"
}
```

---

### `DELETE /services/fetching/api/cache`

Clear all caches.

**Response (200)**:

```json
{
  "success": true,
  "message": "Cache cleared successfully"
}
```

---

## Analytics Module

The Analytics module tracks all HTTP operations with comprehensive metrics.

### Tracked Data

**Per-URL Metrics**:
- Total requests
- Successful requests
- Cache hits
- Deduplication hits
- Error count
- Average response time
- First/last request timestamps
- Last HTTP status code

**Aggregate Metrics**:
- Total URLs tracked
- Total requests across all URLs
- Cache hit rate (percentage)
- Success rate (percentage)
- Error distribution

### Methods

#### `getStats()`

Get complete statistics with all URLs:

```javascript
const stats = await fetching.analytics.getStats();
console.log(stats.totalRequests);   // Total requests
console.log(stats.cacheHitRate);    // Percentage string
console.log(stats.urls);            // Per-URL breakdown
```

#### `getUrlStats(url)`

Get statistics for specific URL:

```javascript
const urlStats = await fetching.analytics.getUrlStats('https://api.example.com/data');
if (urlStats) {
  console.log(urlStats.totalRequests);
  console.log(urlStats.cacheHitCount);
}
```

#### `getTopUrls(limit, sortBy)`

Get most active URLs:

```javascript
// Most requested
const top = await fetching.analytics.getTopUrls(10, 'requests');

// Most errors
const errorProne = await fetching.analytics.getTopUrls(10, 'errors');

// Most cached
const cacheable = await fetching.analytics.getTopUrls(10, 'cache');
```

#### `getTopErrors(limit)`

Get URLs with most errors:

```javascript
const problematic = await fetching.analytics.getTopErrors(50);
problematic.forEach(url => {
  console.log(`${url.url}: ${url.errorCount} errors`);
});
```

#### `getTimeline(topN)`

Get minute-level activity timeline:

```javascript
const timeline = await fetching.analytics.getTimeline(10);
// { labels: ["10:00", "10:01", ...], datasets: [...] }
```

#### `getUrlDistribution(limit)`

Get pie chart data:

```javascript
const distribution = await fetching.analytics.getUrlDistribution(50);
// { labels: [...], data: [...] }
```

---

## Web UI Dashboard

Access at `/services/fetching/` when service is running.

### Dashboard Tab

**Stats Cards**:
- Total URLs - Unique URLs tracked
- Total Requests - All requests count
- Cache Hit Rate - Percentage of cache/dedup hits
- Total Errors - Error count
- Success Rate - Successful requests percentage

**Charts**:
1. **URL Distribution (Doughnut Chart)** - Top 50 URLs by request count
2. **Activity Timeline (Line Chart)** - Requests per minute for top 10 URLs
3. **URL Statistics Table** - Sortable table with top 100 URLs
4. **Top Error URLs Table** - URLs with most errors

**Controls**:
- Manual refresh button
- Auto-refresh (every 30 seconds)
- Table sorting (click column headers)

---

### Test Fetching Tab

**Test Form**:
- URL input
- Method selector (GET, POST, PUT, DELETE)
- Cache control selector
- Preset test URLs (JSONPlaceholder API)

**Features**:
- Real-time request testing
- Response display with formatted JSON
- Service status check
- Auto-refresh analytics

---

### Settings Tab

**Dynamic Form**:
- cacheTime (number input)
- timeout (number input)
- Save button
- Settings persistence

---

## Event System

### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `fetch:success` | `{ url, cacheKey, status }` | Successful fetch |
| `fetch:cache-hit` | `{ url, cacheKey }` | Cache hit |
| `fetch:dedup-hit` | `{ url, cacheKey }` | Dedup cache hit |
| `fetch:error` | `{ url, cacheKey, error }` | Fetch error |
| `api-fetching-error` | - | Route error |
| `api-fetching-status` | - | Status check |
| `api-fetching-list` | - | Analytics list |

### Event Listening

```javascript
const eventEmitter = new EventEmitter();

eventEmitter.on('fetch:success', (data) => {
  console.log(`Fetched: ${data.url} (${data.status})`);
});

eventEmitter.on('fetch:cache-hit', (data) => {
  console.log(`Cache hit: ${data.url}`);
});

eventEmitter.on('fetch:error', (data) => {
  console.log(`Error: ${data.url} - ${data.error}`);
});

const fetching = serviceRegistry.fetching('node', {}, eventEmitter);
```

---

## Settings Management

### Runtime Configuration

Update settings at runtime:

```javascript
const settings = await fetching.getSettings();
console.log('Current cache time:', settings.cacheTime);

await fetching.saveSettings({
  cacheTime: 300,      // 5 minutes
  timeout: 60000       // 1 minute
});
```

### Cache Control

Control caching per-request:

```javascript
// Default (use service default)
await fetching.fetch(url, { cache: 'default' });

// Cache indefinitely
await fetching.fetch(url, { cache: 'force-cache' });

// Always revalidate
await fetching.fetch(url, { cache: 'no-cache' });

// Never cache
await fetching.fetch(url, { cache: 'no-store' });

// NextJS-style revalidation
await fetching.fetch(url, {
  next: {
    revalidate: 300,   // 5 minutes
    tags: ['api']      // For selective invalidation
  }
});
```

---

## Advanced Usage Patterns

### Request Deduplication

Identical concurrent requests automatically share response:

```javascript
// All three await same fetch operation
const p1 = fetching.fetch('https://api.example.com/data');
const p2 = fetching.fetch('https://api.example.com/data');
const p3 = fetching.fetch('https://api.example.com/data');

const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
// All serve from same network request, generating dedup-hit events
```

### Cache Invalidation by Tag

NextJS-style tag-based invalidation:

```javascript
// Cache with tags
await fetching.fetch('https://api.example.com/posts/1', {
  next: { tags: ['posts', 'post-1'] }
});

await fetching.fetch('https://api.example.com/posts/2', {
  next: { tags: ['posts', 'post-2'] }
});

// Clear all posts at once (via application logic)
// Clear cache when updating data
await fetching.clear();  // For now, full clear is available
```

### Error Handling

```javascript
try {
  const response = await fetching.fetch('https://api.example.com/data');
  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${response.statusText}`);
  } else {
    console.log(response.data);
  }
} catch (error) {
  console.error('Fetch failed:', error.message);
}
```

### Multiple Providers

```javascript
// Node.js provider (fast)
const node = serviceRegistry.fetching('node', { cacheTime: 60 });

// Axios provider (advanced config)
const axios = serviceRegistry.fetching('axios', {
  cacheTime: 60,
  axiosConfig: { maxRedirects: 10 }
});

// Use based on needs
const staticData = await node.fetch(url);  // Simple requests
const apiData = await axios.fetch(url);    // Complex requests
```

---

## Examples and Recipes

### API Integration Example

```javascript
const fetching = serviceRegistry.fetching('node', {
  cacheTime: 300,      // 5 minute cache
  timeout: 30000
});

// Fetch user data with caching
async function getUser(userId) {
  const response = await fetching.fetch(
    `https://jsonplaceholder.typicode.com/users/${userId}`,
    { next: { tags: ['users'], revalidate: 600 } }
  );
  return response.data;
}

// List users
const users = await fetching.fetch(
  'https://jsonplaceholder.typicode.com/users',
  { next: { revalidate: 3600 } }
);

// Get user stats
const stats = await fetching.analytics.getStats();
console.log(`Cache hit rate: ${stats.cacheHitRate}%`);
```

### Performance Monitoring

```javascript
// Monitor fetch operations
async function trackedFetch(url, options) {
  const start = Date.now();
  const response = await fetching.fetch(url, options);
  const duration = Date.now() - start;

  console.log(`Fetched ${url} in ${duration}ms`);
  return response;
}

// Get slow URLs
const stats = await fetching.analytics.getStats();
const slowUrls = Object.entries(stats.urls)
  .filter(([_, stats]) => stats.averageResponseTime > 500)
  .map(([url, stats]) => ({
    url,
    avgTime: stats.averageResponseTime
  }));
```

---

## Troubleshooting and Best Practices

### Best Practices

1. **Set Appropriate Cache Times**: Balance between freshness and performance
2. **Use Cache Control**: Leverage `'no-store'` for live data, `'force-cache'` for static
3. **Monitor Analytics**: Regularly check cache hit rate and error rates
4. **Handle Errors**: Always wrap fetch in try-catch
5. **Clear Caches Strategically**: Use full clear after major data updates
6. **Configure Timeouts**: Adjust for slow networks or services

### Common Issues

**Issue**: Low cache hit rate
- **Solution**: Increase `cacheTime` or use `'force-cache'` for static data

**Issue**: Request timeouts
- **Solution**: Increase `timeout` value or implement retry logic

**Issue**: Memory growth
- **Solution**: Monitor analytics, clear old caches, reduce cache time

**Issue**: Stale data
- **Solution**: Use `'no-cache'` or `'no-store'` for critical endpoints

---

## Summary

The **FetchingService** provides:

✅ High-performance HTTP client with smart caching
✅ Multi-provider architecture (Node.js/Axios)
✅ Comprehensive request analytics
✅ Request deduplication for efficiency
✅ Event-driven architecture
✅ Web UI dashboard for monitoring
✅ REST API for remote operations
✅ Flexible cache control

For more information, see the [Noobly JS Core documentation](README.md).
