# Measuring Service (`src/measuring/`)

**Dependency level:** 2 – Business Logic
**Dependencies:** `logging`, `queueing`, `caching`
**Last Updated:** 2026-04-04

Provides application performance and business metrics collection. Records named measurements with timestamps and supports aggregated querying over time ranges.

---

## Factory (`src/measuring/index.js`)

```javascript
const measuring = registry.measuring('memory');
```

### `createMeasuringService(type, options, eventEmitter)` → measuring instance

| `type` value | Provider class | Backend |
|---|---|---|
| `'memory'` / `'default'` (default) | `MeasuringService` | In-process Map storage |
| `'api'` | `MeasuringApi` | Remote metrics API |

**After creating the provider:**
1. Creates `MeasuringAnalytics` instance listening for metric events.
2. Injects `logger` from `options.dependencies.logging` with `measuring.log()` helper.
3. Injects `measuring.dependencies` for provider use.
4. Registers REST routes and dashboard view.
5. Exposes `getSettings` / `saveSettings`.

---

## MeasuringService Provider (`src/measuring/provider/measuring.js`)

### Constructor

```javascript
new MeasuringService(options, eventEmitter)
```

- `this.metrics` – `Map<string, Array<{value: number, timestamp: Date}>>` storing all measurements.
- `this.logger` – extracted from `options.dependencies.logging`; uses optional chaining for silent failure.
- `this.settings.dataRetention` – days to retain data (default: 30).
- `this.settings.aggregationInterval` – aggregation window in seconds (default: 60).
- `this.settings.metricsLimit` – max metrics to track (default: 1000).

### Methods

#### `add(metricName, value)` → `void`

Records a measurement with the current timestamp. Creates the metric if it doesn't exist.

**Events emitted:** `measuring:add` with `{ metricName, measure: { value, timestamp } }`

#### `list(metricName, startDate, endDate)` → `Array<{value, timestamp}>`

Returns all measurements for a metric within a date range (inclusive on both ends). Uses `_filterMeasuresByPeriod()` internally.

**Events emitted:** `measuring:list` with `{ metricName, startDate, endDate, measures }`

#### `total(metricName, startDate, endDate)` → `number`

Returns the sum of all measurement values within a date range. Returns 0 if no measurements found.

**Events emitted:** `measuring:total` with `{ metricName, startDate, endDate, total }`

#### `average(metricName, startDate, endDate)` → `number`

Returns the arithmetic mean of all measurement values within a date range. Returns 0 if no measurements found. Computes the sum locally (does **not** call `total()`) so only one event is emitted.

**Events emitted:** `measuring:average` with `{ metricName, startDate, endDate, average }`

#### `async getSettings()` → `Object`

Returns the settings object including `description`, `list` (metadata), `dataRetention`, `aggregationInterval`, `metricsLimit`.

#### `async saveSettings(settings)` → `void`

Updates settings. Only keys present in `settings.list` are updated. Logs each change via `this.logger?.info()`.

---

## MeasuringApi Provider (`src/measuring/providers/measuringApi.js`)

Forwards metric operations to a remote metrics collection API via HTTP (axios). Errors are emitted as `measuring:error` events and never thrown (silent telemetry).

### Constructor

```javascript
new MeasuringApi(options, eventEmitter)
```

- `this.apiRoot` – from `options.apiRoot` or `options.api`, default `'http://localhost:3000'`.
- `this.logger` – extracted from `options.dependencies.logging`.
- `this.client` – axios instance configured with `baseURL`, `timeout`, and optional `X-API-Key` header.

### Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `url` | string | `'http://localhost:3000'` | Remote API base URL |
| `timeout` | number | `5000` | Request timeout in ms |
| `retryLimit` | number | `3` | Maximum retry attempts |

When `saveSettings()` updates `url` or `timeout`, the axios client is automatically rebuilt.

### Methods

