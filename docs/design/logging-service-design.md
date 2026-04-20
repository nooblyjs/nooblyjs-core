# Logging Service (`src/logging/`)

**Dependency level:** 0 – Foundation (no dependencies)

The logging service is the first service created. All other services receive it as a dependency and use it for structured logging via optional chaining (`this.logger?.info(...)`).

---

## Factory (`src/logging/index.js`)

```javascript
const log = registry.logger('file', {
  logDir: './logs',
  level: 'info'
});
```

### `createLogger(type, options, eventEmitter)` → logger instance

| `type` value | Provider class | Description |
|---|---|---|
| `'memory'` (default) | `Logging` | Logs to console with timestamp and hostname |
| `'file'` | `loggingFile` | Writes structured logs to rotating log files |
| `'api'` | `loggingApi` | Forwards logs to a remote API endpoint |

**After creating the provider:**
1. Creates a `LogAnalytics` instance attached to the eventEmitter.
2. Calls `Routes(options, eventEmitter, logger, analytics)` to register REST endpoints.
3. Calls `Views(options, eventEmitter, logger)` to serve the dashboard UI.

---

## Memory Provider (`src/logging/providers/logging.js`)

Class: `Logging`

### Constructor

```javascript
new Logging(options, eventEmitter)
```

- Sets `this.settings.minLogLevel` from `options.log.level` if provided.
- Stores `eventEmitter` and `instanceName` (from `options.instanceName`, default `'default'`).

### Settings

| Setting | Type | Values |
|---|---|---|
| `minLogLevel` | list | `'error'`, `'warn'`, `'info'`, `'log'` |

Level priority order (highest to lowest): `error → warn → info → log`

### Methods

#### `async getSettings()` → `Object`

Returns the current settings object.

#### `async saveSettings(settings)` → `void`

Updates settings from the provided object, only for keys declared in `settings.list`.

#### `determineLogLevelPriority(level)` → `number`

Returns the priority index for `'error'`(0), `'warn'`(1), `'info'`(2), `'log'`(3).

#### `shouldLog(level)` → `boolean`

Returns `true` if the given level's priority is ≤ the configured `minLogLevel` priority. If `minLogLevel` is not set, always returns `true`.

#### `formatMessage_(message, meta)` → `string` (private)

Formats the message and optional metadata:
- If `meta` is an object, JSON-stringifies it with 2-space indent.
- If `meta` is a primitive, appends as a string.
- Returns `message` only if `meta` is undefined/null.

#### `async info(message, meta)` → `void`

Logs: `"TIMESTAMP - INFO - HOSTNAME - message"`

Emits: `log:info:<instanceName>` with `{ message: logMessage }`

#### `async warn(message, meta)` → `void`

Logs: `"TIMESTAMP - WARN - HOSTNAME - message"` via `console.warn`

Emits: `log:warn:<instanceName>`

#### `async error(message, meta)` → `void`

Logs: `"TIMESTAMP - ERROR - HOSTNAME - message"` via `console.error`

Emits: `log:error:<instanceName>`

#### `async debug(message, meta)` → `void`

Logs: `"TIMESTAMP - LOG - HOSTNAME - message"` via `console.log`

Emits: `log:log:<instanceName>`

#### `async log(message, meta)` → `void`

Alias for `debug()`. Calls `debug()` internally for consistency across all providers.

---

## File Provider (`src/logging/providers/loggingFile.js`)

Production-grade file logger with async I/O, rolling logs, and thread safety.

### Constructor

```javascript
new loggingFile(options, eventEmitter)
```

- `options.logDir` - Directory for log files (default: `.logs`)
- `options.maxSize` - Max file size in bytes before rotation (default: 10 MB, 0 = disabled)
- `options.maxFiles` - Max rotated files to keep (default: 5)
- `options.rotatePeriod` - Rotation period: `'daily'`, `'hourly'`, or `'none'` (default: `'daily'`)
- `options.log.level` - Minimum log level (same as memory provider)

### Settings

| Setting | Type | Default |
|---|---|---|
| `minLogLevel` | list | `'info'` |
| `logDir` | string | `.logs` |
| `maxSize` | number | 10485760 (10 MB) |
| `maxFiles` | number | 5 |
| `rotatePeriod` | list | `'daily'` |

### Key Features

- **Async I/O**: Uses `fs.promises` for non-blocking file operations
- **Thread-safe**: Promise-chain queue serializes all writes to prevent race conditions
- **Size-based rotation**: Automatically rotates when file reaches `maxSize`
- **Period-based rotation**: Rotates on period change (daily/hourly)
- **Log retention**: Automatically deletes old rotated files beyond `maxFiles`
- **Graceful error handling**: Rotation/write failures emit warnings but don't crash logging

### Methods

All methods from memory provider (`info`, `warn`, `error`, `debug`, `log`, `getSettings`, `saveSettings`).

### Log Format

All log levels use a consistent format:
```
TIMESTAMP - LEVEL - HOSTNAME - message [metadata]
```

