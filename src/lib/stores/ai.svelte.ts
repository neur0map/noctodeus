import type { AiMessage, AiProvider, StreamToken } from '$lib/ai/types';
import { aiChat, aiChatCancel } from '$lib/bridge/ai';
import { listen } from '@tauri-apps/api/event';

let messages = $state<AiMessage[]>([]);
let streaming = $state(false);
let provider = $state<AiProvider | null>(null);
let error = $state<string | null>(null);

// Listen for streaming tokens from the Rust backend
let unlistenToken: (() => void) | null = null;

async function setupListener() {
  if (unlistenToken) return;
  try {
    unlistenToken = await listen<StreamToken>('ai:token', (event) => {
      const { delta, done } = event.payload;
      if (done) {
        streaming = false;
        // Mark last assistant message as not streaming
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant') {
          last.streaming = false;
        }
        return;
      }
      // Append delta to last assistant message
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant' && last.streaming) {
        last.content += delta;
      }
    });
  } catch {
    // Expected to fail in browser dev mode without Tauri
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
      if (!provider || streaming) return;
      error = null;

      // Add user message
      messages.push({
        role: 'user',
        content,
        timestamp: Date.now(),
      });

      // Add empty assistant message for streaming
      messages.push({
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true,
      });

      streaming = true;

      try {
        // Build clean message list for the API (strip frontend-only fields)
        const apiMessages = messages
          .filter(m => !(m.role === 'assistant' && m.streaming))
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
          messages.pop();
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
