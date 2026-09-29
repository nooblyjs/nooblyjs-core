/**
 * @fileoverview OpenAI Provider
 * OpenAI implementation providing LLM services with token tracking.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const AIServiceBase = require('./aibase');
const OpenAI = require('openai');
const { AzureOpenAI } = require('openai');

/**
 * OpenAI provider implementation.
 * @class
 * @extends {AIServiceBase}
 */
class AIOpenAI extends AIServiceBase {
  /**
   * Initializes the OpenAI service.
   * @param {Object} options Configuration options.
   * @param {string} options.apiKey OpenAI API key.
   * @param {string} options.model Model to use (default: gpt-3.5-turbo).
   * @param {EventEmitter} eventEmitter Optional event emitter for AI service events.
   */
  constructor(options = {}, eventEmitter) {
    super(options, eventEmitter);

    this.settings = {};
    this.settings.desciption = "This provider exposes the Claude apis for use by an underlying provider."
    this.settings.list = [
      {setting: "model", type: "string", values : ['gpt-5.0']} ,
      {setting: "apikey", type: "string", values : ['The api key retrieved fron https://chategpt']} ,
      {setting: "maxtokens", type: "int", values : ['1000']} ,
      {setting: "temperature", type: "number", values : ['0.7']} 
    ]
    
    if (!options.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    if (options.endpoint) {
      // Azure OpenAI: the API key only authenticates against the Azure
      // endpoint, and the request is routed by deployment name (not model).
      this.model_ = options.deployment || options.model || 'gpt-3.5-turbo';
      this.client_ = new AzureOpenAI({
        apiKey: options.apiKey,
        endpoint: options.endpoint,
        deployment: options.deployment,
        apiVersion: options.apiVersion || '2024-12-01-preview'
      });
    } else {
      // Public OpenAI API.
      this.model_ = options.model || 'gpt-3.5-turbo';
      this.client_ = new OpenAI({
        apiKey: options.apiKey
      });
    }
  }

    /**
   * Get all our settings
   */
  async getSettings(){
    return this.settings;
  }

  /**
   * Set all our settings
   */
  async saveSettings(settings){
    for (let i = 0; i < this.settings.list.length; i++){
      if (settings[this.settings.list[i].setting] != null){
        this.settings[this.settings.list[i].setting] = settings[this.settings.list[i].setting];
        this.logger?.info(`[${this.constructor.name}] Setting changed: ${this.settings.list[i].setting}`, {
          setting: this.settings.list[i].setting,
          newValue: settings[this.settings.list[i].setting]
        });
      }
    }
  }

  /**
   * Sends a prompt to OpenAI.
   * @param {string} prompt The prompt to send.
   * @param {Object} options Additional options for the request.
   * @param {number} options.maxTokens Maximum tokens in response (default: 1000).
   * @param {number} options.temperature Temperature for response (default: 0.7).
   * @return {Promise<Object>} Response with content and usage data.
   */
  async prompt(prompt, options = {}) {
    try {
      const maxTokens = options.maxTokens || this.settings.maxtokens || 1000;
      const temperature = options.temperature || this.settings.temperature || 0.7;

      // Newer models (gpt-5 / o-series) renamed max_tokens -> max_completion_tokens
      // and only accept the default temperature.
      const isNewModel = /^(gpt-5|o\d)/i.test(this.model_);

      const params = {
        model: this.model_,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      };
      if (isNewModel) {
        params.max_completion_tokens = maxTokens;
      } else {
        params.max_tokens = maxTokens;
        params.temperature = temperature;
      }

      const response = await this.client_.chat.completions.create(params);

      const usage = {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      };

      // Track usage and costs
      await this.trackUsage_(usage, this.model_, 'chatgpt');

      const result = {
        content: response.choices[0].message.content,
        usage,
        model: this.model_,
        provider: 'chatgpt'
      };

      this.emitPromptComplete_(prompt, result, options);

      return result;
    } catch (error) {
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('ai:error', { error: error.message, provider: 'chatgpt' });
      }
      throw error;
    }
  }
}

module.exports = AIOpenAI;