# DataService Comprehensive Usage Guide

**Service Name**: Data Service
**Version**: 1.0.14
**Status**: Production Ready
**Last Updated**: April 2, 2026

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Service Overview](#service-overview)
3. [Creating and Configuring DataService](#creating-and-configuring-dataservice)
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

DataService is built into the Digital Technologies Core framework:

```bash
npm install digital-technologies-core
```

### Basic Usage

```javascript
const EventEmitter = require('events');
const createDataService = require('./src/dataservice');

// Create event emitter
const eventEmitter = new EventEmitter();

// Create in-memory data service
const dataService = createDataService('memory', {
  dependencies: { logging: logger }
}, eventEmitter);

// Add data
const userId = await dataService.add('users', {
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});
console.log('Created user with ID:', userId);

// Retrieve data
const user = await dataService.getByUuid('users', userId);
console.log('Retrieved user:', user);

// Update data
const updated = await dataService.update('users', userId, {
  name: 'John Smith',
  age: 31
});
console.log('Updated:', updated);

// Count objects
const total = await dataService.count('users');
console.log('Total users:', total);

// Get all objects
const allUsers = await dataService.listAll('users');
console.log('All users:', allUsers);

// Search data
const activeUsers = await dataService.jsonFind('users', (user) => user.age > 25);
console.log('Active users:', activeUsers);

// Remove data
const removed = await dataService.remove('users', userId);
console.log('User removed:', removed);
```

---

## Service Overview

The **DataService** is a multi-backend data persistence layer providing:

- **Container-based storage**: Organize data into logical containers
- **UUID-based object identification**: Automatic unique key generation
- **Flexible search**: Predicate functions, path-based queries, multi-criteria matching
- **Multiple providers**: Memory, File, MongoDB, DocumentDB, SimpleDB, API
- **Event-driven architecture**: Comprehensive event emission
- **Analytics tracking**: Per-container operation metrics
- **Settings management**: Provider-specific configuration

### Key Features

| Feature | Description |
|---------|-------------|
| **Multi-Provider** | Support 6 backend types with consistent interface |
| **CRUD Operations** | Full create, read, update, delete capabilities |
| **JSON Search** | Three search methods for flexible querying |
| **Analytics** | Real-time operation tracking and statistics |
| **Event-Driven** | Emit events on all major operations |
| **Settings** | Provider-specific configuration management |
| **Dependency Injection** | Clean service integration pattern |
| **Web Dashboard** | Interactive UI for all operations |
| **REST API** | Complete HTTP API for remote access |

---

## Creating and Configuring DataService

### Factory Function Signature

```javascript
createDataService(type, options, eventEmitter)
```

**Parameters**:
- `type` _(string)_ - Provider type: `'memory'`, `'file'`, `'mongodb'`, `'documentdb'`, `'simpledb'`, or `'api'`
- `options` _(Object)_ - Configuration options
  - `dependencies` _(Object, optional)_
    - `logging` - Logging service instance
    - `filing` - Filing service instance
  - Additional provider-specific options
- `eventEmitter` _(EventEmitter, optional)_ - Event emitter for lifecycle events

**Returns**: Service instance with all methods available

### Memory Provider (Default)

Recommended for development and testing:

```javascript
const dataService = createDataService('memory', {
  dependencies: { logging: logger }
}, eventEmitter);

// Optional configuration
const dataService = createDataService('memory', {
  dependencies: { logging: logger },
  autoCreateContainers: true,  // Auto-create containers on first add
  persistData: false           // Don't persist to disk
}, eventEmitter);
```

**Characteristics**:
- Data stored in RAM
- Ultra-fast operations
- No persistence (lost on restart)
- Unlimited storage (subject to RAM)
- Perfect for testing and development

### File Provider

Recommended for single-server deployments:

```javascript
const dataService = createDataService('file', {
  dependencies: { logging: logger },
  dataDir: './.application/data'  // Storage directory
}, eventEmitter);
```

**Configuration Options**:
| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `dataDir` or `baseDir` | string | `./.data` | Directory for container JSON files |

**Characteristics**:
- One JSON file per container
- Persistent storage on disk
- Suitable for small to medium datasets
- Local-only access (single-instance only)
- Async I/O for non-blocking operations
- Good for development and low-volume production deployments
- All operations read/write entire container file

**Storage Structure**:
```
./.application/data/
├── users.json       # {"uuid": {...}, "uuid": {...}}
├── products.json    # Container for products
└── orders.json      # Container for orders
```

### MongoDB Provider

Recommended for production applications:

```javascript
const dataService = createDataService('mongodb', {
  dependencies: { logging: logger },
  connectionString: 'mongodb://127.0.0.1:27017',
  autoCreateContainers: true
}, eventEmitter);

// With authentication
const dataService = createDataService('mongodb', {
  dependencies: { logging: logger },
  connectionString: 'mongodb+srv://user:pass@cluster.mongodb.net/?authSource=admin',
  autoCreateContainers: true
}, eventEmitter);
```

**Configuration Options**:
| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `connectionString` | string | `mongodb://127.0.0.1:27017` | MongoDB connection URL |
| `connectionTimeout` | number | 30000 | Connection timeout (ms) |
| `queryTimeout` | number | 60000 | Query timeout (ms) |
| `maxConnections` | number | 100 | Connection pool size |

**Characteristics**:
- Scalable, distributed storage
- Connection pooling and automatic retry
- Unique UUID indexes for fast lookups
- Timestamps on all documents
- Perfect for large production deployments
- Supports cloud MongoDB (Atlas)

**Connection String Examples**:
```javascript
// Local MongoDB
mongodb://127.0.0.1:27017

// MongoDB Atlas (Cloud)
mongodb+srv://username:password@cluster.mongodb.net/?authSource=admin

// Replica set
mongodb://host1:27017,host2:27017,host3:27017/?replicaSet=myReplSet

// With authentication
mongodb://user:password@127.0.0.1:27017/database
```

### DocumentDB Provider

For AWS DocumentDB deployments:

```javascript
const dataService = createDataService('documentdb', {
  dependencies: { logging: logger },
  connectionString: 'mongodb://user:pass@docdb-cluster:27017/?ssl=true&ssl_ca_certs=/path/to/rds-ca-2019-root.pem',
  autoCreateContainers: true
}, eventEmitter);
```

**Characteristics**:
- AWS DocumentDB compatibility
- Similar to MongoDB but AWS-native
- Fully managed service
- Automatic backups and scaling

### SimpleDB Provider

For AWS SimpleDB deployments:

```javascript
const dataService = createDataService('simpledb', {
  dependencies: { logging: logger },
  awsRegion: 'us-east-1'
}, eventEmitter);
```

**Characteristics**:
- AWS SimpleDB backend
- Serverless NoSQL
- Pay-per-request pricing
- Limited query capabilities

### API Provider

For proxying to external DataService:

```javascript
const dataService = createDataService('api', {
  dependencies: { logging: logger },
  url: 'http://remote-dataservice:3001/services/dataservice/api'
}, eventEmitter);
```

**Characteristics**:
- Proxy to remote DataService API
- Useful for multi-tier architectures
- Requires network connectivity
- Remote server must be running

---

## Service API - Node.js

The Node.js API provides full access to all DataService methods. Some methods are only available in Node.js and not exposed via REST API (see notes in specific method documentation).

### Core Methods

#### `add(containerName, jsonObject)` - Create/Store

Stores a JSON object in a container and returns a unique UUID:

```javascript
// Add with automatic UUID generation
const uuid = await dataService.add('users', {
  name: 'John Doe',
  email: 'john@example.com',
  role: 'admin'
});
console.log('Stored with UUID:', uuid);
// Output: Stored with UUID: 550e8400-e29b-41d4-a716-446655440000

// Add to different containers
const productId = await dataService.add('products', {
  name: 'Laptop',
  price: 999.99,
  stock: 50
});

const orderId = await dataService.add('orders', {
  userId: uuid,
  productId: productId,
  quantity: 2,
  status: 'pending'
});
```

**Parameters**:
- `containerName` _(string, required)_ - Container to store in
- `jsonObject` _(Object, required)_ - Object to store

**Returns**: _(string)_ - UUID of the stored object

**Throws**: Error on invalid parameters or storage failure

**Events Emitted**: `api-dataservice-add`

**Error Handling**:
```javascript
try {
  const id = await dataService.add('users', null); // Invalid
} catch (err) {
  console.error('Storage failed:', err.message); // Error: Invalid jsonObject
}
```

---

#### `getByUuid(containerName, uuid)` - Retrieve by ID

Retrieves an object from a container by its UUID:

```javascript
// Retrieve by UUID
const user = await dataService.getByUuid('users', uuid);
console.log('Retrieved user:', user);
// Output: Retrieved user: { name: 'John Doe', email: 'john@example.com', role: 'admin' }

// Handle missing objects
const notFound = await dataService.getByUuid('users', 'invalid-uuid');
console.log('Result:', notFound); // null
```

**Parameters**:
- `containerName` _(string, required)_ - Container name
- `uuid` _(string, required)_ - Unique object identifier

**Returns**: _(Object|null)_ - The stored object or null if not found

**Events Emitted**: `api-dataservice-getByUuid` (MongoDB only)

**Error Handling**:
```javascript
try {
  const user = await dataService.getByUuid('users', uuid);
  if (!user) {
    console.log('User not found');
  }
} catch (err) {
  console.error('Retrieval failed:', err.message);
}
```

---

#### `remove(containerName, uuid)` - Delete

Removes an object from a container:

```javascript
// Remove by UUID
const removed = await dataService.remove('users', uuid);
console.log('Removal successful:', removed);
// Output: Removal successful: true

// Handle missing objects
const notRemoved = await dataService.remove('users', 'invalid-uuid');
console.log('Object existed:', notRemoved); // false
```

**Parameters**:
- `containerName` _(string, required)_ - Container name
- `uuid` _(string, required)_ - Object to remove

**Returns**: _(boolean)_ - true if object existed and was removed, false otherwise

**Events Emitted**: `api-dataservice-remove`

****Soft Delete Pattern**:
```javascript
// Instead of removing, mark as deleted
const userId = '550e8400-e29b-41d4-a716-446655440000';
await dataService.add('users', {
  id: userId,
  name: 'John Doe',
  deletedAt: new Date()
});

// Search for active users only
const activeUsers = await dataService.jsonFind('users',
  (user) => !user.deletedAt
);
```

---

#### `update(containerName, uuid, jsonObject)` - Update

Updates an existing object in a container:

```javascript
// Update a user
const updated = await dataService.update('users', userId, {
  name: 'John Smith',
  email: 'john.smith@example.com',
  role: 'admin',
  lastUpdated: new Date()
});

console.log('Updated:', updated);
// Output: Updated: true (object existed and was updated)
// Output: Updated: false (object not found)

// Handle update failure
const result = await dataService.update('users', 'invalid-uuid', { name: 'Test' });
if (!result) {
  console.log('Object not found');
}
```

**Parameters**:
- `containerName` _(string, required)_ - Container name
- `uuid` _(string, required)_ - Object UUID to update
- `jsonObject` _(Object, required)_ - New object data (replaces entire object)

**Returns**: _(boolean)_ - true if updated, false if not found

**Events Emitted**: `api-dataservice-update`

**Notes**: 
- Update replaces the entire object. Use `getByUuid()` then `update()` for partial updates if needed.
- Also available via REST API: `PUT /services/dataservice/api/:container/:uuid`

---

#### `count(containerName)` - Get Object Count

Returns the number of objects in a container:

```javascript
// Get total user count
const total = await dataService.count('users');
console.log('Total users:', total);
// Output: Total users: 42

// Use in conditionals
const userCount = await dataService.count('users');
if (userCount === 0) {
  console.log('No users found');
} else if (userCount > 1000) {
  console.log('Large user base, consider archiving');
}
```

**Parameters**:
- `containerName` _(string, required)_ - Container name

**Returns**: _(number)_ - Count of objects in container

**Events Emitted**: `api-dataservice-count`

Also available via REST API: `GET /services/dataservice/api/count/:container`

---

#### `listAll(containerName)` - Get All Objects

Retrieves all objects from a container (equivalent to `find(containerName, '')`):

```javascript
// Get all users
const allUsers = await dataService.listAll('users');
console.log('Users:', allUsers);
// Output: Users: [
//   { name: 'John Doe', email: 'john@example.com' },
//   { name: 'Jane Smith', email: 'jane@example.com' },
//   ...
// ]

// Process in batches
const users = await dataService.listAll('users');
for (let i = 0; i < users.length; i += 100) {
  const batch = users.slice(i, i + 100);
  await processBatch(batch);
}
```

**Parameters**:
- `containerName` _(string, required)_ - Container name

**Returns**: _(Array)_ - All objects in the container

**Events Emitted**: `api-dataservice-find`

**Performance Note**: For large containers (thousands+ of objects), avoid `listAll()` in production. Use search methods instead.

Also available via REST API: `GET /services/dataservice/api/find/:container` (with no query parameter returns all)

---

#### `createContainer(containerName)` - Create Container

Explicitly creates a container:

```javascript
// Create container before adding data
await dataService.createContainer('users');

// Add data to container
const userId = await dataService.add('users', {
  name: 'Jane Smith',
  email: 'jane@example.com'
});
```

**Parameters**:
- `containerName` _(string, required)_ - Container to create

**Returns**: _(Promise)_ - Resolves when container created

**Throws**: Error if container already exists

**Note**: Containers are automatically created on first `add()` if `autoCreateContainers: true`

**Events Emitted**: `api-dataservice-createContainer`

---

#### `find(containerName, searchTerm)` - Search by Text

Performs a case-insensitive substring search across all objects:

```javascript
// Search for term in all string properties
const results = await dataService.find('users', 'john');
console.log('Found users:', results);
// Output: Found users: [
//   { name: 'John Doe', email: 'john@example.com', role: 'admin' },
//   { name: 'Johnny Smith', email: 'johnny@example.com', role: 'user' }
// ]

// Search with empty term returns all (memory provider)
const allUsers = await dataService.find('users', '');
```

**Parameters**:
- `containerName` _(string, required)_ - Container to search in
- `searchTerm` _(string, required)_ - Text to search for (case-insensitive)

**Returns**: _(Array)_ - Array of matching objects

**Search Behavior**:
- Searches all string properties recursively
- Case-insensitive matching
- Substring matching (not exact)
- Searches nested object properties too

**Performance Notes**:
- Memory provider: Fast (all in RAM)
- File provider: Scans files
- MongoDB provider: Uses regex matching

**Example - Nested Search**:
```javascript
// Add object with nested structure
const userId = await dataService.add('users', {
  name: 'John Doe',
  profile: {
    bio: 'Senior software engineer at Tech Corp',
    location: 'San Francisco'
  }
});

// Search finds in nested properties too
const results = await dataService.find('users', 'Tech');
console.log('Found:', results[0].profile.bio); // 'Senior software engineer at Tech Corp'
```

---

### Advanced Search Methods

#### `jsonFind(containerName, predicate)` - Custom Predicate

Searches using a JavaScript predicate function:

```javascript
// Find users older than 25
const adultUsers = await dataService.jsonFind('users', (user) => user.age > 25);

// Complex predicates
const results = await dataService.jsonFind('users', (user) =>
  user.age > 18 && user.email.includes('@company.com')
);

// Advanced filtering
const activeAdmins = await dataService.jsonFind('users', (user) => {
  return user.role === 'admin' && user.lastLoginAt > new Date(Date.now() - 30*24*60*60*1000);
});
```

**Parameters**:
- `containerName` _(string, required)_ - Container to search in
- `predicate` _(Function, required)_ - Function returning boolean

**Predicate Signature**:
```javascript
(obj) => boolean
```

**Returns**: _(Array)_ - Matching objects

**Example - Multi-field Filtering**:
```javascript
const results = await dataService.jsonFind('orders', (order) => {
  return order.status === 'pending'
    && order.total > 100
    && order.createdAt > new Date('2025-01-01');
});
```

**Example - Nested Property Matching**:
```javascript
const results = await dataService.jsonFind('users', (user) => {
  return user.profile && user.profile.department === 'Engineering';
});
```

---

#### `jsonFindByPath(containerName, path, value)` - Path-Based Search

Searches for objects where a specific property path matches a value:

```javascript
// Simple property
const admins = await dataService.jsonFindByPath('users', 'role', 'admin');

// Dot notation for nested properties
const engineers = await dataService.jsonFindByPath(
  'users',
  'profile.department',
  'Engineering'
);

// Nested deep search
const results = await dataService.jsonFindByPath(
  'users',
  'settings.notifications.email',
  true
);
```

**Parameters**:
- `containerName` _(string, required)_ - Container to search in
- `path` _(string, required)_ - Dot-notation property path
- `value` _(*)_ - Value to match (exact comparison)

**Returns**: _(Array)_ - Matching objects

**Path Notation Examples**:
```javascript
// Top-level property
'email'

// Nested property
'profile.email'

// Deeply nested
'settings.notifications.email'

// Array index (if applicable)
'tags.0'
```

**Type Matching**:
```javascript
// Exact value matching
await dataService.jsonFindByPath('users', 'age', 30);        // Numbers
await dataService.jsonFindByPath('users', 'active', true);   // Booleans
await dataService.jsonFindByPath('users', 'name', 'John');   // Strings
```

---

#### `jsonFindByCriteria(containerName, criteria)` - Multi-Criteria Search

Searches using multiple path-value criteria (AND logic):

```javascript
// Find active admins
const results = await dataService.jsonFindByCriteria('users', {
  role: 'admin',
  active: true
});

// Nested properties with multiple criteria
const engineers = await dataService.jsonFindByCriteria('users', {
  'profile.department': 'Engineering',
  'settings.notifications': true,
  'role': 'user'
});

// Complex multi-level criteria
const results = await dataService.jsonFindByCriteria('orders', {
  'status': 'pending',
  'customer.country': 'USA',
  'total': 500  // Exact match
});
```

**Parameters**:
- `containerName` _(string, required)_ - Container to search in
- `criteria` _(Object, required)_ - Object with path-value pairs

**Criteria Format**:
```javascript
{
  'topLevelProperty': value,
  'nested.property': value,
  'deep.nested.property': value
}
```

**Returns**: _(Array)_ - Objects matching ALL criteria (AND logic)

**Example - Multi-Criteria Filtering**:
```javascript
// Find orders that are pending, from USA, worth more than $100
const relevantOrders = await dataService.jsonFindByCriteria('orders', {
  'status': 'pending',
  'customer.country': 'USA',
  'total': { /* Note: exact match, not range */ }
});

// Better approach for ranges: use jsonFind
const relevantOrders2 = await dataService.jsonFind('orders', (order) =>
  order.status === 'pending' &&
  order.customer.country === 'USA' &&
  order.total > 100
);
```

---

### Settings Methods

#### `getSettings()` - Retrieve Configuration

Retrieves current provider settings:

```javascript
const settings = await dataService.getSettings();
console.log('Current settings:', settings);
// Output:
// {
//   description: 'Configuration settings for the Data Service',
//   list: [
//     { setting: 'dataDir', type: 'string', values: ['./.digital-technologies-core/data'] },
//     { setting: 'autoCreateContainers', type: 'boolean', values: [true, false] },
//     { setting: 'persistData', type: 'boolean', values: [true, false] }
//   ],
//   dataDir: './.digital-technologies-core/data',
//   autoCreateContainers: true,
//   persistData: false
// }
```

**Returns**: _(Object)_ - Settings object with schema and values

**Settings Structure**:
- `description` _(string)_ - Human-readable description
- `list` _(Array)_ - Settings schema with types and options
- `[setting]` _(*)_ - Current values for each setting

---

#### `saveSettings(settings)` - Update Configuration

Updates provider settings:

```javascript
// Update memory provider settings
await dataService.saveSettings({
  autoCreateContainers: false,
  persistData: true
});

// Update file provider settings
await dataService.saveSettings({
  dataDir: './.application/data',
  maxFileSize: 52428800  // 50MB
});
```

**Parameters**:
- `settings` _(Object, required)_ - Settings to update (partial object OK)

**Returns**: _(Promise)_ - Resolves when settings saved

**Note**: Settings persist in memory only; are lost on application restart

---

## Provider Reference

### Comparison Matrix

| Feature | Memory | File | MongoDB | DocumentDB | SimpleDB | API |
|---------|--------|------|---------|-----------|----------|-----|
| **Speed** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Persistence** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Scalability** | ❌ | Limited | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Depends |
| **Cloud-Native** | ❌ | ❌ | ✅ | ✅ (AWS) | ✅ (AWS) | ✅ |
| **Production Use** | ❌ | ✅ (Small) | ✅ | ✅ | ✅ | ✅ |
| **Setup Time** | < 1 min | < 1 min | 5-10 min | 10-20 min | 10-20 min | 5 min |
| **Cost** | Free | Free | Free/Paid | Paid | Pay-per-request | Depends |

### Recommended Use Cases

**Memory Provider**:
- Development and testing
- Unit test execution
- Temporary data storage
- Cache-like usage patterns
- Single-process applications

**File Provider**:
- Small to medium deployments
- Single-server applications
- Development and staging
- Simple backup/restore requirements
- Lightweight data persistence

**MongoDB Provider**:
- Large-scale production applications
- Multi-server deployments
- Distributed systems
- High-availability requirements
- Complex querying needs
- Cloud deployments (MongoDB Atlas)

**DocumentDB Provider**:
- AWS-native deployments
- Organizations using AWS ecosystem
- Managed database preference
- Similar MongoDB interface

**SimpleDB Provider**:
- AWS serverless deployments
- Minimal operational overhead
- Simple query needs
- Pay-per-request pricing model

**API Provider**:
- Multi-tier architectures
- Microservices patterns
- Remote data service access
- Service aggregation

---

## REST API Endpoints

### Core CRUD Operations

#### POST `/services/dataservice/api/:container`

Store data and generate UUID:

```bash
# Create new user
curl -X POST http://localhost:3001/services/dataservice/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin"
  }'

# Response
{ "id": "550e8400-e29b-41d4-a716-446655440000" }
```

**Parameters**:
- `container` _(URL param)_ - Container name
- `body` _(JSON)_ - Object to store

**Returns**: `{ id: uuid }`

**Status Codes**: 201 (created), 500 (error)

---

#### GET `/services/dataservice/api/:container/:uuid`

Retrieve by UUID:

```bash
# Get user by UUID
curl http://localhost:3001/services/dataservice/api/users/550e8400-e29b-41d4-a716-446655440000

# Response
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "admin"
}
```

**Parameters**:
- `container` _(URL param)_ - Container name
- `uuid` _(URL param)_ - Object UUID

**Returns**: _(JSON)_ - The stored object

**Status Codes**: 200 (success), 404 (not found), 500 (error)

---

#### PUT `/services/dataservice/api/:container/:uuid`

Update by UUID:

```bash
# Update user
curl -X PUT http://localhost:3001/services/dataservice/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{ "name": "John Smith", "email": "john.smith@example.com" }'

# Response
{ "updated": true }
```

**Parameters**:
- `container` _(URL param)_ - Container name
- `uuid` _(URL param)_ - Object UUID
- `body` _(JSON)_ - Updated object data

**Returns**: `{ "updated": true }` or `{ "error": "Not found" }`

**Status Codes**: 200 (updated), 404 (not found), 500 (error)

---

#### DELETE `/services/dataservice/api/:container/:uuid`

Remove by UUID:

```bash
# Delete user
curl -X DELETE http://localhost:3001/services/dataservice/api/users/550e8400-e29b-41d4-a716-446655440000

# Response
{ "deleted": true }
```

**Parameters**:
- `container` _(URL param)_ - Container name
- `uuid` _(URL param)_ - Object UUID

**Returns**: `{ "deleted": true }` or `{ "error": "Not found" }`

**Status Codes**: 200 (removed), 404 (not found), 500 (error)

---

### Search Operations

#### GET `/services/dataservice/api/find/:container`

Text search across all objects in a container:

```bash
# Search for "john" in all string properties
curl "http://localhost:3001/services/dataservice/api/find/users?q=john"

# Response
[
  { "name": "John Doe", "email": "john@example.com", "role": "admin" },
  { "name": "Johnny Smith", "email": "johnny@example.com" }
]

# Get all objects (empty or no query)
curl "http://localhost:3001/services/dataservice/api/find/users"
```

**Parameters**:
- `container` _(URL param)_ - Container to search
- `q` _(query param, optional)_ - Search term (empty returns all)

**Returns**: _(JSON Array)_ - Matching objects

---

#### GET `/services/dataservice/api/count/:container`

Count objects in a container:

```bash
curl http://localhost:3001/services/dataservice/api/count/users

# Response
{ "count": 42 }
```

**Parameters**:
- `container` _(URL param)_ - Container to count

**Returns**: `{ "count": number }`

---

### Advanced Search Operations

#### POST `/services/dataservice/api/jsonFind/:containerName`

Search using criteria object (safe, no code execution):

```bash
# Find active admins
curl -X POST http://localhost:3001/services/dataservice/api/jsonFind/users \
  -H "Content-Type: application/json" \
  -d '{
    "criteria": {
      "role": "admin",
      "active": true
    }
  }'

# Response
[
  { "name": "John Doe", "role": "admin", "active": true },
  { "name": "Jane Smith", "role": "admin", "active": true }
]
```

**Parameters**:
- `containerName` _(URL param)_ - Container to search
- `criteria` _(body, Object)_ - Object with path-value pairs (AND logic)

**Returns**: _(JSON Array)_ - Matching objects

---

#### GET `/services/dataservice/api/jsonFindByPath/:containerName/:path/:value`

Path-based search:

```bash
# Find all admins
curl http://localhost:3001/services/dataservice/api/jsonFindByPath/users/role/admin

# Find by nested path
curl http://localhost:3001/services/dataservice/api/jsonFindByPath/users/profile.department/Engineering

# Response
[
  { "name": "John Doe", "role": "admin" },
  { "name": "Jane Smith", "role": "admin" }
]
```

**Parameters**:
- `containerName` _(URL param)_ - Container to search
- `path` _(URL param)_ - Dot-notation property path
- `value` _(URL param)_ - Value to match

**Returns**: _(JSON Array)_ - Matching objects

---

#### POST `/services/dataservice/api/jsonFindByCriteria/:containerName`

Multi-criteria search:

```bash
# Find active admins from USA
curl -X POST http://localhost:3001/services/dataservice/api/jsonFindByCriteria/users \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin",
    "active": true,
    "country": "USA"
  }'

# Response
[
  { "name": "John Doe", "role": "admin", "active": true, "country": "USA" }
]
```

**Parameters**:
- `containerName` _(URL param)_ - Container to search
- `body` _(JSON Object)_ - Criteria with path-value pairs

**Returns**: _(JSON Array)_ - Matching objects (AND logic)

---

### Status and Analytics

#### GET `/services/dataservice/api/status`

Service health check:

```bash
curl http://localhost:3001/services/dataservice/api/status

# Response
"dataservice api running"
```

**Returns**: _(string)_ - Status message

**Status Codes**: 200 (running)

---

#### GET `/services/dataservice/api/analytics`

Full analytics data:

```bash
curl http://localhost:3001/services/dataservice/api/analytics

# Response
{
  "totals": {
    "adds": 150,
    "removes": 20,
    "finds": 45,
    "updates": 12,
    "totalContainers": 5,
    "totalActions": 227
  },
  "containers": [
    { "container": "users", "adds": 100, "removes": 10, "finds": 30, "updates": 8, "totalActions": 148 },
    { "container": "products", "adds": 40, "removes": 8, "finds": 12, "updates": 3, "totalActions": 63 },
    { "container": "orders", "adds": 10, "removes": 2, "finds": 3, "updates": 1, "totalActions": 16 }
  ]
}
```

**Returns**: _(Object)_ - Complete analytics data

---

#### GET `/services/dataservice/api/analytics/totals`

Total statistics only:

```bash
curl http://localhost:3001/services/dataservice/api/analytics/totals

# Response
{
  "adds": 150,
  "removes": 20,
  "finds": 45,
  "updates": 12,
  "totalContainers": 5,
  "totalActions": 227
}
```

**Returns**: _(Object)_ - Total operation counts

---

#### GET `/services/dataservice/api/analytics/containers`

Per-container analytics:

```bash
# Get top 10 containers
curl "http://localhost:3001/services/dataservice/api/analytics/containers?limit=10"

# Response
[
  { "container": "users", "adds": 100, "removes": 10, "finds": 30, "totalActions": 140 },
  { "container": "products", "adds": 40, "removes": 8, "finds": 12, "totalActions": 60 }
]
```

**Parameters**:
- `limit` _(query)_ - Maximum entries to return (default: 100)

**Returns**: _(JSON Array)_ - Container statistics

---

#### DELETE `/services/dataservice/api/analytics`

Clear all analytics:

```bash
curl -X DELETE http://localhost:3001/services/dataservice/api/analytics

# Response
{ "message": "Analytics data cleared successfully" }
```

**Returns**: _(Object)_ - Confirmation message

---

### Settings Management

#### GET `/services/dataservice/api/settings`

Get current settings:

```bash
curl http://localhost:3001/services/dataservice/api/settings

# Response
{
  "description": "Configuration settings for the Data Service",
  "list": [
    { "setting": "dataDir", "type": "string", "values": ["./.digital-technologies-core/data"] },
    { "setting": "autoCreateContainers", "type": "boolean", "values": [true, false] }
  ],
  "dataDir": "./.digital-technologies-core/data",
  "autoCreateContainers": true
}
```

**Returns**: _(Object)_ - Settings schema and current values

---

#### POST `/services/dataservice/api/settings`

Update settings:

```bash
curl -X POST http://localhost:3001/services/dataservice/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "autoCreateContainers": false,
    "persistData": true
  }'

# Response
{ "updated": true }
```

**Parameters**:
- `body` _(JSON)_ - Settings to update (partial OK)

**Returns**: `{ "updated": true }` or `{ "error": "message" }`

---

## Analytics Module

The Analytics module tracks data operations across all containers:

### Singleton Instance

```javascript
const analytics = require('./src/dataservice/modules/analytics');

// The analytics module is automatically used by DataService
// to track all operations
```

### Methods

#### `trackAdd(containerName)`

Track an add operation:

```javascript
analytics.trackAdd('users');  // Increments user's add count
```

#### `trackRemove(containerName)`

Track a remove operation:

```javascript
analytics.trackRemove('users');  // Increments user's remove count
```

#### `trackFind(containerName)`

Track a find operation:

```javascript
analytics.trackFind('users');  // Increments user's find count
```

#### `trackUpdate(containerName)`

Track an update operation:

```javascript
analytics.trackUpdate('users');  // Increments user's update count
```

#### `getContainerStats(containerName)`

Get analytics for specific container:

```javascript
const stats = analytics.getContainerStats('users');
console.log('User container stats:', stats);
// Output:
// {
//   container: 'users',
//   adds: 50,
//   removes: 5,
//   finds: 20,
//   updates: 8,
//   totalActions: 83
// }
```

#### `getContainerAnalytics(limit)`

Get top containers sorted by activity:

```javascript
const topContainers = analytics.getContainerAnalytics(10);
// Array sorted by totalActions descending
```

#### `getTotalStats()`

Get overall statistics:

```javascript
const totals = analytics.getTotalStats();
console.log('Total statistics:', totals);
// Output:
// {
//   adds: 250,
//   removes: 30,
//   finds: 100,
//   updates: 25,
//   totalContainers: 5,
//   totalActions: 405
// }
```

#### `getAllAnalytics()`

Get complete analytics data:

```javascript
const allData = analytics.getAllAnalytics();
// Returns { totals: {...}, containers: [...] }
```

#### `clear()`

Clear all analytics data:

```javascript
analytics.clear();  // Reset all counters
```

---

## Web UI Dashboard

The DataService includes a comprehensive web dashboard at `/services/dataservice/`:

### Dashboard Tab

**Features**:
- Real-time operation statistics (adds, removes, finds)
- Color-coded metric cards (blue, red, green)
- Sortable container analytics table
- Auto-refresh after operations
- Manual refresh button

### Data Tab

Interactive forms for all CRUD operations:

1. **Store Data**: Add JSON objects and get UUID
2. **Retrieve Data**: Get objects by UUID
3. **Delete Data**: Remove objects with confirmation
4. **JSON Search**: Three search methods (predicate, path, criteria)
5. **Service Status**: Health check endpoint
6. **API Documentation**: Integrated Swagger UI

### Settings Tab

Dynamic configuration interface:
- Provider-specific settings form
- Setting descriptions and validation
- Save and reload buttons
- Settings schema display

---

## Event System

DataService emits events for all major operations:

### Standard Events (All Providers)

| Event | Data | Trigger |
|-------|------|---------|
| `api-dataservice-createContainer` | `{containerName}` | Container creation |
| `api-dataservice-add` | `{containerName, objectKey, jsonObject}` | Data addition |
| `api-dataservice-remove` | `{containerName, objectKey}` | Data removal |
| `api-dataservice-find` | `{containerName, searchTerm, results}` | Text search |
| `api-dataservice-validation-error` | `{method, error, ...params}` | Validation failures |

### MongoDB-Specific Events

| Event | Data | Trigger |
|-------|------|---------|
| `api-dataservice-mongodb:connected` | `{connectionString, database}` | Initial connection |
| `api-dataservice-mongodb:error` | `{operation, error, ...params}` | Operation error |
| `api-dataservice-getByUuid` | `{containerName, objectKey, obj}` | UUID retrieval |
| `api-dataservice-count` | `{containerName, count}` | Count operation |
| `api-dataservice-update` | `{containerName, objectKey, jsonObject}` | Update operation |
| `api-dataservice-mongodb:disconnected` | `{}` | Connection close |

### Event Listening

```javascript
const EventEmitter = require('events');
const eventEmitter = new EventEmitter();

// Listen for add operations
eventEmitter.on('api-dataservice-add', (data) => {
  console.log(`Added to ${data.containerName}: ${data.objectKey}`);
});

// Listen for errors
eventEmitter.on('api-dataservice-validation-error', (data) => {
  console.error(`Validation error in ${data.method}: ${data.error}`);
});

// Listen for all dataservice events
eventEmitter.on('api-dataservice-*', (data) => {
  console.log('DataService event:', data);
});

// Create service with event emitter
const dataService = createDataService('memory', {}, eventEmitter);
```

---

## Settings Management

### Provider Settings

Each provider has specific settings:

#### Memory Provider Settings

```javascript
{
  description: "Configuration settings for the Data Service",
  list: [
    { setting: "dataDir", type: "string", values: ["./.digital-technologies-core/data"] },
    { setting: "autoCreateContainers", type: "boolean", values: [true, false] },
    { setting: "persistData", type: "boolean", values: [true, false] }
  ],
  dataDir: "./.digital-technologies-core/data",
  autoCreateContainers: true,
  persistData: false
}
```

#### File Provider Settings

```javascript
{
  description: "File-based data storage configuration",
  list: [
    { setting: "storageLocation", type: "string", values: ["./.data"] },
    { setting: "maxFileSize", type: "number", values: [10485760] },
    { setting: "autoBackup", type: "boolean", values: [false] }
  ],
  storageLocation: "./.data",
  maxFileSize: 10485760,
  autoBackup: false
}
```

#### MongoDB Provider Settings

```javascript
{
  connectionTimeout: 30000,
  queryTimeout: 60000,
  maxConnections: 100
}
```

### Runtime Settings Update

```javascript
// Get current settings
const settings = await dataService.getSettings();

// Update settings
await dataService.saveSettings({
  autoCreateContainers: false,
  maxFileSize: 52428800
});

// Verify update
const updated = await dataService.getSettings();
console.log('New maxFileSize:', updated.maxFileSize);
```

**Important**: Settings changes persist in memory only and are lost on application restart. For persistent configuration, update environment variables or configuration files.

---

## Advanced Usage Patterns

### Multi-Container Organization

Organize data into logical containers:

```javascript
// User management
const userId = await dataService.add('users', {
  email: 'user@example.com',
  name: 'John Doe'
});

// Product catalog
const productId = await dataService.add('products', {
  name: 'Laptop',
  price: 999.99,
  sku: 'LAPTOP-001'
});

// Order management
const orderId = await dataService.add('orders', {
  userId: userId,
  productId: productId,
  quantity: 2,
  status: 'pending'
});

// Query relationships
const userOrders = await dataService.jsonFind('orders',
  (order) => order.userId === userId
);
```

### Soft Delete Pattern

Mark as deleted instead of removing:

```javascript
// When "deleting" a user, mark as deleted
const user = await dataService.getByUuid('users', userId);
await dataService.add('users', {
  ...user,
  deletedAt: new Date(),
  status: 'deleted'
});

// Query only active users
const activeUsers = await dataService.jsonFind('users',
  (user) => !user.deletedAt
);
```

### Audit Trail Pattern

Track all changes in a separate container:

```javascript
async function updateUser(userId, updates) {
  const user = await dataService.getByUuid('users', userId);

  // Log the change
  await dataService.add('user-audit-log', {
    userId: userId,
    changedAt: new Date(),
    changes: updates,
    changedBy: 'admin@example.com'
  });

  // Update the user
  await dataService.add('users', {
    ...user,
    ...updates,
    updatedAt: new Date()
  });
}
```

### Caching Layer Pattern

Use memory provider as cache with file provider as backup:

```javascript
const cacheService = createDataService('memory', {}, eventEmitter);
const dataService = createDataService('file', {
  dataDir: './.application/data'
}, eventEmitter);

// Try cache first, fall back to persistent storage
async function getData(container, id) {
  let result = await cacheService.getByUuid(container, id);
  if (!result) {
    result = await dataService.getByUuid(container, id);
    if (result) {
      // Cache the result
      await cacheService.add(container, result);
    }
  }
  return result;
}
```

### Provider Migration Pattern

Migrate data between providers:

```javascript
async function migrateData(sourceProvider, targetProvider, container) {
  try {
    // Get all data from source
    const allObjects = await sourceProvider.listAll(container);

    // Add to target
    for (const obj of allObjects) {
      await targetProvider.add(container, obj);
    }

    console.log(`Migrated ${allObjects.length} objects to target provider`);
  } catch (error) {
    console.error('Migration failed:', error);
  }
}
```

---

## Examples and Recipes

### User Management System

```javascript
const EventEmitter = require('events');
const createDataService = require('./src/dataservice');

// Initialize
const eventEmitter = new EventEmitter();
const users = createDataService('memory', {}, eventEmitter);

// Create user
async function createUser(email, name) {
  const userId = await users.add('profiles', {
    email,
    name,
    createdAt: new Date(),
    active: true
  });
  console.log(`Created user: ${userId}`);
  return userId;
}

// Get user
async function getUser(userId) {
  return await users.getByUuid('profiles', userId);
}

// Update user
async function updateUser(userId, updates) {
  const user = await getUser(userId);
  await users.update('profiles', userId, { ...user, ...updates });
}

// Find active users
async function getActiveUsers() {
  return await users.jsonFind('profiles', (u) => u.active);
}

// Usage
(async () => {
  const id1 = await createUser('john@example.com', 'John Doe');
  const id2 = await createUser('jane@example.com', 'Jane Smith');

  const user = await getUser(id1);
  console.log('User:', user);

  const active = await getActiveUsers();
  console.log('Active users:', active);
})();
```

### E-Commerce Data Model

```javascript
// Create products
const laptopId = await dataService.add('products', {
  name: 'Laptop Pro',
  price: 1999.99,
  stock: 50,
  category: 'Electronics'
});

// Create users/customers
const customerId = await dataService.add('customers', {
  name: 'John Customer',
  email: 'john@customer.com',
  address: {
    street: '123 Main St',
    city: 'New York',
    country: 'USA'
  }
});

// Create order
const orderId = await dataService.add('orders', {
  customerId: customerId,
  items: [
    { productId: laptopId, quantity: 1, price: 1999.99 }
  ],
  total: 1999.99,
  status: 'pending',
  createdAt: new Date()
});

// Find pending orders
const pendingOrders = await dataService.jsonFind('orders',
  (order) => order.status === 'pending'
);

// Find customers from USA
const usaCustomers = await dataService.jsonFindByPath('customers', 'address.country', 'USA');
```

---

## Troubleshooting and Best Practices

### Best Practices

1. **Container Naming**: Use lowercase, descriptive names (`users`, `products`, `orders`)
2. **Data Validation**: Validate data before storing
3. **Error Handling**: Always wrap operations in try-catch
4. **Analytics**: Monitor analytics to understand data patterns
5. **Backup Strategy**: Regularly backup important data
6. **Provider Selection**: Choose provider based on scale and performance needs
7. **Search Optimization**: Use appropriate search method for your use case
8. **Event Listening**: Log important events for debugging
9. **Settings Management**: Document any provider settings changes

### Common Issues

**Issue**: "Container already exists"
- **Cause**: Attempting to create duplicate container
- **Solution**: Check container exists before creation or catch the error

**Issue**: Empty search results
- **Cause**: Search term not found or wrong container
- **Solution**: Verify container name and search term match data

**Issue**: MongoDB connection timeout
- **Cause**: MongoDB server unreachable
- **Solution**: Check connection string and MongoDB server status

**Issue**: File provider running out of space
- **Cause**: Too much data in containers
- **Solution**: Archive old containers or migrate to cloud provider

**Issue**: Performance degradation
- **Cause**: Memory provider storing too much data
- **Solution**: Switch to persistent provider (File or MongoDB) and clear old data

---

## Summary

The **DataService** provides a flexible, multi-provider data persistence layer with:

✅ Container-based organization
✅ UUID-based object identification
✅ Flexible search (predicate, path-based, multi-criteria)
✅ Real-time analytics tracking
✅ Comprehensive REST API
✅ Event-driven architecture
✅ Settings management
✅ Web dashboard UI
✅ Production-ready providers

For more information, see the [Digital Technologies Core documentation](README.md).
