/**
 * @fileoverview Search indexing activity that processes queued items
 * and adds them to the search index.
 *
 * This activity is designed to be run on a schedule (e.g., every 5 seconds)
 * to process batches of items from the noobly-core-searching queue.
 *
 * Note: This activity uses the global serviceRegistry to access services
 * because service instances cannot be passed through worker threads.
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.14
 */

'use strict';

const serviceRegistry = require('../index');

/**
 * Processes items from the search indexing queue and adds them to the search index.
 *
 * @async
 * @function run
 * @param {Object} data - The data passed from the scheduler
 * @param {number} data.batchSize - Maximum number of items to process per run (default: 100)
 * @returns {Promise<Object>} A promise that resolves with processing statistics
 */
async function run(data) {
  const { batchSize = 100 } = data;

  // Get services from the registry (they're already initialized in the main app)
  const searchService = serviceRegistry.searching();
  const queueService = serviceRegistry.queue();

  console.log('Search indexing activity started');

  const startTime = Date.now();
  const queueName = 'noobly-core-searching';
  let processedCount = 0;
  let errorCount = 0;
  const errors = [];

  try {
    // Get queue size
    const queueSize = await queueService.size(queueName);
    console.log(`Queue size: ${queueSize} items`);

    if (queueSize === 0) {
      return {
        message: 'No items to process',
        queueSize: 0,
        processed: 0,
        errors: 0,
        duration: Date.now() - startTime
      };
    }

    // Process up to batchSize items
    const itemsToProcess = Math.min(queueSize, batchSize);
    console.log(`Processing ${itemsToProcess} items...`);

    for (let i = 0; i < itemsToProcess; i++) {
      const item = await queueService.dequeue(queueName);

      if (!item) {
        break; // Queue is empty
      }

      try {
        // Process the item based on operation type
        if (item.operation === 'add') {
          // Use the internal addDirect_ method to bypass queueing
          const added = await searchService.addDirect_(item.key, item.data);
          if (added) {
            processedCount++;
          } else {
            errorCount++;
            errors.push({
              key: item.key,
              error: 'Key already exists or failed to add'
            });
          }
        }
      } catch (error) {
        errorCount++;
        errors.push({
          key: item.key,
          error: error.message
        });
        console.error(`Error processing item ${item.key}:`, error.message);
      }
    }

    const duration = Date.now() - startTime;
    const result = {
      message: 'Search indexing completed',
      queueSize: await queueService.size(queueName),
      processed: processedCount,
      errors: errorCount,
      duration,
      errorDetails: errors.length > 0 ? errors.slice(0, 10) : undefined // Limit error details
    };

    console.log(`Indexed ${processedCount} items in ${duration}ms (${errorCount} errors)`);

    return result;
  } catch (error) {
    console.error('Search indexing activity failed:', error);
    throw error;
  }
}

module.exports = {
  run,
};
