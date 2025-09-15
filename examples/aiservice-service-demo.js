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

// Example 1: Using Claude AI (requires ANTHROPIC_API_KEY env variable)
const claudeAI = serviceRegistry.aiservice('claude', {
  // apiKey: 'your-anthropic-api-key', // Optional if ANTHROPIC_API_KEY env var is set
  model: 'claude-3-haiku-20240307' // Optional, defaults to claude-3-haiku-20240307
});

// Example 2: Using OpenAI ChatGPT (requires OPENAI_API_KEY env variable)
const chatGPT = serviceRegistry.aiservice('chatgpt', {
  // apiKey: 'your-openai-api-key', // Optional if OPENAI_API_KEY env var is set
  model: 'gpt-3.5-turbo' // Optional, defaults to gpt-3.5-turbo
});

// Example 3: Using Ollama (local model server)
const ollama = serviceRegistry.aiservice('ollama', {
  baseURL: 'http://localhost:11434', // Default Ollama URL
  model: 'llama2' // You need to have this model downloaded
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
  console.log('- AI Interface: http://localhost:3000/services/aiservice/');
  console.log('- Swagger API Docs: http://localhost:3000/services/aiservice/swagger');
  console.log('- Service Status: http://localhost:3000/services/aiservice/api/status');
  console.log('- Ask Claude: POST http://localhost:3000/ask-claude');
  console.log('- Ask ChatGPT: POST http://localhost:3000/ask-chatgpt');
  console.log('- Ask Ollama: POST http://localhost:3000/ask-ollama');
  console.log('- Batch Process: POST http://localhost:3000/batch-process');
  console.log('\nExample request body:');
  console.log('{ "prompt": "Explain quantum computing in simple terms", "maxTokens": 500, "temperature": 0.7 }');
  console.log('\nEnvironment variables needed:');
  console.log('- ANTHROPIC_API_KEY (for Claude)');
  console.log('- OPENAI_API_KEY (for ChatGPT)');
  console.log('- Ollama server running on localhost:11434 (for Ollama)');
});