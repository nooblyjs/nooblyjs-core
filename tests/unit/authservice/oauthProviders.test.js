/**
 * @fileoverview Unit tests for the Google OAuth and Azure AD (Entra ID)
 * auth providers.
 *
 * No identity provider is contacted: passport.authenticate is replaced with
 * a stub that invokes the provider's callback, so the tests cover user
 * provisioning, session creation, return-URL handling (including open
 * redirect protection for Azure), error paths and the guard helpers.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

process.env.BCRYPT_COST = process.env.BCRYPT_COST || '4';

const EventEmitter = require('events');
const passport = require('passport');

const AuthGoogle = require('../../../src/authservice/providers/authGoogle');
const AuthAzure = require('../../../src/authservice/providers/authAzure');

/** A passport.authenticate stub whose verify outcome the test controls. */
function stubAuthenticate(target, outcome) {
  return jest.spyOn(target, 'authenticate').mockImplementation((strategy, optsOrCb) => (req, res, next) => {
    if (typeof optsOrCb === 'function') {
      optsOrCb(outcome.err || null, outcome.user || null, outcome.info);
    } else {
      res.redirected = strategy;
    }
  });
}

/** Minimal request double with Passport's logIn. */
const makeReq = (extra = {}) => ({
  query: {},
  body: {},
  session: {},
  logIn: jest.fn((user, cb) => cb(extra.loginError || null)),
  ...extra
});

/** Runs a guard middleware and reports the outcome. */
function runGuard(guard, req) {
  const res = { status: jest.fn(function status(code) { this.code = code; return this; }), json: jest.fn() };
  const next = jest.fn();
  guard(req, res, next);
  return { code: res.code, next: next.mock.calls.length > 0 };
}

describe('AuthGoogle', () => {
  let events;

  beforeEach(() => {
    events = new EventEmitter();
    jest.spyOn(events, 'emit');
  });

  afterEach(() => jest.restoreAllMocks());

  it('reports missing OAuth configuration', async () => {
    const auth = new AuthGoogle({}, events);
    expect(events.emit).toHaveBeenCalledWith('auth:google-config-missing', expect.any(Object));
    expect((await auth.getStatus()).configured).toBe(false);
  });

  it('provisions a user on first login and updates them afterwards', async () => {
    const auth = new AuthGoogle({ clientID: 'id', clientSecret: 'secret' }, events);
    const profile = { id: 'g1', displayName: 'Ada', emails: [{ value: 'ada@x.com' }] };

    const first = await auth.handleGoogleAuth_(profile, 'at', 'rt', '/services/caching');
    expect(first.user).toEqual(expect.objectContaining({ email: 'ada@x.com', fullName: 'Ada' }));
    expect(first.redirectUrl).toBe('/services/caching');
    expect((await auth.validateSession(first.session.token)).provider).toBe('google');

    const again = await auth.handleGoogleAuth_({ ...profile, displayName: 'Ada L' }, 'at2', 'rt2');
    expect(again.redirectUrl).toBe('/services');
    expect((await auth.getUser('ada@x.com')).fullName).toBe('Ada L');
    expect(events.emit).toHaveBeenCalledWith('auth:google-login', expect.objectContaining({ email: 'ada@x.com' }));
    expect((await auth.getStatus())).toEqual(expect.objectContaining({ provider: 'google', configured: true }));
  });

  it('starts the OAuth flow and remembers the return URL', () => {
    const auth = new AuthGoogle({ clientID: 'id', clientSecret: 'secret' }, events);
    stubAuthenticate(passport, {});
    const req = makeReq({ query: { returnUrl: '/services/x' }, session: undefined });
    const res = {};
    auth.initiateGoogleAuth(req, res, jest.fn());
    expect(res.redirected).toBe('google');
    expect(req.session.oauthReturnUrl).toBe('/services/x');
  });

  it('completes the callback, preferring the verify redirect over the stored one', async () => {
    const auth = new AuthGoogle({ clientID: 'id', clientSecret: 'secret' }, events);
    const user = { email: 'ada@x.com' };

    stubAuthenticate(passport, { user, info: { session: { token: 't' } } });
    const req = makeReq({ session: { oauthReturnUrl: '/services/y' } });
    const result = await auth.handleGoogleCallback(req, {}, jest.fn());
    expect(result).toEqual({ user, session: { token: 't' }, redirectUrl: '/services/y' });
    expect(req.session.oauthReturnUrl).toBeUndefined();

    passport.authenticate.mockRestore();
    stubAuthenticate(passport, { user, info: { session: {}, redirectUrl: '/from-verify' } });
    expect((await auth.handleGoogleCallback(makeReq(), {}, jest.fn())).redirectUrl).toBe('/from-verify');
  });

  it('rejects failed callbacks', async () => {
    const auth = new AuthGoogle({ clientID: 'id', clientSecret: 'secret' }, events);
    stubAuthenticate(passport, { err: new Error('denied') });
    await expect(auth.handleGoogleCallback(makeReq(), {}, jest.fn())).rejects.toThrow('denied');

    passport.authenticate.mockRestore();
    stubAuthenticate(passport, {});
    await expect(auth.handleGoogleCallback(makeReq(), {}, jest.fn())).rejects.toThrow('Google authentication failed');

    passport.authenticate.mockRestore();
    stubAuthenticate(passport, { user: { email: 'a' }, info: {} });
    await expect(auth.handleGoogleCallback(makeReq({ loginError: new Error('session') }), {}, jest.fn())).rejects.toThrow('session');
  });

  it('refuses to start without passport', async () => {
    const auth = new AuthGoogle({}, events);
    auth.passport_ = null;
    expect(() => auth.initiateGoogleAuth(makeReq(), {}, jest.fn())).toThrow('Google OAuth not available');
    await expect(auth.handleGoogleCallback(makeReq(), {}, jest.fn())).rejects.toThrow('Google OAuth not available');
  });

  it('guards routes by authentication and role', () => {
    const auth = new AuthGoogle({}, events);
    expect(runGuard(auth.requireAuth.bind(auth), { isAuthenticated: () => false }).code).toBe(401);
    expect(runGuard(auth.requireAuth.bind(auth), { isAuthenticated: () => true }).next).toBe(true);
    const adminOnly = auth.requireRole('admin');
    expect(runGuard(adminOnly, {}).code).toBe(401);
    expect(runGuard(adminOnly, { user: { role: 'user' } }).code).toBe(403);
    expect(runGuard(adminOnly, { user: { roles: ['admin'] } }).next).toBe(true);
    expect(auth.getPassport()).toBe(passport);
  });
});

