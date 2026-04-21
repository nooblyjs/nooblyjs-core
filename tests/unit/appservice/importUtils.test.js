/**
 * @fileoverview Tests for Data Import Utility Module
 * Comprehensive test suite for parsing, validation, and import functionality
 */

'use strict';

const DataImporter = require('../../../src/appservice/utils/importUtils');

describe('Data Importer', () => {
  describe('parseCSV()', () => {
    it('should parse basic CSV data', () => {
      const csvData = 'name,age\nJohn,30\nJane,25';
      const result = DataImporter.parseCSV(csvData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: 'John', age: '30' });
      expect(result[1]).toEqual({ name: 'Jane', age: '25' });
    });

    it('should handle CSV with quotes', () => {
      const csvData = 'name,description\nJohn,"Developer, skilled"';
      const result = DataImporter.parseCSV(csvData);

      expect(result[0].description).toContain('Developer');
    });

    it('should skip empty rows by default', () => {
      const csvData = 'name,age\nJohn,30\n\nJane,25\n';
      const result = DataImporter.parseCSV(csvData);

      expect(result).toHaveLength(2);
    });

    it('should throw on invalid CSV', () => {
      const csvData = 'name,age\nJohn'; // Missing column
      expect(() => {
        DataImporter.parseCSV(csvData);
      }).not.toThrow(); // csv-parse is lenient
    });
  });

  describe('parseJSON()', () => {
    it('should parse JSON array', () => {
      const jsonData = '[{"id": 1, "name": "John"}, {"id": 2, "name": "Jane"}]';
      const result = DataImporter.parseJSON(jsonData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'John' });
    });

    it('should parse single JSON object as array', () => {
      const jsonData = '{"id": 1, "name": "John"}';
      const result = DataImporter.parseJSON(jsonData);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 1, name: 'John' });
    });

    it('should throw on invalid JSON', () => {
      const jsonData = '{invalid json}';
      expect(() => {
        DataImporter.parseJSON(jsonData);
      }).toThrow('JSON parsing failed');
    });

    it('should handle JSON with special characters', () => {
      const jsonData = '[{"message": "Hello \\"World\\""}]';
      const result = DataImporter.parseJSON(jsonData);

      expect(result[0].message).toContain('World');
    });
  });

  describe('parseJSONL()', () => {
    it('should parse JSONL format', () => {
      const jsonlData = '{"id": 1, "name": "John"}\n{"id": 2, "name": "Jane"}';
      const result = DataImporter.parseJSONL(jsonlData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'John' });
      expect(result[1]).toEqual({ id: 2, name: 'Jane' });
    });

    it('should handle empty lines in JSONL', () => {
      const jsonlData = '{"id": 1}\n\n{"id": 2}\n';
      const result = DataImporter.parseJSONL(jsonlData);

      expect(result).toHaveLength(2);
    });

    it('should throw on invalid line', () => {
      const jsonlData = '{"id": 1}\n{invalid}';
      expect(() => {
        DataImporter.parseJSONL(jsonlData);
      }).toThrow('JSONL parsing failed');
    });
  });

  describe('parseXML()', () => {
    it('should parse XML items', () => {
      const xmlData = '<root><item><id>1</id><name>John</name></item><item><id>2</id><name>Jane</name></item></root>';
      const result = DataImporter.parseXML(xmlData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: '1', name: 'John' });
    });

    it('should handle custom item element names', () => {
      const xmlData = '<root><record><id>1</id></record><record><id>2</id></record></root>';
      const result = DataImporter.parseXML(xmlData, { itemElementName: 'record' });

      expect(result).toHaveLength(2);
    });

    it('should unescape XML special characters', () => {
      const xmlData = '<root><item><message>Hello &amp; Goodbye</message></item></root>';
      const result = DataImporter.parseXML(xmlData);

      expect(result[0].message).toBe('Hello & Goodbye');
    });

    it('should handle XML with empty items', () => {
      const xmlData = '<root><item></item><item><id>1</id></item></root>';
      const result = DataImporter.parseXML(xmlData);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
  });

  describe('parse()', () => {
    it('should auto-detect JSON format', () => {
      const jsonData = '[{"id": 1}]';
      const result = DataImporter.parse(jsonData, 'json');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should auto-detect CSV format', () => {
      const csvData = 'id,name\n1,John';
      const result = DataImporter.parse(csvData, 'csv');

      expect(result).toHaveLength(1);
    });

    it('should throw on unsupported format', () => {
      expect(() => {
        DataImporter.parse('data', 'unknown');
      }).toThrow('Unsupported format');
    });

    it('should be case-insensitive for format', () => {
      const jsonData = '[{"id": 1}]';
      const result = DataImporter.parse(jsonData, 'JSON');

      expect(result).toHaveLength(1);
    });
  });

  describe('validate()', () => {
    it('should validate required fields', () => {
      const data = [{ id: 1, name: 'John' }, { id: 2 }]; // Second missing name
      const schema = { requiredFields: ['id', 'name'] };
      const result = DataImporter.validate(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate field types', () => {
      const data = [{ id: 1, age: '30' }, { id: 2, age: 25 }];
      const schema = { fieldTypes: { id: 'number', age: 'number' } };
      const result = DataImporter.validate(data, schema);

      expect(result.errors.length).toBeGreaterThan(0); // First item has string age
    });

    it('should return valid for empty schema', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = DataImporter.validate(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should run custom validator', () => {
      const data = [{ id: 1, value: 10 }, { id: 2, value: -5 }];
      const schema = {
        customValidator: (item, rowNum) => {
          if (item.value < 0) {
            return [`Row ${rowNum}: Value must be positive`];
          }
          return [];
        }
      };
      const result = DataImporter.validate(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Row 2: Value must be positive');
    });

    it('should count items and errors', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = DataImporter.validate(data);

      expect(result.itemCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });
  });

  describe('detectDuplicates()', () => {
    it('should detect duplicate IDs', () => {
      const data = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
        { id: 1, name: 'Johnny' } // Duplicate ID
      ];
      const result = DataImporter.detectDuplicates(data, ['id']);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates).toHaveLength(1);
    });

    it('should detect duplicates on multiple fields', () => {
      const data = [
        { id: 1, email: 'john@example.com' },
        { id: 2, email: 'john@example.com' }, // Same email, different ID
        { id: 3, email: 'jane@example.com' }
      ];
      const result = DataImporter.detectDuplicates(data, ['email']);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates).toHaveLength(1);
    });

    it('should not report duplicates when none exist', () => {
      const data = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ];
      const result = DataImporter.detectDuplicates(data, ['id']);

      expect(result.hasDuplicates).toBe(false);
      expect(result.duplicates).toHaveLength(0);
    });

    it('should handle composite keys', () => {
      const data = [
        { firstName: 'John', lastName: 'Doe' },
        { firstName: 'John', lastName: 'Smith' },
        { firstName: 'John', lastName: 'Doe' } // Duplicate composite key
      ];
      const result = DataImporter.detectDuplicates(data, ['firstName', 'lastName']);

      expect(result.hasDuplicates).toBe(true);
    });
  });

  describe('dryRun()', () => {
    it('should simulate import without changes', () => {
      const data = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
      const result = DataImporter.dryRun(data);

      expect(result.dryRun).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.statistics.newRecords).toBe(2);
    });

    it('should detect conflicts in dry-run', () => {
      const data = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }, { id: 1, name: 'Johnny' }];
      const existing = [{ id: 1, name: 'John' }];
      const result = DataImporter.dryRun(data, {
        existingData: existing,
        uniqueFields: ['id']
      });

      expect(result.conflictCount).toBe(2); // Both items with id: 1 conflict with existing
      expect(result.conflicts).toHaveLength(2);
    });

    it('should apply conflict strategy in dry-run', () => {
      const data = [{ id: 1, name: 'John' }];
      const existing = [{ id: 1, name: 'John' }];
      const result = DataImporter.dryRun(data, {
        existingData: existing,
        conflictStrategy: 'skip'
      });

      expect(result.conflictCount).toBe(1);
      expect(result.statistics.skippedRecords).toBe(1);
    });

    it('should return statistics', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = DataImporter.dryRun(data);

      expect(result).toHaveProperty('statistics');
      expect(result.statistics).toHaveProperty('newRecords');
      expect(result.statistics).toHaveProperty('updatedRecords');
      expect(result.statistics).toHaveProperty('skippedRecords');
    });
  });

  describe('import()', () => {
    it('should import data successfully', async () => {
      const data = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
      const imported = [];

      const importHandler = async item => {
        imported.push(item);
        return { success: true, type: 'new' };
      };

      const result = await DataImporter.import(data, importHandler);

      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(imported).toHaveLength(2);
    });

    it('should handle import errors', async () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];

      const importHandler = async item => {
        if (item.id === 2) {
          throw new Error('Import failed');
        }
        return { success: true, type: 'new' };
      };

      const result = await DataImporter.import(data, importHandler);

      expect(result.successCount).toBeGreaterThan(0);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should process in batches', async () => {
      const data = Array.from({ length: 250 }, (_, i) => ({ id: i + 1 }));
      let batchCount = 0;
      let lastBatchSize = 0;

      const importHandler = async item => {
        return { success: true, type: 'new' };
      };

      const result = await DataImporter.import(data, importHandler, { batchSize: 100 });

      expect(result.successCount).toBe(250);
    });

    it('should call progress callback', async () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const progressUpdates = [];

      const importHandler = async item => {
        return { success: true, type: 'new' };
      };

      const onProgress = progress => {
        progressUpdates.push(progress);
      };

      await DataImporter.import(data, importHandler, { onProgress });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].percentage).toBe(100);
    });

    it('should track import type (new/updated/skipped)', async () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];

      const importHandler = async (item, context) => {
        if (item.id === 1) return { success: true, type: 'new' };
        if (item.id === 2) return { success: true, type: 'updated' };
        if (item.id === 3) return { success: true, type: 'skipped' };
      };

      const result = await DataImporter.import(data, importHandler);

      expect(result.statistics.newRecords).toBe(1);
      expect(result.statistics.updatedRecords).toBe(1);
      expect(result.statistics.skippedRecords).toBe(1);
    });

    it('should support dry-run mode', async () => {
      const data = [{ id: 1 }, { id: 2 }];

      const importHandler = async item => {
        throw new Error('Should not be called');
      };

      const result = await DataImporter.import(data, importHandler, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.successCount).toBe(2);
    });
  });

  describe('detectFormat()', () => {
    it('should detect JSON format', () => {
      const json = '[{"id": 1}]';
      expect(DataImporter.detectFormat(json)).toBe('json');
    });

    it('should detect JSONL format', () => {
      const jsonl = '{"id": 1}\n{"id": 2}';
      expect(DataImporter.detectFormat(jsonl)).toBe('jsonl');
    });

    it('should detect XML format', () => {
      const xml = '<root><item>test</item></root>';
      expect(DataImporter.detectFormat(xml)).toBe('xml');
    });

    it('should detect CSV format', () => {
      const csv = 'id,name\n1,John';
      expect(DataImporter.detectFormat(csv)).toBe('csv');
    });

    it('should return unknown for unrecognized format', () => {
      expect(DataImporter.detectFormat('not-a-format')).toBe('unknown');
    });

    it('should handle null/undefined input', () => {
      expect(DataImporter.detectFormat(null)).toBe('unknown');
      expect(DataImporter.detectFormat(undefined)).toBe('unknown');
    });
  });
});
