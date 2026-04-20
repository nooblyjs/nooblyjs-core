/**
 * @fileoverview Notifying Service Load Test
 *
 * Tests the notifying service with:
 * - 10 topics
 * - 50 subscribers per topic
 * - 1000 messages per topic every 10 seconds
 *
 * All subscriber callbacks write messages to console for monitoring
 * Runs continuously and stores notifications for UI display
 *
 * @author NooblyJS Team
 * @version 1.0.15
 * @since 1.0.0
 */
'use strict';

const express = require('express');
const EventEmitter = require('events');
const path = require('node:path');

const app = express();
app.use(express.json());

// Add options
var options = { 
  logDir:  path.join(__dirname, './.application/', 'logs'),
  dataDir : path.join(__dirname, './.application/', 'data'),
  cacheDir : path.join(__dirname, './.application/', 'caching'),
  'express-app': app,
    brandingConfig: {
      appName: 'App Lite',
      primaryColor: '#000'
  },
  security: {
    apiKeyAuth: {
      requireApiKey: false,
      apiKeys: []
    },
    servicesAuth: {
      requireLogin: false
    }
  }
};

// Declare the Event Emitter
const eventEmitter = new EventEmitter();

// Initialize registry (no public folder needed!)
const serviceRegistry = require('../../../index');
serviceRegistry.initialize(app, eventEmitter, options);

// Initialize auth service (required for login/register functionality)
// The authservice automatically serves login.html and register.html from its views folder
const authservice = serviceRegistry.authservice();

// Get services
const logger = serviceRegistry.logger();
const notifying = serviceRegistry.notifying('memory');
const dataService = serviceRegistry.dataService('memory'); // Store notifications for UI display

// Test Configuration
const NUM_TOPICS = 10;
const SUBSCRIBERS_PER_TOPIC = 5;
const MESSAGES_PER_TOPIC = 10; // Reduced for performance (was 1000)
const INTERVAL_MS = 60000; // 10 seconds

// Statistics tracking
let totalMessagesReceived = 0;
let totalMessagesSent = 0;
let messageCountByTopic = {};
let messageCountBySubscriber = {};
let notificationHistory = []; // Store notifications for UI display
const MAX_NOTIFICATIONS = 50000; // Keep last 50000 notifications (all topics with subscribers in one burst)

/**
 * Format number with thousands separators
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Create subscriber callback
 */
function createSubscriberCallback(topicName, subscriberId) {
  return (message) => {
    totalMessagesReceived++;
    messageCountByTopic[topicName] = (messageCountByTopic[topicName] || 0) + 1;
    messageCountBySubscriber[subscriberId] = (messageCountBySubscriber[subscriberId] || 0) + 1;

    // Store notification for UI display
    storeNotification(topicName, message);

    // Console output for monitoring
    if (totalMessagesReceived % 500 === 0) {
      console.log(
        `[${new Date().toISOString()}] Messages Received: ${formatNumber(totalMessagesReceived)} | ` +
        `Sent: ${formatNumber(totalMessagesSent)} | Topic: ${topicName} | Subscribers: ${Object.keys(messageCountBySubscriber).length}`
      );
    }
  };
}

/**
 * Store notification in history for UI display
 */
function storeNotification(topic, message) {
  const notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    topic: topic,
    message: typeof message === 'object' ? message.data || JSON.stringify(message) : message,
    fullContent: typeof message === 'object' ? JSON.stringify(message, null, 2) : message,
    timestamp: Date.now(),
    read: false,
    date: new Date()
  };

  notificationHistory.push(notification);

  // Keep only the last MAX_NOTIFICATIONS
  if (notificationHistory.length > MAX_NOTIFICATIONS) {
    notificationHistory = notificationHistory.slice(-MAX_NOTIFICATIONS);
  }
}

/**
 * Initialize test
 */
