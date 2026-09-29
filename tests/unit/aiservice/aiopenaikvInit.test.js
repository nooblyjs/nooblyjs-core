/**
 * @fileoverview Unit tests for the Azure OpenAI Key Vault provider's
 * two-stage client initialisation.
 *
 * The Azure identity, Key Vault and OpenAI SDKs are mocked, so the tests
 * cover secret retrieval (including custom secret names and the deployment
 * fallback), token acquisition, client reuse and retry after failure.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const secrets = new Map();
const tokens = { value: 'aad-token' };
const openAiConfigs = [];

// Registered before requiring the provider (babel-jest is disabled, so
// jest.mock() is not hoisted).
jest.mock('@azure/identity', () => ({
  ClientSecretCredential: jest.fn().mockImplementation((tenantId, clientId) => ({
    tenantId,
    clientId,
    getToken: jest.fn(async () => (tokens.value ? { token: tokens.value } : null))
  }))
}));
jest.mock('@azure/keyvault-secrets', () => ({
  SecretClient: jest.fn().mockImplementation(() => ({
    getSecret: jest.fn(async (name) => {
      if (!secrets.has(name)) throw new Error(`SecretNotFound: ${name}`);
      return { value: secrets.get(name) };
    })
  }))
}));
jest.mock('openai', () => ({
  AzureOpenAI: jest.fn().mockImplementation((config) => {
    openAiConfigs.push(config);
    return {
      chat: {
        completions: {
          create: jest.fn(async () => ({
            choices: [{ message: { content: 'ok' } }],
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
          }))
        }
      }
    };
  })
}));

const EventEmitter = require('events');
const AIOpenAIKv = require('../../../src/aiservice/provider/aiopenaikv');
const { SecretClient } = require('@azure/keyvault-secrets');

const OPTIONS = {
  keyVaultUrl: 'https://kv.vault.azure.net/',
  tenantId: 't1',
  clientId: 'c1',
  clientSecret: 's1'
};

/** Seeds the Key Vault with app-registration #2 credentials. */
function seed(overrides = {}) {
  secrets.clear();
  const values = {
    'openai-app-tenant-id': 't2',
    'openai-app-client-id': 'c2',
    'openai-app-client-secret': 's2',
    'openai-endpoint': 'https://aoai.test',
    'openai-deployment-name': 'gpt-4o',
    ...overrides
  };
  for (const [k, v] of Object.entries(values)) if (v !== undefined) secrets.set(k, v);
}

describe('AIOpenAIKv initialisation', () => {
  beforeEach(() => {
    openAiConfigs.length = 0;
    tokens.value = 'aad-token';
    jest.clearAllMocks();
  });

  it('requires the Key Vault app registration', () => {
    expect(() => new AIOpenAIKv({ keyVaultUrl: 'x' })).toThrow('requires keyVaultUrl, tenantId');
  });

  it('builds the client from Key Vault secrets once and prompts through it', async () => {
    seed();
    const events = new EventEmitter();
    const ai = new AIOpenAIKv({ ...OPTIONS, dependencies: {} }, events);
    ai.logger = { info: jest.fn(), warn: jest.fn() };

    const result = await ai.prompt('hi');
    expect(result).toEqual(expect.objectContaining({ content: 'ok', model: 'gpt-4o', provider: 'chatgpt' }));
    await ai.prompt('again');
    expect(SecretClient).toHaveBeenCalledTimes(1);
    expect(openAiConfigs[0]).toEqual(expect.objectContaining({ endpoint: 'https://aoai.test', deployment: 'gpt-4o' }));
    await expect(openAiConfigs[0].azureADTokenProvider()).resolves.toBe('aad-token');

    tokens.value = null;
    await expect(openAiConfigs[0].azureADTokenProvider()).rejects.toThrow('Failed to obtain Azure AD token');
  });

  it('uses custom secret names and falls back to the configured deployment', async () => {
    seed({ 'openai-deployment-name': undefined, 'my-endpoint': 'https://custom.test' });
    const ai = new AIOpenAIKv({ ...OPTIONS, deployment: 'fallback-dep', secretNames: { endpoint: 'my-endpoint', tenantId: null } });
    ai.logger = { info: jest.fn(), warn: jest.fn() };
    await ai.prompt('hi');
    expect(openAiConfigs[0]).toEqual(expect.objectContaining({ endpoint: 'https://custom.test', deployment: 'fallback-dep' }));
    expect(ai.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Deployment name secret not found'), expect.any(Object));
  });

  it('fails without any deployment name and retries initialisation later', async () => {
    seed({ 'openai-deployment-name': undefined });
    const events = new EventEmitter();
    jest.spyOn(events, 'emit');
    const ai = new AIOpenAIKv(OPTIONS, events);
    await expect(ai.prompt('hi')).rejects.toThrow('deployment name could not be resolved');
    expect(events.emit).toHaveBeenCalledWith('ai:error', expect.objectContaining({ provider: 'chatgpt' }));

    seed();
    await expect(ai.prompt('hi')).resolves.toEqual(expect.objectContaining({ content: 'ok' }));
  });

  it('saves settings', async () => {
    const ai = new AIOpenAIKv({ ...OPTIONS, maxtokens: '200', temperature: '0.5' });
    expect((await ai.getSettings()).maxtokens).toBe(200);
    await ai.saveSettings({ apiVersion: '2025-01-01' });
    expect((await ai.getSettings()).apiVersion).toBe('2025-01-01');
  });
});
