/**
 * @fileoverview P2-6: repeatedly creating and disposing named service
 * instances must not grow the number of listeners on the shared event bus.
 *
 * @author NooblyJS Team
 * @since 1.1.0
 */

'use strict';

const EventEmitter = require('events');
const express = require('express');
const serviceRegistry = require('../../index');

/**
 * Counts every listener registered on an emitter.
 *
 * @param {EventEmitter} emitter - Emitter to inspect
 * @return {number} Total listeners across all events
 */
function totalListeners(emitter) {
  return emitter.eventNames().reduce((sum, name) => sum + emitter.listenerCount(name), 0);
}

describe('ServiceRegistry listener hygiene (P2-6)', () => {
  let emitter;
  const warnings = [];
  const onWarning = (w) => warnings.push(w);

  beforeAll(() => process.on('warning', onWarning));
  afterAll(() => process.off('warning', onWarning));

  beforeEach(() => {
    serviceRegistry.reset();
    emitter = new EventEmitter();
    serviceRegistry.initialize(express(), emitter, {});
  });

  afterEach(() => serviceRegistry.reset());

  it.each([
    ['caching', 'memory'],
    ['queueing', 'memory'],
    ['notifying', 'memory'],
    ['measuring', 'memory'],
    ['authservice', 'memory']
  ])('%s instances release their listeners when reset', (serviceName, provider) => {
    // Warm up once so shared dependencies (logging etc.) are already created.
    serviceRegistry.getService(serviceName, provider, { instanceName: 'warmup' });
    serviceRegistry.resetServiceInstance(serviceName, provider, 'warmup');
    const baseline = totalListeners(emitter);

    for (let i = 0; i < 25; i++) {
      serviceRegistry.getService(serviceName, provider, { instanceName: `cycle-${i}` });
      serviceRegistry.resetServiceInstance(serviceName, provider, `cycle-${i}`);
    }

    expect(totalListeners(emitter)).toBe(baseline);
    expect(warnings.filter((w) => w.name === 'MaxListenersExceededWarning')).toEqual([]);
  });
});
