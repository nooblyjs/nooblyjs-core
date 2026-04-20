# Phase 2: Operations Implementation Guide

**Duration**: Weeks 4-7 (4 weeks)  
**Focus**: Analytics, audit logging, admin UI, data export  
**Total Tasks**: 39

---

## Overview

Phase 2 builds on Phase 1's response standardization to add operational capabilities across all services:

1. **Analytics Completion** (2 services) - Fill gaps in metrics tracking
2. **Audit Logging** (14 services) - Track all data modifications
3. **Admin UI Standardization** (7 features) - Unified admin interfaces
4. **Data Export** (14 services) - Extract data in standard formats

---

## 2.1: Analytics Module Pattern

### Structure for Each Service

```
src/{service}/modules/analytics.js
├── Constructor: Initialize tracking
├── recordOperation(type, metadata) - Track operation
├── getStats() - Return aggregated statistics
├── getTimeline(minutes) - Return time-series data
├── clear() - Reset analytics
└── export(format) - Export data
```

### Standard Analytics Metrics (All Services)

```javascript
{
  // Operation counts
  operations: {
    create: number,
    read: number,
    update: number,
    delete: number,
    error: number
  },
  
  // Performance
  averageResponseTime: ms,
  minResponseTime: ms,
  maxResponseTime: ms,
  
  // Time-based
  timeline: {
    timestamp: ISO-8601,
    count: number,
    errors: number
  }[],
  
  // Status distribution
  statusCodes: {
    "200": number,
    "201": number,
    "400": number,
    "404": number,
    "500": number
  }
}
```

### Implementation for Fetching Service

**File**: `src/fetching/modules/analytics.js`

```javascript
class FetchingAnalytics {
  constructor() {
    this.operations = {};
    this.timeline = [];
    this.statusCodes = {};
  }

  recordOperation(type, { method, status, duration, url }) {
    this.operations[type] = (this.operations[type] || 0) + 1;
    this.statusCodes[status] = (this.statusCodes[status] || 0) + 1;
    
    this.timeline.push({
      timestamp: new Date().toISOString(),
      method,
      status,
      duration,
      url
    });
  }

  getStats() {
    return {
      totalRequests: Object.values(this.operations).reduce((a,b) => a+b, 0),
      byMethod: this.operations,
      statusDistribution: this.statusCodes,
      avgResponseTime: this.calculateAverage()
    };
  }

  export(format = 'json') {
    if (format === 'csv') {
      return this.toCSV();
    }
    return JSON.stringify(this.getStats());
  }
}

module.exports = FetchingAnalytics;
```

### Expose Analytics Endpoint

Update routes to use standardized response:

```javascript
app.get('/services/{service}/api/analytics', (req, res) => {
  const analytics = service.analytics?.getStats() || {};
  sendSuccess(res, analytics);
});
```

---

## 2.2: Audit Logging Module

### Structure

```
src/appservice/modules/auditLog.js
├── Constructor: Initialize storage
├── record(operation, metadata) - Record audit entry
├── query(filters) - Search audit logs
├── export(format) - Export audit trail
└── purge(olderThan) - Retention policy
```

### Audit Entry Schema

```javascript
{
  id: string,                    // Unique audit ID
  timestamp: ISO-8601,           // When operation occurred
  service: string,               // Which service
  operation: 'CREATE|UPDATE|DELETE|READ',
  resourceType: string,          // Entity type modified
  resourceId: string,            // Entity ID
  userId: string,                // Who performed action
  apiKey: string,               // API key used
  before: object,                // Pre-modification state
  after: object,                 // Post-modification state
  status: 'SUCCESS|FAILURE',
  errorMessage?: string,
  duration: number,              // Execution time (ms)
  ipAddress: string,            // Client IP
  userAgent: string             // Client user agent
}
```

### Implementation

**File**: `src/appservice/modules/auditLog.js`

```javascript
class AuditLog {
  constructor(storage = 'file') {
    this.storage = storage;
    this.logs = [];
  }

  record(operation, {
    service, resourceType, resourceId,
    userId, apiKey, before, after,
    status, errorMessage, duration,
    ipAddress, userAgent
  }) {
    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      service,
      operation,
      resourceType,
      resourceId,
      userId,
      apiKey,
      before,
      after,
      status,
      errorMessage,
      duration,
      ipAddress,
      userAgent
    };

    this.logs.push(entry);
    this.persist(entry);
    return entry.id;
  }

  query(filters) {
    let results = this.logs;
    
    if (filters.service) {
      results = results.filter(l => l.service === filters.service);
    }
    if (filters.operation) {
      results = results.filter(l => l.operation === filters.operation);
    }
    if (filters.userId) {
      results = results.filter(l => l.userId === filters.userId);
    }
    if (filters.since) {
      results = results.filter(l => new Date(l.timestamp) >= filters.since);
    }

    return results;
  }

  export(format = 'json', filters = {}) {
    const data = this.query(filters);
    
    if (format === 'csv') {
      return this.toCSV(data);
    }
    return JSON.stringify(data);
  }
}

module.exports = AuditLog;
```

### Middleware Integration

Create middleware to automatically audit operations:

