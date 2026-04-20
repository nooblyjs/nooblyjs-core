# Performance Monitoring Guide

This guide explains how to use the new performance monitoring capabilities in Noobly JS Core to track operation timing and detect performance bottlenecks.

## Overview

The performance monitoring system consists of three main components:

1. **Enhanced SystemMonitoring Module** - Tracks system-level metrics (RAM, CPU, event loop lag, GC)
2. **PerformanceHelper Module** - Provides utilities for services to mark performance checkpoints
3. **Dashboard** - Visualizes all metrics in real-time with graphs and statistics

## System-Level Metrics

The enhanced monitoring module automatically collects:

- **Event Loop Lag** - Detects when the event loop is blocked by synchronous work
- **Garbage Collection (GC)** - Tracks GC frequency, duration, and type
- **Heap Memory** - Monitors heap size and memory breakdown
- **Process Memory** - Tracks RSS, heap usage, external memory, ArrayBuffers

These metrics are automatically displayed in the Service Registry Dashboard.

## Using PerformanceHelper in Services

The `PerformanceHelper` module provides convenient methods for services to track operation timing.

### Basic Usage Pattern

#### Starting and Ending an Operation

```javascript
const performanceHelper = require('../../views/modules/performanceHelper');

// Start tracking an operation
const endOperation = performanceHelper.startOperation('operation-name', { metadata: 'value' });

try {
  // Perform your operation
  const result = await someAsyncOperation();
  
  // End operation (success)
  endOperation();
  return result;
} catch (error) {
  // End operation (failed)
  endOperation(error);
  throw error;
}
```

### Synchronous Operation Measurement

```javascript
const result = performanceHelper.measure('json-parse', () => {
  return JSON.parse(jsonString);
}, { dataSize: jsonString.length });
```

### Asynchronous Operation Measurement

```javascript
const data = await performanceHelper.measureAsync('database-query', async () => {
  return await database.find({ id: 123 });
}, { collection: 'users', query: 'findById' });
```

### Getting Performance Statistics

```javascript
// Get stats for a specific operation
const stats = performanceHelper.getStats('cache-get');
if (stats) {
  console.log(`Cache hits avg: ${stats.avg}ms (${stats.count} operations)`);
  console.log(`Min: ${stats.min}ms, Max: ${stats.max}ms`);
}

// Get all operation statistics
const allStats = performanceHelper.getAllStats();
allStats.forEach(stat => {
  if (stat.avg > 100) {
    console.warn(`⚠️ Slow operation: ${stat.name} avg=${stat.avg}ms`);
  }
});
```

## Service Integration Examples

### Caching Service Example

```javascript
// src/caching/providers/caching.js

const performanceHelper = require('../../views/modules/performanceHelper');

class CachingProvider {
  async get(key) {
    const endOp = performanceHelper.startOperation('cache-get', { key });
    
    try {
      const value = await this._getCacheValue(key);
      endOp();
      return value;
    } catch (error) {
      endOp(error);
      throw error;
    }
  }

  async set(key, value, ttl) {
    const end = performanceHelper.startOperation('cache-set', { key, ttl });
    
    try {
      await this._setCacheValue(key, value, ttl);
      end();
    } catch (error) {
      end(error);
      throw error;
    }
  }

  async clear() {
    return performanceHelper.measureAsync('cache-clear', async () => {
      return await this._clearAll();
    });
  }
}
```

### Data Service Example

```javascript
// src/dataservice/providers/dataservice.js

const performanceHelper = require('../../views/modules/performanceHelper');

class DataServiceProvider {
  async find(container, query) {
    return performanceHelper.measureAsync('dataservice-find', async () => {
      // Perform find operation
      return await this._executeQuery(container, query);
    }, { container, queryFields: Object.keys(query) });
  }

  async add(container, item) {
    const end = performanceHelper.startOperation('dataservice-add', { container });
    
    try {
      const result = await this._insertItem(container, item);
      end();
      return result;
    } catch (error) {
      end(error);
      throw error;
    }
  }
}
```

### Workflow Service Example with Batch Processing

