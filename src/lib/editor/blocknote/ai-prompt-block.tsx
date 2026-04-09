import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { BlockNoteEditor } from '@blocknote/core';
import { INLINE_AI_SYSTEM_PROMPT, buildAiPrompt } from './ai-prompt-system';

interface AiPromptOverlayProps {
  editor: BlockNoteEditor<any, any, any>;
  blockId: string;
  onClose: () => void;
}

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
      // Get the full note as markdown — this is what the AI sees and edits
      const noteMarkdown = await editor.blocksToMarkdownLossy(editor.document);

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

      // Build the user message with the full note + instruction
      const userMessage = buildAiPrompt(instruction, noteMarkdown);

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
        systemPrompt: INLINE_AI_SYSTEM_PROMPT,
        maxTokens: 4000,
      });

      unlisten();

      const markdown = (response || streamRef.current).trim();
      if (!markdown) {
        setError('AI returned empty response. Try again.');
        setLoading(false);
        return;
      }

      // Replace the ENTIRE document with the AI's output
      const blocks = editor.tryParseMarkdownToBlocks(markdown);
      editor.replaceBlocks(editor.document, blocks);

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
          placeholder={loading ? 'Editing note...' : 'Tell AI what to do with this note...'}
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
