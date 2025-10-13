/**
 * @fileoverview Auth Analytics Module
 * Collects login activity metrics keyed by username without mutating provider logic.
 */

'use strict';

class AuthAnalytics {
  constructor(eventEmitter) {
    /** @private @const {Map<string, {
     *   username: string,
     *   loginCount: number,
     *   failedCount: number,
     *   lastLoginAt: number|null,
     *   lastLoginIso: string|null
     * }>} */
    this.userStats_ = new Map();

    if (eventEmitter) {
      this.bindEvents_(eventEmitter);
    }
  }

  bindEvents_(eventEmitter) {
    eventEmitter.on('auth:login', ({ username }) => {
      this.recordLogin(username);
    });

    eventEmitter.on('auth:login-failed', ({ username }) => {
      this.recordFailure(username);
    });

    eventEmitter.on('auth:logout', ({ username }) => {
      this.ensureUser_(username);
    });

    eventEmitter.on('auth:user-created', ({ username }) => {
      this.ensureUser_(username);
    });

    eventEmitter.on('auth:user-deleted', ({ username }) => {
      if (username && this.userStats_.has(username)) {
        this.userStats_.delete(username);
      }
    });
  }

  ensureUser_(username) {
    if (!username) {
      return null;
    }

    let stats = this.userStats_.get(username);
    if (!stats) {
      stats = {
        username,
        loginCount: 0,
        failedCount: 0,
        lastLoginAt: null,
        lastLoginIso: null
      };
      this.userStats_.set(username, stats);
    }
    return stats;
  }

  recordLogin(username) {
    const stats = this.ensureUser_(username);
    if (!stats) {
      return;
    }
    stats.loginCount += 1;
    const now = Date.now();
    stats.lastLoginAt = now;
    stats.lastLoginIso = new Date(now).toISOString();
  }

  recordFailure(username) {
    const stats = this.ensureUser_(username);
    if (!stats) {
      return;
    }
    stats.failedCount += 1;
  }

  getTopUsers(limit = 10) {
    const effectiveLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
    return [...this.userStats_.values()]
      .sort((a, b) => {
        if (b.loginCount !== a.loginCount) {
          return b.loginCount - a.loginCount;
        }
        const aTime = a.lastLoginAt || 0;
        const bTime = b.lastLoginAt || 0;
        return bTime - aTime;
      })
      .slice(0, effectiveLimit)
      .map((stats) => ({
        username: stats.username,
        loginCount: stats.loginCount,
        failedCount: stats.failedCount,
        lastLogin: stats.lastLoginIso
      }));
  }

  getTopByRecency(limit = 100) {
    const effectiveLimit = Number.isInteger(limit) && limit > 0 ? limit : 100;
    return [...this.userStats_.values()]
      .sort((a, b) => {
        const aTime = a.lastLoginAt || 0;
        const bTime = b.lastLoginAt || 0;
        if (bTime !== aTime) {
          return bTime - aTime;
        }
        return b.loginCount - a.loginCount;
      })
      .slice(0, effectiveLimit)
      .map((stats) => ({
        username: stats.username,
        loginCount: stats.loginCount,
        failedCount: stats.failedCount,
        lastLogin: stats.lastLoginIso
      }));
  }

  getOverview() {
    let totalLogins = 0;
    let totalFailures = 0;
    let recent = 0;

    this.userStats_.forEach((stats) => {
      totalLogins += stats.loginCount;
      totalFailures += stats.failedCount;
      if (stats.lastLoginAt && stats.lastLoginAt > recent) {
        recent = stats.lastLoginAt;
      }
    });

    return {
      totalUsers: this.userStats_.size,
      totalLogins,
      totalFailures,
      lastLoginAt: recent ? new Date(recent).toISOString() : null,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = AuthAnalytics;
