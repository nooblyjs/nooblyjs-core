/**
 * @fileoverview Unit tests for the file-backed auth provider.
 *
 * Uses a temp data directory under .temp/tests/data/auth and covers first-run
 * admin bootstrap (generated or DEFAULT_ADMIN_PASSWORD), legacy users.json
 * migration, persistence of users, roles and sessions across restarts,
 * expired-session pruning, status and settings.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

// Low bcrypt cost keeps the suite fast; set before the provider loads.
process.env.BCRYPT_COST = process.env.BCRYPT_COST || '4';

const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('events');

const AuthFile = require('../../../src/authservice/providers/authFile');
const { testDataDir } = require('../../helpers/testData');

const PASSWORD = 'Str0ng!Pass#2026';

/** Creates a provider and waits for its async file initialisation. */
function open(dataDir, options = {}) {
  const events = new EventEmitter();
  jest.spyOn(events, 'emit');
  const ready = new Promise((resolve, reject) => {
    events.once('auth:file-storage-initialized', resolve);
    events.once('auth:file-storage-error', (e) => reject(new Error(e.error)));
  });
  const auth = new AuthFile({ dataDir, ...options }, events);
  return ready.then(() => ({ auth, events }));
}

describe('AuthFile', () => {
  const savedAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(testDataDir('auth'), 'nooblyjs-authfile-'));
    delete process.env.DEFAULT_ADMIN_PASSWORD;
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    if (savedAdminPassword === undefined) delete process.env.DEFAULT_ADMIN_PASSWORD;
    else process.env.DEFAULT_ADMIN_PASSWORD = savedAdminPassword;
  });

  it('bootstraps an admin with a generated password written to a private file', async () => {
    const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn() };
    const { auth, events } = await open(dir, { dependencies: { logging: logger } });

    const secretFile = path.join(dir, 'INITIAL_ADMIN_PASSWORD.txt');
    const contents = fs.readFileSync(secretFile, 'utf8');
    const password = contents.match(/password: (.*)\n/)[1];
    expect(password.length).toBe(20);
    if (process.platform !== 'win32') {
      expect(fs.statSync(secretFile).mode & 0o777).toBe(0o600);
    }
    const login = await auth.authenticateUser('admin@localhost', password);
    expect(login.user.roles).toContain('admin');
    expect(events.emit).toHaveBeenCalledWith('auth:default-admin-created', expect.any(Object));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('initial password written'), expect.any(Object));
  });

  it('uses DEFAULT_ADMIN_PASSWORD when set and writes no password file', async () => {
    process.env.DEFAULT_ADMIN_PASSWORD = PASSWORD;
    const { auth } = await open(dir);
    expect(fs.existsSync(path.join(dir, 'INITIAL_ADMIN_PASSWORD.txt'))).toBe(false);
    await expect(auth.authenticateUser('admin@localhost', PASSWORD)).resolves.toEqual(expect.objectContaining({ user: expect.any(Object) }));
  });

  it('persists users, roles and sessions across restarts', async () => {
    process.env.DEFAULT_ADMIN_PASSWORD = PASSWORD;
    const first = await open(dir);
    await first.auth.createUser({ email: 'u@x.com', fullName: 'U', password: PASSWORD });
    await first.auth.updateUser('u@x.com', { fullName: 'U2' });
    const { session } = await first.auth.authenticateUser('u@x.com', PASSWORD);

    const second = await open(dir);
    expect((await second.auth.getUser('u@x.com')).fullName).toBe('U2');
    expect((await second.auth.validateSession(session.token)).email).toBe('u@x.com');
    expect(fs.existsSync(path.join(dir, 'roles.json'))).toBe(true);

    await second.auth.logout(session.token);
    await second.auth.deleteUser('u@x.com');
    const third = await open(dir);
    await expect(third.auth.validateSession(session.token)).rejects.toThrow('Invalid session');
    await expect(third.auth.getUser('u@x.com')).rejects.toThrow();
  });

  it('migrates legacy user records and prunes expired sessions on load', async () => {
    const now = Date.now();
    fs.writeFileSync(path.join(dir, 'users.json'), JSON.stringify({
      legacy: { username: 'Legacy', role: 'admin', password: 'x' },
      'bare@x.com': { email: 'bare@x.com', password: 'x' }
    }));
    fs.writeFileSync(path.join(dir, 'sessions.json'), JSON.stringify({
      live: { email: 'bare@x.com', createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 60000).toISOString() },
      dead: { email: 'bare@x.com', createdAt: new Date(now - 120000).toISOString(), expiresAt: new Date(now - 60000).toISOString() }
    }));

    const { auth } = await open(dir);
    const users = JSON.parse(fs.readFileSync(path.join(dir, 'users.json'), 'utf8'));
    expect(users.legacy).toEqual(expect.objectContaining({ email: 'legacy', fullName: 'Legacy', roles: ['admin'] }));
    expect(users.legacy.username).toBeUndefined();
    expect(users['bare@x.com'].roles).toEqual(['user']);
    expect(fs.existsSync(path.join(dir, 'INITIAL_ADMIN_PASSWORD.txt'))).toBe(false);

    const sessions = JSON.parse(fs.readFileSync(path.join(dir, 'sessions.json'), 'utf8'));
    expect(Object.keys(sessions)).toEqual(['live']);
    await expect(auth.validateSession('dead')).rejects.toThrow('Invalid session');
  });

  it('expires sessions at validation time', async () => {
    process.env.DEFAULT_ADMIN_PASSWORD = PASSWORD;
    const { auth } = await open(dir);
    const { session } = await auth.authenticateUser('admin@localhost', PASSWORD);
    auth.sessions_.get(session.token).expiresAt = new Date(Date.now() - 1000);
    await expect(auth.validateSession(session.token)).rejects.toThrow('Session expired');
    expect(auth.sessions_.has(session.token)).toBe(false);
  });

  it('reports a corrupt users file as a storage error', async () => {
    fs.writeFileSync(path.join(dir, 'users.json'), '{broken');
    await expect(open(dir)).rejects.toThrow();
  });

  it('reports status and saves settings', async () => {
    process.env.DEFAULT_ADMIN_PASSWORD = PASSWORD;
    const { auth, events } = await open(dir);
    const status = await auth.getStatus();
    expect(status).toEqual(expect.objectContaining({ provider: 'file', persistent: true, filesStatus: 'accessible' }));
    await auth.saveSettings({ datadir: '/elsewhere' });
    expect((await auth.getSettings()).datadir).toBe('/elsewhere');
    expect(events.emit).toHaveBeenCalledWith('auth:setting-changed', { setting: 'datadir', value: '/elsewhere' });
    expect((await auth.getStatus()).filesStatus).toBe('inaccessible');
  });
});
