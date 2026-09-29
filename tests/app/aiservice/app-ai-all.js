/**
 * @fileoverview Light App - all AI provider instances.
 *
 * Creates one named AI service instance per provider (default/ollama, claude,
 * openai, gemini) and sends the same prompt to each. The instances appear in
 * the AI Service dashboard's INSTANCE dropdown.
 * --use-system-ca
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });

const express = require('express');
const helmet = require('helmet');
const EventEmitter = require('events');
const path = require('node:path');
const serviceRegistry = require('../../../index');

const app = express();

// Security headers: applied before other middleware so every response is
// covered. CSP is disabled here to match the main apps (app.js / app-noauth.js)
// because the service dashboards use inline styles/scripts; enable a tuned CSP
// per deployment.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Some commont options (noauth - no API key or login required)
const options = {
  logDir: path.join(__dirname, './.application/', 'logs'),
  dataDir: path.join(__dirname, './.application/', 'data'),
  'express-app': app,
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
serviceRegistry.initialize(app, eventEmitter, options);

// Initialize auth service (required for login/register functionality)
// The authservice automatically serves login.html and register.html from its views folder
const authservice = serviceRegistry.authservice('file', options);

// Get other services
const cache = serviceRegistry.cache();
const logger = serviceRegistry.logger();
const dataService = serviceRegistry.dataService('file', options );

/**
 * Builds the tokens store path for a named instance so each instance
 * tracks its usage in a separate file.
 * @param {string} name - Instance name.
 * @return {string} Absolute path to the instance's tokens store.
 */
const tokensStore = (name) =>
  path.join(__dirname, './.application/data', `ai-tokens-${name}.json`);

// Default instance - Ollama (no API key required).
const defaultAi = serviceRegistry.aiservice('ollama', {
  model: process.env.OLLAMA_MODEL,
  endpoint: process.env.OLLAMA_ENDPOINT,
  'express-app': app,
  tokensStorePath: tokensStore('default')
});

// Named instance - Claude.
const claudeAi = serviceRegistry.aiservice('claude', {
  instanceName: 'claude',
  apikey: process.env.ANTHROPIC_API_KEY,
  model: process.env.ANTHROPIC_MODEL,
  'express-app': app,
  tokensStorePath: tokensStore('claude')
});

// Named instance - OpenAI (Azure).
const openaiAi = serviceRegistry.aiservice('openai', {
  instanceName: 'openai',
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  'express-app': app,
  tokensStorePath: tokensStore('openai')
});

// Named instance - Gemini.
const geminiAi = serviceRegistry.aiservice('gemini', {
  instanceName: 'gemini',
  apikey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL,
  'express-app': app,
  tokensStorePath: tokensStore('gemini')
});

// Named instance - Azure OpenAI via Key Vault.
// The provider requires Key Vault credentials, so only register it when
// AZURE_KEYVAULT_URL is configured; otherwise the constructor would throw.
let openaiKvAi = null;
if (process.env.AZURE_KEYVAULT_URL) {
  openaiKvAi = serviceRegistry.aiservice('openai-kv', {
    instanceName: 'openai-kv',
    // App Registration #1 - connects to the Key Vault.
    keyVaultUrl: process.env.AZURE_KEYVAULT_URL,
    tenantId: process.env.AZURE_KEYVAULT_TENANT_ID,
    clientId: process.env.AZURE_KEYVAULT_CLIENT_ID,
    clientSecret: process.env.AZURE_KEYVAULT_CLIENT_SECRET,
    secretNames: {
      tenantId: process.env.AZURE_KEYVAULT_SECRET_TENANT_ID || undefined,
      clientId: process.env.AZURE_KEYVAULT_SECRET_CLIENT_ID || undefined,
      clientSecret: process.env.AZURE_KEYVAULT_SECRET_CLIENT_SECRET || undefined,
      endpoint: process.env.AZURE_KEYVAULT_SECRET_ENDPOINT || undefined,
      deploymentName: process.env.AZURE_KEYVAULT_SECRET_DEPLOYMENT_NAME || undefined
    },
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    'express-app': app,
    tokensStorePath: tokensStore('openai-kv')
  });
} else {
  logger.info('AI OpenAI-KV instance skipped - AZURE_KEYVAULT_URL not configured');
}

// Send the same prompt to every instance.
const PROMPT = 'Please give me an inspiring quote';
const instances = [
  { name: 'default (ollama)', svc: defaultAi },
  { name: 'claude', svc: claudeAi },
  { name: 'openai', svc: openaiAi },
  { name: 'gemini', svc: geminiAi }
];
if (openaiKvAi) {
  instances.push({ name: 'openai-kv', svc: openaiKvAi });
}

(async () => {
  for (const { name, svc } of instances) {
    try {
      const response = await svc.prompt(PROMPT);
      const content = (response.content || '').replace(/\s+/g, ' ').trim();
      console.log(`[${name}] ${content.slice(0, 160)}`);
    } catch (error) {
      console.error(`[${name}] prompt failed: ${error.message}`);
    }
  }
})();

// Load images
app.use('/images/nooblyjs-logo.png', express.static(path.join(__dirname, 'nooblyjs-core.png')));

// Redirect root to services
app.get('/', (req, res) => {
  res.redirect('/services');
});

app.listen(3101, async () => {
  logger.info('Server running on port 3101');
  logger.info('Visit: http://localhost:3101/ (redirects to /services)');
  logger.info('AI Service dashboard: http://localhost:3101/services/ai');
});
