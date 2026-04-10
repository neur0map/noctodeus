import type { AiMessage, AiProvider, StreamToken } from '$lib/ai/types';
import { aiChat, aiChatCancel } from '$lib/bridge/ai';
import { mcpCallTool } from '$lib/bridge/mcp';
import type { McpTool } from '$lib/bridge/mcp';
import { getMcpState } from '$lib/stores/mcp.svelte';
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

// ── Tool-call helpers ──

const TOOL_CALL_RE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;

interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

function parseToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  let match: RegExpExecArray | null;
  TOOL_CALL_RE.lastIndex = 0;
  while ((match = TOOL_CALL_RE.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed.name === 'string') {
        calls.push({
          name: parsed.name,
          arguments: parsed.arguments ?? {},
        });
      }
    } catch {
      // Malformed JSON in tool_call — skip
    }
  }
  return calls;
}

export interface AiContext {
  coreName?: string;
  corePath?: string;
  activeFilePath?: string;
  activeFileContent?: string;
  noteList?: string[]; // top-level note paths for awareness
}

function buildSystemPrompt(userPrompt: string, tools: McpTool[], ctx?: AiContext, ragContext?: string): string {
  const parts: string[] = [];

  // Identity + boundaries
  parts.push(
    'You are the AI assistant built into Noctodeus, a local-first note-taking application. ' +
    'You help users write, organize, research, and think through their notes. ' +
    'You are running inside the app as a sidebar chat panel.\n\n' +
    'Boundaries: You cannot execute code, run shell commands, access the filesystem, ' +
    'or take any actions on the user\'s machine. You can only read and write text in this conversation.' +
    (tools.length > 0
      ? ' The only exception is the MCP tools listed below, which the user has explicitly connected.'
      : ' If the user wants you to have external capabilities, they can connect MCP tool servers in Settings > MCP.')
  );

  // Core and note context
  if (ctx) {
    const ctxLines: string[] = [];
    if (ctx.coreName) {
      ctxLines.push(`The user's active vault (core) is named "${ctx.coreName}".`);
    }
    if (ctx.corePath) {
      ctxLines.push(`Vault root path on disk: ${ctx.corePath}`);
    }
    if (ctx.noteList && ctx.noteList.length > 0) {
      const shown = ctx.noteList.slice(0, 30);
      ctxLines.push(`Notes in this vault (${ctx.noteList.length} total): ${shown.join(', ')}${ctx.noteList.length > 30 ? ', ...' : ''}`);
    }
    if (ctx.activeFilePath) {
      ctxLines.push(`The user currently has "${ctx.activeFilePath}" open in the editor.`);
    }
    if (ctx.activeFileContent) {
      const preview = ctx.activeFileContent.length > 2000
        ? ctx.activeFileContent.slice(0, 2000) + '\n... (truncated)'
        : ctx.activeFileContent;
      ctxLines.push(`Content of the open note:\n---\n${preview}\n---`);
    }
    if (ctxLines.length > 0) {
      parts.push('Current context:\n' + ctxLines.join('\n'));
    }
  }

  // Noctodeus data model — critical for the AI to build correct queries
  parts.push(`## Noctodeus data model

The vault is a directory of markdown (.md) files with an indexed SQLite database for fast queries.

Key facts:
- **All note paths are VAULT-RELATIVE** (e.g. "welcome.md", "projects/roadmap.md", "journal/2026-04-10.md"). Never absolute paths.
- The native tools (list_recent_notes, search_notes, semantic_search, read_note) use these vault-relative paths.
- Each note has: path (string), title (from frontmatter or filename), content (markdown body), modified_at (unix seconds), aliases (optional array of alternative names).
- Notes are indexed in SQLite with FTS (full-text search) for instant keyword queries.
- Notes are also embedded in a RAG vector store for semantic search.
- Wiki links use double-bracket syntax: [[target-note]] or [[folder/note]]. These create a graph of connections between notes.

## Tool routing rules (CRITICAL)

You have TWO kinds of tools: native Noctodeus tools and (possibly) MCP tools.

**ALWAYS prefer native Noctodeus tools for ANY vault/note operation:**
- To list notes → use \`list_recent_notes\`, NEVER use MCP filesystem \`list_directory\` or \`search_files\`
- To find notes by keyword → use \`search_notes\` (SQLite FTS, instant)
- To find notes by meaning → use \`semantic_search\` (RAG embeddings)
- To read a note → use \`read_note\` with a vault-relative path like "welcome.md"

**NEVER use MCP filesystem tools (read_file, search_files, list_directory) for notes.** They don't know about the vault structure and will fail or return wrong paths.

**Paths in native tool results are already vault-relative.** When you see a result like "testing.md", pass it directly to \`read_note\` — do NOT prepend any directory.`);


  // RAG context from memvid search
  if (ragContext) {
    parts.push('Relevant notes from the user\'s vault:\n' + ragContext);
  }

  // User's custom system prompt (from settings)
  if (userPrompt.trim()) {
    parts.push(userPrompt.trim());
  }

  // MCP tools
  if (tools.length > 0) {
    parts.push(buildToolSystemSuffix(tools));
  }

  return parts.join('\n\n');
}

