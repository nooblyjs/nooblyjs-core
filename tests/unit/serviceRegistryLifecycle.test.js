/**
 * @fileoverview Unit tests for ServiceRegistry lifecycle and wiring:
 * dependency ordering, default-provider overrides, authservice lookup,
 * shutdown (teardown method selection, timeouts, error reporting and the
 * registry:* events), per-service reset/dispose, and the monitoring
 * endpoints.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const request = require('supertest');

const ServiceRegistry = require('../../index');
const systemMonitoring = require('../../src/views/modules/monitoring');

describe('ServiceRegistry lifecycle', () => {
  let app;

  beforeEach(() => {
    ServiceRegistry.reset();
    ServiceRegistry.defaultProviderConfig.clear();
    app = express();
    ServiceRegistry.initialize(app, null, { security: { servicesAuth: { requireLogin: false } } });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    ServiceRegistry.reset();
    ServiceRegistry.defaultProviderConfig.clear();
  });

  it('ignores a second initialize()', () => {
    const emitter = ServiceRegistry.getEventEmitter();
    expect(ServiceRegistry.initialize(express(), null, {})).toBe(ServiceRegistry);
    expect(ServiceRegistry.getEventEmitter()).toBe(emitter);
  });

  describe('dependencies', () => {
    it('orders services so dependencies come first', () => {
      const order = ServiceRegistry.getServiceInitializationOrder();
      expect(order.indexOf('logging')).toBeLessThan(order.indexOf('queueing'));
      expect(order.indexOf('queueing')).toBeLessThan(order.indexOf('workflow'));
      expect(order.indexOf('dataservice')).toBeLessThan(order.indexOf('authservice'));
      expect(ServiceRegistry.validateDependencies()).toBe(true);
    });

    it('detects circular dependencies', () => {
      const original = ServiceRegistry.serviceDependencies.get('logging');
      ServiceRegistry.serviceDependencies.set('logging', ['aiservice']);
      try {
        expect(() => ServiceRegistry.validateDependencies()).toThrow('Dependency validation failed: Circular dependency');
      } finally {
        ServiceRegistry.serviceDependencies.set('logging', original);
      }
    });

    it('uses app-declared default providers for injected dependencies', () => {
      expect(ServiceRegistry.getDefaultProviderType('authservice')).toBe('file');
      expect(ServiceRegistry.getDefaultProviderType('unknown')).toBe('memory');
      ServiceRegistry.setDefaultProvider('caching', 'memory', { instanceName: 'shared' });
      expect(ServiceRegistry.getDefaultProviderType('caching')).toBe('memory');
      const measuring = ServiceRegistry.measuring('memory');
      expect(measuring).toBeDefined();
    });
  });

  describe('authservice lookup', () => {
    it('returns an existing authservice instance when no provider is given', () => {
      const auth = ServiceRegistry.authservice('memory');
      expect(ServiceRegistry.authservice()).toBe(auth);
      expect(ServiceRegistry.getAuthProviderForTokens_()).toBe(auth);
    });
  });

  describe('shutdown', () => {
    /** Registers a fake service directly in the registry. */
    const register = (key, service) => ServiceRegistry.services.set(key, service);

    it('calls the first teardown method each service exposes and emits registry:shutdown', async () => {
      const events = [];
      ServiceRegistry.getEventEmitter().on('registry:shutdown', (e) => events.push(e));
      const closer = { close: jest.fn(async () => {}), stop: jest.fn() };
      const stopper = { stop: jest.fn(), analytics: { destroy: jest.fn() } };
      const inert = {};
      register('a:memory:default', closer);
      register('b:memory:default', stopper);
      register('c:memory:default', inert);

      await ServiceRegistry.shutdown();
      expect(closer.close).toHaveBeenCalled();
      expect(closer.stop).not.toHaveBeenCalled();
      expect(stopper.stop).toHaveBeenCalled();
      expect(stopper.analytics.destroy).toHaveBeenCalled();
      expect(ServiceRegistry.services.size).toBe(0);
      expect(ServiceRegistry.initialized).toBe(false);
      expect(events).toEqual([expect.objectContaining({ servicesCount: 2 })]);

      await ServiceRegistry.shutdown();
    });

    it('reports failing and hung teardowns without blocking', async () => {
      const errors = [];
      ServiceRegistry.getEventEmitter().on('registry:shutdown-error', (e) => errors.push(e));
      register('bad:memory:default', { close: jest.fn(async () => { throw new Error('close failed'); }) });
      register('hung:memory:default', { disconnect: () => new Promise(() => {}) });
      register('throws:memory:default', { get stop() { throw new Error('getter exploded'); } });

      await ServiceRegistry.shutdown({ perServiceTimeoutMs: 20 });
      expect(errors).toEqual(expect.arrayContaining([
        { service: 'bad:memory:default', error: 'close failed' },
        { service: 'hung:memory:default', error: 'teardown timed out after 20ms' },
        { service: 'throws:memory:default', error: 'getter exploded' }
      ]));
    });

    it('logs teardown errors through the configured logger when present', async () => {
      const logger = { error: jest.fn() };
      ServiceRegistry.globalOptions.logger = logger;
      register('bad:memory:default', { close: async () => { throw new Error('nope'); } });
      await ServiceRegistry.shutdown();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('bad:memory:default'), { error: 'nope' });
    });
  });

  describe('reset', () => {
    it('disposes services removed by resetService and resetServiceInstance', () => {
      const dispose = jest.fn();
      const destroy = jest.fn();
      ServiceRegistry.services.set('x:memory:default', { dispose });
      ServiceRegistry.services.set('x:memory:other', { destroy, analytics: { destroy: jest.fn() } });
      ServiceRegistry.services.set('y:memory:default', {});
      expect(ServiceRegistry.resetServiceInstance('x', 'memory', 'other')).toBe(true);
      expect(destroy).toHaveBeenCalled();
      expect(ServiceRegistry.resetService('x')).toBe(1);
      expect(dispose).toHaveBeenCalled();
      expect(ServiceRegistry.services.has('y:memory:default')).toBe(true);
    });

    it('emits registry:dispose-error when a dispose throws', () => {
      const errors = [];
      ServiceRegistry.getEventEmitter().on('registry:dispose-error', (e) => errors.push(e));
      ServiceRegistry.services.set('z:memory:default', { destroy: () => { throw new Error('dispose failed'); } });
      ServiceRegistry.resetService('z');
      expect(errors).toEqual([{ error: 'dispose failed' }]);
    });
  });

  describe('monitoring endpoints', () => {
    it('serves metrics and snapshots', async () => {
      await request(app).get('/services/api/monitoring/metrics').expect(200);
      await request(app).get('/services/api/monitoring/snapshot').expect(200);
    });

    it('hides internal errors', async () => {
      jest.spyOn(systemMonitoring, 'getMetrics').mockImplementation(() => { throw new Error('/proc unreadable'); });
      jest.spyOn(systemMonitoring, 'getCurrentSnapshot').mockImplementation(() => { throw new Error('/proc unreadable'); });
      const res = await request(app).get('/services/api/monitoring/metrics').expect(500);
      expect(JSON.stringify(res.body)).not.toContain('/proc');
      await request(app).get('/services/api/monitoring/snapshot').expect(500);
    });
  });
});
