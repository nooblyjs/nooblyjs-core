# Filing Service (`src/filing/`)

**Dependency level:** 3 – Application
**Dependencies:** `logging`, `queueing`, `dataservice`

Provides a unified file operation interface across multiple storage backends. The `FilingService` wrapper class exposes all provider operations through a consistent API regardless of whether files are stored locally, on FTP, in S3, in Git, or in GCP Storage.

---

## Factory (`src/filing/index.js`)

```javascript
const filing = registry.filing('local', { baseDir: './.application/data' });
const s3Filing = registry.filing('s3', { bucket: 'my-bucket', region: 'us-east-1' });
```

### `createFilingService(type, options, eventEmitter)` → `FilingService`

| `type` value | Provider class | Backend |
|---|---|---|
| `'local'` (default) | `LocalFilingProvider` | Local filesystem |
| `'ftp'` | `FtpFilingProvider` | FTP server |
| `'s3'` | `S3FilingProvider` | AWS S3 |
| `'git'` | `GitFilingProvider` | Git repository |
| `'gcp'` | `GCPFilingProvider` | GCP Cloud Storage |
| `'api'` | `FilingApiProvider` | Remote HTTP file API |
| `'sync'` | `SyncFilingProvider` | Local mirror + remote sync |

**Providers are lazy-loaded** to avoid loading AWS/GCP SDKs when not needed.

**Sync provider** requires `options.remoteType` and optionally `options.remoteOptions`. It instantiates a `remoteProvider` (any supported type) and passes both to `SyncFilingProvider`.

**After creating the provider:**
1. Wraps it in `new FilingService(provider, eventEmitter)`.
2. Injects `logger` with `service.log()` helper.
3. Injects `service.dependencies`, `service.providerType`, `service.instanceName`.
4. Registers REST routes, dashboard view, and client-side scripts.

---

## FilingService Wrapper (`src/filing/index.js` – `FilingService` class)

All methods delegate to `this.provider` and track analytics where applicable.

### Core File Operations

#### `async create(path, content)` → `void`

Creates a new file at `path` with the given `content` (Buffer, ReadableStream, or string).
Tracks via `analytics.trackWrite(path)`.

#### `async upload(path, content)` → `void`

Alias for `create()`. Provided for semantic clarity when uploading remote files.

#### `async read(path, encoding?)` → `Buffer | string`

Reads file content. Optional `encoding` (e.g. `'utf8'`, `'base64'`). Returns Buffer if no encoding.
Tracks via `analytics.trackRead(path)`.

#### `async download(path, encoding?)` → `Buffer | string`

Alias for `read()`.

#### `async delete(path)` → `void`

Deletes a file at `path`.
Tracks via `analytics.trackDelete(path)`.

#### `async remove(path)` → `void`

Alias for `delete()`.

#### `async list(path)` → `string[]`

Lists files/directories at `path`. Returns array of names.

#### `async update(path, content)` → `void`

Updates file content.
Tracks via `analytics.trackWrite(path)`.

---

### Settings

#### `async getSettings()` / `async saveSettings(settings)`

Delegated to the underlying provider.

---

### Sync Provider Methods (sync provider only)

These methods throw `Error('not supported by this provider')` if called on a non-sync provider.

#### `async lockFile(path, reason?)` → `void`

Locks a file for exclusive editing. Prevents other processes from modifying it.

#### `async unlockFile(path)` → `void`

Releases a file lock.

#### `async pushFile(path)` → `void`

Pushes a single file to the remote repository.

#### `async pullFile(path)` → `void`

Pulls a single file from the remote repository.

#### `async syncFile(path)` → `void`

Synchronizes a specific file.

#### `async syncAll()` → `void`

Synchronizes all files.

#### `async processRemoteChanges(changedFiles)` → `void`

Handles notifications of remote file changes. `changedFiles` is an array of file paths.

#### `async getSyncStatus()` → `Object`

Returns current sync status information.

#### `startAutoSync()` / `stopAutoSync()`

Starts/stops automatic synchronization polling.

