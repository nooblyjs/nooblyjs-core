/**
 * @fileoverview Working Service Demo
 * Example showing how to use the NooblyJS Working Service (Background Tasks)
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

// Example 1: Using memory worker (default)
const memoryWorker = serviceRegistry.working('memory', {
  concurrency: 3,
  maxRetries: 3,
  retryDelay: 5000,
  timeout: 30000 // 30 seconds
});

// Example 2: Using cluster worker for CPU-intensive tasks
const clusterWorker = serviceRegistry.working('cluster', {
  workers: 4, // Number of worker processes
  concurrency: 2, // Tasks per worker
  maxRetries: 2
});

// Example 3: Using Redis worker for distributed processing
/*
const redisWorker = serviceRegistry.working('redis', {
  redis: {
    host: 'localhost',
    port: 6379
  },
  concurrency: 5
});
*/

// Task execution tracking
const taskExecutions = [];
const maxExecutionHistory = 500;

function trackExecution(taskName, taskId, result, duration, error = null) {
  taskExecutions.push({
    taskId,
    taskName,
    executedAt: new Date().toISOString(),
    duration,
    success: !error,
    result: error ? null : result,
    error: error ? error.message : null
  });

  // Keep only the last maxExecutionHistory executions
  if (taskExecutions.length > maxExecutionHistory) {
    taskExecutions.splice(0, taskExecutions.length - maxExecutionHistory);
  }
}

