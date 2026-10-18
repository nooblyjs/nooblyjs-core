// The NooblyJS frame (structure.md §2a, ADR-001). It draws the rail, sidebar and chat dock once, then routes every URL
// client-side: it picks the app by the longest mount path, imports the app's UI module on first use, matches one of
// its routes and renders that page into the content area. Switching apps never reloads the page.
import { html } from './html.js';
import { createApi, csrfToken, ApiError } from './api.js';
import { createSse } from './sse.js';
import { appFor, matchRoute, relativePath, fullPath, resolveAsset } from './router.js';
import { renderRail, renderSidebar, renderChatDock } from './shell.js';
import { mountChat, scopeKey } from './chat.js';
import { notice, button } from './components/index.js';

const STATUS_EVERY_MS = 60_000;
const STATUS_AFTER_EVENT_MS = 3000;
const SKIP_PREFIXES = ['/api/', '/services', '/ui/', '/login', '/logout', '/healthz'];

const $ = (id) => document.getElementById(id);
const state = {
  person: null,
  apps: [],
  permissions: new Set(),
  status: {},
  modules: new Map(), // app name → Promise<module>
  current: null, // { app, route, page, controller, token }
  path: null, // the pathname last routed
  token: 0,
  sse: null,
  sidebarFor: null,
  features: {},
  chat: null, // the mounted chat panel: { key, destroy() }
  chatScoped: false, // whether the page being shown asked for the panel
};

// ---------------------------------------------------------------------------- boot

async function boot() {
  let shell;
  try {
    shell = await createApi('/api/v1').get('shell');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    $('noobly-content').innerHTML = String(notice({ title: "NooblyJS couldn't start", text: err.message, tone: 'error', headingLevel: 1 }));
    return;
  }
  state.person = shell.person;
  // API-only apps (part of NooblyJS, nooblyjs-ai-product) have no pages: they are never routed to or shown on the rail.
  state.apps = shell.apps.filter((a) => !a.apiOnly);
  state.permissions = new Set(shell.permissions ?? []);
  state.sse = createSse({ enabled: Boolean(shell.features?.events) });
  state.features = shell.features ?? {};

  document.addEventListener('click', onClick);
  // Back/forward. A change of #hash alone (e.g. the skip link) also fires popstate: that isn't navigation.
  window.addEventListener('popstate', () => {
    if (location.pathname !== state.path) route(location.pathname, { focus: true });
  });
  await route(location.pathname, { focus: false });
  refreshStatus();
  setInterval(refreshStatus, STATUS_EVERY_MS);
  // Badges and status cards follow what happens: refetched after an event, at most once every few seconds.
  let pending = null;
  let last = 0;
  state.sse.on('*', () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      last = Date.now();
      refreshStatus();
    }, Math.max(400, last + STATUS_AFTER_EVENT_MS - Date.now()));
  });
}

// ---------------------------------------------------------------------------- navigation

function onClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest?.('a[href]');
  if (!link || link.target || link.hasAttribute('download') || link.hasAttribute('data-reload')) return;
  const url = new URL(link.href, location.href);
  if (url.hash && url.pathname === location.pathname && url.search === location.search) return; // in-page anchor
  if (url.origin !== location.origin || SKIP_PREFIXES.some((p) => url.pathname.startsWith(p))) return;
  if (!appFor(state.apps, url.pathname)) return;
  event.preventDefault();
  navigate(url.pathname + url.search + url.hash);
}

/** Goes to `path` (absolute, e.g. '/factory/runs/214') without reloading the page. */
export function navigate(path, { replace = false } = {}) {
  if (path === location.pathname + location.search && !replace) return;
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  route(new URL(path, location.href).pathname, { focus: true });
}

// ---------------------------------------------------------------------------- routing