| Method | Parameters | Event | Description |
|---|---|---|---|
| `increment(name, value, tags)` | string, number (default 1), object | `measuring:increment` | Increment a counter |
| `gauge(name, value, tags)` | string, number, object | `measuring:gauge` | Record instantaneous value |
| `timing(name, duration, tags)` | string, number, object | `measuring:timing` | Record a duration |
| `histogram(name, value, tags)` | string, number, object | `measuring:histogram` | Record histogram value |
| `getMetrics()` | — | — | Retrieve all metrics (throws on error) |
| `getSettings()` | — | — | Returns settings |
| `saveSettings(settings)` | object | — | Updates settings; rebuilds client if URL/timeout changed |

---

## Analytics (`src/measuring/modules/analytics.js`)

### `MeasuringAnalytics(eventEmitter)`

Tracks per-metric statistics by listening to measuring events.

**Events listened to:** `measuring:add`, `measuring:increment`, `measuring:gauge`, `measuring:timing`, `measuring:histogram`

**Per-metric stats tracked:**

| Field | Type | Description |
|---|---|---|
| `name` | string | Metric name |
| `count` | number | Total measurements recorded |
| `lastCaptured` | number | Timestamp of last measurement |
| `lastValue` | number | Most recent value |
| `totalValue` | number | Sum of all values |

Rolling history is maintained (max 1000 entries).

### Methods

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `getUniqueMetricCount()` | — | number | Count of distinct metrics |
| `getMeasurementCount()` | — | number | Total measurements across all metrics |
| `getTopMetricsByCount(limit)` | number (default: 10) | Array | Metrics sorted by count (descending) |
| `getTopMetricsByRecency(limit)` | number (default: 100) | Array | Metrics sorted by last captured time |
| `getRecentHistory(limit)` | number (default: 50) | Array | Most recent measurement events |
| `destroy()` | — | void | Removes all event listeners and clears stats/history |

**Important:** Call `destroy()` when a measuring instance is no longer needed to prevent event listener memory leaks.

---

## Routes

Mounted at `/services/measuring/api/`. All successful mutation responses return JSON `{ success: true }`. All error responses return JSON `{ error: "message" }`.

| Method | Path | Description | Request Body / Params | Response |
|---|---|---|---|---|
| `POST` | `/add` | Add a measurement | `{ metric, value }` | `{ success: true }` |
| `GET` | `/list/:metric/:datestart/:dateend` | List measurements in date range | URL params (ISO dates) | `[{ value, timestamp }, ...]` |
| `GET` | `/total/:metric/:datestart/:dateend` | Sum of measurements | URL params (ISO dates) | `number` |
| `GET` | `/average/:metric/:datestart/:dateend` | Average of measurements | URL params (ISO dates) | `number` |
| `GET` | `/status` | Service health check | — | `"measuring api running"` |
| `GET` | `/analytics/summary` | Dashboard analytics | `?topLimit=&recentLimit=&historyLimit=` | `{ totals, topByActivity, topByRecency, recentHistory }` |
| `GET` | `/settings` | Get settings | — | Settings object |
| `POST` | `/settings` | Update settings | Settings object | `{ success: true }` |
| `GET` | `/metrics` | All metrics and values (for UI) | — | `{ success: true, metrics: [...], values: [...] }` |

**Error responses:**
- `400` – Missing or invalid parameters (e.g., `{ error: "Missing metric" }`)
- `500` – Server error (e.g., `{ error: "error message" }`)
- `503` – Analytics module unavailable

---

## Usage

```javascript
// Record metrics
measuring.add('api_response_time', 142);
measuring.add('orders_processed', 1);
measuring.add('revenue', 99.99);

// Query metrics over a time range
const now = new Date();
const hourAgo = new Date(now - 60*60*1000);

const measurements = measuring.list('api_response_time', hourAgo, now);
const total = measuring.total('api_response_time', hourAgo, now);
const avg = measuring.average('api_response_time', hourAgo, now);
console.log(`P1H: ${measurements.length} requests, total ${total}ms, avg ${avg}ms`);
```

---

## Integration with Workflow

The workflow service receives `measuring` as a dependency and can record workflow step durations and completion counts. This is wired automatically by the ServiceRegistry dependency injection.
