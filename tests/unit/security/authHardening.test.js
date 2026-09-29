'use strict';

/**
 * @fileoverview Regression tests for the P0 security-hardening fixes:
 *  - P0-1: the Filing API requires authentication.
 *  - P0-2: passwords are hashed with bcrypt (with transparent legacy migration).
 *  - P0-3: session tokens, user IDs and API keys use a CSPRNG.
 */

// Use a low bcrypt cost in tests to keep the suite fast (set before the
// authservice module is required so it picks up the value). Production uses 12.
process.env.BCRYPT_COST = process.env.BCRYPT_COST || '6';

const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const createAuth = require('../../../src/authservice');
const filingRoutes = require('../../../src/filing/routes');
const {
  createApiKeyAuthMiddleware,
  generateApiKey,
  matchesAnyKey
} = require('../../../src/authservice/middleware/apiKey');

const VALID_KEY = 'k-123456789012345678901234567890';

const STRONG_PASSWORD = 'Str0ng!Pass#2026';

describe('P0-1 — Filing API authentication', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    const ee = new EventEmitter();
    const authMiddleware = createApiKeyAuthMiddleware(
      { apiKeys: ['secret-key-123'], requireApiKey: true },
      ee
    );
    const filing = {
      read: async () => 'data',
      list: async () => [],
      remove: async () => true,
      providerType: 'local'
    };
    filingRoutes(
      { 'express-app': app, authMiddleware, instanceName: 'default', providerType: 'local' },
      ee,
      filing
    );
  });

  const protectedRoutes = [
    ['get', '/services/filing/api/download/foo.txt'],
    ['post', '/services/filing/api/upload/foo.txt'],
    ['delete', '/services/filing/api/remove/foo.txt'],
    ['post', '/services/filing/api/git/push']
  ];

  it.each(protectedRoutes)('rejects unauthenticated %s %s with 401', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });

  it('rejects an invalid API key with 401', async () => {
    const res = await request(app)
      .get('/services/filing/api/download/foo.txt')
      .set('x-api-key', 'wrong');
    expect(res.status).toBe(401);
  });

  it('allows a request bearing a valid API key past the auth gate', async () => {
    const res = await request(app)
      .get('/services/filing/api/download/foo.txt')
      .set('x-api-key', 'secret-key-123');
    expect(res.status).not.toBe(401);
  });
});

describe('P0-2 — bcrypt password hashing', () => {
  let auth;

  beforeEach(() => {
    auth = createAuth('memory', {}, null);
  });

  it('stores new passwords as bcrypt hashes', async () => {
    await auth.createUser({ email: 'a@x.com', fullName: 'Alice', password: STRONG_PASSWORD });
    const stored = auth.users_.get('a@x.com').password;
    expect(stored.startsWith('$2')).toBe(true);
    expect(stored).not.toContain(STRONG_PASSWORD);
  });

  it('authenticates a valid password and rejects an invalid one', async () => {
    await auth.createUser({ email: 'a@x.com', fullName: 'Alice', password: STRONG_PASSWORD });
    await expect(auth.authenticateUser('a@x.com', STRONG_PASSWORD)).resolves.toBeDefined();
    await expect(auth.authenticateUser('a@x.com', 'wrong')).rejects.toThrow();
  });

  it('transparently upgrades a legacy SHA-256 hash to bcrypt on login', async () => {
    const legacyPassword = 'LegacyP@ss1!';
    const legacyHash = crypto.createHash('sha256').update(legacyPassword + 'salt').digest('hex');
    auth.users_.set('b@x.com', {
      id: crypto.randomBytes(8).toString('hex'),
      email: 'b@x.com',
      fullName: 'Bob',
      password: legacyHash,
      isActive: true,
      roles: ['user']
    });

    expect(auth.users_.get('b@x.com').password.startsWith('$2')).toBe(false);
    await auth.authenticateUser('b@x.com', legacyPassword);
    expect(auth.users_.get('b@x.com').password.startsWith('$2')).toBe(true);
    // Still able to log in with the upgraded hash.
    await expect(auth.authenticateUser('b@x.com', legacyPassword)).resolves.toBeDefined();
  });
});

describe('P0-3 — cryptographically secure identifiers', () => {
  it('generates unique 64-hex-char session tokens', async () => {
    const auth = createAuth('memory', {}, null);
    await auth.createUser({ email: 'a@x.com', fullName: 'Alice', password: STRONG_PASSWORD });
    const a = await auth.authenticateUser('a@x.com', STRONG_PASSWORD);
    await auth.createUser({ email: 'c@x.com', fullName: 'Carol', password: STRONG_PASSWORD });
    const b = await auth.authenticateUser('c@x.com', STRONG_PASSWORD);

    expect(a.session.token).toMatch(/^[0-9a-f]{64}$/);
    expect(b.session.token).toMatch(/^[0-9a-f]{64}$/);
    expect(a.session.token).not.toBe(b.session.token);
  });

  it('generates unique API keys of the requested length', () => {
    const k1 = generateApiKey();
    const k2 = generateApiKey();
    expect(k1).toHaveLength(32);
    expect(k2).toHaveLength(32);
    expect(k1).not.toBe(k2);
  });
});

describe('P1-5 — API key handling', () => {
  it('matchesAnyKey accepts a valid key and rejects others', () => {
    expect(matchesAnyKey(VALID_KEY, [VALID_KEY])).toBe(true);
    expect(matchesAnyKey('nope', [VALID_KEY])).toBe(false);
    expect(matchesAnyKey('', [VALID_KEY])).toBe(false);
    expect(matchesAnyKey(VALID_KEY, [])).toBe(false);
  });

  describe('middleware', () => {
    let app;
    beforeEach(() => {
      app = express();
      app.use(createApiKeyAuthMiddleware({ apiKeys: [VALID_KEY], requireApiKey: true }));
      app.get('/x', (req, res) => res.json({ ok: true }));
    });

    it('accepts the key via the x-api-key header', async () => {
      const res = await request(app).get('/x').set('x-api-key', VALID_KEY);
      expect(res.status).toBe(200);
    });

    it('rejects the key supplied via the query string (header-only)', async () => {
      const res = await request(app).get(`/x?api_key=${VALID_KEY}`);
      expect(res.status).toBe(401);
    });

    it('rejects an invalid key', async () => {
      const res = await request(app).get('/x').set('x-api-key', 'wrong');
      expect(res.status).toBe(401);
    });
  });
});