```javascript
// src/workflow/providers/workflow.js

const performanceHelper = require('../../views/modules/performanceHelper');

class WorkflowProvider {
  async executeWorkflow(workflowName, workflowData) {
    const batchTracker = performanceHelper.createBatchTracker(`workflow-${workflowName}`);

    for (const step of workflowData.steps) {
      const endStep = batchTracker.track('step-execution');
      
      try {
        await this._executeStep(step);
        endStep();
      } catch (error) {
        endStep(error);
        throw error;
      }
    }

    // Get batch statistics
    const stats = batchTracker.getStats();
    this.logger?.info(`Workflow ${workflowName} completed`, {
      totalSteps: stats.totalItems,
      avgStepDuration: stats.averageItemDuration
    });
  }
}
```

### API Route Handler Example with Threshold Monitoring

```javascript
// src/scheduling/routes/index.js

const performanceHelper = require('../../views/modules/performanceHelper');

module.exports = (app, service, logger) => {
  app.get('/api/schedules', async (req, res) => {
    // Monitor this endpoint with a 500ms threshold
    const endWithThreshold = performanceHelper.withThreshold(
      'schedules-list-endpoint',
      500, // Alert if > 500ms
      (duration) => {
        logger?.warn('[SchedulingService] Slow API response', {
          endpoint: '/api/schedules',
          duration: duration.toFixed(2),
          threshold: 500
        });
      }
    );

    try {
      const schedules = await service.listSchedules();
      endWithThreshold();
      res.json(schedules);
    } catch (error) {
      endWithThreshold(error);
      res.status(500).json({ error: error.message });
    }
  });
};
```

## Dashboard Visualization

The Service Registry Dashboard automatically displays:

1. **Event Loop Lag Graph** - Shows event loop blocking over time
   - Green: < 10ms (good responsiveness)
   - Yellow: 10-50ms (moderate blocking)
   - Red: > 50ms (significant blocking)

2. **Garbage Collection Graph** - Displays GC events and their duration
   - Shows when GC occurs and how long it takes

3. **Heap Memory Graph** - Tracks heap size changes over time
   - Helps identify memory leaks

4. **Performance Marks Table** - Lists all tracked operations with statistics
   - Operation name, count, average/min/max duration
   - Color-coded by performance (green < 50ms, yellow < 100ms, red > 100ms)

## Performance Tips

### 1. Batch Operations
For processing multiple items, use `createBatchTracker`:

```javascript
const batchTracker = performanceHelper.createBatchTracker('bulk-import');

for (const item of items) {
  const end = batchTracker.track('import-item');
  await processItem(item);
  end();
}

const stats = batchTracker.getStats();
logger?.info(`Imported ${stats.totalItems} items in avg ${stats.averageItemDuration}ms`);
```

### 2. Threshold-Based Alerts
Monitor operations that should stay below a certain duration:

```javascript
const endWithAlert = performanceHelper.withThreshold(
  'api-request',
  200, // Alert if > 200ms
  (duration) => {
    logger?.warn(`Slow API request: ${duration}ms`, { operation: 'api-request' });
  }
);

// ... operation code ...
endWithAlert();
```

### 3. Error Tracking
Capture performance data for failed operations:

```javascript
const end = performanceHelper.startOperation('database-query');

try {
  const result = await db.query();
  end(); // Success
  return result;
} catch (error) {
  end(error); // Failure - also tracks duration
  throw error;
}
```

The dashboard will show both successful and failed operations with the `:error` suffix in operation names.

### 4. Identifying Bottlenecks
Regularly check performance statistics:

```javascript
const slowOps = performanceHelper.getAllStats()
  .filter(stat => stat.avg > 100)
  .sort((a, b) => b.avg - a.avg);

if (slowOps.length > 0) {
  console.log('Slow operations detected:');
  slowOps.forEach(op => {
    console.log(`  ${op.name}: ${op.avg.toFixed(2)}ms avg (${op.count} calls)`);
  });
}
```

## Event Loop Lag Interpretation

Event loop lag indicates how long the event loop is blocked:

- **0-10ms** - Excellent responsiveness, no blocking detected
- **10-50ms** - Moderate blocking, some long operations running synchronously
- **50-100ms** - Significant blocking, requests may timeout
- **100ms+** - Critical blocking, service is unresponsive