function buildToolSystemSuffix(tools: McpTool[]): string {
  if (tools.length === 0) return '';

  const NATIVE_TOOL_NAMES = new Set([
    'list_recent_notes',
    'search_notes',
    'semantic_search',
    'read_note',
  ]);

  const nativeTools = tools.filter((t) => NATIVE_TOOL_NAMES.has(t.name));
  const mcpTools = tools.filter((t) => !NATIVE_TOOL_NAMES.has(t.name));

  const formatTool = (t: McpTool, prefix: string) => {
    let line = `${prefix} ${t.name}`;
    if (t.description) line += `\nDescription: ${t.description}`;
    if (t.inputSchema) {
      const schema = typeof t.inputSchema === 'string'
        ? t.inputSchema
        : JSON.stringify(t.inputSchema);
      line += `\nArguments: ${schema}`;
    }
    return line;
  };

  const sections: string[] = [];

  if (nativeTools.length > 0) {
    sections.push(
      '## Native Noctodeus tools (PREFERRED — use these for all vault operations)',
      '',
      nativeTools.map((t) => formatTool(t, 'Tool:')).join('\n\n'),
    );
  }

  if (mcpTools.length > 0) {
    sections.push(
      '## MCP tools (user-connected, use only for external operations NOT related to the vault)',
      '',
      mcpTools.map((t) => formatTool(t, 'Tool:')).join('\n\n'),
    );
  }

  return [
    'You have access to tools you can call by writing <tool_call> XML blocks.',
    '',
    sections.join('\n\n'),
    '',
    'To use a tool, include this in your response:',
    '<tool_call>',
    '{"name": "tool_name", "arguments": {...}}',
    '</tool_call>',
    '',
    'You may use multiple tools in one response. Wait for results before drawing conclusions.',
    'If the user asks about MCP or tools, explain which tools you currently have access to.',
  ].join('\n');
}

/** Find which server owns a tool by name */
function findServerForTool(toolName: string): string | null {
  const mcp = getMcpState();
  for (const server of mcp.servers) {
    if (server.tools.some((t) => t.name === toolName)) {
      return server.name;
    }
  }
  return null;
}

