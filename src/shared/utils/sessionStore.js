/**
 * @fileoverview express-session stores for production use (N-4).
 *
 * - RedisSessionStore: shared across replicas and restarts, built on the
 *   project's existing `ioredis` dependency. Selected when SESSION_REDIS_URL
 *   (or REDIS_URL) is set.
 * - PruningMemoryStore: single-process fallback that, unlike express-session's
 *   default MemoryStore, evicts expired sessions on a timer so memory does not
 *   grow without bound.
 *
 * @author NooblyJS Team
 * @since 1.1.0
 */

'use strict';

/** Default session lifetime when the cookie carries no expiry (24 h). */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Computes a session's remaining lifetime in milliseconds.
 *
 * @param {Object} sess - Session data
 * @return {number} Milliseconds until expiry (at least 1)
 */
function ttlFor(sess) {
  const expires = sess && sess.cookie && sess.cookie.expires;
  if (expires) return Math.max(1, new Date(expires).getTime() - Date.now());
  const maxAge = sess && sess.cookie && sess.cookie.originalMaxAge;
  return maxAge > 0 ? maxAge : DEFAULT_TTL_MS;
}

/**
 * Wraps a callback-style store method around an async implementation.
 *
 * @param {Promise<*>} promise - Operation
 * @param {Function} [cb] - Node-style callback
 * @return {void}
 */
function settle(promise, cb) {
  promise.then((value) => cb && cb(null, value), (err) => cb && cb(err));
}

/**
 * Builds the store classes against the express-session module in use, so the
 * stores extend the same `Store` base the middleware checks for.
 *
 * @param {Function} session - The express-session module
 * @return {{RedisSessionStore: Function, PruningMemoryStore: Function}} Store classes
 */
function defineStores(session) {
  const { Store } = session;

  /** Session store backed by Redis via ioredis. */
  class RedisSessionStore extends Store {
    /**
     * @param {Object} options - Options
     * @param {Object} options.client - ioredis client
     * @param {string} [options.prefix='sess:'] - Key prefix
     */
    constructor({ client, prefix = 'sess:' }) {
      super();
      this.client = client;
      this.prefix = prefix;
    }

    get(sid, cb) {
      settle(this.client.get(this.prefix + sid).then((raw) => (raw ? JSON.parse(raw) : null)), cb);
    }

    set(sid, sess, cb) {
      settle(this.client.set(this.prefix + sid, JSON.stringify(sess), 'PX', ttlFor(sess)), cb);
    }

    touch(sid, sess, cb) {
      settle(this.client.pexpire(this.prefix + sid, ttlFor(sess)), cb);
    }

    destroy(sid, cb) {
      settle(this.client.del(this.prefix + sid), cb);
    }
  }

  /** In-memory store that evicts expired sessions periodically. */
  class PruningMemoryStore extends Store {
    /**
     * @param {Object} [options] - Options
     * @param {number} [options.pruneIntervalMs=60000] - Eviction interval
     */
    constructor({ pruneIntervalMs = 60 * 1000 } = {}) {
      super();
      /** @private {!Map<string, {data: string, expiresAt: number}>} */
      this.sessions_ = new Map();
      this.timer_ = setInterval(() => this.prune(), pruneIntervalMs);
      this.timer_.unref();
    }

    /** Removes expired sessions. @return {number} Number evicted */
    prune() {
      const now = Date.now();
      let evicted = 0;
      for (const [sid, entry] of this.sessions_) {
        if (entry.expiresAt <= now) {
          this.sessions_.delete(sid);
          evicted++;
        }
      }
      return evicted;
    }

    /** Stops the eviction timer. */
    close() {
      clearInterval(this.timer_);
    }

    get(sid, cb) {
      const entry = this.sessions_.get(sid);
      if (!entry) return cb && cb(null, null);
      if (entry.expiresAt <= Date.now()) {
        this.sessions_.delete(sid);
        return cb && cb(null, null);
      }
      return cb && cb(null, JSON.parse(entry.data));
    }

    set(sid, sess, cb) {
      this.sessions_.set(sid, { data: JSON.stringify(sess), expiresAt: Date.now() + ttlFor(sess) });
      if (cb) cb(null);
    }

    touch(sid, sess, cb) {
      const entry = this.sessions_.get(sid);
      if (entry) entry.expiresAt = Date.now() + ttlFor(sess);
      if (cb) cb(null);
    }

    destroy(sid, cb) {
      this.sessions_.delete(sid);
      if (cb) cb(null);
    }

    length(cb) {
      this.prune();
      if (cb) cb(null, this.sessions_.size);
    }
  }

  return { RedisSessionStore, PruningMemoryStore };
}

/**
 * Creates the session store for the application.
 *
 * @param {Function} session - The express-session module
 * @param {Object} [options] - Options
 * @param {string} [options.redisUrl] - Redis URL; defaults to SESSION_REDIS_URL or REDIS_URL
 * @param {Object} [options.redisClient] - Pre-built ioredis client (tests)
 * @param {Object} [options.logger] - Logging service
 * @return {{store: Object, type: 'redis'|'memory', close: function(): Promise<void>}}
 *     The store, its type, and a close function for graceful shutdown
 *
 * @example
 * const { store } = createSessionStore(session, { logger: log });
 * app.use(session({ store, secret, ... }));
 */
function createSessionStore(session, options = {}) {
  const { RedisSessionStore, PruningMemoryStore } = defineStores(session);
  const redisUrl = options.redisUrl || process.env.SESSION_REDIS_URL || process.env.REDIS_URL;
  const logger = options.logger;

  if (options.redisClient || redisUrl) {
    let client = options.redisClient;
    if (!client) {
      const Redis = require('ioredis');
      client = new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: 3 });
      client.on('error', (err) => logger?.error?.('[SessionStore] Redis error', { error: err.message }));
    }
    return {
      type: 'redis',
      store: new RedisSessionStore({ client, prefix: process.env.SESSION_REDIS_PREFIX || 'sess:' }),
      close: async () => { if (!options.redisClient) await client.quit().catch(() => client.disconnect()); }
    };
  }

  const store = new PruningMemoryStore();
  return { type: 'memory', store, close: async () => store.close() };
}

module.exports = { createSessionStore, defineStores, ttlFor };
