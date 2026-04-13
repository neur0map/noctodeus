import type { AiMessage } from '$lib/ai/types';
import { getAIModel, getMaxTokens } from '$lib/ai/client';
import { getSettings } from '$lib/stores/settings.svelte';
import { streamText, generateText, convertToModelMessages, type UIMessage } from 'ai';
import {
  calculateBudget,
  buildSourceContext,
  trimHistory,
  type ResearchSourceInput,
} from '$lib/ai/context-scaling';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SourceType = 'note' | 'url' | 'text';

export interface SessionInfo {
  id: string;
  title: string;
  sourceCount: number;
  messageCount: number;
  updatedAt: number;
}

export interface ResearchSource {
  id: string;
  type: SourceType;
  title: string;
  citationId: string;
  /** vault path for notes, URL for urls, empty string for pasted text */
  origin: string;
  /** null means not yet loaded (lazy) */
  content: string | null;
  loading?: boolean;
  error?: string;
  addedAt: number;
}

// ---------------------------------------------------------------------------
// Module-level $state
// ---------------------------------------------------------------------------

let sources = $state<ResearchSource[]>([]);
let messages = $state<AiMessage[]>([]);
let streaming = $state(false);
let error = $state<string | null>(null);
let sessionId = $state<string | null>(null);
let sessionSummary = $state('');
let sessions = $state<SessionInfo[]>([]);

let abortController: AbortController | null = null;

// ---------------------------------------------------------------------------
// Session persistence helpers
// ---------------------------------------------------------------------------

function makeSessionId(): string {
  return `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a session title from the first user message. */
function deriveSessionTitle(): string {
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (!firstUserMsg) return 'Untitled research';
  const text = firstUserMsg.content.trim();
  return text.length > 60 ? text.slice(0, 58) + '…' : text;
}

/** Auto-save the current session to the database. */
async function autoSave() {
  // Need at least one message to save
  if (messages.filter(m => m.role === 'user').length === 0) return;

  if (!sessionId) {
    sessionId = makeSessionId();
  }

  try {
    const { researchSaveSession } = await import('$lib/bridge/commands');
    await researchSaveSession({
      id: sessionId,
      title: deriveSessionTitle(),
      summary: sessionSummary,
      sources: JSON.stringify(sources.map(s => ({ ...s, content: null }))), // don't save content — lazy reload
      messages: JSON.stringify(messages.filter(m => !m.streaming)),
      createdAt: messages[0]?.timestamp ?? Date.now(),
      updatedAt: Date.now(),
    });
    // Refresh session list so the UI updates
    await refreshSessions();
  } catch {
    // Silent — don't break the UX for save failures
  }
}

/** Load saved sessions list from the database. */
async function refreshSessions() {
  try {
    const { researchListSessions } = await import('$lib/bridge/commands');
    const list = await researchListSessions();
    sessions = list.map(s => ({
      id: s.id,
      title: s.title,
      sourceCount: s.sourceCount,
      messageCount: s.messageCount,
      updatedAt: s.updatedAt,
    }));
  } catch {
    sessions = [];
  }
}

// ---------------------------------------------------------------------------
// Smart compaction — generates summary of dropped messages
// ---------------------------------------------------------------------------

const COMPACT_PROMPT = `Summarize this research conversation concisely. Preserve:
- Key questions asked and answers found
- Important findings, facts, and conclusions
- Decisions made or recommendations given
- Source references (keep [[citation]] syntax)
Write in past tense, 3rd person. Max 400 words. No preamble.`;

async function generateCompactionSummary(droppedMessages: AiMessage[]): Promise<string> {
  const model = getAIModel();
  if (!model) return '';

  const conversation = droppedMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'Q' : 'A'}: ${m.content}`)
    .join('\n\n');

  if (!conversation.trim()) return '';

  try {
    const { text } = await generateText({
      model,
      system: COMPACT_PROMPT,
      prompt: conversation.slice(0, 12000), // cap to avoid huge prompts
      maxOutputTokens: 600,
    });
    return text.trim();
  } catch {
    // Fallback: no summary rather than breaking the flow
    return sessionSummary;
  }
}

// ---------------------------------------------------------------------------
// RAG memory — index compacted conversation for long-term retrieval
// ---------------------------------------------------------------------------

async function indexConversationChunks(droppedMessages: AiMessage[]) {
  try {
    const { getCoreState } = await import('$lib/stores/core.svelte');
    const core = getCoreState();
    if (!core.activeCore?.path) return;

    const { ragSearch } = await import('$lib/bridge/rag');

    // We don't have a direct "index arbitrary text" command,
    // but we can save the conversation as a hidden note and let
    // the indexer pick it up on next scan. For now, the summary
    // in the system prompt is sufficient — RAG search of vault
    // notes will catch relevant content if the user saved findings.
    // Full RAG indexing of conversation is a future enhancement.
  } catch {
    // Silent
  }
}

