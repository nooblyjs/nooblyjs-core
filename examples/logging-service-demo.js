/**
 * @fileoverview Logging Service Demo
 * Example showing how to use the NooblyJS Logging Service
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

// Example 1: Using console logger (default)
const consoleLogger = serviceRegistry.logging('console', {
  level: 'info',
  format: 'json', // or 'simple'
  timestamp: true,
  colorize: true
});

// Example 2: Using file logger
const fileLogger = serviceRegistry.logging('file', {
  level: 'debug',
  filename: './logs/application.log',
  maxsize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  format: 'json'
});

// Example 3: Using Winston with custom transport
const winstonLogger = serviceRegistry.logging('winston', {
  level: 'info',
  transports: [
    {
      type: 'console',
      options: {
        format: 'simple',
        colorize: true
      }
    },
    {
      type: 'file',
      options: {
        filename: './logs/winston-app.log',
        maxsize: 5 * 1024 * 1024,
        format: 'json'
      }
    }
  ]
});

// Example 4: Using remote logging (e.g., to a logging service)
/*
const remoteLogger = serviceRegistry.logging('remote', {
  endpoint: 'https://your-logging-service.com/api/logs',
  apiKey: 'your-api-key',
  batch: true,
  batchSize: 10,
  flushInterval: 5000 // 5 seconds
});
*/

// Custom request logging middleware
const requestLogger = (logger) => {
  return (req, res, next) => {
    const start = Date.now();
    const userAgent = req.get('User-Agent');
    const ip = req.ip || req.connection.remoteAddress;

    // Log request start
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      userAgent: userAgent,
      ip: ip,
      timestamp: new Date().toISOString(),
      requestId: req.id || Math.random().toString(36).substr(2, 9)
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - start;

      logger.info('HTTP Response', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: duration,
        contentLength: res.get('Content-Length') || 0,
        timestamp: new Date().toISOString()
      });

      originalEnd.call(res, chunk, encoding);
    };

    next();
  };
};

// Apply request logging middleware
app.use(requestLogger(fileLogger));

// Example routes with different log levels
app.get('/info', (req, res) => {
  consoleLogger.info('Info endpoint accessed', {
    user: req.query.user || 'anonymous',
    timestamp: new Date().toISOString()
  });

  res.json({
    message: 'This is an info level log',
    logLevel: 'info',
    timestamp: new Date().toISOString()
  });
});

app.get('/debug', (req, res) => {
  fileLogger.debug('Debug endpoint accessed', {
    query: req.query,
    headers: req.headers,
    method: req.method,
    url: req.url
  });

  res.json({
    message: 'Debug information logged',
    logLevel: 'debug',
    query: req.query
  });
});

app.get('/warn', (req, res) => {
  winstonLogger.warn('Warning endpoint accessed - this might indicate an issue', {
    warningType: 'potential_issue',
    severity: 'medium',
    timestamp: new Date().toISOString(),
    context: {
      endpoint: '/warn',
      user: req.query.user || 'anonymous'
    }
  });

  res.json({
    message: 'Warning logged',
    logLevel: 'warn',
    warning: 'This endpoint is deprecated and will be removed in v2.0'
  });
});

app.get('/error', (req, res) => {
  try {
    // Simulate an error condition
    if (Math.random() > 0.5) {
      throw new Error('Simulated random error for demo purposes');
    }

    res.json({ message: 'No error occurred this time' });
  } catch (error) {
    consoleLogger.error('Error occurred in /error endpoint', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      request: {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      },
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'An error was logged',
      logLevel: 'error'
    });
  }
});

// Structured logging examples
app.post('/user-action', (req, res) => {
  const { action, userId, data } = req.body;

  // Structure logs with consistent fields
  fileLogger.info('User Action', {
    event: 'user_action',
    userId: userId,
    action: action,
    data: data,
    metadata: {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
      sessionId: req.get('X-Session-ID') || 'unknown'
    }
  });

  res.json({
    success: true,
    message: 'User action logged',
    action: action
  });
});

