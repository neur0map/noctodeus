import type { AiMessage, AiProvider, StreamToken } from '$lib/ai/types';
import { aiChat, aiChatCancel } from '$lib/bridge/ai';
import { readFile } from '$lib/bridge/commands';
import { getSettings } from '$lib/stores/settings.svelte';
import { listen } from '@tauri-apps/api/event';

const RESEARCH_SYSTEM_PROMPT = `You are a research assistant analyzing the user's notes. You have been given specific notes as context.
Answer questions based ONLY on the provided note content. If the answer isn't in the notes, say so.
Quote relevant passages when supporting your answers.
Be precise, cite which note a piece of information comes from, and surface connections between notes when relevant.`;

const MAX_SOURCES = 10;
const MAX_CHARS_PER_SOURCE = 3000;

export interface ResearchSource {
  path: string;
  title: string;
  preview: string;
  content: string;
}

let sources = $state<ResearchSource[]>([]);
let messages = $state<AiMessage[]>([]);
let streaming = $state(false);
let error = $state<string | null>(null);
let provider = $state<AiProvider | null>(null);

// Separate streaming listener for research channel
let listenerReady = false;

async function setupListener() {
  if (listenerReady) return;
  listenerReady = true;
  try {
    await listen<StreamToken>('ai:token', (event) => {
      const { delta, done } = event.payload;
      if (done) {
        streaming = false;
        const idx = messages.length - 1;
        if (idx >= 0 && messages[idx].role === 'assistant') {
          messages[idx] = { ...messages[idx], streaming: false };
        }
        return;
      }
      const idx = messages.length - 1;
      if (idx >= 0 && messages[idx].role === 'assistant' && messages[idx].streaming) {
        messages[idx] = { ...messages[idx], content: messages[idx].content + delta };
      }
    });
  } catch {
    listenerReady = false;
  }
}

function buildContextBlock(): string {
  if (sources.length === 0) return '';

  const parts = sources.map((src, i) => {
    const truncated = src.content.length > MAX_CHARS_PER_SOURCE
      ? src.content.slice(0, MAX_CHARS_PER_SOURCE) + '\n... (truncated)'
      : src.content;
    return `--- Note ${i + 1}: "${src.title}" (${src.path}) ---\n${truncated}`;
  });

  return `The user has loaded ${sources.length} note(s) for analysis:\n\n${parts.join('\n\n')}`;
}

/** Wait for the streaming flag to become false (max ~30s) */
function waitForStreamEnd(): Promise<void> {
  return new Promise((resolve) => {
    if (!streaming) { resolve(); return; }
    const start = Date.now();
    const check = () => {
      if (!streaming || Date.now() - start > 30_000) {
        resolve();
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

export function getResearchState() {
  setupListener();

  return {
    get sources() { return sources; },
    get messages() { return messages; },
    get streaming() { return streaming; },
    get error() { return error; },
    get provider() { return provider; },

    setProvider(p: AiProvider) {
      provider = p;
    },

    async addSource(path: string) {
      // Already loaded?
      if (sources.some(s => s.path === path)) return;
      if (sources.length >= MAX_SOURCES) {
        error = `Maximum ${MAX_SOURCES} sources allowed.`;
        return;
      }

      try {
        const result = await readFile(path);
        const title = result.metadata.title || result.metadata.name.replace(/\.(md|markdown)$/i, '');
        const preview = result.content.replace(/^---[\s\S]*?---\n?/, '').trim().slice(0, 60);
        const content = result.content;

        sources = [...sources, { path, title, preview, content }];
        error = null;
      } catch (err) {
        error = `Failed to load source: ${path}`;
      }
    },

    removeSource(path: string) {
      sources = sources.filter(s => s.path !== path);
    },

    async send(content: string) {
      if (streaming) return;
      if (!provider) {
        // Try to sync from settings
        const settings = getSettings();
        if (settings.aiApiKey && settings.aiBaseUrl && settings.aiModel) {
          provider = {
            id: settings.aiProviderId || 'custom',
            name: 'Custom',
            baseUrl: settings.aiBaseUrl,
            apiKey: settings.aiApiKey,
            model: settings.aiModel,
          };
        } else {
          error = 'No AI provider configured. Open Settings > AI to set one up.';
          return;
        }
      }

      error = null;

      // Add user message
      messages = [...messages, {
        role: 'user',
        content,
        timestamp: Date.now(),
      }];

      // Build system prompt with context
      const contextBlock = buildContextBlock();
      const systemParts: string[] = [RESEARCH_SYSTEM_PROMPT];
      if (contextBlock) {
        systemParts.push(contextBlock);
      } else {
        systemParts.push('No notes have been loaded yet. Ask the user to add notes as sources before asking questions.');
      }
      const fullSystemPrompt = systemParts.join('\n\n');

      // Add empty assistant message for streaming
      messages = [...messages, {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true,
      }];

      streaming = true;

      try {
        const apiMessages = messages
          .filter(m => !(m.role === 'assistant' && m.streaming && !m.content))
          .map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          }));

        await aiChat({
          provider: provider!,
          messages: apiMessages,
          systemPrompt: fullSystemPrompt,
        });
      } catch (err) {
        const { errorMessage: errMsg } = await import('$lib/utils/errors');
        error = errMsg(err);
        streaming = false;
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          messages = messages.slice(0, -1);
        }
        return;
      }

      await waitForStreamEnd();
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

    clearAll() {
      messages = [];
      sources = [];
      error = null;
      streaming = false;
    },
  };
}
