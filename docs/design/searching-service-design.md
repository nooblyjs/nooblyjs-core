# Searching Service (`src/searching/`)

**Dependency level:** 3 – Application
**Dependencies:** `logging`, `caching`, `dataservice`, `queueing`, `working`, `scheduling`
**Last Updated:** 2026-04-04

Provides full-text search across JSON objects stored in named indexes. Documents are added with unique keys and searched via case-insensitive recursive string matching across all nested values. Supports optional queue-based batch indexing.

---

## Factory (`src/searching/index.js`)

```javascript
const search = registry.searching('default');
```

### `createSearchService(type, options, eventEmitter)` → search instance

| `type` value | Provider class | Backend |
|---|---|---|
| `'default'` (default) | `SearchService` | In-process Map storage with validation |
| `'files'` | `SearchFileService` | In-process Map storage with validation |
| `'api'` | `SearchingApi` | Remote search API via HTTP |

Emits `'Search Service Instantiated'` event on creation.

**After creating the provider:**
1. Injects `logger` from `options.dependencies.logging` with `searching.log()` helper.
2. Injects `searching.dependencies` for provider use.
3. Registers REST routes, dashboard view, and client-side scripts.

---

## SearchService Provider (`src/searching/providers/searching.js`)

Maintains named indexes as `Map<string, Map<string, Object>>` — outer map keyed by index name, inner map keyed by document key.

### Constructor

```javascript
new SearchService(options, eventEmitter, dependencies)
```

- `this.indexes` – `Map<string, Map<string, Object>>` storing all indexes.
- `this.defaultIndex_` – from `options.defaultIndex` or `'default'`.
- `this.queueService_` – from `dependencies.queueing`; enables queue-based indexing when present.
- `this.QUEUE_INDEXING_` – queue name (default: `'nooblyjs-core-searching'`).

### Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `QUEUE_INDEXING` | string | `'nooblyjs-core-searching'` | Queue name for batch indexing |

### Methods

#### `async add(key, jsonObject, searchContainer?)` → `boolean`

Adds a JSON object to an index with a unique key. If a queueing service is available, enqueues the operation for batch processing instead of direct indexing.

**Validation:** Throws `Error` if `key` is not a non-empty string or `jsonObject` is not a non-null, non-array object. Emits `search:validation-error` on invalid input.

**Events emitted:** `search:add` with `{ jsonObject, key, searchContainer }` on success; `search:add:error` if key already exists; `search:queued` if enqueued.

#### `async remove(key, searchContainer?)` → `boolean`

Removes a document by key. Returns `true` if removed, `false` if key not found.

**Validation:** Throws `Error` if `key` is not a non-empty string.

**Events emitted:** `search:remove` with `{ key, searchContainer }`

#### `async search(searchTerm, searchContainer?)` → `Array<{key, obj}>`

Case-insensitive recursive search across all string values in stored objects. Returns array of `{key, obj}` pairs for matching documents.

**Validation:** Throws `Error` if `searchTerm` is not a non-empty string.

**Events emitted:** `search:search` with `{ searchTerm, searchContainer, results }`

#### `async getStats(searchContainer?)` → `Object`

Returns statistics. If `searchContainer` is provided, returns stats for that index (`{ searchContainer, indexedItems, queueName, queueSize }`). Otherwise returns aggregated stats across all indexes (`{ totalIndexes, totalIndexedItems, indexStats, queueName, queueSize }`).

#### `listIndexes()` → `string[]`

Returns array of all index names.

#### `getIndexStats(searchContainer)` → `Object | null`

Returns `{ searchContainer, size, keys }` for a specific index, or `null` if not found.

#### `clearIndex(searchContainer)` → `boolean`

Clears all documents from an index without deleting the index itself.

**Events emitted:** `search:index:cleared` with `{ searchContainer, previousSize }`

#### `deleteIndex(searchContainer)` → `boolean`

Completely removes an index. Throws `Error` if attempting to delete the default index.

