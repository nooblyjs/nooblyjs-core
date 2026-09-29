/**
 * @fileoverview Unit tests for the Ollama and Gemini AI providers.
 *
 * Both providers are pointed at a local HTTP server that imitates the
 * upstream APIs, so the real fetch path (request shape, headers, response
 * parsing, usage tracking, errors and events) is exercised without network
 * access or API keys.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const http = require('node:http');
const EventEmitter = require('events');

const AIOllama = require('../../../src/aiservice/provider/aiollama');
const AIGemini = require('../../../src/aiservice/provider/gemini');

describe('AI HTTP providers', () => {
  let server;
  let endpoint;
  /** @type {Array<{method: string, url: string, headers: Object, body: *}>} */
  let requests;
  /** Per-path responders: (req, body) => [status, payload]. */
  let routes;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => {
        const body = raw ? JSON.parse(raw) : null;
        requests.push({ method: req.method, url: req.url, headers: req.headers, body });
        const handler = routes[req.url.split('?')[0]];
        const [status, payload] = handler ? handler(req, body) : [404, { error: 'not found' }];
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    endpoint = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    requests = [];
    routes = {};
  });

  describe('AIOllama', () => {
    let ai;
    let events;

    beforeEach(() => {
      events = new EventEmitter();
      jest.spyOn(events, 'emit');
      ai = new AIOllama({ endpoint, model: 'llama-test' }, events);
    });

    it('generates a completion and estimates token usage', async () => {
      routes['/api/generate'] = () => [200, { response: 'Hello there', done: true, context: [1, 2] }];
      const result = await ai.prompt('Say hi', { temperature: 0.2 });
      expect(requests[0].body).toEqual({ model: 'llama-test', prompt: 'Say hi', stream: false, options: { temperature: 0.2 } });
      expect(result).toEqual(expect.objectContaining({
        content: 'Hello there',
        provider: 'ollama',
        model: 'llama-test',
        done: true,
        usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 }
      }));
    });

    it('surfaces HTTP errors and emits ai:error', async () => {
      routes['/api/generate'] = () => [500, {}];
      await expect(ai.prompt('x')).rejects.toThrow('Ollama API error: 500');
      expect(events.emit).toHaveBeenCalledWith('ai:error', expect.objectContaining({ provider: 'ollama' }));
    });

    it('lists models and reports whether the server is running', async () => {
      routes['/api/tags'] = () => [200, { models: [{ name: 'llama-test' }] }];
      routes['/api/version'] = () => [200, { version: '0.1' }];
      expect(await ai.listModels()).toEqual([{ name: 'llama-test' }]);
      expect(await ai.isRunning()).toBe(true);

      routes['/api/tags'] = () => [503, {}];
      await expect(ai.listModels()).rejects.toThrow('Ollama API error: 503');
      const down = new AIOllama({ endpoint: 'http://127.0.0.1:1' }, events);
      expect(await down.isRunning()).toBe(false);
    });

    it('estimates zero tokens for empty text and saves settings', async () => {
      expect(ai.estimateTokenCount_('')).toBe(0);
      await ai.saveSettings({ model: 'other', ignored: 1 });
      expect((await ai.getSettings()).model).toBe('other');
    });
  });

  describe('AIGemini', () => {
    let ai;
    let events;

    beforeEach(() => {
      events = new EventEmitter();
      jest.spyOn(events, 'emit');
      ai = new AIGemini({ apiKey: 'g-key', endpoint, model: 'gemini-test', temperature: 0.1 }, events);
    });

    it('requires an API key', () => {
      expect(() => new AIGemini({}, events)).toThrow('Gemini API key is required');
    });

    it('generates content with the key header and reports usage', async () => {
      routes['/v1beta/models/gemini-test:generateContent'] = () => [200, {
        candidates: [{ content: { parts: [{ text: 'Hel' }, { text: 'lo' }] } }],
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 }
      }];
      const result = await ai.prompt('Hi', { maxTokens: 50 });
      expect(requests[0].headers['x-goog-api-key']).toBe('g-key');
      expect(requests[0].body.generationConfig).toEqual({ maxOutputTokens: 50, temperature: 0.1 });
      expect(result).toEqual({
        content: 'Hello',
        usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
        model: 'gemini-test',
        provider: 'gemini'
      });
    });

    it('rejects empty candidates with the finish reason', async () => {
      routes['/v1beta/models/gemini-test:generateContent'] = () => [200, { candidates: [{ finishReason: 'SAFETY' }] }];
      await expect(ai.prompt('x')).rejects.toThrow('finishReason: SAFETY');
    });

    it('includes the upstream error body on HTTP failures', async () => {
      routes['/v1beta/models/gemini-test:generateContent'] = () => [400, { error: 'bad request' }];
      await expect(ai.prompt('x')).rejects.toThrow('Gemini API error: 400');
      expect(events.emit).toHaveBeenCalledWith('ai:error', expect.objectContaining({ provider: 'gemini' }));
    });

    it('lists models', async () => {
      routes['/v1beta/models'] = () => [200, { models: [{ name: 'models/gemini-test' }] }];
      expect(await ai.listModels()).toEqual([{ name: 'models/gemini-test' }]);
      routes['/v1beta/models'] = () => [401, {}];
      await expect(ai.listModels()).rejects.toThrow('Gemini API error: 401');
    });

    it('saves settings', async () => {
      await ai.saveSettings({ maxtokens: 10 });
      expect((await ai.getSettings()).maxtokens).toBe(10);
    });
  });
});
