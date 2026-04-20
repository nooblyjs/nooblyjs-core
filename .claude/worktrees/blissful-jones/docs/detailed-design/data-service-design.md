# DataService (`src/dataservice/`)

**Dependency level:** 2 – Business Logic
**Dependencies:** Optional: `logging`, `filing`

Provides persistent data storage with a document-style CRUD interface. Abstracts the underlying backend so application code doesn't care whether data lives in memory, files, or a cloud database.

---

## Factory (`src/dataservice/index.js`)

```javascript
const ds = registry.dataService('file', { dataDir: './.application/data' });
const mongo = registry.dataService('mongodb', {
  connectionString: 'mongodb://localhost:27017',
  database: 'myapp'
});
```

### `createDataserviceService(type, options, eventEmitter)` → service wrapper object

| `type` value | Provider class | Backend |
|---|---|---|
| `'memory'` (default) | `Dataservice` | In-process JavaScript Map |
| `'file'` | `Dataservicefiles` | JSON files on disk |
| `'simpledb'` | `DataserviceSimpleDB` | AWS SimpleDB |
| `'mongodb'` | `DataserviceMongoDB` | MongoDB |
| `'documentdb'` | `DataserviceDocumentDB` | AWS DocumentDB |
| `'api'` | `DataserviceApi` | Remote HTTP data API |

Providers are **lazy-loaded** to avoid pulling in AWS/MongoDB SDKs unless they are actually needed.

**After creating the provider:**
1. Wraps it in a `service` object (see below) that adds analytics tracking and JSON search helpers.
2. Injects `logger` and `filing` dependencies.
3. Registers REST routes and dashboard view.

---

## Service Wrapper Object

The factory returns a plain object (not the raw provider) that exposes:

### `service.provider`

Direct access to the underlying provider instance.

### `async service.createContainer(containerName)` → `void`

Creates a storage container (table / collection / directory). Delegates to `provider.createContainer()`. Containers are typically created on demand.

### `async service.add(containerName, data)` → `string (UUID)`

Stores `data` in the container and returns a UUID. The UUID is auto-generated server-side using `uuid v4`. Tracks analytics via `analytics.trackAdd(containerName)`.

```javascript
const uuid = await ds.add('users', { name: 'Alice', email: 'alice@example.com' });
// uuid = "550e8400-e29b-41d4-a716-446655440000"
```

### `async service.remove(containerName, uuid)` → `boolean`

Removes the item with `uuid` from the container. Returns `true` if deleted, `false` if not found. Tracks analytics.

```javascript
const deleted = await ds.remove('users', '550e8400-e29b-41d4-a716-446655440000');
// deleted = true
```

### `async service.find(containerName, query)` → `Array`

Searches the container for items matching `query` (string, case-insensitive). Empty string returns all objects. Tracks analytics via `analytics.trackFind(containerName)`. Delegates to `provider.find()`.

```javascript
const matches = await ds.find('users', 'alice');  // Find all with 'alice' anywhere
const all = await ds.find('users', '');           // Get all users
```

### `async service.getByUuid(containerName, uuid)` → `Object | null`

Retrieves a single item by UUID. Returns `null` if not found.

```javascript
const user = await ds.getByUuid('users', '550e8400-e29b-41d4-a716-446655440000');
// { name: 'Alice', email: 'alice@example.com' } or null
```

### `async service.listAll(containerName)` → `Array`

Gets all objects in a container. Equivalent to `find(containerName, '')`.

```javascript
const allUsers = await ds.listAll('users');
```

### `async service.count(containerName)` → `number`

Returns the count of objects in a container.

```javascript
const total = await ds.count('users');
// 42
```

### `async service.update(containerName, uuid, data)` → `boolean`

Updates an existing object. Returns `true` if updated, `false` if not found. Tracks analytics.

```javascript
const updated = await ds.update('users', uuid, { name: 'Alice Smith' });
// true or false
```

