# API Response Standards

**Version**: 1.0.0  
**Last Updated**: 2026-04-20  
**Status**: Active — All services must comply

This document defines the standardized response formats for all Noobly JS Core service APIs, ensuring consistency across all endpoints and enabling reliable client integration.

---

## Table of Contents

1. [Response Envelope](#response-envelope)
2. [Error Responses](#error-responses)
3. [Pagination](#pagination)
4. [Status Endpoints](#status-endpoints)
5. [HTTP Status Codes](#http-status-codes)
6. [Implementation](#implementation)
7. [Examples](#examples)
8. [Migration Guide](#migration-guide)

---

## Response Envelope

All successful API responses must use a standardized envelope format:

### Format

```json
{
  "success": true,
  "data": {},
  "message": "Optional success message",
  "timestamp": "2026-04-20T10:30:00.000Z"
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | Yes | Always `true` for success responses |
| `data` | * | Yes | Response payload (any JSON-serializable value) |
| `message` | string | No | Optional human-readable message (e.g., "User created successfully") |
| `timestamp` | string | Yes | ISO-8601 formatted timestamp at response time |

### Examples

**Simple data response:**
```json
{
  "success": true,
  "data": { "id": "123", "name": "Alice" },
  "timestamp": "2026-04-20T10:30:00.000Z"
}
```

**List data response:**
```json
{
  "success": true,
  "data": [
    { "id": "1", "title": "Task 1" },
    { "id": "2", "title": "Task 2" }
  ],
  "timestamp": "2026-04-20T10:30:00.000Z"
}
```

**Response with message:**
```json
{
  "success": true,
  "data": { "workflowId": "wf-001" },
  "message": "Workflow started successfully",
  "timestamp": "2026-04-20T10:30:00.000Z"
}
```

---

## Error Responses

All error responses must use a standardized error envelope:

### Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "timestamp": "2026-04-20T10:30:00.000Z"
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | Yes | Always `false` for error responses |
| `error.code` | string | Yes | Machine-readable error code (see [Error Codes](#error-codes)) |
| `error.message` | string | Yes | Human-readable error message |
| `error.details` | object | No | Additional context (e.g., field-level validation errors) |
| `timestamp` | string | Yes | ISO-8601 formatted timestamp |

### Error Codes

All services use these standardized error codes:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed (missing/invalid fields) |
| `INVALID_REQUEST` | 400 | Request format or structure invalid |
| `UNAUTHORIZED` | 401 | Authentication required or failed |
| `FORBIDDEN` | 403 | Authenticated but not authorized for this resource |
| `NOT_FOUND` | 404 | Requested resource does not exist |
| `CONFLICT` | 409 | Request conflicts with existing state (e.g., duplicate) |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `TIMEOUT` | 504 | Request timed out |
| `RESOURCE_EXHAUSTED` | 429 | Resource quota exceeded |
| `DUPLICATE_FOUND` | 409 | Resource already exists |
| `INVALID_STATE` | 422 | Resource is in an invalid state for this operation |
| `OPERATION_FAILED` | 500 | Operation failed (generic) |

### Examples

**Validation error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Workflow name is required",
    "details": {
      "field": "name",
      "reason": "missing"
    }
  },
  "timestamp": "2026-04-20T10:30:00.000Z"
}
```

**Not found error:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "details": {
      "userId": "123"
    }
  },
  "timestamp": "2026-04-20T10:30:00.000Z"
}
```

**Conflict error:**
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "User already exists",
    "details": {
      "email": "user@example.com"
    }
  },
  "timestamp": "2026-04-20T10:30:00.000Z"
}
```

---

## Pagination

For endpoints returning lists, use the pagination envelope:

### Format

```json
{
  "success": true,
  "data": [ /* array of items */ ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 150,
    "totalPages": 3
  },
  "timestamp": "2026-04-20T10:30:00.000Z"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `pagination.page` | number | Current page (1-indexed) |
| `pagination.pageSize` | number | Items returned per page |
| `pagination.total` | number | Total items across all pages |
| `pagination.totalPages` | number | Total pages available |

### Example

```json
{
  "success": true,
  "data": [
    { "id": "1", "name": "Item 1" },
    { "id": "2", "name": "Item 2" }
  ],
  "pagination": {
    "page": 2,
    "pageSize": 10,
    "total": 25,
    "totalPages": 3
  },
  "timestamp": "2026-04-20T10:30:00.000Z"
}
```

---

## Status Endpoints

Every service must expose a `/services/{service}/api/status` endpoint with this format:

### Format

```json
{
  "success": true,
  "status": "service api running",
  "meta": {
    "provider": "memory",
    "instance": "default",
    "healthy": true
  },
  "timestamp": "2026-04-20T10:30:00.000Z"
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | Yes | Always `true` |
| `status` | string | Yes | Status message (e.g., "caching api running") |
| `meta` | object | No | Service-specific metadata (provider, instance, health, etc.) |
| `timestamp` | string | Yes | ISO-8601 timestamp |

### Examples

**Caching service:**
```json
{
  "success": true,
  "status": "caching api running",
  "meta": {
    "provider": "redis",
    "instance": "default",
    "connected": true
  },
  "timestamp": "2026-04-20T10:30:00.000Z"
}
```

**Workflow service:**
```json
{
  "success": true,
  "status": "workflow api running",
  "meta": {
    "activeWorkflows": 5,
    "completedWorkflows": 142
  },
  "timestamp": "2026-04-20T10:30:00.000Z"
}
```

---

## HTTP Status Codes

| Status Code | Use Case | Error Code |
|-------------|----------|-----------|
| 200 | Successful GET/POST/PUT | N/A |
| 201 | Resource created | N/A |
| 202 | Request accepted (async) | N/A |
| 400 | Bad request | VALIDATION_ERROR, INVALID_REQUEST |
| 401 | Unauthorized | UNAUTHORIZED |
| 403 | Forbidden | FORBIDDEN |
| 404 | Not found | NOT_FOUND |
| 409 | Conflict | CONFLICT, DUPLICATE_FOUND |
| 422 | Invalid state | INVALID_STATE |
| 429 | Rate limited | RATE_LIMITED, RESOURCE_EXHAUSTED |
| 500 | Server error | INTERNAL_ERROR, OPERATION_FAILED |
| 503 | Service unavailable | SERVICE_UNAVAILABLE |
| 504 | Timeout | TIMEOUT |

---

## Implementation

### Using responseUtils

Noobly JS Core provides a shared utility module for implementing these standards:

**File**: `src/appservice/utils/responseUtils.js`

### Setup

```javascript
const { 
  sendSuccess, 
  sendError, 
  sendList, 
  sendStatus, 
  handleError,
  ERROR_CODES,
  errorHandler 
} = require('../../appservice/utils/responseUtils');
```

### Functions

#### `sendSuccess(res, data, message, statusCode)`

Send a success response.

```javascript
// Simple response
sendSuccess(res, { id: '123' });

// With message
sendSuccess(res, { id: '123' }, 'User created', 201);

// Just status update
sendSuccess(res, { count: 5 }, 'Items cleared');
```

#### `sendError(res, code, message, details, statusCode)`

Send an error response.

```javascript
// Validation error
sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Email is required');

// Not found
sendError(res, ERROR_CODES.NOT_FOUND, 'User not found', { userId: '123' });

// Custom status code
sendError(res, ERROR_CODES.CONFLICT, 'Already exists', undefined, 409);
```

#### `sendList(res, data, pagination, message, statusCode)`

Send a paginated list response.

```javascript
sendList(res, items, {
  page: 1,
  pageSize: 50,
  total: 150
});

// With message
sendList(res, items, {
  page: 1,
  pageSize: 10,
  total: 0
}, 'No items found');
```

#### `sendStatus(res, status, meta, statusCode)`

Send a status response.

```javascript
sendStatus(res, 'caching api running', {
  provider: 'redis',
  connected: true
});
```

#### `handleError(res, err, context)`

Automatically detect error type and send appropriate error response.

```javascript
try {
  await service.operation();
} catch (err) {
  handleError(res, err, 'operation context');
}
```

#### `errorHandler` middleware

Express error handler middleware.

```javascript
app.use(errorHandler);
```

---

## Examples

### Complete Service Endpoint Example

```javascript
const { sendSuccess, sendError, sendStatus, handleError, ERROR_CODES } = require('../../appservice/utils/responseUtils');

// Status endpoint
app.get('/services/myservice/api/status', (req, res) => {
  sendStatus(res, 'myservice api running', { provider: 'memory' });
});

// Create endpoint
app.post('/services/myservice/api/items', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Item name is required');
  }

  try {
    const item = await service.create({ name });
    sendSuccess(res, item, 'Item created successfully', 201);
  } catch (err) {
    handleError(res, err, 'createItem');
  }
});

// List endpoint
app.get('/services/myservice/api/items', async (req, res) => {
  const { page = 1, pageSize = 50 } = req.query;

  try {
    const items = await service.list();
    const totalPages = Math.ceil(items.length / pageSize);
    const paginated = items.slice((page - 1) * pageSize, page * pageSize);

    sendList(res, paginated, {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total: items.length
    });
  } catch (err) {
    handleError(res, err, 'listItems');
  }
});
```

---

## Migration Guide

### For Existing Services

To migrate a service to use these standards:

1. **Add import** at top of routes file:
   ```javascript
   const { sendSuccess, sendError, sendList, sendStatus, handleError, ERROR_CODES } = require('../../appservice/utils/responseUtils');
   ```

2. **Replace success responses**:
   - Change `res.status(200).json({...})` to `sendSuccess(res, {...})`
   - Change `res.status(201).json({...})` to `sendSuccess(res, {...}, message, 201)`

3. **Replace error responses**:
   - Change `res.status(400).send('...')` to `sendError(res, ERROR_CODES.VALIDATION_ERROR, '...')`
   - Change `res.status(404).json({error: '...'})` to `sendError(res, ERROR_CODES.NOT_FOUND, '...')`
   - Change all `res.status(500).send(err.message)` to `handleError(res, err, 'context')`

4. **Standardize status endpoint**:
   - Change `res.status(200).json('service api running')` to `sendStatus(res, 'service api running')`

5. **Test all endpoints** to ensure responses match the standard format

### No Breaking Changes

The migration is backward-compatible because:
- All responses are valid JSON (clients expecting strings get valid response objects)
- HTTP status codes remain the same
- Data payloads are identical (just wrapped in envelope)

---

## FAQ

### Q: Can I add extra fields to responses?

**A**: Yes, add service-specific fields at the top level:

```json
{
  "success": true,
  "data": {...},
  "customField": "value",
  "timestamp": "..."
}
```

### Q: What if my operation takes no data to return?

**A**: Return an empty object or a simple status:

```javascript
// Empty data
sendSuccess(res, {}, 'Operation completed');

// Or message with data
sendSuccess(res, { success: true }, 'Cache cleared');
```

### Q: How do I handle partial failures?

**A**: Return error response with details about what failed:

```javascript
sendError(res, ERROR_CODES.OPERATION_FAILED, 'Bulk operation partially failed', {
  successful: 50,
  failed: 3,
  failedIds: [1, 2, 3]
});
```

### Q: Can I use different timestamp formats?

**A**: No — always use ISO-8601 (obtained via `new Date().toISOString()`). This ensures consistency and makes client parsing trivial.

---

## See Also

- [ERROR_HANDLING.md](./ERROR_HANDLING.md) — Detailed error handling patterns
- [src/appservice/utils/responseUtils.js](../../src/appservice/utils/responseUtils.js) — Implementation
- [tests/unit/appservice/responseUtils.test.js](../../tests/unit/appservice/responseUtils.test.js) — Test examples
