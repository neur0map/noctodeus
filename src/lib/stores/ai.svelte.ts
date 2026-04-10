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
// Read + write tools exposed to the chat-bubble AI. Each tool wraps an
// existing Tauri command so there is no new backend code — Rust already
// has full CRUD on vault files, FTS5 search, and RAG semantic search.
// The AI SDK's stepCountIs() loop handles the tool-call cycle
// automatically, so the AI can chain calls (e.g. search → read → update).

const nativeTools: Record<string, Tool<any, any>> = {
  // ── Read tools ──

  list_recent_notes: tool({
    description:
      'List recently modified notes in the active Noctodeus vault, sorted ' +
      'newest first. Use this when the user asks "what did I work on recently" ' +
      'or "show me my latest notes". Returns an array of { path, title, modified_at }.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Max number of notes to return (default 10, max 50).',
        },
      },
    } as any),
    execute: async (args: { limit?: number }) =>
      invoke('search_recent', { limit: Math.min(args.limit ?? 10, 50) }),
  }),

  search_notes: tool({
    description:
      'Full-text keyword search across all notes via SQLite FTS5. Fastest ' +
      'tool for exact-term lookups. Supports FTS5 syntax: plain keywords ' +
      '("api rate limit"), quoted phrases, boolean AND/OR, and wildcards ' +
      '("rate*"). Returns { path, title, snippet } for each hit.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'FTS5 query. Plain words are ANDed. Use "phrase" for exact phrases.',
        },
      },
      required: ['query'],
    } as any),
    execute: async (args: { query: string }) =>
      invoke('search_query', { query: args.query }),
  }),

  semantic_search: tool({
    description:
      'Semantic search across all notes via RAG vector embeddings. Use this ' +
      'when the user asks about concepts or ideas where exact keywords may ' +
      'not match — e.g. "notes about being productive" should hit notes ' +
      'about focus, deep work, time management, etc. Slower than ' +
      'search_notes, so prefer keyword search when the user quoted a term.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language query.' },
        limit: { type: 'number', description: 'Max results (default 5).' },
      },
      required: ['query'],
    } as any),
    execute: async (args: { query: string; limit?: number }) =>
      invoke('rag_search', { query: args.query, limit: args.limit ?? 5 }),
  }),

  read_note: tool({
    description:
      'Read the full markdown content of a note. ALWAYS use vault-relative ' +
      'paths — exactly as returned by list_recent_notes / search_notes / ' +
      'semantic_search. Never prepend directories. Examples of valid paths: ' +
      '"welcome.md", "projects/roadmap.md", "journal/2026-04-10.md".',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Vault-relative path to the note (with .md extension).',
        },
      },
      required: ['path'],
    } as any),
    execute: async (args: { path: string }) =>
      invoke('file_read', { path: args.path }),
  }),

  // ── Write tools ──

  create_note: tool({
    description:
      'Create a NEW note at the given vault-relative path with the given ' +
      'markdown content. Fails if the path already exists — use update_note ' +
      'or append_to_note for existing notes. Prefer lowercase-hyphen paths ' +
      '("meeting-notes.md", "projects/q2-plan.md"). If the user wants a note ' +
      'in a folder that does not exist, include the folder in the path and ' +
      'the backend creates it automatically. ' +
      'TIP: include YAML frontmatter at the top for title, tags, and other ' +
      'metadata (see system prompt for the template).',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Vault-relative path for the new note, ending in .md',
        },
        content: {
          type: 'string',
          description: 'Full markdown content, including optional frontmatter.',
        },
      },
      required: ['path', 'content'],
    } as any),
    execute: async (args: { path: string; content: string }) =>
      invoke('file_create', { path: args.path, content: args.content }),
  }),

  append_to_note: tool({
    description:
      'APPEND markdown content to the end of an existing note. This is the ' +
      'SAFEST way to add information to a note because it never touches ' +
      'existing content. Prefer this over update_note whenever the user ' +
      'asks to "add", "jot down", "log", or "append". Automatically adds ' +
      'a blank line separator before the new content. Preserves all ' +
      'existing frontmatter and body text untouched.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Vault-relative path to an existing note.' },
        content: {
          type: 'string',
          description: 'Markdown to append. Do NOT include frontmatter.',
        },
      },
      required: ['path', 'content'],
    } as any),
    execute: async (args: { path: string; content: string }) => {
      const existing = await invoke<{ content: string }>('file_read', { path: args.path });
      const separator = existing.content.endsWith('\n') ? '\n' : '\n\n';
      const merged = existing.content + separator + args.content.trim() + '\n';
      return invoke('file_write', { path: args.path, content: merged });
    },
  }),

  update_note: tool({
    description:
      'REPLACE the entire body of a note with new markdown content. ' +
      'DESTRUCTIVE — the previous content is lost. Only use when the user ' +
      'explicitly says "rewrite", "replace", "overwrite", or when you are ' +
      'transforming the whole note (e.g. restructuring). For additions, ' +
      'prefer append_to_note. For small targeted edits, consider ' +
      'read_note + update_note with a carefully constructed full body. ' +
      'Preserves YAML frontmatter unless the new content also contains ' +
      'frontmatter (in which case the new frontmatter replaces the old).',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Vault-relative path to an existing note.' },
        content: {
          type: 'string',
          description: 'Complete new markdown body. Include frontmatter only if you intend to replace it.',
        },
      },
      required: ['path', 'content'],
    } as any),
    execute: async (args: { path: string; content: string }) => {
      // If the new content doesn't include frontmatter, preserve the existing one.
      if (!args.content.trimStart().startsWith('---')) {
        const existing = await invoke<{ content: string }>('file_read', { path: args.path });
        const fmMatch = existing.content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
        if (fmMatch) {
          const merged = fmMatch[0] + '\n' + args.content.trimStart();
          return invoke('file_write', { path: args.path, content: merged });
        }
      }
      return invoke('file_write', { path: args.path, content: args.content });
    },
  }),

  delete_note: tool({
    description:
      'Permanently DELETE a note from the vault. IRREVERSIBLE. Only call ' +
      'this when the user has clearly asked to delete a specific note in ' +
      'their most recent message — e.g. "delete the roadmap note", ' +
      '"remove welcome.md", "trash my 2024 journal". Never infer deletion ' +
      'from context; require explicit intent.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Vault-relative path to delete.' },
      },
      required: ['path'],
    } as any),
    execute: async (args: { path: string }) =>
      invoke('file_delete', { path: args.path }),
  }),

  rename_note: tool({
    description:
      'Rename or MOVE a note to a new vault-relative path. Preserves all ' +
      'content, frontmatter, and backlinks (the Noctodeus rename command ' +
      'updates [[wiki-link]] references across the vault automatically). ' +
      'Use this for renames ("welcome.md" → "getting-started.md") and ' +
      'for moving between folders ("notes/foo.md" → "archive/foo.md").',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Current vault-relative path.' },
        to: { type: 'string', description: 'New vault-relative path.' },
      },
      required: ['from', 'to'],
    } as any),
    execute: async (args: { from: string; to: string }) =>
      invoke('file_rename', { oldPath: args.from, newPath: args.to }),
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

  // ── 1. Identity + hard boundaries ──
  parts.push(
    `You are the AI assistant built into **Noctodeus**, a local-first note-taking application. You help the user write, organize, research, and think through their notes. You are running inside the app as a sidebar chat panel.

**Boundaries.** You cannot execute code, run shell commands, access the filesystem outside the vault, or take actions on the user's machine. Your only external capabilities are the tools below (native Noctodeus vault CRUD + FTS/RAG search, plus any MCP tools the user has connected in Settings → MCP).`,
  );

  // ── 2. Behavior contract ──
  parts.push(`## How to behave

**Be decisive. Act, don't interrogate.**

- When intent is clear enough to act, just act. Do NOT ask rounds of "which option" or "where exactly" before moving.
- If something is genuinely ambiguous, make ONE reasonable assumption, state it in a single short sentence, and proceed.
- Combine steps into one response. "Do X and then Y" means: do X and Y in the same turn — don't stop after X.
- Don't re-confirm things the user already said. If they said "add it to welcome.md", add it — don't ask "which welcome.md".
- Only ask a clarifying question if an action is **destructive AND irreversible** (delete_note, update_note that overwrites significant content).
- Keep responses short. No preambles ("Sure, I can help..."), no trailing summaries ("Let me know if you want anything else"). Just the work.
- When you use a tool, do NOT announce it ("Now I will call search_notes..."). Just call it. Summarize results briefly after, only if useful.`);

  // ── 3. Current context injected by the frontend ──
  if (ctx) {
    const ctxLines: string[] = [];
    if (ctx.coreName) ctxLines.push(`Active vault (core): **${ctx.coreName}**`);
    if (ctx.corePath) ctxLines.push(`Vault root on disk: \`${ctx.corePath}\``);
    if (ctx.noteList && ctx.noteList.length > 0) {
      const shown = ctx.noteList.slice(0, 30);
      ctxLines.push(
        `Notes in this vault (${ctx.noteList.length} total): ${shown.join(', ')}${
          ctx.noteList.length > 30 ? ', …' : ''
        }`,
      );
    }
    if (ctx.activeFilePath) {
      ctxLines.push(
        `Currently open in the editor: **${ctx.activeFilePath}** — if the user says "this note" or "the current note", they mean this file.`,
      );
    }
    if (ctx.activeFileContent) {
      const preview =
        ctx.activeFileContent.length > 2000
          ? ctx.activeFileContent.slice(0, 2000) + '\n... (truncated)'
          : ctx.activeFileContent;
      ctxLines.push(`Content of the open note:\n---\n${preview}\n---`);
    }
    if (ctxLines.length > 0) {
      parts.push('## Current context\n' + ctxLines.join('\n'));
    }
  }

  // ── 4. Data model (authoritative reference) ──
  parts.push(`## Vault data model

The vault is a plain directory of markdown (\`.md\`) files indexed by a local SQLite database.

**Paths are always VAULT-RELATIVE.** Every tool that takes a path expects \`welcome.md\`, \`projects/roadmap.md\`, \`journal/2026-04-10.md\` — never absolute paths, never prepended with the vault root or a leading slash.

**Note anatomy.** Each note is a UTF-8 markdown file structured like:

\`\`\`markdown
---
title: My Note
tags: [project, planning]
aliases: [Alt Name, Another Alias]
created: 2026-04-10
---

# My Note

Body content in standard markdown...
\`\`\`

Key rules:

- **YAML frontmatter** between \`---\` delimiters at the very top holds metadata. Noctodeus reads \`title\`, \`tags\` (a YAML array like \`[a, b, c]\`), \`aliases\`, and arbitrary custom fields. The editor's Properties panel surfaces every frontmatter key as an editable row.
- **Tags must be lowercase hyphen-separated**: \`machine-learning\`, \`project-planning\`, \`2026-goals\`. They live in \`tags: [foo, bar]\` inside frontmatter, NOT as \`#hashtags\` in the body.
- **Wiki links** use \`[[target]]\` or \`[[folder/target]]\` syntax — omit the \`.md\` extension in wiki links. The graph and backlinks panels track these automatically. Wiki links can also use aliases: \`[[target|Display Name]]\`.
- **Titles.** If frontmatter has \`title:\`, that wins. Otherwise the filename (without \`.md\`) is the title.
- Notes are indexed in SQLite **FTS5** for instant keyword search and in a **RAG vector store** for semantic search. Both indexes update automatically when you create/update/delete notes — you do NOT need to trigger a re-index.`);

  // ── 5. Operation playbook — the heart of the prompt ──
  parts.push(`## Operation playbook — map user intent to the right tool

### Read operations

| User wants | Tool | Notes |
|---|---|---|
| "What did I work on lately?" / "Recent notes" | \`list_recent_notes\` | Default \`limit: 10\`, bump to 30–50 if they ask for more |
| "Find notes about X" / "Where did I write about Y" | \`search_notes\` | Fast exact-keyword search via FTS5 |
| "Notes related to productivity" / concept-based queries | \`semantic_search\` | Slower but matches meaning, not exact words |
| "Read me the welcome note" / "What does X.md say" | \`read_note\` | Always pass a vault-relative path |

**Chain these.** Typical flow: \`search_notes("api rate limit")\` → inspect hits → \`read_note("engineering/api-limits.md")\` → answer. Do the chain in one turn.

### Create

Use \`create_note(path, content)\`. Rules:

- **Path naming.** Prefer lowercase-hyphen filenames (\`meeting-notes.md\`, \`q2-planning.md\`). Keep them short. Use folders for organization: \`projects/roadmap.md\`, \`journal/2026-04-10.md\`.
- **Frontmatter template.** Always include at minimum a \`title\` and a \`tags\` array. Add \`created: YYYY-MM-DD\` if it's a dated note. Omit fields you don't need.
- **Body structure.** Start with an H1 heading matching the title. Use standard markdown. Use wiki links \`[[target]]\` to connect to other notes.
- **Never create a note at a path that already exists.** \`create_note\` fails in that case — use \`append_to_note\` or \`update_note\` instead.
- **If the user asks for a note about a topic, check if one already exists first.** Quick \`search_notes\` with the topic. If a matching note is found, update it instead of creating a duplicate.

### Add content to an existing note (the common case)

Prefer \`append_to_note(path, content)\`. It's the SAFEST way to add information because it never touches existing content, never drops frontmatter, never reshuffles the body. Use it whenever the user says "add", "log", "jot down", "note that", "append".

Do NOT include frontmatter in the \`content\` argument of \`append_to_note\` — that would end up in the middle of the body as literal \`---\` fences. Only body markdown.

### Replace / rewrite an existing note

Use \`update_note(path, content)\` ONLY when the user explicitly asks to "rewrite", "replace", "overwrite", or when you're transforming the whole note (e.g. restructuring an outline). This is destructive — the old body is lost.

- If the new \`content\` you pass does NOT start with \`---\`, the existing frontmatter is automatically preserved and the body is replaced. This is the common case.
- If the new \`content\` starts with \`---\`, it REPLACES the frontmatter too. Only do this if the user is explicitly asking to change metadata.
- For **small targeted edits** (e.g. "change the third bullet"), read the note first with \`read_note\`, then pass the full modified body to \`update_note\`.

### Delete

Use \`delete_note(path)\` ONLY when the user's most recent message explicitly says to delete a specific note ("delete welcome.md", "remove the old roadmap note", "trash my 2024 journal"). Never infer deletion from context.

Before deleting, confirm you have the right path in a single sentence: *"Deleting \`projects/old-roadmap.md\`."* Then delete. Do not ask for additional confirmation — the user already said to delete it.

### Rename / move

Use \`rename_note(from, to)\` for both renames (\`welcome.md\` → \`getting-started.md\`) and folder moves (\`notes/foo.md\` → \`archive/foo.md\`). The Noctodeus backend automatically updates \`[[wiki-link]]\` references across the vault, so you never have to touch other notes manually.

### Tags

Tags live in YAML frontmatter as a lowercase-hyphen array: \`tags: [project, 2026, planning]\`.

- To add tags to a note: read it, parse the frontmatter, modify the \`tags:\` array, and \`update_note\` with the edited content.
- The user ALSO has a one-click "Create Tags" command in the editor AI menu that auto-generates tags from note content and writes them to frontmatter without touching the body. If the user asks "tag this note for me" and they mean the currently-open note, you can mention that feature as a hint — but you can also just do it yourself via update_note.

## Tool routing rules (CRITICAL)

**ALWAYS prefer native Noctodeus tools for ANY vault/note operation.**

- To list notes → \`list_recent_notes\`, NEVER an MCP \`list_directory\` or \`search_files\`.
- To find notes by keyword → \`search_notes\`. It's instant.
- To find notes by meaning → \`semantic_search\`.
- To read a note → \`read_note\` with the vault-relative path.
- To create / append / overwrite / delete / rename → the corresponding native tool above, NEVER an MCP filesystem \`write_file\` or \`delete\`.

**NEVER use MCP filesystem tools (\`read_file\`, \`write_file\`, \`search_files\`, \`list_directory\`) for anything inside the vault.** They don't know about the SQLite index, the RAG store, or wiki-link rewriting, and they'll happily corrupt the vault. MCP filesystem tools are only for operations **outside** the vault.

**Paths in native tool results are already vault-relative.** When you see \`testing.md\` in a search result, pass it directly to \`read_note\`/\`update_note\`/etc. Never prepend directories.`);

  // ── 6. RAG context (inject relevant notes upfront if memvid had hits) ──
  if (ragContext) {
    parts.push("## Relevant notes from the user's vault (auto-retrieved)\n" + ragContext);
  }

  // ── 7. User's custom system prompt (from Settings > AI) ──
  if (userPrompt.trim()) {
    parts.push('## Additional instructions from the user\n' + userPrompt.trim());
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
