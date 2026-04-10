import type { AiMessage, AiProvider } from '$lib/ai/types';
import type { McpTool } from '$lib/bridge/mcp';
import { mcpCallTool } from '$lib/bridge/mcp';
import { getMcpState } from '$lib/stores/mcp.svelte';
import { getAIModel, getMaxTokens } from '$lib/ai/client';
import { invoke } from '@tauri-apps/api/core';
import {
  streamText,
  tool,
  jsonSchema,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
  type Tool,
  type ToolSet,
} from 'ai';

// ── Reactive state ───────────────────────────────────────────────────

let messages = $state<AiMessage[]>([]);
let streaming = $state(false);
let provider = $state<AiProvider | null>(null);
let error = $state<string | null>(null);
let abortController: AbortController | null = null;

// ── Context types ────────────────────────────────────────────────────

export interface AiContext {
  coreName?: string;
  corePath?: string;
  activeFilePath?: string;
  activeFileContent?: string;
  noteList?: string[];
}

// ── Native tools (call Rust Tauri commands) ──────────────────────────
//
// These are the SAME commands the old native-tools.ts used to wrap in
// fake-MCP shape — now they're first-class AI SDK tool() definitions.
// The AI SDK maxSteps loop handles the tool-call cycle automatically.

const nativeTools: Record<string, Tool<any, any>> = {
  list_recent_notes: tool({
    description:
      'List recently modified notes in the active Noctodeus vault. ' +
      'Returns an array of { path, title, modified_at }.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Max number of notes to return (default 10).',
        },
      },
    } as any),
    execute: async (args: { limit?: number }) =>
      invoke('search_recent', { limit: args.limit ?? 10 }),
  }),

  search_notes: tool({
    description:
      'Keyword search across all notes in the vault via SQLite FTS5. ' +
      'Returns an array of { path, title, snippet }. Use this for exact-term lookups.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query. Supports FTS5 syntax.',
        },
      },
      required: ['query'],
    } as any),
    execute: async (args: { query: string }) =>
      invoke('search_query', { query: args.query }),
  }),

  semantic_search: tool({
    description:
      'Semantic search across all notes via RAG vector embeddings. ' +
      'Use this for meaning-based queries where exact keywords may not match.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number', description: 'Max results (default 5).' },
      },
      required: ['query'],
    } as any),
    execute: async (args: { query: string; limit?: number }) =>
      invoke('rag_search', { query: args.query, limit: args.limit ?? 5 }),
  }),

  read_note: tool({
    description:
      'Read the full markdown content of a note by its vault-relative path ' +
      '(e.g. "welcome.md" or "projects/roadmap.md"). NOT absolute paths.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Vault-relative path to the note.',
        },
      },
      required: ['path'],
    } as any),
    execute: async (args: { path: string }) =>
      invoke('file_read', { path: args.path }),
  }),
};

// ── MCP tool conversion ──────────────────────────────────────────────

/**
 * Dynamically convert the MCP store's current tool list into AI SDK
 * tool() definitions. Each MCP tool becomes a tool() whose execute
 * routes back into the Rust MCP subprocess bridge.
 */
function mcpToolsAsAISDK(): Record<string, Tool<any, any>> {
  const out: Record<string, Tool<any, any>> = {};
  for (const t of getMcpState().tools) {
    const serverName = findServerForTool(t.name);
    if (!serverName) continue; // orphaned tool, skip
    out[t.name] = tool({
      description: t.description ?? t.name,
      inputSchema: jsonSchema((t.inputSchema ?? { type: 'object' }) as any),
      execute: async (args: unknown) => {
        const result = await mcpCallTool(serverName, t.name, args as Record<string, unknown>);
        const resultText = result.content
          .map((c) => c.text ?? '')
          .filter(Boolean)
          .join('\n');
        return result.isError ? `Error: ${resultText}` : resultText;
      },
    });
  }
  return out;
}

/** Find which MCP server owns a tool by name. */
function findServerForTool(toolName: string): string | null {
  const mcp = getMcpState();
  for (const server of mcp.servers) {
    if (server.tools.some((t) => t.name === toolName)) {
      return server.name;
    }
  }
  return null;
}

// ── System prompt ────────────────────────────────────────────────────

