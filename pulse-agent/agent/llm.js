import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { setDefaultModelProvider } from '@openai/agents';
import { OpenAIProvider, setOpenAIAPI } from '@openai/agents-openai';
import { config } from 'dotenv';

// Load repo-root .env before reading OPENROUTER_API_KEY (imports run before app.js body)
const agentDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(agentDir, '../..');
config({ path: resolve(rootDir, '.env') });
config({ path: resolve(agentDir, '../.env') });

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** Default model: OpenRouter free router (https://openrouter.ai/openrouter/free) */
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

/**
 * Point the OpenAI Agents SDK at OpenRouter (Chat Completions compatible).
 * Reads OPENROUTER_API_KEY from repo-root `.env` or `pulse-agent/.env`.
 */
export function configureLlm() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY not set — @Pulse AI replies will fail until you add it to the repo-root .env');
    return;
  }

  setOpenAIAPI('chat_completions');
  setDefaultModelProvider(
    new OpenAIProvider({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
      useResponses: false,
    }),
  );
}

export function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
}

configureLlm();
