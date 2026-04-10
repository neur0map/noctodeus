import type { AiMessage, AiProvider } from '$lib/ai/types';
import { readFile } from '$lib/bridge/commands';
import { getAIModel, getMaxTokens } from '$lib/ai/client';
import { streamText, convertToModelMessages, type UIMessage } from 'ai';

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
let abortController: AbortController | null = null;

function buildContextBlock(): string {
  if (sources.length === 0) return '';

  const parts = sources.map((src, i) => {
    const truncated =
      src.content.length > MAX_CHARS_PER_SOURCE
        ? src.content.slice(0, MAX_CHARS_PER_SOURCE) + '\n... (truncated)'
        : src.content;
    return `--- Note ${i + 1}: "${src.title}" (${src.path}) ---\n${truncated}`;
  });

  return `The user has loaded ${sources.length} note(s) for analysis:\n\n${parts.join('\n\n')}`;
}

async function toModelMessages(msgs: AiMessage[]) {
  const ui: UIMessage[] = msgs
    .filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.streaming))
    .map((m, i) => ({
      id: String(i),
      role: m.role as 'user' | 'assistant',
      parts: [{ type: 'text', text: m.content }],
    }));
  return await convertToModelMessages(ui);
}

export function getResearchState() {
  return {
    get sources() {
      return sources;
    },
    get messages() {
      return messages;
    },
    get streaming() {
      return streaming;
    },
    get error() {
      return error;
    },
    get provider() {
      return provider;
    },

    setProvider(p: AiProvider) {
      provider = p;
    },

    async addSource(path: string) {
      if (sources.some((s) => s.path === path)) return;
      if (sources.length >= MAX_SOURCES) {
        error = `Maximum ${MAX_SOURCES} sources allowed.`;
        return;
      }

      try {
        const result = await readFile(path);
        const title =
          result.metadata.title || result.metadata.name.replace(/\.(md|markdown)$/i, '');
        const preview = result.content.replace(/^---[\s\S]*?---\n?/, '').trim().slice(0, 60);
        const content = result.content;

        sources = [...sources, { path, title, preview, content }];
        error = null;
      } catch (err) {
        error = `Failed to load source: ${path}`;
      }
    },

    removeSource(path: string) {
      sources = sources.filter((s) => s.path !== path);
    },

    async send(content: string) {
      if (streaming) return;

      const model = getAIModel();
      if (!model) {
        error = 'No AI provider configured. Open Settings → AI to set one up.';
        return;
      }
      error = null;

      messages = [
        ...messages,
        {
          role: 'user',
          content,
          timestamp: Date.now(),
        },
      ];

      const contextBlock = buildContextBlock();
      const systemParts: string[] = [RESEARCH_SYSTEM_PROMPT];
      if (contextBlock) {
        systemParts.push(contextBlock);
      } else {
        systemParts.push(
          'No notes have been loaded yet. Ask the user to add notes as sources before asking questions.',
        );
      }
      const fullSystemPrompt = systemParts.join('\n\n');

      const modelMessages = await toModelMessages(messages);

      const assistantIndex = messages.length;
      messages = [
        ...messages,
        {
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          streaming: true,
        },
      ];

      streaming = true;
      abortController = new AbortController();

      try {
        const result = streamText({
          model,
          system: fullSystemPrompt,
          messages: modelMessages,
          maxOutputTokens: getMaxTokens(),
          abortSignal: abortController.signal,
        });

        for await (const chunk of result.textStream) {
          if (abortController.signal.aborted) break;
          const current = messages[assistantIndex];
          if (current && current.role === 'assistant') {
            messages[assistantIndex] = { ...current, content: current.content + chunk };
            messages = [...messages];
          }
        }
      } catch (err) {
        const { errorMessage: errMsg } = await import('$lib/utils/errors');
        error = errMsg(err);
      } finally {
        const final = messages[assistantIndex];
        if (final && final.role === 'assistant') {
          messages[assistantIndex] = { ...final, streaming: false };
          messages = [...messages];
        }
        streaming = false;
        abortController = null;
      }
    },

    async cancel() {
      abortController?.abort();
      abortController = null;
      streaming = false;
    },

    clear() {
      messages = [];
      error = null;
      streaming = false;
      abortController?.abort();
      abortController = null;
    },

    clearAll() {
      messages = [];
      sources = [];
      error = null;
      streaming = false;
      abortController?.abort();
      abortController = null;
    },
  };
}