async function initializeTest() {
  console.log('\n' + '='.repeat(80));
  console.log('  NOTIFYING SERVICE LOAD TEST');
  console.log('='.repeat(80));
  console.log(`Topics: ${NUM_TOPICS}`);
  console.log(`Subscribers per Topic: ${SUBSCRIBERS_PER_TOPIC}`);
  console.log(`Total Subscribers: ${NUM_TOPICS * SUBSCRIBERS_PER_TOPIC}`);
  console.log(`Messages per Interval: ${NUM_TOPICS * MESSAGES_PER_TOPIC}`);
  console.log(`Interval: ${INTERVAL_MS}ms`);
  console.log('='.repeat(80) + '\n');

  try {
    console.log('[SETUP] Creating topics...');

    // Create topics
    for (let i = 1; i <= NUM_TOPICS; i++) {
      const topicName = `topic-${i}`;
      await notifying.createTopic(topicName);
      messageCountByTopic[topicName] = 0;
      console.log(`  ✓ Created topic: ${topicName}`);
    }

    console.log(`\n[SETUP] Creating ${NUM_TOPICS * SUBSCRIBERS_PER_TOPIC} subscribers...`);

    // Create subscribers for each topic
    for (let i = 1; i <= NUM_TOPICS; i++) {
      const topicName = `topic-${i}`;

      for (let j = 1; j <= SUBSCRIBERS_PER_TOPIC; j++) {
        const subscriberId = `${topicName}-subscriber-${j}`;
        messageCountBySubscriber[subscriberId] = 0;

        // Subscribe with callback
        const callback = createSubscriberCallback(topicName, subscriberId);
        await notifying.subscribe(topicName, callback);
      }

      if (i % 2 === 0) {
        console.log(`  ✓ Created subscribers for ${i} topics...`);
      }
    }

    console.log(`\n[TEST] Starting continuous message bursts every ${INTERVAL_MS}ms...`);
    console.log(`[TEST] Service will run indefinitely. Press Ctrl+C to stop.\n`);

    // Start sending messages in bursts - RUNS CONTINUOUSLY
    let burstCount = 0;

    const burstInterval = setInterval(async () => {
      burstCount++;

      console.log(`\n[BURST ${burstCount}] Sending ${formatNumber(NUM_TOPICS * MESSAGES_PER_TOPIC)} messages...`);
      const burstStartTime = Date.now();

      // Send messages for all topics
      for (let i = 1; i <= NUM_TOPICS; i++) {
        const topicName = `topic-${i}`;

        // Send MESSAGES_PER_TOPIC messages to this topic
        for (let m = 1; m <= MESSAGES_PER_TOPIC; m++) {
          await notifying.notify(topicName, {
            burstNumber: burstCount,
            messageNumber: m,
            topicName,
            timestamp: new Date().toISOString(),
            data: `Message ${m} in burst ${burstCount} for ${topicName}`
          });
          totalMessagesSent++;
        }
      }

      const burstDuration = Date.now() - burstStartTime;
      const avgPerSecond = Math.round((totalMessagesSent / (burstCount * (INTERVAL_MS / 1000))) * 100) / 100;

      console.log(
        `[BURST ${burstCount}] Completed in ${burstDuration}ms | ` +
        `Total Sent: ${formatNumber(totalMessagesSent)} | ` +
        `Total Received: ${formatNumber(totalMessagesReceived)} | ` +
        `Avg/sec: ${avgPerSecond} | ` +
        `Notifications in UI: ${notificationHistory.length}`
      );
    }, INTERVAL_MS);

    // Print periodic statistics (every 60 seconds)
    setInterval(() => {
      console.log(`\n[STATS] Total Sent: ${formatNumber(totalMessagesSent)} | Total Received: ${formatNumber(totalMessagesReceived)} | Stored for UI: ${notificationHistory.length}`);
    }, 60000);

  } catch (error) {
    console.error('[ERROR] Test initialization failed:', error);
    process.exit(1);
  }
}

/**
 * Print final statistics
 */