function buildSystemPrompt(
  userPrompt: string,
  ctx?: AiContext,
  ragContext?: string,
): string {
  const parts: string[] = [];

  parts.push(
    'You are the AI assistant built into Noctodeus, a local-first note-taking application. ' +
      'You help users write, organize, research, and think through their notes. ' +
      'You are running inside the app as a sidebar chat panel.\n\n' +
      "Boundaries: You cannot execute code, run shell commands, access the filesystem, " +
      "or take any actions on the user's machine. The only external capabilities you have " +
      'are the tools listed (native Noctodeus vault tools and any MCP tools the user has ' +
      'connected in Settings → MCP).',
  );

  parts.push(`## How to behave

**Be decisive. Act, don't interrogate.**

- When the user's intent is clear enough to act, just do it. Do NOT ask multiple rounds of "which option" or "where exactly" before taking action.
- If something is genuinely ambiguous, make ONE reasonable assumption, state it in a single short sentence, and proceed. Do not enumerate options 1/2/3 unless the user asks.
- Combine steps into one response. "Do X and then Y" means: do X and Y in the same turn — don't stop after X to confirm.
- Don't re-confirm what the user already said. If they said "insert those into the file," insert them. If they said "at the end," append to the end. Trust the instruction.
- Only ask a clarifying question if the action is destructive AND irreversible. For everything else: pick the sensible default and act.
- Keep responses short. No preambles, no trailing summaries. Just the work.`);

  if (ctx) {
    const ctxLines: string[] = [];
    if (ctx.coreName) ctxLines.push(`The user's active vault (core) is named "${ctx.coreName}".`);
    if (ctx.corePath) ctxLines.push(`Vault root path on disk: ${ctx.corePath}`);
    if (ctx.noteList && ctx.noteList.length > 0) {
      const shown = ctx.noteList.slice(0, 30);
      ctxLines.push(
        `Notes in this vault (${ctx.noteList.length} total): ${shown.join(', ')}${
          ctx.noteList.length > 30 ? ', ...' : ''
        }`,
      );
    }
    if (ctx.activeFilePath) {
      ctxLines.push(`The user currently has "${ctx.activeFilePath}" open in the editor.`);
    }
    if (ctx.activeFileContent) {
      const preview =
        ctx.activeFileContent.length > 2000
          ? ctx.activeFileContent.slice(0, 2000) + '\n... (truncated)'
          : ctx.activeFileContent;
      ctxLines.push(`Content of the open note:\n---\n${preview}\n---`);
    }
    if (ctxLines.length > 0) {
      parts.push('Current context:\n' + ctxLines.join('\n'));
    }
  }

  parts.push(`## Noctodeus data model

The vault is a directory of markdown (.md) files with an indexed SQLite database for fast queries.

Key facts:
- **All note paths are VAULT-RELATIVE** (e.g. "welcome.md", "projects/roadmap.md"). Never absolute paths.
- The native tools (list_recent_notes, search_notes, semantic_search, read_note) use these vault-relative paths.
- Each note has: path, title, content (markdown body), modified_at (unix seconds), aliases (optional).
- Notes are indexed in SQLite with FTS5 for instant keyword queries.
- Notes are also embedded in a RAG vector store for semantic search.
- Wiki links use double-bracket syntax: [[target-note]] or [[folder/note]].

## Tool routing rules (CRITICAL)

**ALWAYS prefer native Noctodeus tools for ANY vault/note operation:**
- To list notes → use \`list_recent_notes\`, NEVER use MCP filesystem \`list_directory\` or \`search_files\`
- To find notes by keyword → use \`search_notes\` (SQLite FTS5, instant)
- To find notes by meaning → use \`semantic_search\` (RAG embeddings)
- To read a note → use \`read_note\` with a vault-relative path like "welcome.md"

**NEVER use MCP filesystem tools (read_file, search_files, list_directory) for notes.** They don't know about the vault structure and will fail or return wrong paths.

**Paths in native tool results are already vault-relative.** When you see a result like "testing.md", pass it directly to \`read_note\` — do NOT prepend any directory.`);

  if (ragContext) {
    parts.push("Relevant notes from the user's vault:\n" + ragContext);
  }

  if (userPrompt.trim()) {
    parts.push(userPrompt.trim());
  }

  return parts.join('\n\n');
}

// ── Message conversion ───────────────────────────────────────────────

/**
 * Convert our internal AiMessage history into AI SDK UIMessage format,
 * then to ModelMessages. We skip frontend-only empty streaming assistant
 * placeholders and tool messages (which become part of the tool-step
 * history handled by maxSteps automatically, not re-injected as user
 * messages like the old code did).
 */
async function buildModelMessages(msgs: AiMessage[]) {
  const uiMessages: UIMessage[] = msgs
    .filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.streaming))
    .map((m, i) => ({
      id: String(i),
      role: m.role as 'user' | 'assistant',
      parts: [{ type: 'text', text: m.content }],
    }));
  return await convertToModelMessages(uiMessages);
}