```javascript
const auditMiddleware = (auditLog) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Intercept response
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - startTime;
      const operation = req.method === 'GET' ? 'READ' : 
                        req.method === 'POST' ? 'CREATE' :
                        req.method === 'PUT' ? 'UPDATE' :
                        req.method === 'DELETE' ? 'DELETE' : 'UNKNOWN';
      
      auditLog.record(operation, {
        service: req.path.split('/')[2],
        resourceType: req.path.split('/')[3] || 'unknown',
        resourceId: req.params.id || req.body.id,
        userId: req.user?.id || 'anonymous',
        apiKey: req.headers['x-api-key'],
        before: req.body,
        after: data,
        status: res.statusCode < 400 ? 'SUCCESS' : 'FAILURE',
        duration,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};
```

### Expose Audit Endpoints

```javascript
// GET /services/{service}/api/audit - List audit logs
app.get('/services/:service/api/audit', (req, res) => {
  const logs = auditLog.query({
    service: req.params.service,
    since: new Date(Date.now() - 7*24*60*60*1000) // Last 7 days
  });
  sendSuccess(res, { logs, total: logs.length });
});

// GET /services/{service}/api/audit/export - Export audit trail
app.get('/services/:service/api/audit/export', (req, res) => {
  const format = req.query.format || 'json';
  const data = auditLog.export(format, { service: req.params.service });
  res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
  res.send(data);
});
```

---

## 2.3: Admin UI Standardization

### Standardized Settings Component

```
src/appservice/views/components/SettingsPanel.html

Features:
- Dynamic form generation from API schema
- Type-aware inputs (text, number, boolean, select)
- Save/Cancel buttons with loading states
- Error/success messages
- Input validation
- Help text per setting
```

### Standardized Data View Component

```
src/appservice/views/components/DataTable.html

Features:
- Column definitions from schema
- Sortable columns
- Pagination
- Row selection
- Inline editing
- Bulk operations
- Export button
```

### Standardized Analytics Dashboard

```
src/appservice/views/components/AnalyticsDashboard.html

Features:
- Key metrics cards
- Time-series charts
- Distribution charts
- Timeline visualization
- Period selector
- Export analytics
```

---

## 2.4: Data Export Implementation

### Export Framework

**File**: `src/appservice/utils/exportUtils.js`

```javascript
class DataExporter {
  static async toJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  static async toCSV(data) {
    if (!Array.isArray(data)) {
      data = [data];
    }

    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csv = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(h => {
        const val = row[h];
        if (typeof val === 'string' && val.includes(',')) {
          return `"${val}"`;
        }
        return val;
      });
      csv.push(values.join(','));
    }

    return csv.join('\n');
  }

  static async toXML(data) {
    // Convert to XML format
    return this.toXMLNode('data', data);
  }

  static toXMLNode(name, obj, depth = 0) {
    const indent = '  '.repeat(depth);
    let xml = `${indent}<${name}>\n`;

    if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        xml += this.toXMLNode(key, value, depth + 1);
      }
    } else {
      xml = xml.slice(0, -1);
      xml += `>${obj}</${name}>\n`;
    }

    return xml + `${indent}</${name}>\n`;
  }
}

module.exports = DataExporter;
```

### Export Endpoints

Add to each service:

```javascript
const { DataExporter } = require('../../appservice/utils/exportUtils');

// GET /services/{service}/api/export
app.get('/services/:service/api/export', async (req, res) => {
  const format = req.query.format || 'json';
  const data = await service.getAllData();

  let exported;
  switch (format) {
    case 'csv':
      exported = await DataExporter.toCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      break;
    case 'xml':
      exported = await DataExporter.toXML(data);
      res.setHeader('Content-Type', 'application/xml');
      break;
    default:
      exported = await DataExporter.toJSON(data);
      res.setHeader('Content-Type', 'application/json');
  }

  res.setHeader('Content-Disposition', `attachment; filename="export.${format}"`);
  sendSuccess(res, { exported });
});
```

---

## Implementation Roadmap

### Week 4: Analytics & Audit Foundation
- [ ] Create FetchingAnalytics module
- [ ] Create AuditLog module
- [ ] Add analytics endpoints to all services
- [ ] Add audit logging middleware

### Week 5: Audit Logging Integration
- [ ] Add audit recording to all 14 services
- [ ] Create audit query endpoints
- [ ] Add audit retention policies
- [ ] Document audit log format

### Week 6: Admin UI & Export
- [ ] Create standardized settings panel
- [ ] Create standardized data table
- [ ] Create analytics dashboard
- [ ] Add export endpoints

### Week 7: Testing & Documentation
- [ ] Unit tests for analytics modules
- [ ] Integration tests for audit logging
- [ ] Update API documentation
- [ ] Create admin UI style guide

---

## Success Criteria

- [ ] All 14 services have analytics tracking
- [ ] All write operations are audited
- [ ] Audit logs queryable via API
- [ ] Admin UI components reusable across services
- [ ] Data exportable in JSON, CSV, XML formats
- [ ] All endpoints use standardized responses
- [ ] Documentation complete and up-to-date
- [ ] Tests achieving >80% coverage

