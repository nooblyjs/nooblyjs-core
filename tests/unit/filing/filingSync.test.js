/**
 * @fileoverview Unit tests for the filing sync layer: the metadata store,
 * git commit queue, local working store and the sync filing provider.
 *
 * Everything writes under .temp/tests/data/filing-sync; the sync provider is
 * exercised through the filing factory against a local "remote" provider.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('events');

const { MetadataStore, FileStates } = require('../../../src/filing/sync/MetadataStore');
const CommitQueue = require('../../../src/filing/sync/CommitQueue');
const LocalWorkingStore = require('../../../src/filing/sync/LocalWorkingStore');
const SyncFilingProvider = require('../../../src/filing/modules/filingSyncProvider');
const createFiling = require('../../../src/filing');
const { testDataDir } = require('../../helpers/testData');

let dir;
let events;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(testDataDir('filing-sync'), 'nooblyjs-sync-'));
  events = new EventEmitter();
  jest.spyOn(events, 'emit');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('MetadataStore', () => {
  it('persists metadata and reloads it', async () => {
    const store = new MetadataStore(path.join(dir, 'meta'), 'alice', events);
    await store.initialize();
    await store.initialize();
    await store.setFileState('a.md', FileStates.MODIFIED);
    await store.setRemoteTimestamp('a.md', '2026-01-01');

    const reloaded = new MetadataStore(path.join(dir, 'meta'), 'alice');
    await reloaded.initialize();
    expect(reloaded.getFileState('a.md')).toBe(FileStates.MODIFIED);
    expect(reloaded.getRemoteTimestamp('a.md')).toBe('2026-01-01');
    expect(reloaded.getFileState('none.md')).toBe(FileStates.DRAFT);
    expect(reloaded.getRemoteTimestamp('none.md')).toBeNull();
    expect(events.emit).toHaveBeenCalledWith('file:state:changed', { path: 'a.md', state: 'modified' });
  });

  it('rejects a corrupt metadata file', async () => {
    fs.mkdirSync(path.join(dir, 'bad'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'bad', 'metadata.json'), '{oops');
    await expect(new MetadataStore(path.join(dir, 'bad')).initialize()).rejects.toThrow('Failed to load metadata');
  });

  it('locks and unlocks files for the current and other users', async () => {
    const store = new MetadataStore(path.join(dir, 'meta'), 'alice', events);
    await store.initialize();

    await store.lockFile('mine.md');
    expect(store.isLockedByCurrentUser('mine.md')).toBe(true);
    expect(store.getFileState('mine.md')).toBe(FileStates.LOCKED_LOCAL);

    await store.lockFile('theirs.md', 'bob', 'Reviewing');
    expect(store.isLockedByOtherUser('theirs.md')).toBe(true);
    expect(store.getFileState('theirs.md')).toBe(FileStates.LOCKED_REMOTE);
    expect(store.getLockedFiles().map((f) => f.path)).toEqual(['mine.md', 'theirs.md']);

    await expect(store.unlockFile('theirs.md')).rejects.toThrow('locked by another user');
    await expect(store.unlockFile('free.md')).rejects.toThrow('not locked');
    await store.unlockFile('mine.md');
    expect(store.getFileState('mine.md')).toBe(FileStates.CLEAN);
    await store.unlockFile('theirs.md', 'bob');
    expect(events.emit).toHaveBeenCalledWith('file:unlocked', expect.objectContaining({ path: 'theirs.md' }));
  });

  it('groups files by state and removes entries', async () => {
    const store = new MetadataStore(path.join(dir, 'meta'), 'alice');
    await store.initialize();
    const states = Object.values(FileStates);
    for (const state of states) await store.setFileState(`${state}.md`, state);
    const status = store.getSyncStatus();
    expect(status.total).toBe(states.length);
    expect(status.conflict).toEqual(['conflict.md']);
    expect(status.lockedRemote).toEqual(['locked-remote.md']);
    expect(store.getFilesByState(FileStates.CLEAN)).toEqual(['clean.md']);
    await store.removeFile('clean.md');
    expect(store.getFileMetadata('clean.md')).toBeNull();
  });
});

describe('CommitQueue', () => {
  it('queues, completes and cancels commits per user', async () => {
    const queue = new CommitQueue(path.join(dir, 'queue'), events);
    const c1 = await queue.addPendingCommit(['a.md'], 'alice', { branch: 'main' });
    const c2 = await queue.addPendingCommit(['b.md', 'a.md'], 'alice');
    const c3 = await queue.addPendingCommit(['c.md'], 'bob');

    expect(queue.getPendingCount()).toBe(3);
    expect(queue.getPendingCountByUser('alice')).toBe(2);
    expect(queue.getPendingCommit(c1).metadata).toEqual({ branch: 'main' });
    expect(queue.getPendingCommit('nope')).toBeNull();
    expect(queue.getPendingCommitsByUser('bob').map((c) => c.id)).toEqual([c3]);

    const stats = queue.getQueueStats();
    expect(stats.userStats.alice.files.sort()).toEqual(['a.md', 'b.md']);
    expect(stats.oldestPending).toEqual(expect.any(Number));

    await expect(queue.completePendingCommit(c3, 'msg', 'alice')).rejects.toThrow('belongs to user bob');
    const done = await queue.completePendingCommit(c1, 'Add a', 'alice');
    expect(done.commitMessage).toBe('Add a');
    await expect(queue.completePendingCommit('nope', 'm', 'alice')).rejects.toThrow('not found');

    await expect(queue.cancelPendingCommit(c2, 'bob')).rejects.toThrow('belongs to user alice');
    await queue.cancelPendingCommit(c2, 'alice');
    await expect(queue.cancelPendingCommit('nope', 'alice')).rejects.toThrow('not found');
    expect(events.emit).toHaveBeenCalledWith('commit:cancelled', expect.objectContaining({ commitId: c2 }));

    const reloaded = new CommitQueue(path.join(dir, 'queue'));
    await reloaded.initialize();
    expect(reloaded.getAllPendingCommits().map((c) => c.id)).toEqual([c3]);

    await reloaded.clearAll();
    expect(reloaded.getPendingCount()).toBe(0);
    expect(reloaded.getQueueStats().oldestPending).toBeNull();
  });

  it('rejects a corrupt queue file', async () => {
    fs.mkdirSync(path.join(dir, 'q'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'q', 'pending-commits.json'), 'nope');
    await expect(new CommitQueue(path.join(dir, 'q')).initialize()).rejects.toThrow('Failed to load commit queue');
  });
});

describe('LocalWorkingStore', () => {
  it('creates, reads, lists, stats and deletes files', async () => {
    const store = new LocalWorkingStore(path.join(dir, 'work'), events);
    await store.create('docs/a.txt', 'hello');
    await store.update('docs/a.txt', 'hello 2');
    expect(await store.read('docs/a.txt', 'utf8')).toBe('hello 2');
    expect(await store.exists('docs/a.txt')).toBe(true);
    expect(await store.exists('docs/none.txt')).toBe(false);
    expect((await store.stat('docs/a.txt')).size).toBe(7);
    expect(typeof (await store.getModTime('docs/a.txt')).getTime()).toBe('number');

    const root = await store.list();
    expect(root).toEqual([expect.objectContaining({ name: 'docs', type: 'folder' })]);
    const docs = await store.list('docs');
    expect(docs).toEqual([expect.objectContaining({ name: 'a.txt', type: 'file', size: 7 })]);
    expect(await store.list('missing')).toEqual([]);

    await store.delete('docs/a.txt');
    expect(await store.exists('docs/a.txt')).toBe(false);
    expect(events.emit).toHaveBeenCalledWith('file:local:deleted', { path: 'docs/a.txt' });
  });

  it('refuses paths outside the working directory', async () => {
    const store = new LocalWorkingStore(path.join(dir, 'work'));
    await expect(store.read('../../etc/passwd')).rejects.toThrow();
  });
});

describe('SyncFilingProvider', () => {
  /** Builds a sync provider over a local "remote" directory. */
  function makeSync(extra = {}) {
    const remoteDir = path.join(dir, 'remote');
    fs.mkdirSync(remoteDir, { recursive: true });
    const LocalProvider = require('../../../src/filing/providers/filingLocal');
    const remoteProvider = new LocalProvider({ baseDir: remoteDir });
    const sync = new SyncFilingProvider({
      remoteProvider,
      workingDir: path.join(dir, 'work'),
      metadataDir: path.join(dir, 'meta'),
      userId: 'alice',
      autoSync: false,
      ...extra
    }, events);
    return { sync, remoteProvider, remoteDir };
  }

  it('requires a remote provider', () => {
    expect(() => new SyncFilingProvider({}, events)).toThrow('requires a remoteProvider');
  });

  it('creates drafts locally, pushes them and pulls remote files', async () => {
    const { sync, remoteDir } = makeSync();
    await sync.create('a.md', 'draft');
    expect((await sync.getSyncStatus()).draft).toEqual(['a.md']);

    await sync.pushFile('a.md');
    expect(fs.readFileSync(path.join(remoteDir, 'a.md'), 'utf8')).toBe('draft');
    expect((await sync.getSyncStatus()).clean).toEqual(['a.md']);

    await sync.update('a.md', 'edited');
    expect((await sync.getSyncStatus()).modified).toEqual(['a.md']);
    await sync.syncAll();
    expect(fs.readFileSync(path.join(remoteDir, 'a.md'), 'utf8')).toBe('edited');

    fs.writeFileSync(path.join(remoteDir, 'b.md'), 'remote only');
    expect(await sync.read('b.md', 'utf8')).toBe('remote only');
    expect(await sync.list()).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'b.md' })]));

    await sync.delete('b.md');
    expect(await sync.list()).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: 'b.md' })]));
    await expect(sync.pushFile('ghost.md')).rejects.toThrow('does not exist in local store');
  });

  it('enforces locks', async () => {
    const remoteLock = jest.fn(async () => { throw new Error('remote down'); });
    const { sync, remoteProvider } = makeSync();
    remoteProvider.lockFile = remoteLock;
    remoteProvider.unlockFile = jest.fn();

    await sync.create('l.md', 'x');
    await sync.lockFile('l.md', 'Editing');
    expect(events.emit).toHaveBeenCalledWith('sync:remote-lock-failed', expect.objectContaining({ path: 'l.md' }));
    await expect(sync.pullFile('l.md')).rejects.toThrow('locked locally');
    await sync.unlockFile('l.md');
    expect(remoteProvider.unlockFile).toHaveBeenCalledWith('l.md', 'alice');

    await sync.metadata.lockFile('other.md', 'bob');
    await expect(sync.create('other.md', 'x')).rejects.toThrow('locked by another user');
    await expect(sync.update('other.md', 'x')).rejects.toThrow('locked by another user');
    await expect(sync.delete('other.md')).rejects.toThrow('locked by another user');
    await expect(sync.lockFile('other.md')).rejects.toThrow('already locked by bob');
    await expect(sync.pushFile('other.md')).rejects.toThrow('locked by another user');
  });

  it('handles remote change notifications and conflicts', async () => {
    const { sync, remoteDir } = makeSync();
    fs.writeFileSync(path.join(remoteDir, 'r.md'), 'v1');
    await sync.create('mine.md', 'x');
    await sync.lockFile('mine.md');

    await sync.processRemoteChanges(['r.md', 'mine.md', 'gone.md']);
    expect(await sync.read('r.md', 'utf8')).toBe('v1');
    expect(sync.metadata.getFileState('mine.md')).toBe(FileStates.CONFLICT);
    expect(events.emit).toHaveBeenCalledWith('file:not-found-remote', { path: 'gone.md' });

    await sync.syncFile('mine.md');
    expect(events.emit).toHaveBeenCalledWith('sync:conflict', { path: 'mine.md' });
  });

  it('starts and stops auto sync', async () => {
    jest.useFakeTimers();
    try {
      const { sync } = makeSync({ autoSync: true, syncInterval: 1000 });
      await sync.initialize();
      expect(events.emit).toHaveBeenCalledWith('sync:auto-started', { interval: 1000 });
      sync.startAutoSync();
      sync.stopAutoSync();
      expect(events.emit).toHaveBeenCalledWith('sync:auto-stopped');
      sync.stopAutoSync();
    } finally {
      jest.useRealTimers();
    }
  });

  it('is created by the filing factory with a local remote', async () => {
    const filing = createFiling('sync', {
      remoteType: 'local',
      remoteOptions: { baseDir: path.join(dir, 'remote2') },
      workingDir: path.join(dir, 'work2'),
      metadataDir: path.join(dir, 'meta2'),
      autoSync: false
    }, events);
    expect(filing.providerType).toBe('sync');
    expect(() => createFiling('sync', {}, events)).toThrow('requires remoteType');
    expect(() => createFiling('sync', { remoteType: 'nope' }, events)).toThrow('Unsupported remote filing provider type');
  });
});
