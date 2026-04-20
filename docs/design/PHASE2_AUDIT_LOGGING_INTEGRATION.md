# Phase 2: Audit Logging & Export Integration Guide

**Status**: Partial Implementation Complete  
**Completed Services**: dataservice, caching, fetching (3/14)  
**Pattern**: Standardized audit logging and data export endpoints

---

## Overview

This guide documents the Pattern for adding audit logging and data export to microservices in the Noobly JS Core. The pattern has been implemented in 3 key services and can be replicated across remaining 11 services.

---

## Pattern Implementation

### Step 1: Import Required Modules

Add to the top of `src/{service}/routes/index.js`:

```javascript
const AuditLog = require('../../appservice/modules/auditLog');
const DataExporter = require('../../appservice/utils/exportUtils');
```

### Step 2: Initialize Audit Log

Inside the route module function, after app and middleware initialization:

```javascript
module.exports = (options, eventEmitter, serviceInstance) => {
  if (options['express-app'] && serviceInstance) {
    const app = options['express-app'];
    const authMiddleware = options.authMiddleware;

    // Initialize audit logging for this service
    const auditLog = new AuditLog({ 
      maxEntries: 5000, 
      retention: { days: 90 } 
    });
```

### Step 3: Add Audit Query Endpoint

Add this endpoint to retrieve audit logs:

```javascript
/**
 * GET /services/{service}/api/audit
 * Retrieves audit log entries for service operations
 */
app.get('/services/{service}/api/audit', authMiddleware || ((req, res, next) => next()), (req, res) => {
  try {
    const filters = {
      service: '{service}',
      limit: parseInt(req.query.limit) || 100,
      operation: req.query.operation,
      status: req.query.status,
      userId: req.query.userId
    };

    Object.keys(filters).forEach(key =>
      filters[key] === undefined && delete filters[key]
    );

    const logs = auditLog.query(filters);
    const stats = auditLog.getStats(filters);

    sendSuccess(res, { logs, stats, total: logs.length }, 'Audit logs retrieved successfully');
  } catch (error) {
    handleError(res, error, { operation: '{service}-audit-query' });
  }
});
```

### Step 4: Add Audit Export Endpoint

Add this endpoint to export audit logs:

```javascript
/**
 * POST /services/{service}/api/audit/export
 * Exports audit logs in specified format (json, csv, jsonl)
 */
app.post('/services/{service}/api/audit/export', authMiddleware || ((req, res, next) => next()), (req, res) => {
  try {
    const format = req.query.format || 'json';
    const filters = {
      service: '{service}',
      limit: parseInt(req.query.limit) || 10000
    };

    const exported = auditLog.export(format, filters);
    const mimeType = DataExporter.getMimeType(format);
    const filename = DataExporter.getFilename('audit-logs', format);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exported);
  } catch (error) {
    handleError(res, error, { operation: '{service}-audit-export' });
  }
});
```

### Step 5: Add Data Export Endpoint

Add this endpoint to export service data:

```javascript
/**
 * GET /services/{service}/api/export
 * Exports service data in specified format (json, csv, xml, jsonl)
 */
app.get('/services/{service}/api/export', authMiddleware || ((req, res, next) => next()), async (req, res) => {
  try {
    const format = req.query.format || 'json';
    
    // Get service data - adjust based on service's data retrieval method
    const data = serviceInstance.getData 
      ? await serviceInstance.getData() 
      : { note: 'Data export not available for this service' };

    const exported = DataExporter[`to${format.charAt(0).toUpperCase() + format.slice(1).toUpperCase()}`]?.(data) ||
                    DataExporter.toJSON(data);
    const mimeType = DataExporter.getMimeType(format);
    const filename = DataExporter.getFilename('{service}-export', format);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exported);
  } catch (error) {
    handleError(res, error, { operation: '{service}-export' });
  }
});
```

### Step 6: Add Audit Recording Helper (Optional)

For services that perform operations, add this method to record operations:

```javascript
/**
 * Record an operation to the audit log (internal use)
 */
serviceInstance.recordAudit = (operation, details) => {
  auditLog.record({
    operation,
    service: '{service}',
    resourceType: details.resourceType || 'unknown',
    resourceId: details.resourceId || null,
    userId: details.userId || 'system',
    status: details.status || 'SUCCESS',
    errorMessage: details.errorMessage || null,
    duration: details.duration || 0,
    before: details.before,
    after: details.after
  });
};
```

---

## Services to Update (Remaining 11)

The pattern above should be applied to these services:

1. **logging** - `src/logging/routes/index.js`
2. **queueing** - `src/queueing/routes/index.js`
3. **notifying** - `src/notifying/routes/index.js`
4. **working** - `src/working/routes/index.js`
5. **measuring** - `src/measuring/routes/index.js`
6. **scheduling** - `src/scheduling/routes/index.js`
7. **searching** - `src/searching/routes/index.js`
8. **workflow** - `src/workflow/routes/index.js`
9. **filing** - `src/filing/routes/index.js`
10. **aiservice** - `src/aiservice/routes/index.js`
11. **authservice** - `src/authservice/routes/index.js`

---

## Endpoint Usage

### Query Audit Logs

```bash
# Get recent audit logs
GET /services/{service}/api/audit?limit=50

# Filter by operation
GET /services/{service}/api/audit?operation=CREATE&limit=100

# Filter by user
GET /services/{service}/api/audit?userId=admin&limit=100

# Filter by status
GET /services/{service}/api/audit?status=FAILURE&limit=50

# Combine filters
GET /services/{service}/api/audit?operation=UPDATE&status=FAILURE&limit=100
```

