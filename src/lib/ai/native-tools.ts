/**
 * Native Noctodeus tools — directly call Tauri commands instead of MCP.
 * Much faster than filesystem MCP because they use the indexed SQLite
 * database and RAG embeddings.
 */

import { invoke } from '@tauri-apps/api/core';

// Local shape matching what the AI store expects (same as McpTool)
interface AiTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface NativeToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

/**
 * Native tool definitions — these are injected into the AI's tool list
 * alongside any MCP tools the user has connected.
 */
export const NATIVE_TOOLS: NativeToolDef[] = [
  {
    name: 'list_recent_notes',
    description: 'List the most recently modified notes in the vault. Fast — uses the SQLite index. Use this when the user asks about "recent notes", "last modified", "what I worked on today", etc.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max number of notes to return (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'search_notes',
    description: 'Full-text search across all notes in the vault. Fast — uses SQLite FTS index. Use this when the user asks to find notes containing specific keywords or phrases.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'semantic_search',
    description: 'Semantic similarity search across notes using embeddings. Use this for conceptual or meaning-based queries (e.g. "notes about project planning" or "anything related to machine learning"). Slower than search_notes but understands meaning.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The semantic query' },
        limit: { type: 'number', description: 'Max number of results (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_note',
    description: 'Read the full content of a note by its path. Use this AFTER finding a note via list_recent_notes, search_notes, or semantic_search to read its contents.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The note path (e.g. "projects/roadmap.md")' },
      },
      required: ['path'],
    },
  },
];

/**
 * Convert native tools to the McpTool shape expected by the AI store.
 * We use a synthetic server name "noctodeus" to distinguish them.
 */
export function getNativeToolsAsMcp(): AiTool[] {
  return NATIVE_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

/**
 * Execute a native tool call. Returns the result as a string (for display)
 * or throws on error.
 */
export async function executeNativeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'list_recent_notes': {
      const limit = typeof args.limit === 'number' ? args.limit : 10;
      const results = await invoke<any[]>('search_recent', { limit });
      if (!results?.length) return 'No recent notes found.';
      return results
        .map((f) => {
          const modified = f.modified_at ? new Date(f.modified_at * 1000).toLocaleString() : '';
          return `- ${f.path}${f.title ? ` ("${f.title}")` : ''}${modified ? ` — ${modified}` : ''}`;
        })
        .join('\n');
    }

    case 'search_notes': {
      const query = String(args.query ?? '');
      if (!query) throw new Error('query is required');
      const results = await invoke<any[]>('search_query', { text: query, scope: null });
      if (!results?.length) return `No notes match "${query}".`;
      return results
        .slice(0, 20)
        .map((hit) => `- ${hit.path}${hit.title ? ` ("${hit.title}")` : ''}${hit.snippet ? `\n  ${hit.snippet}` : ''}`)
        .join('\n');
    }

    case 'semantic_search': {
      const query = String(args.query ?? '');
      const limit = typeof args.limit === 'number' ? args.limit : 5;
      if (!query) throw new Error('query is required');

      // rag_search needs the core path — get it from the core store
      const { getCoreState } = await import('$lib/stores/core.svelte');
      const coreState = getCoreState();
      const corePath = coreState.activeCore?.path;
      if (!corePath) return 'No active core — cannot perform semantic search.';

      const results = await invoke<any[]>('rag_search', {
        query,
        corePath,
        topK: limit,
      });
      if (!results?.length) return `No semantically similar notes for "${query}".`;
      return results
        .map((r: any) => `- ${r.path ?? '(unknown)'}${r.score ? ` (score: ${r.score.toFixed(2)})` : ''}${r.snippet ? `\n  ${r.snippet}` : ''}`)
        .join('\n');
    }

    case 'read_note': {
      const path = String(args.path ?? '');
      if (!path) throw new Error('path is required');
      const result = await invoke<{ content: string; metadata: any }>('file_read', { path });
      const content = result.content ?? '';
      // Truncate very long notes to avoid blowing context
      if (content.length > 8000) {
        return content.slice(0, 8000) + '\n\n[... truncated — note is longer than 8000 chars ...]';
      }
      return content || '(note is empty)';
    }

    default:
      throw new Error(`Unknown native tool: ${name}`);
  }
}

export function isNativeTool(name: string): boolean {
  return NATIVE_TOOLS.some((t) => t.name === name);
}
