/**
 * @fileoverview Unit tests for the Azure OpenAI (Key Vault) provider's
 * completion-token budget.
 *
 * Reasoning models (gpt-5 family, o-series) bill hidden reasoning tokens against
 * the completion budget, so a legacy 1000-token cap is routinely spent thinking
 * and the call returns EMPTY content with no error — a silent failure that only
 * shows up downstream as blank summaries.
 *
 * The value tested against is `this.model_`, which for this provider is the Azure
 * DEPLOYMENT name resolved from Key Vault: an arbitrary label that usually carries
 * the family in the middle ("krsa-poc-gpt-5-nano"), not at the start. An anchored
 * ^ match therefore classified a live gpt-5 deployment as legacy and capped it at
 * 1000 — 58% of calls on one deployment came back empty. These tests pin the
 * classification and the resulting request parameters.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 */

'use strict';

const AIOpenAIKv = require('../../../src/aiservice/provider/aiopenaikv');

/** Credentials are validated by the constructor but never used — nothing connects. */
const CREDENTIALS = {
  keyVaultUrl: 'https://kv-test.vault.azure.net/',
  tenantId: 'tenant',
  clientId: 'client',
  clientSecret: 'secret'
};

/**
 * Build a provider whose Key Vault + HTTP layers are stubbed, capturing the
 * parameters it would send to Azure OpenAI.
 * @param {string} deploymentName - Resolved deployment (normally from the vault).
 * @param {Object} [options] - Extra agent options (maxtokens, temperature…).
 * @returns {{provider: Object, sent: Array<Object>}}
 */
function makeProvider(deploymentName, options = {}) {
  const provider = new AIOpenAIKv({ ...CREDENTIALS, ...options });
  const sent = [];

  provider.model_ = deploymentName;
  provider.ensureClient_ = async () => {};
  provider.trackUsage_ = async () => {};
  provider.emitPromptComplete_ = () => {};
  provider.client_ = {
    chat: {
      completions: {
        create: async (params) => {
          sent.push(params);
          return {
            choices: [{ message: { content: 'a summary' } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
          };
        }
      }
    }
  };

  return { provider, sent };
}

describe('AIOpenAIKv completion-token budget', () => {
  test('a gpt-5 deployment behind a project prefix is treated as a reasoning model', async () => {
    const { provider, sent } = makeProvider('krsa-poc-gpt-5-nano');

    await provider.prompt('summarise this');

    expect(sent[0].max_completion_tokens).toBe(16000);
    // Reasoning deployments accept only the default temperature — sending one
    // is rejected by the API.
    expect(sent[0].temperature).toBeUndefined();
  });

  test.each([
    ['gpt-5', 16000],
    ['gpt-5-mini', 16000],
    ['o3-mini', 16000],
    ['prod-o4-mini', 16000],
    // gpt-4o is NOT a reasoning model: its "o" follows a digit, so the o-series
    // pattern must not match it.
    ['gpt-4o', 1000],
    ['krsa-poc-gpt-4o-2024', 1000],
    ['gpt-35-turbo', 1000]
  ])('%s gets a %i-token default budget', async (deployment, expected) => {
    const { provider, sent } = makeProvider(deployment);

    await provider.prompt('summarise this');

    expect(sent[0].max_completion_tokens).toBe(expected);
  });

  test('an agent-configured maxtokens overrides the default', async () => {
    const { provider, sent } = makeProvider('krsa-poc-gpt-5-nano', { maxtokens: 4000 });

    await provider.prompt('summarise this');

    expect(sent[0].max_completion_tokens).toBe(4000);
  });

  test('a per-call maxTokens overrides the agent configuration', async () => {
    const { provider, sent } = makeProvider('krsa-poc-gpt-5-nano', { maxtokens: 4000 });

    await provider.prompt('summarise this', { maxTokens: 250 });

    expect(sent[0].max_completion_tokens).toBe(250);
  });

  test('a legacy deployment still sends a temperature', async () => {
    const { provider, sent } = makeProvider('gpt-4o', { temperature: 0.7 });

    await provider.prompt('summarise this');

    expect(sent[0].temperature).toBe(0.7);
  });
});
