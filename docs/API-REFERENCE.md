# API Reference

Complete REST API documentation for Noobly JS Core services.

## Table of Contents

- [Health Check Endpoints](#health-check-endpoints)
- [Authentication](#authentication)
- [AI Service](#ai-service)
- [Auth Service](#auth-service)
- [Caching Service](#caching-service)
- [Data Service](#data-service)
- [Filing Service](#filing-service)
- [Logging Service](#logging-service)
- [Measuring Service](#measuring-service)
- [Notifying Service](#notifying-service)
- [Queueing Service](#queueing-service)
- [Scheduling Service](#scheduling-service)
- [Searching Service](#searching-service)
- [Workflow Service](#workflow-service)
- [Working Service](#working-service)

---

## Health Check Endpoints

All 14 services provide health check endpoints for monitoring and orchestration.

### Per-Service Health Status

```http
GET /services/{service}/api/health
```

**Available Services:**

| Service | Endpoint | Status |
|---------|----------|--------|
| AI Service | `GET /services/ai/api/health` | ✅ |
| Auth Service | `GET /services/authservice/api/health` | ✅ |
| Caching Service | `GET /services/caching/api/health` | ✅ |
| Data Service | `GET /services/dataservice/api/health` | ✅ |
| Filing Service | `GET /services/filing/api/health` | ✅ |
| Fetching Service | `GET /services/fetching/api/health` | ✅ |
| Logging Service | `GET /services/logging/api/health` | ✅ |
| Measuring Service | `GET /services/measuring/api/health` | ✅ |
| Notifying Service | `GET /services/notifying/api/health` | ✅ |
| Queueing Service | `GET /services/queueing/api/health` | ✅ |
| Scheduling Service | `GET /services/scheduling/api/health` | ✅ |
| Searching Service | `GET /services/searching/api/health` | ✅ |
| Workflow Service | `GET /services/workflow/api/health` | ✅ |
| Working Service | `GET /services/working/api/health` | ✅ |

**Response (200 OK - Healthy):**
```json
{
  "status": "healthy",
  "service": "caching",
  "provider": "memory",
  "timestamp": "2026-04-21T14:30:00.000Z"
}
```

**Response (503 Unavailable - Unhealthy):**
```json
{
  "status": "unhealthy",
  "service": "dataservice",
  "message": "Service unavailable",
  "timestamp": "2026-04-21T14:30:00.000Z"
}
```

For complete health endpoint documentation, see [Health Checks Guide](./design/HEALTH_CHECKS.md).

---

## Authentication

Most API endpoints require authentication. The following methods are supported:

### API Key Authentication

Include an API key in your requests using one of these headers:

```
x-api-key: YOUR_API_KEY
Authorization: Bearer YOUR_API_KEY
Authorization: ApiKey YOUR_API_KEY
```

### Session Token Authentication

For session-based authentication, include the token:

```
Authorization: Bearer YOUR_SESSION_TOKEN
Authorization: Token YOUR_SESSION_TOKEN
x-auth-token: YOUR_SESSION_TOKEN
```

### Public Endpoints

The following paths are excluded from authentication by default:
- `GET /services/*/api/health` - Per-service health check endpoints (all 14 services)
- `GET /services/*/status` - Service status endpoints
- `POST /services/authservice/api/login` - Login endpoint
- `POST /services/authservice/api/register` - Registration endpoint

---

## AI Service

Base path: `/services/ai/api`

### Status

```http
GET /services/ai/api/status
```

Returns the operational status of the AI service.

**Response:**
```json
{
  "status": "ai api running",
  "provider": "ClaudeService",
  "enabled": true,
  "hasApiKey": true
}
```

### Send Prompt

```http
POST /services/ai/api/prompt
```

Sends a prompt to the AI service and returns the response.

**Request Body:**
```json
{
  "prompt": "Your prompt text",
  "options": {
    "model": "claude-3-opus",
    "temperature": 0.7
  },
  "username": "optional-username"
}
```

**Response:**
```json
{
  "content": "AI response text",
  "model": "claude-3-opus",
  "provider": "claude",
  "usage": {
    "promptTokens": 10,
    "completionTokens": 50,
    "totalTokens": 60
  }
}
```

### Get Analytics

```http
GET /services/ai/api/analytics
```

Returns analytics data for AI service usage.

**Query Parameters:**
- `limit` (optional): Maximum entries to return
- `recentLimit` (optional): Limit for recent activity

### List Models

```http
GET /services/ai/api/models
```

Returns available models (for Ollama provider).

### Health Check

```http
GET /services/ai/api/health
```

Returns health status of the AI provider.

### Settings

```http
GET /services/ai/api/settings
POST /services/ai/api/settings
```

Get or update service settings.

---

## Auth Service

Base path: `/services/authservice/api`

### Register User

```http
POST /services/authservice/api/register
```

Creates a new user account.

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securePassword123",
  "role": "user"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

### Login

```http
POST /services/authservice/api/login
```

Authenticates a user and creates a session.

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "securePassword123",
  "returnUrl": "/dashboard"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "session-token-here",
    "user": { "username": "johndoe", "role": "user" }
  },
  "redirectUrl": "/dashboard"
}
```

### Logout

```http
POST /services/authservice/api/logout
```

Invalidates a user session.

**Request Body:**
```json
{
  "token": "session-token-here"
}
```

### Validate Session

```http
POST /services/authservice/api/validate
```

Validates a session token.

**Request Body:**
```json
{
  "token": "session-token-here"
}
```

### List Users

```http
GET /services/authservice/api/users
```

Lists all users (requires authentication).

### Get User

```http
GET /services/authservice/api/users/:username
```

Gets a specific user by username.

### Update User

```http
PUT /services/authservice/api/users/:username
```

Updates a user's information.

### Delete User

```http
DELETE /services/authservice/api/users/:username
```

Deletes a user account.

### Assign Role

```http
POST /services/authservice/api/users/:username/role
```

Assigns a role to a user.

**Request Body:**
```json
{
  "role": "admin"
}
```

### List Roles

```http
GET /services/authservice/api/roles
```

Lists all available roles.

### Get Users in Role

```http
GET /services/authservice/api/roles/:role/users
```

Gets all users assigned to a specific role.

### Status

```http
GET /services/authservice/api/status
```

Returns service status.

### Branding

```http
GET /services/authservice/api/branding
```

Returns branding configuration for the authentication UI.

### Google OAuth

```http
GET /services/authservice/api/google
GET /services/authservice/api/google/callback
```

Google OAuth flow endpoints (when Google auth is configured).

### Analytics

```http
GET /services/authservice/api/analytics
```

Returns authentication analytics (requires authentication).

### Settings

```http
GET /services/authservice/api/settings
POST /services/authservice/api/settings
```

Get or update service settings.

---

## Caching Service

Base path: `/services/caching/api`

Supports multiple named instances via `/:instanceName/` in the path.

### Put Value

```http
POST /services/caching/api/put/:key
POST /services/caching/api/:instanceName/put/:key
```

Stores a value in the cache.

**Request Body:** Any JSON value to store.

### Get Value

```http
GET /services/caching/api/get/:key
GET /services/caching/api/:instanceName/get/:key
```

Retrieves a value from the cache.

### Delete Value

```http
DELETE /services/caching/api/delete/:key
DELETE /services/caching/api/:instanceName/delete/:key
```

Removes a value from the cache.

### Status

```http
GET /services/caching/api/status
```

Returns service status.

### List Instances

```http
GET /services/caching/api/instances
```

Returns all available cache instances.

### List Analytics

```http
GET /services/caching/api/list
GET /services/caching/api/:instanceName/list
```

Retrieves analytics data including hit counts and access times.

### Get Analytics

```http
GET /services/caching/api/analytics
GET /services/caching/api/:instanceName/analytics
```

Returns comprehensive analytics including stats, hit distribution, timeline, and top misses.

### Settings

```http
GET /services/caching/api/settings
POST /services/caching/api/settings
```

Get or update service settings.

---

## Data Service

Base path: `/services/dataservice/api`

### Add Data

```http
POST /services/dataservice/api/:container
```

Adds data to a container and returns the generated UUID.

**Request Body:** Any JSON object.

**Response:**
```json
{
  "id": "generated-uuid-here"
}
```

### Get Data

```http
GET /services/dataservice/api/:container/:uuid
```

Retrieves data by UUID from a container.

### Delete Data

```http
DELETE /services/dataservice/api/:container/:uuid
```

Removes data by UUID.

### JSON Find (Predicate)

```http
POST /services/dataservice/api/jsonFind/:containerName
```

Searches using a JavaScript predicate function.

**Request Body:**
```json
{
  "predicate": "obj.status === 'active'"
}
```

### JSON Find by Path

```http
GET /services/dataservice/api/jsonFindByPath/:containerName/:path/:value
```

Searches for objects where a specific path matches a value.

Example: `/jsonFindByPath/users/profile.role/admin`

### JSON Find by Criteria

```http
POST /services/dataservice/api/jsonFindByCriteria/:containerName
```

Searches using multiple criteria.

**Request Body:**
```json
{
  "status": "active",
  "role": "admin"
}
```

### Status

```http
GET /services/dataservice/api/status
```

Returns service status.

### Analytics

```http
GET /services/dataservice/api/analytics
GET /services/dataservice/api/analytics/totals
GET /services/dataservice/api/analytics/containers
DELETE /services/dataservice/api/analytics
```

Get analytics data or clear analytics.

**Query Parameters for `/analytics/containers`:**
- `limit` (optional): Maximum containers to return (default: 100)

### Settings

```http
GET /services/dataservice/api/settings
POST /services/dataservice/api/settings
```

Get or update service settings.

---

## Filing Service

Base path: `/services/filing/api`

### Upload File

```http
POST /services/filing/api/upload/:key
```

Uploads a file with the specified key.

**Content-Type:** `multipart/form-data` with `file` field, or raw body data.

### Upload Stream

```http
POST /services/filing/api/upload-stream/:key
```

Uploads a file using streaming for large files.

### Download File

```http
GET /services/filing/api/download/:key
```

Downloads a file by key.

**Query Parameters:**
- `encoding` (optional): Encoding (utf8, base64, etc.)
- `attachment` (optional): `true` to download as attachment

### Remove File

```http
DELETE /services/filing/api/remove/:key
```

Removes a file by key.

### Status

```http
GET /services/filing/api/status
```

Returns service status.

### Browse Files

```http
GET /services/filing/api/browse/*
```

Browses the file structure at the given path.

**Response:**
```json
{
  "path": "documents",
  "items": [
    { "name": "file.txt", "path": "documents/file.txt", "type": "file" },
    { "name": "subfolder", "path": "documents/subfolder", "type": "folder" }
  ]
}
```

### File Tree

```http
GET /services/filing/api/file-tree
```

Returns the complete hierarchical file tree structure.

### PDF Preview

```http
GET /services/filing/api/pdf-preview/:key
```

Returns PDF metadata and text preview.

**Query Parameters:**
- `page` (optional): Page number to preview (default: 1)

### Sync Operations

```http
POST /services/filing/api/sync/files
POST /services/filing/api/sync/lock/:key
POST /services/filing/api/sync/unlock/:key
GET  /services/filing/api/sync/status
POST /services/filing/api/sync/push
POST /services/filing/api/sync/pull
POST /services/filing/api/sync/notify-change
POST /services/filing/api/sync/auto/start
POST /services/filing/api/sync/auto/stop
```

Synchronization operations (available with sync provider).

### Git Operations

```http
POST /services/filing/api/git/commit
POST /services/filing/api/git/push
POST /services/filing/api/git/fetch
GET  /services/filing/api/git/status
GET  /services/filing/api/git/pending
DELETE /services/filing/api/git/pending/:commitId
POST /services/filing/api/git/auto-fetch/start
POST /services/filing/api/git/auto-fetch/stop
```

Git operations (available with Git provider).

**Git Commit Request:**
```json
{
  "commitId": "pending-commit-id",
  "message": "Commit message",
  "userId": "optional-user-id"
}
```

### Analytics

```http
GET /services/filing/api/analytics
GET /services/filing/api/analytics/stats
DELETE /services/filing/api/analytics
```

Get or clear file operation analytics.

### Settings

```http
GET /services/filing/api/settings
POST /services/filing/api/settings
```

Get or update service settings.

---

## Logging Service

Base path: `/services/logging/api`

Supports multiple named instances via `/:instanceName/` in the path.

### Log Info

```http
POST /services/logging/api/info
POST /services/logging/api/:instanceName/info
```

Logs an informational message.

**Request Body:** Any JSON message.

### Log Warning

```http
POST /services/logging/api/warn
POST /services/logging/api/:instanceName/warn
```

Logs a warning message.

### Log Error

```http
POST /services/logging/api/error
POST /services/logging/api/:instanceName/error
```

Logs an error message.

### Status

```http
GET /services/logging/api/status
```

Returns service status.

### List Instances

```http
GET /services/logging/api/instances
```

Returns all available logger instances.

### Get Logs

```http
GET /services/logging/api/logs
GET /services/logging/api/:instanceName/logs
```

Retrieves the last 1000 logs.

**Query Parameters:**
- `level` (optional): Filter by log level (INFO, WARN, ERROR, LOG)

### Get Stats

```http
GET /services/logging/api/stats
GET /services/logging/api/:instanceName/stats
```

Returns statistics about log levels.

### Get Timeline

```http
GET /services/logging/api/timeline
GET /services/logging/api/:instanceName/timeline
```

Returns timeline data showing log activity per minute.

### Client Script

```http
GET /services/logging/scripts
```

Serves the client-side JavaScript library for front-end logging.

### Swagger Docs

```http
GET /services/logging/api/swagger/docs.json
```

Returns the OpenAPI/Swagger specification.

### Settings

```http
GET /services/logging/api/settings
POST /services/logging/api/settings
```

Get or update service settings.

---

## Measuring Service

Base path: `/services/measuring/api`

### Add Metric

```http
POST /services/measuring/api/add
```

Adds a new metric data point.

**Request Body:**
```json
{
  "metric": "page_views",
  "value": 42
}
```

### List Metrics

```http
GET /services/measuring/api/list/:metric/:datestart/:dateend
```

Retrieves metric values within a date range.

**Parameters:**
- `metric`: Metric name
- `datestart`: Start date (ISO string)
- `dateend`: End date (ISO string)

### Get Total

```http
GET /services/measuring/api/total/:metric/:datestart/:dateend
```

Calculates the total sum of metric values.

### Get Average

```http
GET /services/measuring/api/average/:metric/:datestart/:dateend
```

Calculates the average of metric values.

### Status

```http
GET /services/measuring/api/status
```

Returns service status.

### Get All Metrics

```http
GET /services/measuring/api/metrics
```

Retrieves all available metrics and their values.

**Response:**
```json
{
  "success": true,
  "metrics": ["page_views", "api_calls"],
  "values": [
    { "metric": "page_views", "value": 42, "timestamp": "2024-01-15T10:30:00Z" }
  ]
}
```

### Analytics Summary

```http
GET /services/measuring/api/analytics/summary
```

Provides aggregate analytics for dashboard consumption.

**Query Parameters:**
- `topLimit` (optional): Limit for top metrics by count
- `recentLimit` (optional): Limit for recent metrics
- `historyLimit` (optional): Limit for history entries

### Settings

```http
GET /services/measuring/api/settings
POST /services/measuring/api/settings
```

Get or update service settings.

---

## Notifying Service

Base path: `/services/notifying/api`

Supports multiple named instances via `/:instanceName/` in the path.

### Create Topic

```http
POST /services/notifying/api/topic
POST /services/notifying/api/:instanceName/topic
```

Creates a new notification topic.

**Request Body:**
```json
{
  "topic": "user-events"
}
```

### Subscribe

```http
POST /services/notifying/api/subscribe/topic/:topic
POST /services/notifying/api/:instanceName/subscribe/topic/:topic
```

Subscribes a callback URL to a topic.

**Request Body:**
```json
{
  "callbackUrl": "https://example.com/webhook"
}
```

### Unsubscribe

```http
POST /services/notifying/api/unsubscribe/topic/:topic
POST /services/notifying/api/:instanceName/unsubscribe/topic/:topic
```

Unsubscribes a callback URL from a topic.

**Request Body:**
```json
{
  "callbackUrl": "https://example.com/webhook"
}
```

### Notify

```http
POST /services/notifying/api/notify/topic/:topic
POST /services/notifying/api/:instanceName/notify/topic/:topic
```

Sends a notification message to all subscribers.

**Request Body:**
```json
{
  "message": {
    "type": "user_created",
    "data": { "userId": "123" }
  }
}
```

### Status

```http
GET /services/notifying/api/status
```

Returns service status.

### List Instances

```http
GET /services/notifying/api/instances
```

Returns all available notifying instances.

### Analytics

```http
GET /services/notifying/api/analytics/overview
GET /services/notifying/api/:instanceName/analytics/overview
GET /services/notifying/api/analytics/top-topics
GET /services/notifying/api/:instanceName/analytics/top-topics
GET /services/notifying/api/analytics/topics
GET /services/notifying/api/:instanceName/analytics/topics
```

Get notification analytics and topic statistics.

**Query Parameters:**
- `limit` (optional): Maximum entries to return

### Swagger Docs

```http
GET /services/notifying/api/swagger/docs.json
```

Returns the OpenAPI/Swagger specification.

### Settings

```http
GET /services/notifying/api/settings
POST /services/notifying/api/settings
```

Get or update service settings.

---

## Queueing Service

Base path: `/services/queueing/api`

### Enqueue Task

```http
POST /services/queueing/api/enqueue/:queueName
```

Adds a task to the queue.

**Request Body:**
```json
{
  "task": {
    "type": "email",
    "payload": { "to": "user@example.com", "subject": "Hello" }
  }
}
```

### Dequeue Task

```http
GET /services/queueing/api/dequeue/:queueName
```

Removes and returns the next task from the queue.

### Get Queue Size

```http
GET /services/queueing/api/size/:queueName
```

Returns the number of tasks in the queue.

### List Queues

```http
GET /services/queueing/api/queues
```

Returns a list of all queue names.

### Purge Queue

```http
DELETE /services/queueing/api/purge/:queueName
```

Removes all items from a queue.

### Status

```http
GET /services/queueing/api/status
```

Returns service status.

### Analytics

```http
GET /services/queueing/api/analytics
```

Returns queue analytics including stats, distribution, and timeline.

### Settings

```http
GET /services/queueing/api/settings
POST /services/queueing/api/settings
```

Get or update service settings.

---

## Scheduling Service

Base path: `/services/scheduling/api`

### Create Schedule

```http
POST /services/scheduling/api/schedule
```

Schedules a task to run based on a cron expression.

**Request Body:**
```json
{
  "task": {
    "name": "daily-cleanup",
    "action": "cleanup",
    "params": {}
  },
  "cron": "0 0 * * *"
}
```

**Response:**
```json
{
  "status": "OK",
  "message": "Schedule created successfully"
}
```

### Cancel Schedule

```http
DELETE /services/scheduling/api/cancel/:taskId
```

Cancels a scheduled task.

### List Schedules

```http
GET /services/scheduling/api/schedules
```

Returns all schedules with details.

**Query Parameters:**
- `limit` (optional): Maximum schedules to return (default: 1000)

### Get Execution History

```http
GET /services/scheduling/api/executions/:scheduleId
```

Returns execution history for a specific schedule.

**Query Parameters:**
- `limit` (optional): Maximum executions to return (default: 20)

### Status

```http
GET /services/scheduling/api/status
```

Returns service status.

### Analytics

```http
GET /services/scheduling/api/analytics
GET /services/scheduling/api/analytics/totals
GET /services/scheduling/api/analytics/schedules
DELETE /services/scheduling/api/analytics
```

Get or clear scheduling analytics.

### Settings

```http
GET /services/scheduling/api/settings
POST /services/scheduling/api/settings
```

Get or update service settings.

---

## Searching Service

Base path: `/services/searching/api`

### Add Document

```http
POST /services/searching/api/add/
```

Adds content to the search index with an auto-generated UUID key.

**Request Body:**
```json
{
  "title": "Document Title",
  "content": "Searchable content here",
  "searchContainer": "optional-index-name"
}
```

**Query Parameters:**
- `searchContainer` (optional): Index name

### Search

```http
GET /services/searching/api/search/:term
```

Performs a search query.

**Query Parameters:**
- `searchContainer` (optional): Index name to search within

**Response:**
```json
[
  {
    "key": "doc-uuid",
    "score": 0.95,
    "document": { "title": "...", "content": "..." }
  }
]
```

### Delete Document

```http
DELETE /services/searching/api/delete/:key
```

Removes content from the search index.

**Query Parameters:**
- `searchContainer` (optional): Index name

### List Indexes

```http
GET /services/searching/api/indexes
```

Returns all available indexes.

**Response:**
```json
{
  "indexes": [
    { "name": "default", "count": 150 },
    { "name": "products", "count": 42 }
  ]
}
```

### Get Index Stats

```http
GET /services/searching/api/indexes/:searchContainer/stats
```

Returns statistics for a specific index.

### Delete Index

```http
DELETE /services/searching/api/indexes/:searchContainer
```

Deletes an entire index.

### Clear Index

```http
DELETE /services/searching/api/indexes/:searchContainer/clear
```

Clears all documents from an index without deleting it.

### Status

```http
GET /services/searching/api/status
```

Returns service status.

### Analytics

```http
GET /services/searching/api/analytics
GET /services/searching/api/analytics/operations
GET /services/searching/api/analytics/terms
DELETE /services/searching/api/analytics
```

Get or clear search analytics.

**Query Parameters:**
- `searchContainer` (optional): Filter by index
- `limit` (optional): Maximum entries to return

### Settings

```http
GET /services/searching/api/settings
POST /services/searching/api/settings
```

Get or update service settings.

---

## Workflow Service

Base path: `/services/workflow/api`

### Define Workflow

```http
POST /services/workflow/api/defineworkflow
```

Defines a new workflow with steps.

**Request Body:**
```json
{
  "name": "order-processing",
  "steps": [
    "./activities/validateOrder.js",
    "./activities/processPayment.js",
    "./activities/sendConfirmation.js"
  ]
}
```

**Response:**
```json
{
  "workflowId": "workflow-uuid"
}
```

### Start Workflow

```http
POST /services/workflow/api/start
```

Starts execution of a defined workflow.

**Request Body:**
```json
{
  "name": "order-processing",
  "data": {
    "orderId": "12345",
    "customer": "john@example.com"
  }
}
```

### Status

```http
GET /services/workflow/api/status
```

Returns service status.

### Get Statistics

```http
GET /services/workflow/api/stats
```

Returns workflow execution statistics.

### Get Analytics

```http
GET /services/workflow/api/analytics
GET /services/workflow/api/analytics/:workflowName
```

Returns workflow analytics.

### Workflow Definitions

```http
GET /services/workflow/api/definitions
GET /services/workflow/api/definitions/:workflowName
PUT /services/workflow/api/definitions/:workflowName
DELETE /services/workflow/api/definitions/:workflowName
```

CRUD operations for workflow definitions.

**Update Definition Request:**
```json
{
  "steps": ["./step1.js", "./step2.js"],
  "metadata": { "description": "Updated workflow" }
}
```

### Workflow Executions

```http
GET /services/workflow/api/executions/:workflowName
GET /services/workflow/api/executions/:workflowName/execution/:executionId
GET /services/workflow/api/executions/:workflowName/stats
DELETE /services/workflow/api/executions/:workflowName
```

Manage workflow execution history.

**Query Parameters for GET executions:**
- `status` (optional): Filter by status (completed, running, error)
- `limit` (optional): Maximum results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Query Parameters for DELETE executions:**
- `older_than` (optional): ISO timestamp, delete older
- `status` (optional): Delete only this status

### Settings

```http
GET /services/workflow/api/settings
POST /services/workflow/api/settings
```

Get or update service settings.

---

## Working Service

Base path: `/services/working/api`

### Run Task

```http
POST /services/working/api/run
```

Starts a background worker task.

**Request Body:**
```json
{
  "scriptPath": "./activities/processData.js",
  "data": {
    "inputFile": "data.csv",
    "options": {}
  }
}
```

**Response:**
```json
{
  "taskId": "task-uuid",
  "message": "Task queued successfully"
}
```

### Stop Worker

```http
GET /services/working/api/stop
```

Stops the currently running background worker.

### Get Task

```http
GET /services/working/api/task/:taskId
```

Returns information about a specific task.

### Get Task History

```http
GET /services/working/api/history
```

Returns task execution history.

**Query Parameters:**
- `limit` (optional): Maximum entries (default: 100)

### Status

```http
GET /services/working/api/status
```

Returns service status.

### Get Statistics

```http
GET /services/working/api/stats
```

Returns worker task statistics.

### Get Analytics

```http
GET /services/working/api/analytics
GET /services/working/api/analytics/:scriptPath
```

Returns task analytics.

### Settings

```http
GET /services/working/api/settings
POST /services/working/api/settings
```

Get or update service settings.

---

## Common Response Patterns

### Success Response

```json
{
  "success": true,
  "message": "Operation completed",
  "data": { }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed error message"
}
```

### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Authentication required |
| 404 | Not Found |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## Swagger Documentation

Most services provide Swagger/OpenAPI documentation at:

```
/services/{serviceName}/api/swagger/docs.json
```

Available Swagger docs:
- `/services/caching/api/swagger/docs.json`
- `/services/logging/api/swagger/docs.json`
- `/services/measuring/api/swagger/docs.json`
- `/services/notifying/api/swagger/docs.json`
- `/services/queueing/api/swagger/docs.json`
- `/services/scheduling/api/swagger/docs.json`
- `/services/workflow/api/swagger/docs.json`
- `/services/working/api/swagger/docs.json`
