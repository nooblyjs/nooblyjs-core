/**
 * @fileoverview Simple Queueing Service Demo
 * Example showing how to use the basic NooblyJS In-Memory Queue Service
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

// Example: Using memory queue (only supported provider)
const memoryQueue = serviceRegistry.queue('memory', {});

// Simple job processor using basic queue operations
async function processJobs() {
  console.log('Starting job processor...');

  while (true) {
    try {
      const job = await memoryQueue.dequeue();
      if (!job) {
        // No jobs in queue, wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      console.log(`Processing job: ${job.type} - ${job.id}`);

      // Process different job types
      switch (job.type) {
        case 'email':
          await processEmailJob(job);
          break;
        case 'data-processing':
          await processDataJob(job);
          break;
        default:
          console.log(`Processing generic job: ${job.type}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`Job completed: ${job.id}`);
    } catch (error) {
      console.error('Error processing job:', error.message);
    }
  }
}

async function processEmailJob(job) {
  const { to, subject } = job.data;
  console.log(`Sending email to ${to}: ${subject}`);

  // Simulate email sending delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

  console.log(`Email sent successfully: ${job.id}`);
}

async function processDataJob(job) {
  const { dataset } = job.data;
  console.log(`Processing dataset: ${dataset}`);

  // Simulate data processing delay
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

  console.log(`Data processing completed: ${job.id}`);
}

// API routes for queue management
app.post('/jobs', async (req, res) => {
  try {
    const { type, data } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Job type is required' });
    }

    const job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: type,
      data: data || {},
      createdAt: new Date().toISOString()
    };

    await memoryQueue.enqueue(job);

    res.status(201).json({
      success: true,
      job: job,
      message: 'Job added to queue'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/queue/stats', async (req, res) => {
  try {
    const queueSize = await memoryQueue.size();

    res.json({
      queueSize: queueSize,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/queue/clear', async (req, res) => {
  try {
    let clearedJobs = 0;

    // Clear all jobs from queue
    while (await memoryQueue.size() > 0) {
      await memoryQueue.dequeue();
      clearedJobs++;
    }

    res.json({
      success: true,
      clearedJobs: clearedJobs,
      message: 'Queue cleared successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add some sample jobs on startup
async function addSampleJobs() {
  console.log('Adding sample jobs to queue...');

  const sampleJobs = [
    {
      type: 'email',
      data: {
        to: 'user@example.com',
        subject: 'Welcome to NooblyJS!',
        message: 'Thank you for trying our queueing service.'
      }
    },
    {
      type: 'data-processing',
      data: {
        dataset: 'user_analytics_2024'
      }
    },
    {
      type: 'email',
      data: {
        to: 'admin@example.com',
        subject: 'System Alert',
        message: 'Queue service started successfully.'
      }
    }
  ];

  for (const jobData of sampleJobs) {
    const job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: jobData.type,
      data: jobData.data,
      createdAt: new Date().toISOString()
    };

    await memoryQueue.enqueue(job);
    console.log(`Added sample job: ${job.type} - ${job.id}`);
  }
}

// Event listeners
globalEventEmitter.on('queue:enqueue', (data) => {
  console.log(`Job enqueued: ${data.item.type} - ${data.item.id}`);
});

globalEventEmitter.on('queue:dequeue', (data) => {
  console.log(`Job dequeued: ${data.item.type} - ${data.item.id}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n📦 Simple Queueing Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- Queue Interface: http://localhost:3000/services/queueing/');
  console.log('- Add Job: POST http://localhost:3000/jobs');
  console.log('- Queue Stats: GET http://localhost:3000/queue/stats');
  console.log('- Clear Queue: POST http://localhost:3000/queue/clear');
  console.log('\nExample job creation:');
  console.log('POST /jobs');
  console.log('{ "type": "email", "data": { "to": "test@example.com", "subject": "Test Email" } }');
  console.log('\nExample data processing job:');
  console.log('{ "type": "data-processing", "data": { "dataset": "customer_data" } }');

  // Add sample jobs and start processor
  await addSampleJobs();

  // Start job processor in background (don't await)
  processJobs().catch(console.error);

  console.log('\nJob processor started. Jobs will be processed automatically.');
});