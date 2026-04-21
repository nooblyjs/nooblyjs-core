/**
 * @fileoverview Bulk Operations Utility Module
 * Provides framework for performing bulk operations (delete, update) with progress tracking
 * and comprehensive error handling.
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Bulk Operations utility class for managing large-scale operations across multiple records.
 * Supports delete, update, and custom operations with progress tracking and error recovery.
 *
 * @class
 */
class BulkOperations {
  /**
   * Perform bulk operation on multiple items.
   * @static
   * @param {Array<Object>} items - Items to operate on
   * @param {Function} operationHandler - Async function to handle individual item
   * @param {Object} [options={}] - Operation options
   * @param {number} [options.batchSize=100] - Number of items per batch
   * @param {boolean} [options.stopOnError=false] - Stop if any error occurs
   * @param {Function} [options.onProgress] - Progress callback
   * @param {Function} [options.onBatchComplete] - Batch completion callback
   * @param {boolean} [options.dryRun=false] - Simulate without changes
   * @return {Promise<Object>} Operation result with statistics
   */
  static async execute(items, operationHandler, options = {}) {
    const {
      batchSize = 100,
      stopOnError = false,
      onProgress = null,
      onBatchComplete = null,
      dryRun = false
    } = options;

    if (!Array.isArray(items)) {
      throw new Error('Items must be an array');
    }

    if (typeof operationHandler !== 'function') {
      throw new Error('Operation handler must be a function');
    }

    const result = {
      dryRun,
      totalItems: items.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      results: [],
      startTime: new Date(),
      batches: {
        completed: 0,
        failed: 0,
        total: Math.ceil(items.length / batchSize)
      }
    };

    // Process items in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);

      try {
        for (const item of batch) {
          try {
            if (dryRun) {
              result.successCount++;
              result.results.push({ item, status: 'simulated' });
            } else {
              const itemResult = await operationHandler(item);
              if (itemResult.success || itemResult.success !== false) {
                result.successCount++;
                result.results.push({ item, status: 'success', data: itemResult });
              } else {
                result.errorCount++;
                result.errors.push({
                  item,
                  error: itemResult.error || 'Operation failed',
                  status: 'failed'
                });

                if (stopOnError) {
                  throw new Error(`Operation failed for item: ${itemResult.error}`);
                }
              }
            }
          } catch (itemError) {
            result.errorCount++;
            result.errors.push({
              item,
              error: itemError.message,
              status: 'error'
            });

            if (stopOnError) {
              throw itemError;
            }
          }

          // Progress callback
          if (onProgress && typeof onProgress === 'function') {
            onProgress({
              processed: result.successCount + result.errorCount,
              total: items.length,
              percentage: Math.round(((result.successCount + result.errorCount) / items.length) * 100),
              batch: batchIndex + 1,
              totalBatches: result.batches.total
            });
          }
        }

        result.batches.completed++;

        // Batch completion callback
        if (onBatchComplete && typeof onBatchComplete === 'function') {
          onBatchComplete({
            batchIndex: batchIndex + 1,
            batchSize: batch.length,
            totalBatches: result.batches.total,
            successCount: result.successCount,
            errorCount: result.errorCount
          });
        }
      } catch (batchError) {
        result.batches.failed++;

        if (stopOnError) {
          result.endTime = new Date();
          result.duration = result.endTime - result.startTime;
          throw batchError;
        }
      }
    }

    result.endTime = new Date();
    result.duration = result.endTime - result.startTime;
    result.successPercentage = items.length > 0 ? Math.round((result.successCount / items.length) * 100) : 0;

