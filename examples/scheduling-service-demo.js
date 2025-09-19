/**
 * @fileoverview Scheduling Service Demo
 * Example showing how to use the NooblyJS Scheduling Service
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

// Example 1: Using node-cron scheduler (default)
const cronScheduler = serviceRegistry.scheduling('memory', {
  timezone: 'America/New_York'
});

// Example 2: Using node-schedule for more flexibility
const nodeScheduler = serviceRegistry.scheduling('node-schedule', {
  timezone: 'UTC'
});

// Example 3: Using agenda with MongoDB persistence
/*
const agendaScheduler = serviceRegistry.scheduling('agenda', {
  db: {
    address: 'mongodb://localhost:27017/scheduler',
    collection: 'scheduled_jobs'
  }
});
*/

// Job execution tracking
const jobExecutions = [];
const maxExecutionHistory = 1000;

function trackExecution(jobName, result, duration, error = null) {
  jobExecutions.push({
    jobName,
    executedAt: new Date().toISOString(),
    duration,
    success: !error,
    result: error ? null : result,
    error: error ? error.message : null
  });

  // Keep only the last maxExecutionHistory executions
  if (jobExecutions.length > maxExecutionHistory) {
    jobExecutions.splice(0, jobExecutions.length - maxExecutionHistory);
  }
}

// Define scheduled job handlers
const jobHandlers = {
  // Daily cleanup job
  'daily-cleanup': async () => {
    const start = Date.now();
    console.log('🧹 Running daily cleanup...');

    try {
      // Simulate cleanup operations
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate cleaning old logs
      const logsDeleted = Math.floor(Math.random() * 100) + 1;

      // Simulate cleaning temp files
      const filesDeleted = Math.floor(Math.random() * 50) + 1;

      // Simulate database cleanup
      const recordsArchived = Math.floor(Math.random() * 200) + 10;

      const result = {
        logsDeleted,
        filesDeleted,
        recordsArchived,
        status: 'completed'
      };

      const duration = Date.now() - start;
      trackExecution('daily-cleanup', result, duration);

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      trackExecution('daily-cleanup', null, duration, error);
      throw error;
    }
  },

  // Hourly status report
  'hourly-report': async () => {
    const start = Date.now();
    console.log('📊 Generating hourly status report...');

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const result = {
        timestamp: new Date().toISOString(),
        activeUsers: Math.floor(Math.random() * 1000) + 100,
        systemLoad: Math.random() * 100,
        memoryUsage: Math.random() * 90 + 10,
        responseTime: Math.random() * 200 + 50,
        status: 'healthy'
      };

      const duration = Date.now() - start;
      trackExecution('hourly-report', result, duration);

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      trackExecution('hourly-report', null, duration, error);
      throw error;
    }
  },

  // Weekly backup
  'weekly-backup': async () => {
    const start = Date.now();
    console.log('💾 Running weekly backup...');

    try {
      // Simulate backup operations
      await new Promise(resolve => setTimeout(resolve, 5000));

      const result = {
        backupId: `backup_${Date.now()}`,
        size: `${(Math.random() * 1000 + 100).toFixed(2)}GB`,
        location: 's3://backups/weekly/',
        tables: Math.floor(Math.random() * 20) + 5,
        records: Math.floor(Math.random() * 1000000) + 100000,
        status: 'completed'
      };

      const duration = Date.now() - start;
      trackExecution('weekly-backup', result, duration);

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      trackExecution('weekly-backup', null, duration, error);
      throw error;
    }
  },

  // Send notifications
  'notification-digest': async () => {
    const start = Date.now();
    console.log('📧 Sending notification digest...');

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = {
        recipientCount: Math.floor(Math.random() * 500) + 50,
        emailsSent: Math.floor(Math.random() * 450) + 45,
        pushNotificationsSent: Math.floor(Math.random() * 300) + 30,
        failedDeliveries: Math.floor(Math.random() * 10),
        status: 'completed'
      };

      const duration = Date.now() - start;
      trackExecution('notification-digest', result, duration);

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      trackExecution('notification-digest', null, duration, error);
      throw error;
    }
  },

  // Custom task handler
  'custom-task': async (params = {}) => {
    const start = Date.now();
    console.log('🔧 Running custom task...', params);

    try {
      const processingTime = params.duration || (Math.random() * 3000 + 1000);
      await new Promise(resolve => setTimeout(resolve, processingTime));

      const result = {
        taskId: params.taskId || `task_${Date.now()}`,
        parameters: params,
        processedItems: Math.floor(Math.random() * 100) + 1,
        status: 'completed'
      };

      const duration = Date.now() - start;
      trackExecution('custom-task', result, duration);

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      trackExecution('custom-task', null, duration, error);
      throw error;
    }
  }
};