Response:
```json
{
  "success": true,
  "data": {
    "logs": [...],
    "stats": {
      "total": 45,
      "byOperation": { "CREATE": 15, "UPDATE": 20, "DELETE": 10 },
      "byStatus": { "SUCCESS": 40, "FAILURE": 5 },
      "byService": { "service": 45 },
      "byUser": { "admin": 30, "user1": 15 },
      "failureRate": "11.11"
    },
    "total": 45
  },
  "message": "Audit logs retrieved successfully",
  "timestamp": "2026-04-20T14:30:00.000Z"
}
```

### Export Audit Logs

```bash
# Export as JSON
POST /services/{service}/api/audit/export?format=json

# Export as CSV
POST /services/{service}/api/audit/export?format=csv&limit=1000

# Export as JSONL (JSON Lines)
POST /services/{service}/api/audit/export?format=jsonl

# With custom limit
POST /services/{service}/api/audit/export?format=csv&limit=5000
```

### Export Service Data

```bash
# Export service data as JSON
GET /services/{service}/api/export?format=json

# Export as CSV
GET /services/{service}/api/export?format=csv

# Export as XML
GET /services/{service}/api/export?format=xml

# Export as JSONL
GET /services/{service}/api/export?format=jsonl
```

---

## Audit Entry Schema

All audit entries follow this schema:

```javascript
{
  id: string,                  // UUID
  timestamp: string,           // ISO-8601
  timestampMs: number,         // Millisecond timestamp
  service: string,             // Service name
  operation: string,           // CREATE|UPDATE|DELETE|READ
  resourceType: string,        // Entity type
  resourceId: string,          // Entity ID
  userId: string,              // User who performed action
  apiKey: string,              // Masked API key (last 4 chars only)
  before: object,              // Pre-modification state
  after: object,               // Post-modification state
  status: string,              // SUCCESS|FAILURE
  errorMessage: string,        // Error if status is FAILURE
  duration: number,            // Execution time (ms)
  ipAddress: string,           // Client IP
  userAgent: string            // Client user agent
}
```

---

## Export Format Details

### JSON Format
- Full object representation
- Pretty-printed with 2-space indentation
- Preserves all data types

### CSV Format
- Header row with column names
- Quoted values containing commas or quotes
- Nested objects serialized as JSON strings

### XML Format
- Standard XML 1.0 with UTF-8 encoding
- Root element: `<root>` (customizable)
- Item elements: `<item>` (customizable)
- Special characters escaped (&, <, >, ", ')

### JSONL Format
- One JSON object per line
- No line breaks within objects
- Useful for streaming large datasets

---

## Testing the Integration

### Test Audit Query

```bash
curl -H "x-api-key: test-key" \
  "http://localhost:11000/services/dataservice/api/audit?limit=10"
```

### Test Audit Export

```bash
curl -H "x-api-key: test-key" \
  "http://localhost:11000/services/dataservice/api/audit/export?format=csv" \
  -o audit-logs.csv
```

### Test Data Export

```bash
curl -H "x-api-key: test-key" \
  "http://localhost:11000/services/dataservice/api/export?format=json" \
  -o data-export.json
```

---

## Implementation Checklist

For each of the 11 remaining services:

- [ ] Import AuditLog and DataExporter modules
- [ ] Initialize AuditLog instance in routes module
- [ ] Add GET /api/audit endpoint (query audit logs)
- [ ] Add POST /api/audit/export endpoint (export audit logs)
- [ ] Add GET /api/export endpoint (export service data)
- [ ] Test audit query endpoint
- [ ] Test audit export in all formats (json, csv, jsonl)
- [ ] Test data export in relevant formats
- [ ] Update Swagger documentation
- [ ] Update PROGRESS.md

---

## Key Characteristics

✅ **Standardized Response Format**: All endpoints use Phase 1 response envelope (sendSuccess/sendError)  
✅ **Flexible Export**: Support multiple formats (JSON, CSV, XML, JSONL)  
✅ **Secure**: API key masking, no sensitive data in logs  
✅ **Queryable**: Filter by service, operation, user, status, date range  
✅ **Retention Policy**: Automatic cleanup of old entries  
✅ **Performance**: Memory-efficient with configurable max entries  
✅ **Immutable Stats**: Frozen constant objects prevent accidental modifications  

---

## Performance Considerations

- Default max entries: 5000 per service
- Default retention: 90 days
- Audit cleanup: Hourly automatic purge of old entries
- Export limit: Default 10000 entries, customizable
- API key masking: Shows only last 4 characters

---

## Compliance Features

- **Complete Audit Trail**: All operations recorded with user/IP/timestamp
- **Before/After State**: Full data change tracking
- **Error Logging**: Failed operations recorded with error messages
- **Duration Tracking**: Execution time recorded for performance analysis
- **User Tracking**: All operations attributed to specific user
- **Export Capability**: Full audit trail exportable for compliance reports

---

## Related Files

- `src/appservice/modules/auditLog.js` - Core audit logging class (375 lines, 35 tests)
- `src/appservice/middleware/auditMiddleware.js` - Express middleware for auto-capture (220 lines)
- `src/appservice/utils/exportUtils.js` - Data export utility (300 lines, 43 tests)
- `tests/unit/appservice/auditLog.test.js` - Audit log tests
- `tests/unit/appservice/exportUtils.test.js` - Export utility tests

---

## Success Criteria

- [ ] All 14 services have audit endpoints (GET /audit, POST /audit/export)
- [ ] All 14 services have data export endpoints (GET /export)
- [ ] All endpoints use Phase 1 response standard (sendSuccess/sendError)
- [ ] All export formats (JSON, CSV, XML, JSONL) working
- [ ] Audit logs queryable by service, operation, user, status
- [ ] API key masking in audit logs
- [ ] Automatic retention policy cleanup
- [ ] All tests passing
- [ ] Swagger documentation updated
- [ ] PROGRESS.md reflects completion