    return result;
  }

  /**
   * Perform bulk delete operation.
   * @static
   * @param {Array<string|Object>} ids - IDs or objects to delete
   * @param {Function} deleteHandler - Async function to delete individual item
   * @param {Object} [options={}] - Delete options
   * @return {Promise<Object>} Delete result statistics
   */
  static async bulkDelete(ids, deleteHandler, options = {}) {
    if (!Array.isArray(ids)) {
      throw new Error('IDs must be an array');
    }

    const operationHandler = async (id) => {
      try {
        await deleteHandler(id);
        return { success: true, operation: 'delete' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    return this.execute(ids, operationHandler, {
      ...options,
      onProgress: options.onProgress
    });
  }

  /**
   * Perform bulk update operation.
   * @static
   * @param {Array<Object>} items - Items to update (should have id field)
   * @param {Function} updateHandler - Async function to update individual item
   * @param {Object} [options={}] - Update options
   * @return {Promise<Object>} Update result statistics
   */
  static async bulkUpdate(items, updateHandler, options = {}) {
    if (!Array.isArray(items)) {
      throw new Error('Items must be an array');
    }

    const operationHandler = async (item) => {
      try {
        const result = await updateHandler(item);
        return { success: true, operation: 'update', data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    return this.execute(items, operationHandler, options);
  }

  /**
   * Create a cancellable bulk operation.
   * @static
   * @param {Array<Object>} items - Items to process
   * @param {Function} operationHandler - Async function to handle individual item
   * @param {Object} [options={}] - Operation options
   * @return {Object} Cancellable operation object
   */
  static createCancellable(items, operationHandler, options = {}) {
    let cancelled = false;
    let progressCallback = null;

    const operation = {
      cancelled: false,
      promise: null,
      cancel: function() {
        cancelled = true;
        this.cancelled = true;
      },
      onProgress: function(callback) {
        progressCallback = callback;
        return this;
      }
    };

    // Create the main promise
    operation.promise = (async () => {
      if (cancelled) {
        return { cancelled: true, totalItems: items.length, successCount: 0, errorCount: 0 };
      }

      const { batchSize = 100 } = options;
      const result = {
        totalItems: items.length,
        successCount: 0,
        errorCount: 0,
        cancelled: false,
        results: []
      };

      for (let i = 0; i < items.length; i += batchSize) {
        if (cancelled) {
          result.cancelled = true;
          break;
        }

        const batch = items.slice(i, i + batchSize);

        for (const item of batch) {
          if (cancelled) {
            result.cancelled = true;
            break;
          }

          try {
            const itemResult = await operationHandler(item);
            if (itemResult.success !== false) {
              result.successCount++;
            } else {
              result.errorCount++;
            }
            result.results.push({ item, status: itemResult.success ? 'success' : 'failed' });
          } catch (error) {
            result.errorCount++;
            result.results.push({ item, status: 'error', error: error.message });
          }

          // Progress callback
          if (progressCallback && typeof progressCallback === 'function') {
            progressCallback({
              processed: result.successCount + result.errorCount,
              total: items.length,
              percentage: Math.round(((result.successCount + result.errorCount) / items.length) * 100)
            });
          }
        }
      }

      return result;
    })();

    return operation;
  }

  /**
   * Validate bulk operation inputs.
   * @static
   * @param {Array<Object>} items - Items to validate
   * @param {Object} [schema={}] - Validation schema
   * @param {Array<string>} [schema.requiredFields] - Required fields
   * @param {Function} [schema.customValidator] - Custom validation function
   * @return {Object} Validation result {valid: boolean, errors: Array}
   */
  static validate(items, schema = {}) {
    const { requiredFields = [], customValidator = null } = schema;
    const errors = [];

    if (!Array.isArray(items)) {
      return { valid: false, errors: ['Items must be an array'] };
    }

    items.forEach((item, index) => {
      if (typeof item !== 'object' || item === null) {
        errors.push(`Item ${index}: Must be an object`);
        return;
      }

      // Check required fields
      requiredFields.forEach(field => {
        if (!(field in item) || item[field] === null || item[field] === undefined) {
          errors.push(`Item ${index}: Missing required field "${field}"`);
        }
      });

      // Custom validation
      if (customValidator && typeof customValidator === 'function') {
        try {
          const customErrors = customValidator(item, index);
          if (customErrors && Array.isArray(customErrors)) {
            errors.push(...customErrors.map(e => `Item ${index}: ${e}`));
          }
        } catch (error) {
          errors.push(`Item ${index}: Custom validation error: ${error.message}`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      itemCount: items.length,
      errorCount: errors.length
    };
  }

  /**
   * Get operation progress from result object.
   * @static
   * @param {Object} result - Operation result
   * @return {Object} Progress information
   */
  static getProgress(result) {
    return {
      total: result.totalItems,
      completed: result.successCount + result.errorCount,
      successful: result.successCount,
      failed: result.errorCount,
      percentage: result.successPercentage || 0,
      duration: result.duration || null,
      batchesCompleted: result.batches?.completed || 0,
      batchesFailed: result.batches?.failed || 0
    };
  }

  /**
   * Get summary statistics from operation result.
   * @static
   * @param {Object} result - Operation result
   * @return {Object} Summary statistics
   */
  static getSummary(result) {
    return {
      totalItems: result.totalItems,
      successful: result.successCount,
      failed: result.errorCount,
      successRate: result.successPercentage || 0,
      duration: result.duration,
      itemsPerSecond: result.duration ? Math.round(result.totalItems / (result.duration / 1000)) : 0,
      dryRun: result.dryRun || false,
      cancelled: result.cancelled || false,
      errors: result.errors?.length || 0
    };
  }
}

module.exports = BulkOperations;
