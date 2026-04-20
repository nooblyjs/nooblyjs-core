/**
 * @fileoverview Measuring Service Test Application
 *
 * Creates 100 metrics and logs 10 measurements every minute for testing the measuring UI
 *
 * @author NooblyJS Team
 * @version 1.0.14
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
const measuring = serviceRegistry.measuring();

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

// Configuration
const NUM_METRICS = 100;
const MEASUREMENTS_PER_CYCLE = 10;
const CYCLE_INTERVAL_MS = 60000; // 1 minute

// Metric names covering various use cases
const metricCategories = {
  performance: ['response_time', 'database_query_time', 'cache_hit_rate', 'api_latency', 'page_load_time'],
  system: ['cpu_usage', 'memory_usage', 'disk_io', 'network_bandwidth', 'thread_count'],
  business: ['user_logins', 'transactions', 'revenue', 'orders_placed', 'items_sold'],
  quality: ['error_rate', 'exception_count', 'failed_requests', 'timeout_count', 'retry_count'],
  availability: ['uptime_percentage', 'downtime_minutes', 'health_checks_passed', 'service_restarts', 'deployments']
};

// Generate 100 unique metric names
function generateMetricNames() {
  const metrics = [];
  let metricsAdded = 0;

  // Add base metrics from categories
  for (const [category, names] of Object.entries(metricCategories)) {
    names.forEach(name => {
      metrics.push(`${name}`);
      metricsAdded++;
    });
  }

  // Add numbered variants to reach 100 metrics
  const baseCount = metricsAdded;
  for (let i = baseCount; i < NUM_METRICS; i++) {
    const category = Object.keys(metricCategories)[i % Object.keys(metricCategories).length];
    const baseMetric = metricCategories[category][0];
    metrics.push(`${baseMetric}_instance_${i - baseCount}`);
  }

  return metrics.slice(0, NUM_METRICS);
}

// Format number with thousands separators
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Generate realistic metric value based on metric type
function generateMetricValue(metricName) {
  if (metricName.includes('rate') || metricName.includes('percentage')) {
    return Math.random() * 100;
  } else if (metricName.includes('time')) {
    return Math.random() * 1000 + 50;
  } else if (metricName.includes('usage')) {
    return Math.random() * 80 + 10;
  } else if (metricName.includes('count')) {
    return Math.floor(Math.random() * 1000) + 1;
  } else if (metricName.includes('revenue') || metricName.includes('value')) {
    return Math.random() * 10000 + 100;
  }
  return Math.random() * 100;
}

// Track statistics
let stats = {
  totalMeasurements: 0,
  cycleCount: 0,
  startTime: Date.now()
};

// Initialize test
async function initializeTest() {
  console.log('\n' + '='.repeat(80));
  console.log('  MEASURING SERVICE LOAD TEST');
  console.log('='.repeat(80));
  console.log(`Metrics: ${NUM_METRICS}`);
  console.log(`Measurements per cycle: ${MEASUREMENTS_PER_CYCLE}`);
  console.log(`Cycle interval: ${CYCLE_INTERVAL_MS / 1000}s`);
  console.log(`Total measurements per minute: ${MEASUREMENTS_PER_CYCLE}`);
  console.log(`Test duration: INFINITE (until stopped)`);
  console.log('='.repeat(80) + '\n');

  const metricNames = generateMetricNames();
  console.log(`[SETUP] Created ${metricNames.length} metric names`);
  console.log(`[SETUP] Sample metrics: ${metricNames.slice(0, 5).join(', ')}\n`);

  // Start recording measurements every cycle
  let cycleCount = 0;

  const cycleInterval = setInterval(async () => {
    cycleCount++;
    const cycleStartTime = Date.now();

    // Select random metrics and record measurements
    for (let i = 0; i < MEASUREMENTS_PER_CYCLE; i++) {
      const randomMetric = metricNames[Math.floor(Math.random() * metricNames.length)];
      const value = generateMetricValue(randomMetric);

      try {
        await measuring.add(randomMetric, value);
        stats.totalMeasurements++;
      } catch (error) {
        console.error(`[ERROR] Failed to add measurement for ${randomMetric}:`, error.message);
      }
    }

    const cycleDuration = Date.now() - cycleStartTime;
    const elapsedMinutes = (Date.now() - stats.startTime) / 60000;
    const avgPerMinute = (stats.totalMeasurements / elapsedMinutes).toFixed(0);

    console.log(
      `[CYCLE ${cycleCount}] Recorded ${MEASUREMENTS_PER_CYCLE} measurements in ${cycleDuration}ms | ` +
      `Total: ${formatNumber(stats.totalMeasurements)} | ` +
      `Avg/min: ${avgPerMinute} | ` +
      `Uptime: ${Math.floor(elapsedMinutes)}m`
    );
  }, CYCLE_INTERVAL_MS);

  // Print periodic statistics
  setInterval(() => {
    const elapsedMinutes = (Date.now() - stats.startTime) / 60000;
    const avgPerMinute = (stats.totalMeasurements / elapsedMinutes).toFixed(0);

    console.log(`\n[STATS] Total: ${formatNumber(stats.totalMeasurements)} | ` +
      `Avg/min: ${avgPerMinute} | ` +
      `Uptime: ${Math.floor(elapsedMinutes)}m`);
  }, 300000); // Every 5 minutes
}


app.listen(3101, async () => {
  logger.info('Measuring Service Test Server running on port 3101');
  logger.info('Measuring UI: http://localhost:3101/services/measuring');
  logger.info('Measuring UI Tab: http://localhost:3101/services/measuring (click UI tab)');
  logger.info('');

  setTimeout(initializeTest, 1000);
});