describe('AuthAzure', () => {
  const CONFIG = { clientID: 'cid', clientSecret: 'sec', tenantID: 'tenant', baseUrl: 'https://app.test/' };
  let events;
  let fakePassport;

  beforeEach(() => {
    events = new EventEmitter();
    jest.spyOn(events, 'emit');
    fakePassport = {
      _serializers: [],
      strategies: [],
      use: jest.fn(function use(strategy) { this.strategies.push(strategy); }),
      serializeUser: jest.fn(function serialize(fn) { this.serialize = fn; }),
      deserializeUser: jest.fn(function deserialize(fn) { this.deserialize = fn; }),
      initialize: jest.fn(() => (req, res, next) => next()),
      session: jest.fn(() => (req, res, next) => next()),
      authenticate: jest.fn()
    };
  });

  const make = (extra = {}) => new AuthAzure({ ...CONFIG, passport: fakePassport, ...extra }, events);

  it('reports missing configuration', async () => {
    const saved = ['AZURE_AD_CLIENT_ID', 'AZURE_AD_SECRET', 'AZURE_AD_TENANT_ID'].map((k) => [k, process.env[k]]);
    saved.forEach(([k]) => delete process.env[k]);
    try {
      const auth = new AuthAzure({ passport: fakePassport }, events);
      expect(events.emit).toHaveBeenCalledWith('auth:azure-config-missing', expect.any(Object));
      expect((await auth.getStatus()).configured).toBe(false);
    } finally {
      saved.forEach(([k, v]) => { if (v !== undefined) process.env[k] = v; });
    }
  });

  it('registers the OIDC strategy with a callback URL derived from baseUrl', () => {
    const auth = make({ 'express-app': { use: jest.fn() } });
    expect(auth.callbackURL_).toBe('https://app.test/services/authservice/openid');
    expect(auth.buildIdentityMetadata_()).toBe('https://login.microsoftonline.com/tenant/v2.0/.well-known/openid-configuration');
    expect(fakePassport.strategies).toHaveLength(1);
    expect(fakePassport.initialize).toHaveBeenCalled();
  });

  it('serialises users by email', async () => {
    const auth = make();
    await auth.createUser({ email: 's@x.com', fullName: 'S', password: 'Str0ng!Pass#2026' });
    const done = jest.fn();
    fakePassport.serialize({ email: 's@x.com' }, done);
    expect(done).toHaveBeenCalledWith(null, 's@x.com');
    fakePassport.serialize({}, done);
    expect(done).toHaveBeenLastCalledWith(expect.any(Error));

    await new Promise((resolve) => fakePassport.deserialize('s@x.com', (err, user) => { expect(user.email).toBe('s@x.com'); resolve(); }));
    await new Promise((resolve) => fakePassport.deserialize('', (err) => { expect(err).toBeInstanceOf(Error); resolve(); }));
  });

  it('extracts the email from the various profile shapes', () => {
    const auth = make();
    expect(auth.extractEmail_(null)).toBeNull();
    expect(auth.extractEmail_({ _json: { preferred_username: 'a@x.com' } })).toBe('a@x.com');
    expect(auth.extractEmail_({ emails: [{ value: 'b@x.com' }] })).toBe('b@x.com');
    expect(auth.extractEmail_({ emails: ['c@x.com'] })).toBe('c@x.com');
    expect(auth.extractEmail_({ upn: 'd@x.com' })).toBe('d@x.com');
    expect(auth.extractEmail_({})).toBeNull();
  });

  it('provisions users (normalising the email) and creates sessions', async () => {
    const auth = make();
    const profile = { oid: 'o1', displayName: 'Ada', _json: { preferred_username: ' Ada@X.com ' } };
    const result = await auth.handleAzureAuth_(profile, 'at', 'rt', '/services/x');
    expect(result.user.email).toBe('ada@x.com');
    expect(result.redirectUrl).toBe('/services/x');
    expect((await auth.validateSession(result.session.token)).provider).toBe('azure');
    await auth.handleAzureAuth_(profile, 'at', 'rt');
    expect((await auth.getUser('ada@x.com')).azureId).toBe('o1');
    await expect(auth.handleAzureAuth_({}, 'at', 'rt')).rejects.toThrow('did not contain an email');
  });

  it('only keeps same-origin relative return URLs', () => {
    const auth = make();
    expect(auth.sanitizeReturnUrl_('/services/a?b=1')).toBe('/services/a?b=1');
    for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', '', null, 42]) {
      expect(auth.sanitizeReturnUrl_(bad)).toBeNull();
    }

    fakePassport.authenticate.mockImplementation(() => () => {});
    const unsafe = makeReq({ query: { returnUrl: '//evil.test' } });
    auth.initiateAzureAuth(unsafe, {}, jest.fn());
    expect(unsafe.session.oauthReturnUrl).toBeUndefined();
    const safe = makeReq({ query: { returnUrl: '/services/ok' }, session: undefined });
    auth.initiateAzureAuth(safe, {}, jest.fn());
    expect(safe.session.oauthReturnUrl).toBe('/services/ok');
  });

  it('completes and rejects callbacks', async () => {
    const auth = make();
    auth.logger = { error: jest.fn(), warn: jest.fn() };
    const user = { email: 'a@x.com' };

    stubAuthenticate(fakePassport, { user, info: { session: { token: 't' } } });
    const req = makeReq({ session: { oauthReturnUrl: '/services/back' } });
    expect(await auth.handleAzureCallback(req, {}, jest.fn())).toEqual({ user, session: { token: 't' }, redirectUrl: '/services/back' });

    fakePassport.authenticate.mockReset();
    stubAuthenticate(fakePassport, {});
    await expect(auth.handleAzureCallback(makeReq({ body: { error: 'access_denied', error_description: 'User cancelled' } }), {}, jest.fn()))
      .rejects.toThrow('User cancelled');
    await expect(auth.handleAzureCallback(makeReq(), {}, jest.fn())).rejects.toThrow('no user returned');

    fakePassport.authenticate.mockReset();
    stubAuthenticate(fakePassport, { err: new Error('bad state') });
    await expect(auth.handleAzureCallback(makeReq(), {}, jest.fn())).rejects.toThrow('bad state');
    expect(auth.logger.error).toHaveBeenCalled();
  });

  it('guards routes and reports status', async () => {
    const auth = make();
    expect(runGuard(auth.requireAuth.bind(auth), {}).code).toBe(401);
    expect(runGuard(auth.requireRole(['admin', 'ops']), { user: { roles: ['ops'] } }).next).toBe(true);
    expect(await auth.getStatus()).toEqual(expect.objectContaining({ provider: 'azure', configured: true, tenantConfigured: true }));
    auth.passport_ = null;
    expect(() => auth.initiateAzureAuth(makeReq(), {}, jest.fn())).toThrow('not available');
  });
});
