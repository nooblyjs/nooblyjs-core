/**
 * @fileoverview Tests for client-safe error responses (P1-2, N-9): blocked
 * requests return 4xx with a safe message; server faults never echo internals.
 *
 * @author NooblyJS Team
 * @since 1.1.0
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('events');
const express = require('express');
const request = require('supertest');
const { ClientError, isClientError, toClientResponse } = require('../../../src/shared/utils/httpErrors');
const { sendSafeError } = require('../../../src/shared/utils/safeError');
const { testDataDir } = require('../../helpers/testData');

/** Test run data lives under .temp/tests/data (see .claude/rules/output-locations.md). */
const TEST_FILES_DIR = testDataDir();

describe('httpErrors helpers', () => {
  it('ClientError is exposed with its 4xx status and message', () => {
    const err = new ClientError(400, 'Bad thing');
    expect(isClientError(err)).toBe(true);
    expect(toClientResponse(err)).toEqual({ status: 400, message: 'Bad thing' });
  });

  it('plain errors map to a generic 500', () => {
    const err = new Error('ENOENT: /srv/secret/path');
    expect(isClientError(err)).toBe(false);
    expect(toClientResponse(err)).toEqual({ status: 500, message: 'Internal Server Error' });
  });

  it('sendSafeError lets a ClientError override a default 500', async () => {
    const app = express();
    app.get('/client', (req, res) => sendSafeError(res, new ClientError(413, 'Too big'), { status: 500 }));
    app.get('/server', (req, res) => sendSafeError(res, new Error('db password is hunter2'), { status: 500 }));
    const client = await request(app).get('/client');
    expect(client.status).toBe(413);
    expect(client.body).toEqual({ error: 'Too big' });
    const server = await request(app).get('/server');
    expect(server.status).toBe(500);
    expect(JSON.stringify(server.body)).not.toMatch(/hunter2/);
  });
});

describe('Fetching SSRF blocks return 400 (N-9)', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    require('../../../src/fetching')('node', { 'express-app': app }, new EventEmitter());
  });

  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1/',
    'file:///etc/passwd'
  ])('blocks %s with 400', async (url) => {
    const res = await request(app).post('/services/fetching/api/fetch').send({ url });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Blocked request/);
  });
});

describe('Filing path traversal returns 400 (N-9)', () => {
  let app;
  let baseDir;
  beforeAll(() => {
    baseDir = fs.mkdtempSync(path.join(TEST_FILES_DIR, 'nooblyjs-traversal-'));
    app = express();
    require('../../../src/filing')('local', { 'express-app': app, baseDir }, new EventEmitter());
  });
  afterAll(() => fs.rmSync(baseDir, { recursive: true, force: true }));

  it('download ..%2f..%2f..%2fetc%2fpasswd is rejected with 400', async () => {
    const res = await request(app).get('/services/filing/api/download/..%2f..%2f..%2fetc%2fpasswd');
    expect(res.status).toBe(400);
    expect(res.text).not.toMatch(/root:x:0/);
  });

  it('backslash "traversal" is a missing literal file on POSIX: 404, no path leaked', async () => {
    const res = await request(app).get('/services/filing/api/download/..%5c..%5cetc%5cpasswd');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
