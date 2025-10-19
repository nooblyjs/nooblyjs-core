/**
 * @fileoverview Claude AI Provider
 * Claude AI implementation providing LLM services with token tracking.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const AIServiceBase = require('./aibase');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * Claude AI provider implementation.
 * @class
 * @extends {AIServiceBase}
 */
class AIClaude extends AIServiceBase {
  /**
   * Initializes the Claude AI service.
   * @param {Object} options Configuration options.
   * @param {string} options.apiKey Claude API key.
   * @param {string} options.model Model to use (default: claude-3-5-sonnet-20241022).
   * @param {EventEmitter} eventEmitter Optional event emitter for AI service events.
   */
  constructor(options = {}, eventEmitter) {
    super(options, eventEmitter);

    this.settings = {};
    this.settings.desciption = "This provider exposes the Claude apis for use by an underlying provider."
    this.settings.list = [
      {setting: "model", type: "string", values : ['claude-sonnet-4-5-20250929']} ,
      {setting: "apikey", type: "string", values : ['The api key retrieved fron https://claude.ai']} ,
      {setting: "maxtokens", type: "int", values : ['1000']} ,
      {setting: "temperature", type: "number", values : ['0.7']} 
    ]

    if (!options.apiKey) {
      throw new Error('Claude API key is required');
    }

    this.model_ = options.model || this.settings.model || 'claude-sonnet-4-5-20250929';
    this.client_ = new Anthropic({
      apiKey: options.apiKey |  this.settings.apikey
    });
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
    for (var i=0; i < this.settings.list.length; i++){
      if (settings[this.settings.list[i].setting] != null){
        this.settings[this.settings.list[i].setting] = settings[this.settings.list[i].setting] 
        console.log(this.settings.list[i].setting + ' changed to :' + settings[this.settings.list[i].setting]  )
      }
    }
  }

  /**
   * Sends a prompt to Claude.
   * @param {string} prompt The prompt to send.
   * @param {Object} options Additional options for the request.
   * @param {number} options.maxTokens Maximum tokens in response (default: 1000).
   * @param {number} options.temperature Temperature for response (default: 0.7).
   * @return {Promise<Object>} Response with content and usage data.
   */
  async prompt(prompt, options = {}) {
    try {
      const response = await this.client_.messages.create({
        model: this.model_,
        max_tokens: options.maxTokens || this.settings.maxtokens ||  1000,
        temperature: options.temperature || this.settings.temperature || 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const usage = {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      };

      // Track usage and costs
      await this.trackUsage_(usage, this.model_, 'claude');

      const result = {
        content: response.content[0].text,
        usage,
        model: this.model_,
        provider: 'claude'
      };

      if (this.eventEmitter_) {
        this.eventEmitter_.emit('ai:prompt', { prompt, response: result });
      }

      return result;
    } catch (error) {
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('ai:error', { error: error.message, provider: 'claude' });
      }
      throw error;
    }
  }
}

module.exports = AIClaude;
