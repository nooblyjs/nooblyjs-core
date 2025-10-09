/**
 * @fileoverview AI Service Demo
 * Example showing how to use the NooblyJS AI Service
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

// Example 1: Using Claude AI
// API key MUST be provided in constructor options
const claudeAI = serviceRegistry.aiservice('claude', {
  apiKey: process.env.ANTHROPIC_API_KEY || 'your-anthropic-api-key',
  model: 'claude-3-5-sonnet-20241022', // Optional, defaults to claude-3-5-sonnet-20241022
  tokensStorePath: './.data/ai-tokens-claude.json' // Optional, defaults to ./.data/ai-tokens.json
});

// Example 2: Using OpenAI ChatGPT
// API key MUST be provided in constructor options
const chatGPT = serviceRegistry.aiservice('chatgpt', {
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
  model: 'gpt-3.5-turbo', // Optional, defaults to gpt-3.5-turbo
  tokensStorePath: './.data/ai-tokens-chatgpt.json' // Optional
});

// Example 3: Using Ollama (local model server)
// No API key required for local Ollama
const ollama = serviceRegistry.aiservice('ollama', {
  baseUrl: 'http://localhost:11434', // Optional, defaults to http://localhost:11434
  model: 'llama3.2', // Optional, defaults to llama3.2
  tokensStorePath: './.data/ai-tokens-ollama.json' // Optional
});

// Example custom routes using AI service
app.post('/ask-claude', async (req, res) => {
  try {
    const { prompt, maxTokens = 1000, temperature = 0.7 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await claudeAI.prompt(prompt, {
      maxTokens,
      temperature
    });

    res.json({
      prompt: prompt,
      response: response.content,
      provider: 'claude',
      usage: response.usage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/ask-chatgpt', async (req, res) => {
  try {
    const { prompt, maxTokens = 1000, temperature = 0.7 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await chatGPT.prompt(prompt, {
      maxTokens,
      temperature
    });

    res.json({
      prompt: prompt,
      response: response.content,
      provider: 'chatgpt',
      usage: response.usage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/ask-ollama', async (req, res) => {
  try {
    const { prompt, maxTokens = 1000, temperature = 0.7 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await ollama.prompt(prompt, {
      maxTokens,
      temperature
    });

    res.json({
      prompt: prompt,
      response: response.content,
      provider: 'ollama',
      usage: response.usage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Example batch processing route
app.post('/batch-process', async (req, res) => {
  try {
    const { prompts, provider = 'claude' } = req.body;

    if (!prompts || !Array.isArray(prompts)) {
      return res.status(400).json({ error: 'Prompts array is required' });
    }

    const aiService = provider === 'chatgpt' ? chatGPT : provider === 'ollama' ? ollama : claudeAI;
    const results = [];

    for (const prompt of prompts) {
      try {
        const response = await aiService.prompt(prompt);
        results.push({
          prompt,
          response: response.content,
          success: true
        });
      } catch (error) {
        results.push({
          prompt,
          error: error.message,
          success: false
        });
      }
    }

    res.json({ results, provider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event listeners
globalEventEmitter.on('ai:prompt-sent', (data) => {
  console.log(`AI Prompt sent to ${data.provider}: ${data.prompt.substring(0, 50)}...`);
});

globalEventEmitter.on('ai:response-received', (data) => {
  console.log(`AI Response received from ${data.provider} (${data.tokens} tokens)`);
});

globalEventEmitter.on('ai:error', (data) => {
  console.log(`AI Error from ${data.provider}: ${data.error}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🤖 AI Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- AI Interface: http://localhost:3000/services/ai/');
  console.log('- Swagger API Docs: http://localhost:3000/services/ai/swagger');
  console.log('- Service Status: http://localhost:3000/services/ai/api/status');
  console.log('- Ask Claude: POST http://localhost:3000/ask-claude');
  console.log('- Ask ChatGPT: POST http://localhost:3000/ask-chatgpt');
  console.log('- Ask Ollama: POST http://localhost:3000/ask-ollama');
  console.log('- Batch Process: POST http://localhost:3000/batch-process');
  console.log('\nExample request body:');
  console.log('{ "prompt": "Explain quantum computing in simple terms", "maxTokens": 500, "temperature": 0.7 }');
  console.log('\nConfiguration:');
  console.log('- Claude: Requires apiKey in options or ANTHROPIC_API_KEY env var');
  console.log('- ChatGPT: Requires apiKey in options or OPENAI_API_KEY env var');
  console.log('- Ollama: Requires Ollama server running on localhost:11434');
  console.log('\nConnection info must be passed in constructor options.');
  console.log('Token usage data is stored in local JSON files (./.data/ai-tokens-*.json)');
});