# AI Service - Comprehensive Usage Guide

## Overview

The **AI Service** is a modular, multi-provider language model integration framework that allows applications to interact with multiple AI backends (Claude, OpenAI, Ollama, and custom API endpoints) through a unified interface. The service provides:

- **Multi-Provider Support**: Seamless switching between Claude, OpenAI's ChatGPT, Ollama (local), and custom API backends
- **Token Tracking**: Automatic token usage tracking with cost estimation
- **Analytics**: Built-in analytics for prompt tracking, usage patterns, and performance metrics
- **Web UI Dashboard**: Interactive interface for testing prompts and monitoring analytics
- **RESTful API**: Complete REST API for programmatic access
- **Event-Driven Architecture**: EventEmitter-based lifecycle events for integration

## Table of Contents

1. [Quick Start](#quick-start)
2. [Service Architecture](#service-architecture)
3. [Creating and Configuring AI Services](#creating-and-configuring-ai-services)
4. [Core Service Interface](#core-service-interface)
5. [Provider Reference](#provider-reference)
6. [REST API Endpoints](#rest-api-endpoints)
7. [Analytics Module](#analytics-module)
8. [Web UI Scripts and Usage](#web-ui-scripts-and-usage)
9. [Event System](#event-system)
10. [Cost Estimation](#cost-estimation)
11. [Error Handling](#error-handling)
12. [Examples](#examples)

---

## Quick Start

### Installation

```bash
npm install
```

### Basic Usage

```javascript
const createAIService = require('./src/aiservice');
const EventEmitter = require('events');

// Create an AI service instance
const eventEmitter = new EventEmitter();

const aiService = createAIService('claude', {
  apiKey: 'your-claude-api-key'
}, eventEmitter);

// Send a prompt
const response = await aiService.prompt('What is machine learning?');
console.log(response.content);
console.log(response.usage); // Token usage information
```

---

## Service Architecture

### Core Hierarchy

```
AIService (Factory)
├── Claude Provider (AIServiceBase)
├── OpenAI Provider (AIServiceBase)
├── Ollama Provider (AIServiceBase)
├── API Provider
├── Analytics Module
└── Event System
```

### Key Components

| Component | Purpose |
|-----------|---------|
| **AIServiceBase** | Base class with token tracking, settings management, and cost calculation |
| **Providers** | Implementation-specific classes for each AI backend |
| **Analytics** | Tracks prompt statistics, token usage, and user activity |
| **Routes** | Express.js REST API endpoints |
| **Views** | Web UI dashboard and client-side JavaScript |

---

## Creating and Configuring AI Services

### Factory Function Signature

```javascript
createAIService(providerType, options, eventEmitter)
```

**Parameters:**
- `providerType` (string): One of `'claude'`, `'chatgpt'`, `'ollama'`, `'api'`
- `options` (object): Provider-specific configuration
- `eventEmitter` (EventEmitter, optional): Event emitter for lifecycle events

**Returns:** Configured AI service instance with methods for prompting, settings management, and analytics

### Claude Configuration

```javascript
const aiService = createAIService('claude', {
  apiKey: process.env.CLAUDE_API_KEY,
  model: 'claude-sonnet-4-5-20250929', // Optional, default provided
  dependencies: {
    logging: loggerInstance  // Optional for cross-service logging
  }
}, eventEmitter);
```

**Settings Available:**
- `model` (string): Claude model identifier
- `apikey` (string): Anthropic API key
- `maxtokens` (integer): Maximum tokens in response (default: 1000)
- `temperature` (number): Response creativity (0.0-1.0, default: 0.7)

### OpenAI Configuration

```javascript
const aiService = createAIService('chatgpt', {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-3.5-turbo', // Optional
  dependencies: {}
}, eventEmitter);
```

**Settings Available:**
- `model` (string): OpenAI model identifier
- `apikey` (string): OpenAI API key
- `maxtokens` (integer): Maximum tokens in response (default: 1000)
- `temperature` (number): Response creativity (0.0-1.0, default: 0.7)

### Ollama Configuration

```javascript
const aiService = createAIService('ollama', {
  baseUrl: 'http://localhost:11434', // Optional
  model: 'llama3.2', // Optional
  dependencies: {}
}, eventEmitter);
```

**Settings Available:**
- `model` (string): Ollama model identifier
- `baseurl` (string): Ollama service URL (default: http://localhost:11434)
- `temperature` (number): Response creativity (0.0-1.0, default: 0.7)

### API Configuration

```javascript
const aiService = createAIService('api', {
  url: 'http://localhost:3000', // Remote API base URL
  apikey: 'your-api-key', // Optional authentication
  timeout: 30000 // Request timeout (default: 5000)
}, eventEmitter);
```

**Settings Available:**
- `url` (string): Remote API base URL
- `apikey` (string): Optional API key for authentication

---

## Core Service Interface

### Main Methods

#### `prompt(prompt, options)`

Sends a prompt to the configured AI provider and returns the response.

**Parameters:**
- `prompt` (string, required): The prompt text to send
- `options` (object, optional):
  - `maxTokens` (number): Override max tokens for this request
  - `temperature` (number): Override temperature for this request
  - `model` (string): Override model for this request
  - `username` (string): Username for analytics attribution
  - `provider` (string): Provider selection

**Returns:**
```javascript
{
  content: string,           // The AI's response text
  usage: {
    promptTokens: number,    // Tokens in input
    completionTokens: number,// Tokens in output
    totalTokens: number      // Total tokens used
  },
  model: string,             // Model used
  provider: string,          // Provider name
  done: boolean,             // Ollama only: whether generation is complete
  context: number[]          // Ollama only: context window array
}
```

**Example:**
```javascript
const response = await aiService.prompt('Explain quantum computing', {
  maxTokens: 500,
  temperature: 0.5,
  username: 'user@example.com'
});

console.log('Response:', response.content);
console.log('Cost: $' + calculateCost(response.usage, response.provider));
```

#### `getSettings()`

Retrieves the current settings for the AI service.

**Returns:**
```javascript
{
  desciption: string,  // Service description
  list: [              // Available settings
    {
      setting: string, // Setting name
      type: string,    // Data type (string, int, number, date, list)
      values: any[]    // Available/example values
    }
  ],
  [setting]: any       // Current setting values
}
```

**Example:**
```javascript
const settings = await aiService.getSettings();
console.log('Current model:', settings.model);
console.log('Max tokens:', settings.maxtokens);
```

#### `saveSettings(settings)`

Updates service settings.

**Parameters:**
- `settings` (object): Settings to update with keys matching available settings

**Example:**
```javascript
await aiService.saveSettings({
  model: 'claude-sonnet-4-5-20250929',
  maxtokens: 2000,
  temperature: 0.8
});
```

#### `listModels()` (Claude and Ollama only)

Lists available models for the provider.

**Returns:**
```javascript
{
  models: [
    {
      name: string,
      description: string,
      size: string,
      modified_at: string
    }
  ]
}
```

**Example:**
```javascript
const models = await aiService.listModels();
models.forEach(model => console.log(model.name));
```

#### `isRunning()` (Ollama only)

Checks if the Ollama service is running and accessible.

**Returns:** `Promise<boolean>`

**Example:**
```javascript
const running = await aiService.isRunning();
if (running) {
  console.log('Ollama is available');
}
```

---

## Provider Reference

### Claude Provider (aiclaude.js)

**Extends:** AIServiceBase

**Requirements:**
- Anthropic API key
- `@anthropic-ai/sdk` package installed

**Key Features:**
- Token tracking with cost estimation
- Default model: claude-sonnet-4-5-20250929
- Comprehensive error handling

**Settings:**
- `model`: Claude model ID
- `apikey`: Anthropic API key
- `maxtokens`: Max response tokens
- `temperature`: Response creativity

**Methods:**
- `prompt(prompt, options)` - Send prompt to Claude
- `getSettings()` - Get current settings
- `saveSettings(settings)` - Update settings
- `listModels()` - List available Claude models

**Events:**
- `ai:prompt` - Emitted on successful prompt
- `ai:error` - Emitted on error

---

### OpenAI Provider (aiopenai.js)

**Extends:** AIServiceBase

**Requirements:**
- OpenAI API key
- `openai` package installed

**Key Features:**
- Token tracking with cost estimation
- Default model: gpt-3.5-turbo
- Cost calculation for ChatGPT pricing

**Settings:**
- `model`: OpenAI model ID
- `apikey`: OpenAI API key
- `maxtokens`: Max response tokens
- `temperature`: Response creativity

**Methods:**
- `prompt(prompt, options)` - Send prompt to OpenAI
- `getSettings()` - Get current settings
- `saveSettings(settings)` - Update settings

**Events:**
- `ai:prompt` - Emitted on successful prompt
- `ai:error` - Emitted on error

---

### Ollama Provider (aiollama.js)

**Extends:** AIServiceBase

**Requirements:**
- Local Ollama service running
- No API key required

**Key Features:**
- Local model execution (free)
- Token estimation (not precise like cloud providers)
- Health checking and model listing

**Settings:**
- `model`: Ollama model identifier
- `baseurl`: Ollama service URL
- `temperature`: Response creativity

**Methods:**
- `prompt(prompt, options)` - Send prompt to local Ollama
- `getSettings()` - Get current settings
- `saveSettings(settings)` - Update settings
- `listModels()` - List available models from Ollama
- `isRunning()` - Check if Ollama is accessible
- `estimateTokenCount_(text)` - Token estimation helper

**Token Estimation:**
Ollama doesn't provide precise token counts, so the provider estimates:
```javascript
estimatedTokens = Math.ceil(text.length / 4)
```

**Events:**
- `ai:prompt` - Emitted on successful prompt
- `ai:error` - Emitted on error

---

### API Provider (aiapi.js)

**Requires:** No base class extension

**Purpose:** Proxy requests to a remote AI service via HTTP

**Requirements:**
- Remote API endpoint
- Optional API key for authentication

**Key Features:**
- HTTP-based request proxying
- Axios-based HTTP client
- Custom timeout support

**Settings:**
- `url`: Remote API base URL
- `apikey`: Optional API key for authentication

**Methods:**
- `prompt(prompt, options)` - Send prompt to remote API
- `getSettings()` - Get current settings
- `saveSettings(settings)` - Update settings
- `getModels()` - Get models from remote API
- `getAnalytics()` - Get analytics from remote API
- `healthCheck()` - Check remote API health

**Expected Remote Endpoints:**
- `POST /services/ai/api/prompt` - Process prompt
- `GET /services/ai/api/models` - List models
- `GET /services/ai/api/analytics` - Get analytics
- `GET /services/ai/api/health` - Health check

**Events:**
- `ai:prompt` - Emitted on successful prompt
- `ai:error` - Emitted on error

---

## REST API Endpoints

The AI Service exposes the following REST API endpoints when integrated with Express:

### `GET /services/ai/api/status`

Returns the operational status of the AI service.

**Response:**
```json
{
  "status": "ai api running",
  "provider": "AIServiceBase",
  "enabled": true,
  "hasApiKey": true
}
```

---

### `POST /services/ai/api/prompt`

Sends a prompt to the AI service and returns the response.

**Request Body:**
```json
{
  "prompt": "What is machine learning?",
  "username": "user@example.com",
  "options": {
    "maxTokens": 500,
    "temperature": 0.7,
    "model": "claude-sonnet-4-5-20250929"
  }
}
```

**Response:**
```json
{
  "content": "Machine learning is...",
  "usage": {
    "promptTokens": 150,
    "completionTokens": 345,
    "totalTokens": 495
  },
  "model": "claude-sonnet-4-5-20250929",
  "provider": "claude"
}
```

**Error Responses:**
- `400`: Missing or invalid prompt
- `503`: AI service disabled (API key not configured)
- `500`: Server error

---

### `GET /services/ai/api/analytics`

Returns analytics data for prompt usage and token consumption.

**Query Parameters:**
- `limit` (integer, optional): Limit for top prompts (default: 10)
- `recentLimit` (integer, optional): Limit for recent prompts (default: 100)

**Response:**
```json
{
  "overview": {
    "totalPrompts": 25,
    "totalCalls": 150,
    "totalPromptTokens": 45000,
    "totalCompletionTokens": 78000,
    "lastPromptAt": "2025-11-23T15:30:00Z",
    "generatedAt": "2025-11-23T15:35:00Z"
  },
  "topPrompts": [
    {
      "prompt": "Explain quantum computing",
      "username": "user@example.com",
      "calls": 12,
      "promptTokens": 150,
      "completionTokens": 2340,
      "totalTokens": 2490,
      "lastPrompt": "2025-11-23T15:30:00Z",
      "model": "claude-sonnet-4-5-20250929",
      "provider": "claude"
    }
  ],
  "topRecent": [
    // Most recent 100 prompts
  ]
}
```

---

### `GET /services/ai/api/models`

Returns available models for the current provider.

**Response:**
```json
{
  "models": [
    {
      "name": "claude-3-opus-20250219",
      "description": "Most powerful Claude model"
    }
  ]
}
```

**Note:** Not all providers support model listing. Returns message if not supported.

---

### `GET /services/ai/api/health`

Health check endpoint (particularly useful for Ollama).

**Response:**
```json
{
  "healthy": true,
  "provider": "AIOllama"
}
```

---

### `GET /services/ai/api/settings`

Retrieves current service settings.

**Response:**
```json
{
  "desciption": "Provider settings",
  "list": [
    {
      "setting": "model",
      "type": "string",
      "values": ["claude-sonnet-4-5-20250929"]
    }
  ],
  "model": "claude-sonnet-4-5-20250929",
  "apikey": "sk-..."
}
```

---

### `POST /services/ai/api/settings`

Updates service settings.

**Request Body:**
```json
{
  "model": "claude-sonnet-4-5-20250929",
  "maxtokens": 2000,
  "temperature": 0.8
}
```

**Response:** `OK` on success, or error message

---

## Analytics Module

The Analytics module (`src/aiservice/modules/analytics.js`) tracks prompt usage patterns without mutating the AI service provider.

### Key Features

- **In-Memory Storage**: Uses Map for efficient prompt tracking (max 2000 entries)
- **LRU Eviction**: Automatically removes least recently used prompts when limit is reached
- **Per-Prompt Statistics**: Aggregates calls, tokens, and timestamps per unique prompt/user combination
- **Event Integration**: Automatically records prompts from `ai:prompt:complete` events

### Analytics Class Methods

#### `recordPrompt(data)`

Records a prompt execution.

**Parameters:**
```javascript
{
  prompt: string,           // The prompt text
  username: string,         // User who executed the prompt
  promptTokens: number,     // Tokens in input
  completionTokens: number, // Tokens in output
  totalTokens: number,      // Total tokens
  model: string,            // Model used
  provider: string,         // Provider name
  timestamp: number         // Execution timestamp (ms)
}
```

**Example:**
```javascript
analytics.recordPrompt({
  prompt: 'Explain machine learning',
  username: 'alice@example.com',
  promptTokens: 150,
  completionTokens: 345,
  totalTokens: 495,
  model: 'claude-sonnet-4-5-20250929',
  provider: 'claude',
  timestamp: Date.now()
});
```

#### `getOverview()`

Returns aggregated metrics across all prompts.

**Returns:**
```javascript
{
  totalPrompts: 25,              // Number of unique prompts tracked
  totalCalls: 150,               // Total number of executions
  totalPromptTokens: 45000,      // Sum of all input tokens
  totalCompletionTokens: 78000,  // Sum of all output tokens
  lastPromptAt: '2025-11-23...',// ISO timestamp of last execution
  generatedAt: '2025-11-23...'  // When this overview was generated
}
```

#### `getTopPrompts(limit = 10)`

Returns the most frequently executed prompts.

**Parameters:**
- `limit` (number, optional): Max number of prompts to return (default: 10)

**Returns:**
```javascript
[
  {
    prompt: "Explain quantum computing",
    username: "alice@example.com",
    calls: 12,
    promptTokens: 1500,
    completionTokens: 23400,
    totalTokens: 24900,
    lastPrompt: "2025-11-23T15:30:00Z",
    model: "claude-sonnet-4-5-20250929",
    provider: "claude"
  },
  // ... more prompts sorted by call count
]
```

#### `getTopRecent(limit = 100)`

Returns the most recently executed prompts.

**Parameters:**
- `limit` (number, optional): Max number of prompts to return (default: 100)

**Returns:**
```javascript
[
  {
    prompt: "Latest prompt",
    username: "bob@example.com",
    calls: 1,
    promptTokens: 100,
    completionTokens: 250,
    totalTokens: 350,
    lastPrompt: "2025-11-23T15:35:00Z",
    model: "claude-sonnet-4-5-20250929",
    provider: "claude"
  },
  // ... more prompts sorted by timestamp descending
]
```

#### `getAnalytics(options)`

Returns combined analytics data.

**Parameters:**
```javascript
{
  limit: 10,         // Limit for top prompts
  recentLimit: 100   // Limit for recent prompts
}
```

**Returns:**
```javascript
{
  overview: {},     // From getOverview()
  topPrompts: [],   // From getTopPrompts(limit)
  topRecent: []     // From getTopRecent(recentLimit)
}
```

#### `clear()`

Clears all stored analytics data.

---

## Web UI Scripts and Usage

The AI Service includes a comprehensive web UI accessible at `/services/ai` with interactive dashboard and testing interfaces.

### UI Components

#### Dashboard Tab
- **Prompt Overview**: Summary metrics of all prompt activity
- **Top Prompts by Activity**: Most frequently executed prompts with statistics
- **Recent Prompt Activity**: Sortable table of recent prompt executions

#### Data Tab
- **AI Prompt Interface**: Form to submit prompts and receive responses
- **Provider Selection**: Select between Claude, ChatGPT, and Ollama
- **Example Prompts**: Quick-start buttons for common prompt types
- **Advanced Options**: Settings for max tokens, temperature, and model override
- **Service Status**: Buttons to check status, list models, and health check
- **Usage Analytics**: Real-time analytics display with JSON response

#### Settings Tab
- **Dynamic Settings Form**: Auto-generated form based on provider settings
- **Settings Management**: Save and reload settings without restart

### Client-Side Functions (script.js)

#### Prompt Management

##### `handlePromptSubmit(event)`
Handles form submission for prompt requests.

**Functionality:**
- Validates prompt input
- Collects username, max tokens, temperature, and model
- Sends POST request to `/services/ai/api/prompt`
- Updates UI with response and token usage
- Records analytics

**Example Usage:**
```javascript
// Automatically called on form submission
// Can be triggered programmatically via form submit
document.getElementById('promptForm').submit();
```

##### `clearPrompt()`
Clears the prompt textarea and hides response.

---

#### Analytics Functions

##### `loadAnalytics()`
Fetches and displays analytics data.

**Functionality:**
- Fetches from `/services/ai/api/analytics`
- Updates overview metrics
- Renders top prompts list
- Populates recent prompts table
- Shows loading indicators

---

##### `sortTable(column)`
Sorts the recent prompts table by specified column.

**Parameters:**
- `column` (string): Column to sort by (`'prompt'`, `'username'`, `'lastPrompt'`, `'promptTokens'`, `'completionTokens'`)

**Example:**
```javascript
sortTable('lastPrompt');  // Sort by last execution time
```

---

#### Status Checking

##### `checkStatus()`
Checks AI service status.

**Endpoint:** `GET /services/ai/api/status`

**Display:** Updates status response container with JSON

---

##### `checkModels()`
Lists available models for current provider.

**Endpoint:** `GET /services/ai/api/models`

**Display:** Updates status response container with models

---

##### `checkHealth()`
Performs health check on AI service.

**Endpoint:** `GET /services/ai/api/health`

**Display:** Updates status response container with health status

---

#### Settings Management

##### `loadSettings()`
Fetches and renders settings form.

**Functionality:**
- Fetches from `/services/ai/api/settings`
- Dynamically generates form fields based on setting types
- Populates current values
- Displays description

---

##### `renderSettingsForm(data)`
Renders form fields based on settings structure.

**Supported Input Types:**
- `string`: Text input
- `int` or `integer`: Number input
- `number`: Float input with any step
- `date`: Date picker
- `list` or `options`: Select dropdown

---

##### `saveSettings()` (Form handler)
Saves updated settings via POST request.

**Endpoint:** `POST /services/ai/api/settings`

**Functionality:**
- Collects form data
- Sends JSON payload
- Shows success/error alert
- Reloads settings after save

---

#### Provider Management

##### `handleProviderSelection()`
Sets up provider selection UI.

**Functionality:**
- Handles radio button selection
- Updates visual selection state
- Checks provider health status

---

##### `checkProviderStatus(provider)`
Checks if a specific provider is healthy.

**Parameters:**
- `provider` (string): Provider name (`'claude'`, `'chatgpt'`, `'ollama'`)

**Endpoint:** `GET /services/ai/api/health`

**Display:** Updates status indicator (green/red circle)

---

#### Utility Functions

##### `calculateCost(usage, provider)`
Estimates cost of API usage.

**Parameters:**
- `usage` (object): Token usage object with `promptTokens` and `completionTokens`
- `provider` (string): Provider name

**Pricing Rates (hardcoded):**
- Claude: $0.000003 per input token, $0.000015 per output token
- ChatGPT: $0.0000005 per input token, $0.0000015 per output token
- Ollama: Free (0 cost)

**Returns:** Estimated cost as number

**Example:**
```javascript
const cost = calculateCost({
  promptTokens: 150,
  completionTokens: 345
}, 'claude');
console.log('Cost: $' + cost.toFixed(6));
```

---

##### `formatNumber(value)`
Formats numbers with locale-specific separators.

**Example:** `1000` → `"1,000"`

---

##### `formatDate(value)`
Formats ISO timestamps to locale string.

**Example:** `"2025-11-23T15:30:00Z"` → `"11/23/2025, 3:30:00 PM"`

---

##### `escapeHtml(text)`
Escapes HTML special characters to prevent XSS.

---

##### `showAlert(message, type = 'success')`
Displays temporary alert message.

**Parameters:**
- `message` (string): Alert text
- `type` (string): `'success'` or `'error'`

**Behavior:** Auto-dismisses after 5 seconds

---

##### `makeRequest(url, method = 'GET', body = null)`
Performs HTTP request with error handling.

**Parameters:**
- `url` (string): Request URL
- `method` (string): HTTP method
- `body` (object, optional): Request body (auto-JSON-stringified)

**Returns:** Parsed response (JSON or text)

**Throws:** Error if response status is not ok

---

### UI Event Handlers

The following event handlers are automatically set up on DOM load:

| Event | Handler | Behavior |
|-------|---------|----------|
| Form submit | `handlePromptSubmit` | Send prompt to API |
| Clear button click | `clearPrompt` | Clear textarea and response |
| Advanced toggle click | `toggleAdvanced` | Show/hide advanced options |
| Temperature slider input | Update temperature value display | Show current temp value |
| Analytics refresh button click | `loadAnalytics` | Refresh analytics |
| Dashboard tab shown | `loadAnalytics` | Auto-load when tab displayed |
| Settings tab shown | `loadSettings` | Auto-load when tab displayed |

---

## Event System

The AI Service emits the following events through the EventEmitter:

### Service-Level Events

#### `ai:prompt`
Emitted when a prompt is successfully processed.

**Event Data:**
```javascript
{
  prompt: string,         // Original prompt
  response: {
    content: string,      // AI response
    usage: {...},         // Token usage
    model: string,        // Model used
    provider: string      // Provider name
  }
}
```

---

#### `ai:error`
Emitted when an error occurs during prompt processing.

**Event Data:**
```javascript
{
  error: string,          // Error message
  provider: string        // Provider name
}
```

---

#### `ai:prompt:complete`
Emitted after prompt completion with full analytics data.

**Event Data:**
```javascript
{
  prompt: string,
  username: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  model: string,
  provider: string,
  response: {...}
}
```

---

### API Route Events

#### `api-ai-status`
Emitted when status endpoint is accessed.

**Event Data:** Status string

---

#### `api-ai-prompt`
Emitted when prompt is processed via API.

**Event Data:**
```javascript
{
  prompt: string,
  username: string,
  response: {...}
}
```

---

#### `api-ai-error`
Emitted when API error occurs.

**Event Data:**
```javascript
{
  error: string
}
```

---

#### `api-ai-analytics`
Emitted when analytics endpoint is accessed.

**Event Data:** Analytics object

---

#### `api-ai-models`
Emitted when models endpoint is accessed.

**Event Data:** Models array

---

#### `ai:loading view`
Emitted when views module initializes.

**Event Data:**
```javascript
{
  folder: string  // Path to views folder
}
```

---

## Cost Estimation

The AI Service includes built-in cost calculation based on provider pricing.

### Cost Rates (Current)

| Provider | Input Rate | Output Rate | Notes |
|----------|-----------|-----------|-------|
| Claude | $0.000003 per token | $0.000015 per token | Based on Claude 3 pricing |
| ChatGPT | $0.0000005 per token | $0.0000015 per token | Based on GPT-3.5 pricing |
| Ollama | Free | Free | Local execution |

### Cost Calculation Formula

```javascript
inputCost = promptTokens × inputRate
outputCost = completionTokens × outputRate
totalCost = inputCost + outputCost
```

### Example

```javascript
// Claude: 150 prompt tokens, 345 completion tokens
inputCost = 150 × 0.000003 = $0.00045
outputCost = 345 × 0.000015 = $0.005175
totalCost = $0.005625

// ChatGPT: Same tokens
inputCost = 150 × 0.0000005 = $0.000075
outputCost = 345 × 0.0000015 = $0.0005175
totalCost = $0.0005925
```

### Token Storage

The base class stores token usage in `./.application/data/ai-tokens.json`:

```json
{
  "claude": [
    {
      "session": "session-id",
      "timestamp": 1700000000000,
      "promptTokens": 150,
      "completionTokens": 345,
      "totalTokens": 495,
      "estimatedCost": 0.005625
    }
  ]
}
```

---

## Error Handling

### Common Error Scenarios

#### API Key Not Provided

**Error:** `"Claude API key is required"`

**Resolution:** Pass `apiKey` in options when creating service

```javascript
const aiService = createAIService('claude', {
  apiKey: process.env.CLAUDE_API_KEY
});
```

---

#### API Key Invalid

**Error:** `"401 Unauthorized"` or similar from provider API

**Resolution:** Verify API key validity and permissions

---

#### Ollama Service Unavailable

**Error:** `"Failed to fetch"` or `"ECONNREFUSED"`

**Resolution:** Ensure Ollama is running at configured URL

```bash
# Start Ollama
ollama serve
```

---

#### Prompt Too Long

**Error:** Context window exceeded or model max tokens exceeded

**Resolution:** Reduce prompt length or increase `maxTokens` in options

---

#### Rate Limiting

**Error:** `"429 Too Many Requests"` from provider

**Resolution:** Implement retry logic with exponential backoff

```javascript
async function promptWithRetry(prompt, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await aiService.prompt(prompt);
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

---

### Event-Based Error Handling

```javascript
const eventEmitter = new EventEmitter();

eventEmitter.on('ai:error', (data) => {
  console.error(`[${data.provider}] Error: ${data.error}`);
  // Log to monitoring system, notify user, etc.
});

const aiService = createAIService('claude', {
  apiKey: process.env.CLAUDE_API_KEY
}, eventEmitter);
```

---

## Examples

### Example 1: Basic Prompt with Claude

```javascript
const createAIService = require('./src/aiservice');
const EventEmitter = require('events');

async function main() {
  const eventEmitter = new EventEmitter();

  eventEmitter.on('ai:prompt', (data) => {
    console.log('Prompt processed:', data.prompt);
  });

  const aiService = createAIService('claude', {
    apiKey: process.env.CLAUDE_API_KEY
  }, eventEmitter);

  const response = await aiService.prompt(
    'What is the capital of France?'
  );

  console.log('Response:', response.content);
  console.log('Tokens used:', response.usage.totalTokens);
}

main().catch(console.error);
```

---

### Example 2: Provider Selection with Error Handling

```javascript
const createAIService = require('./src/aiservice');
const EventEmitter = require('events');

async function promptAI(provider, config, prompt) {
  const eventEmitter = new EventEmitter();

  eventEmitter.on('ai:error', (data) => {
    console.error(`Error from ${data.provider}: ${data.error}`);
  });

  try {
    const aiService = createAIService(provider, config, eventEmitter);

    console.log(`Using provider: ${provider}`);
    const response = await aiService.prompt(prompt);

    return {
      success: true,
      content: response.content,
      provider: response.provider,
      tokens: response.usage.totalTokens,
      cost: calculateCost(response.usage, response.provider)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Usage
const claudeResult = await promptAI('claude', {
  apiKey: process.env.CLAUDE_API_KEY
}, 'Hello, Claude!');

const ollamaResult = await promptAI('ollama', {
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2'
}, 'Hello, Ollama!');
```

---

### Example 3: Analytics and Monitoring

```javascript
const createAIService = require('./src/aiservice');
const EventEmitter = require('events');

async function monitoredPrompt(prompt, username) {
  const eventEmitter = new EventEmitter();
  const prompts = [];

  eventEmitter.on('ai:prompt:complete', (data) => {
    prompts.push({
      prompt: data.prompt,
      user: data.username,
      tokens: data.totalTokens,
      model: data.model,
      timestamp: new Date().toISOString()
    });
  });

  const aiService = createAIService('claude', {
    apiKey: process.env.CLAUDE_API_KEY
  }, eventEmitter);

  const response = await aiService.prompt(prompt, {
    username: username
  });

  // Get analytics
  const analytics = aiService.getPromptAnalytics();
  console.log('Total prompts tracked:',
    analytics.overview.totalPrompts);
  console.log('Total tokens used:',
    analytics.overview.totalPromptTokens +
    analytics.overview.totalCompletionTokens);

  return response;
}

// Usage
await monitoredPrompt('Explain machine learning', 'alice@example.com');
```

---

### Example 4: Settings Management

```javascript
const createAIService = require('./src/aiservice');

async function configureService() {
  const aiService = createAIService('claude', {
    apiKey: process.env.CLAUDE_API_KEY
  });

  // Get current settings
  const currentSettings = await aiService.getSettings();
  console.log('Current model:', currentSettings.model);

  // Update settings
  await aiService.saveSettings({
    model: 'claude-sonnet-4-5-20250929',
    maxtokens: 2000,
    temperature: 0.5
  });

  // Verify changes
  const updatedSettings = await aiService.getSettings();
  console.log('Updated model:', updatedSettings.model);
  console.log('Updated max tokens:', updatedSettings.maxtokens);
}

configureService().catch(console.error);
```

---

### Example 5: Ollama Local Integration

```javascript
const createAIService = require('./src/aiservice');
const EventEmitter = require('events');

async function useLocalOllama() {
  const eventEmitter = new EventEmitter();

  // Check if Ollama is running
  const aiService = createAIService('ollama', {
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2'
  }, eventEmitter);

  const isRunning = await aiService.isRunning();
  console.log('Ollama running:', isRunning);

  if (!isRunning) {
    console.error('Please start Ollama first: ollama serve');
    return;
  }

  // List available models
  const models = await aiService.listModels();
  console.log('Available models:', models.map(m => m.name));

  // Send prompt (completely free, runs locally)
  const response = await aiService.prompt(
    'Explain quantum computing in simple terms'
  );

  console.log('Response:', response.content);
  console.log('Cost: $0.00 (local execution)');
}

useLocalOllama().catch(console.error);
```

---

## Dependencies

### Core Dependencies
- `express` - Web framework and routing
- `events` - EventEmitter for inter-service communication

### Provider-Specific Dependencies
- `@anthropic-ai/sdk` - Claude API client
- `openai` - OpenAI API client
- `node-fetch` - HTTP client (Ollama, API provider)
- `axios` - HTTP client (API provider)

### Development
- `jest` - Testing framework

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "API key is required" | Missing API key | Set API key in options |
| 503 Service disabled | API key not configured | Provide valid API key |
| ECONNREFUSED (Ollama) | Ollama not running | Start Ollama: `ollama serve` |
| 401 Unauthorized | Invalid API key | Verify API key validity |
| Rate limiting (429) | Too many requests | Implement backoff/retry logic |
| Token limit exceeded | Prompt too long | Reduce prompt or increase limit |
| Settings not persisting | Settings module issue | Check logs for persistence errors |
| Analytics not updating | Event not fired | Verify EventEmitter is passed |

---

## File Structure

```
src/aiservice/
├── index.js              # Factory function
├── modules/
│   └── analytics.js      # Analytics tracking module
├── provider/
│   ├── aibase.js         # Base class for providers
│   ├── aiclaude.js       # Claude provider
│   ├── aiopenai.js       # OpenAI provider
│   ├── aiollama.js       # Ollama provider
│   └── aiapi.js          # API proxy provider
├── routes/
│   └── index.js          # Express API routes
└── views/
    ├── index.js          # View setup
    ├── index.html        # Dashboard UI
    └── script.js         # Client-side functionality
```

---

## Additional Resources

- [Anthropic Claude API Documentation](https://docs.anthropic.com)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Ollama Documentation](https://ollama.ai)
- [Express.js Documentation](https://expressjs.com)

---

**Document Version:** 1.0.0
**Last Updated:** November 23, 2025
**Service Version:** 1.0.14
