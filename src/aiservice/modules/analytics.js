/**
 * @fileoverview AI Prompt Analytics Module
 * Tracks prompt activity, token usage, and recency without mutating providers.
 */

'use strict';

class AIPromptAnalytics {
  constructor(eventEmitter) {
    /** @private @type {Map<string, {
     *   prompt: string,
     *   username: string,
     *   calls: number,
     *   promptTokens: number,
     *   completionTokens: number,
     *   totalTokens: number,
     *   lastPromptAt: number,
     *   lastPromptIso: string,
     *   model: string|null,
     *   provider: string|null
     * }>} */
    this.promptStats_ = new Map();
    /** @private @const {number} */
    this.maxEntries_ = 2000;

    if (eventEmitter) {
      eventEmitter.on('ai:prompt:complete', (data = {}) => {
        this.recordPrompt({
          prompt: data.prompt,
          username: data.username,
          promptTokens: this.normalizeNumber_(data.promptTokens ?? data.usage?.promptTokens ?? data.usage?.prompt_tokens),
          completionTokens: this.normalizeNumber_(data.completionTokens ?? data.usage?.completionTokens ?? data.usage?.completion_tokens),
          totalTokens: this.normalizeNumber_(data.totalTokens ?? data.usage?.totalTokens ?? data.usage?.total_tokens),
          model: data.model || data.response?.model || null,
          provider: data.provider || data.response?.provider || null,
          timestamp: data.timestamp || Date.now()
        });
      });
    }
  }

  /**
   * Normalizes numeric input to a non-negative number.
   * @param {*} value
   * @return {number}
   * @private
   */
  normalizeNumber_(value) {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  }

  /**
   * Ensures we have a stats bucket for a given prompt/username.
   * @param {string} prompt
   * @param {string} username
   * @return {?Object}
   * @private
   */
  ensurePrompt_(prompt, username) {
    if (!prompt) {
      return null;
    }
    const normalizedPrompt = String(prompt);
    const normalizedUsername = username ? String(username).trim() || 'anonymous' : 'anonymous';
    const key = `${normalizedUsername}::${normalizedPrompt}`;

    if (!this.promptStats_.has(key)) {
      if (this.promptStats_.size >= this.maxEntries_) {
        this.evictOldest_();
      }

      this.promptStats_.set(key, {
        prompt: normalizedPrompt,
        username: normalizedUsername,
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        lastPromptAt: 0,
        lastPromptIso: null,
        model: null,
        provider: null
      });
    }

    return this.promptStats_.get(key);
  }

  /**
   * Removes the least recently used entry from the map.
   * @private
   */
  evictOldest_() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.promptStats_) {
      if (!entry.lastPromptAt) {
        oldestKey = key;
        break;
      }
      if (entry.lastPromptAt < oldestTime) {
        oldestTime = entry.lastPromptAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.promptStats_.delete(oldestKey);
    }
  }

  /**
   * Records a prompt event.
   * @param {Object} data
   * @param {string} data.prompt
   * @param {string=} data.username
   * @param {number=} data.promptTokens
   * @param {number=} data.completionTokens
   * @param {number=} data.totalTokens
   * @param {string=} data.model
   * @param {string=} data.provider
   * @param {number=} data.timestamp
   */
  recordPrompt(data = {}) {
    const entry = this.ensurePrompt_(data.prompt, data.username);
    if (!entry) {
      return;
    }

    const promptTokens = this.normalizeNumber_(data.promptTokens);
    const completionTokens = this.normalizeNumber_(data.completionTokens);
    const totalTokens = this.normalizeNumber_(data.totalTokens || promptTokens + completionTokens);
    const timestamp = Number.isFinite(data.timestamp) ? data.timestamp : Date.now();

    entry.calls += 1;
    entry.promptTokens += promptTokens;
    entry.completionTokens += completionTokens;
    entry.totalTokens += totalTokens;
    entry.lastPromptAt = timestamp;
    entry.lastPromptIso = new Date(timestamp).toISOString();
    entry.model = data.model || entry.model;
    entry.provider = data.provider || entry.provider;
  }

  /**
   * Aggregated overview metrics.
   * @return {Object}
   */
  getOverview() {
    let totalCalls = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let mostRecent = 0;

    this.promptStats_.forEach((entry) => {
      totalCalls += entry.calls;
      totalPromptTokens += entry.promptTokens;
      totalCompletionTokens += entry.completionTokens;
      if (entry.lastPromptAt && entry.lastPromptAt > mostRecent) {
        mostRecent = entry.lastPromptAt;
      }
    });

    return {
      totalPrompts: this.promptStats_.size,
      totalCalls,
      totalPromptTokens,
      totalCompletionTokens,
      lastPromptAt: mostRecent ? new Date(mostRecent).toISOString() : null,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Top prompts ordered by call count.
   * @param {number=} limit
   * @return {Array<Object>}
   */
  getTopPrompts(limit = 10) {
    const effectiveLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
    return [...this.promptStats_.values()]
      .sort((a, b) => {
        if (b.calls !== a.calls) {
          return b.calls - a.calls;
        }
        return (b.lastPromptAt || 0) - (a.lastPromptAt || 0);
      })
      .slice(0, effectiveLimit)
      .map((entry) => ({
        prompt: entry.prompt,
        username: entry.username,
        calls: entry.calls,
        promptTokens: entry.promptTokens,
        completionTokens: entry.completionTokens,
        totalTokens: entry.totalTokens,
        lastPrompt: entry.lastPromptIso,
        model: entry.model,
        provider: entry.provider
      }));
  }

  /**
   * Top prompts ordered by recency.
   * @param {number=} limit
   * @return {Array<Object>}
   */
  getTopRecent(limit = 100) {
    const effectiveLimit = Number.isInteger(limit) && limit > 0 ? limit : 100;
    return [...this.promptStats_.values()]
      .sort((a, b) => {
        const aTime = a.lastPromptAt || 0;
        const bTime = b.lastPromptAt || 0;
        if (bTime !== aTime) {
          return bTime - aTime;
        }
        return b.calls - a.calls;
      })
      .slice(0, effectiveLimit)
      .map((entry) => ({
        prompt: entry.prompt,
        username: entry.username,
        calls: entry.calls,
        promptTokens: entry.promptTokens,
        completionTokens: entry.completionTokens,
        totalTokens: entry.totalTokens,
        lastPrompt: entry.lastPromptIso,
        model: entry.model,
        provider: entry.provider
      }));
  }

  /**
   * Combined analytics payload.
   * @param {Object=} options
   * @param {number=} options.limit
   * @param {number=} options.recentLimit
   * @return {Object}
   */
  getAnalytics(options = {}) {
    const { limit, recentLimit } = options;
    return {
      overview: this.getOverview(),
      topPrompts: this.getTopPrompts(limit),
      topRecent: this.getTopRecent(recentLimit)
    };
  }

  /**
   * Clears stored analytics.
   */
  clear() {
    this.promptStats_.clear();
  }
}

module.exports = AIPromptAnalytics;
