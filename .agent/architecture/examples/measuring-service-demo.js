/**
 * @fileoverview Measuring Service Demo
 * Example showing how to use the NooblyJS Measuring Service
 * @author NooblyJS Team
 * @version 1.0.0
 */

const express = require('express');
const serviceRegistry = require('../index');

const app = express();

// Add body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize the service registry
const eventEmitter = require('events');
const globalEventEmitter = new eventEmitter();

serviceRegistry.initialize(app, globalEventEmitter, {
  // Optional API key authentication
  // apiKeys: ['your-api-key-here'],
  // requireApiKey: false
});

// Example 1: Using memory metrics store (default)
const memoryMetrics = serviceRegistry.measuring('memory', {
  retentionPeriod: 3600, // Keep metrics for 1 hour
  aggregationInterval: 60 // Aggregate metrics every 60 seconds
});

// Example 2: Using Prometheus metrics
const prometheusMetrics = serviceRegistry.measuring('prometheus', {
  port: 9090,
  endpoint: '/metrics',
  pushGateway: {
    // url: 'http://localhost:9091',
    // jobName: 'nooblyjs-demo'
  }
});

// Example 3: Using InfluxDB for time series data
/*
const influxMetrics = serviceRegistry.measuring('influxdb', {
  host: 'localhost',
  port: 8086,
  database: 'nooblyjs_metrics',
  // username: 'your-username',
  // password: 'your-password'
});
*/

// Custom metrics middleware
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();

  // Count requests
  memoryMetrics.add('http_requests_total', 1);

  // Track concurrent requests
  memoryMetrics.add('http_requests_concurrent', 1);

  // Override res.end to measure response time
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;

    // Record response time
    memoryMetrics.add('http_request_duration_ms', duration);

    // Update request counter with final status
    memoryMetrics.add('http_requests_total', 1);

    // Decrement concurrent requests (simulate by adding negative value)
    memoryMetrics.add('http_requests_concurrent', -1);

    // Track response sizes
    const responseSize = parseInt(res.get('Content-Length')) || 0;
    memoryMetrics.add('http_response_size_bytes', responseSize);

    originalEnd.call(res, chunk, encoding);
  };

  next();
};

// Apply metrics middleware
app.use(metricsMiddleware);

// Business metrics examples
app.get('/users', (req, res) => {
  // Simulate user data retrieval
  const userCount = Math.floor(Math.random() * 1000) + 1;

  // Track business metrics
  memoryMetrics.add('active_users_count', userCount);
  memoryMetrics.add('user_list_requests', 1);

  // Simulate database query time
  const dbQueryTime = Math.random() * 100 + 10;
  memoryMetrics.add('database_query_duration_ms', dbQueryTime);

  res.json({
    users: Array.from({ length: userCount }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      active: Math.random() > 0.3
    })),
    total: userCount,
    queryTime: dbQueryTime
  });
});

app.post('/users', (req, res) => {
  // Track user creation
  memoryMetrics.add('users_created_total', 1);
  memoryMetrics.add('database_operations_total', 1);

  // Simulate processing time
  const processingTime = Math.random() * 200 + 50;
  memoryMetrics.add('user_creation_duration_ms', processingTime);

  setTimeout(() => {
    // Track success/failure
    const success = Math.random() > 0.1; // 90% success rate

    if (success) {
      memoryMetrics.add('users_created_success', 1);
      res.status(201).json({
        success: true,
        user: { id: Date.now(), ...req.body },
        processingTime: processingTime
      });
    } else {
      memoryMetrics.add('users_created_errors', 1);
      res.status(500).json({
        success: false,
        error: 'User creation failed',
        processingTime: processingTime
      });
    }
  }, processingTime);
});