// ── Max tool-call loop depth to prevent infinite loops ──
const MAX_TOOL_ROUNDS = 10;

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

    async send(content: string, systemPrompt?: string, context?: AiContext) {
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

      // Determine available tools: native Noctodeus tools + any MCP tools
      const mcp = getMcpState();
      const { getNativeToolsAsMcp } = await import('$lib/ai/native-tools');
      const availableTools = [...getNativeToolsAsMcp(), ...mcp.tools];

      // Fetch RAG context from memvid before building system prompt
      let noteContext = '';
      if (context?.corePath) {
        try {
          const { ragContext: fetchRagContext } = await import('$lib/bridge/rag');
          noteContext = await fetchRagContext(content, context.corePath, 2000);
        } catch {
          // RAG not available
        }
      }

      // Build the full system prompt with identity, context, RAG, and tools
      let fullSystemPrompt = buildSystemPrompt(systemPrompt ?? '', availableTools, context, noteContext);

      await this._sendRound(fullSystemPrompt, availableTools, 0);
    },

    /** Internal: send one round and handle tool calls in a loop */
    async _sendRound(systemPrompt: string, availableTools: McpTool[], depth: number) {
      if (depth >= MAX_TOOL_ROUNDS) {
        error = 'Tool call loop limit reached. The AI made too many consecutive tool calls.';
        return;
      }

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
        // Convert 'tool' role to 'user' since we use prompt-based tool calling,
        // not OpenAI's native function calling format
        const apiMessages = messages
          .filter(m => !(m.role === 'assistant' && m.streaming && !m.content))
          .map(m => ({
            role: m.role === 'tool' ? 'user' : m.role,
            content: m.role === 'tool'
              ? `[Tool result for ${m.toolCallId ?? 'unknown'}]:\n${m.content}`
              : m.content,
          }));

        await aiChat({
          provider: provider!,
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
        return;
      }

      // After streaming completes, check for tool calls in the assistant's response
      // Wait briefly for the streaming done event to fire
      await waitForStreamEnd();

      const lastMsg = messages[messages.length - 1];
      if (!lastMsg || lastMsg.role !== 'assistant') return;

      const toolCalls = availableTools.length > 0
        ? parseToolCalls(lastMsg.content)
        : [];

      if (toolCalls.length === 0) return;

      const { isNativeTool, executeNativeTool } = await import('$lib/ai/native-tools');

      // Execute each tool call
      for (const call of toolCalls) {
        // Add tool message placeholder (loading)
        const toolMsgIdx = messages.length;
        messages = [...messages, {
          role: 'tool' as const,
          content: '',
          toolCallId: call.name,
          toolCalls: { name: call.name, arguments: call.arguments, loading: true, error: null },
          timestamp: Date.now(),
        }];

        // Native Noctodeus tool — call Tauri command directly
        if (isNativeTool(call.name)) {
          try {
            const resultText = await executeNativeTool(call.name, call.arguments);
            messages[toolMsgIdx] = {
              ...messages[toolMsgIdx],
              content: resultText,
              toolCalls: {
                name: call.name,
                arguments: call.arguments,
                loading: false,
                error: null,
                result: resultText,
              },
            };
          } catch (err: any) {
            const errText = err?.message || String(err);
            messages[toolMsgIdx] = {
              ...messages[toolMsgIdx],
              content: `Error: ${errText}`,
              toolCalls: { name: call.name, arguments: call.arguments, loading: false, error: errText },
            };
          }
          continue;
        }

        // MCP tool — route to the appropriate server
        const serverName = findServerForTool(call.name);
        if (!serverName) {
          messages[toolMsgIdx] = {
            ...messages[toolMsgIdx],
            content: `Error: No server found for tool "${call.name}"`,
            toolCalls: { name: call.name, arguments: call.arguments, loading: false, error: `No server found for tool "${call.name}"` },
          };
          continue;
        }

        try {
          const result = await mcpCallTool(serverName, call.name, call.arguments);
          const resultText = result.content
            .map((c) => c.text ?? '')
            .filter(Boolean)
            .join('\n');

          messages[toolMsgIdx] = {
            ...messages[toolMsgIdx],
            content: result.isError ? `Error: ${resultText}` : resultText,
            toolCalls: {
              name: call.name,
              arguments: call.arguments,
              loading: false,
              error: result.isError ? resultText : null,
              result: result.isError ? null : resultText,
            },
          };
        } catch (err: any) {
          const errText = err?.message || String(err);
          messages[toolMsgIdx] = {
            ...messages[toolMsgIdx],
            content: `Error: ${errText}`,
            toolCalls: { name: call.name, arguments: call.arguments, loading: false, error: errText },
          };
        }
      }

      // Re-send conversation to let AI process tool results
      await this._sendRound(systemPrompt, availableTools, depth + 1);
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
