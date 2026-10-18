/**
 * @fileoverview The NooblyJS shell's server side (noobly structure.md §2a, ADR-001): the list of apps, the frame page
 * every UI route returns, GET /api/v1/shell and GET /api/v1/shell/status. Used by the NooblyJS host and by a hosted
 * app's standalone server, so both serve the same frame.
 *
 *   const { createShell, UI_DIR } = require('nooblyjs-core/src/shell');
 *   const shell = createShell({ express, auth, can, permissionsFor, log });
 *   app.use('/ui', express.static(UI_DIR, { index: false, redirect: false }));
 *   app.use(shell.router);
 *
 * @since 1.0.11
 */

'use strict';

const path = require('node:path');

const UI_DIR = path.join(__dirname, '..', '..', 'public', 'ui');
const FRAME_FILE = path.join(UI_DIR, 'frame.html');
const STATUS_TIMEOUT_MS = 1000;

/**
 * @param {object} options
 * @param {typeof import('express')} options.express        the host's express (for its Router)
 * @param {Function} options.auth                            middleware: req.person or 401 (API) / redirect (pages)
 * @param {(accessRole: string, permission: string) => Promise<boolean>} options.can
 * @param {(accessRole: string) => Promise<string[]>} [options.permissionsFor]
 * @param {object} [options.features]                       e.g. { events: true } once the SSE stream exists
 * @param {{ warn: Function }} [options.log]
 */
function createShell({ express, auth, can, permissionsFor = async () => [], features = {}, log = console } = {}) {
  if (!express || typeof auth !== 'function' || typeof can !== 'function') {
    throw new Error('createShell needs { express, auth, can }.');
  }
  const start = []; // built-in apps before the hosted ones (Home, Product)
  const hosted = []; // in hosted-apps.yaml order
  const end = []; // built-in apps after them (Platform)

  const slots = () => [...start, ...hosted, ...end];

  function describe(slot) {
    const d = slot.desc ?? {};
    const meta = slot.meta ?? {};
    const ui = d.ui ?? null;
    return {
      name: d.name ?? meta.name ?? slot.entry?.name,
      label: d.label ?? meta.label ?? slot.entry?.name,
      title: d.title ?? meta.title ?? null,
      tag: d.tag ?? null,
      icon: d.icon ?? meta.icon ?? 'dot',
      mountPath: d.mountPath ?? slot.entry?.mountPath,
      ui,
      nav: d.nav ?? [],
      state: slot.state,
      apiOnly: slot.apiOnly,
      rail: slot.rail,
      phase: meta.phase ?? null,
    };
  }

  /** The apps as one person sees them: nav rows they lack the permission for are left out (a hint only). */
  async function appsFor(person) {
    const out = [];
    for (const slot of slots()) {
      const app = describe(slot);
      const nav = [];
      for (const row of app.nav) {
        if (!row.requires || (person && await can(person.accessRole, row.requires))) nav.push(row);
      }
      out.push({ ...app, nav });
    }
    return out;
  }

  async function statusFor(req) {
    const result = {};
    await Promise.all(slots().map(async (slot) => {
      const status = slot.desc?.status;
      if (slot.state !== 'ready' || typeof status !== 'function') return;
      const name = describe(slot).name;
      let timer;
      try {
        const answer = await Promise.race([
          Promise.resolve().then(() => status(req)),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('took longer than 1 s')), STATUS_TIMEOUT_MS); }),
        ]);
        if (answer) result[name] = answer;
      } catch (err) {
        log.warn(`status() of ${name} left out: ${err.message}`);
      } finally {
        clearTimeout(timer);
      }
    }));
    return result;
  }

  /** The frame page for every UI route. Signed-in only: `auth` sends anyone else to /login. */
  const frame = (req, res, next) => auth(req, res, (err) => {
    if (err) return next(err);
    res.set('Cache-Control', 'no-store');
    res.sendFile(FRAME_FILE);
  });

  const router = express.Router();
  router.get('/api/v1/shell', auth, async (req, res, next) => {
    try {
      const { id, name, accessRole, workRole, teams } = req.person;
      res.json({
        person: { id, name, accessRole, workRole, teams },
        permissions: await permissionsFor(accessRole),
        features,
        apps: await appsFor(req.person),
      });
    } catch (err) {
      next(err);
    }
  });
  router.get('/api/v1/shell/status', auth, async (req, res, next) => {
    try {
      res.json(await statusFor(req));
    } catch (err) {
      next(err);
    }
  });

  return {
    router,
    frame,
    uiDir: UI_DIR,
    /** A built-in app of the host (same description as a hosted app). `position`: 'start' or 'end' of the rail. */
    builtIn(desc, { position = 'start' } = {}) {
      (position === 'end' ? end : start).push({ desc, state: 'ready', apiOnly: !desc.ui, rail: desc.rail !== false && Boolean(desc.ui) });
    },
    /** A hosted app whose register() succeeded. */
    add(desc, entry) {
      hosted.push({ desc, entry, state: 'ready', apiOnly: !desc.ui, rail: Boolean(desc.ui) });
    },
    /** An enabled app whose register() failed. `meta` ({ name, label, icon, phase, rail }) says how to show it. */
    unavailable(entry, meta = {}) {
      hosted.push({ entry, meta, state: 'unavailable', apiOnly: meta.rail === false, rail: meta.rail !== false });
    },
    /** A listed app that isn't enabled yet: its rail item says "Not installed yet". */
    notInstalled(entry, meta = {}) {
      hosted.push({ entry, meta, state: 'not-installed', apiOnly: meta.rail === false, rail: meta.rail !== false });
    },
    /** Every app, in rail order, without per-person filtering. */
    list: () => slots().map(describe),
    appsFor,
    statusFor,
  };
}

module.exports = { createShell, UI_DIR, FRAME_FILE };