/** Search RAG for past conversation context relevant to the current question. */
async function searchPastContext(question: string): Promise<string> {
  if (!sessionSummary) return '';

  try {
    const { getCoreState } = await import('$lib/stores/core.svelte');
    const core = getCoreState();
    if (!core.activeCore?.path) return '';

    const { ragSearch } = await import('$lib/bridge/rag');
    const results = await ragSearch(question, core.activeCore.path, 3);

    if (results.length === 0) return '';

    // Include relevant vault content that matches the research question
    const relevantChunks = results
      .filter(r => r.score > 0.3)
      .map(r => `From "${r.title || r.path}": ${r.chunk}`)
      .join('\n\n');

    return relevantChunks ? `\nRelevant vault context:\n${relevantChunks}` : '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Lowercase, strip non-alphanumeric, hyphenate, max 40 chars. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Builds a stable citation id for a source.
 *  - notes:  vault path without .md  (e.g. "projects/my-note")
 *  - urls:   "url:<slug-of-hostname+path>"
 *  - text:   "text:<slug-of-label>"
 */
function makeCitationId(type: SourceType, title: string, origin: string): string {
  if (type === 'note') {
    // Strip .md / .markdown extension
    return origin.replace(/\.(md|markdown)$/i, '');
  }
  if (type === 'url') {
    try {
      const parsed = new URL(origin);
      const raw = parsed.hostname + parsed.pathname;
      return 'url:' + slugify(raw);
    } catch {
      return 'url:' + slugify(origin);
    }
  }
  return 'text:' + slugify(title);
}

function makeSourceId(): string {
  return `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Builds the full system prompt for the research assistant.
 *
 * @param sourceMapping  Human-readable list of "[[citationId]] = title" lines
 * @param trimmed        True when old history was trimmed (adds a note)
 */
function buildSystemPrompt(sourceMapping: string, trimmed: boolean, summary: string, ragContext: string): string {
  const base = `You are a research assistant helping the user think through their sources. Answer based on the provided source content. Be precise. When referencing a source, use [[Source-Id]] wiki-link syntax naturally in your prose. If the answer isn't in the sources, say so. Surface connections between sources when relevant.`;

  const mappingSection = sourceMapping
    ? `\nAvailable sources:\n${sourceMapping}`
    : '\nNo sources have been loaded yet. Ask the user to add sources before asking research questions.';

  // Include session summary so AI retains memory across compactions
  const summarySection = summary
    ? `\n\nPrevious research summary (from earlier in this session):\n${summary}`
    : '';

  const ragSection = ragContext || '';

  const trimNote = trimmed
    ? '\n\n[Note: Earlier messages were compacted. The summary above captures the key context.]'
    : '';

  return base + mappingSection + summarySection + ragSection + trimNote;
}

// ---------------------------------------------------------------------------
// Internal: convert AiMessage[] → model messages
// ---------------------------------------------------------------------------

async function toModelMessages(msgs: AiMessage[]) {
  const ui: UIMessage[] = msgs
    .filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.streaming))
    .map((m, i) => ({
      id: String(i),
      role: m.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: m.content }],
    }));
  return await convertToModelMessages(ui);
}

// ---------------------------------------------------------------------------
// Exported state accessor
// ---------------------------------------------------------------------------

