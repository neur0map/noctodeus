import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { getSettings } from '$lib/stores/settings.svelte';

/**
 * Build a Vercel AI SDK LanguageModel instance from the user's current
 * settings. This is the single entry point for both the editor AI
 * (via xl-ai's custom ChatTransport) and the chat bubble (via streamText).
 *
 * Returns null if AI is not fully configured yet — callers should surface
 * a "configure AI in Settings" error in that case.
 */
export function getAIModel(): LanguageModel | null {
  const s = getSettings();
  if (!s.aiBaseUrl || !s.aiApiKey || !s.aiModel) return null;

  if (s.aiProviderId === 'openai') {
    const provider = createOpenAI({
      apiKey: s.aiApiKey,
      baseURL: s.aiBaseUrl || undefined,
    });
    return provider(s.aiModel);
  }

  // Everything else (Anthropic via OpenAI-compat, Ollama, Groq, OpenRouter,
  // custom) goes through the generic openai-compatible adapter with the
  // user-supplied base URL.
  const provider = createOpenAICompatible({
    name: s.aiProviderId || 'custom',
    apiKey: s.aiApiKey,
    baseURL: s.aiBaseUrl,
  });
  return provider(s.aiModel);
}

/**
 * The user-configured max output tokens, or undefined if they want the
 * provider default (setting = 0).
 */
export function getMaxTokens(): number | undefined {
  const v = getSettings().aiMaxTokens;
  return v > 0 ? v : undefined;
}