---

## JSON Search Methods

The wrapper adds three higher-level search methods on top of `find()`:

### `async service.jsonFind(containerName, predicate)` → `Array`

Retrieves all objects and filters them with a **predicate function**:

```javascript
const activeUsers = await ds.jsonFind('users', user => user.active === true);
```

### `async service.jsonFindByPath(containerName, path, value)` → `Array`

Filters by dot-notation path equality:

```javascript
// Find users where profile.country === 'NZ'
const nzUsers = await ds.jsonFindByPath('users', 'profile.country', 'NZ');
```

Uses internal `getNestedValue(obj, path)` to safely traverse nested objects.

### `async service.jsonFindByCriteria(containerName, criteria)` → `Array`

Filters by multiple path/value pairs (all must match – logical AND):

```javascript
const results = await ds.jsonFindByCriteria('users', {
  'profile.age': 30,
  'profile.country': 'NZ'
});
```

---

## Settings Methods

Exposed from the provider:

### `async service.getSettings()` → `Object`

### `async service.saveSettings(settings)` → `void`

---

## Helper: `getNestedValue(obj, path)` → `*`

Internal utility (not exported). Traverses an object using dot-notation path:

```javascript
getNestedValue({ profile: { name: 'Alice' } }, 'profile.name') // → 'Alice'
getNestedValue({ profile: {} }, 'profile.email')               // → undefined
```

---

## File Provider (`src/dataservice/providers/dataservicefiles.js`)

Stores each container as a single JSON file on disk. All objects in a container are stored in one file with object UUIDs as keys.

**File Structure:**
```
.application/data/
├── users.json
│   {
│     "550e8400-e29b-41d4-a716-446655440000": { name: "Alice", ... },
│     "660e8400-e29b-41d4-a716-446655440001": { name: "Bob", ... }
│   }
├── products.json
│   { ... }
└── orders.json
    { ... }
```

**Key options:**
- `dataDir` – Base directory for all container files (default: `./.data`)
- Also accepts `baseDir` as alias for backward compatibility

**Characteristics:**
- Async I/O (non-blocking file operations)
- Persistent storage without external dependencies
- Suitable for development and low-volume production use
- All operations read/write entire container file (not optimized for very large collections)
- Good for single-instance deployments

---

## MongoDB Provider (`src/dataservice/providers/dataserviceMongoDB.js`)

Enterprise-grade document storage using MongoDB. Each container maps to a MongoDB collection. Includes connection pooling, automatic indexing, and metadata tracking.

**Key options:**
- `connectionString` – MongoDB connection URI (default: `mongodb://127.0.0.1:27017`)
- `database` – Database name (default: `digitaltechnologies`)
- `connectionTimeout` – Connection timeout in ms (default: 30000)
- `queryTimeout` – Query timeout in ms (default: 60000)
- `maxConnections` – Connection pool size (default: 100)

**Features:**
- Auto-indexing on UUID field for fast retrieval
- Adds metadata: `uuid` field, `_createdAt`, `_updatedAt` timestamps
- Connection pooling and lazy initialization
- Regex-based text search across all fields
- Handles connection failures gracefully
- All metadata fields automatically removed from results

**Document Structure in MongoDB:**
```javascript
{
  _id: ObjectId(...),           // MongoDB internal ID
  uuid: "550e8400-...",         // Application UUID
  name: "Alice",
  email: "alice@example.com",
  _createdAt: ISODate(...),     // Auto-set on insert
  _updatedAt: ISODate(...)      // Auto-set on update
}
```

---

## DocumentDB Provider (`src/dataservice/providers/dataserviceDocumentDB.js`)

AWS DocumentDB-compatible MongoDB driver. Handles TLS and SSL configurations specific to DocumentDB.

**Key options:** `host`, `port`, `username`, `password`, `ssl`, `database`

---