---

### Git Provider Methods (git provider only)

#### `async commitWithMessage(commitId, commitMessage, userId?)` → `Object`

Finalizes a pending commit with a user-provided message.

#### `async push()` → `Object`

Pushes committed changes to the remote repository.

#### `async fetch()` → `void`

Fetches changes from the remote repository.

#### `async getGitStatus()` → `Object`

Returns Git repository status (modified files, staged changes, etc.).

#### `getPendingCommits(userId?)` → `Object[]`

Returns commits that are staged but waiting for commit messages.

#### `async cancelCommit(commitId, userId?)` → `void`

Cancels a pending commit.

#### `startAutoFetch()` / `stopAutoFetch()`

Starts/stops automatic fetching from the remote.

---

## Local Provider (`src/filing/providers/filingLocal.js`)

Stores files on the local filesystem. Uses Node.js `fs` module.

**Key options:**
- `baseDir` – base directory for all file operations (default: `./.application/files`)
- `dataDir` – alternative to `baseDir`

All paths are resolved relative to `baseDir`.

---

## S3 Provider (`src/filing/providers/filingS3.js`)

Uses AWS SDK v3 `@aws-sdk/client-s3`. Reads and writes to an S3 bucket.

**Key options:** `bucket`, `region`, `accessKeyId`, `secretAccessKey`

---

## FTP Provider (`src/filing/providers/filingFtp.js`)

Uses the `basic-ftp` package for FTP connectivity.

**Key options:** `host`, `port`, `user`, `password`, `secure`

---

## Git Provider (`src/filing/providers/filingGit.js`)

Wraps `simple-git` to provide file versioning through a Git repository.

Features:
- Tracks pending commits (write → stage → await commit message → push).
- Supports auto-fetch from remote on a configurable interval.

---

## GCP Provider (`src/filing/providers/filingGCP.js`)

Uses `@google-cloud/storage` for GCP Cloud Storage operations.

**Key options:** `projectId`, `bucket`, `keyFilename`

---

## Sync Provider (`src/filing/providers/filingSyncProvider.js`) / `src/filing/modules/filingSyncProvider.js`

Maintains a local working copy and synchronizes with a remote provider. Uses:
- `CommitQueue` (`src/filing/sync/CommitQueue.js`) – queues write operations.
- `LocalWorkingStore` (`src/filing/sync/LocalWorkingStore.js`) – manages the local mirror.
- `MetadataStore` (`src/filing/sync/MetadataStore.js`) – tracks file metadata and sync state.

---

## Analytics (`src/filing/modules/analytics.js`)

Module-level singleton tracking:
- Read, write, delete operation counts
- Per-path access frequency

---

## Routes

Mounted at `/services/filing/api/`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/services/filing/api/status` | Service status |
| `GET` | `/services/filing/api/list` | List files (query: `?path=`) |
| `GET` | `/services/filing/api/read` | Read file content (query: `?path=`) |
| `POST` | `/services/filing/api/create` | Create/upload file |
| `PUT` | `/services/filing/api/update` | Update file |
| `DELETE` | `/services/filing/api/delete` | Delete file |
| `GET` | `/services/filing/api/browse` | Browse directory |
| `POST` | `/services/filing/api/settings` | Update settings |

Multi-instance routes use the `instanceName` to route to the correct FilingService instance.

---

## Client-Side Script (`src/filing/scripts/js/index.js`)

Browser-loadable class for file manager UI interactions.

---

## Usage

```javascript
// Write a file
await filing.create('reports/monthly.json', JSON.stringify(reportData));

// Read it back
const raw = await filing.read('reports/monthly.json', 'utf8');
const report = JSON.parse(raw);

// List a directory
const files = await filing.list('reports/');

// Delete
await filing.delete('reports/monthly.json');

// Sync provider: lock before editing
await filing.lockFile('config/settings.json', 'editing settings');
await filing.update('config/settings.json', newContent);
await filing.unlockFile('config/settings.json');
await filing.syncAll();
```
