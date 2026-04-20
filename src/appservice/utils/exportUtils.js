/**
 * @fileoverview Data Export Utility Module
 * Provides utilities for exporting data in multiple formats (JSON, CSV, XML).
 * Supports filtering and custom formatting for compliance and reporting.
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Data Exporter utility class for converting data to various export formats.
 * @class
 */
class DataExporter {
  /**
   * Converts data to JSON format.
   * @static
   * @param {Array|Object} data - Data to export
   * @param {Object} [options={}] - Export options
   * @param {boolean} [options.pretty=true] - Pretty print JSON
   * @return {string} JSON formatted data
   */
  static toJSON(data, options = {}) {
    const { pretty = true } = options;
    const indent = pretty ? 2 : null;
    return JSON.stringify(data, null, indent);
  }

  /**
   * Converts data to CSV format.
   * @static
   * @param {Array} data - Array of objects to export as CSV
   * @param {Object} [options={}] - Export options
   * @param {Array<string>} [options.columns] - Column names (defaults to object keys)
   * @param {Array<string>} [options.excludeColumns] - Columns to exclude
   * @return {string} CSV formatted data
   */
  static toCSV(data, options = {}) {
    const { columns = null, excludeColumns = [] } = options;

    // Normalize to array
    if (!Array.isArray(data)) {
      data = [data];
    }

    if (data.length === 0) {
      return '';
    }

    // Determine columns
    let cols = columns;
    if (!cols) {
      const allKeys = new Set();
      data.forEach(item => {
        if (typeof item === 'object') {
          Object.keys(item).forEach(key => allKeys.add(key));
        }
      });
      cols = Array.from(allKeys).filter(col => !excludeColumns.includes(col));
    }

    // Build CSV
    const csv = [cols.join(',')];

    for (const row of data) {
      const values = cols.map(col => {
        const val = row[col];
        if (val === null || val === undefined) {
          return '';
        }
        if (typeof val === 'string') {
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }
        if (typeof val === 'object') {
          return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        }
        return val.toString();
      });
      csv.push(values.join(','));
    }

    return csv.join('\n');
  }

  /**
   * Converts data to XML format.
   * @static
   * @param {Array|Object} data - Data to export as XML
   * @param {Object} [options={}] - Export options
   * @param {string} [options.rootElement='root'] - Root XML element name
   * @param {string} [options.itemElement='item'] - Element name for array items
   * @return {string} XML formatted data
   */
  static toXML(data, options = {}) {
    const { rootElement = 'root', itemElement = 'item' } = options;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<${rootElement}>\n`;

    if (Array.isArray(data)) {
      for (const item of data) {
        xml += this.objectToXML_(item, itemElement, 1);
      }
    } else if (typeof data === 'object') {
      xml += this.objectToXML_(data, 'data', 1);
    } else {
      xml += `  <value>${this.escapeXML_(data)}</value>\n`;
    }

    xml += `</${rootElement}>`;
    return xml;
  }

  /**
   * Converts data to JSONL (JSON Lines) format.
   * @static
   * @param {Array} data - Array of objects to export as JSONL
   * @return {string} JSONL formatted data
   */
  static toJSONL(data) {
    if (!Array.isArray(data)) {
      data = [data];
    }
    return data.map(item => JSON.stringify(item)).join('\n');
  }

  /**
   * Converts object to XML string recursively.
   * @private
   * @static
   * @param {Object} obj - Object to convert
   * @param {string} elementName - XML element name
   * @param {number} depth - Indentation depth
   * @return {string} XML representation
   */
  static objectToXML_(obj, elementName, depth = 0) {
    const indent = '  '.repeat(depth);
    const nextIndent = '  '.repeat(depth + 1);
    let xml = '';

    if (typeof obj !== 'object' || obj === null) {
      return `${indent}<${elementName}>${this.escapeXML_(obj)}</${elementName}>\n`;
    }

    if (Array.isArray(obj)) {
      xml += `${indent}<${elementName}>\n`;
      for (const item of obj) {
        xml += this.objectToXML_(item, 'item', depth + 1);
      }
      xml += `${indent}</${elementName}>\n`;
      return xml;
    }

    xml += `${indent}<${elementName}>\n`;

    for (const [key, value] of Object.entries(obj)) {
      const safeName = key.replace(/[^a-zA-Z0-9_]/g, '_');

      if (value === null || value === undefined) {
        xml += `${nextIndent}<${safeName} />\n`;
      } else if (typeof value === 'object') {
        if (Array.isArray(value)) {
          xml += `${nextIndent}<${safeName}>\n`;
          for (const item of value) {
            if (typeof item === 'object') {
              xml += this.objectToXML_(item, 'item', depth + 2);
            } else {
              xml += `${'  '.repeat(depth + 2)}<item>${this.escapeXML_(item)}</item>\n`;
            }
          }
          xml += `${nextIndent}</${safeName}>\n`;
        } else {
          xml += this.objectToXML_(value, safeName, depth + 1);
        }
      } else {
        xml += `${nextIndent}<${safeName}>${this.escapeXML_(value)}</${safeName}>\n`;
      }
    }

    xml += `${indent}</${elementName}>\n`;
    return xml;
  }

  /**
   * Escapes XML special characters.
   * @private
   * @static
   * @param {*} value - Value to escape
   * @return {string} Escaped value
   */
  static escapeXML_(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return value.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Determines MIME type from export format.
   * @static
   * @param {string} format - Export format (json, csv, xml, jsonl)
   * @return {string} MIME type
   */
  static getMimeType(format) {
    switch (format.toLowerCase()) {
      case 'csv':
        return 'text/csv';
      case 'xml':
        return 'application/xml';
      case 'jsonl':
        return 'application/x-ndjson';
      case 'json':
      default:
        return 'application/json';
    }
  }

  /**
   * Generates a filename for exported data.
   * @static
   * @param {string} baseName - Base name for the file
   * @param {string} format - Export format
   * @return {string} Filename with timestamp
   */
  static getFilename(baseName, format) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    return `${baseName}-${timestamp}.${format.toLowerCase()}`;
  }
}

module.exports = DataExporter;
