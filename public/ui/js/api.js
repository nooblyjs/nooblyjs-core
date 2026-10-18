// fetch for NooblyJS APIs: JSON in and out, the CSRF token on every write (double-submit cookie `noobly.csrf`), the one
// error shape ({ error: { code, message, details } }) turned into an ApiError, and AbortSignal support.

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function csrfToken(cookie = globalThis.document?.cookie ?? '') {
  const match = /(?:^|;\s*)noobly\.csrf=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : '';
}

/** Joins a base ('/factory/api/v1') and a path ('runs/214' or '/runs/214'). */
export const joinUrl = (base, path = '') => `${String(base).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`.replace(/\/$/, '') || '/';

/**
 * An API client bound to `base`. Every method takes `{ signal, headers, query }`; a request whose signal is aborted
 * rejects with an AbortError, which callers can ignore.
 */
export function createApi(base, { signal: defaultSignal, fetchImpl = (...a) => globalThis.fetch(...a) } = {}) {
  async function request(method, path, { body, signal = defaultSignal, headers = {}, query } = {}) {
    let url = joinUrl(base, path);
    if (query) {
      const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null)).toString();
      if (qs) url += `?${qs}`;
    }
    const res = await fetchImpl(url, {
      method,
      credentials: 'same-origin',
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-CSRF-Token': csrfToken() } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
    const data = isJson ? await res.json().catch(() => null) : null;
    if (!res.ok) {
      const e = data?.error ?? {};
      throw new ApiError(res.status, e.code ?? 'http_error', e.message ?? `${res.status} ${res.statusText}`, e.details);
    }
    return data;
  }
  return {
    base,
    get: (path, o) => request('GET', path, o),
    post: (path, body, o) => request('POST', path, { ...o, body }),
    put: (path, body, o) => request('PUT', path, { ...o, body }),
    patch: (path, body, o) => request('PATCH', path, { ...o, body }),
    del: (path, o) => request('DELETE', path, o),
    /** The same client with another default signal (the frame gives each page its own). */
    withSignal: (signal) => createApi(base, { signal, fetchImpl }),
  };
}
