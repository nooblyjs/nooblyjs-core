# Performance Monitoring Integration Example

This document provides a step-by-step example of integrating performance monitoring into a service.

## Example: Caching Service Integration

### Step 1: Import the Performance Helper

At the top of your service provider file:

```javascript
const performanceHelper = require('../../views/modules/performanceHelper');
```

### Step 2: Wrap Get Operations

Before:
```javascript
async get(key) {
  if (!key) {
    throw new Error('Cache key is required');
  }

  if (this.cache[key]) {
    return this.cache[key].value;
  }

  return null;
}
```

After:
```javascript
async get(key) {
  const endOperation = performanceHelper.startOperation('cache-get', { key });

  try {
    if (!key) {
      endOperation(new Error('Key required'));
      throw new Error('Cache key is required');
    }

    if (this.cache[key]) {
      endOperation();
      return this.cache[key].value;
    }

    endOperation();
    return null;
  } catch (error) {
    endOperation(error);
    throw error;
  }
}
```

### Step 3: Wrap Set Operations

Before:
```javascript
async set(key, value, ttl = 3600) {
  if (!key) {
    throw new Error('Cache key is required');
  }

  this.cache[key] = {
    value,
    expiresAt: Date.now() + (ttl * 1000)
  };

  return true;
}
```

After:
```javascript
async set(key, value, ttl = 3600) {
  return performanceHelper.measureAsync('cache-set', async () => {
    if (!key) {
      throw new Error('Cache key is required');
    }

    this.cache[key] = {
      value,
      expiresAt: Date.now() + (ttl * 1000)
    };

    return true;
  }, { key, ttl, valueSize: JSON.stringify(value).length });
}
```

### Step 4: Wrap Delete Operations

```javascript
async delete(key) {
  const endOperation = performanceHelper.startOperation('cache-delete', { key });

  try {
    if (this.cache[key]) {
      delete this.cache[key];
      endOperation();
      return true;
    }

    endOperation();
    return false;
  } catch (error) {
    endOperation(error);
    throw error;
  }
}
```

### Step 5: Add Batch Operations Monitoring

For clearing or bulk operations:

```javascript
async clear() {
  return performanceHelper.measureAsync('cache-clear', async () => {
    const keysToDelete = Object.keys(this.cache);
    const batchTracker = performanceHelper.createBatchTracker('cache-clear:item');

    for (const key of keysToDelete) {
      const end = batchTracker.track('delete-item');
      delete this.cache[key];
      end();
    }

    const stats = batchTracker.getStats();
    this.logger?.info('[CachingProvider] Cache cleared', {
      itemsDeleted: stats.totalItems,
      avgItemDuration: stats.averageItemDuration
    });

    return true;
  });
}
```

### Step 6: Add Statistics Endpoint (Optional)

In your routes:

```javascript
app.get('/api/cache-stats', (req, res) => {
  const stats = performanceHelper.getAllStats()
    .filter(s => s.name.startsWith('cache-'));

  const summary = {
    totalOperations: stats.reduce((sum, s) => sum + s.count, 0),
    averageLatency: stats.length > 0 
      ? (stats.reduce((sum, s) => sum + s.avg * s.count, 0) / stats.reduce((sum, s) => sum + s.count, 0)).toFixed(2)
      : 0,
    operations: stats
  };

  res.json(summary);
});
```

## Expected Dashboard Output

After integration, you'll see in the Performance Marks table:

```
Operation              Count  Avg (ms)  Min (ms)  Max (ms)
cache-get             1245   2.15      0.85      15.23
cache-set              892   3.42      1.20      22.15
cache-delete           456   1.98      0.70      8.50
cache-clear            1     145.30    145.30    145.30
cache-clear:item       5230  0.03      0.01      0.12
```

Color coding:
- Green: avg < 50ms (good)
- Yellow: avg 50-100ms (acceptable)
- Red: avg > 100ms (needs optimization)

## Interpreting Performance Data

### High Average Latency
If `cache-get` avg is > 10ms:
- Check if you're using remote cache (Redis, Memcached)
- Verify network latency
- Look for connection pool exhaustion

### High Variance (Max >> Min)
If `cache-set` max is 100x higher than min:
- Indicates occasional slowdowns
- Could be memory pressure or GC pauses
- Check event loop lag graph

### Low Hit Count for Critical Operations
If `cache-get` count is low:
- Cache may not be effective
- Check if data expires too quickly
- Verify cache keys are reused

## Monitoring Queue Operations

For queueing service similar pattern:

```javascript
async enqueue(queueName, task, priority = 0) {
  return performanceHelper.measureAsync('queue-enqueue', async () => {
    // Enqueue implementation
  }, { queueName, priority, taskSize: JSON.stringify(task).length });
}

async dequeue(queueName) {
  const end = performanceHelper.startOperation('queue-dequeue', { queueName });

  try {
    const task = await this._getNextTask(queueName);
    end();
    return task;
  } catch (error) {
    end(error);
    throw error;
  }
}
```

## Monitoring Database Operations

For dataservice similar pattern:

