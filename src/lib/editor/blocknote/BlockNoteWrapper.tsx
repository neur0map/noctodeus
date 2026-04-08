import React, { useEffect, useRef } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';

import '@mantine/core/styles.css';
import '@blocknote/mantine/style.css';

import type { BlockNoteEditorProps, EditorHandle } from './types';

/**
 * React wrapper around BlockNote editor.
 * Rendered inside a Svelte component via react-dom/client.
 */
export default function BlockNoteWrapper(props: BlockNoteEditorProps) {
  const {
    initialContent,
    onContentChange,
    onNavigate,
    onEditorReady,
    onEditorDestroy,
    darkMode = false,
  } = props;

  // Keep initialContent in a ref so the editor instance isn't recreated on
  // every re-render (useCreateBlockNote only reads from it once).
  const initialContentRef = useRef(initialContent);

  const editor = useCreateBlockNote({});

  // ---- Load initial content on first mount ----
  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      const md = initialContentRef.current;
      if (!md) return;

      const blocks = await editor.tryParseMarkdownToBlocks(md);
      if (!cancelled) {
        editor.replaceBlocks(editor.document, blocks);
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // ---- Build and expose EditorHandle ----
  useEffect(() => {
    const handle: EditorHandle = {
      getHeadings() {
        const headings: Array<{ level: number; text: string; id: string }> = [];
        for (const block of editor.document) {
          if (block.type === 'heading') {
            const text = extractBlockText(block);
            headings.push({
              level: (block.props as { level?: number }).level ?? 1,
              text,
              id: block.id,
            });
          }
        }
        return headings;
      },

      getStats() {
        let charCount = 0;
        let wordCount = 0;
        let paragraphCount = 0;

        for (const block of editor.document) {
          const text = extractBlockText(block);
          if (text.length > 0) {
            charCount += text.length;
            const words = text.trim().split(/\s+/).filter(Boolean);
            wordCount += words.length;
          }
          // Count paragraph-level blocks (paragraph, heading, list items, etc.)
          if (block.type === 'paragraph' || block.type === 'heading') {
            paragraphCount += 1;
          }
        }

        return { charCount, wordCount, paragraphCount };
      },

      async getMarkdown() {
        return editor.blocksToMarkdownLossy(editor.document);
      },

      async setContent(markdown: string) {
        const blocks = await editor.tryParseMarkdownToBlocks(markdown);
        editor.replaceBlocks(editor.document, blocks);
      },

      focus() {
        editor.focus();
      },

      onChange(callback: () => void) {
        return editor.onChange(callback);
      },
    };

    onEditorReady?.(handle);

    return () => {
      onEditorDestroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // ---- Wire onContentChange ----
  useEffect(() => {
    if (!onContentChange) return;
    return editor.onChange(onContentChange);
  }, [editor, onContentChange]);

  return (
    <BlockNoteView
      editor={editor}
      theme={darkMode ? 'dark' : 'light'}
      sideMenu={true}
      slashMenu={true}
      formattingToolbar={true}
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively extract plain text from a BlockNote block's inline content.
 */
function extractBlockText(block: { content?: unknown; children?: unknown[] }): string {
  let text = '';

  // Inline content is an array of InlineContent objects
  if (Array.isArray(block.content)) {
    for (const inline of block.content) {
      if (typeof inline === 'string') {
        text += inline;
      } else if (inline && typeof inline === 'object' && 'text' in inline) {
        text += (inline as { text: string }).text;
      }
    }
  }

  // Recurse into children (e.g. nested list items)
  if (Array.isArray((block as { children?: unknown[] }).children)) {
    for (const child of (block as { children: unknown[] }).children) {
      text += ' ' + extractBlockText(child as { content?: unknown; children?: unknown[] });
    }
  }

  return text;
}
