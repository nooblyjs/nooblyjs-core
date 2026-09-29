/**
 * @fileoverview Unit tests for the global Express error handler.
 *
 * Verifies status-code mapping, request-id propagation, logging through the
 * app logger (or console when none is set), and that production responses
 * never expose raw error messages or stacks.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const request = require('supertest');

const errorHandler = require('../../../src/middleware/errorHandler');

/** Builds an app whose only route throws the given error. */
function appThrowing(error, logger) {
  const app = express();
  if (logger) app.set('logger', logger);
  app.get('/boom', (req, res, next) => next(error));
  app.use(errorHandler);
  return app;
}

/** Creates an Error with extra properties. */
function err(message, props = {}) {
  return Object.assign(new Error(message), props);
}

describe('errorHandler', () => {
  const originalEnv = process.env.NODE_ENV;
  let logger;

  beforeEach(() => {
    logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it.each([
    [err('x', { status: 418 }), 418],
    [err('x', { statusCode: 409 }), 409],
    [err('CIRCUIT_BREAKER_OPEN'), 503],
    [err('x', { name: 'ValidationError' }), 422],
    [err('x', { name: 'UnauthorizedError' }), 401],
    [err('x', { code: 'UNAUTHORIZED' }), 401],
    [err('x', { name: 'ForbiddenError' }), 403],
    [err('x', { code: 'FORBIDDEN' }), 403],
    [err('connect ECONNREFUSED 127.0.0.1'), 503],
    [err('request timeout'), 504],
    [err('x', { code: 'ETIMEDOUT' }), 504],
    [err('plain failure'), 500]
  ])('maps %p to %i', async (error, status) => {
    await request(appThrowing(error, logger)).get('/boom').expect(status);
  });

  it('includes debugging detail outside production and logs by severity', async () => {
    process.env.NODE_ENV = 'test';
    const res = await request(appThrowing(err('bad thing', { code: 'E1', details: { f: 1 } }), logger))
      .get('/boom')
      .set('x-request-id', 'req-42')
      .expect(500);
    expect(res.body.error).toEqual(expect.objectContaining({
      message: 'bad thing', requestId: 'req-42', code: 'E1', details: { f: 1 }, stack: expect.any(String)
    }));
    expect(logger.error).toHaveBeenCalled();

    await request(appThrowing(err('nope', { status: 404 }), logger)).get('/boom').expect(404);
    expect(logger.warn).toHaveBeenCalled();

    await request(appThrowing(err('fine', { status: 302 }), logger)).get('/boom').expect(302);
    expect(logger.info).toHaveBeenCalled();
  });

  it.each([
    ['database exploded at /var/lib/secret', 'Database service unavailable.'],
    ['permission denied on /etc', 'You do not have permission to access this resource.'],
    ['something internal', 'An error occurred processing your request. Please contact support with the request ID.']
  ])('replaces "%s" with a safe message in production', async (message, safe) => {
    process.env.NODE_ENV = 'production';
    const res = await request(appThrowing(err(message), logger)).get('/boom');
    expect(res.body.error.message).toBe(safe);
    expect(res.body.error.stack).toBeUndefined();
    expect(res.body.error.requestId).toMatch(/^req_/);
  });

  it('falls back to console logging without an app logger', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await request(appThrowing(err('server'))).get('/boom').expect(500);
    expect(errorSpy).toHaveBeenCalled();
    await request(appThrowing(err('client', { status: 400 }))).get('/boom').expect(400);
    expect(warnSpy).toHaveBeenCalled();
  });
});
