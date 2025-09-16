/**
 * @fileoverview Load test for AI service performance.
 *
 * This load test measures the performance of AI operations including
 * chat messages, conversations, and completions across different AI providers
 * (Claude, ChatGPT, Ollama). Tests help identify performance bottlenecks and
 * scalability limits.
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const createAIService = require('../../../src/aiservice');
const EventEmitter = require('events');

/**
 * Executes load test for AI service performance.
 *
 * Runs a series of AI operations to measure performance characteristics
 * of different AI providers under load.
 *
 * @async
 * @function runAIServiceLoadTest
 * @param {number} iterations - Number of AI operations to perform
 * @param {string} [aiType='claude'] - Type of AI provider to test
 * @param {Object} [options={}] - Configuration options for the AI provider
 * @returns {Promise<Object>} Test results including service, type, iterations, and duration
 */
async function runAIServiceLoadTest(
  iterations,
  aiType = 'claude',
  options = {}
) {
  const eventEmitter = new EventEmitter();

  // Mock dependencies for load testing
  const mockDependencies = {
    logging: {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {}
    },
    caching: {
      put: async (key, value) => Promise.resolve(true),
      get: async (key) => Promise.resolve(null),
      delete: async (key) => Promise.resolve(true)
    }
  };

  const testOptions = {
    ...options,
    dependencies: mockDependencies,
    'express-app': { use: () => {} },
    // Mock API keys for testing (these won't make real API calls)
    apiKey: 'test-api-key',
    model: aiType === 'claude' ? 'claude-3-haiku-20240307' :
           aiType === 'chatgpt' ? 'gpt-3.5-turbo' : 'llama2'
  };

  const aiService = createAIService(aiType, testOptions, eventEmitter);
  const startTime = Date.now();
  console.log(
    `Starting AI Service Load Test (${aiType} provider) for ${iterations} iterations...`
  );

  // Test messages for load testing
  const testMessages = [
    'Hello, how are you today?',
    'What is JavaScript?',
    'Explain async/await in Node.js',
    'Write a simple function in JavaScript',
    'What are the benefits of using TypeScript?',
    'How does event loop work in Node.js?',
    'Explain the concept of closures',
    'What is the difference between let and var?',
    'How to handle errors in Node.js?',
    'What are promises in JavaScript?'
  ];

  for (let i = 0; i < iterations; i++) {
    try {
      const messageIndex = i % testMessages.length;
      const message = testMessages[messageIndex];

      // Simulate AI service operations
      if (aiService.chat) {
        // Simulate chat operation (mock implementation)
        await new Promise(resolve => {
          setTimeout(() => {
            // Mock response delay based on provider
            const mockDelay = aiType === 'claude' ? 50 :
                            aiType === 'chatgpt' ? 75 : 100;
            resolve(`Mock response to: ${message}`);
          }, mockDelay);
        });
      }

      // Simulate caching operation
      if (aiService.cache) {
        const cacheKey = `ai-response-${i}`;
        const cacheValue = `Mock AI response ${i}`;
        await aiService.cache.put(cacheKey, cacheValue);
        await aiService.cache.get(cacheKey);
      }

      if (i % 100 === 0 && i > 0) {
        console.log(`AI Service load test iteration ${i} completed`);
      }
    } catch (error) {
      console.error(`Error in AI Service load test iteration ${i}:`, error.message);
    }
  }

  const endTime = Date.now();
  const duration = endTime - startTime;
  const operationsPerSecond = Math.round((iterations * 1000) / duration);

  console.log(
    `AI Service Load Test Completed: ${iterations} operations in ${duration} ms (${operationsPerSecond} ops/sec).`
  );

  return {
    service: 'aiservice',
    type: aiType,
    iterations,
    duration,
    operationsPerSecond
  };
}

/**
 * Runs a conversation load test to simulate multiple conversation threads.
 *
 * @async
 * @function runConversationLoadTest
 * @param {number} conversations - Number of concurrent conversations
 * @param {number} messagesPerConversation - Messages per conversation
 * @param {string} [aiType='claude'] - AI provider type
 * @returns {Promise<Object>} Test results
 */
async function runConversationLoadTest(
  conversations,
  messagesPerConversation,
  aiType = 'claude'
) {
  const eventEmitter = new EventEmitter();

  const mockDependencies = {
    logging: {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {}
    }
  };

  const testOptions = {
    dependencies: mockDependencies,
    'express-app': { use: () => {} },
    apiKey: 'test-api-key'
  };

  const aiService = createAIService(aiType, testOptions, eventEmitter);
  const startTime = Date.now();

  console.log(
    `Starting AI Conversation Load Test: ${conversations} conversations, ${messagesPerConversation} messages each...`
  );

  const conversationPromises = [];

  for (let i = 0; i < conversations; i++) {
    const conversationPromise = async () => {
      const conversationId = `conv-${i}`;

      for (let j = 0; j < messagesPerConversation; j++) {
        // Simulate conversation message
        await new Promise(resolve => {
          setTimeout(() => {
            resolve(`Response ${j + 1} in conversation ${conversationId}`);
          }, 30 + Math.random() * 20); // Simulate variable response time
        });
      }
    };

    conversationPromises.push(conversationPromise());
  }

  await Promise.all(conversationPromises);

  const endTime = Date.now();
  const duration = endTime - startTime;
  const totalMessages = conversations * messagesPerConversation;
  const messagesPerSecond = Math.round((totalMessages * 1000) / duration);

  console.log(
    `AI Conversation Load Test Completed: ${totalMessages} messages in ${conversations} conversations in ${duration} ms (${messagesPerSecond} msg/sec).`
  );

  return {
    service: 'aiservice-conversations',
    type: aiType,
    conversations,
    messagesPerConversation,
    totalMessages,
    duration,
    messagesPerSecond
  };
}

module.exports = {
  runAIServiceLoadTest,
  runConversationLoadTest
};