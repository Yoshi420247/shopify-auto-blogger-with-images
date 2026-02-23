/**
 * Unified AI Client
 *
 * Abstracts OpenAI and Anthropic APIs behind a single interface.
 * Controlled by config.aiModel ('gpt-5.2' or 'claude-sonnet').
 *
 * All content generation flows through this module so switching
 * models only requires changing the AI_MODEL env var.
 *
 * Cost optimizations:
 * - Utility tasks (review, dedup) route to Haiku 4.5 (~67% cheaper)
 * - Prompt caching on system prompts saves ~90% on cached reads
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import config from '../config.js';

let openaiClient = null;
let anthropicClient = null;

function getOpenAI() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
}

function getAnthropic() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return anthropicClient;
}

/**
 * Returns true if the active model is Claude
 */
export function isClaudeModel() {
  return config.aiModel.startsWith('claude');
}

/**
 * Returns the active model name for logging
 */
export function getActiveModelName() {
  if (isClaudeModel()) {
    return config.anthropic.model;
  }
  return config.openai.model;
}

/**
 * Create a chat completion using whichever provider is configured.
 *
 * @param {Object} options
 * @param {Array}  options.messages        - [{role:'system'|'user'|'assistant', content:string}]
 * @param {number} [options.maxTokens]     - Max output tokens (defaults to config value)
 * @param {string} [options.reasoningEffort] - OpenAI reasoning_effort ('low','medium','high'). Ignored for Claude.
 * @param {string} [options.useUtilityModel] - Set to true to use cheaper model for utility tasks (Haiku for Claude)
 * @param {boolean} [options.cacheSystemPrompt] - Set to true to enable prompt caching on the system prompt (Claude only)
 * @returns {Promise<string>} The assistant's text response
 */
export async function createCompletion({ messages, maxTokens, reasoningEffort, useUtilityModel, cacheSystemPrompt }) {
  if (isClaudeModel()) {
    return createClaudeCompletion({ messages, maxTokens, useUtilityModel, cacheSystemPrompt });
  }
  return createOpenAICompletion({ messages, maxTokens, reasoningEffort });
}

async function createOpenAICompletion({ messages, maxTokens, reasoningEffort }) {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: config.openai.model,
    messages,
    max_completion_tokens: maxTokens || config.openai.maxOutputTokens,
    reasoning_effort: reasoningEffort || config.openai.reasoningEffort || 'medium'
  });

  return response.choices[0]?.message?.content || '';
}

async function createClaudeCompletion({ messages, maxTokens, useUtilityModel, cacheSystemPrompt }) {
  const client = getAnthropic();

  // Use utility model (Haiku) for cheap tasks, primary model (Sonnet) for content generation
  const model = useUtilityModel && config.anthropic.utilityModel
    ? config.anthropic.utilityModel
    : config.anthropic.model;

  if (useUtilityModel) {
    console.log(`  Using utility model: ${model} (cost-optimized)`);
  }

  // Claude uses 'system' as a separate param, not a message role.
  // Extract system messages and merge them.
  const systemParts = [];
  const chatMessages = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
    } else {
      chatMessages.push({ role: msg.role, content: msg.content });
    }
  }

  // Claude requires at least one user message
  if (chatMessages.length === 0) {
    chatMessages.push({ role: 'user', content: systemParts.pop() || '' });
  }

  const params = {
    model,
    max_tokens: maxTokens || config.anthropic.maxOutputTokens,
    messages: chatMessages
  };

  // Build system param - with optional prompt caching
  if (systemParts.length > 0) {
    if (cacheSystemPrompt) {
      // Use structured system blocks with cache_control for prompt caching
      // This caches the system prompt across calls, saving ~90% on input token costs
      params.system = systemParts.map(text => ({
        type: 'text',
        text,
        cache_control: { type: 'ephemeral' }
      }));
    } else {
      params.system = systemParts.join('\n\n');
    }
  }

  const response = await client.messages.create(params);

  // Log cache performance if available
  if (response.usage) {
    const cached = response.usage.cache_read_input_tokens || 0;
    const created = response.usage.cache_creation_input_tokens || 0;
    if (cached > 0) {
      console.log(`  Prompt cache hit: ${cached} tokens read from cache (90% savings)`);
    } else if (created > 0) {
      console.log(`  Prompt cache miss: ${created} tokens cached for next call`);
    }
  }

  // Claude returns content as an array of blocks
  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text || '';
}

export default { createCompletion, isClaudeModel, getActiveModelName };
