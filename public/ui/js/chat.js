// The docked team chat panel's controller (structure.md §2a, product.md §5.9). The frame mounts it when a page
// calls ctx.chat.scope({ kind, id }); it loads the thread for what is on screen, posts, runs card and chip actions,
// and follows the event stream so other people's messages and an agent's "working…" appear without a refresh.
// The server decides who may post or answer a card; this only shows it.
import { html } from './html.js';
import { createApi } from './api.js';
import { chatPanel, chatLog, chatWorking } from './components/chat-panel.js';

const ITEM_KINDS = new Set(['item', 'spec', 'architecture', 'ux', 'ui']);

/** Pages about the same thing share a thread: a spec and its architecture are both the item's. */
export const scopeKey = (scope) => (scope ? `${ITEM_KINDS.has(scope.kind) ? 'item' : scope.kind}:${scope.id}` : null);

/**
 * @param {HTMLElement} dock   #noobly-chat
 * @param {{ scope: { kind: string, id: string }, person: object, can: (permission: string) => boolean, sse: object }} o
 * @returns {{ key: string, destroy(): void }}
 */
export function mountChat(dock, { scope, person, can, sse }) {
  const controller = new AbortController();
  const { signal } = controller;
  const api = createApi('/api/v1', { signal });
  const opts = { personId: person?.id, can };
  let data = null;
  let reloading = null;
  let busy = false;
  const part = (name) => dock.querySelector(`[data-chat="${name}"]`);

  function showError(text) {
    const el = part('error');
    if (!el) return;
    el.textContent = text ?? '';
    el.hidden = !text;
  }

  function drawLog({ stick = true } = {}) {
    const log = part('log');
    if (!log) return;
    const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    part('list').innerHTML = String(chatLog(data.messages, { ...opts, now: new Date(data.now).getTime() }));
    part('working').innerHTML = String(chatWorking(data.working));
    if (stick || atEnd) log.scrollTop = log.scrollHeight;
  }

  async function load({ first = false } = {}) {
    try {
      data = await api.get('chat/thread', { query: { kind: scope.kind, id: scope.id } });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (first) dock.innerHTML = String(html`<h2 class="chat-dock__title">Team chat</h2><p class="chat-card__note">${err.status === 404 ? 'This page has no thread.' : `The thread couldn't load: ${err.message}`}</p>`);
      else showError(`The thread couldn't refresh: ${err.message}`);
      return;
    }
    if (signal.aborted) return;
    if (first) {
      dock.innerHTML = String(chatPanel(data, { ...opts, now: new Date(data.now).getTime() }));
      part('log').scrollTop = part('log').scrollHeight;
    } else drawLog({ stick: false });
  }

  /** Refetches once for a burst of events. */
  function reload() {
    clearTimeout(reloading);
    reloading = setTimeout(() => load(), 120);
  }

  async function run(fn) {
    if (busy) return;
    busy = true;
    showError(null);
    try {
      await fn();
      await load();
      const log = part('log');
      if (log) log.scrollTop = log.scrollHeight;
    } catch (err) {
      if (err?.name !== 'AbortError') showError(err.message);
    } finally {
      busy = false;
    }
  }

  dock.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-chat="form"]');
    if (!form) return;
    event.preventDefault();
    const box = form.elements.text;
    const text = box.value.trim();
    if (!text || !data) return;
    run(async () => {
      await api.post(`chat/threads/${encodeURIComponent(data.thread.id)}/messages`, { text });
      box.value = '';
      box.focus();
    });
  }, { signal });

  dock.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.target.name !== 'text') return;
    event.preventDefault();
    event.target.form.requestSubmit();
  }, { signal });

  dock.addEventListener('click', (event) => {
    const el = event.target.closest('[data-chat-action]');
    if (!el || !data) return;
    const { chatAction: action, card, chip } = el.dataset;
    if (action === 'chip') run(() => api.post(`chat/threads/${encodeURIComponent(data.thread.id)}/actions`, { action: chip }));
    else if (action === 'apply') run(() => api.post(`chat/cards/${encodeURIComponent(card)}/apply`, {}));
    else if (action === 'approve' || action === 'decline') run(() => api.post(`chat/cards/${encodeURIComponent(card)}/decision`, { decision: action }));
  }, { signal });

  sse.on('*', (event) => {
    if (!data || event.threadId !== data.thread.id) return;
    if (event.type === 'chat.agent_working') {
      if (!data.working.some((w) => w.id === event.agentId)) data.working.push({ id: event.agentId, name: event.agentName });
      const el = part('working');
      if (el) el.innerHTML = String(chatWorking(data.working));
      return;
    }
    reload();
  }, { signal });

  dock.innerHTML = String(html`<h2 class="chat-dock__title">Team chat</h2><p class="loading" role="status">Loading the thread…</p>`);
  load({ first: true });

  return {
    key: scopeKey(scope),
    destroy() {
      clearTimeout(reloading);
      controller.abort();
    },
  };
}
