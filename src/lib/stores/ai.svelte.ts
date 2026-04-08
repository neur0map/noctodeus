import type { AiMessage, AiProvider, StreamToken } from '$lib/ai/types';
import { aiChat, aiChatCancel } from '$lib/bridge/ai';
import { listen } from '@tauri-apps/api/event';

let messages = $state<AiMessage[]>([]);
let streaming = $state(false);
let provider = $state<AiProvider | null>(null);
let error = $state<string | null>(null);

// Listen for streaming tokens from the Rust backend
let listenerReady = false;

async function setupListener() {
  if (listenerReady) return;
  listenerReady = true;
  try {
    await listen<StreamToken>('ai:token', (event) => {
      const { delta, done } = event.payload;
      if (done) {
        streaming = false;
        // Mark last assistant message as not streaming
        const idx = messages.length - 1;
        if (idx >= 0 && messages[idx].role === 'assistant') {
          messages[idx] = { ...messages[idx], streaming: false };
        }
        return;
      }
      // Append delta to last assistant message
      const idx = messages.length - 1;
      if (idx >= 0 && messages[idx].role === 'assistant' && messages[idx].streaming) {
        messages[idx] = { ...messages[idx], content: messages[idx].content + delta };
      }
    });
  } catch {
    // Expected to fail in browser dev mode without Tauri
    listenerReady = false;
  }
}

export function getAiState() {
  setupListener();

  return {
    get messages() { return messages; },
    get streaming() { return streaming; },
    get provider() { return provider; },
    get error() { return error; },

    setProvider(p: AiProvider) {
      provider = p;
    },

    async send(content: string, systemPrompt?: string) {
      if (streaming) return;
      if (!provider) {
        error = 'No AI provider configured. Open Settings > AI to set one up.';
        return;
      }
      error = null;

      // Add user message
      messages = [...messages, {
        role: 'user',
        content,
        timestamp: Date.now(),
      }];

      // Add empty assistant message for streaming
      messages = [...messages, {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true,
      }];

      streaming = true;

      try {
        // Build clean message list for the API (strip frontend-only fields)
        const apiMessages = messages
          .filter(m => !(m.role === 'assistant' && m.streaming && !m.content))
          .map(m => ({ role: m.role, content: m.content }));

        await aiChat({
          provider,
          messages: apiMessages,
          systemPrompt,
        });
      } catch (err) {
        const { errorMessage: errMsg } = await import('$lib/utils/errors');
        error = errMsg(err);
        streaming = false;
        // Remove the empty assistant message on error
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          messages = messages.slice(0, -1);
        }
      }
    },

    async cancel() {
      try {
        await aiChatCancel();
      } catch {
        // ignore
      }
      streaming = false;
    },

    clear() {
      messages = [];
      error = null;
      streaming = false;
    },
  };
}
