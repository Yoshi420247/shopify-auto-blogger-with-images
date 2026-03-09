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
import { trackTextCall } from './costTracker.js';

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
 * Returns true if the active model is Claude AND the API key is available.
 * Falls back to OpenAI if ANTHROPIC_API_KEY is missing.
 */
export function isClaudeModel() {
  if (!config.aiModel.startsWith('claude')) {
    return false;
  }
  if (!config.anthropic.apiKey) {
    console.warn('AI_MODEL is claude-sonnet but ANTHROPIC_API_KEY is not set — falling back to GPT-5.2');
    return false;
  }
  return true;
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
export async function createCompletion({ messages, maxTokens, reasoningEffort, useUtilityModel, cacheSystemPrompt, label }) {
  if (isClaudeModel()) {
    return createClaudeCompletion({ messages, maxTokens, useUtilityModel, cacheSystemPrompt, label });
  }
  return createOpenAICompletion({ messages, maxTokens, reasoningEffort, label });
}

async function createOpenAICompletion({ messages, maxTokens, reasoningEffort, label }) {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: config.openai.model,
    messages,
    max_completion_tokens: maxTokens || config.openai.maxOutputTokens,
    reasoning_effort: reasoningEffort || config.openai.reasoningEffort || 'medium'
  });

  if (response.usage) {
    trackTextCall({
      model: config.openai.model,
      label: label || 'OpenAI call',
      inputTokens: response.usage.prompt_tokens || 0,
      outputTokens: response.usage.completion_tokens || 0
    });
  }

  return response.choices[0]?.message?.content || '';
}

async function createClaudeCompletion({ messages, maxTokens, useUtilityModel, cacheSystemPrompt, label }) {
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

  let response;
  try {
    response = await client.messages.create(params);
  } catch (err) {
    // Detect billing/credit errors and fall back to OpenAI if available
    const isBillingError = err.status === 400 && err.message?.includes('credit balance is too low');
    if (isBillingError && config.openai.apiKey) {
      console.warn('');
      console.warn('⚠ Anthropic API returned "credit balance is too low".');
      console.warn('  Your ANTHROPIC_API_KEY may belong to a different workspace than the one with credits.');
      console.warn('  Fix: Go to https://console.anthropic.com/settings/keys and create a new key');
      console.warn('  in the workspace that has credits, then update your GitHub secret.');
      console.warn('');
      console.warn('  Falling back to OpenAI GPT-5.2 for this request...');
      return createOpenAICompletion({ messages, maxTokens, reasoningEffort: 'medium', label });
    }
    if (isBillingError) {
      const msg = [
        'Anthropic API error: credit balance is too low.',
        'Your ANTHROPIC_API_KEY likely belongs to a different workspace than the one with credits.',
        'Fix: Go to https://console.anthropic.com/settings/keys, select the workspace',
        'that has credits ($13.24 shown in billing), generate a new API key,',
        'and update the ANTHROPIC_API_KEY secret in your GitHub repo settings.',
      ].join('\n  ');
      throw new Error(msg);
    }
    throw err;
  }

  // Log cache performance and track cost
  if (response.usage) {
    const cached = response.usage.cache_read_input_tokens || 0;
    const created = response.usage.cache_creation_input_tokens || 0;
    if (cached > 0) {
      console.log(`  Prompt cache hit: ${cached} tokens read from cache (90% savings)`);
    } else if (created > 0) {
      console.log(`  Prompt cache miss: ${created} tokens cached for next call`);
    }

    trackTextCall({
      model,
      label: label || (useUtilityModel ? 'Utility call' : 'Claude call'),
      inputTokens: response.usage.input_tokens || 0,
      outputTokens: response.usage.output_tokens || 0,
      cacheRead: cached,
      cacheCreation: created
    });
  }

  // Claude returns content as an array of blocks
  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text || '';
}

export default { createCompletion, isClaudeModel, getActiveModelName };