Common causes of event loop lag:
- Synchronous file I/O operations (use async alternatives)
- Large synchronous computations (use `Worker` threads)
- Uncaught event loop blocking (heavy parsing, compression, etc.)

## Garbage Collection Metrics

The GC chart shows:

- **Mark-Sweep-Compact** - Full heap collection (stops the world)
- **Scavenge** - Young generation collection (fast)
- **Incremental Marking** - Concurrent marking (doesn't block)

Long GC pauses (> 100ms) can indicate:
- Excessive memory allocations
- Memory leaks
- Heap size too large for system memory

## Memory Analysis

Use the heap memory chart to detect:

- **Memory Leaks** - Continuously increasing heap usage
- **GC Effectiveness** - Saw-tooth patterns indicate healthy collection
- **Heap Fragmentation** - Large gaps between collections

## Configuration

The monitoring system is automatically configured in the ServiceRegistry. To adjust monitoring parameters:

```javascript
// In src/views/modules/monitoring.js
const systemMonitoring = new SystemMonitoring();
systemMonitoring.maxDataPoints = 120; // Store more historical data
```

## API Reference

### performanceHelper.startOperation(operationName, [metadata])

Starts tracking an operation and returns a function to call when complete.

- **operationName** (string) - Name of the operation
- **metadata** (object) - Optional metadata about the operation
- **Returns** (function) - Function to call when operation completes

### performanceHelper.measure(operationName, fn, [metadata])

Measures a synchronous operation.

- **operationName** (string) - Name of the operation
- **fn** (function) - Function to execute
- **metadata** (object) - Optional metadata
- **Returns** - Result of the function

### performanceHelper.measureAsync(operationName, asyncFn, [metadata])

Measures an asynchronous operation.

- **operationName** (string) - Name of the operation
- **asyncFn** (async function) - Async function to execute
- **metadata** (object) - Optional metadata
- **Returns** (Promise) - Promise resolving with function result

### performanceHelper.getStats(operationName)

Gets statistics for a specific operation.

- **operationName** (string) - Name of the operation
- **Returns** (object) - Stats with min, max, avg, count or null

### performanceHelper.getAllStats()

Gets statistics for all tracked operations.

- **Returns** (array) - Array of operation statistics

### performanceHelper.createBatchTracker(batchName)

Creates a tracker for batch operations.

- **batchName** (string) - Name of the batch
- **Returns** (object) - Batch tracker with track() and getStats() methods

### performanceHelper.withThreshold(operationName, thresholdMs, [callback])

Creates an operation tracker with threshold monitoring.

- **operationName** (string) - Name of the operation
- **thresholdMs** (number) - Threshold duration in milliseconds
- **callback** (function) - Called if duration exceeds threshold
- **Returns** (function) - Function to call when operation completes

## Troubleshooting

### Performance marks not showing in dashboard

1. Verify services are using `performanceHelper` to record marks
2. Check browser console for errors fetching `/services/api/monitoring/metrics`
3. Ensure authentication tokens are valid

### Event loop lag always 0

1. Event loop monitoring requires multiple data points
2. Run operations that might block the event loop
3. Monitor CPU-intensive operations to see lag increase

### GC metrics not updating

1. GC observer requires Node.js with perf_hooks support (v8.5.0+)
2. Check Node.js version: `node --version`
3. GC events may not trigger frequently in idle applications

### Memory usage not changing

1. Ensure operations allocate significant memory
2. Check that no memory leaks prevent proper GC
3. Monitor long-running processes with load testing

## Best Practices

1. **Use meaningful operation names** - Makes dashboard analysis easier
2. **Include metadata** - Helps with debugging and correlation
3. **Monitor at multiple levels** - Service-wide, operation, and endpoint
4. **Set reasonable thresholds** - Based on expected operation duration
5. **Review metrics regularly** - Identify trends and degradation
6. **Correlate with load** - Check performance under typical usage patterns
7. **Test before production** - Verify performance helper impact is minimal

## See Also

- [Service Architecture Documentation](./SERVICE_ARCHITECTURE.md)
- [Node.js perf_hooks Documentation](https://nodejs.org/api/perf_hooks.html)
- [Performance Monitoring in Node.js](https://nodejs.org/en/docs/guides/nodejs-performance-hooks/)
