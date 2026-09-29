/**
 * @fileoverview Unit tests for the user-token branch of the API key middleware.
 *
 * These cover the Phase 2 wiring: when a `validateApiToken` resolver is
 * supplied, a presented `dtk_` personal access token authenticates as the
 * owning user. The static-key and session branches remain synchronous and are
 * exercised by apiKeyAuth.test.js.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const EventEmitter = require('events');
const { createApiKeyAuthMiddleware } = require('../../../src/authservice/middleware');

/** Flush pending microtasks/macrotasks so the async token branch settles. */
const flush = () => new Promise(resolve => setImmediate(resolve));

describe('API key middleware — user token branch', () => {
  let eventEmitter;
  let req;
  let res;
  let next;
  const VALID_TOKEN = 'dtk_' + 'a'.repeat(64);

  beforeEach(() => {
    eventEmitter = new EventEmitter();
    jest.spyOn(eventEmitter, 'emit');
    req = {
      headers: {},
      query: {},
      path: '/services/caching/api/put/test',
      method: 'POST',
      ip: '127.0.0.1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  it('accepts a valid dtk_ token and exposes the owner identity', async () => {
    const validateApiToken = jest.fn().mockResolvedValue({
      email: 'user@example.com',
      roles: ['user', 'admin'],
      user: { id: 'u1', email: 'user@example.com', roles: ['user', 'admin'] },
      token: { id: 'tok_123' }
    });
    const middleware = createApiKeyAuthMiddleware(
      { apiKeys: ['static-key-1234567890'], validateApiToken },
      eventEmitter
    );
    req.headers.authorization = `Bearer ${VALID_TOKEN}`;

    middleware(req, res, next);
    await flush();

    expect(validateApiToken).toHaveBeenCalledWith(VALID_TOKEN);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.userEmail).toBe('user@example.com');
    expect(req.userRoles).toEqual(['user', 'admin']);
    expect(req.authToken).toBe(VALID_TOKEN);
    expect(req.tokenAuth).toBe(true);
    expect(req.apiTokenId).toBe('tok_123');
    expect(eventEmitter.emit).toHaveBeenCalledWith('api-auth-success',
      expect.objectContaining({ via: 'token', email: 'user@example.com' }));
  });

  it('also accepts the token via the x-api-key header', async () => {
    const validateApiToken = jest.fn().mockResolvedValue({
      email: 'user@example.com',
      roles: ['user'],
      user: { email: 'user@example.com', roles: ['user'] },
      token: { id: 'tok_9' }
    });
    const middleware = createApiKeyAuthMiddleware({ apiKeys: [], validateApiToken }, eventEmitter);
    req.headers['x-api-key'] = VALID_TOKEN;

    middleware(req, res, next);
    await flush();

    expect(next).toHaveBeenCalled();
    expect(req.userEmail).toBe('user@example.com');
  });

  it('returns 401 INVALID_TOKEN when the validator rejects (expired/unknown)', async () => {
    const validateApiToken = jest.fn().mockRejectedValue(new Error('API token expired'));
    const middleware = createApiKeyAuthMiddleware({ apiKeys: [], validateApiToken }, eventEmitter);
    req.headers.authorization = `Bearer ${VALID_TOKEN}`;

    middleware(req, res, next);
    await flush();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN' }));
    expect(eventEmitter.emit).toHaveBeenCalledWith('api-auth-failure',
      expect.objectContaining({ reason: 'invalid-token' }));
  });

  it('returns 401 INVALID_TOKEN when the validator resolves falsy', async () => {
    const validateApiToken = jest.fn().mockResolvedValue(null);
    const middleware = createApiKeyAuthMiddleware({ apiKeys: [], validateApiToken }, eventEmitter);
    req.headers.authorization = `Bearer ${VALID_TOKEN}`;

    middleware(req, res, next);
    await flush();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN' }));
  });

  it('treats a dtk_ token as an invalid API key when no validator is configured', () => {
    const middleware = createApiKeyAuthMiddleware({ apiKeys: ['static-key-1234567890'] }, eventEmitter);
    req.headers.authorization = `Bearer ${VALID_TOKEN}`;

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_API_KEY' }));
  });

  it('does not invoke the token validator for a static API key', () => {
    const validateApiToken = jest.fn();
    const middleware = createApiKeyAuthMiddleware(
      { apiKeys: ['static-key-1234567890'], validateApiToken },
      eventEmitter
    );
    req.headers['x-api-key'] = 'static-key-1234567890';

    middleware(req, res, next);

    expect(validateApiToken).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(req.apiKey).toBe('static-key-1234567890');
  });
});