async function route(pathname, { focus = true, retry = 0 } = {}) {
  const token = ++state.token;
  state.path = pathname;
  const app = appFor(state.apps, pathname);
  leaveCurrentPage();
  const view = $('noobly-content');
  const shellEl = $('noobly-shell');
  shellEl.classList.remove('shell--full');
  view.dataset.module = app?.name ?? '';
  drawRail(app);
  // The chat panel stays until the new page has had its say: a page about the same thing keeps it (and what is
  // typed in it), a page that scopes nothing hides it.
  state.chatScoped = false;

  if (!app) return showNotice({ title: 'Page not found', text: `Nothing in NooblyJS lives at ${pathname}.`, tone: 'muted' }, 'Not found', focus);
  drawSidebar(app, null);
  if (app.state === 'not-installed') {
    return showNotice({ title: `${app.label} isn't installed yet`, text: `The ${app.label} app joins NooblyJS in Phase ${app.phase ?? 'N'}. Its screens will appear here.`, tone: 'muted', iconName: app.icon }, app.label, focus);
  }
  if (app.state !== 'ready') {
    return showNotice({ title: `${app.label} is unavailable`, text: `${app.label} didn't start, so its screens can't load right now. The rest of NooblyJS works. An administrator can check the NooblyJS log.`, tone: 'error' }, app.label, focus);
  }

  let mod;
  try {
    mod = await loadModule(app, retry);
  } catch (err) {
    console.error(`NooblyJS: the ${app.name} module failed to load`, err);
    if (token === state.token) showError(app, pathname, `${app.label} couldn't load this page.`, focus, retry);
    return;
  }
  if (token !== state.token) return;

  const rel = relativePath(app.mountPath, pathname);
  const match = matchRoute(mod.routes ?? [], rel);
  if (!match) return showNotice({ title: 'Page not found', text: `${app.label} has no page at ${pathname}.`, tone: 'muted' }, app.label, focus);
  if (match.route.redirect) return navigate(fullPath(app.mountPath, match.route.redirect), { replace: true });

  drawSidebar(app, match.route.nav);
  if (match.route.layout === 'full') shellEl.classList.add('shell--full');
  if (match.route.requires && !state.permissions.has(match.route.requires)) {
    return showNotice({ title: 'Not for your role', text: `This page needs the "${match.route.requires}" permission. Your access role is ${state.person.accessRole}.`, tone: 'muted' }, match.route.title, focus);
  }

  const controller = new AbortController();
  const ctx = makeCtx(app, controller, token);
  state.current = { app, route: match.route, page: null, controller, token };
  setTitle(match.route.title, app);
  view.innerHTML = String(html`<p class="loading" role="status">Loading…</p>`);
  try {
    const page = await match.route.page();
    if (token !== state.token) return;
    state.current.page = page;
    view.innerHTML = '';
    await page.render(view, { params: match.params, query: new URLSearchParams(location.search), ctx, route: match.route });
  } catch (err) {
    if (token !== state.token || err?.name === 'AbortError') return;
    console.error(`NooblyJS: ${app.name} ${pathname} failed`, err);
    showError(app, pathname, `${app.label} couldn't show this page.`, focus, retry);
    return;
  }
  if (token !== state.token) return;
  settleChat();
  if (focus) moveFocus(view);
}

function loadModule(app, retry) {
  if (retry || !state.modules.has(app.name)) {
    for (const href of app.ui?.styles ?? []) addStylesheet(resolveAsset(app.mountPath, href));
    const url = resolveAsset(app.mountPath, app.ui.entry) + (retry ? `?retry=${retry}-${Date.now()}` : '');
    const loading = import(url).then(async (mod) => {
      if (typeof mod.init === 'function') await mod.init({ person: state.person, app });
      return mod;
    });
    state.modules.set(app.name, loading);
    loading.catch(() => state.modules.delete(app.name)); // a later visit tries again
  }
  return state.modules.get(app.name);
}

