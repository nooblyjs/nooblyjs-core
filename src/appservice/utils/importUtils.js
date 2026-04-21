/**
 * @fileoverview Data Import Utility Module
 * Provides utilities for importing data from multiple formats (JSON, CSV, XML, JSONL).
 * Supports validation, dry-run mode, duplicate detection, and batch processing.
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Data Importer utility class for importing data from various formats.
 * Handles validation, conflict resolution, and progress tracking.
 *
 * @class
 */
class DataImporter {
  /**
   * Parse CSV formatted string.
   * @static
   * @param {string} csvData - CSV formatted string
   * @param {Object} [options={}] - Parse options
   * @param {Array<string>} [options.columns] - Column names (auto-detected if not provided)
   * @param {boolean} [options.skipEmpty=true] - Skip empty rows
   * @return {Array<Object>} Parsed array of objects
   * @throws {Error} If CSV parsing fails
   */
  static parseCSV(csvData, options = {}) {
    const { columns = undefined, skipEmpty = true } = options;

    try {
      const lines = csvData.split(/\r?\n/).map(line => line.trim());
      const nonEmptyLines = skipEmpty ? lines.filter(line => line.length > 0) : lines;

      if (nonEmptyLines.length === 0) {
        return [];
      }

      // Parse header and determine column names
      const headerLine = nonEmptyLines[0];
      let columnNames = columns !== undefined ? columns : this._parseCSVLine(headerLine);

      // Parse data rows
      const records = [];
      for (let i = 1; i < nonEmptyLines.length; i++) {
        const values = this._parseCSVLine(nonEmptyLines[i]);
        const record = {};

        columnNames.forEach((col, index) => {
          record[col] = values[index] || '';
        });

        if (skipEmpty && Object.values(record).every(v => !v)) {
          continue; // Skip empty rows
        }

        records.push(record);
      }

      return records;
    } catch (error) {
      throw new Error(`CSV parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse a single CSV line respecting quoted values.
   * @private
   * @static
   * @param {string} line - CSV line
   * @return {Array<string>} Array of values
   */
  static _parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last value
    values.push(current.trim());
    return values;
  }

  /**
   * Parse JSON formatted string.
   * @static
   * @param {string} jsonData - JSON formatted string
   * @param {Object} [options={}] - Parse options (unused, for API consistency)
   * @return {Array|Object} Parsed JSON data
   * @throws {Error} If JSON is invalid
   */
  static parseJSON(jsonData, options = {}) {
    try {
      const data = JSON.parse(jsonData);
      // Normalize to array
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      throw new Error(`JSON parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse JSONL (JSON Lines) formatted string.
   * Each line is a separate JSON object.
   *
   * @static
   * @param {string} jsonlData - JSONL formatted string
   * @param {Object} [options={}] - Parse options (unused, for API consistency)
   * @return {Array<Object>} Array of parsed JSON objects
   * @throws {Error} If any line is invalid JSON
   */
  static parseJSONL(jsonlData, options = {}) {
    try {
      const lines = jsonlData.trim().split('\n').filter(line => line.trim());
      const data = lines.map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(`Line ${index + 1}: ${error.message}`);
        }
      });

      return data;
    } catch (error) {
      throw new Error(`JSONL parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse XML formatted string into array of objects.
   * Converts XML elements to objects with properties.
   *
   * @static
   * @param {string} xmlData - XML formatted string
   * @param {Object} [options={}] - Parse options
   * @param {string} [options.itemElementName='item'] - Name of item elements
   * @return {Array<Object>} Array of parsed objects
   * @throws {Error} If XML parsing fails
   */
  static parseXML(xmlData, options = {}) {
    const { itemElementName = 'item' } = options;

    try {
      // Simple XML parser - extract elements
      const itemRegex = new RegExp(`<${itemElementName}[^>]*>(.*?)</${itemElementName}>`, 'gs');
      const items = [];
      let match;

      while ((match = itemRegex.exec(xmlData)) !== null) {
        const itemContent = match[1];
        const obj = {};

        // Extract properties from item content
        const propRegex = /<(\w+)>([^<]*)<\/\1>/g;
        let propMatch;

        while ((propMatch = propRegex.exec(itemContent)) !== null) {
          const [, key, value] = propMatch;
          obj[key] = this._unescapeXML(value);
        }

        if (Object.keys(obj).length > 0) {
          items.push(obj);
        }
      }

      return items;
    } catch (error) {
      throw new Error(`XML parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse data based on detected format.
   * @static
   * @param {string} data - Data string to parse
   * @param {string} format - Format type: 'json', 'csv', 'xml', 'jsonl'
   * @param {Object} [options={}] - Format-specific options
   * @return {Array<Object>} Parsed array of objects
   * @throws {Error} If format is unsupported or parsing fails
   */
  static parse(data, format, options = {}) {
    const normalizedFormat = format ? format.toLowerCase() : 'json';

    switch (normalizedFormat) {
      case 'csv':
        return this.parseCSV(data, options);
      case 'json':
        return this.parseJSON(data, options);
      case 'jsonl':
        return this.parseJSONL(data, options);
      case 'xml':
        return this.parseXML(data, options);
      default:
        throw new Error(`Unsupported format: ${format}. Use: csv, json, jsonl, xml`);
    }
  }

  /**
   * Validate data against a schema.
   * @static
   * @param {Array<Object>} data - Data to validate
   * @param {Object} [schema={}] - Validation schema
   * @param {Object} [schema.requiredFields] - Required field names
   * @param {Object} [schema.fieldTypes] - Expected field types (fieldName: 'string'|'number'|'boolean')
   * @param {Function} [schema.customValidator] - Custom validation function
   * @return {Object} Validation result {valid: boolean, errors: Array}
   */
  static validate(data, schema = {}) {
    const { requiredFields = [], fieldTypes = {}, customValidator = null } = schema;
    const errors = [];
    const normalizedData = Array.isArray(data) ? data : [data];

    if (!Array.isArray(normalizedData)) {
      return { valid: false, errors: ['Data must be an array'] };
    }

    normalizedData.forEach((item, index) => {
      if (typeof item !== 'object' || item === null) {
        errors.push(`Row ${index + 1}: Item is not an object`);
        return;
      }

      // Check required fields
      requiredFields.forEach(field => {
        if (!(field in item) || item[field] === null || item[field] === undefined) {
          errors.push(`Row ${index + 1}: Missing required field "${field}"`);
        }
      });

      // Check field types
      Object.entries(fieldTypes).forEach(([field, expectedType]) => {
        if (field in item && item[field] !== null && item[field] !== undefined) {
          const actualType = Array.isArray(item[field]) ? 'array' : typeof item[field];
          if (actualType !== expectedType) {
            errors.push(
              `Row ${index + 1}: Field "${field}" type is "${actualType}", expected "${expectedType}"`
            );
          }
        }
      });

      // Custom validation
      if (customValidator && typeof customValidator === 'function') {
        try {
          const customErrors = customValidator(item, index + 1);
          if (customErrors && Array.isArray(customErrors)) {
            errors.push(...customErrors);
          }
        } catch (error) {
          errors.push(`Row ${index + 1}: Custom validation error: ${error.message}`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      itemCount: normalizedData.length,
      errorCount: errors.length
    };
  }

  /**
   * Detect duplicate entries in data.
   * @static
   * @param {Array<Object>} data - Data to check
   * @param {Array<string>} [uniqueFields=['id']] - Fields that make an entry unique
   * @return {Object} Detection result {hasDuplicates: boolean, duplicates: Array}
   */
  static detectDuplicates(data, uniqueFields = ['id']) {
    const seen = new Map();
    const duplicates = [];
    const normalizedData = Array.isArray(data) ? data : [data];

    normalizedData.forEach((item, index) => {
      const key = uniqueFields.map(field => item[field]).join('|');

      if (seen.has(key)) {
        duplicates.push({
          key,
          indices: [seen.get(key), index],
          fields: uniqueFields
        });
      } else {
        seen.set(key, index);
      }
    });

    return {
      hasDuplicates: duplicates.length > 0,
      duplicates,
      duplicateCount: duplicates.length
    };
  }

  /**
   * Simulate import without making changes (dry-run mode).
   * @static
   * @param {Array<Object>} data - Data to import
   * @param {Object} [options={}] - Import options
   * @param {Array<Object>} [options.existingData=[]] - Current data to check against
   * @param {string} [options.conflictStrategy='error'] - 'error', 'skip', 'update'
   * @param {Array<string>} [options.uniqueFields=['id']] - Fields for uniqueness checking
   * @return {Object} Dry-run result with statistics
   */
  static dryRun(data, options = {}) {
    const {
      existingData = [],
      conflictStrategy = 'error',
      uniqueFields = ['id']
    } = options;

    const normalizedData = Array.isArray(data) ? data : [data];
    const result = {
      dryRun: true,
      totalRecords: normalizedData.length,
      successCount: 0,
      conflictCount: 0,
      conflicts: [],
      statistics: {
        newRecords: 0,
        updatedRecords: 0,
        skippedRecords: 0,
        errorRecords: 0
      }
    };

    const existingKeys = new Map();
    existingData.forEach((item, index) => {
      const key = uniqueFields.map(field => item[field]).join('|');
      existingKeys.set(key, index);
    });

    normalizedData.forEach((item, index) => {
      const key = uniqueFields.map(field => item[field]).join('|');

      if (existingKeys.has(key)) {
        result.conflictCount++;
        result.statistics.skippedRecords++;
        result.conflicts.push({
          recordIndex: index,
          key,
          strategy: conflictStrategy,
          existing: existingData[existingKeys.get(key)],
          incoming: item
        });
      } else {
        result.successCount++;
        result.statistics.newRecords++;
      }
    });

    return result;
  }

  /**
   * Import data with support for batch processing and conflict handling.
   * @static
   * @param {Array<Object>} data - Data to import
   * @param {Function} importHandler - Callback function to handle individual items
   * @param {Object} [options={}] - Import options
   * @param {number} [options.batchSize=100] - Process in batches
   * @param {string} [options.conflictStrategy='error'] - 'error', 'skip', 'update'
   * @param {Array<string>} [options.uniqueFields=['id']] - Fields for uniqueness
   * @param {boolean} [options.dryRun=false] - Simulate without making changes
   * @param {Function} [options.onProgress] - Progress callback
   * @return {Promise<Object>} Import result with statistics
   */
  static async import(data, importHandler, options = {}) {
    const {
      batchSize = 100,
      conflictStrategy = 'error',
      uniqueFields = ['id'],
      dryRun = false,
      onProgress = null
    } = options;

    const normalizedData = Array.isArray(data) ? data : [data];
    const result = {
      dryRun,
      totalRecords: normalizedData.length,
      successCount: 0,
      errorCount: 0,
      conflicts: [],
      errors: [],
      startTime: new Date(),
      statistics: {
        newRecords: 0,
        updatedRecords: 0,
        skippedRecords: 0,
        errorRecords: 0
      }
    };

    for (let i = 0; i < normalizedData.length; i += batchSize) {
      const batch = normalizedData.slice(i, i + batchSize);

      for (const item of batch) {
        try {
          if (dryRun) {
            result.successCount++;
            result.statistics.newRecords++;
          } else {
            const importResult = await importHandler(item, {
              conflictStrategy,
              uniqueFields,
              index: normalizedData.indexOf(item)
            });

            if (importResult.success) {
              result.successCount++;
              if (importResult.type === 'new') {
                result.statistics.newRecords++;
              } else if (importResult.type === 'updated') {
                result.statistics.updatedRecords++;
              } else if (importResult.type === 'skipped') {
                result.statistics.skippedRecords++;
              }
            } else if (importResult.conflict) {
              result.conflicts.push({
                item,
                reason: importResult.reason,
                strategy: conflictStrategy
              });
              result.statistics.skippedRecords++;
            } else {
              throw new Error(importResult.reason);
            }
          }
        } catch (error) {
          result.errorCount++;
          result.statistics.errorRecords++;
          result.errors.push({
            item,
            error: error.message,
            index: normalizedData.indexOf(item)
          });
        }

        // Progress callback
        if (onProgress && typeof onProgress === 'function') {
          onProgress({
            processed: result.successCount + result.errorCount,
            total: normalizedData.length,
            percentage: Math.round(((result.successCount + result.errorCount) / normalizedData.length) * 100)
          });
        }
      }
    }

    result.endTime = new Date();
    result.duration = result.endTime - result.startTime;
    result.successPercentage = Math.round((result.successCount / normalizedData.length) * 100);

    return result;
  }

  /**
   * Unescape XML special characters.
   * @private
   * @static
   * @param {string} str - String with escaped XML characters
   * @return {string} Unescaped string
   */
  static _unescapeXML(str) {
    const map = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'"
    };

    return str.replace(/&(?:amp|lt|gt|quot|apos);/g, match => map[match]);
  }

  /**
   * Get format type from content.
   * @static
   * @param {string} content - Content to detect
   * @return {string} Detected format: 'json', 'csv', 'xml', 'jsonl', or 'unknown'
   */
  static detectFormat(content) {
    if (!content || typeof content !== 'string') {
      return 'unknown';
    }

    const trimmed = content.trim();

    // Check JSON
    if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.endsWith('}') || trimmed.endsWith(']')) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {
        // Not valid JSON
      }
    }

    // Check JSONL
    if (trimmed.includes('\n')) {
      const lines = trimmed.split('\n').slice(0, 3);
      const isJSONL = lines.every(line => {
        if (!line.trim()) return true;
        try {
          JSON.parse(line);
          return true;
        } catch {
          return false;
        }
      });
      if (isJSONL) return 'jsonl';
    }

    // Check XML
    if (trimmed.startsWith('<') && trimmed.includes('</')) {
      return 'xml';
    }

    // Check CSV
    if (trimmed.includes(',') || trimmed.includes('\n')) {
      return 'csv';
    }

    return 'unknown';
  }
}

module.exports = DataImporter;
