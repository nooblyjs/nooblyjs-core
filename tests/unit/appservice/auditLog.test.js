/**
 * @fileoverview Unit tests for Audit Log module
 * Tests audit entry recording, querying, export, and retention policies
 */

'use strict';

const AuditLog = require('../../../src/appservice/modules/auditLog');

describe('Audit Log Module', () => {
  let auditLog;

  beforeEach(() => {
    auditLog = new AuditLog({
      maxEntries: 1000,
      retention: { days: 90 }
    });
  });

  describe('record()', () => {
    it('should record an audit entry', () => {
      const entryId = auditLog.record({
        operation: 'CREATE',
        service: 'dataservice',
        resourceType: 'user',
        resourceId: 'user123',
        userId: 'admin',
        status: 'SUCCESS'
      });

      expect(entryId).toBeDefined();
      expect(typeof entryId).toBe('string');
      expect(auditLog.getCount()).toBe(1);
    });

    it('should record entry with all fields', () => {
      const entryId = auditLog.record({
        operation: 'UPDATE',
        service: 'dataservice',
        resourceType: 'document',
        resourceId: 'doc456',
        userId: 'user123',
        apiKey: 'sk-1234567890abcdef',
        before: { name: 'old' },
        after: { name: 'new' },
        status: 'SUCCESS',
        duration: 125,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      });

      const logs = auditLog.query({});
      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe(entryId);
      expect(logs[0].operation).toBe('UPDATE');
      expect(logs[0].service).toBe('dataservice');
      expect(logs[0].status).toBe('SUCCESS');
      expect(logs[0].duration).toBe(125);
      expect(logs[0].apiKey).toMatch(/^\*+\w{4}$/); // Masked
    });

    it('should set defaults for optional fields', () => {
      auditLog.record({
        operation: 'READ',
        service: 'caching',
        resourceType: 'cache-key',
        resourceId: 'key123'
      });

      const logs = auditLog.query({});
      expect(logs[0].userId).toBe('anonymous');
      expect(logs[0].status).toBe('SUCCESS');
      expect(logs[0].duration).toBe(0);
      expect(logs[0].apiKey).toBeNull();
    });

    it('should record failure with error message', () => {
      auditLog.record({
        operation: 'DELETE',
        service: 'dataservice',
        resourceType: 'user',
        resourceId: 'user999',
        status: 'FAILURE',
        errorMessage: 'User not found'
      });

      const logs = auditLog.query({});
      expect(logs[0].status).toBe('FAILURE');
      expect(logs[0].errorMessage).toBe('User not found');
    });

    it('should generate unique IDs for each entry', () => {
      const id1 = auditLog.record({
        operation: 'CREATE',
        service: 'service1',
        resourceType: 'type1',
        resourceId: 'id1'
      });

      const id2 = auditLog.record({
        operation: 'CREATE',
        service: 'service2',
        resourceType: 'type2',
        resourceId: 'id2'
      });

      expect(id1).not.toBe(id2);
    });

    it('should maintain timestamp in ISO-8601 format', () => {
      auditLog.record({
        operation: 'CREATE',
        service: 'test',
        resourceType: 'test',
        resourceId: 'test'
      });

      const logs = auditLog.query({});
      const timestamp = logs[0].timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('query()', () => {
    beforeEach(() => {
      auditLog.record({
        operation: 'CREATE',
        service: 'dataservice',
        resourceType: 'user',
        resourceId: 'u1',
        userId: 'admin'
      });

      auditLog.record({
        operation: 'UPDATE',
        service: 'dataservice',
        resourceType: 'user',
        resourceId: 'u2',
        userId: 'user123'
      });

      auditLog.record({
        operation: 'DELETE',
        service: 'caching',
        resourceType: 'cache-key',
        resourceId: 'k1',
        userId: 'admin'
      });
    });

    it('should return all entries when no filters provided', () => {
      const results = auditLog.query({});
      expect(results).toHaveLength(3);
    });

    it('should filter by service', () => {
      const results = auditLog.query({ service: 'dataservice' });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.service === 'dataservice')).toBe(true);
    });

    it('should filter by operation', () => {
      const results = auditLog.query({ operation: 'CREATE' });
      expect(results).toHaveLength(1);
      expect(results[0].operation).toBe('CREATE');
    });

    it('should filter by userId', () => {
      const results = auditLog.query({ userId: 'admin' });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.userId === 'admin')).toBe(true);
    });

    it('should filter by resourceType', () => {
      const results = auditLog.query({ resourceType: 'user' });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.resourceType === 'user')).toBe(true);
    });

    it('should filter by status', () => {
      auditLog.record({
        operation: 'UPDATE',
        service: 'test',
        resourceType: 'test',
        resourceId: 'test',
        status: 'FAILURE'
      });

      const results = auditLog.query({ status: 'FAILURE' });
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('FAILURE');
    });

    it('should filter by date range', () => {
      const now = new Date();
      const before = new Date(now.getTime() - 60000); // 1 minute ago
      const after = new Date(now.getTime() + 60000); // 1 minute from now

      const results = auditLog.query({
        since: before,
        until: after
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => {
        const ts = new Date(r.timestamp);
        return ts >= before && ts <= after;
      })).toBe(true);
    });

    it('should combine multiple filters', () => {
      const results = auditLog.query({
        service: 'dataservice',
        userId: 'admin'
      });

      expect(results).toHaveLength(1);
      expect(results[0].service).toBe('dataservice');
      expect(results[0].userId).toBe('admin');
    });

    it('should respect limit parameter', () => {
      const results = auditLog.query({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should return results in reverse chronological order', () => {
      const results = auditLog.query({});
      for (let i = 0; i < results.length - 1; i++) {
        const current = new Date(results[i].timestamp).getTime();
        const next = new Date(results[i + 1].timestamp).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });

  describe('getStats()', () => {
    beforeEach(() => {
      auditLog.record({
        operation: 'CREATE',
        service: 'dataservice',
        resourceType: 'user',
        resourceId: 'u1',
        userId: 'admin',
        status: 'SUCCESS'
      });

      auditLog.record({
        operation: 'UPDATE',
        service: 'dataservice',
        resourceType: 'user',
        resourceId: 'u2',
        userId: 'user123',
        status: 'SUCCESS'
      });

      auditLog.record({
        operation: 'DELETE',
        service: 'dataservice',
        resourceType: 'user',
        resourceId: 'u3',
        userId: 'admin',
        status: 'FAILURE'
      });
    });

    it('should calculate operation counts', () => {
      const stats = auditLog.getStats();
      expect(stats.byOperation.CREATE).toBe(1);
      expect(stats.byOperation.UPDATE).toBe(1);
      expect(stats.byOperation.DELETE).toBe(1);
    });

    it('should calculate status distribution', () => {
      const stats = auditLog.getStats();
      expect(stats.byStatus.SUCCESS).toBe(2);
      expect(stats.byStatus.FAILURE).toBe(1);
    });

    it('should calculate failure rate', () => {
      const stats = auditLog.getStats();
      expect(stats.failureRate).toBe('33.33');
    });

    it('should count by service', () => {
      const stats = auditLog.getStats();
      expect(stats.byService.dataservice).toBe(3);
    });

    it('should count by user', () => {
      const stats = auditLog.getStats();
      expect(stats.byUser.admin).toBe(2);
      expect(stats.byUser.user123).toBe(1);
    });

    it('should return zero stats for empty log', () => {
      const emptyLog = new AuditLog();
      const stats = emptyLog.getStats();
      expect(stats.total).toBe(0);
      expect(stats.failureRate).toBe('0.00');
    });
  });

  describe('export()', () => {
    beforeEach(() => {
      auditLog.record({
        operation: 'CREATE',
        service: 'dataservice',
        resourceType: 'user',
        resourceId: 'u1',
        userId: 'admin'
      });

      auditLog.record({
        operation: 'UPDATE',
        service: 'dataservice',
        resourceType: 'user',
        resourceId: 'u2',
        userId: 'user123'
      });
    });

    it('should export as JSON by default', () => {
      const exported = auditLog.export();
      const data = JSON.parse(exported);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
    });

    it('should export as JSON with explicit format', () => {
      const exported = auditLog.export('json');
      const data = JSON.parse(exported);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should export as CSV', () => {
      const exported = auditLog.export('csv');
      const lines = exported.split('\n');
      expect(lines[0]).toContain('id');
      expect(lines[0]).toContain('timestamp');
      expect(lines[0]).toContain('service');
      expect(lines).toHaveLength(3); // Header + 2 data rows
    });

    it('should export as JSONL', () => {
      const exported = auditLog.export('jsonl');
      const lines = exported.split('\n');
      expect(lines).toHaveLength(2);
      const parsed1 = JSON.parse(lines[0]);
      const parsed2 = JSON.parse(lines[1]);
      expect(parsed1.operation).toBe('UPDATE'); // Reverse order
      expect(parsed2.operation).toBe('CREATE');
    });

    it('should apply filters during export', () => {
      const exported = auditLog.export('json', { userId: 'admin' });
      const data = JSON.parse(exported);
      expect(data).toHaveLength(1);
      expect(data[0].userId).toBe('admin');
    });

    it('should handle empty exports', () => {
      const emptyLog = new AuditLog();
      const exported = emptyLog.export('csv');
      expect(exported).toBe('');
    });
  });

  describe('clear()', () => {
    it('should remove all audit entries', () => {
      auditLog.record({
        operation: 'CREATE',
        service: 'test',
        resourceType: 'test',
        resourceId: 'test'
      });

      expect(auditLog.getCount()).toBe(1);
      auditLog.clear();
      expect(auditLog.getCount()).toBe(0);
    });

    it('should return empty results after clear', () => {
      auditLog.record({
        operation: 'CREATE',
        service: 'test',
        resourceType: 'test',
        resourceId: 'test'
      });

      auditLog.clear();
      const results = auditLog.query({});
      expect(results).toHaveLength(0);
    });
  });

  describe('getCount()', () => {
    it('should return 0 for new log', () => {
      expect(auditLog.getCount()).toBe(0);
    });

    it('should return correct count after records', () => {
      auditLog.record({
        operation: 'CREATE',
        service: 'test',
        resourceType: 'test',
        resourceId: 'test'
      });

      expect(auditLog.getCount()).toBe(1);

      auditLog.record({
        operation: 'UPDATE',
        service: 'test',
        resourceType: 'test',
        resourceId: 'test'
      });

      expect(auditLog.getCount()).toBe(2);
    });
  });

  describe('API Key Masking', () => {
    it('should mask API keys in recorded entries', () => {
      auditLog.record({
        operation: 'CREATE',
        service: 'test',
        resourceType: 'test',
        resourceId: 'test',
        apiKey: 'sk-0123456789abcdef'
      });

      const logs = auditLog.query({});
      expect(logs[0].apiKey).toBe('***cdef');
    });

    it('should handle short API keys', () => {
      auditLog.record({
        operation: 'CREATE',
        service: 'test',
        resourceType: 'test',
        resourceId: 'test',
        apiKey: 'ab'
      });

      const logs = auditLog.query({});
      expect(logs[0].apiKey).toBe('****');
    });
  });

  describe('Max Entries Constraint', () => {
    it('should respect maxEntries limit', () => {
      const smallLog = new AuditLog({ maxEntries: 3 });

      for (let i = 0; i < 5; i++) {
        smallLog.record({
          operation: 'CREATE',
          service: 'test',
          resourceType: 'test',
          resourceId: `test${i}`
        });
      }

      expect(smallLog.getCount()).toBeLessThanOrEqual(3);
    });
  });
});