function addStylesheet(href) {
  if (document.querySelector(`link[data-noobly-style="${CSS.escape(href)}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.nooblyStyle = href;
  document.head.append(link);
}

function leaveCurrentPage() {
  const cur = state.current;
  state.current = null;
  if (!cur) return;
  cur.controller.abort();
  try {
    cur.page?.destroy?.();
  } catch (err) {
    console.error('NooblyJS: destroy() failed', err);
  }
}

function makeCtx(app, controller, token) {
  const { signal } = controller;
  const apiBase = app.mountPath === '/' ? '/api/v1' : `${app.mountPath}/api/v1`;
  return {
    app: { name: app.name, label: app.label, mountPath: app.mountPath },
    person: state.person,
    signal,
    api: createApi(apiBase, { signal }),
    hostApi: createApi('/api/v1', { signal }),
    // `enabled`: whether this host has an event stream at all (a standalone child may not), so a page can fall back to refreshing.
    sse: { on: (topic, fn) => state.sse.on(topic, fn, { signal }), enabled: Boolean(state.sse.enabled) },
    can: (permission) => state.permissions.has(permission),
    navigate: (path, { absolute = false, replace = false } = {}) => navigate(absolute ? path : fullPath(app.mountPath, path), { replace }),
    chat: { scope: (scope) => token === state.token && drawChat(scope) },
    setTitle: (text) => token === state.token && setTitle(text, app),
    isCurrent: () => token === state.token && !signal.aborted,
  };
}

// ---------------------------------------------------------------------------- drawing

function drawRail(app) {
  $('noobly-rail').innerHTML = String(renderRail(state.apps, app?.name));
}

function drawSidebar(app, currentKey) {
  const status = state.status[app.name];
  $('noobly-sidebar').innerHTML = String(renderSidebar(app, { currentKey, status, person: state.person, csrfToken: csrfToken() }));
  $('noobly-sidebar').setAttribute('aria-label', `${app.label} navigation`);
  state.sidebarFor = { app, currentKey };
}

function drawChat(scope) {
  const dock = $('noobly-chat');
  if (!scope) {
    state.chat?.destroy();
    state.chat = null;
    dock.hidden = true;
    dock.innerHTML = '';
    return;
  }
  state.chatScoped = true;
  const key = scopeKey(scope);
  if (state.chat?.key === key) return; // the same thing is on screen: keep the open thread
  state.chat?.destroy();
  dock.hidden = false;
  // Team chat belongs to NooblyJS. A child app running on its own has no chat service, and says so.
  if (!state.features.chat) {
    dock.innerHTML = String(renderChatDock(scope));
    state.chat = { key, destroy() {} };
    return;
  }
  state.chat = mountChat(dock, { scope, person: state.person, can: (permission) => state.permissions.has(permission), sse: state.sse });
}

/** After a page has rendered (or couldn't): hide the panel unless the page scoped it. */
function settleChat() {
  if (!state.chatScoped) drawChat(null);
}

function setTitle(text, app) {
  document.title = [text, app?.label, 'NooblyJS'].filter(Boolean).filter((v, i, all) => all.indexOf(v) === i).join(' · ');
  $('noobly-announce').textContent = document.title;
}

function showNotice(options, title, focus) {
  settleChat();
  const view = $('noobly-content');
  view.innerHTML = String(notice({ ...options, headingLevel: 1 }));
  setTitle(title, null);
  if (focus) moveFocus(view);
}

function showError(app, pathname, text, focus, retry) {
  settleChat();
  const view = $('noobly-content');
  view.innerHTML = String(notice({
    title: text,
    text: 'Something went wrong while loading it. The rest of NooblyJS keeps working. Try again, and if it keeps failing, tell an administrator.',
    tone: 'error',
    headingLevel: 1,
    actions: button({ label: 'Retry', kind: 'primary', icon: 'refresh', attrs: { 'data-action': 'retry' } }),
  }));
  setTitle(`${app.label} unavailable`, null);
  view.querySelector('[data-action="retry"]').addEventListener('click', () => route(pathname, { focus: true, retry: retry + 1 }));
  if (focus) moveFocus(view);
}

/** After client-side navigation, keyboard and screen-reader users land on the new page's heading. */
function moveFocus(view) {
  const target = view.querySelector('h1') ?? view;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: false });
}

async function refreshStatus() {
  try {
    state.status = await createApi('/api/v1').get('shell/status');
    if (state.sidebarFor) drawSidebar(state.sidebarFor.app, state.sidebarFor.currentKey);
  } catch { /* the status card is a nicety: keep the last one */ }
}

boot();
