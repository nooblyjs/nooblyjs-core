/**
 * @fileoverview Search service for loading and searching JSON objects
 * with recursive string matching and event emission support.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const analytics = require('../modules/analytics');

/**
 * A class that implements a search service for JSON objects.
 * Provides methods for adding, removing, and searching through stored objects.
 * Supports queue-based indexing with scheduled processing.
 * @class
 */
class SearchService {
  /**
   * Initializes the search service with empty data storage.
   * @param {Object=} options Configuration options.
   * @param {EventEmitter=} eventEmitter Optional event emitter for search events.
   * @param {Object=} dependencies Injected service dependencies.
   */
  constructor(options = {}, eventEmitter, dependencies = {}) {
    /** @private @const {!Map<string, !Object>} */
    this.data = new Map(); // Stores objects with their keys
    /** @private @const {EventEmitter} */
    this.eventEmitter_ = eventEmitter;
    /** @private {Object} Queueing service instance */
    this.queueService_ = dependencies.queueing;
    /** @private {Object} Working service instance */
    this.workingService_ = dependencies.working;
    /** @private {Object} Scheduling service instance */
    this.schedulingService_ = dependencies.scheduling;
    /** @private @const {string} Queue name for indexing tasks */
    this.QUEUE_INDEXING_ = 'noobly-core-searching';

    // Initialize the queue if queueing service is available
    if (this.queueService_) {
      this.initializeQueue_();
    }
  }

  /**
   * Initializes the indexing queue.
   * @private
   */
  async initializeQueue_() {
    // Queue is automatically created when first used
    if (this.eventEmitter_) {
      this.eventEmitter_.emit('search:queue:initialized', {
        queueName: this.QUEUE_INDEXING_
      });
    }
  }

  /**
   * Adds a JSON object to the search service with a unique key.
   * If queueing is enabled, adds to queue instead of direct indexing.
   * @param {string} key The unique key for the JSON object.
   * @param {!Object} jsonObject The JSON object to add.
   * @return {Promise<boolean>} A promise that resolves to true if the object was queued/added, false if the key already exists.
   */
  async add(key, jsonObject) {
    // Track add operation
    analytics.trackAdd();

    // If queueing is enabled, add to queue for batch processing
    if (this.queueService_) {
      await this.queueService_.enqueue(this.QUEUE_INDEXING_, {
        operation: 'add',
        key,
        data: jsonObject,
        timestamp: new Date().toISOString()
      });
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('search:queued', {
          operation: 'add',
          key,
          queueName: this.QUEUE_INDEXING_
        });
      }
      return true;
    }

