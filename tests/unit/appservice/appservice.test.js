/**
 * @fileoverview Unit tests for the application service and its base classes.
 *
 * Builds a throwaway application layout under .temp/tests/data (services,
 * data, routes, views, activities) and checks that the appservice factory
 * mounts every module, serves static views, and exposes the base classes.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
const EventEmitter = require('events');

const createAppService = require('../../../src/appservice');
const appWorkerBase = require('../../../src/appservice/baseClasses/appWorkerBase');
const appDataBase = require('../../../src/appservice/baseClasses/appDataBase');
const appRouteBase = require('../../../src/appservice/baseClasses/appRouteBase');
const appServiceBase = require('../../../src/appservice/baseClasses/appServiceBase');
const appViewBase = require('../../../src/appservice/baseClasses/appViewBase');
const { getServiceInstance } = require('../../../src/appservice/utils/routeUtils');
const { testDataDir } = require('../../helpers/testData');

/** Writes a file, creating its folder. */
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** A module that records that it was mounted on the shared options. */
const recorder = (name) => `module.exports = (type, options) => {
  (options.mounted = options.mounted || []).push(${JSON.stringify(name)});
  if (options['express-app'] && ${JSON.stringify(name)} === 'routes') {
    options['express-app'].get('/hello', (req, res) => res.json({ hello: type }));
  }
};`;

describe('Application service', () => {
  const originalCwd = process.cwd();
  let dir;
  let logger;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(testDataDir('appservice'), 'nooblyjs-app-'));
    logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('mounts services, data, routes, views and activities from ./src', async () => {
    write(path.join(dir, 'src/services/svc.js'), recorder('services'));
    write(path.join(dir, 'src/data/data.js'), recorder('data'));
    write(path.join(dir, 'src/routes/routes.js'), recorder('routes'));
    write(path.join(dir, 'src/views/views.js'), recorder('views'));
    write(path.join(dir, 'src/activities/index.js'), recorder('activities'));
    write(path.join(dir, 'README.md'), '# App');
    process.chdir(dir);

    const app = express();
    const options = { 'express-app': app, dependencies: { logging: logger } };
    const bases = createAppService('demo', options, new EventEmitter());

    expect(options.mounted).toEqual(['services', 'data', 'routes', 'views', 'activities']);
    expect(options.name).toBe('Application');
    expect(options.baseUrl).toBe('/');
    expect(Object.keys(bases)).toEqual(['appViewBase', 'appRouteBase', 'appWorkerBase', 'appServiceBase', 'appDataBase']);
    const res = await request(app).get('/hello').expect(200);
    expect(res.body).toEqual({ hello: 'demo' });
  });

  it('serves static views when the views folder has no modules', async () => {
    write(path.join(dir, 'src/views/index.html'), '<h1>Static</h1>');
    process.chdir(dir);

    const app = express();
    createAppService('demo', { 'express-app': app, baseUrl: '/app', dependencies: { logging: logger } }, new EventEmitter());
    const res = await request(app).get('/app/').expect(200);
    expect(res.text).toContain('Static');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('static views data loaded on /app'));
  });

  it('does nothing beyond logging when the app has no src folders', () => {
    process.chdir(dir);
    const bases = createAppService('demo', { 'express-app': express(), dependencies: { logging: logger } }, new EventEmitter());
    expect(bases.appWorkerBase).toBe(appWorkerBase);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });
});

describe('Application base classes', () => {
  const app = express();

  it('normalises baseUrl with a trailing slash', () => {
    for (const Base of [appRouteBase, appServiceBase, appViewBase]) {
      expect(new Base('t', { 'express-app': app, baseUrl: '/x' }, null).baseUrl).toBe('/x/');
      expect(new Base('t', { 'express-app': app, baseUrl: '/y/' }, null).baseUrl).toBe('/y/');
    }
  });

  it('exposes data-layer dependencies', () => {
    const dataservice = {};
    const logging = {};
    const data = new appDataBase('t', { containerName: 'users', schema: { a: 1 }, dependencies: { dataservice, logging } }, null);
    expect(data.containerName).toBe('users');
    expect(data.schema).toEqual({ a: 1 });
    expect(data.getDataService()).toBe(dataservice);
    expect(data.getLogger()).toBe(logging);
    expect(new appDataBase('t', {}, null).containerName).toBe('default');
  });

  it('provides worker defaults and an abstract run()', async () => {
    const worker = new appWorkerBase('t', {}, null);
    expect(worker.timeout).toBe(300000);
    expect(worker.maxRetries).toBe(3);
    expect(worker.activityConfig).toEqual({});
    await expect(worker.run({})).rejects.toThrow('must be implemented');
  });
});

describe('getServiceInstance', () => {
  const fallback = { name: 'default' };

  it('returns the default for empty or default names', () => {
    expect(getServiceInstance('caching', undefined, fallback, {})).toBe(fallback);
    expect(getServiceInstance('caching', 'default', fallback, {})).toBe(fallback);
  });

  it('looks up named instances in the registry and falls back when missing', () => {
    const named = { name: 'named' };
    const registry = { getServiceInstance: jest.fn((s, p, n) => (n === 'named' ? named : null)) };
    expect(getServiceInstance('caching', 'named', fallback, { ServiceRegistry: registry }, 'redis')).toBe(named);
    expect(registry.getServiceInstance).toHaveBeenCalledWith('caching', 'redis', 'named');
    expect(getServiceInstance('caching', 'other', fallback, { ServiceRegistry: registry })).toBe(fallback);
    expect(getServiceInstance('caching', 'other', fallback, {})).toBe(fallback);
  });
});
