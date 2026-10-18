/**
 * @fileoverview Where a successful sign-in goes: the page the person was heading to (a same-origin returnUrl),
 * then the app's loginSuccessRedirectUrl, then /services.
 *
 * @since 1.0.12
 */

'use strict';

process.env.BCRYPT_COST = process.env.BCRYPT_COST || '4';

const express = require('express');
const request = require('supertest');
const EventEmitter = require('events');

const createAuth = require('../../../src/authservice');
const { safeReturnUrl, postLoginRedirect } = require('../../../src/authservice/modules/redirect');

const PASSWORD = 'Str0ng!Pass#2026';

describe('post-login redirect', () => {
  it('accepts only same-origin relative paths as a returnUrl', () => {
    expect(safeReturnUrl('/teammates/team?x=1')).toBe('/teammates/team?x=1');
    for (const bad of ['//evil.test', '/\\evil.test', 'https://evil.test', 'evil', '', null, undefined, 42, `/${'a'.repeat(2048)}`]) {
      expect(safeReturnUrl(bad)).toBeNull();
    }
  });

  it('prefers the returnUrl, then the app setting, then the fallback', () => {
    expect(postLoginRedirect('/deep/link', { loginSuccessRedirectUrl: '/' })).toBe('/deep/link');
    expect(postLoginRedirect(undefined, { loginSuccessRedirectUrl: '/' })).toBe('/');
    expect(postLoginRedirect('//evil.test', { loginSuccessRedirectUrl: '/' })).toBe('/');
    expect(postLoginRedirect(undefined, {})).toBe('/services');
    expect(postLoginRedirect(undefined, {}, null)).toBeNull();
  });

  describe('POST /services/authservice/api/login with loginSuccessRedirectUrl set', () => {
    let app;

    beforeEach(async () => {
      app = express();
      app.use(express.json());
      const auth = createAuth('memory', { 'express-app': app, loginSuccessRedirectUrl: '/' }, new EventEmitter());
      await auth.createUser({ email: 'person@x.com', fullName: 'Person', password: PASSWORD, role: 'user' });
    });

    const login = (body) => request(app).post('/services/authservice/api/login').send({ email: 'person@x.com', password: PASSWORD, ...body }).expect(200);

    it('sends the person back to the page they were heading to', async () => {
      expect((await login({ returnUrl: '/services/caching' })).body.redirectUrl).toBe('/services/caching');
    });

    it('sends them to the app setting when there is no returnUrl', async () => {
      expect((await login({})).body.redirectUrl).toBe('/');
    });

    it('tells the login page the app setting as homeUrl', async () => {
      const res = await request(app).get('/services/authservice/api/branding').expect(200);
      expect(res.body.data.homeUrl).toBe('/');
    });
  });
});
