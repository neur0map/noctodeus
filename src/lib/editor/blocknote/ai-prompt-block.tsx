import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { BlockNoteEditor } from '@blocknote/core';
import {
  CONTEXT_WINDOW_SYSTEM_PROMPT,
  FULL_DOC_SYSTEM_PROMPT,
  buildContextWindowMessage,
  buildFullDocMessage,
  isFullDocumentRequest,
} from './ai-prompt-system';

interface AiPromptOverlayProps {
  editor: BlockNoteEditor<any, any, any>;
  blockId: string;
  onClose: () => void;
}

const ABOVE_COUNT = 10;
const BELOW_COUNT = 5;

export function AiPromptOverlay({ editor, blockId, onClose }: AiPromptOverlayProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef('');
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.scrollTop = previewRef.current.scrollHeight;
    }
  }, [streaming]);

  const dismiss = useCallback(() => {
    onClose();
    editor.setTextCursorPosition(blockId, 'start');
    editor.focus();
  }, [editor, blockId, onClose]);

  const submit = useCallback(async () => {
    const instruction = input.trim();
    if (!instruction || loading) return;

    setLoading(true);
    setStreaming('');
    setError('');
    streamRef.current = '';

    try {
      const { aiChat } = await import('$lib/bridge/ai');
      const { listen } = await import('@tauri-apps/api/event');
      const { getSettings } = await import('$lib/stores/settings.svelte');
      const settings = getSettings();

      if (!settings.aiApiKey || !settings.aiBaseUrl || !settings.aiModel) {
        setError('Configure AI provider in Settings first');
        setLoading(false);
        return;
      }

      const provider = {
        id: settings.aiProviderId || 'custom',
        name: settings.aiProviderId || 'Custom',
        baseUrl: settings.aiBaseUrl,
        apiKey: settings.aiApiKey,
        model: settings.aiModel,
      };

      // Decide mode: full-document or context-window
      const fullDocMode = isFullDocumentRequest(instruction);

      // Gather context
      const doc = editor.document;
      const cursorIdx = doc.findIndex((b) => b.id === blockId);
      const aboveBlocks = cursorIdx > 0 ? doc.slice(Math.max(0, cursorIdx - ABOVE_COUNT), cursorIdx) : [];
      const belowBlocks = cursorIdx >= 0 ? doc.slice(cursorIdx + 1, cursorIdx + 1 + BELOW_COUNT) : [];

      let systemPrompt: string;
      let userMessage: string;

      if (fullDocMode) {
        const noteMarkdown = await editor.blocksToMarkdownLossy(doc);
        systemPrompt = FULL_DOC_SYSTEM_PROMPT;
        userMessage = buildFullDocMessage(instruction, noteMarkdown);
      } else {
        const aboveMarkdown = aboveBlocks.length > 0
          ? await editor.blocksToMarkdownLossy(aboveBlocks)
          : '';
        const belowMarkdown = belowBlocks.length > 0
          ? await editor.blocksToMarkdownLossy(belowBlocks)
          : '';
        systemPrompt = CONTEXT_WINDOW_SYSTEM_PROMPT;
        userMessage = buildContextWindowMessage(instruction, aboveMarkdown, belowMarkdown);
      }

      // Listen to streaming tokens
      const unlisten = await listen<{ delta: string; done: boolean }>('ai:token', (event) => {
        if (event.payload.delta) {
          streamRef.current += event.payload.delta;
          setStreaming(streamRef.current);
        }
      });

      const response = await aiChat({
        provider,
        messages: [{ role: 'user', content: userMessage }],
        systemPrompt,
        maxTokens: fullDocMode ? 4000 : 1500,
      });

      unlisten();

      let markdown = (response || streamRef.current).trim();
      if (!markdown) {
        setError('AI returned empty response. Try again.');
        setLoading(false);
        return;
      }

      if (fullDocMode) {
        // Full document replacement
        const blocks = editor.tryParseMarkdownToBlocks(markdown);
        editor.replaceBlocks(doc, blocks);
      } else {
        // Detect [REPLACE] prefix
        const replaceMode = /^\[REPLACE\]\s*\n?/i.test(markdown);
        if (replaceMode) {
          markdown = markdown.replace(/^\[REPLACE\]\s*\n?/i, '');
        }

        const blocks = editor.tryParseMarkdownToBlocks(markdown);

        if (replaceMode) {
          // Replace the context window (above + cursor + below blocks) with the new content
          const cursorBlock = doc[cursorIdx];
          const toReplace = [...aboveBlocks, cursorBlock, ...belowBlocks].filter(Boolean);
          editor.replaceBlocks(toReplace, blocks);
        } else {
          // Insert new content after the cursor block
          editor.insertBlocks(blocks, blockId, 'after');
        }
      }

      onClose();
      editor.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [input, loading, editor, blockId, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      }
    },
    [submit, dismiss],
  );

  return (
    <div className="ai-prompt" onMouseDown={(e) => e.stopPropagation()}>
      <div className="ai-prompt__bar">
        {loading ? (
          <div className="ai-prompt__spinner" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        ) : (
          <div className="ai-prompt__chip" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            </svg>
          </div>
        )}

        <input
          ref={inputRef}
          className="ai-prompt__input"
          placeholder={loading ? 'Thinking...' : 'Ask AI to write, edit, or transform...'}
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />

        <button
          className={`ai-prompt__send ${input.trim() && !loading ? 'ai-prompt__send--ready' : ''}`}
          onClick={submit}
          disabled={!input.trim() || loading}
          aria-label="Send"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>

      {streaming && (
        <div className="ai-prompt__preview" ref={previewRef}>
          {streaming}
        </div>
      )}

      {error && <p className="ai-prompt__error">{error}</p>}
    </div>
  );
}
