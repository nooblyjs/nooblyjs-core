/**
 * @fileoverview Unit tests for the HTTP/HTTPS server factory and the
 * HTTP-to-HTTPS redirect server.
 *
 * Certificates are generated with `selfsigned` into .temp/tests/data/certs.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const express = require('express');
const request = require('supertest');
const selfsigned = require('selfsigned');

const { createServer, createHttpRedirectServer } = require('../../../src/shared/utils/createServer');
const { testDataDir } = require('../../helpers/testData');

const ENV_KEYS = ['HTTPS_ENABLED', 'HTTPS_KEY_PATH', 'HTTPS_CERT_PATH', 'HTTPS_CA_PATH', 'HTTPS_PASSPHRASE', 'HTTP_REDIRECT_PORT'];

describe('createServer', () => {
  const saved = {};
  let dir;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(testDataDir('certs'), 'nooblyjs-certs-'));
    const pems = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], { days: 1, keySize: 2048 });
    fs.writeFileSync(path.join(dir, 'server.key'), pems.private);
    fs.writeFileSync(path.join(dir, 'server.crt'), pems.cert);
    fs.writeFileSync(path.join(dir, 'ca.crt'), pems.cert);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    jest.restoreAllMocks();
  });

  it('creates a plain HTTP server by default', () => {
    const { server, protocol, httpsEnabled } = createServer(express());
    expect(server).toBeInstanceOf(http.Server);
    expect(protocol).toBe('http');
    expect(httpsEnabled).toBe(false);
  });

  it('creates an HTTPS server from certificate paths relative to baseDir', async () => {
    process.env.HTTPS_ENABLED = 'true';
    process.env.HTTPS_KEY_PATH = 'server.key';
    process.env.HTTPS_CERT_PATH = path.join(dir, 'server.crt');
    process.env.HTTPS_CA_PATH = 'ca.crt';
    process.env.HTTPS_PASSPHRASE = 'unused';
    const app = express();
    app.get('/ping', (req, res) => res.send('pong'));

    const { server, protocol } = createServer(app, { baseDir: dir });
    expect(server).toBeInstanceOf(https.Server);
    expect(protocol).toBe('https');
  });

  it('ignores a missing CA file', () => {
    process.env.HTTPS_ENABLED = 'true';
    process.env.HTTPS_KEY_PATH = path.join(dir, 'server.key');
    process.env.HTTPS_CERT_PATH = path.join(dir, 'server.crt');
    process.env.HTTPS_CA_PATH = path.join(dir, 'missing-ca.crt');
    expect(createServer(express()).protocol).toBe('https');
  });

  it('exits when HTTPS is enabled but certificates are missing', () => {
    process.env.HTTPS_ENABLED = 'true';
    process.env.HTTPS_KEY_PATH = path.join(dir, 'nope.key');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    expect(() => createServer(express())).toThrow('exit');
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('createHttpRedirectServer', () => {
  const savedPort = process.env.HTTP_REDIRECT_PORT;

  afterEach(() => {
    if (savedPort === undefined) delete process.env.HTTP_REDIRECT_PORT;
    else process.env.HTTP_REDIRECT_PORT = savedPort;
  });

  it('redirects to HTTPS on the configured port, keeping host and path', async () => {
    process.env.HTTP_REDIRECT_PORT = '8080';
    const { server, port } = createHttpRedirectServer({ httpsPort: 8443 });
    expect(port).toBe(8080);
    const res = await request(server).get('/a/b?c=1').set('Host', 'example.test:8080').expect(301);
    expect(res.headers.location).toBe('https://example.test:8443/a/b?c=1');
  });

  it('omits the default HTTPS port', async () => {
    delete process.env.HTTP_REDIRECT_PORT;
    const { server, port } = createHttpRedirectServer({ httpsPort: 443 });
    expect(port).toBe(80);
    const res = await request(server).get('/x').set('Host', 'example.test').expect(301);
    expect(res.headers.location).toBe('https://example.test/x');
  });
});
