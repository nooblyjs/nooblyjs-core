// One EventSource per tab (tech.md §4.2), shared by every app. It connects lazily, on the first subscription, and
// only when the server says the stream exists (`enabled`): the events stream arrives in Phase 2. Until then
// subscribing is safe and simply never fires.

export function createSse({ url = '/api/v1/events/stream', enabled = false, EventSourceImpl = globalThis.EventSource } = {}) {
  const listeners = new Map(); // topic → Set<fn>
  let source = null;

  function connect() {
    if (source || !enabled || !EventSourceImpl) return;
    const topics = [...listeners.keys()].filter((t) => t !== '*').join(',');
    source = new EventSourceImpl(topics ? `${url}?topics=${encodeURIComponent(topics)}` : url);
    source.onmessage = (e) => dispatch('message', e);
    source.addEventListener('noobly', (e) => dispatch('noobly', e));
  }

  function dispatch(kind, e) {
    let event;
    try {
      event = JSON.parse(e.data);
    } catch {
      return;
    }
    const topic = event.topic ?? event.type ?? kind;
    for (const key of [topic, '*']) for (const fn of listeners.get(key) ?? []) fn(event);
  }

  return {
    get enabled() {
      return enabled;
    },
    /** `fn(event)` for one topic, or every topic with '*'. Unsubscribes when `signal` aborts. Returns an unsubscribe. */
    on(topic, fn, { signal } = {}) {
      if (!listeners.has(topic)) listeners.set(topic, new Set());
      listeners.get(topic).add(fn);
      const off = () => listeners.get(topic)?.delete(fn);
      signal?.addEventListener('abort', off, { once: true });
      connect();
      return off;
    },
    close() {
      source?.close();
      source = null;
    },
  };
}
