import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { markdownToHTML, type BlockNoteEditor } from '@blocknote/core';
import type { FabricPattern } from '$lib/ai/fabric-patterns';
import { PatternIcon } from './pattern-icons';

interface PatternExecutorProps {
  editor: BlockNoteEditor<any, any, any>;
  pattern: FabricPattern;
  /** The block id that was active when the pattern was invoked */
  anchorBlockId: string;
  /** The selection text (for replace-selection mode) */
  selectionText: string;
  onClose: () => void;
}

type Phase = 'running' | 'ready' | 'error';

/**
 * PatternExecutor runs a Fabric pattern against the editor content and shows
 * a bottom-anchored streaming panel with Keep / Discard actions.
 *
 * Aesthetic: editorial refinement — small caps meta, hairline borders,
 * monospace streaming feed, two clear actions.
 */
export function PatternExecutor({
  editor,
  pattern,
  anchorBlockId,
  selectionText,
  onClose,
}: PatternExecutorProps) {
  const [phase, setPhase] = useState<Phase>('running');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const streamRef = useRef('');
  const feedRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);
  const resolvedAnchorRef = useRef(anchorBlockId);
  const CLOSE_MS = 240;

  const scheduleClose = useCallback(() => {
    cancelledRef.current = true;
    setClosing(true);
    window.setTimeout(() => {
      onClose();
    }, CLOSE_MS);
  }, [onClose]);

  // Render markdown → HTML for a polished live preview.
  const previewHtml = useMemo(() => {
    if (!output) return '';
    // Strip thinking blocks first so the live preview doesn't flash
    // reasoning noise while the model writes.
    const cleaned = stripThinking(output)
      .replace(/^```(?:markdown|md)?\n?/i, '')
      .replace(/\n?```$/i, '');
    try {
      // markdownToHTML is sync in BlockNote core and handles incomplete markdown gracefully.
      return markdownToHTML(cleaned);
    } catch {
      return escapeHtml(cleaned);
    }
  }, [output]);

  // Auto-scroll the streaming feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [output]);

  // Esc to dismiss
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        scheduleClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [scheduleClose]);

  // Kick off the run
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function run() {
      try {
        const { aiChat } = await import('$lib/bridge/ai');
        const { listen } = await import('@tauri-apps/api/event');
        const { getSettings } = await import('$lib/stores/settings.svelte');
        const settings = getSettings();

        if (!settings.aiApiKey || !settings.aiBaseUrl || !settings.aiModel) {
          setPhase('error');
          setError('Configure an AI provider in Settings first.');
          return;
        }

        const provider = {
          id: settings.aiProviderId || 'custom',
          name: settings.aiProviderId || 'Custom',
          baseUrl: settings.aiBaseUrl,
          apiKey: settings.aiApiKey,
          model: settings.aiModel,
        };

        const { content, resolvedBlockId } = await gatherContent(
          editor,
          pattern,
          anchorBlockId,
          selectionText,
        );
        if (!content.trim()) {
          setPhase('error');
          setError(emptyContentMessage(pattern));
          return;
        }
        // If the pattern resolved to an upstream block (empty-line fallback),
        // update the anchor so Keep targets the right block.
        if (resolvedBlockId !== anchorBlockId) {
          // resolvedBlockId is only used internally here; handleKeep still uses
          // the original anchorBlockId prop for replace-block operations. We
          // mutate via a ref-like closure through a local variable instead.
          resolvedAnchorRef.current = resolvedBlockId;
        }

        // Subscribe to streaming tokens
        unlisten = await listen<{ delta: string; done: boolean }>('ai:token', (event) => {
          if (cancelledRef.current) return;
          if (event.payload.delta) {
            streamRef.current += event.payload.delta;
            setOutput(streamRef.current);
          }
        });

        // Honor the user-configured ceiling. 0 = provider default.
        const userCap = settings.aiMaxTokens ?? 0;
        const maxTokens = userCap > 0 ? userCap : undefined;

        const response = await aiChat({
          provider,
          messages: [{ role: 'user', content }],
          systemPrompt: pattern.systemPrompt,
          ...(maxTokens !== undefined ? { maxTokens } : {}),
        });

        if (cancelledRef.current) return;

        const raw = (response || streamRef.current);
        // Strip reasoning/thinking wrappers that some models (DeepSeek R1,
        // QwQ, o1, etc.) emit as the entire response. If only thinking is
        // left, the actual output is empty.
        const finalText = stripThinking(raw).trim();

        if (!finalText) {
          // Log the raw response so the issue is diagnosable from devtools.
          console.warn('[PatternExecutor] Empty response after stripping.', {
            pattern: pattern.id,
            rawLength: raw.length,
            rawPreview: raw.slice(0, 200),
          });
          setPhase('error');
          setError(emptyResponseMessage(pattern, raw));
          return;
        }
        setOutput(finalText);
        setPhase('ready');
      } catch (err) {
        if (cancelledRef.current) return;
        setPhase('error');
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        unlisten?.();
      }
    }

    run();

    return () => {
      cancelledRef.current = true;
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeep = useCallback(() => {
    if (phase !== 'ready') return;
    const cleaned = stripThinking(output)
      .replace(/^```(?:markdown|md)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
    const targetBlockId = resolvedAnchorRef.current;

    try {
      if (pattern.mode === 'replace-selection') {
        // Replace only the selected inline text
        if (selectionText) {
          editor.insertInlineContent([{ type: 'text', text: cleaned, styles: {} }]);
        } else {
          // Fallback: replace the resolved block
          const blocks = editor.tryParseMarkdownToBlocks(cleaned);
          editor.replaceBlocks([targetBlockId], blocks);
        }
      } else if (pattern.mode === 'replace-block') {
        const blocks = editor.tryParseMarkdownToBlocks(cleaned);
        editor.replaceBlocks([targetBlockId], blocks);
      } else {
        // insert-after — always insert after the original cursor position,
        // even if the source content was walked upward.
        const blocks = editor.tryParseMarkdownToBlocks(cleaned);
        editor.insertBlocks(blocks, anchorBlockId, 'after');
      }
    } catch (err) {
      console.error('[PatternExecutor] Failed to apply result:', err);
    }

    scheduleClose();
    requestAnimationFrame(() => editor.focus());
  }, [phase, output, pattern, editor, anchorBlockId, selectionText, scheduleClose]);

  const handleDiscard = useCallback(() => {
    scheduleClose();
    requestAnimationFrame(() => editor.focus());
  }, [editor, scheduleClose]);

  return (
    <div
      className={`pattern-executor${closing ? ' pattern-executor--closing' : ''}`}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={`Running ${pattern.name}`}
    >
      <div className="pattern-executor__inner">
        <header className="pattern-executor__header">
          <div className="pattern-executor__icon" aria-hidden="true">
            <PatternIcon name={pattern.icon} size={14} />
          </div>
          <div className="pattern-executor__meta">
            <span className="pattern-executor__category">{pattern.category}</span>
            <span className="pattern-executor__name">{pattern.name}</span>
          </div>
          <div className="pattern-executor__status">
            {phase === 'running' && (
              <>
                <span className="pattern-executor__pulse" aria-hidden="true" />
                <span>Streaming</span>
              </>
            )}
            {phase === 'ready' && <span>Ready</span>}
            {phase === 'error' && <span className="pattern-executor__status--error">Error</span>}
          </div>
        </header>

        {phase === 'error' ? (
          <div className="pattern-executor__error">{error}</div>
        ) : output ? (
          <div
            className="pattern-executor__feed"
            ref={feedRef}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <div className="pattern-executor__feed" ref={feedRef}>
            <span className="pattern-executor__placeholder">Preparing input…</span>
          </div>
        )}

        <footer className="pattern-executor__footer">
          <span className="pattern-executor__hint">
            {phase === 'ready' ? 'Review the result' : phase === 'running' ? 'Working…' : 'Something went wrong'}
          </span>
          <div className="pattern-executor__actions">
            <button
              type="button"
              className="pattern-executor__btn pattern-executor__btn--ghost"
              onClick={handleDiscard}
            >
              Discard
            </button>
            <button
              type="button"
              className="pattern-executor__btn pattern-executor__btn--primary"
              onClick={handleKeep}
              disabled={phase !== 'ready'}
            >
              {pattern.mode === 'insert-after' ? 'Insert' : 'Replace'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ── Content gathering ─────────────────────────────────────────────────

interface GatheredContent {
  content: string;
  /** The block id the content came from (may differ from anchorBlockId if
   *  we walked upward to find a non-empty paragraph). */
  resolvedBlockId: string;
}

async function gatherContent(
  editor: BlockNoteEditor<any, any, any>,
  pattern: FabricPattern,
  anchorBlockId: string,
  selectionText: string,
): Promise<GatheredContent> {
  if (pattern.context === 'selection') {
    if (selectionText) {
      return { content: selectionText, resolvedBlockId: anchorBlockId };
    }
    // Fallback: walk upward for the nearest non-empty block
    return walkForText(editor, anchorBlockId);
  }

  if (pattern.context === 'current-block') {
    const direct = extractBlockText(editor, anchorBlockId);
    if (direct.trim()) {
      return { content: direct, resolvedBlockId: anchorBlockId };
    }
    // Empty block (common when the pattern was invoked from a fresh line
    // via the slash menu — the trigger text has been cleared). Walk upward
    // to find the most recent paragraph the user wrote.
    return walkForText(editor, anchorBlockId);
  }

  // full-note
  try {
    const md = await editor.blocksToMarkdownLossy(editor.document);
    return { content: md, resolvedBlockId: anchorBlockId };
  } catch {
    return { content: '', resolvedBlockId: anchorBlockId };
  }
}

/**
 * Walk upward from `startBlockId` to find the nearest non-empty block and
 * return its text. Used as a fallback when the current block is empty
 * (e.g. user typed a slash command on a blank line).
 */
function walkForText(
  editor: BlockNoteEditor<any, any, any>,
  startBlockId: string,
): GatheredContent {
  const doc = editor.document;
  const idx = doc.findIndex((b: any) => b.id === startBlockId);
  if (idx < 0) return { content: '', resolvedBlockId: startBlockId };

  for (let i = idx; i >= 0; i--) {
    const b = doc[i];
    const text = extractBlockText(editor, b.id);
    if (text.trim()) {
      return { content: text, resolvedBlockId: b.id };
    }
  }
  return { content: '', resolvedBlockId: startBlockId };
}

/** Pattern-aware empty-content message. */
function emptyContentMessage(pattern: FabricPattern): string {
  if (pattern.context === 'full-note') {
    return 'This note is empty. Write something first.';
  }
  if (pattern.context === 'selection') {
    return `Select text (or write a paragraph) before running "${pattern.name}".`;
  }
  // current-block
  return `Write a paragraph above before running "${pattern.name}".`;
}

/**
 * Remove reasoning/thinking wrappers that some models emit. We strip:
 *   - <think>...</think>          (DeepSeek R1 format)
 *   - <thinking>...</thinking>    (Anthropic-style)
 *   - <reasoning>...</reasoning>  (generic)
 * Unclosed blocks (still streaming) are left alone so the feed can show
 * them dimmed or the user sees progress — we only strip closed blocks.
 */
function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .trim();
}

/**
 * Explain what likely went wrong when the model returned nothing usable.
 * If the raw response had thinking blocks but no actual output, that's a
 * distinct failure mode from a truly empty response.
 */
function emptyResponseMessage(pattern: FabricPattern, raw: string): string {
  const hadThinking = /<(think|thinking|reasoning)>/i.test(raw);
  if (hadThinking) {
    return 'The model only produced reasoning, no output. Try a larger max-tokens model or a non-reasoning model.';
  }
  if (pattern.context === 'full-note') {
    return 'The model returned nothing. The note may be too long for this model\'s context window — try shortening it or switching models.';
  }
  return 'The model returned nothing. Check your provider status or try again.';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function extractBlockText(editor: BlockNoteEditor<any, any, any>, blockId: string): string {
  const block = editor.getBlock(blockId);
  if (!block || !block.content) return '';
  if (typeof block.content === 'string') return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .map((ic: any) => {
        if (typeof ic === 'string') return ic;
        if (ic?.text) return ic.text;
        if (ic?.type === 'wikiLink' && ic.props?.target) return ic.props.target;
        return '';
      })
      .join('');
  }
  return '';
}