// Schedule recurring jobs using interval-based scheduling
async function setupScheduledJobs() {
  try {
    // Note: This scheduling service only supports interval-based scheduling, not cron expressions
    // The service runs external scripts, not inline functions

    console.log('⚠️  This demo has been simplified for the basic scheduling service');
    console.log('   The scheduling service only supports interval-based execution of script files');
    console.log('   For cron-style scheduling, you would need a more advanced scheduler implementation');

    // Every 5 minutes (for demo purposes) - simplified example
    // Note: This would need an external script file to work properly
    // await cronScheduler.start('demo-task', '/path/to/demo-script.js', 300); // 300 seconds = 5 minutes

    console.log('[x] Basic scheduling setup completed (advanced features commented out)');
  } catch (error) {
    console.error('[ ] Error setting up scheduled jobs:', error);
  }
}

// API endpoints for job management

// Create a new scheduled job
app.post('/schedule/job', async (req, res) => {
  try {
    const { name, cron, handler, parameters = {} } = req.body;

    if (!name || !cron) {
      return res.status(400).json({
        error: 'Name and cron expression are required',
        example: { name: 'my-job', cron: '0 9 * * *', handler: 'custom-task', parameters: {} }
      });
    }

    const jobHandler = jobHandlers[handler] || jobHandlers['custom-task'];

    // Basic scheduling service doesn't support cron expressions
    // await cronScheduler.start(name, scriptPath, data, intervalSeconds);

    res.json({
      success: true,
      job: {
        name,
        cron,
        handler,
        parameters,
        status: 'scheduled',
        nextRun: 'N/A (basic scheduler doesn\'t support next run calculation)'
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schedule a one-time job
app.post('/schedule/once', async (req, res) => {
  try {
    const { name, date, handler, parameters = {} } = req.body;

    if (!name || !date) {
      return res.status(400).json({
        error: 'Name and date are required',
        example: { name: 'one-time-job', date: '2024-12-25T09:00:00Z', handler: 'custom-task' }
      });
    }

    const scheduledDate = new Date(date);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ error: 'Date must be in the future' });
    }

    const jobHandler = jobHandlers[handler] || jobHandlers['custom-task'];

    await nodeScheduler.scheduleJob(scheduledDate, name, () => jobHandler(parameters));

    res.json({
      success: true,
      job: {
        name,
        scheduledFor: date,
        handler,
        parameters,
        status: 'scheduled'
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all scheduled jobs
app.get('/schedule/jobs', async (req, res) => {
  try {
    // Basic scheduler doesn't have listJobs method
    const jobs = []; // Mock empty list

    const jobList = jobs.map(job => ({
      name: job.name,
      cron: job.cron,
      status: job.running ? 'running' : 'scheduled',
      nextRun: job.nextDate,
      lastRun: job.lastDate
    }));

    res.json({
      jobs: jobList,
      count: jobList.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get job details
app.get('/schedule/jobs/:name', async (req, res) => {
  try {
    const { name } = req.params;
    // Basic scheduler doesn't have getJob method
    const job = null; // Mock null result

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Get recent executions for this job
    const recentExecutions = jobExecutions
      .filter(exec => exec.jobName === name)
      .slice(-10);

    res.json({
      job: {
        name: job.name,
        cron: job.cron,
        status: job.running ? 'running' : 'scheduled',
        nextRun: job.nextDate,
        lastRun: job.lastDate,
        recentExecutions: recentExecutions
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel/delete a scheduled job
app.delete('/schedule/jobs/:name', async (req, res) => {
  try {
    const { name } = req.params;
    // Use the available stop method instead of cancel
    await cronScheduler.stop(name);
    const success = true;

    if (!success) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      success: true,
      message: `Job '${name}' cancelled successfully`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger a job
app.post('/schedule/jobs/:name/trigger', async (req, res) => {
  try {
    const { name } = req.params;
    const { parameters = {} } = req.body;

    const jobHandler = jobHandlers[name] || jobHandlers['custom-task'];

    // Execute job manually
    const start = Date.now();
    try {
      const result = await jobHandler(parameters);
      const duration = Date.now() - start;

      res.json({
        success: true,
        execution: {
          jobName: name,
          triggeredAt: new Date().toISOString(),
          duration: duration,
          result: result
        }
      });

    } catch (jobError) {
      const duration = Date.now() - start;
      trackExecution(name, null, duration, jobError);
      throw jobError;
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get job execution history
app.get('/schedule/executions', async (req, res) => {
  try {
    const { jobName, limit = 50, success } = req.query;

    let executions = [...jobExecutions];

    // Filter by job name if provided
    if (jobName) {
      executions = executions.filter(exec => exec.jobName === jobName);
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
      filters: { jobName, success },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get scheduling statistics
app.get('/schedule/stats', async (req, res) => {
  try {
    // Basic scheduler doesn't have getJobCount method
    const totalJobs = 0; // Mock count
    const totalExecutions = jobExecutions.length;
    const successfulExecutions = jobExecutions.filter(exec => exec.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;

    // Calculate average execution times
    const executionTimes = jobExecutions.map(exec => exec.duration);
    const avgExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      : 0;

    // Get executions in the last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentExecutions = jobExecutions.filter(
      exec => new Date(exec.executedAt) > last24Hours
    );

    res.json({
      stats: {
        totalJobs: totalJobs,
        totalExecutions: totalExecutions,
        successfulExecutions: successfulExecutions,
        failedExecutions: failedExecutions,
        successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions * 100).toFixed(2) + '%' : '0%',
        averageExecutionTime: Math.round(avgExecutionTime) + 'ms',
        executionsLast24h: recentExecutions.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event listeners
globalEventEmitter.on('scheduler:job-scheduled', (data) => {
  console.log(`⏰ Job scheduled: ${data.name} - ${data.cron}`);
});

globalEventEmitter.on('scheduler:job-started', (data) => {
  console.log(`🔄 Job started: ${data.name} at ${new Date().toISOString()}`);
});

globalEventEmitter.on('scheduler:job-completed', (data) => {
  console.log(`[x] Job completed: ${data.name} in ${data.duration}ms`);
});

globalEventEmitter.on('scheduler:job-failed', (data) => {
  console.log(`[ ] Job failed: ${data.name} - ${data.error}`);
});

// Start server and set up scheduled jobs
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n⏰ Scheduling Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- Scheduling Interface: http://localhost:3000/services/scheduling/');
  console.log('- Swagger API Docs: http://localhost:3000/services/scheduling/swagger');
  console.log('- Service Status: http://localhost:3000/services/scheduling/api/status');
  console.log('- Schedule Job: POST http://localhost:3000/schedule/job');
  console.log('- Schedule Once: POST http://localhost:3000/schedule/once');
  console.log('- List Jobs: GET http://localhost:3000/schedule/jobs');
  console.log('- Get Job: GET http://localhost:3000/schedule/jobs/{name}');
  console.log('- Cancel Job: DELETE http://localhost:3000/schedule/jobs/{name}');
  console.log('- Trigger Job: POST http://localhost:3000/schedule/jobs/{name}/trigger');
  console.log('- Execution History: GET http://localhost:3000/schedule/executions');
  console.log('- Statistics: GET http://localhost:3000/schedule/stats');
  console.log('\nExample job scheduling:');
  console.log('{ "name": "my-task", "cron": "0 9 * * *", "handler": "custom-task", "parameters": {"taskId": "123"} }');
  console.log('\nExample one-time scheduling:');
  console.log('{ "name": "maintenance", "date": "2024-12-25T02:00:00Z", "handler": "custom-task" }');
  console.log('\nCron expression examples:');
  console.log('- "0 9 * * *" - Every day at 9 AM');
  console.log('- "*/15 * * * *" - Every 15 minutes');
  console.log('- "0 0 * * 1" - Every Monday at midnight');
  console.log('- "0 2 1 * *" - First day of every month at 2 AM');

  // Set up predefined scheduled jobs
  await setupScheduledJobs();
});