**Events emitted:** `search:index:deleted` with `{ searchContainer, deletedSize, remainingIndexes }`

#### `async startIndexing(intervalSeconds?, batchSize?)` → `void`

Starts a scheduled queue processor that dequeues and indexes items at regular intervals (default: every 5 seconds, up to 100 items per batch). Requires a queueing service.

**Events emitted:** `search:indexing:started`, `search:indexed`, `search:indexing:error`

#### `async stopIndexing()` → `void`

Stops the scheduled indexing processor.

**Events emitted:** `search:indexing:stopped`

#### `async getSettings()` → `Object`

Returns the settings object.

#### `async saveSettings(settings)` → `void`

Updates settings. Only keys present in `settings.list` are updated. Logs each change via `this.logger?.info()`.

---

## SearchFileService Provider (`src/searching/providers/searchingFile.js`)

Identical API surface to `SearchService`. Uses the same in-process Map storage with the same validation, settings management, and queue-based indexing support.

---

## SearchingApi Provider (`src/searching/providers/searchingApi.js`)

Forwards search operations to a remote search API via HTTP (axios). Errors are emitted as `searching:error` events and re-thrown.

### Constructor

```javascript
new SearchingApi(options, eventEmitter)
```

- `this.apiRoot` – from `options.apiRoot` or `options.api`, default `'http://localhost:3000'`.
- `this.logger` – extracted from `options.dependencies.logging`.
- `this.client` – axios instance configured with `baseURL`, `timeout`, and optional `X-API-Key` header.

### Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `url` | string | `'http://localhost:3000'` | Remote API base URL |
| `timeout` | number | `10000` | Request timeout in ms |
| `retryLimit` | number | `3` | Maximum retry attempts |

When `saveSettings()` updates `url` or `timeout`, the axios client is automatically rebuilt.

### Methods

| Method | Parameters | Event | Description |
|---|---|---|---|
| `index(index, id, document)` | string, string, Object | `searching:index` | Index a document remotely |
| `search(index, query)` | string, Object | `searching:search` | Search an index remotely |
| `get(index, id)` | string, string | — | Retrieve a document by ID |
| `delete(index, id)` | string, string | `searching:delete` | Remove a document |
| `clearIndex(index)` | string | `searching:clearIndex` | Clear all documents in an index |
| `getSettings()` | — | — | Returns settings |
| `saveSettings(settings)` | object | — | Updates settings; rebuilds client if URL/timeout changed |

---

## Analytics (`src/searching/modules/analytics.js`)

Singleton module (`module.exports = new SearchingAnalytics()`) imported directly by providers and routes. Tracks per-index operation counts and search term statistics.

**Per-index stats tracked:**

| Field | Type | Description |
|---|---|---|
| `adds` | number | Total add operations |
| `reads` | number | Total read operations |
| `deletes` | number | Total delete operations |
| `searches` | number | Total search operations |

**Per-search-term stats tracked:**

| Field | Type | Description |
|---|---|---|
| `term` | string | Original search term |
| `callCount` | number | Times this term was searched |
| `totalResults` | number | Cumulative result count |
| `lastCalled` | string | ISO timestamp of last search |
| `index` | string | Index name |

### Methods

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `trackAdd(indexName)` | string | void | Increment add counter |
| `trackRead(indexName)` | string | void | Increment read counter |
| `trackDelete(indexName)` | string | void | Increment delete counter |
| `trackSearch(term, resultCount, indexName)` | string, number, string | void | Track search with term stats |
| `getOperationStats(indexName?)` | string? | Object | Per-index or aggregated operation stats |
| `getSearchTermAnalytics(limit?, indexName?)` | number?, string? | Array | Top search terms sorted by call count |
| `getTermAnalytics(term, indexName?)` | string, string? | Object\|null | Stats for a specific search term |
| `getAllAnalytics(options?)` | Object? | Object | Combined operations, terms, and index summaries |
| `clear()` | — | void | Clears all analytics data |

