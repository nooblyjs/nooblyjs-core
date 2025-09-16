/**
 * @fileoverview Load test for authentication service performance.
 *
 * This load test measures the performance of authentication operations including
 * user registration, login, logout, and user management across different auth
 * providers (Passport, Google OAuth, Memory). Tests help identify performance
 * bottlenecks and scalability limits.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const createAuthService = require('../../../src/authservice');
const EventEmitter = require('events');

/**
 * Executes load test for authentication service performance.
 *
 * Runs a series of auth operations to measure performance characteristics
 * of different auth providers under load.
 *
 * @async
 * @function runAuthServiceLoadTest
 * @param {number} iterations - Number of auth operations to perform
 * @param {string} [authType='memory'] - Type of auth provider to test
 * @param {Object} [options={}] - Configuration options for the auth provider
 * @returns {Promise<Object>} Test results including service, type, iterations, and duration
 */
async function runAuthServiceLoadTest(
  iterations,
  authType = 'memory',
  options = {}
) {
  const eventEmitter = new EventEmitter();

  const testOptions = {
    ...options,
    'express-app': {
      use: () => {},
      get: () => {},
      post: () => {}
    },
    sessionSecret: 'test-secret-for-load-testing',
    googleClientId: 'test-google-client-id',
    googleClientSecret: 'test-google-client-secret'
  };

  const authService = createAuthService(authType, testOptions, eventEmitter);
  const startTime = Date.now();
  console.log(
    `Starting Auth Service Load Test (${authType} provider) for ${iterations} iterations...`
  );

  const testUsers = [];
  let successfulOperations = 0;
  let failedOperations = 0;

  for (let i = 0; i < iterations; i++) {
    try {
      const username = `testuser${i}`;
      const password = `TestPass${i}!`;
      const email = `testuser${i}@example.com`;

      // Register user
      const registeredUser = await authService.createUser({
        username,
        password,
        email,
        name: `Test User ${i}`,
        profile: {
          department: 'Testing',
          role: 'Load Test User'
        }
      });

      if (registeredUser) {
        testUsers.push({ username, password, email });
        successfulOperations++;

        // Authenticate the user
        const authResult = await authService.authenticateUser(username, password);
        if (authResult && authResult.user) {
          successfulOperations++;

          // Get user details
          try {
            const userDetails = await authService.getUser(username);
            if (userDetails) {
              successfulOperations++;
            }
          } catch (error) {
            // User might not exist, handle gracefully
          }

          // Logout user
          try {
            await authService.logout(authResult.session.token);
            successfulOperations++;
          } catch (error) {
            // Handle logout error gracefully
          }
        } else {
          failedOperations++;
        }
      } else {
        failedOperations++;
      }

      if (i % 100 === 0 && i > 0) {
        console.log(`Auth Service load test iteration ${i} completed`);
      }
    } catch (error) {
      console.error(`Error in Auth Service load test iteration ${i}:`, error.message);
      failedOperations++;
    }
  }

  const endTime = Date.now();
  const duration = endTime - startTime;
  const operationsPerSecond = Math.round((successfulOperations * 1000) / duration);

  console.log(
    `Auth Service Load Test Completed: ${successfulOperations} successful operations, ${failedOperations} failed operations in ${duration} ms (${operationsPerSecond} ops/sec).`
  );

  return {
    service: 'authservice',
    type: authType,
    iterations,
    duration,
    successfulOperations,
    failedOperations,
    operationsPerSecond,
    testUsers: testUsers.length
  };
}

/**
 * Runs a concurrent authentication load test to simulate multiple simultaneous logins.
 *
 * @async
 * @function runConcurrentAuthLoadTest
 * @param {number} concurrentUsers - Number of concurrent users
 * @param {number} operationsPerUser - Operations per user
 * @param {string} [authType='memory'] - Auth provider type
 * @returns {Promise<Object>} Test results
 */