## SimpleDB Provider (`src/dataservice/providers/dataserviceSimpleDB.js`)

Uses AWS SimpleDB via the AWS SDK. Requires AWS credentials in the environment.

---

## Analytics (`src/dataservice/modules/analytics.js`)

Module-level singleton that tracks data operations across all containers.

**Tracked Metrics:**
- `add` count per container
- `remove` count per container
- `find` count per container
- Total operations across all containers
- Per-container operation breakdown

**Methods:**
- `trackAdd(containerName)` – Called when item added
- `trackRemove(containerName)` – Called when item removed
- `trackFind(containerName)` – Called when search performed
- `getContainerAnalytics(limit)` – Get top containers by activity
- `getTotalStats()` – Global operation counts
- `getContainerStats(containerName)` – Stats for specific container
- `getAllAnalytics()` – Complete analytics report

**Analytics Object Structure:**
```javascript
{
  container: 'users',
  adds: 42,
  removes: 5,
  finds: 127,
  totalActions: 174
}
```

---

## Events

Providers emit events through the EventEmitter for monitoring and logging:

**Event Names:**
- `api-dataservice-createContainer` – Container created
- `api-dataservice-add` – Item added (includes container, objectKey, jsonObject)
- `api-dataservice-remove` – Item removed
- `api-dataservice-getByUuid` – Item retrieved by UUID
- `api-dataservice-find` – Search performed (includes container, searchTerm, results)
- `api-dataservice-update` – Item updated
- `api-dataservice-count` – Count requested
- `api-dataservice-validation-error` – Validation failed
- `api-dataservice-mongodb:error` – MongoDB-specific error
- `api-dataservice-mongodb:connected` – MongoDB connection established
- `api-dataservice-mongodb:disconnected` – MongoDB connection closed

---

## Routes

Mounted at `/services/dataservice/api/`:

| Method | Path | Description |
|---|---|---|
| `POST` | `/services/dataservice/api/:container` | Add item, returns `{ id: uuid }` |
| `GET` | `/services/dataservice/api/:container/:uuid` | Get item by UUID |
| `DELETE` | `/services/dataservice/api/:container/:uuid` | Delete item by UUID |
| `GET` | `/services/dataservice/api/find/:container?q=searchterm` | Search container |
| `GET` | `/services/dataservice/api/status` | Service status |
| `POST` | `/services/dataservice/api/settings` | Update provider settings |

---

## Usage Examples

```javascript
// Create container (optional, auto-created on first add)
await ds.createContainer('users');

// Add a user - returns UUID
const uuid = await ds.add('users', {
  name: 'Alice',
  email: 'alice@example.com',
  profile: { age: 30, country: 'NZ' }
});
// uuid = "550e8400-e29b-41d4-a716-446655440000"

// Get by UUID
const user = await ds.getByUuid('users', uuid);
// { name: 'Alice', email: 'alice@example.com', profile: {...} }

// List all users
const allUsers = await ds.listAll('users');

// Count
const total = await ds.count('users');
// 42

// Search by text (case-insensitive, recursive)
const matches = await ds.find('users', 'alice');

// Advanced search - by path
const nzUsers = await ds.jsonFindByPath('users', 'profile.country', 'NZ');

// Advanced search - multiple criteria
const results = await ds.jsonFindByCriteria('users', {
  'profile.age': 30,
  'profile.country': 'NZ'
});

// Custom filter function
const adults = await ds.jsonFind('users', user => user.profile.age >= 18);

// Update
const updated = await ds.update('users', uuid, {
  name: 'Alice Smith',
  email: 'alice.smith@example.com',
  profile: { age: 31, country: 'NZ' }
});
// true if updated, false if not found

// Remove
const removed = await ds.remove('users', uuid);
// true if removed, false if not found

// Analytics
const stats = await ds.analytics.getContainerStats('users');
// { container: 'users', adds: 10, removes: 2, finds: 45, totalActions: 57 }
```
