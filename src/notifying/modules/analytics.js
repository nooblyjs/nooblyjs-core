/**
 * @fileoverview Notifying Analytics Module
 * Listens to notification events and captures aggregate statistics about topics,
 * subscribers, and notification activity for dashboard consumption.
 *
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Analytics helper for the notifying service.
 * Maintains per-topic statistics without mutating provider behavior.
 * Supports instance-specific analytics tracking through instanceName parameter.
 */
class NotifyingAnalytics {
  /**
   * @param {EventEmitter} eventEmitter Global event emitter instance.
   * @param {Object} notifier Notifying provider instance.
   * @param {string} [instanceName='default'] The instance name this analytics module tracks.
   */
  constructor(eventEmitter, notifier, instanceName = 'default') {
    /** @private @type {Map<string, {
     *   topic: string,
     *   subscriberCount: number,
     *   notificationCount: number,
     *   lastNotificationAt: number|null,
     *   lastNotificationIso: string|null,
     *   lastUpdated: number,
     *   createdAt: number
     * }>} */
    this.topicStats_ = new Map();

    /** @private */
    this.eventEmitter_ = eventEmitter;
    /** @private */
    this.notifier_ = notifier;
    /** @private */
    this.useEventCounting_ = true;
    /** @private */
    this.instanceName_ = instanceName;

    if (this.notifier_) {
      this.initializeFromProvider_(this.notifier_);
      this.wrapNotifier_(this.notifier_);
    }

    if (this.eventEmitter_) {
      this.initializeListeners_(this.eventEmitter_);
    }
  }

  /**
   * Seeds analytics state with existing provider topics.
   * @param {Object} notifier
   * @private
   */
  initializeFromProvider_(notifier) {
    if (!notifier || !(notifier.topics instanceof Map)) {
      return;
    }

    const now = Date.now();
    notifier.topics.forEach((subscribers, topicName) => {
      const stat = this.ensureTopic_(topicName, now);
      stat.subscriberCount = subscribers instanceof Set ? subscribers.size : 0;
      stat.lastUpdated = now;
      this.topicStats_.set(topicName, stat);
    });
  }

  /**
   * Registers listeners for notifying events.
   * Listens to instance-specific events based on instanceName.
   * @param {EventEmitter} eventEmitter
   * @private
   */
  initializeListeners_(eventEmitter) {
    const createTopicEvent = `notification:createTopic:${this.instanceName_}`;
    const subscribeEvent = `notification:subscribe:${this.instanceName_}`;
    const unsubscribeEvent = `notification:unsubscribe:${this.instanceName_}`;
    const notifyEvent = `notification:notify:${this.instanceName_}`;

    eventEmitter.on(createTopicEvent, ({ topicName }) => {
      this.ensureTopic_(topicName);
      this.syncTopicSnapshot_(topicName);
    });

    eventEmitter.on(subscribeEvent, ({ topicName }) => {
      this.syncTopicSnapshot_(topicName);
    });

    eventEmitter.on(unsubscribeEvent, ({ topicName }) => {
      this.syncTopicSnapshot_(topicName);
    });

    eventEmitter.on(notifyEvent, ({ topicName }) => {
      if (this.useEventCounting_) {
        this.recordNotification_(topicName);
      } else {
        this.ensureTopic_(topicName);
      }
    });
  }

  /**
   * Wraps the provider notify method to capture publish events once per call.
   * @param {Object} notifier
   * @private
   */
  wrapNotifier_(notifier) {
    if (
      !notifier ||
      typeof notifier.notify !== 'function' ||
      notifier.notify.__analyticsWrapped
    ) {
      return;
    }

    const originalNotify = notifier.notify.bind(notifier);
    const analytics = this;

    const wrapped = async function(topicName, message) {
      const result = await originalNotify(topicName, message);
      if (analytics.hasProviderTopic_(topicName)) {
        analytics.recordNotification_(topicName);
      } else {
        analytics.ensureTopic_(topicName);
      }
      return result;
    };

    Object.defineProperty(wrapped, '__analyticsWrapped', {
      value: true,
      enumerable: false,
      configurable: false,
    });

    notifier.notify = wrapped;
    this.useEventCounting_ = false;
  }

  /**
   * Ensures topic stats exist for a topic name.
   * @param {string} topicName
   * @param {number=} timestamp
   * @return {?Object}
   * @private
   */
  ensureTopic_(topicName, timestamp = Date.now()) {
    if (!topicName) {
      return null;
    }

    let stat = this.topicStats_.get(topicName);
    if (!stat) {
      stat = {
        topic: topicName,
        subscriberCount: 0,
        notificationCount: 0,
        lastNotificationAt: null,
        lastNotificationIso: null,
        lastUpdated: timestamp,
        createdAt: timestamp,
      };
      this.topicStats_.set(topicName, stat);
    }
    return stat;
  }