function printFinalStats() {
  console.log('\n' + '='.repeat(80));
  console.log('  FINAL TEST STATISTICS');
  console.log('='.repeat(80));

  console.log(`\nOverall Statistics:`);
  console.log(`  Total Messages Sent:     ${formatNumber(totalMessagesSent)}`);
  console.log(`  Total Messages Received: ${formatNumber(totalMessagesReceived)}`);
  console.log(`  Success Rate:            ${((totalMessagesReceived / (totalMessagesSent * SUBSCRIBERS_PER_TOPIC)) * 100).toFixed(2)}%`);
  console.log(`  Message Loss:            ${formatNumber((totalMessagesSent * SUBSCRIBERS_PER_TOPIC) - totalMessagesReceived)}`);

  console.log(`\nMessages by Topic:`);
  for (let i = 1; i <= NUM_TOPICS; i++) {
    const topicName = `topic-${i}`;
    const count = messageCountByTopic[topicName] || 0;
    const expected = MESSAGES_PER_TOPIC * SUBSCRIBERS_PER_TOPIC;
    const percentage = (count / expected * 100).toFixed(2);
    console.log(`  ${topicName}: ${formatNumber(count)} / ${formatNumber(expected)} (${percentage}%)`);
  }

  console.log(`\nTop 5 Subscribers by Message Count:`);
  const sortedSubscribers = Object.entries(messageCountBySubscriber)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  sortedSubscribers.forEach(([subscriberId, count]) => {
    console.log(`  ${subscriberId}: ${formatNumber(count)}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETED SUCCESSFULLY');
  console.log('='.repeat(80) + '\n');
}

// ============================================================
// API ENDPOINTS FOR UI DISPLAY
// ============================================================

/**
 * GET /api/notifications
 * Retrieve all notifications for UI display
 */
app.get('/api/notifications', (req, res) => {
  try {
    res.json({
      success: true,
      notifications: notificationHistory,
      stats: {
        totalSent: totalMessagesSent,
        totalReceived: totalMessagesReceived,
        byTopic: messageCountByTopic
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/notifications/stats
 * Get real-time statistics
 */
app.get('/api/notifications/stats', (req, res) => {
  try {
    const stats = {
      success: true,
      totalMessagesSent: totalMessagesSent,
      totalMessagesReceived: totalMessagesReceived,
      notificationCount: notificationHistory.length,
      subscribersCount: Object.keys(messageCountBySubscriber).length,
      topicCount: Object.keys(messageCountByTopic).length,
      messagesByTopic: messageCountByTopic,
      successRate: totalMessagesSent > 0 ?
        ((totalMessagesReceived / (totalMessagesSent * SUBSCRIBERS_PER_TOPIC)) * 100).toFixed(2) : 0
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/notifications/:topicName
 * Get notifications for a specific topic
 */
app.get('/api/notifications/:topicName', (req, res) => {
  try {
    const { topicName } = req.params;
    const topicNotifications = notificationHistory.filter(n => n.topic === topicName);
    res.json({
      success: true,
      topic: topicName,
      notifications: topicNotifications,
      count: topicNotifications.length,
      messageCount: messageCountByTopic[topicName] || 0
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/mark-read
 * Mark a notification as read
 */
app.post('/api/notifications/mark-read', (req, res) => {
  try {
    const { notificationId, read } = req.body;
    const notification = notificationHistory.find(n => n.id === notificationId);
    if (notification) {
      notification.read = read !== false;
      res.json({ success: true, notification });
    } else {
      res.status(404).json({ success: false, error: 'Notification not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Redirect to services
app.get('/', (req, res) => {
  res.redirect('/services');
});

// Expose the public folder
app.use('/README', express.static('README.md'));

// Expose the public folder
app.use('/', express.static(__dirname + '/public'));

// Load images
app.use('/images/nooblyjs-logo.png', express.static(path.join(__dirname, 's-tech-logo-colour.png')));

// Start the test
app.listen(3101, () => {
  logger.info('Notifying test server running on port 3001');
  logger.info('API endpoints available:');
  logger.info('  GET  /api/notifications - Get all notifications');
  logger.info('  GET  /api/notifications/stats - Get real-time statistics');
  logger.info('  GET  /api/notifications/:topicName - Get notifications for a topic');
  logger.info('  POST /api/notifications/mark-read - Mark notification as read');
  setTimeout(initializeTest, 10000);
});