Example: `2026-04-02T09:40:43.434Z - INFO - app-server-01 - Request completed {"duration":42}`

### Log Rotation

**Example file structure after rotation:**
```
.logs/
  app.2026-04-02.log      (current, ~5MB)
  app.2026-04-02.1.log    (1st rotation)
  app.2026-04-02.2.log    (2nd rotation)
  app.2026-04-02.3.log    (3rd rotation)
  app.2026-04-02.4.log    (4th rotation)
  app.2026-04-02.5.log    (5th rotation, oldest kept)
```

When `app.2026-04-02.log` hits `maxSize`:
1. Top rotation shifts up: `.4 → .5`, `.3 → .4`, etc.
2. Active log renamed: `app.2026-04-02.log → app.2026-04-02.1.log`
3. New active file created on next write
4. Old files beyond `maxFiles` are pruned

---

## API Provider (`src/logging/providers/loggingApi.js`)

HTTP client that forwards log messages to a remote logging service. Useful for centralized log aggregation (e.g., Datadog, ELK, Splunk).

### Constructor

```javascript
new LoggingApi(options, eventEmitter)
```

- `options.apiRoot` or `options.api` - Remote API base URL (e.g., `http://logging.example.com`)
- `options.apiKey` - Optional API key for authentication (sent as `X-API-Key` header)
- `options.timeout` - Request timeout in milliseconds (default: 5000)
- `options.log.level` - Minimum log level (same as memory provider)

### Settings

| Setting | Type | Default |
|---|---|---|
| `minLogLevel` | list | `'info'` |
| `url` | string | `'http://localhost:3000'` |
| `apikey` | string | `null` |

### Methods

All methods from memory provider (`info`, `warn`, `error`, `debug`, `log`, `getSettings`, `saveSettings`).

Internally uses `sendLog_(level, message, meta)` as the HTTP transport. The public `log(message, meta)` is an alias for `debug()`, consistent with all other providers.

### HTTP Requests

Sends POST requests to the remote API:

```
POST /services/logging/api/log
{
  "level": "info|warn|error|log",
  "message": "string",
  "meta": { ... }
}
```

### Error Handling

Failures are silent to prevent recursive logging errors. Errors emit `logging:error` events instead of throwing.

---

## Analytics (`src/logging/modules/analytics.js`)

Class: `LogAnalytics`

Listens to `log:*:<instanceName>` events and tracks:
- Total log count
- Count per level (`error`, `warn`, `info`, `log`)
- Recent log entries (ring buffer, max 1000)

### Methods

| Method | Returns | Description |
|---|---|---|
| `list(level)` | `Array` | Logs filtered by level (newest first). Omit level for all. |
| `getCount()` | `number` | Total log count |
| `getCountByLevel(level)` | `number` | Count for specific level |
| `getStats()` | `Object` | Counts and percentages per level |
| `getTimeline()` | `Object` | Per-minute counts for charting |
| `clear()` | `void` | Clears all stored logs |
| `destroy()` | `void` | Removes event listeners to prevent memory leaks |

Call `destroy()` when a logger instance is no longer needed to clean up event listeners.

---

## Routes (`src/logging/routes/index.js`)

Mounted at `/services/logging/api/`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/scripts` | Serves client-side JS library |
| `POST` | `/info` | Log info-level message |
| `POST` | `/warn` | Log warn-level message |
| `POST` | `/error` | Log error-level message |
| `POST` | `/:instanceName/info` | Log info to named instance |
| `POST` | `/:instanceName/warn` | Log warn to named instance |
| `POST` | `/:instanceName/error` | Log error to named instance |
| `GET` | `/status` | Service health check |
| `GET` | `/instances` | List all logger instances |
| `GET` | `/logs` | Recent log entries (filter: `?level=INFO`) |
| `GET` | `/:instanceName/logs` | Logs for named instance |
| `GET` | `/stats` | Log level statistics |
| `GET` | `/:instanceName/stats` | Stats for named instance |
| `GET` | `/timeline` | Per-minute timeline data |
| `GET` | `/:instanceName/timeline` | Timeline for named instance |
| `GET` | `/settings` | Current settings |
| `POST` | `/settings` | Update settings |
| `GET` | `/swagger/docs.json` | OpenAPI specification |

All POST log endpoints accept `{ "message": "...", "meta": { ... } }` and return `{ "success": true }`.

All error responses return JSON `{ "error": "message" }`.

---

## Usage Pattern

```javascript
// All services receive logging via dependency injection
const logger = dependencies.logging;

// Standard pattern throughout the codebase
logger?.info(`[ServiceName] Operation completed`, {
  key: 'value',
  error: error?.message
});

logger?.warn(`[ServiceName] Fallback triggered`, { provider: 'redis' });
logger?.error(`[ServiceName] Failed`, { error: err.message });
logger?.log(`[ServiceName] Debug info`, { data });  // log() or debug() both work
```

The `?.` optional chaining ensures code continues silently when logger is unavailable (e.g. inside worker threads where dependencies aren't injected).
