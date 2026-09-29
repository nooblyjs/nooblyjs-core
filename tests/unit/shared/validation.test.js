/**
 * @fileoverview Tests for route-boundary validation and pagination caps (P2-7).
 *
 * @author NooblyJS Team
 * @since 1.1.0
 */

'use strict';

const EventEmitter = require('events');
const express = require('express');
const request = require('supertest');
const { parseLimit, capLimit, parseOffset, validate } = require('../../../src/shared/utils/validation');

describe('pagination helpers', () => {
  it('parseLimit defaults, clamps and rejects junk', () => {
    expect(parseLimit(undefined)).toBe(100);
    expect(parseLimit('25')).toBe(25);
    expect(parseLimit('100000000')).toBe(1000);
    expect(parseLimit('-5', { defaultValue: 10 })).toBe(10);
    expect(parseLimit('abc', { defaultValue: 50, max: 20 })).toBe(20);
  });

  it('capLimit keeps "not supplied" (NaN) but caps real values', () => {
    expect(Number.isNaN(capLimit(NaN))).toBe(true);
    expect(capLimit(5)).toBe(5);
    expect(capLimit(1e9)).toBe(1000);
    expect(capLimit(0)).toBe(1);
  });

  it('parseOffset clamps to [min, max]', () => {
    expect(parseOffset(undefined)).toBe(0);
    expect(parseOffset('7')).toBe(7);
    expect(parseOffset('-1')).toBe(0);
    expect(parseOffset('0', { defaultValue: 1, min: 1 })).toBe(1);
    expect(parseOffset('9999999')).toBe(1e6);
  });
});

describe('validate() middleware', () => {
  const app = express();
  app.use(express.json());
  app.post('/items/:id', validate({
    params: { id: { type: 'string', maxLength: 8 } },
    query: { page: { type: 'integer', min: 1 } },
    body: {
      name: { type: 'string', required: true, maxLength: 5 },
      kind: { enum: ['a', 'b'] },
      tags: { type: 'array', maxLength: 2 }
    }
  }), (req, res) => res.json({ ok: true }));

  it('passes valid input through', async () => {
    const res = await request(app).post('/items/abc?page=2').send({ name: 'x', kind: 'a', tags: ['t'] });
    expect(res.status).toBe(200);
  });

  it('reports every violation with a 400 and safe message', async () => {
    const res = await request(app).post('/items/way-too-long-id?page=0')
      .send({ name: 'toolongname', kind: 'z', tags: [1, 2, 3] });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      'params.id must have at most 8 characters',
      'query.page must be >= 1',
      'body.name must have at most 5 characters',
      'body.kind must be one of: a, b',
      'body.tags must have at most 2 items'
    ]));
  });

  it('requires required fields and a JSON object body', async () => {
    const missing = await request(app).post('/items/a').send({});
    expect(missing.status).toBe(400);
    expect(missing.body.details).toContain('body.name is required');
    const notObject = await request(app).post('/items/a').send([1, 2]);
    expect(notObject.status).toBe(400);
  });
});

describe('route validation', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    require('../../../src/authservice')('memory', { 'express-app': app, createDefaultAdmin: false }, new EventEmitter());
    require('../../../src/fetching')('node', { 'express-app': app }, new EventEmitter());
  });

  it.each([
    'https://evil.example/',
    '//evil.example/',
    '/\\evil.example',
    'javascript:alert(1)'
  ])('login rejects open-redirect returnUrl %s', async (returnUrl) => {
    const res = await request(app).post('/services/authservice/api/login')
      .send({ email: 'a@b.c', password: 'x', returnUrl });
    expect(res.status).toBe(400);
    expect(res.body.details).toContain('body.returnUrl has an invalid format');
  });

  it('login rejects oversized credentials', async () => {
    const res = await request(app).post('/services/authservice/api/login')
      .send({ email: 'a'.repeat(300), password: 'x' });
    expect(res.status).toBe(400);
  });

  it('fetch requires a url string', async () => {
    const res = await request(app).post('/services/fetching/api/fetch').send({ url: 42 });
    expect(res.status).toBe(400);
    expect(res.body.details).toContain('body.url must be a string');
  });
});
