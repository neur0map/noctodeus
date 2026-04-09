import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import type { BlockNoteEditor } from '@blocknote/core';
import { INLINE_AI_SYSTEM_PROMPT } from './ai-prompt-system';

/**
 * AI Prompt block — appears inline when user presses Space on an empty line.
 * Renders a slim input bar. On submit, calls AI and replaces this block
 * with the generated content.
 */
export const AiPromptBlock = createReactBlockSpec(
  {
    type: 'aiPrompt' as const,
    content: 'none',
    propSchema: {},
  },
  {
    render: ({ block, editor }) => {
      return (
        <AiPromptBar
          blockId={block.id}
          editor={editor as BlockNoteEditor<any, any, any>}
        />
      );
    },
  },
);

// ── React component ──

interface AiPromptBarProps {
  blockId: string;
  editor: BlockNoteEditor<any, any, any>;
}

function AiPromptBar({ blockId, editor }: AiPromptBarProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const dismiss = useCallback(() => {
    // Replace AI block with an empty paragraph
    editor.updateBlock(blockId, { type: 'paragraph', content: '' });
    editor.setTextCursorPosition(blockId, 'start');
  }, [editor, blockId]);

  const submit = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    setLoading(true);
    setError('');

    try {
      // Gather note context
      let noteContext = '';
      editor.forEachBlock((b) => {
        if (b.id === blockId) return true; // skip the AI block itself
        if (b.content && Array.isArray(b.content)) {
          const text = b.content
            .map((ic: any) => (typeof ic === 'string' ? ic : ic.text ?? ''))
            .join('');
          if (text) noteContext += text + '\n';
        }
        return true;
      });

      // Get AI provider from the global bridge
      const { aiChat } = await import('$lib/bridge/ai');
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

      // Build system prompt with note context
      const systemParts = [INLINE_AI_SYSTEM_PROMPT];
      if (noteContext.trim()) {
        systemParts.push(
          `\nCurrent note content (for context):\n${noteContext.slice(0, 2000)}`,
        );
      }

      const response = await aiChat({
        provider,
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: systemParts.join('\n'),
        maxTokens: 2000,
      });

      const markdown = response.trim();
      if (!markdown) {
        setError('AI returned empty response. Try a more specific request.');
        setLoading(false);
        return;
      }

      // Parse response and replace this block with the result
      const blocks = editor.tryParseMarkdownToBlocks(markdown);
      editor.replaceBlocks([blockId], blocks);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [input, loading, editor, blockId]);

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
    <div className="ai-prompt" contentEditable={false}>
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
          placeholder={loading ? 'Thinking...' : 'Ask AI to write, organize, or transform...'}
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

      {error && <p className="ai-prompt__error">{error}</p>}
    </div>
  );
}