// Performance monitoring endpoints
app.get('/slow-endpoint', async (req, res) => {
  const operationStart = Date.now();

  // Track slow operations
  memoryMetrics.add('slow_operations_started', 1);

  try {
    // Simulate CPU-intensive work
    const workload = parseInt(req.query.workload) || 1000;
    memoryMetrics.add('workload_size', workload);

    await new Promise(resolve => {
      let count = 0;
      const interval = setInterval(() => {
        count += 100;
        if (count >= workload) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    const duration = Date.now() - operationStart;

    // Record performance metrics
    memoryMetrics.add('slow_operation_duration_ms', duration);
    memoryMetrics.add('slow_operations_completed', 1);

    // Track performance thresholds
    if (duration > 5000) {
      memoryMetrics.add('slow_operations_exceeded_sla', 1);
    }

    res.json({
      message: 'Slow operation completed',
      duration: duration,
      workload: workload,
      performance: duration > 5000 ? 'exceeded_sla' : 'within_sla'
    });

  } catch (error) {
    memoryMetrics.add('slow_operations_failed', 1);
    res.status(500).json({ error: error.message });
  }
});

// Resource usage monitoring
app.get('/resource-usage', (req, res) => {
  // CPU usage (simulated)
  const cpuUsage = Math.random() * 100;
  memoryMetrics.add('cpu_usage_percent', cpuUsage);

  // Memory usage
  const memUsage = process.memoryUsage();
  memoryMetrics.add('memory_heap_used_bytes', memUsage.heapUsed);
  memoryMetrics.add('memory_heap_total_bytes', memUsage.heapTotal);
  memoryMetrics.add('memory_rss_bytes', memUsage.rss);

  // Event loop lag (simulated)
  const eventLoopLag = Math.random() * 10;
  memoryMetrics.add('event_loop_lag_ms', eventLoopLag);

  res.json({
    cpu: `${cpuUsage.toFixed(2)}%`,
    memory: {
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`
    },
    eventLoopLag: `${eventLoopLag.toFixed(2)} ms`
  });
});

// Custom metric creation
app.post('/metrics/custom', (req, res) => {
  try {
    const { name, type, value, labels = {} } = req.body;

    if (!name || !type || value === undefined) {
      return res.status(400).json({
        error: 'Name, type, and value are required',
        supportedTypes: ['counter', 'gauge', 'histogram']
      });
    }

    switch (type.toLowerCase()) {
      case 'counter':
        memoryMetrics.add(name, value || 1);
        break;
      case 'gauge':
        memoryMetrics.add(name, value);
        break;
      case 'histogram':
        memoryMetrics.add(name, value);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported metric type' });
    }

    res.json({
      success: true,
      metric: { name, type, value, labels },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Metrics retrieval endpoints
app.get('/metrics/current', async (req, res) => {
  try {
    const metrics = await memoryMetrics.getAllMetrics();

    res.json({
      metrics: metrics,
      timestamp: new Date().toISOString(),
      count: Object.keys(metrics).length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/metrics/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { timeRange, aggregation } = req.query;

    const metric = await memoryMetrics.getMetric(name, {
      timeRange: timeRange,
      aggregation: aggregation
    });

    if (!metric) {
      return res.status(404).json({ error: 'Metric not found' });
    }

    res.json({
      name: name,
      metric: metric,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check with metrics
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  };

  // Track health checks
  memoryMetrics.add('health_checks_total', 1);
  memoryMetrics.add('application_uptime_seconds', process.uptime());

  res.json(healthCheck);
});

// Metrics export (Prometheus format)
app.get('/prometheus-metrics', async (req, res) => {
  try {
    const prometheusFormat = await memoryMetrics.exportPrometheus();

    res.set('Content-Type', 'text/plain');
    res.send(prometheusFormat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event listeners
globalEventEmitter.on('metrics:recorded', (data) => {
  console.log(`📊 Metric recorded: ${data.name} = ${data.value}`);
});

globalEventEmitter.on('metrics:threshold-exceeded', (data) => {
  console.log(`⚠️ Threshold exceeded for ${data.metric}: ${data.value} > ${data.threshold}`);
});

// Performance monitoring interval
setInterval(() => {
  // Collect system metrics periodically
  const memUsage = process.memoryUsage();
  memoryMetrics.add('system_memory_heap_used', memUsage.heapUsed);
  memoryMetrics.add('system_memory_heap_total', memUsage.heapTotal);
  memoryMetrics.add('system_uptime_seconds', process.uptime());

  // Simulate some business metrics
  memoryMetrics.add('active_connections', Math.floor(Math.random() * 100));
  memoryMetrics.add('background_tasks_processed', 1);

}, 30000); // Every 30 seconds

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // Track application start
  memoryMetrics.add('application_starts_total', 1);
  memoryMetrics.add('application_start_timestamp', Date.now());

  console.log(`\n📊 Measuring Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- Measuring Interface: http://localhost:3000/services/measuring/');
  console.log('- Swagger API Docs: http://localhost:3000/services/measuring/swagger');
  console.log('- Service Status: http://localhost:3000/services/measuring/api/status');
  console.log('- Users (with metrics): GET http://localhost:3000/users');
  console.log('- Create User: POST http://localhost:3000/users');
  console.log('- Slow Endpoint: GET http://localhost:3000/slow-endpoint?workload=2000');
  console.log('- Resource Usage: GET http://localhost:3000/resource-usage');
  console.log('- Custom Metric: POST http://localhost:3000/metrics/custom');
  console.log('- All Metrics: GET http://localhost:3000/metrics/current');
  console.log('- Specific Metric: GET http://localhost:3000/metrics/{name}');
  console.log('- Health Check: GET http://localhost:3000/health');
  console.log('- Prometheus Metrics: GET http://localhost:3000/prometheus-metrics');
  console.log('\nExample custom metric:');
  console.log('{ "name": "orders_total", "type": "counter", "value": 5, "labels": {"status": "completed"} }');
  console.log('\nMetrics are automatically collected for HTTP requests, response times, and system resources.');
});