---

## Routes

Mounted at `/services/searching/api/`. Successful mutation responses return JSON `{ success: true }`. Error responses return JSON `{ error: "message" }`.

| Method | Path | Description | Request Body / Params | Response |
|---|---|---|---|---|
| `POST` | `/add` | Add document (auto-generated UUID key) | Body: JSON object; optional `searchContainer` in body or query | `{ success: true }` |
| `DELETE` | `/delete/:key` | Remove document by key | URL param + optional `?searchContainer` | `{ success: true }` |
| `GET` | `/search/:term` | Search for documents | URL param + optional `?searchContainer` | `[{ key, obj }, ...]` |
| `GET` | `/status` | Service health check | — | `"searching api is running"` |
| `GET` | `/indexes` | List all indexes with counts | — | `{ indexes: [{ name, count }, ...] }` |
| `GET` | `/indexes/:searchContainer/stats` | Stats for specific index | URL param | `{ searchContainer, size, keys }` |
| `DELETE` | `/indexes/:searchContainer` | Delete an entire index | URL param | `{ message: "..." }` |
| `DELETE` | `/indexes/:searchContainer/clear` | Clear all docs from index | URL param | `{ message: "..." }` |
| `GET` | `/analytics` | Full analytics summary | Optional `?searchContainer`, `?limit` | `{ operations, searchTerms, indexes, stats }` |
| `GET` | `/analytics/operations` | Operation stats only | Optional `?searchContainer` | `{ adds, reads, deletes, searches, totalSearchTerms }` |
| `GET` | `/analytics/terms` | Search term analytics | Optional `?limit`, `?searchContainer` | `[{ term, callCount, totalResults, lastCalled }, ...]` |
| `DELETE` | `/analytics` | Clear all analytics data | — | `{ message: "..." }` |
| `GET` | `/settings` | Get settings | — | Settings object |
| `POST` | `/settings` | Update settings | Settings object | `{ success: true }` |

**Error responses:**
- `400` – Missing or invalid parameters (e.g., `{ error: "Key already exists" }`)
- `404` – Resource not found (e.g., `{ error: "Key not found" }`, `{ error: "Index not found" }`)
- `500` – Server error (e.g., `{ error: "error message" }`)

---

## Client-Side Library (`src/searching/scripts/js/index.js`)

Browser-loadable `searchService` class supporting both:
- **Remote mode** (`new searchService({ provider: 'remote' })`) – hits the server API.
- **Local mode** (`new searchService()`) – in-browser index using the same tokenization logic.

Methods: `search(term, container?)`, `addDocument(doc, key?, container?)`, `deleteDocument(key, container?)`, `getSuggestions(term, limit?)`

---

## Usage

```javascript
// Add documents to named indexes
await search.add('prod1', { name: 'Laptop', category: 'Electronics' }, 'products');
await search.add('prod2', { name: 'Mouse', category: 'Electronics' }, 'products');
await search.add('book1', { title: 'Node.js Guide', topic: 'Programming' }, 'books');

// Search within a specific index
const results = await search.search('Electronics', 'products');
// → [{ key: 'prod1', obj: { name: 'Laptop', ... } }, { key: 'prod2', obj: { name: 'Mouse', ... } }]

// Index management
const indexes = search.listIndexes();     // ['default', 'products', 'books']
const stats = search.getIndexStats('products'); // { searchContainer: 'products', size: 2, keys: ['prod1', 'prod2'] }
search.clearIndex('products');            // Empties the index
search.deleteIndex('products');           // Removes the index entirely

// Remove a specific document
await search.remove('book1', 'books');

// Aggregated stats
const allStats = await search.getStats();
// → { totalIndexes: 2, totalIndexedItems: 3, indexStats: { default: 0, books: 1 }, ... }
```

---

## Integration with Workflow

The workflow service can receive `searching` as a dependency to index and search workflow step outputs. This is wired automatically by the ServiceRegistry dependency injection.