    // Direct add if no queueing
    return this.addDirect_(key, jsonObject);
  }

  /**
   * Directly adds a JSON object to the search index (used by indexing activity).
   * @param {string} key The unique key for the JSON object.
   * @param {!Object} jsonObject The JSON object to add.
   * @return {Promise<boolean>} A promise that resolves to true if the object was added, false if the key already exists.
   * @private
   */
  async addDirect_(key, jsonObject) {
    if (this.data.has(key)) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('search:add:error', {
          jsonObject: jsonObject,
          key: key,
          error: 'Key already exists.',
        });
      return false;
    }
    this.data.set(key, jsonObject);
    if (this.eventEmitter_)
      this.eventEmitter_.emit('search:add', { jsonObject: jsonObject, key });
    return true;
  }

  /**
   * Removes a JSON object from the search service by its key.
   * @param {string} key The key of the JSON object to remove.
   * @return {Promise<boolean>} A promise that resolves to true if the object was removed, false if the key was not found.
   */
  async remove(key) {
    const removed = this.data.delete(key);
    if (removed) {
      analytics.trackDelete();
      if (this.eventEmitter_)
        this.eventEmitter_.emit('search:remove', { key });
    }
    return removed;
  }

  /**
   * Searches for a term across all string values within the stored JSON objects.
   * The search is case-insensitive and recursive through nested objects.
   * @param {string} searchTerm The term to search for.
   * @return {Promise<Array<!Object>>} A promise that resolves to an array of matching objects with their keys.
   */
  async search(searchTerm) {
    const results = [];
    if (!searchTerm) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('search:search', { searchTerm, results });
      return results;
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    for (const [key, obj] of this.data.entries()) {
      let found = false;

      const searchInObject = (currentObj) => {
        for (const prop in currentObj) {
          if (Object.prototype.hasOwnProperty.call(currentObj, prop)) {
            const value = currentObj[prop];
            if (typeof value === 'string') {
              if (value.toLowerCase().includes(lowerCaseSearchTerm)) {
                found = true;
                return; // Found in this object, no need to search further
              }
            } else if (typeof value === 'object' && value !== null) {
              searchInObject(value); // Recurse for nested objects
              if (found) return; // If found in nested object, stop
            }
          }
        }
      };

      searchInObject(obj);
      if (found) {
        results.push({key, obj});
      }
    }

    // Track search operation with term and result count
    analytics.trackSearch(searchTerm, results.length);

    if (this.eventEmitter_)
      this.eventEmitter_.emit('search:search', { searchTerm, results });
    return results;
  }

  /**
   * Gets statistics about the search service including queue size.
   * @return {Promise<Object>} A promise that resolves to statistics object.
   */
  async getStats() {
    const stats = {
      indexedItems: this.data.size,
      queueName: this.QUEUE_INDEXING_,
      queueSize: 0
    };

    if (this.queueService_) {
      stats.queueSize = await this.queueService_.size(this.QUEUE_INDEXING_);
    }

    return stats;
  }

  /**
   * Starts the scheduled indexing processor.
   * Processes queued items at regular intervals.
   * @param {number} intervalSeconds - Interval in seconds (default: 5)
   * @param {number} batchSize - Maximum items to process per batch (default: 100)
   * @return {Promise<void>} A promise that resolves when indexing is started.
   */
  async startIndexing(intervalSeconds = 5, batchSize = 100) {
    if (this.indexingInterval_) {
      return; // Already started
    }

    if (!this.queueService_) {
      throw new Error('Queueing service is required for scheduled indexing');
    }

    const processQueue = async () => {
      try {
        const queueSize = await this.queueService_.size(this.QUEUE_INDEXING_);

        if (queueSize === 0) {
          return;
        }

        const itemsToProcess = Math.min(queueSize, batchSize);
        let processedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < itemsToProcess; i++) {
          const item = await this.queueService_.dequeue(this.QUEUE_INDEXING_);

          if (!item) {
            break;
          }

          try {
            if (item.operation === 'add') {
              const added = await this.addDirect_(item.key, item.data);
              if (added) {
                processedCount++;
              } else {
                errorCount++;
              }
            }
          } catch (error) {
            errorCount++;
            console.error(`Error indexing item ${item.key}:`, error.message);
          }
        }

        if (this.eventEmitter_ && processedCount > 0) {
          this.eventEmitter_.emit('search:indexed', {
            processed: processedCount,
            errors: errorCount,
            remaining: await this.queueService_.size(this.QUEUE_INDEXING_)
          });
        }
      } catch (error) {
        console.error('Error in indexing processor:', error);
      }
    };

    // Start processing immediately
    processQueue();

    // Then schedule at intervals
    this.indexingInterval_ = setInterval(processQueue, intervalSeconds * 1000);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('search:indexing:started', {
        intervalSeconds,
        batchSize
      });
    }
  }

  /**
   * Stops the scheduled indexing processor.
   * @return {Promise<void>} A promise that resolves when indexing is stopped.
   */
  async stopIndexing() {
    if (this.indexingInterval_) {
      clearInterval(this.indexingInterval_);
      this.indexingInterval_ = null;

      if (this.eventEmitter_) {
        this.eventEmitter_.emit('search:indexing:stopped');
      }
    }
  }
}

module.exports = SearchService;