async function runConcurrentAuthLoadTest(
  concurrentUsers,
  operationsPerUser,
  authType = 'memory'
) {
  const eventEmitter = new EventEmitter();

  const testOptions = {
    'express-app': {
      use: () => {},
      get: () => {},
      post: () => {}
    },
    sessionSecret: 'test-secret-for-concurrent-testing'
  };

  const authService = createAuthService(authType, testOptions, eventEmitter);
  const startTime = Date.now();

  console.log(
    `Starting Concurrent Auth Load Test: ${concurrentUsers} users, ${operationsPerUser} operations each...`
  );

  // Pre-register users for concurrent testing
  const users = [];
  for (let i = 0; i < concurrentUsers; i++) {
    const username = `concurrentuser${i}`;
    const password = `ConcurrentPass${i}!`;
    const email = `concurrent${i}@example.com`;

    try {
      await authService.createUser({
        username,
        password,
        email,
        name: `Concurrent User ${i}`
      });
      users.push({ username, password, email });
    } catch (error) {
      console.error(`Failed to register user ${username}:`, error.message);
    }
  }

  // Run concurrent operations
  const userPromises = users.map(async (user, index) => {
    let userSuccessful = 0;
    let userFailed = 0;

    for (let j = 0; j < operationsPerUser; j++) {
      try {
        // Simulate authentication
        const authResult = await authService.authenticateUser(user.username, user.password);
        if (authResult && authResult.user) {
          userSuccessful++;

          // Simulate some delay
          await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));

          // Logout
          await authService.logout(authResult.session.token);
          userSuccessful++;
        } else {
          userFailed++;
        }
      } catch (error) {
        userFailed++;
      }
    }

    return { userIndex: index, successful: userSuccessful, failed: userFailed };
  });

  const results = await Promise.all(userPromises);

  const endTime = Date.now();
  const duration = endTime - startTime;
  const totalOperations = results.reduce((sum, r) => sum + r.successful + r.failed, 0);
  const totalSuccessful = results.reduce((sum, r) => sum + r.successful, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const operationsPerSecond = Math.round((totalOperations * 1000) / duration);

  console.log(
    `Concurrent Auth Load Test Completed: ${totalSuccessful} successful, ${totalFailed} failed operations in ${duration} ms (${operationsPerSecond} ops/sec).`
  );

  return {
    service: 'authservice-concurrent',
    type: authType,
    concurrentUsers,
    operationsPerUser,
    totalOperations,
    totalSuccessful,
    totalFailed,
    duration,
    operationsPerSecond
  };
}

/**
 * Runs a session management load test.
 *
 * @async
 * @function runSessionLoadTest
 * @param {number} sessions - Number of sessions to manage
 * @param {string} [authType='memory'] - Auth provider type
 * @returns {Promise<Object>} Test results
 */
async function runSessionLoadTest(sessions, authType = 'memory') {
  const eventEmitter = new EventEmitter();

  const testOptions = {
    'express-app': {
      use: () => {},
      get: () => {},
      post: () => {}
    },
    sessionSecret: 'test-secret-for-session-testing'
  };

  const authService = createAuthService(authType, testOptions, eventEmitter);
  const startTime = Date.now();

  console.log(`Starting Session Load Test: ${sessions} sessions...`);

  let successfulSessions = 0;
  let failedSessions = 0;
  const activeSessions = [];

  // Create sessions
  for (let i = 0; i < sessions; i++) {
    try {
      const username = `sessionuser${i}`;
      const password = `SessionPass${i}!`;

      // Register user
      await authService.createUser({
        username,
        password,
        email: `session${i}@example.com`,
        name: `Session User ${i}`
      });

      // Authenticate and create session
      const authResult = await authService.authenticateUser(username, password);
      if (authResult && authResult.user) {
        activeSessions.push({ username, user: authResult.user, session: authResult.session });
        successfulSessions++;
      } else {
        failedSessions++;
      }
    } catch (error) {
      failedSessions++;
    }

    if (i % 50 === 0 && i > 0) {
      console.log(`Created ${i} sessions...`);
    }
  }

  // Cleanup sessions
  for (const session of activeSessions) {
    try {
      await authService.logout(session.session.token);
    } catch (error) {
      console.error(`Failed to logout session for ${session.username}`);
    }
  }

  const endTime = Date.now();
  const duration = endTime - startTime;
  const sessionsPerSecond = Math.round((successfulSessions * 1000) / duration);

  console.log(
    `Session Load Test Completed: ${successfulSessions} successful sessions, ${failedSessions} failed in ${duration} ms (${sessionsPerSecond} sessions/sec).`
  );

  return {
    service: 'authservice-sessions',
    type: authType,
    sessions,
    successfulSessions,
    failedSessions,
    duration,
    sessionsPerSecond
  };
}

module.exports = {
  runAuthServiceLoadTest,
  runConcurrentAuthLoadTest,
  runSessionLoadTest
};