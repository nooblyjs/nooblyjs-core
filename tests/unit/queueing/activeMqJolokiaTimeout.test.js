/**
 * @fileoverview The Jolokia call deadline must be configurable.
 *
 * Queue depth is read over HTTP (JMX via Jolokia) and the axios `timeout` is a
 * budget for the WHOLE client-side round trip, not a server-side limit — so it
 * is spent by anything that delays the request inside the calling process, not
 * only by a slow broker. Hard-coded at 10s it was routinely exceeded on a busy
 * host while the broker answered the identical call in ~13ms.
 *
 * @author NooblyJS Core Team
 * @version 1.0.0
 */

'use strict';

const QueueingActiveMQ = require('../../../src/queueing/providers/queueingActiveMQ');

/** Builds a provider without connecting to anything. */
function makeProvider(options = {}) {
  return new QueueingActiveMQ({ host: '127.0.0.1', ...options });
}

describe('QueueingActiveMQ — jolokiaTimeout', () => {
  test('defaults to something a busy host can actually meet', () => {
    const provider = makeProvider();
    expect(provider.settings.jolokiaTimeout).toBe(30000);
    expect(provider.jolokiaRequestConfig_().timeout).toBe(30000);
  });

  test('is configurable', () => {
    const provider = makeProvider({ jolokiaTimeout: 45000 });
    expect(provider.jolokiaRequestConfig_().timeout).toBe(45000);
  });

  test('accepts a numeric string, as settings arrive from .env', () => {
    const provider = makeProvider({ jolokiaTimeout: '15000' });
    expect(provider.jolokiaRequestConfig_().timeout).toBe(15000);
  });

  test('falls back rather than letting a bad value become the tightest deadline', () => {
    // NaN or <= 0 would make axios give up immediately — worse than no setting.
    for (const bad of ['not-a-number', 0, -1, null, undefined, '']) {
      expect(makeProvider({ jolokiaTimeout: bad }).jolokiaRequestConfig_().timeout).toBe(30000);
    }
  });

  test('is reported through the settings metadata', () => {
    const provider = makeProvider();
    const entry = provider.settings.list.find((s) => s.setting === 'jolokiaTimeout');
    expect(entry).toBeDefined();
    expect(entry.type).toBe('number');
  });

  test('the rest of the Jolokia request config is unchanged', () => {
    const provider = makeProvider({ login: 'u', passcode: 'p' });
    const config = provider.jolokiaRequestConfig_();
    expect(config.auth).toEqual({ username: 'u', password: 'p' });
    expect(config.headers['Content-Type']).toBe('application/json');
    expect(config.headers.Origin).toBe('http://127.0.0.1:8161');
  });
});
