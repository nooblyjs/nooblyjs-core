/**
 * @fileoverview Notifying Service Load Test
 *
 * Tests the notifying service with:
 * - 10 topics
 * - 50 subscribers per topic
 * - 1000 messages per topic every 10 seconds
 *
 * All subscriber callbacks write messages to console for monitoring
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const EventEmitter = require('events');
const path = require('path');

const app = express();
app.use(express.json());

// Add options
const options = {
  logDir: path.join(__dirname, './.application/', 'logs'),
  dataDir: path.join(__dirname, './.application/', 'data'),
  'express-app': app,
  brandingConfig: {
    appName: 'Notifying Test',
    primaryColor: '#000'
  }
};

// Declare the Event Emitter
const eventEmitter = new EventEmitter();

// Initialize registry
const serviceRegistry = require('nooblyjs-core');
serviceRegistry.initialize(app, eventEmitter, options);

// Get services
const logger = serviceRegistry.logger();
const notifying = serviceRegistry.notifying('memory');

// Test Configuration
const NUM_TOPICS = 10;
const SUBSCRIBERS_PER_TOPIC = 50;
const MESSAGES_PER_TOPIC = 1000;
const INTERVAL_MS = 10000; // 10 seconds

// Statistics tracking
let totalMessagesReceived = 0;
let totalMessagesSent = 0;
let messageCountByTopic = {};
let messageCountBySubscriber = {};

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

    // Console output for monitoring
    if (totalMessagesReceived % 1000 === 0) {
      console.log(
        `[${new Date().toISOString()}] Messages Received: ${formatNumber(totalMessagesReceived)} | ` +
        `Sent: ${formatNumber(totalMessagesSent)} | Topic: ${topicName} | Subscriber: ${subscriberId}`
      );
    }
  };
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

    console.log(`\n[TEST] Starting message burst every ${INTERVAL_MS}ms for 60 seconds...\n`);

    // Start sending messages in bursts
    let burstCount = 0;
    const testDuration = 60000; // 60 seconds
    const startTime = Date.now();

    const burstInterval = setInterval(async () => {
      burstCount++;
      const now = Date.now();
      const elapsed = now - startTime;

      if (elapsed >= testDuration) {
        clearInterval(burstInterval);
        console.log(`\n[BURST ${burstCount}] Stopping test...`);
        printFinalStats();
        process.exit(0);
      }

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
      const elapsedPercent = Math.round((elapsed / testDuration) * 100);

      console.log(
        `[BURST ${burstCount}] Completed in ${burstDuration}ms | ` +
        `Total Sent: ${formatNumber(totalMessagesSent)} | ` +
        `Total Received: ${formatNumber(totalMessagesReceived)} | ` +
        `Progress: ${elapsedPercent}%`
      );
    }, INTERVAL_MS);

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

// Expose the public folder
app.use('/', express.static(__dirname + '/public'));

// Start the test
app.listen(3001, () => {
  logger.info('Notifying test server running on port 3001');
  setTimeout(initializeTest, 1000);
});
