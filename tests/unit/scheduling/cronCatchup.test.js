/**
 * @fileoverview Regression cover for silently-dropped CRON fires.
 *
 * The evaluator used to be armed by a plain `setInterval(60s)` and only ever
 * checked the single minute it happened to wake up in. Event-loop lag pushed
 * each tick a few milliseconds later than the last until the ticks slipped
 * past a whole minute — and that minute was never evaluated. For a once-a-day
 * expression like "0 1 * * *" a skipped minute means the job does not run at
 * all that day, and nothing ever noticed.
 *
 * These tests drive evaluateCronTasks_ directly with simulated tick times, so
 * they assert the replay behaviour without waiting on the real clock.
 *
 * @author NooblyJS Core Team
 */

'use strict';

const SchedulerProvider = require('../../../src/scheduling/providers/scheduling');

/** Builds a Date at a local wall-clock minute. */
const at = (day, hour, minute) => new Date(2026, 6, day, hour, minute, 0, 0);

describe('CRON evaluation', () => {
  /** @type {Object} */
  let worker;
  /** @type {Array<string>} */
  let fired;
  /** @type {SchedulerProvider} */
  let scheduler;

  beforeEach(() => {
    fired = [];
    worker = {
      start: (scriptPath, data, callback) => {
        fired.push(scriptPath);
        callback('completed', {});
      }
    };
    scheduler = new SchedulerProvider({}, null, worker);
  });

  afterEach(async () => {
    await scheduler.shutdown();
  });

  it('fires a task on its matching minute, once', async () => {
    await scheduler.startCron({ scriptPath: 'nightly.js' }, '0 1 * * *', 'nightly');

    scheduler.evaluateCronTasks_(at(8, 0, 59));
    expect(fired).toHaveLength(0);

    scheduler.evaluateCronTasks_(at(8, 1, 0));
    expect(fired).toEqual(['nightly.js']);

    // A duplicate tick inside the same minute must not re-fire.
    scheduler.evaluateCronTasks_(at(8, 1, 0));
    expect(fired).toHaveLength(1);
  });

  it('runs a daily fire whose exact minute was skipped by a late tick', async () => {
    await scheduler.startCron({ scriptPath: 'nightly.js' }, '0 1 * * *', 'nightly');

    scheduler.evaluateCronTasks_(at(8, 0, 58));
    scheduler.evaluateCronTasks_(at(8, 1, 4)); // 00:59 – 01:03 never evaluated

    expect(fired).toEqual(['nightly.js']);
  });

  it('replays a task at most once, however many fires were missed', async () => {
    await scheduler.startCron({ scriptPath: 'every5.js' }, '*/5 * * * *', 'every5');

    scheduler.evaluateCronTasks_(at(8, 1, 0));  // fires
    scheduler.evaluateCronTasks_(at(8, 1, 31)); // 01:05–01:30 missed: 6 fires

    // Catch-up means "you missed a run, here it is" — not six runs at once.
    expect(fired).toHaveLength(2);
  });

  it('caps the replay window rather than replaying a suspended week', async () => {
    await scheduler.startCron({ scriptPath: 'hourly.js' }, '0 * * * *', 'hourly');

    scheduler.evaluateCronTasks_(at(8, 1, 0));
    scheduler.evaluateCronTasks_(at(15, 3, 30)); // host asleep for a week

    expect(fired).toHaveLength(2);
  });

  it('does not fire a task whose expression never matched the missed window', async () => {
    await scheduler.startCron({ scriptPath: 'nightly.js' }, '0 1 * * *', 'nightly');

    scheduler.evaluateCronTasks_(at(8, 3, 0));
    scheduler.evaluateCronTasks_(at(8, 3, 40)); // gap contains no 01:00

    expect(fired).toHaveLength(0);
  });

  it('ignores a tick for a minute already evaluated', async () => {
    await scheduler.startCron({ scriptPath: 'every5.js' }, '*/5 * * * *', 'every5');

    scheduler.evaluateCronTasks_(at(8, 1, 5));
    scheduler.evaluateCronTasks_(at(8, 1, 0)); // clock stepped backwards

    expect(fired).toHaveLength(1);
  });

  it('treats the first evaluation as a baseline, not a catch-up', async () => {
    // Replaying from "the last tick" is meaningless when there was no last
    // tick. Runs missed while the process was DOWN are the caller's business:
    // only the caller knows, from persisted state, when the fire was due.
    await scheduler.startCron({ scriptPath: 'nightly.js' }, '0 1 * * *', 'nightly');

    scheduler.evaluateCronTasks_(at(8, 1, 5));

    expect(fired).toHaveLength(0);
  });

  describe('runNow', () => {
    it('dispatches a registered task out of band', async () => {
      await scheduler.startCron({ scriptPath: 'nightly.js' }, '0 1 * * *', 'nightly');

      await expect(scheduler.runNow('nightly')).resolves.toBe(true);
      expect(fired).toEqual(['nightly.js']);
    });

    it('reports an unknown task rather than throwing', async () => {
      await expect(scheduler.runNow('no-such-task')).resolves.toBe(false);
      expect(fired).toHaveLength(0);
    });
  });

  describe('task run state', () => {
    it('exposes whether a run is in flight', async () => {
      let finish;
      worker.start = (scriptPath, data, callback) => { finish = () => callback('completed', {}); };

      await scheduler.startCron({ scriptPath: 'slow.js' }, '0 1 * * *', 'slow');
      await scheduler.runNow('slow');

      expect((await scheduler.getSchedule('slow')).activeRuns).toBe(1);
      finish();
      expect((await scheduler.getSchedule('slow')).activeRuns).toBe(0);
      expect((await scheduler.getSchedule('slow')).lastFinishedAt).toBeTruthy();
    });
  });

  describe('the shared minute timer', () => {
    /** Captures the delays the provider asks setTimeout for. */
    const withCapturedTimer = async (nowMs, body) => {
      const realSetTimeout = global.setTimeout;
      const delays = [];
      const callbacks = [];
      global.setTimeout = (fn, ms) => {
        delays.push(ms);
        callbacks.push(fn);
        return { unref() {} };
      };
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(nowMs);
      try {
        await body(delays, callbacks);
      } finally {
        global.setTimeout = realSetTimeout;
        nowSpy.mockRestore();
      }
    };

    it('arms the next tick just inside the coming minute, never a minute late', async () => {
      // 00:59:30 — the tick must land at 01:00:00.25, 30s away. Arming 90s out
      // skips the 01:00 minute entirely, which is how a "0 1 * * *" job ends up
      // never running.
      const now = new Date(2026, 6, 8, 0, 59, 30).getTime();

      await withCapturedTimer(now, async (delays) => {
        await scheduler.startCron({ scriptPath: 'nightly.js' }, '0 1 * * *', 'nightly');

        expect(delays).toHaveLength(1);
        expect(delays[0]).toBeGreaterThan(0);
        expect(delays[0]).toBeLessThanOrEqual(60 * 1000);
        expect((now + delays[0]) % (60 * 1000)).toBe(250); // 250ms into a minute
      });
    });

    it('re-arms itself after every tick while cron tasks remain', async () => {
      const now = new Date(2026, 6, 8, 0, 59, 30).getTime();

      await withCapturedTimer(now, async (delays, callbacks) => {
        await scheduler.startCron({ scriptPath: 'nightly.js' }, '0 1 * * *', 'nightly');

        callbacks[0](); // the 01:00 tick
        expect(delays).toHaveLength(2);
        expect(scheduler.cronTimer_).not.toBeNull();
      });
    });

    it('stops once the last cron task is removed', async () => {
      await scheduler.startCron({ scriptPath: 'nightly.js' }, '0 1 * * *', 'nightly');
      expect(scheduler.cronTimer_).not.toBeNull();

      await scheduler.stop('nightly');
      expect(scheduler.cronTimer_).toBeNull();
    });
  });
});