```javascript
async find(container, query, options = {}) {
  return performanceHelper.measureAsync('db-find', async () => {
    const result = await this._executeQuery(container, query, options);
    return result;
  }, { 
    container, 
    queryFields: Object.keys(query),
    limit: options.limit,
    skip: options.skip,
    resultCount: result?.length || 0
  });
}

async insert(container, document) {
  return performanceHelper.measureAsync('db-insert', async () => {
    return await this._insertDocument(container, document);
  }, { 
    container, 
    documentSize: JSON.stringify(document).length 
  });
}
```

## Monitoring API Endpoints

For routes with threshold alerts:

```javascript
const performanceHelper = require('../../views/modules/performanceHelper');

module.exports = (app, service, logger) => {
  // List endpoint with 100ms threshold
  app.get('/api/items', async (req, res) => {
    const endWithThreshold = performanceHelper.withThreshold(
      'api-list-items',
      100,
      (duration) => {
        logger?.warn('[ItemService] Slow API response', {
          endpoint: '/api/items',
          duration: duration.toFixed(2),
          threshold: 100
        });
      }
    );

    try {
      const items = await service.getItems();
      endWithThreshold();
      res.json(items);
    } catch (error) {
      endWithThreshold(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Search endpoint with custom metadata
  app.post('/api/search', async (req, res) => {
    const end = performanceHelper.startOperation('api-search', {
      queryLength: req.body.query?.length || 0,
      filters: Object.keys(req.body.filters || {}).length
    });

    try {
      const results = await service.search(req.body.query, req.body.filters);
      end();
      res.json({ results, count: results.length });
    } catch (error) {
      end(error);
      res.status(500).json({ error: error.message });
    }
  });
};
```

## Monitoring Workflow Execution

```javascript
async executeWorkflow(workflowName, data) {
  const batchTracker = performanceHelper.createBatchTracker(`workflow-${workflowName}`);

  const workflow = this.workflows[workflowName];
  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowName}`);
  }

  const results = [];

  for (const step of workflow.steps) {
    const endStep = batchTracker.track('step-execution');

    try {
      const stepResult = await this._executeStep(step, data);
      results.push({
        stepId: step.id,
        status: 'completed',
        result: stepResult
      });
      endStep();
    } catch (error) {
      results.push({
        stepId: step.id,
        status: 'error',
        error: error.message
      });
      endStep(error);
    }

    // Pass result to next step
    data = { ...data, previousResult: results[results.length - 1] };
  }

  // Log workflow completion stats
  const stats = batchTracker.getStats();
  this.logger?.info(`[${workflowName}] Workflow completed`, {
    totalSteps: stats.totalItems,
    successfulSteps: results.filter(r => r.status === 'completed').length,
    avgStepDuration: stats.averageItemDuration,
    totalDuration: stats.batch?.max || 0,
    timestamp: Date.now()
  });

  return results;
}
```

## Performance Best Practices

### 1. Be Specific with Operation Names
```javascript
// ✅ Good - Specific and searchable
performanceHelper.startOperation('cache-redis-get', { key, ttl });

// ❌ Bad - Too generic
performanceHelper.startOperation('get', {});
```

### 2. Include Relevant Metadata
```javascript
// ✅ Good - Includes context for debugging
performanceHelper.measureAsync('db-query', async () => { /* ... */ }, {
  collection: 'users',
  query: 'findById',
  indexed: true
});

// ❌ Bad - No context
performanceHelper.measureAsync('db-query', async () => { /* ... */ });
```

### 3. Monitor at Service Boundaries
```javascript
// ✅ Good - Monitor API entry points
app.post('/api/users', async (req, res) => {
  const end = performanceHelper.startOperation('api-create-user');
  // ...
});

// ✅ Good - Monitor external service calls
const httpResult = await performanceHelper.measureAsync('http-fetch', 
  () => fetch(url), { url }
);

// ❌ Bad - Too granular, overwhelming data
for (const item of items) {
  performanceHelper.startOperation('loop-iteration');
}
```

### 4. Use Batch Trackers for Repeated Operations
```javascript
// ✅ Good - Aggregated stats
const tracker = performanceHelper.createBatchTracker('bulk-import');
for (item of items) {
  const end = tracker.track('import-item');
  await importItem(item);
  end();
}

// ❌ Bad - Pollutes dashboard with hundreds of individual marks
for (item of items) {
  await performanceHelper.measureAsync('import-item', 
    () => importItem(item)
  );
}
```

## Validation Checklist

After integrating performance monitoring:

- [ ] All major service operations tracked
- [ ] API endpoints wrapped with threshold alerts
- [ ] Batch operations use batch tracker
- [ ] Error cases properly recorded with error parameter
- [ ] Operation names follow consistent naming convention
- [ ] Metadata includes relevant context for debugging
- [ ] Dashboard shows expected operations in performance marks table
- [ ] Event loop lag graph shows reasonable values (< 50ms typically)
- [ ] GC chart updates when operations cause allocation
- [ ] No observable performance impact from monitoring itself

## See Also

- [Performance Monitoring Guide](./PERFORMANCE_MONITORING.md)
- [Service Architecture](./SERVICE_ARCHITECTURE.md)
- [Node.js Performance Hooks](https://nodejs.org/api/perf_hooks.html)
