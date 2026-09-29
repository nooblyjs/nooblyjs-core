/**
 * @fileoverview The queue processor must not run passes concurrently.
 *
 * Each pass talks to the queueing backend, and with an out-of-process one
 * (ActiveMQ reads queue depth over HTTP) a pass can outlast the 1s interval
 * whenever the host is busy. Unguarded, the timer keeps firing and every stalled
 * second adds another concurrent round of requests — so a process briefly too
 * busy to serve one poll ends up owing ten, which is how a slow tick became a
 * failing one. The backlog is not useful work either: each pass re-reads the
 * same queue state.
 *
 * @author NooblyJS Core Team
 * @version 1.0.0
 */

'use strict';

const EventEmitter = require('node:events');
const WorkerManager = require('../../../src/working/providers/working');

/** A queue whose size() hangs until released, to simulate a stalled backend. */
function makeStallingQueue() {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  return {
    sizeCalls: 0,
    release: () => release(),
    async size() { this.sizeCalls++; await gate; return 0; },
    async dequeue() { return undefined; },
    async enqueue() {}
  };
}

function makeManager(queueService) {
  return new WorkerManager(
    { dependencies: { queueing: queueService }, enableLogging: false },
    new EventEmitter()
  );
}

/** Fires the interval callback n times, as the 1s timer would. */
function tick(manager, times = 1) {
  for (let i = 0; i < times; i++) {
    // eslint-disable-next-line no-underscore-dangle
    manager.queueProcessorInterval_._onTimeout();
  }
}

describe('working — queue processor tick overlap', () => {
  let queue;
  let manager;

  beforeEach(() => {
    queue = makeStallingQueue();
    manager = makeManager(queue);
  });

  afterEach(async () => {
    queue.release();
    manager.stopQueueProcessor_();
    manager.isRunning_ = false;
  });

  test('a stalled pass does not let later ticks pile on more requests', async () => {
    tick(manager);
    await Promise.resolve();
    const afterFirst = queue.sizeCalls;
    expect(afterFirst).toBeGreaterThan(0);

    // Ten more seconds of ticking while the backend is still hanging.
    tick(manager, 10);
    await Promise.resolve();

    expect(queue.sizeCalls).toBe(afterFirst);   // no additional in-flight work
    expect(manager.skippedTicks_).toBe(10);
  });

  test('processing resumes once the stalled pass finishes', async () => {
    tick(manager);
    await Promise.resolve();
    tick(manager, 3);
    const duringStall = queue.sizeCalls;

    queue.release();
    // Let the in-flight pass settle and clear the guard.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(manager.tickInFlight_).toBe(false);

    tick(manager);
    await Promise.resolve();
    expect(queue.sizeCalls).toBeGreaterThan(duringStall);
  });

  test('the skip counter resets after the backlog is reported', async () => {
    tick(manager);
    await Promise.resolve();
    tick(manager, 5);
    expect(manager.skippedTicks_).toBe(5);

    queue.release();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(manager.skippedTicks_).toBe(0);
  });

  test('a pass that throws still clears the guard', async () => {
    const exploding = {
      async size() { throw new Error('backend down'); },
      async dequeue() { return undefined; },
      async enqueue() {}
    };
    const m = makeManager(exploding);

    tick(m);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    // A permanently failing backend must not wedge the processor forever.
    expect(m.tickInFlight_).toBe(false);

    m.stopQueueProcessor_();
    m.isRunning_ = false;
  });
});
