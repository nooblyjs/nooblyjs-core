'use strict';

/**
 * @fileoverview Regression tests for P1-3 — brute-force protection on login.
 */

process.env.BCRYPT_COST = process.env.BCRYPT_COST || '6';
// Small thresholds so the test is fast and deterministic.
process.env.LOGIN_LOCK_THRESHOLD = '3';
process.env.LOGIN_RATE_LIMIT_MAX = '50';

const express = require('express');
const request = require('supertest');
const { EventEmitter } = require('events');

const createAuth = require('../../../src/authservice');
const authRoutes = require('../../../src/authservice/routes');

describe('P1-3 — login brute-force protection', () => {
  let app;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    const ee = new EventEmitter();
    const auth = createAuth('memory', {}, ee);
    await auth.createUser({ email: 'a@x.com', fullName: 'Alice', password: 'Str0ng!Pass#2026' });
    authRoutes({ 'express-app': app }, ee, auth);
  });

  it('locks the account after repeated failures and returns 429', async () => {
    const login = (password) =>
      request(app).post('/services/authservice/api/login').send({ email: 'a@x.com', password });

    // 3 failures reach the lock threshold.
    expect((await login('wrong1')).status).toBe(401);
    expect((await login('wrong2')).status).toBe(401);
    expect((await login('wrong3')).status).toBe(401);

    // Now locked — even the correct password is refused with 429 + Retry-After.
    const locked = await login('Str0ng!Pass#2026');
    expect(locked.status).toBe(429);
    expect(locked.headers['retry-after']).toBeDefined();
  });

  it('does not lock a different account', async () => {
    const ee = new EventEmitter();
    const auth = createAuth('memory', {}, ee);
    await auth.createUser({ email: 'c@x.com', fullName: 'Carol', password: 'Str0ng!Pass#2026' });
    const app2 = express();
    app2.use(express.json());
    authRoutes({ 'express-app': app2 }, ee, auth);

    const ok = await request(app2)
      .post('/services/authservice/api/login')
      .send({ email: 'c@x.com', password: 'Str0ng!Pass#2026' });
    expect(ok.status).toBe(200);
  });
});
