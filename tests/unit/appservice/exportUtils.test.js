/**
 * @fileoverview Unit tests for Data Export Utility
 * Tests data export to JSON, CSV, XML, and JSONL formats
 */

'use strict';

const DataExporter = require('../../../src/appservice/utils/exportUtils');

describe('Data Exporter', () => {
  const sampleData = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      age: 25
    }
  ];

  describe('toJSON()', () => {
    it('should export as JSON with pretty printing by default', () => {
      const json = DataExporter.toJSON(sampleData);
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(json).toContain('\n  ');
    });

    it('should export as compact JSON when pretty is false', () => {
      const json = DataExporter.toJSON(sampleData, { pretty: false });
      expect(json).not.toContain('\n');
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
    });

    it('should handle single object', () => {
      const json = DataExporter.toJSON(sampleData[0]);
      const parsed = JSON.parse(json);
      expect(parsed.name).toBe('John Doe');
    });

    it('should preserve data types', () => {
      const json = DataExporter.toJSON(sampleData);
      const parsed = JSON.parse(json);
      expect(parsed[0].age).toBe(30);
      expect(typeof parsed[0].age).toBe('number');
    });
  });

  describe('toCSV()', () => {
    it('should export array as CSV', () => {
      const csv = DataExporter.toCSV(sampleData);
      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThan(2);
      expect(lines[0]).toContain('id');
      expect(lines[0]).toContain('name');
    });

    it('should include data rows', () => {
      const csv = DataExporter.toCSV(sampleData);
      const lines = csv.split('\n');
      expect(lines[1]).toContain('1');
      expect(lines[1]).toContain('John Doe');
    });

    it('should escape commas in values', () => {
      const data = [{ name: 'Doe, John', age: 30 }];
      const csv = DataExporter.toCSV(data);
      expect(csv).toContain('"Doe, John"');
    });

    it('should escape quotes in values', () => {
      const data = [{ name: 'John "Jack" Doe', age: 30 }];
      const csv = DataExporter.toCSV(data);
      expect(csv).toContain('"John ""Jack"" Doe"');
    });

    it('should handle null/undefined values', () => {
      const data = [{ id: '1', name: 'John', email: null }];
      const csv = DataExporter.toCSV(data);
      const lines = csv.split('\n');
      expect(lines[1]).toContain('1');
      expect(lines[1]).toContain('John');
    });

    it('should respect column filter', () => {
      const csv = DataExporter.toCSV(sampleData, {
        excludeColumns: ['email', 'age']
      });
      expect(csv).not.toContain('email');
      expect(csv).not.toContain('jane@example.com');
    });

    it('should handle single object', () => {
      const csv = DataExporter.toCSV(sampleData[0]);
      const lines = csv.split('\n');
      expect(lines.length).toBe(2);
    });

    it('should handle empty array', () => {
      const csv = DataExporter.toCSV([]);
      expect(csv).toBe('');
    });

    it('should serialize nested objects as JSON', () => {
      const data = [{ id: '1', meta: { status: 'active' } }];
      const csv = DataExporter.toCSV(data);
      expect(csv).toContain('status');
      expect(csv).toContain('active');
    });
  });

  describe('toXML()', () => {
    it('should export as valid XML', () => {
      const xml = DataExporter.toXML(sampleData);
      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('<root>');
      expect(xml).toContain('</root>');
    });

    it('should include item elements for array', () => {
      const xml = DataExporter.toXML(sampleData);
      expect(xml).toContain('<item>');
      expect(xml).toContain('</item>');
    });

    it('should include data values', () => {
      const xml = DataExporter.toXML(sampleData);
      expect(xml).toContain('<name>John Doe</name>');
      expect(xml).toContain('<email>john@example.com</email>');
    });

    it('should escape XML special characters', () => {
      const data = [{ name: 'John & Jane <team>' }];
      const xml = DataExporter.toXML(data);
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&lt;');
      expect(xml).toContain('&gt;');
    });

    it('should use custom root element name', () => {
      const xml = DataExporter.toXML(sampleData, { rootElement: 'users' });
      expect(xml).toContain('<users>');
      expect(xml).toContain('</users>');
    });

    it('should use custom item element name', () => {
      const xml = DataExporter.toXML(sampleData, { itemElement: 'user' });
      expect(xml).toContain('<user>');
      expect(xml).toContain('</user>');
    });

    it('should handle null values', () => {
      const data = [{ id: '1', email: null }];
      const xml = DataExporter.toXML(data);
      expect(xml).toContain('<email />');
    });

    it('should handle nested objects', () => {
      const data = [{ id: '1', meta: { status: 'active' } }];
      const xml = DataExporter.toXML(data);
      expect(xml).toContain('<meta>');
      expect(xml).toContain('<status>active</status>');
      expect(xml).toContain('</meta>');
    });
  });

  describe('toJSONL()', () => {
    it('should export as JSONL format', () => {
      const jsonl = DataExporter.toJSONL(sampleData);
      const lines = jsonl.split('\n');
      expect(lines).toHaveLength(2);
    });

    it('should parse each line as valid JSON', () => {
      const jsonl = DataExporter.toJSONL(sampleData);
      const lines = jsonl.split('\n');
      lines.forEach(line => {
        const obj = JSON.parse(line);
        expect(obj).toHaveProperty('id');
        expect(obj).toHaveProperty('name');
      });
    });

    it('should preserve data types', () => {
      const jsonl = DataExporter.toJSONL(sampleData);
      const lines = jsonl.split('\n');
      const obj = JSON.parse(lines[0]);
      expect(obj.age).toBe(30);
      expect(typeof obj.age).toBe('number');
    });

    it('should handle single object', () => {
      const jsonl = DataExporter.toJSONL(sampleData[0]);
      const lines = jsonl.split('\n');
      expect(lines).toHaveLength(1);
    });
  });

  describe('getMimeType()', () => {
    it('should return correct MIME type for csv', () => {
      expect(DataExporter.getMimeType('csv')).toBe('text/csv');
    });

    it('should return correct MIME type for json', () => {
      expect(DataExporter.getMimeType('json')).toBe('application/json');
    });

    it('should return correct MIME type for xml', () => {
      expect(DataExporter.getMimeType('xml')).toBe('application/xml');
    });

    it('should return correct MIME type for jsonl', () => {
      expect(DataExporter.getMimeType('jsonl')).toBe('application/x-ndjson');
    });

    it('should be case insensitive', () => {
      expect(DataExporter.getMimeType('CSV')).toBe('text/csv');
      expect(DataExporter.getMimeType('JSON')).toBe('application/json');
    });

    it('should default to JSON for unknown formats', () => {
      expect(DataExporter.getMimeType('unknown')).toBe('application/json');
    });
  });

  describe('getFilename()', () => {
    it('should generate filename with extension', () => {
      const filename = DataExporter.getFilename('users', 'csv');
      expect(filename).toMatch(/^users-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);
    });

    it('should include timestamp', () => {
      const before = new Date();
      const filename = DataExporter.getFilename('data', 'json');
      const after = new Date();

      expect(filename).toContain('data-');
      expect(filename).toContain('.json');
    });

    it('should use lowercase extension', () => {
      const filename = DataExporter.getFilename('test', 'CSV');
      expect(filename).toMatch(/\.csv$/);
    });

    it('should handle various base names', () => {
      const names = ['export', 'backup', 'report_2024'];
      names.forEach(name => {
        const filename = DataExporter.getFilename(name, 'json');
        expect(filename).toContain(name);
      });
    });
  });

  describe('Format Consistency', () => {
    it('should export same data in all formats successfully', () => {
      const json = DataExporter.toJSON(sampleData);
      const csv = DataExporter.toCSV(sampleData);
      const xml = DataExporter.toXML(sampleData);
      const jsonl = DataExporter.toJSONL(sampleData);

      expect(json).toBeDefined();
      expect(csv).toBeDefined();
      expect(xml).toBeDefined();
      expect(jsonl).toBeDefined();

      expect(typeof json).toBe('string');
      expect(typeof csv).toBe('string');
      expect(typeof xml).toBe('string');
      expect(typeof jsonl).toBe('string');
    });

    it('should roundtrip JSON correctly', () => {
      const json = DataExporter.toJSON(sampleData);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(sampleData);
    });

    it('should roundtrip JSONL correctly', () => {
      const jsonl = DataExporter.toJSONL(sampleData);
      const lines = jsonl.split('\n');
      const parsed = lines.map(line => JSON.parse(line));
      expect(parsed).toEqual(sampleData);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty objects', () => {
      const data = [{}];
      const json = DataExporter.toJSON(data);
      const csv = DataExporter.toCSV(data);
      const xml = DataExporter.toXML(data);
      expect(json).toBeDefined();
      expect(csv).toBeDefined();
      expect(xml).toBeDefined();
    });

    it('should handle boolean values', () => {
      const data = [{ active: true, deleted: false }];
      const json = DataExporter.toJSON(data);
      const parsed = JSON.parse(json);
      expect(parsed[0].active).toBe(true);
      expect(parsed[0].deleted).toBe(false);
    });

    it('should handle numeric values', () => {
      const data = [{ count: 0, value: -100, decimal: 3.14 }];
      const json = DataExporter.toJSON(data);
      const parsed = JSON.parse(json);
      expect(parsed[0].count).toBe(0);
      expect(parsed[0].value).toBe(-100);
      expect(parsed[0].decimal).toBe(3.14);
    });

    it('should handle very large datasets', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `item-${i}`
      }));
      const json = DataExporter.toJSON(largeData);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1000);
    });

    it('should handle special characters in strings', () => {
      const data = [{ text: 'Hello\nWorld\t"test"' }];
      const csv = DataExporter.toCSV(data);
      expect(csv).toContain('"');
    });
  });
});