  /**
   * Synchronizes subscriber counts from the provider map.
   * @param {string} topicName
   * @private
   */
  syncTopicSnapshot_(topicName) {
    const stat = this.ensureTopic_(topicName);
    if (!stat) {
      return;
    }

    stat.subscriberCount = this.getSubscriberCountFromProvider_(topicName);
    stat.lastUpdated = Date.now();
    this.topicStats_.set(topicName, stat);
  }

  /**
   * Records a notification publish event.
   * @param {string} topicName
   * @private
   */
  recordNotification_(topicName) {
    const stat = this.ensureTopic_(topicName);
    if (!stat) {
      return;
    }

    const now = Date.now();
    stat.notificationCount += 1;
    stat.lastNotificationAt = now;
    stat.lastNotificationIso = new Date(now).toISOString();
    stat.subscriberCount = this.getSubscriberCountFromProvider_(topicName);
    stat.lastUpdated = now;
    this.topicStats_.set(topicName, stat);
  }

  /**
   * Returns subscriber count for a topic based on provider state.
   * @param {string} topicName
   * @return {number}
   * @private
   */
  getSubscriberCountFromProvider_(topicName) {
    if (
      this.notifier_ &&
      this.notifier_.topics instanceof Map &&
      this.notifier_.topics.has(topicName)
    ) {
      const subscribers = this.notifier_.topics.get(topicName);
      if (subscribers instanceof Set) {
        return subscribers.size;
      }
      if (Array.isArray(subscribers)) {
        return subscribers.length;
      }
    }

    const stat = this.topicStats_.get(topicName);
    return stat ? stat.subscriberCount : 0;
  }

  /**
   * Determines if the provider currently tracks the topic.
   * @param {string} topicName
   * @return {boolean}
   * @private
   */
  hasProviderTopic_(topicName) {
    return Boolean(
      this.notifier_ &&
        this.notifier_.topics instanceof Map &&
        this.notifier_.topics.has(topicName),
    );
  }

  /**
   * Provides aggregate overview statistics.
   * @return {{topics: number, subscribers: number, notifications: number, lastNotificationAt: (string|null), generatedAt: string}}
   */
  getOverview() {
    let subscribers = 0;
    let notifications = 0;
    let mostRecent = 0;

    this.topicStats_.forEach((stat) => {
      subscribers += stat.subscriberCount;
      notifications += stat.notificationCount;
      if (stat.lastNotificationAt && stat.lastNotificationAt > mostRecent) {
        mostRecent = stat.lastNotificationAt;
      }
    });

    return {
      topics: this.topicStats_.size,
      subscribers,
      notifications,
      lastNotificationAt: mostRecent ? new Date(mostRecent).toISOString() : null,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns the most active topics ordered by notification count.
   * @param {number=} limit
   * @return {Array<Object>}
   */
  getTopTopics(limit = 10) {
    const effectiveLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;

    return [...this.topicStats_.values()]
      .sort((a, b) => {
        if (b.notificationCount !== a.notificationCount) {
          return b.notificationCount - a.notificationCount;
        }
        const aTime = a.lastNotificationAt || 0;
        const bTime = b.lastNotificationAt || 0;
        if (bTime !== aTime) {
          return bTime - aTime;
        }
        return a.topic.localeCompare(b.topic);
      })
      .slice(0, effectiveLimit)
      .map((stat) => this.serializeTopic_(stat));
  }

  /**
   * Returns topic details ordered by last notification timestamp.
   * @param {number=} limit
   * @return {Array<Object>}
   */
  getTopicDetails(limit = 100) {
    const effectiveLimit = Number.isInteger(limit) && limit > 0 ? limit : 100;

    return [...this.topicStats_.values()]
      .sort((a, b) => {
        const aTime = a.lastNotificationAt || 0;
        const bTime = b.lastNotificationAt || 0;
        if (bTime !== aTime) {
          return bTime - aTime;
        }
        if (b.notificationCount !== a.notificationCount) {
          return b.notificationCount - a.notificationCount;
        }
        return a.topic.localeCompare(b.topic);
      })
      .slice(0, effectiveLimit)
      .map((stat) => this.serializeTopic_(stat));
  }

  /**
   * Serializes topic statistics to a response-friendly payload.
   * @param {Object} stat
   * @return {{topic: string, subscriberCount: number, notificationCount: number, lastNotificationAt: (string|null), createdAt: string}}
   * @private
   */
  serializeTopic_(stat) {
    return {
      topic: stat.topic,
      subscriberCount: stat.subscriberCount,
      notificationCount: stat.notificationCount,
      lastNotificationAt: stat.lastNotificationIso,
      createdAt: new Date(stat.createdAt).toISOString(),
    };
  }
}

module.exports = NotifyingAnalytics;
