/**
 * Unified AI Client
 *
 * Abstracts OpenAI and Anthropic APIs behind a single interface.
 * Controlled by config.aiModel ('gpt-5.2' or 'claude-sonnet').
 *
 * All content generation flows through this module so switching
 * models only requires changing the AI_MODEL env var.
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
 * @returns {Promise<string>} The assistant's text response
 */
export async function createCompletion({ messages, maxTokens, reasoningEffort }) {
  if (isClaudeModel()) {
    return createClaudeCompletion({ messages, maxTokens });
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

async function createClaudeCompletion({ messages, maxTokens }) {
  const client = getAnthropic();

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
    model: config.anthropic.model,
    max_tokens: maxTokens || config.anthropic.maxOutputTokens,
    messages: chatMessages
  };

  if (systemParts.length > 0) {
    params.system = systemParts.join('\n\n');
  }

  const response = await client.messages.create(params);

  // Claude returns content as an array of blocks
  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text || '';
}

export default { createCompletion, isClaudeModel, getActiveModelName };