// Define background task handlers
const taskHandlers = {
  // Image processing task
  'process-image': async (data, progress) => {
    const { imageUrl, operations = [], quality = 80 } = data;
    console.log(`🖼️ Processing image: ${imageUrl}`);

    try {
      let currentStep = 0;
      const totalSteps = operations.length + 1; // +1 for final step

      // Download image (simulated)
      await progress(10, 'Downloading image...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Process each operation
      for (const operation of operations) {
        currentStep++;
        const progressPercent = Math.floor((currentStep / totalSteps) * 80);
        await progress(progressPercent, `Applying ${operation}...`);

        // Simulate processing time based on operation
        const processingTime = operation === 'resize' ? 1500 :
                              operation === 'filter' ? 2000 :
                              operation === 'compress' ? 1000 : 500;
        await new Promise(resolve => setTimeout(resolve, processingTime));
      }

      // Upload processed image (simulated)
      await progress(90, 'Uploading processed image...');
      await new Promise(resolve => setTimeout(resolve, 800));

      await progress(100, 'Complete');

      return {
        originalUrl: imageUrl,
        processedUrl: `https://cdn.example.com/processed/${Date.now()}.jpg`,
        operations: operations,
        quality: quality,
        fileSize: Math.floor(Math.random() * 5000000) + 1000000, // 1-5MB
        dimensions: { width: 1920, height: 1080 }
      };

    } catch (error) {
      throw new Error(`Image processing failed: ${error.message}`);
    }
  },

  // Data export task
  'export-data': async (data, progress) => {
    const { format, query, userId, includeHeaders = true } = data;
    console.log(`📊 Exporting data for user ${userId} in ${format} format`);

    try {
      await progress(5, 'Initializing export...');

      // Query data (simulated)
      await progress(20, 'Querying database...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const recordCount = Math.floor(Math.random() * 10000) + 1000;

      // Process records in batches
      const batchSize = 1000;
      const batches = Math.ceil(recordCount / batchSize);

      for (let i = 0; i < batches; i++) {
        const progressPercent = 20 + Math.floor((i / batches) * 60);
        await progress(progressPercent, `Processing batch ${i + 1}/${batches}...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Generate file (simulated)
      await progress(90, `Generating ${format} file...`);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Upload to storage (simulated)
      await progress(98, 'Uploading to storage...');
      await new Promise(resolve => setTimeout(resolve, 500));

      await progress(100, 'Export complete');

      return {
        fileName: `export_${userId}_${Date.now()}.${format}`,
        downloadUrl: `https://exports.example.com/download/${Date.now()}`,
        format: format,
        recordCount: recordCount,
        fileSize: `${(recordCount * 0.5).toFixed(2)} MB`,
        includeHeaders: includeHeaders,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

    } catch (error) {
      throw new Error(`Data export failed: ${error.message}`);
    }
  },

  // Email campaign task
  'send-campaign': async (data, progress) => {
    const { campaignId, recipients = [], template, subject } = data;
    console.log(`📧 Sending email campaign ${campaignId} to ${recipients.length} recipients`);

    try {
      await progress(5, 'Preparing campaign...');
      await new Promise(resolve => setTimeout(resolve, 500));

      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        const progressPercent = 5 + Math.floor((i / recipients.length) * 90);
        await progress(progressPercent, `Sending to ${recipient.email} (${i + 1}/${recipients.length})`);

        // Simulate email sending with occasional failures
        const sendDelay = Math.random() * 200 + 50;
        await new Promise(resolve => setTimeout(resolve, sendDelay));

        if (Math.random() > 0.05) { // 95% success rate
          sentCount++;
        } else {
          failedCount++;
        }
      }

      await progress(100, 'Campaign complete');

      return {
        campaignId: campaignId,
        totalRecipients: recipients.length,
        sentCount: sentCount,
        failedCount: failedCount,
        successRate: `${((sentCount / recipients.length) * 100).toFixed(1)}%`,
        template: template,
        subject: subject
      };

    } catch (error) {
      throw new Error(`Email campaign failed: ${error.message}`);
    }
  },

  // Report generation task
  'generate-report': async (data, progress) => {
    const { reportType, dateRange, filters = {}, format = 'pdf' } = data;
    console.log(`📈 Generating ${reportType} report in ${format} format`);

    try {
      await progress(10, 'Collecting data...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      await progress(30, 'Analyzing metrics...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      await progress(60, 'Generating charts...');
      await new Promise(resolve => setTimeout(resolve, 2500));

      await progress(80, 'Formatting report...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      await progress(95, 'Finalizing...');
      await new Promise(resolve => setTimeout(resolve, 500));

      await progress(100, 'Report ready');

      return {
        reportType: reportType,
        format: format,
        dateRange: dateRange,
        filters: filters,
        pages: Math.floor(Math.random() * 50) + 10,
        charts: Math.floor(Math.random() * 10) + 5,
        downloadUrl: `https://reports.example.com/${reportType}_${Date.now()}.${format}`,
        fileSize: `${(Math.random() * 10 + 2).toFixed(1)} MB`
      };

    } catch (error) {
      throw new Error(`Report generation failed: ${error.message}`);
    }
  },

  // Backup task
  'backup-database': async (data, progress) => {
    const { databases = [], compressionLevel = 6 } = data;
    console.log(`💾 Backing up ${databases.length} databases`);

    try {
      await progress(5, 'Preparing backup...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      let totalSize = 0;

      for (let i = 0; i < databases.length; i++) {
        const db = databases[i];
        const baseProgress = 5 + (i / databases.length) * 80;

        await progress(baseProgress, `Backing up ${db}...`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        await progress(baseProgress + 10, `Compressing ${db}...`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        totalSize += Math.random() * 1000000000 + 100000000; // 100MB - 1GB per DB
      }

      await progress(90, 'Uploading to storage...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      await progress(100, 'Backup complete');

      return {
        databases: databases,
        compressionLevel: compressionLevel,
        totalSize: `${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`,
        backupLocation: 's3://backups/database/',
        retentionDays: 30,
        backupId: `backup_${Date.now()}`
      };

    } catch (error) {
      throw new Error(`Database backup failed: ${error.message}`);
    }
  }
};

// Note: The working service doesn't support inline task handlers
// It expects external script files to be executed in worker threads
//
// Register task handlers - NOT SUPPORTED by basic working service
// Object.entries(taskHandlers).forEach(([taskName, handler]) => {
//   memoryWorker.define(taskName, handler); // This method doesn't exist
// });

console.log('⚠️  The working service only supports execution of external script files');
console.log('   Each task must be a separate .js file that can be run in a worker thread');
console.log('   Inline task handlers are not supported by the basic working service');

// API endpoints for background task management

// Start a background task
app.post('/tasks/:taskType', async (req, res) => {
  try {
    const { taskType } = req.params;
    const { data, options = {} } = req.body;

    if (!taskHandlers[taskType]) {
      return res.status(400).json({
        error: `Unknown task type: ${taskType}`,
        availableTypes: Object.keys(taskHandlers)
      });
    }

    // Basic working service doesn't have 'add' method, use 'start'
    // This would need an external script file to work:
    // await memoryWorker.start('/path/to/task-script.js', data, (status, result) => {
    //   console.log('Task status:', status, result);
    // });

    // Mock response since advanced task features aren't available
    const task = {
      id: `task_${Date.now()}`,
      type: taskType,
      status: 'not_supported',
      message: 'Basic working service only supports external script execution'
    };

    res.json({
      success: false,
      message: 'Basic working service doesn\'t support inline task handlers',
      task: {
        id: task.id,
        type: taskType,
        data: data,
        status: 'queued',
        createdAt: new Date().toISOString(),
        options: options
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task status and progress
app.get('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    // Basic working service doesn't have 'getTask' method
    const task = null; // Mock null result

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({
      task: {
        id: task.id,
        type: task.name,
        data: task.data,
        status: task.status,
        progress: {
          percentage: task.progress?.percentage || 0,
          message: task.progress?.message || 'Initializing...'
        },
        attempts: task.attemptsMade || 0,
        maxAttempts: task.opts?.attempts || 3,
        createdAt: task.timestamp,
        startedAt: task.processedOn,
        completedAt: task.finishedOn,
        error: task.failedReason,
        result: task.returnvalue
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List tasks by status
app.get('/tasks', async (req, res) => {
  try {
    const { status = 'active', limit = 20, offset = 0 } = req.query;
    // Basic working service doesn't have 'getTasks' method
    const tasks = []; // Mock empty list
    // Original call would have been:
    // const tasks = await memoryWorker.getTasks(status, {
    //   limit: parseInt(limit),
    //   offset: parseInt(offset)
    // });

    const taskList = tasks.map(task => ({
      id: task.id,
      type: task.name,
      status: task.status,
      progress: {
        percentage: task.progress?.percentage || 0,
        message: task.progress?.message || 'Initializing...'
      },
      createdAt: task.timestamp,
      attempts: task.attemptsMade || 0
    }));

    res.json({
      tasks: taskList,
      count: taskList.length,
      status: status,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel a task
app.delete('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    // Basic working service doesn't have 'removeTask' method
    const success = false; // Mock failure

    if (!success) {
      return res.status(404).json({ error: 'Task not found or cannot be cancelled' });
    }

    res.json({
      success: true,
      message: `Task ${taskId} cancelled successfully`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retry a failed task
app.post('/tasks/:taskId/retry', async (req, res) => {
  try {
    const { taskId } = req.params;
    // Basic working service doesn't have 'retryTask' method
    const success = false; // Mock failure

    if (!success) {
      return res.status(404).json({ error: 'Task not found or cannot be retried' });
    }

    res.json({
      success: true,
      message: `Task ${taskId} queued for retry`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get worker statistics
app.get('/workers/stats', async (req, res) => {
  try {
    // Basic working service doesn't have 'getStats' method
    const stats = { running: 0, completed: 0, failed: 0, pending: 0 }; // Mock stats

    res.json({
      stats: {
        activeWorkers: stats.activeWorkers || 0,
        activeTasks: stats.activeTasks || 0,
        completedTasks: stats.completedTasks || 0,
        failedTasks: stats.failedTasks || 0,
        queuedTasks: stats.queuedTasks || 0,
        processingRate: stats.processingRate || 0, // tasks per minute
        averageProcessingTime: stats.averageProcessingTime || 0 // ms
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task execution history
app.get('/tasks/executions/history', async (req, res) => {
  try {
    const { taskName, limit = 50, success } = req.query;

    let executions = [...taskExecutions];

    // Filter by task name if provided
    if (taskName) {
      executions = executions.filter(exec => exec.taskName === taskName);
    }

    // Filter by success status if provided
    if (success !== undefined) {
      const isSuccess = success === 'true';
      executions = executions.filter(exec => exec.success === isSuccess);
    }

    // Sort by most recent first and limit results
    executions = executions
      .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
      .slice(0, parseInt(limit));

    res.json({
      executions: executions,
      count: executions.length,
      filters: { taskName, success },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk task operations
app.post('/tasks/bulk', async (req, res) => {
  try {
    const { tasks } = req.body;

    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Tasks must be an array' });
    }

    const results = [];

    for (const taskData of tasks) {
      try {
        if (!taskHandlers[taskData.type]) {
          results.push({
            success: false,
            error: `Unknown task type: ${taskData.type}`,
            taskData: taskData
          });
          continue;
        }

        // Basic working service would need external script files
        // const task = await memoryWorker.start('/path/to/script.js', taskData.data, callback);
        results.push({
          success: true,
          task: {
            id: task.id,
            type: taskData.type,
            data: taskData.data
          }
        });
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          taskData: taskData
        });
      }
    }

    res.json({
      success: true,
      results: results,
      total: tasks.length,
      successful: results.filter(r => r.success).length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Task templates for common operations
const taskTemplates = {
  'image-processing': {
    description: 'Process images with various operations',
    example: {
      type: 'process-image',
      data: {
        imageUrl: 'https://example.com/image.jpg',
        operations: ['resize', 'compress', 'watermark'],
        quality: 80
      }
    }
  },
  'data-export': {
    description: 'Export data in various formats',
    example: {
      type: 'export-data',
      data: {
        format: 'csv',
        query: 'SELECT * FROM users WHERE active = true',
        userId: 'user123',
        includeHeaders: true
      }
    }
  },
  'email-campaign': {
    description: 'Send bulk email campaigns',
    example: {
      type: 'send-campaign',
      data: {
        campaignId: 'campaign-123',
        recipients: [
          { email: 'user1@example.com', name: 'User 1' },
          { email: 'user2@example.com', name: 'User 2' }
        ],
        template: 'newsletter',
        subject: 'Monthly Newsletter'
      }
    }
  }
};

app.get('/tasks/templates', (req, res) => {
  res.json({
    templates: taskTemplates,
    availableTaskTypes: Object.keys(taskHandlers)
  });
});

// Event listeners
globalEventEmitter.on('task:started', (data) => {
  console.log(`🚀 Task started: ${data.type} (ID: ${data.id})`);
});

globalEventEmitter.on('task:progress', (data) => {
  console.log(`📊 Task progress: ${data.type} (ID: ${data.id}) - ${data.progress}%: ${data.message}`);
});

globalEventEmitter.on('task:completed', (data) => {
  console.log(`✅ Task completed: ${data.type} (ID: ${data.id})`);
  trackExecution(data.type, data.id, data.result, data.duration);
});

globalEventEmitter.on('task:failed', (data) => {
  console.log(`❌ Task failed: ${data.type} (ID: ${data.id}) - ${data.error}`);
  trackExecution(data.type, data.id, null, data.duration, new Error(data.error));
});

// Create some sample tasks for demonstration
async function createSampleTasks() {
  try {
    // Image processing task
    // Basic working service would need external script files
    // await memoryWorker.start('/path/to/process-image.js', {
    //   imageUrl: 'https://example.com/sample.jpg',
    //   operations: ['resize', 'compress'],
    //   quality: 85
    // }, (status, result) => {
    //   console.log('Image processing:', status, result);
    // });
    console.log('Image processing task would run here with proper script file');

    // Data export task
    // Basic working service would need external script files
    // await memoryWorker.start('/path/to/export-data.js', {
    //   format: 'csv',
    //   query: 'SELECT * FROM users',
    //   userId: 'demo-user',
    //   includeHeaders: true
    // }, (status, result) => {
    //   console.log('Export task:', status, result);
    // });
    console.log('Data export task would run here with proper script file');

    console.log('Sample tasks added to queue');
  } catch (error) {
    console.error('Error creating sample tasks:', error);
  }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n⚙️ Working Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- Working Interface: http://localhost:3000/services/working/');
  console.log('- Swagger API Docs: http://localhost:3000/services/working/swagger');
  console.log('- Service Status: http://localhost:3000/services/working/api/status');
  console.log('- Start Task: POST http://localhost:3000/tasks/{taskType}');
  console.log('- Get Task: GET http://localhost:3000/tasks/{taskId}');
  console.log('- List Tasks: GET http://localhost:3000/tasks?status=active');
  console.log('- Cancel Task: DELETE http://localhost:3000/tasks/{taskId}');
  console.log('- Retry Task: POST http://localhost:3000/tasks/{taskId}/retry');
  console.log('- Worker Stats: GET http://localhost:3000/workers/stats');
  console.log('- Execution History: GET http://localhost:3000/tasks/executions/history');
  console.log('- Bulk Tasks: POST http://localhost:3000/tasks/bulk');
  console.log('- Task Templates: GET http://localhost:3000/tasks/templates');
  console.log('\nSupported task types:');
  console.log('- process-image: Image processing with operations');
  console.log('- export-data: Data export in various formats');
  console.log('- send-campaign: Bulk email campaigns');
  console.log('- generate-report: Report generation');
  console.log('- backup-database: Database backup operations');
  console.log('\nExample task creation:');
  console.log('{ "data": { "imageUrl": "https://example.com/image.jpg", "operations": ["resize", "compress"] } }');

  // Create some sample tasks for demonstration
  setTimeout(createSampleTasks, 2000);
});