export function getResearchState() {
  return {
    // -------------------------------------------------------------------------
    // Reactive getters
    // -------------------------------------------------------------------------
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
    get sessionId() {
      return sessionId;
    },
    get sessionSummary() {
      return sessionSummary;
    },
    get sessions() {
      return sessions;
    },

    // -------------------------------------------------------------------------
    // Source operations
    // -------------------------------------------------------------------------

    /** Add a vault note source. Content is loaded lazily on first send(). */
    addNoteSource(path: string, title: string) {
      if (sources.some((s) => s.type === 'note' && s.origin === path)) return;
      sources = [
        ...sources,
        {
          id: makeSourceId(),
          type: 'note',
          title,
          citationId: makeCitationId('note', title, path),
          origin: path,
          content: null,
          addedAt: Date.now(),
        },
      ];
      error = null;
    },

    /** Add multiple vault notes at once (metadata-only, no file reads). */
    addBulkNotes(notes: Array<{ path: string; title: string }>) {
      const existing = new Set(
        sources.filter((s) => s.type === 'note').map((s) => s.origin),
      );
      const toAdd = notes.filter((n) => !existing.has(n.path));
      if (toAdd.length === 0) return;

      const newSources: ResearchSource[] = toAdd.map((n) => ({
        id: makeSourceId(),
        type: 'note',
        title: n.title,
        citationId: makeCitationId('note', n.title, n.path),
        origin: n.path,
        content: null,
        addedAt: Date.now(),
      }));

      sources = [...sources, ...newSources];
      error = null;
    },

    /** Add a URL source. Fetches content in the background. */
    async addUrlSource(url: string) {
      if (sources.some((s) => s.type === 'url' && s.origin === url)) return;

      const id = makeSourceId();
      const placeholder: ResearchSource = {
        id,
        type: 'url',
        title: url,
        citationId: makeCitationId('url', url, url),
        origin: url,
        content: null,
        loading: true,
        addedAt: Date.now(),
      };
      sources = [...sources, placeholder];
      error = null;

      try {
        const { urlFetch } = await import('$lib/bridge/commands');
        const result = await urlFetch(url);
        sources = sources.map((s) =>
          s.id === id
            ? {
                ...s,
                title: result.title || url,
                citationId: makeCitationId('url', result.title || url, url),
                content: result.content,
                loading: false,
                error: undefined,
              }
            : s,
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        sources = sources.map((s) =>
          s.id === id
            ? { ...s, loading: false, error: `Failed to fetch: ${errMsg}` }
            : s,
        );
      }
    },

    /** Add pasted/typed text directly as a source. */
    addTextSource(label: string, content: string) {
      const id = makeSourceId();
      sources = [
        ...sources,
        {
          id,
          type: 'text',
          title: label,
          citationId: makeCitationId('text', label, ''),
          origin: '',
          content,
          addedAt: Date.now(),
        },
      ];
      error = null;
    },

    /** Retry a previously failed URL source. */
    async retrySource(id: string) {
      const src = sources.find((s) => s.id === id);
      if (!src || src.type !== 'url' || src.loading) return;

      sources = sources.map((s) =>
        s.id === id ? { ...s, loading: true, error: undefined } : s,
      );

      try {
        const { urlFetch } = await import('$lib/bridge/commands');
        const result = await urlFetch(src.origin);
        sources = sources.map((s) =>
          s.id === id
            ? {
                ...s,
                title: result.title || src.origin,
                citationId: makeCitationId('url', result.title || src.origin, src.origin),
                content: result.content,
                loading: false,
                error: undefined,
              }
            : s,
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        sources = sources.map((s) =>
          s.id === id
            ? { ...s, loading: false, error: `Failed to fetch: ${errMsg}` }
            : s,
        );
      }
    },

    /** Remove a single source by id. */
    removeSource(id: string) {
      sources = sources.filter((s) => s.id !== id);
    },

    /** Remove all sources. */
    clearSources() {
      sources = [];
    },

    // -------------------------------------------------------------------------
    // Messaging
    // -------------------------------------------------------------------------

    async send(content: string) {
      if (streaming) return;

      const model = getAIModel();
      if (!model) {
        error = 'No AI provider configured. Open Settings → AI to set one up.';
        return;
      }
      error = null;

      // Append user message
      messages = [
        ...messages,
        { role: 'user', content, timestamp: Date.now() },
      ];

      // --- Lazy-load unread note sources ---
      const unloaded = sources.filter(
        (s) => s.type === 'note' && s.content === null && !s.loading,
      );
      if (unloaded.length > 0) {
        // Mark them as loading
        sources = sources.map((s) =>
          unloaded.some((u) => u.id === s.id) ? { ...s, loading: true } : s,
        );

        const { readFile } = await import('$lib/bridge/commands');

        await Promise.all(
          unloaded.map(async (src) => {
            try {
              const result = await readFile(src.origin);
              sources = sources.map((s) =>
                s.id === src.id
                  ? { ...s, content: result.content, loading: false, error: undefined }
                  : s,
              );
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              sources = sources.map((s) =>
                s.id === src.id
                  ? { ...s, loading: false, error: `Failed to load: ${errMsg}` }
                  : s,
              );
            }
          }),
        );
      }

      // --- Build context ---
      const modelName = getSettings().aiModel ?? '';
      const budget = calculateBudget(modelName);

      // Only pass sources that have content
      const loadedSources: ResearchSourceInput[] = sources
        .filter((s) => s.content !== null && !s.error)
        .map((s) => ({
          path: s.citationId,
          title: s.title,
          content: s.content as string,
        }));

      const { block: contextBlock } = buildSourceContext(
        loadedSources,
        content,
        budget.sourceBudgetChars,
      );

      // --- Build source mapping for system prompt ---
      const sourceMapping = sources
        .filter((s) => s.content !== null && !s.error)
        .map((s) => `[[${s.citationId}]] = ${s.title}`)
        .join('\n');

      // --- Smart compaction ---
      const historyWithoutLatest = messages.slice(0, -1);
      const trimmedHistory = trimHistory(historyWithoutLatest, budget.historyBudgetChars);
      const wasTrimmed = trimmedHistory.length < historyWithoutLatest.length;

      // If messages were dropped, generate a summary to preserve memory
      if (wasTrimmed) {
        const droppedMessages = historyWithoutLatest.slice(0, historyWithoutLatest.length - trimmedHistory.length);
        if (droppedMessages.length > 0) {
          const newSummary = await generateCompactionSummary(droppedMessages);
          if (newSummary) {
            sessionSummary = sessionSummary
              ? `${sessionSummary}\n\n${newSummary}`
              : newSummary;
          }
          // Index dropped chunks for future RAG retrieval
          indexConversationChunks(droppedMessages);
        }
      }

      // --- Search RAG for relevant past context ---
      const ragContext = await searchPastContext(content);

      // --- System prompt ---
      const systemPrompt =
        buildSystemPrompt(sourceMapping, wasTrimmed, sessionSummary, ragContext) +
        (contextBlock ? `\n\n${contextBlock}` : '');

      // --- Convert to model messages (trimmed history + new user turn) ---
      const msgsForModel: AiMessage[] = [
        ...trimmedHistory,
        { role: 'user', content, timestamp: Date.now() },
      ];
      const modelMessages = await toModelMessages(msgsForModel);

      // --- Placeholder assistant message ---
      const assistantIndex = messages.length;
      messages = [
        ...messages,
        { role: 'assistant', content: '', timestamp: Date.now(), streaming: true },
      ];

      streaming = true;
      abortController = new AbortController();

      try {
        const result = streamText({
          model,
          system: systemPrompt,
          messages: modelMessages,
          maxOutputTokens: getMaxTokens(),
          abortSignal: abortController.signal,
        });

        for await (const chunk of result.textStream) {
          if (abortController?.signal.aborted) break;
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

        // Auto-save session after each assistant response
        autoSave();
      }
    },

    cancel() {
      abortController?.abort();
      abortController = null;
      streaming = false;
    },

    clearMessages() {
      abortController?.abort();
      abortController = null;
      messages = [];
      error = null;
      streaming = false;
    },

    clearAll() {
      abortController?.abort();
      abortController = null;
      messages = [];
      sources = [];
      error = null;
      streaming = false;
      sessionId = null;
      sessionSummary = '';
    },

    // -------------------------------------------------------------------------
    // Session management
    // -------------------------------------------------------------------------

    /** Load the list of saved sessions from the database. */
    async loadSessions() {
      await refreshSessions();
    },

    /** Resume a previously saved session. */
    async resumeSession(id: string) {
      try {
        const { researchLoadSession } = await import('$lib/bridge/commands');
        const data = await researchLoadSession(id);

        sessionId = data.id;
        sessionSummary = data.summary;

        // Restore sources (content is null — will be lazy-loaded on first send)
        try {
          const parsed = JSON.parse(data.sources);
          sources = Array.isArray(parsed) ? parsed : [];
        } catch {
          sources = [];
        }

        // Restore messages
        try {
          const parsed = JSON.parse(data.messages);
          messages = Array.isArray(parsed) ? parsed : [];
        } catch {
          messages = [];
        }

        error = null;
        streaming = false;
      } catch (err) {
        error = `Failed to load session: ${err instanceof Error ? err.message : String(err)}`;
      }
    },

    /** Delete a saved session. */
    async deleteSession(id: string) {
      try {
        const { researchDeleteSession } = await import('$lib/bridge/commands');
        await researchDeleteSession(id);
        sessions = sessions.filter(s => s.id !== id);
        // If deleting the active session, clear state
        if (sessionId === id) {
          sessionId = null;
          sessionSummary = '';
          messages = [];
          sources = [];
        }
      } catch {}
    },

    /** Start a fresh session. Saves the current session first if it has messages. */
    async newSession() {
      // Save the current session before clearing
      await autoSave();

      abortController?.abort();
      abortController = null;
      messages = [];
      sources = [];
      error = null;
      streaming = false;
      sessionId = null;
      sessionSummary = '';
    },
  };
}
