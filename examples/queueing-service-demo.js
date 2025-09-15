/**
 * @fileoverview Queueing Service Demo
 * Example showing how to use the NooblyJS Queueing Service
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

// Example 1: Using memory queue (default)
const memoryQueue = serviceRegistry.queueing('memory', {
  maxSize: 1000,
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  concurrency: 5 // Process 5 jobs concurrently
});

// Example 2: Using Redis queue (requires Redis server)
/*
const redisQueue = serviceRegistry.queueing('redis', {
  host: 'localhost',
  port: 6379,
  // password: 'your-redis-password',
  maxRetries: 3,
  retryDelay: 10000
});
*/

// Example 3: Using Bull queue for advanced features
const bullQueue = serviceRegistry.queueing('bull', {
  redis: {
    host: 'localhost',
    port: 6379
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

// Job processors for different job types
memoryQueue.process('email', async (job) => {
  const { to, subject, message } = job.data;

  console.log(`Processing email job: ${job.id}`);
  console.log(`Sending email to ${to}: ${subject}`);

  // Simulate email sending delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

  // Simulate occasional failures
  if (Math.random() < 0.1) {
    throw new Error('Email service temporarily unavailable');
  }

  return {
    success: true,
    messageId: `msg_${Date.now()}`,
    sentAt: new Date().toISOString()
  };
});

memoryQueue.process('image-processing', async (job) => {
  const { imageUrl, operations } = job.data;

  console.log(`Processing image: ${job.id} - ${imageUrl}`);

  // Simulate image processing delay
  await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 5000));

  return {
    success: true,
    processedUrl: `https://cdn.example.com/processed/${job.id}.jpg`,
    operations: operations,
    processedAt: new Date().toISOString()
  };
});

memoryQueue.process('data-export', 2, async (job) => { // Process 2 concurrently
  const { format, filters, userId } = job.data;

  console.log(`Processing data export: ${job.id} for user ${userId}`);

  // Update job progress
  await job.progress(10);

  // Simulate data querying
  await new Promise(resolve => setTimeout(resolve, 2000));
  await job.progress(50);

  // Simulate data formatting
  await new Promise(resolve => setTimeout(resolve, 2000));
  await job.progress(90);

  // Simulate file generation
  await new Promise(resolve => setTimeout(resolve, 1000));
  await job.progress(100);

  return {
    success: true,
    downloadUrl: `https://exports.example.com/${job.id}.${format}`,
    recordCount: Math.floor(Math.random() * 10000),
    format: format,
    generatedAt: new Date().toISOString()
  };
});

// Scheduled/delayed job processor
memoryQueue.process('scheduled-task', async (job) => {
  const { taskType, parameters } = job.data;

  console.log(`Processing scheduled task: ${taskType} at ${new Date().toISOString()}`);

  // Process different types of scheduled tasks
  switch (taskType) {
    case 'cleanup':
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { cleaned: Math.floor(Math.random() * 100), type: 'cleanup' };

    case 'report':
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { reportUrl: `https://reports.example.com/${job.id}.pdf`, type: 'report' };

    default:
      return { message: `Processed ${taskType}`, parameters };
  }
});

// API endpoints for job management

// Add jobs to queue
app.post('/jobs/:jobType', async (req, res) => {
  try {
    const { jobType } = req.params;
    const { data, options = {} } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Job data is required' });
    }

    const job = await memoryQueue.add(jobType, data, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      attempts: options.attempts || 3,
      ...options
    });

    res.json({
      success: true,
      job: {
        id: job.id,
        type: jobType,
        data: data,
        state: 'waiting',
        createdAt: job.timestamp,
        options: options
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get job status
app.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await memoryQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const progress = await job.progress();

    res.json({
      job: {
        id: job.id,
        type: job.name,
        data: job.data,
        state: await job.getState(),
        progress: progress,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        createdAt: job.timestamp,
        processedAt: job.processedOn,
        finishedAt: job.finishedOn,
        failedReason: job.failedReason,
        returnValue: job.returnvalue
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get queue statistics
app.get('/queues/stats', async (req, res) => {
  try {
    const stats = await memoryQueue.getJobCounts();

    res.json({
      stats: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List jobs by state
app.get('/jobs', async (req, res) => {
  try {
    const { state = 'waiting', limit = 50 } = req.query;
    const jobs = await memoryQueue.getJobs([state], 0, limit - 1);

    const jobList = await Promise.all(
      jobs.map(async (job) => ({
        id: job.id,
        type: job.name,
        data: job.data,
        state: await job.getState(),
        progress: await job.progress(),
        createdAt: job.timestamp,
        attempts: job.attemptsMade
      }))
    );

    res.json({
      jobs: jobList,
      count: jobList.length,
      state: state
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove/cancel job
app.delete('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await memoryQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await job.remove();

    res.json({
      success: true,
      message: `Job ${jobId} removed`,
      job: {
        id: job.id,
        type: job.name
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retry failed job
app.post('/jobs/:jobId/retry', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await memoryQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await job.retry();

    res.json({
      success: true,
      message: `Job ${jobId} queued for retry`,
      job: {
        id: job.id,
        type: job.name,
        state: 'waiting',
        attempts: job.attemptsMade
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk job operations
app.post('/jobs/bulk', async (req, res) => {
  try {
    const { jobs } = req.body;

    if (!Array.isArray(jobs)) {
      return res.status(400).json({ error: 'Jobs must be an array' });
    }

    const results = [];

    for (const jobData of jobs) {
      try {
        const job = await memoryQueue.add(jobData.type, jobData.data, jobData.options || {});
        results.push({
          success: true,
          job: {
            id: job.id,
            type: jobData.type,
            data: jobData.data
          }
        });
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          jobData: jobData
        });
      }
    }

    res.json({
      success: true,
      results: results,
      total: jobs.length,
      successful: results.filter(r => r.success).length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Priority queue examples
app.post('/jobs/priority/:priority', async (req, res) => {
  try {
    const { priority } = req.params;
    const { jobType, data } = req.body;

    const job = await memoryQueue.add(jobType, data, {
      priority: parseInt(priority)
    });

    res.json({
      success: true,
      message: `High priority job added`,
      job: {
        id: job.id,
        type: jobType,
        priority: priority,
        data: data
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delayed/scheduled jobs
app.post('/jobs/schedule', async (req, res) => {
  try {
    const { jobType, data, scheduleFor } = req.body;

    const delay = new Date(scheduleFor).getTime() - Date.now();

    if (delay < 0) {
      return res.status(400).json({ error: 'Schedule time must be in the future' });
    }

    const job = await memoryQueue.add(jobType, data, {
      delay: delay
    });

    res.json({
      success: true,
      message: `Job scheduled for ${scheduleFor}`,
      job: {
        id: job.id,
        type: jobType,
        data: data,
        scheduledFor: scheduleFor,
        delay: delay
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Queue management
app.post('/queues/pause', async (req, res) => {
  try {
    await memoryQueue.pause();

    res.json({
      success: true,
      message: 'Queue paused'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/queues/resume', async (req, res) => {
  try {
    await memoryQueue.resume();

    res.json({
      success: true,
      message: 'Queue resumed'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/queues/clean', async (req, res) => {
  try {
    const { state = 'completed', age = 24 * 60 * 60 * 1000 } = req.query; // 24 hours default

    const cleanedJobs = await memoryQueue.clean(age, state);

    res.json({
      success: true,
      message: `Cleaned ${cleanedJobs.length} ${state} jobs older than ${age}ms`,
      cleaned: cleanedJobs.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event listeners
globalEventEmitter.on('queue:job-added', (data) => {
  console.log(`➕ Job added to queue: ${data.type} (ID: ${data.id})`);
});

globalEventEmitter.on('queue:job-started', (data) => {
  console.log(`🔄 Job started: ${data.type} (ID: ${data.id})`);
});

globalEventEmitter.on('queue:job-completed', (data) => {
  console.log(`✅ Job completed: ${data.type} (ID: ${data.id})`);
});

globalEventEmitter.on('queue:job-failed', (data) => {
  console.log(`❌ Job failed: ${data.type} (ID: ${data.id}) - ${data.error}`);
});

globalEventEmitter.on('queue:job-progress', (data) => {
  console.log(`📊 Job progress: ${data.type} (ID: ${data.id}) - ${data.progress}%`);
});

// Example job creation for demonstration
async function createSampleJobs() {
  try {
    // Add some sample jobs
    await memoryQueue.add('email', {
      to: 'user@example.com',
      subject: 'Welcome!',
      message: 'Thanks for signing up!'
    });

    await memoryQueue.add('image-processing', {
      imageUrl: 'https://example.com/image.jpg',
      operations: ['resize', 'watermark', 'compress']
    }, { delay: 5000 }); // Delay by 5 seconds

    await memoryQueue.add('data-export', {
      format: 'csv',
      filters: { date: '2024-01-01' },
      userId: 'user123'
    }, { priority: 5 });

    console.log('Sample jobs added to queue');
  } catch (error) {
    console.error('Error creating sample jobs:', error);
  }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n🚀 Queueing Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- Queueing Interface: http://localhost:3000/services/queueing/');
  console.log('- Swagger API Docs: http://localhost:3000/services/queueing/swagger');
  console.log('- Service Status: http://localhost:3000/services/queueing/api/status');
  console.log('- Add Job: POST http://localhost:3000/jobs/{jobType}');
  console.log('- Get Job: GET http://localhost:3000/jobs/{jobId}');
  console.log('- List Jobs: GET http://localhost:3000/jobs?state=waiting');
  console.log('- Queue Stats: GET http://localhost:3000/queues/stats');
  console.log('- Remove Job: DELETE http://localhost:3000/jobs/{jobId}');
  console.log('- Retry Job: POST http://localhost:3000/jobs/{jobId}/retry');
  console.log('- Bulk Jobs: POST http://localhost:3000/jobs/bulk');
  console.log('- Priority Job: POST http://localhost:3000/jobs/priority/{priority}');
  console.log('- Schedule Job: POST http://localhost:3000/jobs/schedule');
  console.log('- Pause Queue: POST http://localhost:3000/queues/pause');
  console.log('- Resume Queue: POST http://localhost:3000/queues/resume');
  console.log('- Clean Queue: DELETE http://localhost:3000/queues/clean?state=completed&age=3600000');
  console.log('\nSupported job types: email, image-processing, data-export, scheduled-task');
  console.log('\nExample job creation:');
  console.log('{ "data": { "to": "user@example.com", "subject": "Test", "message": "Hello!" } }');
  console.log('\nExample bulk jobs:');
  console.log('{ "jobs": [{ "type": "email", "data": {...} }, { "type": "image-processing", "data": {...} }] }');

  // Create some sample jobs for demonstration
  setTimeout(createSampleJobs, 2000);
});