'use strict';

/**
 * @fileoverview Tests for P2-6 — analytics modules remove their event listeners
 * on destroy(), so repeated service create/reset cycles don't leak listeners.
 */

const { EventEmitter } = require('events');

const modules = [
  { name: 'caching', path: '../../../src/caching/modules/analytics', events: ['cache:get:default', 'cache:put:default', 'cache:delete:default'] },
  { name: 'fetching', path: '../../../src/fetching/modules/analytics', events: ['fetch:success', 'fetch:cache-hit', 'fetch:dedup-hit', 'fetch:error'] },
  { name: 'workflow', path: '../../../src/workflow/modules/analytics', events: ['workflow:start', 'workflow:complete', 'workflow:error'] },
  { name: 'aiservice', path: '../../../src/aiservice/modules/analytics', events: ['ai:prompt:complete'] },
  { name: 'authservice', path: '../../../src/authservice/modules/analytics', events: ['auth:login', 'auth:login-failed', 'auth:logout', 'auth:user-created', 'auth:user-deleted'] }
];

describe('P2-6 — analytics listener cleanup', () => {
  modules.forEach(({ name, path, events }) => {
    it(`${name}: destroy() removes all registered listeners`, () => {
      const Analytics = require(path);
      const ee = new EventEmitter();

      const before = ee.eventNames().length;
      const instance = new Analytics(ee, 'default');

      // At least one listener was attached.
      const total = events.reduce((sum, e) => sum + ee.listenerCount(e), 0);
      expect(total).toBeGreaterThan(0);

      expect(typeof instance.destroy).toBe('function');
      instance.destroy();

      // All listeners for the module's events are gone.
      events.forEach((e) => expect(ee.listenerCount(e)).toBe(0));
      expect(ee.eventNames().length).toBe(before);
    });

    it(`${name}: repeated create/destroy does not accumulate listeners`, () => {
      const Analytics = require(path);
      const ee = new EventEmitter();
      ee.setMaxListeners(5); // would warn/throw-prone if leaking

      for (let i = 0; i < 50; i++) {
        const instance = new Analytics(ee, 'default');
        instance.destroy();
      }

      events.forEach((e) => expect(ee.listenerCount(e)).toBe(0));
    });
  });
});
