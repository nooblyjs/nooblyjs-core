# AI Service (`src/aiservice/`)

**Dependency level:** 4 – Integration
**Dependencies:** `logging`, `caching`, `workflow`, `queueing`

Provides AI text generation, conversation, and streaming capabilities across multiple LLM providers. Integrates with the workflow and caching services for advanced use cases like response caching and AI-driven pipeline steps.

---

## Factory (`src/aiservice/index.js`)

```javascript
const ai = registry.aiservice('claude', {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-sonnet-20240229'
});
```

### `createAIService(type, options, eventEmitter)` → AI service instance

| `type` value | Provider class | LLM backend |
|---|---|---|
| `'claude'` (default) | `AIClaude` | Anthropic Claude |
| `'chatgpt'` | `AIOpenAI` | OpenAI GPT |
| `'ollama'` | `AIOllama` | Ollama (local LLM server) |
| `'api'` | `AIApi` | Remote AI API proxy |

Throws `Error` for unsupported types (no default fallback unlike other services).

**After creating the provider:**
1. Creates `Analytics` instance (`analytics = new Analytics(eventEmitter)`).
2. Injects `logger`, `cache`, `workflow`, and `queueing` dependencies.
3. Attaches `aiservice.promptAnalytics = analytics`.
4. Attaches `aiservice.getPromptAnalytics = () => analytics.getAnalytics()`.
5. Registers REST routes and dashboard view.

---

## AI Base Class (`src/aiservice/provider/aibase.js`)

All AI providers share a common interface:

### Core Methods

#### `async generate(options)` → `Object`

Generates a text response from the model.

**Options:**
| Field | Type | Description |
|---|---|---|
| `prompt` | string | The input prompt |
| `systemPrompt` | string | System-level instruction |
| `maxTokens` | number | Maximum tokens in response |
| `temperature` | number | Randomness (0-1) |
| `model` | string | Override the default model |

**Returns:** `{ text, usage: { inputTokens, outputTokens }, model, provider }`

#### `async stream(options)` → `void`

Streams a response chunk-by-chunk.

**Additional option:**
- `onChunk(chunk)` – callback invoked for each text chunk.

#### `async chat(messages)` → `Object`

Multi-turn conversation. `messages` is an array of `{ role: 'user' | 'assistant', content: string }`.

#### `async getModels()` → `string[]`

Returns the list of available models for this provider.

#### `async getSettings()` / `async saveSettings(settings)`

Standard settings management.

---

## Claude Provider (`src/aiservice/provider/aiclaude.js`)

Uses the `@anthropic-ai/sdk` package.

**Key options:**
- `apiKey` – Anthropic API key (or `ANTHROPIC_API_KEY` env var)
- `model` – default: `'claude-3-sonnet-20240229'`

**Default models available:** Claude 3 Opus, Sonnet, Haiku; Claude 3.5 Sonnet; Claude 2.1; etc.

---

## OpenAI Provider (`src/aiservice/provider/aiopenai.js`)

Uses the `openai` npm package.

**Key options:**
- `apiKey` – OpenAI API key (or `OPENAI_API_KEY` env var)
- `model` – default: `'gpt-4'`

---

## Ollama Provider (`src/aiservice/provider/aiollama.js`)

Connects to a locally-running Ollama server via HTTP.

**Key options:**
- `host` – Ollama server host (default: `'http://localhost:11434'`)
- `model` – model name to use (e.g. `'llama2'`, `'mistral'`)

---

## API Provider (`src/aiservice/provider/aiapi.js`)

Forwards requests to a remote AI API proxy endpoint. Useful for multi-tenant or centralized AI access.

---

## Analytics (`src/aiservice/modules/analytics.js`)

Tracks per-provider:
- Total prompts generated
- Token usage (input / output)
- Response times
- Error rates

Accessible via `aiservice.getPromptAnalytics()`.

---

## Routes

Mounted at `/services/aiservice/api/`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/services/aiservice/api/status` | Service status |
| `POST` | `/services/aiservice/api/generate` | Generate a response |
| `POST` | `/services/aiservice/api/stream` | Stream a response (SSE) |
| `POST` | `/services/aiservice/api/chat` | Multi-turn conversation |
| `GET` | `/services/aiservice/api/models` | List available models |
| `GET` | `/services/aiservice/api/analytics` | Prompt analytics |
| `POST` | `/services/aiservice/api/settings` | Update settings |

---

## UI (`src/aiservice/views/index.html`, `src/aiservice/views/script.js`)

The AI service dashboard provides an interactive chat interface for testing prompts directly from the browser.

---

## Response Caching

The injected `cache` dependency can be used to cache AI responses for repeated prompts:

```javascript
// The provider can check the cache before calling the API
const cacheKey = `ai:${type}:${hashOf(prompt)}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const response = await callProvider(prompt);
await cache.put(cacheKey, response);
return response;
```

---

## Usage

```javascript
// Simple generation
const response = await ai.generate({
  prompt: 'Summarize the key points of agile development.',
  maxTokens: 300,
  temperature: 0.7
});
console.log(response.text);

// Streaming
await ai.stream({
  prompt: 'Write a short story about a robot chef.',
  onChunk: (chunk) => process.stdout.write(chunk)
});

// Multi-turn chat
const result = await ai.chat([
  { role: 'user', content: 'What is machine learning?' },
  { role: 'assistant', content: 'Machine learning is...' },
  { role: 'user', content: 'Can you give an example?' }
]);
console.log(result.text);

// Prompt analytics
const stats = ai.getPromptAnalytics();
console.log(`Total prompts: ${stats.totalPrompts}, Avg tokens: ${stats.avgTokens}`);
```
