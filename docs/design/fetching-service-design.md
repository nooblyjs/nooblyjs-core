# Fetching Service (`src/fetching/`)

**Dependency level:** 1 – Infrastructure
**Dependencies:** `logging`

Provides HTTP request capabilities for making outbound API calls. Abstracts the difference between Node.js native `fetch` and the Axios library. The recommended service for all outbound HTTP in the framework (the `requesting` service is deprecated in favour of this).

---

## Factory (`src/fetching/index.js`)

```javascript
const fetching = registry.fetching('node');
const axiosFetching = registry.fetching('axios');
```

### `createFetching(type, options, eventEmitter)` → fetching instance

| `type` value | Provider class | HTTP client |
|---|---|---|
| `'node'` (default) | `FetchingNode` | Node.js native `fetch` |
| `'axios'` | `FetchingAxios` | Axios library |

**After creating the provider:**
1. Injects `logger` with `fetching.log()` helper.
2. Injects `fetching.dependencies`.
3. Creates `FetchingAnalytics` at `fetching.analytics`.
4. Registers REST routes and dashboard view.

---

## FetchingNode Provider (`src/fetching/providers/fetchingnode.js`)

Uses the built-in `fetch()` API available in Node.js ≥ 18 (or via the `node-fetch` package for older versions).

### Methods

#### `async fetch(url, options)` → Response

Makes an HTTP request.

**Options:**
| Field | Type | Default | Description |
|---|---|---|---|
| `method` | string | `'GET'` | HTTP method |
| `headers` | Object | `{}` | Request headers |
| `body` | string/Buffer | — | Request body (for POST/PUT) |
| `timeout` | number | `30000` | Request timeout (ms) |

Returns the raw fetch `Response` object. Call `.json()`, `.text()`, or `.arrayBuffer()` on it.

```javascript
const response = await fetching.fetch('https://api.example.com/data', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' }
});
const data = await response.json();
```

#### `async get(url, headers)` → Response

Convenience method for GET requests.

#### `async post(url, body, headers)` → Response

Convenience method for POST requests with a body.

#### `async put(url, body, headers)` → Response

Convenience method for PUT requests.

#### `async delete(url, headers)` → Response

Convenience method for DELETE requests.

#### `async getSettings()` / `async saveSettings(settings)`

Standard settings management.

---

## FetchingAxios Provider (`src/fetching/providers/fetchingaxios.js`)

Uses the `axios` npm package. Offers interceptors, automatic JSON parsing, and better error messages.

### Methods

Same interface as `FetchingNode` but returns Axios response objects with:
- `response.data` – parsed response body
- `response.status` – HTTP status code
- `response.headers` – response headers

---

## Analytics (`src/fetching/modules/analytics.js`)

Tracks:
- Total requests made
- Success / error counts
- Average response time per domain
- HTTP status code distribution

---

## Routes

Mounted at `/services/fetching/api/`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/services/fetching/api/status` | Service status |
| `POST` | `/services/fetching/api/fetch` | Make a fetch request |
| `GET` | `/services/fetching/api/analytics` | Request analytics |
| `POST` | `/services/fetching/api/settings` | Update settings |

---

## Usage

```javascript
// Simple GET
const response = await fetching.fetch('https://jsonplaceholder.typicode.com/posts/1');
const post = await response.json();

// POST with body
const created = await fetching.post(
  'https://api.example.com/users',
  JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
  {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
);
const user = await created.json();

// Full options
const result = await fetching.fetch('https://api.example.com/data', {
  method: 'DELETE',
  headers: { 'x-api-key': 'my-key' },
  timeout: 5000
});
```

---

## Notes on `requesting` Service

The `requesting` service (`src/requesting/`) is an older HTTP client service. Its functionality overlaps with `fetching`. For all new code, use `fetching`. The `requesting` service remains for backwards compatibility but should not be extended.
