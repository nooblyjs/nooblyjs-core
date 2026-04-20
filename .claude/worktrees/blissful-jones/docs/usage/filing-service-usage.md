# Filing Service - Comprehensive Usage Guide

**Status**: Production Ready ✓
**Version**: 1.0.14
**Last Updated**: 2025-11-23

## Table of Contents

1. [Service Overview](#service-overview)
2. [Service Initialization](#service-initialization)
3. [Service API (Node.js)](#service-api-nodejs)
4. [REST API Endpoints](#rest-api-endpoints)
5. [Provider Types](#provider-types)
6. [Sync Provider Guide](#sync-provider-guide)
7. [Git Provider Guide](#git-provider-guide)
8. [Analytics Module](#analytics-module)
9. [Advanced Usage Patterns](#advanced-usage-patterns)
10. [Real-World Recipes](#real-world-recipes)
11. [UI Filing Manager](#ui-filing-manager)
12. [Troubleshooting & Best Practices](#troubleshooting--best-practices)

---

## Service Overview

The **Filing Service** provides a unified interface for file operations across multiple storage backends including local filesystem, FTP, S3, Google Cloud Storage, and Git repositories. It abstracts backend complexity while providing advanced features like automatic synchronization and distributed file management.

### Key Features

- **Multi-Backend Support**: Local, FTP, S3, GCP, Git, and API providers
- **Unified API**: Consistent interface regardless of underlying storage
- **File Operations**: Create, read, update, delete, list operations
- **Streaming Support**: Handle large files efficiently with streaming
- **Synchronization**: Keep local and remote files in sync
- **Git Integration**: Version control with commits and pushes
- **File Locking**: Prevent concurrent edits with exclusive locks
- **Analytics Tracking**: Monitor file access patterns
- **Event Emission**: Full lifecycle event tracking
- **REST API**: HTTP endpoints for all operations

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Filing Service                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Unified API:                                               │
│  - create(path, content)                                    │
│  - read(path, encoding)                                     │
│  - update(path, content)                                    │
│  - delete(path)                                             │
│  - list(path)                                               │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│              Provider Abstraction Layer                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌─────┐  ┌────┐  ┌─────┐  ┌────┐  ┌────┐   │
│  │  Local   │  │ FTP │  │ S3 │  │ GCP │  │Git │  │API │   │
│  │Filesystem│  │     │  │    │  │     │  │    │  │    │   │
│  └──────────┘  └─────┘  └────┘  └─────┘  └────┘  └────┘   │
│                                                               │
│  Plus Sync Provider (wraps any backend):                    │
│  - Auto-sync capabilities                                  │
│  - File locking                                            │
│  - Conflict resolution                                     │
│  - Change tracking                                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Service Initialization

### Basic Initialization - Local Provider

```javascript
const createFilingService = require('./src/filing');
const EventEmitter = require('events');

const eventEmitter = new EventEmitter();

// Create local filesystem filing service
const filing = createFilingService('local', {
  baseDir: '/data/files',
  dependencies: {
    logging: logger
  }
}, eventEmitter);

// Now use the service
await filing.create('documents/report.pdf', fileBuffer);
const content = await filing.read('documents/report.pdf');
await filing.delete('documents/report.pdf');
```

### S3 Provider Initialization

```javascript
const filing = createFilingService('s3', {
  bucket: 'my-app-files',
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  dependencies: { logging }
}, eventEmitter);

await filing.create('uploads/image.jpg', jpgBuffer);
const image = await filing.read('uploads/image.jpg');
```

### FTP Provider Initialization

```javascript
const filing = createFilingService('ftp', {
  host: 'ftp.example.com',
  port: 21,
  user: 'ftpuser',
  password: 'ftppassword',
  basePath: '/files',
  dependencies: { logging }
}, eventEmitter);

await filing.create('archive/data.zip', zipBuffer);
```

### Sync Provider Initialization

```javascript
// Sync local files with S3 backend
const filing = createFilingService('sync', {
  remoteType: 's3',
  remoteOptions: {
    bucket: 'backup-bucket',
    region: 'us-east-1'
  },
  dependencies: { logging }
}, eventEmitter);

// Files are automatically kept in sync
await filing.create('important.pdf', buffer);
await filing.syncAll(); // Sync all files to S3
```

### Git Provider Initialization

```javascript
const filing = createFilingService('git', {
  repoPath: '/path/to/repo',
  autoCommit: false,
  dependencies: { logging }
}, eventEmitter);

// Create file and commit to git
await filing.create('src/main.js', jsCode);
const pendingCommits = filing.getPendingCommits();
```

### Configuration Options

| Provider | Required Options | Optional Options |
|----------|-----------------|-----------------|
| local | baseDir | - |
| ftp | host, port, user, password | basePath |
| s3 | bucket, region | accessKeyId, secretAccessKey |
| gcp | bucket, projectId | keyFile |
| git | repoPath | autoCommit, autoFetch |
| sync | remoteType, remoteOptions | - |
| api | apiUrl | authToken |

---

## Service API (Node.js)

### Core Methods

#### `create(path, content)`

Creates a new file with the given content.

```javascript
// Create from string
await filing.create('config.json', JSON.stringify({ env: 'prod' }));

// Create from buffer
const buffer = Buffer.from('binary data here');
await filing.create('binary/data.bin', buffer);

// Create with large file (streaming)
const readStream = fs.createReadStream('large-file.zip');
await filing.create('backups/large-file.zip', readStream);
```

**Parameters:**
- `path` (string): File path relative to base directory
- `content` (string | Buffer | ReadableStream): File content

**Returns:** Promise<void>

**Aliases:** `upload()`

---

#### `read(path, encoding)`

Reads the content of a file.

```javascript
// Read as buffer
const buffer = await filing.read('images/photo.jpg');

// Read as UTF-8 string
const text = await filing.read('documents/readme.txt', 'utf8');

// Read with different encodings
const base64 = await filing.read('data.json', 'base64');
const hex = await filing.read('binary.bin', 'hex');
```

**Parameters:**
- `path` (string): File path
- `encoding` (string, optional): Encoding (utf8, base64, hex, etc.). Omit for Buffer

**Returns:** Promise<Buffer | string>

**Aliases:** `download()`

---

#### `update(path, content)`

Updates an existing file with new content.

```javascript
// Update configuration file
const config = await filing.read('config.json', 'utf8');
const updated = { ...JSON.parse(config), version: 2 };
await filing.update('config.json', JSON.stringify(updated));

// Update with buffer
const newData = Buffer.from('updated content');
await filing.update('data/file.bin', newData);
```

**Parameters:**
- `path` (string): File path
- `content` (string | Buffer | ReadableStream): New file content

**Returns:** Promise<void>

---

#### `delete(path)`

Deletes a file.

```javascript
// Delete single file
await filing.delete('temp/cache.tmp');

// Delete file in nested directory
await filing.delete('archives/2024/january/report.pdf');
```

**Parameters:**
- `path` (string): File path to delete

**Returns:** Promise<void>

**Aliases:** `remove()`

---

#### `list(path)`

Lists contents of a directory.

```javascript
// List root directory
const files = await filing.list('/');
console.log(files);
// ['config.json', 'data/', 'uploads/']

// List subdirectory
const documents = await filing.list('documents/');
// ['report.pdf', 'memo.docx', 'archive/']

// Process listed items
for (const item of files) {
  console.log(`Item: ${item}`);
}
```

**Parameters:**
- `path` (string): Directory path

**Returns:** Promise<Array<string>>

---

### Settings Management

#### `getSettings()`

Retrieves current provider settings.

```javascript
const settings = await filing.getSettings();
console.log(settings);

// Example output:
// {
//   bucket: 'my-bucket',
//   region: 'us-east-1',
//   maxUploadSize: 5368709120
// }
```

**Returns:** Promise<Object>

---

#### `saveSettings(settings)`

Updates provider settings.

```javascript
await filing.saveSettings({
  maxUploadSize: 10737418240, // 10 GB
  timeout: 30000
});
```

**Parameters:**
- `settings` (object): Settings to update

**Returns:** Promise<void>

---

## REST API Endpoints

### File Operations

#### `POST /services/filing/api/upload/:key`

Upload a file using multipart or raw data.

```bash
# Upload using form data
curl -X POST http://localhost:3001/services/filing/api/upload/documents/report.pdf \
  -F "file=@report.pdf"

# Upload using raw data
curl -X POST http://localhost:3001/services/filing/api/upload/data/config.json \
  -H "Content-Type: application/json" \
  -d '{"env":"prod","version":2}'

# Response:
# {
#   "message": "File uploaded successfully",
#   "key": "documents/report.pdf"
# }
```

---

#### `GET /services/filing/api/download/:key`

Download a file.

```bash
# Download as raw file
curl http://localhost:3001/services/filing/api/download/documents/report.pdf \
  -o report.pdf

# Download with encoding (returns JSON)
curl "http://localhost:3001/services/filing/api/download/config.json?encoding=utf8"

# Download as attachment (with proper headers)
curl "http://localhost:3001/services/filing/api/download/document.pdf?attachment=true" \
  -o document.pdf

# Response (with encoding):
# {
#   "data": "{\"env\":\"prod\"}",
#   "encoding": "utf8"
# }
```

**Query Parameters:**
- `encoding` (string): Optional encoding (utf8, base64, hex, etc.)
- `attachment` (boolean): If true, sets download headers

---

#### `DELETE /services/filing/api/remove/:key`

Delete a file.

```bash
curl -X DELETE http://localhost:3001/services/filing/api/remove/documents/report.pdf

# Response:
# {
#   "message": "File removed successfully",
#   "key": "documents/report.pdf"
# }
```

---

#### `POST /services/filing/api/upload-stream/:key`

Upload file using stream (for large files).

```bash
# Stream large file
curl -X POST http://localhost:3001/services/filing/api/upload-stream/backups/large.zip \
  --data-binary @large.zip

# Response:
# {
#   "message": "File uploaded successfully via stream",
#   "key": "backups/large.zip"
# }
```

---

#### `GET /services/filing/api/status`

Get service status.

```bash
curl http://localhost:3001/services/filing/api/status

# Response:
# {
#   "status": "filing api running",
#   "timestamp": "2025-11-23T10:30:00.000Z"
# }
```

---

### Synchronization Endpoints

#### `POST /services/filing/api/sync/files`

Synchronize specific files (sync provider only).

```bash
curl -X POST http://localhost:3001/services/filing/api/sync/files \
  -H "Content-Type: application/json" \
  -d '{
    "files": ["config.json", "data/file.txt"]
  }'

# Response:
# {
#   "message": "File sync completed",
#   "results": [
#     { "path": "config.json", "status": "synced" },
#     { "path": "data/file.txt", "status": "synced" }
#   ],
#   "timestamp": "2025-11-23T10:30:00.000Z"
# }
```

---

#### `POST /services/filing/api/sync/lock/:key`

Lock a file for exclusive editing.

```bash
curl -X POST http://localhost:3001/services/filing/api/sync/lock/document.docx \
  -H "Content-Type: application/json" \
  -d '{"reason": "Currently editing"}'

# Response:
# {
#   "message": "File locked successfully",
#   "key": "document.docx",
#   "reason": "Currently editing",
#   "timestamp": "2025-11-23T10:30:00.000Z"
# }
```

---

#### `POST /services/filing/api/sync/unlock/:key`

Unlock a file.

```bash
curl -X POST http://localhost:3001/services/filing/api/sync/unlock/document.docx

# Response:
# {
#   "message": "File unlocked successfully",
#   "key": "document.docx",
#   "timestamp": "2025-11-23T10:30:00.000Z"
# }
```

---

#### `GET /services/filing/api/sync/status`

Get synchronization status.

```bash
curl http://localhost:3001/services/filing/api/sync/status

# Response:
# {
#   "localFiles": ["file1.txt", "file2.txt"],
#   "remoteFiles": ["file1.txt"],
#   "modified": ["file2.txt"],
#   "synced": ["file1.txt"],
#   "timestamp": "2025-11-23T10:30:00.000Z"
# }
```

---

#### `POST /services/filing/api/sync/push`

Push local changes to remote.

```bash
# Push specific files
curl -X POST http://localhost:3001/services/filing/api/sync/push \
  -H "Content-Type: application/json" \
  -d '{"files": ["config.json"]}'

# Push all modified files (if files array omitted)
curl -X POST http://localhost:3001/services/filing/api/sync/push
```

---

#### `POST /services/filing/api/sync/pull`

Pull remote changes to local.

```bash
curl -X POST http://localhost:3001/services/filing/api/sync/pull

# Pull specific files
curl -X POST http://localhost:3001/services/filing/api/sync/pull \
  -H "Content-Type: application/json" \
  -d '{"files": ["file1.txt"]}'
```

---

#### `POST /services/filing/api/sync/auto/start`

Start automatic synchronization.

```bash
curl -X POST http://localhost:3001/services/filing/api/sync/auto/start
```

---

#### `POST /services/filing/api/sync/auto/stop`

Stop automatic synchronization.

```bash
curl -X POST http://localhost:3001/services/filing/api/sync/auto/stop
```

---

## Provider Types

### Local Provider

Stores files on the local filesystem.

**Configuration:**
```javascript
{
  type: 'local',
  baseDir: '/data/files',
  dependencies: { logging }
}
```

**Use Cases:**
- Development environments
- Single-server deployments
- Data backups
- Document storage

**Advantages:**
- Fast file access
- No external dependencies
- Simple to set up

**Limitations:**
- Single server only
- No cloud redundancy

---

### S3 Provider

Stores files in Amazon S3 buckets.

**Configuration:**
```javascript
{
  type: 's3',
  bucket: 'my-bucket',
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
}
```

**Use Cases:**
- Cloud-native applications
- Distributed systems
- Scalable file storage
- Multi-region deployments

---

### FTP Provider

Stores files on FTP servers.

**Configuration:**
```javascript
{
  type: 'ftp',
  host: 'ftp.example.com',
  port: 21,
  user: 'username',
  password: 'password',
  basePath: '/files'
}
```

---

### Git Provider

Manages files in Git repositories with version control.

**Configuration:**
```javascript
{
  type: 'git',
  repoPath: '/path/to/repo',
  autoCommit: false,
  autoFetch: true
}
```

**Special Methods:**
- `commitWithMessage(commitId, message, userId)` - Commit changes
- `push()` - Push to remote
- `fetch()` - Fetch from remote
- `getGitStatus()` - Get repo status
- `getPendingCommits(userId)` - Get pending commits

---

### GCP Provider

Stores files in Google Cloud Storage buckets.

**Configuration:**
```javascript
{
  type: 'gcp',
  bucket: 'my-gcp-bucket',
  projectId: 'my-project-id',
  keyFile: '/path/to/service-account-key.json'
}
```

---

### Sync Provider

Wraps another provider and adds automatic synchronization.

**Configuration:**
```javascript
{
  type: 'sync',
  remoteType: 's3',  // The remote backend
  remoteOptions: {
    bucket: 'backup-bucket',
    region: 'us-east-1'
  }
}
```

**Special Methods:**
- `syncFile(path)` - Sync single file
- `syncAll()` - Sync all files
- `lockFile(path, reason)` - Exclusive lock
- `unlockFile(path)` - Release lock
- `getSyncStatus()` - Get sync state
- `startAutoSync()` - Enable auto-sync
- `stopAutoSync()` - Disable auto-sync

---

## Sync Provider Guide

The Sync Provider automatically keeps local files synchronized with a remote backend.

### Basic Usage

```javascript
// Create sync service with S3 as remote
const filing = createFilingService('sync', {
  remoteType: 's3',
  remoteOptions: {
    bucket: 'backup-bucket',
    region: 'us-east-1'
  }
}, eventEmitter);

// Files are automatically tracked and synced
await filing.create('important.txt', 'data');

// Get synchronization status
const status = await filing.getSyncStatus();
console.log(status);
// {
//   localFiles: ['important.txt'],
//   remoteFiles: [],
//   modified: ['important.txt'],
//   synced: []
// }

// Sync all local files to remote
await filing.syncAll();

// Or sync specific files
await filing.syncFile('important.txt');
```

### File Locking

Prevent concurrent edits with exclusive locks.

```javascript
// Lock a file
await filing.lockFile('document.docx', 'User editing');

// Do work...
await filing.update('document.docx', newContent);

// Unlock when done
await filing.unlockFile('document.docx');

// Try to lock locked file (will error)
try {
  await filing.lockFile('document.docx', 'Another user');
} catch (e) {
  console.log('File already locked');
}
```

### Monitoring Sync Status

```javascript
// Check what needs syncing
const status = await filing.getSyncStatus();

console.log('Local files:', status.localFiles);
console.log('Remote files:', status.remoteFiles);
console.log('Modified (need push):', status.modified);
console.log('Out of sync (need pull):', status.outOfSync);
console.log('Synced:', status.synced);

// Push local changes
if (status.modified.length > 0) {
  await filing.pushFile(status.modified[0]);
}

// Pull remote changes
if (status.outOfSync.length > 0) {
  await filing.pullFile(status.outOfSync[0]);
}
```

### Auto-Sync

Enable automatic background synchronization.

```javascript
// Start auto-sync
filing.startAutoSync();

// File operations are automatically synced
await filing.create('file1.txt', 'content1');
await filing.update('file1.txt', 'updated');

// Manual sync still available
await filing.syncFile('file1.txt');

// Stop auto-sync
filing.stopAutoSync();
```

---

## Git Provider Guide

Use Git for version control and distributed file management.

### Basic Git Operations

```javascript
const filing = createFilingService('git', {
  repoPath: '/path/to/repo',
  autoCommit: false
}, eventEmitter);

// Create and track files
await filing.create('src/main.js', jsCode);
await filing.create('package.json', configJson);

// Get pending commits
const pending = filing.getPendingCommits();
console.log(pending);
// [
//   { id: 'commit-1', files: ['src/main.js', 'package.json'] }
// ]

// Commit with message
await filing.commitWithMessage('commit-1', 'Add initial setup', 'user123');

// Push to remote
const result = await filing.push();
console.log('Pushed to remote');

// Fetch from remote
await filing.fetch();

// Check status
const status = await filing.getGitStatus();
console.log(status);
```

### Pending Commits

```javascript
// Get all pending commits
const allPending = filing.getPendingCommits();

// Get pending commits for specific user
const userPending = filing.getPendingCommits('user123');

// Cancel a pending commit
await filing.cancelCommit('commit-id', 'user123');
```

### Auto-Fetch

Enable automatic remote sync.

```javascript
// Start auto-fetch
filing.startAutoFetch();

// Periodically fetches from remote
// Stop when done
filing.stopAutoFetch();
```

---

## Analytics Module

Track file access patterns and operations.

### Basic Analytics

```javascript
const analytics = require('./src/filing/modules/analytics');

// Track operations are automatic via the service
const stats = analytics.getStats();
console.log(stats);

// {
//   totalPaths: 12,
//   totalReads: 45,
//   totalWrites: 23,
//   totalDeletes: 5,
//   totalOperations: 73
// }
```

### Top Accessed Files

```javascript
// Get top accessed paths
const topPaths = analytics.getAnalytics(10);
console.log(topPaths);

// [
//   { path: '/documents', reads: 20, writes: 10, deletes: 1, lastAccess: '2025-11-23T10:30:00Z' },
//   { path: '/cache', reads: 15, writes: 8, deletes: 0, lastAccess: '2025-11-23T10:29:00Z' }
// ]
```

### Path-Specific Analytics

```javascript
// Get analytics for specific path
const pathStats = analytics.getPathAnalytics('documents/reports');
console.log(pathStats);

// { path: 'documents/reports', reads: 10, writes: 5, deletes: 0, lastAccess: '...' }
```

### Reset Analytics

```javascript
// Clear all analytics
analytics.clear();
```

---

## Advanced Usage Patterns

### Pattern 1: Multi-Backend Strategy

Use different backends for different purposes.

```javascript
// Main storage on S3
const primary = createFilingService('s3', {
  bucket: 'primary-bucket',
  region: 'us-east-1'
});

// Backup on local filesystem
const backup = createFilingService('local', {
  baseDir: '/backups'
});

// Version control in Git
const versionControl = createFilingService('git', {
  repoPath: '/repos/main'
});

// Workflow:
// 1. Create file in primary storage
await primary.create('important.pdf', pdfBuffer);

// 2. Backup immediately
await backup.create('important.pdf', pdfBuffer);

// 3. Commit to version control
await versionControl.create('important.pdf', pdfBuffer);
```

---

### Pattern 2: Sync with Conflict Resolution

Manage conflicts when syncing files.

```javascript
const filing = createFilingService('sync', {
  remoteType: 's3',
  remoteOptions: { bucket: 'sync-bucket' }
});

async function safeSync(filePath) {
  try {
    // Get current status
    const status = await filing.getSyncStatus();

    // Check for conflicts
    if (status.modified.includes(filePath) &&
        status.outOfSync.includes(filePath)) {
      // Both local and remote have changes
      console.log('Conflict detected, backing up local version');
      const local = await filing.read(filePath);
      await filing.create(`${filePath}.backup`, local);
    }

    // Sync the file
    await filing.syncFile(filePath);
  } catch (error) {
    console.error('Sync failed:', error);
  }
}
```

---

### Pattern 3: Automated Backups

Create regular backups to multiple locations.

```javascript
async function backupCriticalFiles(sourceFilings, backupFiling) {
  const criticalPaths = [
    'config.json',
    'database.db',
    'secrets.enc'
  ];

  for (const filePath of criticalPaths) {
    try {
      // Read from primary
      const content = await sourceFilings[0].read(filePath);

      // Backup to all secondary locations
      for (const i = 1; i < sourceFilings.length; i++) {
        const backupPath = `backups/${new Date().toISOString()}/${filePath}`;
        await sourceFilings[i].create(backupPath, content);
      }

      console.log(`Backed up ${filePath}`);
    } catch (error) {
      console.error(`Failed to backup ${filePath}:`, error);
    }
  }
}
```

---

### Pattern 4: Large File Processing

Handle large files efficiently with streaming.

```javascript
const fs = require('node:fs');

// Upload large file via stream
async function uploadLargeFile(filePath, filingPath) {
  const readStream = fs.createReadStream(filePath);
  await filing.create(filingPath, readStream);
  console.log('Large file uploaded via stream');
}

// Download large file with progress
async function downloadLargeFile(filingPath, outputPath) {
  const content = await filing.read(filingPath); // Returns buffer or stream

  if (Buffer.isBuffer(content)) {
    await fs.promises.writeFile(outputPath, content);
  } else {
    // Handle stream
    const writeStream = fs.createWriteStream(outputPath);
    content.pipe(writeStream);
  }
}
```

---

## Real-World Recipes

### Recipe 1: Document Management System

```javascript
const filing = createFilingService('s3', {
  bucket: 'document-storage',
  region: 'us-east-1'
});

// Upload document
async function uploadDocument(userId, filename, buffer) {
  const path = `users/${userId}/documents/${Date.now()}-${filename}`;
  await filing.create(path, buffer);
  return path;
}

// List user documents
async function listUserDocuments(userId) {
  const prefix = `users/${userId}/documents`;
  return await filing.list(prefix);
}

// Download document
async function downloadDocument(path) {
  return await filing.download(path);
}

// Delete document
async function deleteDocument(path) {
  await filing.delete(path);
}

// Archive old documents
async function archiveOldDocuments(userId, daysOld = 90) {
  const docs = await listUserDocuments(userId);
  const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

  for (const doc of docs) {
    const timestamp = parseInt(doc.split('-')[0]);
    if (timestamp < cutoff) {
      const archivePath = doc.replace('/documents/', '/archive/');
      const content = await filing.read(doc);
      await filing.create(archivePath, content);
      await filing.delete(doc);
    }
  }
}
```

---

### Recipe 2: Synchronized Configuration Files

```javascript
const filing = createFilingService('sync', {
  remoteType: 'git',
  remoteOptions: {
    repoPath: '/config-repo'
  }
});

// Load configuration
async function loadConfig(configName) {
  try {
    const content = await filing.read(`configs/${configName}.json`, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load config:', error);
    return null;
  }
}

// Save configuration
async function saveConfig(configName, config) {
  const path = `configs/${configName}.json`;
  await filing.create(path, JSON.stringify(config, null, 2));

  // Sync to remote
  await filing.syncFile(path);

  console.log(`Config saved and synced: ${configName}`);
}

// Track configuration changes
async function getConfigHistory(configName) {
  const status = await filing.getGitStatus();
  return status.commits || [];
}
```

---

### Recipe 3: Media Library with Versioning

```javascript
const filing = createFilingService('git', {
  repoPath: '/media-repo',
  autoCommit: false
});

// Upload media file
async function uploadMedia(filename, buffer, metadata) {
  const path = `media/${filename}`;

  // Save media file
  await filing.create(path, buffer);

  // Save metadata
  await filing.create(`${path}.meta.json`,
    JSON.stringify(metadata, null, 2)
  );

  return path;
}

// Commit with message
async function commitMedia(filename, message, userId) {
  const pending = filing.getPendingCommits(userId);

  for (const commit of pending) {
    await filing.commitWithMessage(
      commit.id,
      `${message} - ${filename}`,
      userId
    );
  }

  await filing.push();
}

// Restore previous version
async function restoreMediaVersion(filename, commitId) {
  // Fetch historical version (Git feature)
  // Then restore to current
  console.log(`Restored ${filename} to commit ${commitId}`);
}
```

---

## Troubleshooting & Best Practices

### Best Practice 1: Error Handling

```javascript
// Always wrap operations in try-catch
async function safeFileOperation(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      console.error('File not found');
    } else if (error.code === 'EACCES') {
      console.error('Permission denied');
    } else if (error.code === 'ENOSPC') {
      console.error('No space left');
    } else {
      console.error('File operation failed:', error);
    }
  }
}
```

### Best Practice 2: Path Normalization

```javascript
// Normalize paths for consistency
function normalizePath(path) {
  return path
    .replace(/\\/g, '/')  // Windows to Unix
    .replace(/\/+/g, '/')  // Remove duplicates
    .replace(/\/$/, '')    // Remove trailing slash
    .toLowerCase();        // Case insensitive
}

// Use consistently
await filing.create(normalizePath(userPath), content);
```

### Best Practice 3: File Size Validation

```javascript
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

async function validateAndUpload(filename, buffer) {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${buffer.length} > ${MAX_FILE_SIZE}`);
  }

  await filing.create(filename, buffer);
}
```

### Best Practice 4: Cleanup Old Files

```javascript
async function cleanupOldFiles(directory, maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
  const files = await filing.list(directory);
  const now = Date.now();
  let deletedCount = 0;

  for (const file of files) {
    try {
      const stats = await filing.getStats(file);
      if (now - stats.mtime > maxAgeMs) {
        await filing.delete(file);
        deletedCount++;
      }
    } catch (error) {
      console.error(`Failed to clean ${file}:`, error);
    }
  }

  console.log(`Cleaned ${deletedCount} old files`);
}
```

### Common Issues

#### Issue: "File not found" on read

**Symptom**: Reading file that doesn't exist returns error

**Solution**:
```javascript
async function safeRead(path) {
  try {
    return await filing.read(path);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`File not found: ${path}`);
      return null;
    }
    throw error;
  }
}
```

#### Issue: Sync conflicts

**Symptom**: Local and remote files have different content

**Solution**:
```javascript
// Implement conflict resolution
async function resolveSync(filePath) {
  const status = await filing.getSyncStatus();

  if (status.modified.includes(filePath) &&
      status.outOfSync.includes(filePath)) {
    // Backup local version
    const local = await filing.read(filePath);
    await filing.create(`${filePath}.local-backup`, local);

    // Pull remote version
    await filing.pullFile(filePath);
  }
}
```

#### Issue: Large file timeout

**Symptom**: Large files fail to upload/download

**Solution**: Use streaming
```javascript
// Always use streaming for large files
const stream = fs.createReadStream('large-file.zip');
await filing.create('backups/large-file.zip', stream);
```

---

## API Quick Reference

| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `create(path, content)` | string, string\|Buffer\|Stream | Promise<void> | Create file |
| `read(path, encoding)` | string, string? | Promise<Buffer\|string> | Read file |
| `update(path, content)` | string, string\|Buffer\|Stream | Promise<void> | Update file |
| `delete(path)` | string | Promise<void> | Delete file |
| `list(path)` | string | Promise<Array<string>> | List directory |
| `getSettings()` | none | Promise<Object> | Get config |
| `saveSettings(settings)` | object | Promise<void> | Update config |

---

## UI Filing Manager

The **FilingUIManager** is a client-side JavaScript library that provides a complete file browser interface for the Filing Service. It enables end-users to browse, view, and manage files through an interactive web UI without writing backend code.

### Overview

The FilingUIManager library provides:

- **Multiple View Modes**: Grid (thumbnail), List (detailed), and Card (preview) views
- **File Browsing**: Navigate folders and view file contents
- **Breadcrumb Navigation**: Easy navigation back to parent folders
- **File Preview**: Display images, PDFs, text files, and code with syntax highlighting
- **View Mode Switching**: Toggle between Grid, List, and Card views instantly
- **Multi-Instance Support**: Create multiple independent file browsers on the same page
- **REST API Integration**: Communicates with Filing Service REST endpoints
- **Responsive Design**: Works on desktop, tablet, and mobile

### Quick Start

#### Step 1: HTML Structure

Create a container for the file browser:

```html
<!DOCTYPE html>
<html>
<head>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="/services/uiservice/css/styles.css">
</head>
<body>
    <div class="container-fluid mt-5">
        <!-- File Browser Container -->
        <div class="core-advanced-file-browser">
            <!-- File Tree Sidebar -->
            <aside class="core-file-browser-sidebar">
                <div class="core-sidebar-header">
                    <h3 class="mb-0"><i class="bi bi-folder-fill me-2"></i>Files</h3>
                </div>
                <div id="fileTreeContainer" class="core-file-tree-container">
                    <div class="spinner-border spinner-border-sm" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <span class="ms-2">Loading files...</span>
                </div>
            </aside>

            <!-- Content Area -->
            <main class="core-file-browser-content">
                <!-- Breadcrumb Navigation -->
                <nav class="core-file-browser-breadcrumb mb-3">
                    <ol class="breadcrumb mb-0" id="fileBreadcrumb">
                        <li class="breadcrumb-item"><a href="#" class="breadcrumb-root"><i class="bi bi-house-fill"></i> Root</a></li>
                    </ol>
                </nav>

                <!-- View Mode Toolbar -->
                <div class="core-file-browser-toolbar mb-3">
                    <div class="core-btn-group" role="group" aria-label="View mode">
                        <button type="button" class="btn btn-outline-secondary btn-sm core-view-mode-btn active" data-view="grid" title="Grid View">
                            <i class="bi bi-grid-3x2"></i> Grid
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm core-view-mode-btn" data-view="list" title="List View">
                            <i class="bi bi-list-ul"></i> List
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm core-view-mode-btn" data-view="card" title="Card View">
                            <i class="bi bi-card-list"></i> Cards
                        </button>
                    </div>
                </div>

                <!-- File Content Display -->
                <div id="fileContentArea" class="core-file-content-area">
                    <div class="core-empty-state">
                        <i class="bi bi-folder-open display-4 text-muted"></i>
                        <p class="mt-3 text-muted">Select a folder or file to view its contents</p>
                    </div>
                </div>
            </main>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="/services/filing/scripts/js/index.js"></script>
    <script>
        // Initialize in Step 2
    </script>
</body>
</html>
```

#### Step 2: Initialize FilingUIManager

```javascript
// Create instance after DOM is ready
const filingManager = new FilingUIManager({
    navigationContainerId: 'fileTreeContainer',
    contentContainerId: 'fileContentArea',
    breadcrumbId: 'fileBreadcrumb'
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await filingManager.initialize();
        console.log('File browser ready');
    } catch (error) {
        console.error('Initialization failed:', error);
    }
});
```

### Configuration Options

When creating a FilingUIManager instance, pass an options object:

```javascript
const options = {
    // Container IDs (required)
    navigationContainerId: 'fileTreeContainer',      // Where file tree appears
    contentContainerId: 'fileContentArea',            // Where file content displays
    breadcrumbId: 'fileBreadcrumb',                   // Where breadcrumb navigation shows

    // Optional: Refresh button ID
    refreshButtonId: 'refreshFileTreeBtn',

    // Optional: API configuration
    apiBaseUrl: '/services/filing/api',               // Default endpoint
    apiMethod: 'GET',                                 // HTTP method for browse endpoint

    // Optional: Folder prefix (for scoped browsing)
    folderPrefix: ''                                  // Prefix to API paths (e.g., 'Folder1')
};

const manager = new FilingUIManager(options);
```

### View Modes

FilingUIManager supports three view modes:

#### Grid View
Displays files and folders as large thumbnails in a grid layout. Best for visual browsing and finding files quickly.

- Folder icons in black
- File icons in gray
- 6 columns on desktop, responsive on smaller screens
- Click to open folders or view files

#### List View
Displays files and folders in a detailed list with name, type, and date information. Best for sorting and detailed information.

- Sortable columns (name, type, date)
- Folder icons in black, file icons in gray
- Shows file metadata
- Compact display

#### Card View
Displays files with preview cards including thumbnail images or content preview. Best for media-heavy folders.

- Image previews for media files
- Text preview for documents
- Folder icons with file count
- Larger display area for content

Switch view modes by clicking the toolbar buttons or programmatically:

```javascript
// Switch to list view
filingManager.currentView = 'list';
filingManager.renderFileTree(filingManager.fileTree);

// Or click a view mode button
document.querySelector('[data-view="card"]').click();
```

### HTML Structure Requirements

The FilingUIManager expects specific HTML structure and CSS classes:

**Required Classes:**
- `core-advanced-file-browser` - Main container wrapper
- `core-file-browser-sidebar` - File tree sidebar
- `core-file-tree-container` - File tree content area
- `core-file-browser-content` - Main content area
- `core-file-browser-breadcrumb` - Breadcrumb navigation
- `core-file-browser-toolbar` - View mode toolbar
- `core-file-content-area` - File display area
- `core-empty-state` - Empty state message

**Required IDs:**
- `navigationContainerId` - File tree container
- `contentContainerId` - File content area
- `breadcrumbId` - Breadcrumb list

**Optional Elements:**
- Refresh button with `id="refreshFileTreeBtn"` - Reload file tree
- View mode buttons with `data-view="grid|list|card"` - Switch views

### File Operations

#### Browsing Folders

Click on a folder in the file tree to navigate into it. The breadcrumb updates automatically and the content area displays the folder's contents.

```javascript
// Programmatically navigate to folder
filingManager.loadFileTree('documents');
```

#### Viewing Files

Click on a file to view its content in the content area. Supported file types:

- **Images**: JPG, PNG, GIF, WebP - Displays thumbnail
- **PDFs**: PDF - Shows PDF viewer
- **Text**: TXT, JSON, MD, XML - Shows formatted text
- **Code**: JS, CSS, HTML, PY, Java - Shows syntax-highlighted code
- **Other**: Binary files - Shows file info

#### Refreshing Content

Click the refresh button or call programmatically:

```javascript
// Refresh file tree
await filingManager.loadFileTree();
```

### Multiple Instance Management

Create multiple independent FilingUIManager instances to display different folders on the same page:

```html
<!-- Folder 1 Panel -->
<div class="folder-panel">
    <div class="core-advanced-file-browser">
        <aside class="core-file-browser-sidebar">
            <div id="fileTreeContainer1" class="core-file-tree-container"></div>
        </aside>
        <main class="core-file-browser-content">
            <div id="fileContentArea1" class="core-file-content-area"></div>
        </main>
    </div>
</div>

<!-- Folder 2 Panel -->
<div class="folder-panel">
    <div class="core-advanced-file-browser">
        <aside class="core-file-browser-sidebar">
            <div id="fileTreeContainer2" class="core-file-tree-container"></div>
        </aside>
        <main class="core-file-browser-content">
            <div id="fileContentArea2" class="core-file-content-area"></div>
        </main>
    </div>
</div>
```

Initialize separate instances with their own container IDs:

```javascript
// Instance 1 - Folder1
const folder1Manager = new FilingUIManager({
    navigationContainerId: 'fileTreeContainer1',
    contentContainerId: 'fileContentArea1',
    breadcrumbId: 'fileBreadcrumb1',
    folderPrefix: 'Folder1'
});

// Instance 2 - Folder2
const folder2Manager = new FilingUIManager({
    navigationContainerId: 'fileTreeContainer2',
    contentContainerId: 'fileContentArea2',
    breadcrumbId: 'fileBreadcrumb2',
    folderPrefix: 'Folder2'
});

// Initialize both
document.addEventListener('DOMContentLoaded', async () => {
    await folder1Manager.initialize();
    await folder2Manager.initialize();
});
```

**Important**: Each instance manages its own DOM elements independently. View mode changes, folder navigation, and file operations only affect the specific instance.

### Extending FilingUIManager

Create custom subclasses to extend functionality:

```javascript
class CustomFilingManager extends FilingUIManager {
    constructor(options = {}) {
        super(options);
        this.folderPrefix = options.folderPrefix || '';
    }

    async loadFileTree() {
        this.showLoading(this.navContainer, 'Loading files...');

        try {
            const endpoint = this.folderPrefix
                ? `/browse/${encodeURIComponent(this.folderPrefix)}`
                : '/browse/';

            const response = await this.fetchApi(endpoint);
            const data = await response.json();

            // Custom processing
            const tree = this.processTreeData(data);
            this.renderFileTree(tree);
        } catch (error) {
            this.showError(this.navContainer, 'Error loading files');
        }
    }

    processTreeData(data) {
        // Custom tree transformation
        return {
            name: 'root',
            type: 'folder',
            children: data.items || []
        };
    }
}
```

### Event Handling

Listen to user interactions in the file browser:

```javascript
// Click handler for file selection
document.addEventListener('click', (event) => {
    if (event.target.closest('.file-item')) {
        const fileName = event.target.dataset.name;
        const fileType = event.target.dataset.type;
        console.log(`Selected: ${fileName} (${fileType})`);
    }
});

// Folder navigation
document.addEventListener('click', (event) => {
    if (event.target.closest('.folder-item')) {
        const folderPath = event.target.dataset.path;
        filingManager.loadFileTree(folderPath);
    }
});

// View mode changes
document.addEventListener('click', (event) => {
    if (event.target.closest('.core-view-mode-btn')) {
        const viewMode = event.target.dataset.view;
        filingManager.currentView = viewMode;
        console.log(`Switched to ${viewMode} view`);
    }
});
```

### Provider Integration

FilingUIManager works seamlessly with different Filing Service providers:

```javascript
// Use with Local Provider
// No special setup needed, FilingUIManager uses default /services/filing/api

// Use with S3 Provider (if configured on server)
const manager = new FilingUIManager({
    navigationContainerId: 'fileTree',
    contentContainerId: 'fileContent',
    apiBaseUrl: '/services/filing/api'  // Same endpoint, backend handles S3
});

// Use with Sync Provider
// FilingUIManager automatically works with sync provider:
const syncManager = new FilingUIManager({
    navigationContainerId: 'fileTree',
    contentContainerId: 'fileContent',
    // Sync status displayed automatically in file browser
});

// Use with scoped folder paths
const folder1 = new FilingUIManager({
    navigationContainerId: 'tree1',
    contentContainerId: 'content1',
    folderPrefix: 'projects/folder1'  // Browse specific folder
});
```

### Advanced Patterns

#### Pattern 1: Folder-Specific UI with Custom Styling

```javascript
class BrandedFilingManager extends FilingUIManager {
    constructor(options = {}) {
        super(options);
        this.brand = options.brand || 'default';
    }

    renderFileTree(tree) {
        super.renderFileTree(tree);

        // Apply brand styling
        const sidebar = this.navContainer.closest('.core-file-browser-sidebar');
        if (sidebar) {
            sidebar.style.backgroundColor = this.getBrandColor();
        }
    }

    getBrandColor() {
        const colors = {
            'default': '#ffffff',
            'dark': '#1a1a1a',
            'accent': '#f0f0f0'
        };
        return colors[this.brand] || colors.default;
    }
}

// Use with brand option
const brandedManager = new BrandedFilingManager({
    navigationContainerId: 'fileTree',
    contentContainerId: 'fileContent',
    brand: 'dark'
});
```

#### Pattern 2: File Upload and Download

```javascript
// Add upload functionality
function setupFileUpload(filingManager) {
    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = 'Upload File';
    uploadBtn.className = 'btn btn-primary';

    uploadBtn.addEventListener('click', async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch(
                    `/services/filing/api/upload/${file.name}`,
                    {
                        method: 'POST',
                        body: formData
                    }
                );

                if (response.ok) {
                    filingManager.loadFileTree();  // Refresh
                }
            } catch (error) {
                console.error('Upload failed:', error);
            }
        };
        input.click();
    });

    document.body.appendChild(uploadBtn);
}
```

#### Pattern 3: Search and Filter

```javascript
function addSearchFunctionality(filingManager) {
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search files...';
    searchInput.className = 'form-control mb-3';

    searchInput.addEventListener('keyup', (e) => {
        const query = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.file-item, .folder-item');

        items.forEach(item => {
            const name = item.textContent.toLowerCase();
            item.style.display = name.includes(query) ? 'block' : 'none';
        });
    });

    const toolbar = document.querySelector('.core-file-browser-toolbar');
    toolbar.insertBefore(searchInput, toolbar.firstChild);
}
```

### Real-World Example: Dual Folder File Manager

This example creates a side-by-side file browser for comparing two folders:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dual Folder File Manager</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="/services/uiservice/css/styles.css">
</head>
<body>
    <div class="container-fluid mt-5">
        <div class="row mb-4">
            <div class="col-12">
                <h4 class="mb-1"><i class="bi bi-diagram-3"></i> Dual Folder File Management</h4>
                <p class="text-muted mb-0">Explore and manage files in two folders simultaneously</p>
            </div>
        </div>

        <div class="row">
            <!-- Folder 1 -->
            <div class="col-lg-6">
                <div class="core-advanced-file-browser">
                    <aside class="core-file-browser-sidebar">
                        <div class="core-sidebar-header">
                            <h3 class="mb-0"><i class="bi bi-folder-fill me-2"></i>Folder 1</h3>
                        </div>
                        <div id="fileTreeContainer1" class="core-file-tree-container"></div>
                    </aside>
                    <main class="core-file-browser-content">
                        <nav class="core-file-browser-breadcrumb mb-3">
                            <ol class="breadcrumb mb-0" id="fileBreadcrumb1">
                                <li class="breadcrumb-item"><a href="#" class="breadcrumb-root">Root</a></li>
                            </ol>
                        </nav>
                        <div class="core-file-browser-toolbar mb-3">
                            <div class="core-btn-group" role="group">
                                <button type="button" class="btn btn-outline-secondary btn-sm core-view-mode-btn active" data-view="grid">
                                    <i class="bi bi-grid-3x2"></i> Grid
                                </button>
                                <button type="button" class="btn btn-outline-secondary btn-sm core-view-mode-btn" data-view="list">
                                    <i class="bi bi-list-ul"></i> List
                                </button>
                                <button type="button" class="btn btn-outline-secondary btn-sm core-view-mode-btn" data-view="card">
                                    <i class="bi bi-card-list"></i> Cards
                                </button>
                            </div>
                        </div>
                        <div id="fileContentArea1" class="core-file-content-area"></div>
                    </main>
                </div>
            </div>

            <!-- Folder 2 -->
            <div class="col-lg-6">
                <div class="core-advanced-file-browser">
                    <aside class="core-file-browser-sidebar">
                        <div class="core-sidebar-header">
                            <h3 class="mb-0"><i class="bi bi-folder-fill me-2"></i>Folder 2</h3>
                        </div>
                        <div id="fileTreeContainer2" class="core-file-tree-container"></div>
                    </aside>
                    <main class="core-file-browser-content">
                        <nav class="core-file-browser-breadcrumb mb-3">
                            <ol class="breadcrumb mb-0" id="fileBreadcrumb2">
                                <li class="breadcrumb-item"><a href="#" class="breadcrumb-root">Root</a></li>
                            </ol>
                        </nav>
                        <div class="core-file-browser-toolbar mb-3">
                            <div class="core-btn-group" role="group">
                                <button type="button" class="btn btn-outline-secondary btn-sm core-view-mode-btn active" data-view="grid">
                                    <i class="bi bi-grid-3x2"></i> Grid
                                </button>
                                <button type="button" class="btn btn-outline-secondary btn-sm core-view-mode-btn" data-view="list">
                                    <i class="bi bi-list-ul"></i> List
                                </button>
                                <button type="button" class="btn btn-outline-secondary btn-sm core-view-mode-btn" data-view="card">
                                    <i class="bi bi-card-list"></i> Cards
                                </button>
                            </div>
                        </div>
                        <div id="fileContentArea2" class="core-file-content-area"></div>
                    </main>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="/services/filing/scripts/js/index.js"></script>
    <script>
        // Custom manager that extends FilingUIManager
        class DualFolderFilingManager extends FilingUIManager {
            constructor(options = {}) {
                super(options);
                this.folderPrefix = options.folderPrefix || '';
            }

            async loadFileTree() {
                this.showLoading(this.navContainer, 'Loading files...');

                try {
                    const endpoint = this.folderPrefix
                        ? `/browse/${encodeURIComponent(this.folderPrefix)}`
                        : '/browse/';

                    const response = await this.fetchApi(endpoint);
                    const data = await response.json();

                    if (!data.items || data.items.length === 0) {
                        this.navContainer.innerHTML = '<div class="p-3 text-center text-muted">No files</div>';
                        return;
                    }

                    const tree = {
                        name: 'root',
                        type: 'folder',
                        children: data.items.map(item => ({
                            name: item.name,
                            path: item.path,
                            type: item.type,
                            children: item.type === 'folder' ? [] : undefined
                        }))
                    };

                    this.fileTree = tree;
                    this.renderFileTree(tree);
                } catch (error) {
                    console.error('Error loading file tree:', error);
                    this.showError(this.navContainer, 'Error loading files');
                }
            }
        }

        // Initialize both managers
        const folder1Manager = new DualFolderFilingManager({
            navigationContainerId: 'fileTreeContainer1',
            contentContainerId: 'fileContentArea1',
            breadcrumbId: 'fileBreadcrumb1',
            folderPrefix: 'Folder1'
        });

        const folder2Manager = new DualFolderFilingManager({
            navigationContainerId: 'fileTreeContainer2',
            contentContainerId: 'fileContentArea2',
            breadcrumbId: 'fileBreadcrumb2',
            folderPrefix: 'Folder2'
        });

        // Initialize when DOM is ready
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                await folder1Manager.initialize();
                await folder2Manager.initialize();
                console.log('Both folders initialized successfully');
            } catch (error) {
                console.error('Error initializing folder managers:', error);
            }
        });
    </script>
</body>
</html>
```

### Troubleshooting

#### Issue: "Loading files..." spinner never stops

**Symptom**: File tree shows loading indicator but never displays files

**Causes & Solutions**:
1. API endpoint unreachable - Check `/services/filing/api` responds with `/browse/` endpoint
2. Missing folder data - Verify files exist in base directory
3. CORS issues - Ensure Filing Service CORS headers are set correctly

```javascript
// Debug: Check API response
async function debugAPI() {
    try {
        const response = await fetch('/services/filing/api/browse/');
        const data = await response.json();
        console.log('API Response:', data);
    } catch (error) {
        console.error('API Error:', error);
    }
}
```

#### Issue: View mode buttons affect all instances

**Symptom**: Clicking Grid/List/Card on one folder changes both folders

**Solution**: Ensure view mode buttons are properly scoped within each folder's content area. Each instance should have its own `.core-file-browser-content` container with `.core-view-mode-btn` children inside.

#### Issue: Files don't display in content area

**Symptom**: Clicking files shows nothing in content area

**Causes & Solutions**:
1. Content container not found - Verify `contentContainerId` exists in HTML
2. File type not supported - Only images, PDFs, text, and code are previewed
3. CORS blocking file access - Check browser console for CORS errors

#### Issue: Breadcrumb navigation doesn't work

**Symptom**: Clicking breadcrumb items doesn't navigate folders

**Solution**: Ensure breadcrumb container has `id` matching `breadcrumbId` option and contains `<ol class="breadcrumb">` element.

### Best Practices

1. **Always initialize in DOMContentLoaded**: Wait for DOM to be ready before creating instances
2. **Use proper container IDs**: Match HTML element IDs with configuration options exactly
3. **Handle errors gracefully**: Wrap initialization in try-catch
4. **Scope view buttons**: Ensure view mode buttons are within the content area
5. **Multiple instances**: Create separate manager instances for each file browser
6. **Provider consistency**: Use consistent API base URL across all instances

---

## Conclusion

The Filing Service provides a powerful, flexible abstraction over multiple storage backends. Whether you need simple local file storage, cloud scalability with S3, or distributed version control with Git, the Filing Service provides a unified interface.

Key strengths:
- Multi-backend support with unified API
- Automatic synchronization capabilities
- Git integration for version control
- File locking for concurrent access control
- Comprehensive analytics and monitoring
- Complete UI library for end-user file browsing

The FilingUIManager library makes it easy to add file browsing capabilities to your applications without backend complexity. Whether you need a simple file browser or a complex dual-folder management system, the UI manager provides the foundation.

For more information, refer to the REST API documentation or view the service in action at `/services/filing/` when running the application.