// Performance logging
app.get('/slow-operation', async (req, res) => {
  const operationStart = Date.now();

  winstonLogger.info('Starting slow operation', {
    operation: 'data_processing',
    startTime: new Date().toISOString()
  });

  try {
    // Simulate slow operation
    await new Promise(resolve => setTimeout(resolve, 2000));

    const duration = Date.now() - operationStart;

    winstonLogger.info('Slow operation completed', {
      operation: 'data_processing',
      duration: duration,
      success: true,
      endTime: new Date().toISOString()
    });

    if (duration > 3000) {
      winstonLogger.warn('Slow operation exceeded threshold', {
        operation: 'data_processing',
        duration: duration,
        threshold: 3000,
        performance_issue: true
      });
    }

    res.json({
      message: 'Slow operation completed',
      duration: duration,
      performance: duration > 3000 ? 'slow' : 'acceptable'
    });

  } catch (error) {
    const duration = Date.now() - operationStart;

    winstonLogger.error('Slow operation failed', {
      operation: 'data_processing',
      duration: duration,
      error: error.message,
      success: false
    });

    res.status(500).json({ error: 'Operation failed' });
  }
});

// Log level management
app.post('/log-level', (req, res) => {
  const { logger: loggerName, level } = req.body;
  const validLevels = ['error', 'warn', 'info', 'debug'];

  if (!validLevels.includes(level)) {
    return res.status(400).json({
      error: 'Invalid log level',
      validLevels: validLevels
    });
  }

  try {
    // Update log level dynamically
    const logger = loggerName === 'file' ? fileLogger :
                  loggerName === 'winston' ? winstonLogger : consoleLogger;

    logger.setLevel(level);

    logger.info('Log level changed', {
      previousLevel: logger.getLevel(),
      newLevel: level,
      changedBy: 'admin',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      logger: loggerName || 'console',
      newLevel: level,
      message: 'Log level updated successfully'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Log search/query endpoint
app.get('/logs/search', async (req, res) => {
  try {
    const { query, level, startDate, endDate, limit = 100 } = req.query;

    // This would typically query your log storage system
    // For demo purposes, we'll simulate a search result
    const searchResults = {
      query: query,
      filters: {
        level: level,
        startDate: startDate,
        endDate: endDate
      },
      results: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Sample log entry matching search criteria',
          metadata: { userId: '123', action: 'login' }
        }
      ],
      total: 1,
      limit: parseInt(limit)
    };

    fileLogger.info('Log search performed', {
      searchQuery: query,
      filters: { level, startDate, endDate },
      resultsCount: searchResults.total,
      searchedBy: 'admin'
    });

    res.json(searchResults);

  } catch (error) {
    consoleLogger.error('Log search failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Event listeners for logging events
globalEventEmitter.on('log:written', (data) => {
  // This would typically be handled by the logging service itself
  // but you could add custom logic here
  if (data.level === 'error') {
    console.log(`🚨 Error logged: ${data.message}`);
  }
});

globalEventEmitter.on('log:level-changed', (data) => {
  console.log(`📝 Log level changed from ${data.oldLevel} to ${data.newLevel}`);
});

// Error handling middleware (should be last)
app.use((error, req, res, next) => {
  consoleLogger.error('Unhandled application error', {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    },
    timestamp: new Date().toISOString()
  });

  res.status(500).json({
    error: 'Internal server error',
    message: 'Error has been logged',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  consoleLogger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });

  console.log(`\n📝 Logging Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- Logging Interface: http://localhost:3000/services/logging/');
  console.log('- Swagger API Docs: http://localhost:3000/services/logging/swagger');
  console.log('- Service Status: http://localhost:3000/services/logging/api/status');
  console.log('- Info Log: GET http://localhost:3000/info');
  console.log('- Debug Log: GET http://localhost:3000/debug');
  console.log('- Warning Log: GET http://localhost:3000/warn');
  console.log('- Error Log: GET http://localhost:3000/error');
  console.log('- User Action Log: POST http://localhost:3000/user-action');
  console.log('- Slow Operation: GET http://localhost:3000/slow-operation');
  console.log('- Change Log Level: POST http://localhost:3000/log-level');
  console.log('- Search Logs: GET http://localhost:3000/logs/search');
  console.log('\nExample user action log:');
  console.log('{ "action": "login", "userId": "user123", "data": {"method": "oauth"} }');
  console.log('\nExample log level change:');
  console.log('{ "logger": "file", "level": "debug" }');
  console.log('\nLog files created in ./logs/ directory');
});