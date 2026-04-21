/**
 * @fileoverview Tests for Bulk Operations Utility Module
 * Comprehensive test suite for bulk operations functionality
 */

'use strict';

const BulkOperations = require('../../../src/appservice/utils/bulkOperations');

describe('BulkOperations', () => {
  describe('execute()', () => {
    it('should execute operation on all items', async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const handler = jest.fn(async (item) => ({ success: true }));

      const result = await BulkOperations.execute(items, handler);

      expect(result.totalItems).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should process items in batches', async () => {
      const items = Array.from({ length: 250 }, (_, i) => ({ id: i + 1 }));
      const handler = jest.fn(async (item) => ({ success: true }));

      const result = await BulkOperations.execute(items, handler, { batchSize: 100 });

      expect(result.totalItems).toBe(250);
      expect(result.successCount).toBe(250);
      expect(result.batches.total).toBe(3); // 250 / 100 = 2.5, rounded up to 3
    });

    it('should handle errors in items', async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const handler = jest.fn(async (item) => {
        if (item.id === 2) {
          return { success: false, error: 'Item 2 failed' };
        }
        return { success: true };
      });

      const result = await BulkOperations.execute(items, handler);

      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should call progress callback', async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const handler = jest.fn(async (item) => ({ success: true }));
      const onProgress = jest.fn();

      await BulkOperations.execute(items, handler, { onProgress });

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        processed: expect.any(Number),
        total: 3,
        percentage: expect.any(Number)
      }));
    });

    it('should support dry-run mode', async () => {
      const items = [{ id: 1 }, { id: 2 }];
      const handler = jest.fn();

      const result = await BulkOperations.execute(items, handler, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.successCount).toBe(2);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should stop on error when configured', async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const handler = jest.fn(async (item) => {
        if (item.id === 2) {
          throw new Error('Item 2 error');
        }
        return { success: true };
      });

      await expect(
        BulkOperations.execute(items, handler, { stopOnError: true })
      ).rejects.toThrow('Item 2 error');
    });

    it('should continue on error by default', async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const handler = jest.fn(async (item) => {
        if (item.id === 2) {
          throw new Error('Item 2 error');
        }
        return { success: true };
      });

      const result = await BulkOperations.execute(items, handler);

      expect(result.errorCount).toBe(1);
      expect(result.successCount).toBeGreaterThan(0);
    });
  });

  describe('bulkDelete()', () => {
    it('should delete multiple items', async () => {
      const ids = [1, 2, 3];
      const deleteHandler = jest.fn(async (id) => {
        return { deleted: true };
      });

      const result = await BulkOperations.bulkDelete(ids, deleteHandler);

      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(deleteHandler).toHaveBeenCalledTimes(3);
    });

    it('should handle delete errors', async () => {
      const ids = [1, 2, 3];
      const deleteHandler = jest.fn(async (id) => {
        if (id === 2) {
          throw new Error('Delete failed');
        }
        return { deleted: true };
      });

      const result = await BulkOperations.bulkDelete(ids, deleteHandler);

      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('bulkUpdate()', () => {
    it('should update multiple items', async () => {
      const items = [
        { id: 1, value: 'a' },
        { id: 2, value: 'b' },
        { id: 3, value: 'c' }
      ];
      const updateHandler = jest.fn(async (item) => {
        return { ...item, updated: true };
      });

      const result = await BulkOperations.bulkUpdate(items, updateHandler);

      expect(result.successCount).toBe(3);
      expect(updateHandler).toHaveBeenCalledTimes(3);
    });

    it('should track individual update results', async () => {
      const items = [{ id: 1 }, { id: 2 }];
      const updateHandler = jest.fn(async (item) => item);

      const result = await BulkOperations.bulkUpdate(items, updateHandler);

      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual(expect.objectContaining({
        status: 'success'
      }));
    });
  });

  describe('createCancellable()', () => {
    it('should create cancellable operation', async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const handler = jest.fn(async (item) => ({ success: true }));

      const operation = BulkOperations.createCancellable(items, handler);

      expect(operation.cancel).toBeDefined();
      expect(operation.promise).toBeDefined();
      expect(typeof operation.promise.then).toBe('function');
    });

    it('should support cancellation', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
      let callCount = 0;
      const handler = jest.fn(async (item) => {
        callCount++;
        if (callCount === 50) {
          operation.cancel();
        }
        return { success: true };
      });

      const operation = BulkOperations.createCancellable(items, handler);
      const result = await operation.promise;

      expect(result.cancelled).toBe(true);
      expect(callCount).toBeLessThan(items.length);
    });

    it('should support onProgress callback', async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const handler = jest.fn(async (item) => ({ success: true }));
      const progressCallback = jest.fn();

      const operation = BulkOperations.createCancellable(items, handler);
      operation.onProgress(progressCallback);

      await operation.promise;

      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('validate()', () => {
    it('should validate required fields', () => {
      const items = [{ id: 1, name: 'a' }, { id: 2 }];
      const schema = { requiredFields: ['id', 'name'] };

      const result = BulkOperations.validate(items, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should run custom validator', () => {
      const items = [{ id: 1, value: 10 }, { id: 2, value: -5 }];
      const schema = {
        customValidator: (item) => {
          if (item.value < 0) {
            return ['Value must be positive'];
          }
          return [];
        }
      };

      const result = BulkOperations.validate(items, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('positive'))).toBe(true);
    });

    it('should return valid for correct items', () => {
      const items = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
      const schema = { requiredFields: ['id', 'name'] };

      const result = BulkOperations.validate(items, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getProgress()', () => {
    it('should calculate progress from result', () => {
      const result = {
        totalItems: 100,
        successCount: 75,
        errorCount: 25,
        successPercentage: 75,
        duration: 5000,
        batches: { completed: 1, failed: 0 }
      };

      const progress = BulkOperations.getProgress(result);

      expect(progress.total).toBe(100);
      expect(progress.completed).toBe(100);
      expect(progress.successful).toBe(75);
      expect(progress.failed).toBe(25);
    });

    it('should calculate percentage correctly', () => {
      const result = {
        totalItems: 50,
        successCount: 40,
        errorCount: 10,
        successPercentage: 80,
        duration: 1000
      };

      const progress = BulkOperations.getProgress(result);

      expect(progress.percentage).toBe(80);
    });
  });

  describe('getSummary()', () => {
    it('should generate summary statistics', () => {
      const result = {
        totalItems: 1000,
        successCount: 950,
        errorCount: 50,
        successPercentage: 95,
        duration: 10000
      };

      const summary = BulkOperations.getSummary(result);

      expect(summary.totalItems).toBe(1000);
      expect(summary.successful).toBe(950);
      expect(summary.failed).toBe(50);
      expect(summary.successRate).toBe(95);
      expect(summary.itemsPerSecond).toBe(100);
    });

    it('should handle dry-run flag', () => {
      const result = {
        totalItems: 100,
        successCount: 100,
        errorCount: 0,
        successPercentage: 100,
        duration: 0,
        dryRun: true
      };

      const summary = BulkOperations.getSummary(result);

      expect(summary.dryRun).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw on invalid items', async () => {
      const handler = jest.fn();

      await expect(
        BulkOperations.execute('not-an-array', handler)
      ).rejects.toThrow('Items must be an array');
    });

    it('should throw on invalid handler', async () => {
      const items = [{ id: 1 }];

      await expect(
        BulkOperations.execute(items, 'not-a-function')
      ).rejects.toThrow('Operation handler must be a function');
    });

    it('should throw on invalid validation items', () => {
      const result = BulkOperations.validate('not-an-array');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('array');
    });
  });

  describe('batch completion callback', () => {
    it('should call onBatchComplete callback', async () => {
      const items = Array.from({ length: 250 }, (_, i) => ({ id: i + 1 }));
      const handler = jest.fn(async (item) => ({ success: true }));
      const onBatchComplete = jest.fn();

      await BulkOperations.execute(items, handler, {
        batchSize: 100,
        onBatchComplete
      });

      expect(onBatchComplete).toHaveBeenCalled();
      expect(onBatchComplete.mock.calls.length).toBeGreaterThan(0);
    });
  });
});