// ── Public store ─────────────────────────────────────────────────────

export function getAiState() {
  return {
    get messages() {
      return messages;
    },
    get streaming() {
      return streaming;
    },
    get provider() {
      return provider;
    },
    get error() {
      return error;
    },

    setProvider(p: AiProvider) {
      provider = p;
    },

    async send(content: string, systemPrompt?: string, context?: AiContext) {
      if (streaming) return;

      const model = getAIModel();
      if (!model) {
        error = 'No AI provider configured. Open Settings → AI to set one up.';
        return;
      }
      error = null;

      // Append the user message
      messages = [
        ...messages,
        {
          role: 'user',
          content,
          timestamp: Date.now(),
        },
      ];

      // Fetch RAG context from memvid before building the system prompt
      let noteContext = '';
      if (context?.corePath) {
        try {
          const { ragContext: fetchRagContext } = await import('$lib/bridge/rag');
          noteContext = await fetchRagContext(content, context.corePath, 2000);
        } catch {
          // RAG not available — proceed without it
        }
      }

      const fullSystemPrompt = buildSystemPrompt(systemPrompt ?? '', context, noteContext);

      // Build the model-compatible message list from our current transcript
      // (BEFORE appending the empty assistant streaming placeholder).
      const modelMessages = await buildModelMessages(messages);

      // Append an empty assistant placeholder that we'll fill as text chunks arrive
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

      const tools: ToolSet = {
        ...nativeTools,
        ...mcpToolsAsAISDK(),
      };

      try {
        const result = streamText({
          model,
          system: fullSystemPrompt,
          messages: modelMessages,
          tools,
          stopWhen: stepCountIs(10),
          maxOutputTokens: getMaxTokens(),
          abortSignal: abortController.signal,
        });

        for await (const part of result.fullStream) {
          if (abortController.signal.aborted) break;

          if (part.type === 'text-delta') {
            // Append streaming text delta to the current assistant message
            const current = messages[assistantIndex];
            if (current && current.role === 'assistant') {
              messages[assistantIndex] = {
                ...current,
                content: current.content + part.text,
              };
              messages = [...messages];
            }
            continue;
          }

          if (part.type === 'tool-call') {
            // Record the tool call as its own message so the UI can show
            // it in the "Used N tools" grouped card.
            messages = [
              ...messages,
              {
                role: 'tool',
                content: '',
                toolCallId: part.toolCallId,
                toolCalls: {
                  name: part.toolName,
                  arguments: (part as any).input ?? {},
                  loading: true,
                  error: null,
                },
                timestamp: Date.now(),
              },
            ];
            continue;
          }

          if (part.type === 'tool-result') {
            // Fill in the result on the matching tool message (by id)
            const output = (part as any).output;
            const resultText =
              typeof output === 'string' ? output : JSON.stringify(output);
            const idx = messages.findIndex(
              (m) => m.role === 'tool' && m.toolCallId === part.toolCallId,
            );
            if (idx >= 0) {
              const existing = messages[idx];
              messages[idx] = {
                ...existing,
                content: resultText,
                toolCalls: {
                  ...(existing.toolCalls as Record<string, unknown>),
                  loading: false,
                  error: null,
                  result: resultText,
                },
              };
              messages = [...messages];
            }
            continue;
          }

          if (part.type === 'tool-error') {
            const errText =
              (part as any).error instanceof Error
                ? (part as any).error.message
                : String((part as any).error);
            const idx = messages.findIndex(
              (m) => m.role === 'tool' && m.toolCallId === part.toolCallId,
            );
            if (idx >= 0) {
              const existing = messages[idx];
              messages[idx] = {
                ...existing,
                content: `Error: ${errText}`,
                toolCalls: {
                  ...(existing.toolCalls as Record<string, unknown>),
                  loading: false,
                  error: errText,
                },
              };
              messages = [...messages];
            }
            continue;
          }

          if (part.type === 'error') {
            const errText =
              (part as any).error instanceof Error
                ? (part as any).error.message
                : String((part as any).error);
            error = errText;
            continue;
          }

          // 'finish' / 'start' / 'text-start' / 'text-end' / other chunks —
          // nothing to do for now.
        }
      } catch (err) {
        const { errorMessage: errMsg } = await import('$lib/utils/errors');
        error = errMsg(err);
      } finally {
        // Finalize the assistant message as no longer streaming
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
  };
}
