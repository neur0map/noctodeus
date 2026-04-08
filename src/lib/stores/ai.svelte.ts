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

function buildSystemPrompt(userPrompt: string, tools: McpTool[]): string {
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

  const toolLines = tools.map((t) => {
    let line = `Tool: ${t.name}`;
    if (t.description) line += `\nDescription: ${t.description}`;
    if (t.inputSchema) {
      const schema = typeof t.inputSchema === 'string'
        ? t.inputSchema
        : JSON.stringify(t.inputSchema);
      line += `\nArguments: ${schema}`;
    }
    return line;
  }).join('\n\n');

  return [
    'You have access to external tools via MCP (Model Context Protocol) servers running on the user\'s machine.',
    'These tools are already connected and ready to use.',
    '',
    'Available tools:',
    '',
    toolLines,
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

      // Determine available MCP tools
      const mcp = getMcpState();
      const availableTools = mcp.tools;

      // Build the full system prompt with identity, context, and tools
      let fullSystemPrompt = buildSystemPrompt(systemPrompt ?? '', availableTools);

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

      // Execute each tool call
      for (const call of toolCalls) {
        const serverName = findServerForTool(call.name);

        // Add tool message placeholder (loading)
        const toolMsgIdx = messages.length;
        messages = [...messages, {
          role: 'tool' as const,
          content: '',
          toolCallId: call.name,
          toolCalls: { name: call.name, arguments: call.arguments, loading: true, error: null },
          timestamp: Date.now(),
        }];

        if (!serverName) {
          // Tool not found in any server
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
