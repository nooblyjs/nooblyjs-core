/**
 * @fileoverview N-8: unauthenticated API requests to /services get a 401 JSON
 * response, while browser page loads are still redirected to the login page.
 *
 * @author NooblyJS Team
 * @since 1.1.0
 */

'use strict';

const express = require('express');
const request = require('supertest');
const { createServicesAuthMiddleware } = require('../../../src/authservice/middleware/services');

describe('services auth middleware responses (N-8)', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use('/services', createServicesAuthMiddleware({ authservice: () => null, getServiceInstance: () => null }));
    app.get('/services/caching/api/list', (req, res) => res.json({ ok: true }));
    app.get('/services/', (req, res) => res.send('dashboard'));
  });

  it('returns 401 JSON for an API client without credentials', async () => {
    const res = await request(app).get('/services/caching/api/list').set('Accept', 'application/json');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: 'Authentication required' });
  });

  it('returns 401 JSON when no Accept header is sent (curl, SDKs)', async () => {
    const res = await request(app).get('/services/caching/api/list').unset('Accept');
    expect(res.status).toBe(401);
  });

  it('still redirects browser page loads to the login page', async () => {
    const res = await request(app).get('/services/').set('Accept', 'text/html,application/xhtml+xml');
    expect([302, 200]).toContain(res.status);
    if (res.status === 302) {
      expect(res.headers.location).toMatch(/\/services\/authservice\/views\/login\.html/);
    } else {
      expect(res.text).not.toBe('dashboard');
    }
  });
});
