import React, { useEffect, useCallback, useRef } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';

import '@mantine/core/styles.css';
import '@blocknote/mantine/style.css';

import type { BlockNoteEditorProps, EditorHandle } from './types';
import { preprocessMarkdown, postprocessMarkdown } from './markdown';
import { noctodeusSchema } from './schema';

async function uploadFile(file: File): Promise<string> {
  return URL.createObjectURL(file);
}

export default function BlockNoteWrapper(props: BlockNoteEditorProps) {
  const {
    initialContent,
    onContentChange,
    onNavigate,
    onEditorReady,
    onEditorDestroy,
    darkMode = false,
  } = props;

  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const editor = useCreateBlockNote({
    schema: noctodeusSchema,
    uploadFile,
  });

  // Load initial content
  useEffect(() => {
    if (!initialContent?.trim()) return;
    try {
      const cleaned = preprocessMarkdown(initialContent);
      const blocks = editor.tryParseMarkdownToBlocks(cleaned);
      editor.replaceBlocks(editor.document, blocks);
    } catch (err) {
      console.error('[BlockNote] Failed to parse markdown:', err);
    }
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for wiki-link clicks (bubbled from the WikiLink inline content)
  useEffect(() => {
    function handleWikiClick(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.target && onNavigateRef.current) {
        onNavigateRef.current(detail.target);
      }
    }

    document.addEventListener('wiki-link-click', handleWikiClick);
    return () => document.removeEventListener('wiki-link-click', handleWikiClick);
  }, []);

  // Build and expose EditorHandle
  useEffect(() => {
    const handle: EditorHandle = {
      getHeadings() {
        const headings: Array<{ level: number; text: string; id: string }> = [];
        for (const block of editor.document) {
          if (block.type === 'heading') {
            headings.push({
              level: (block.props as { level?: number }).level ?? 1,
              text: extractBlockText(block),
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
            charCount += text.replace(/\s/g, '').length;
            wordCount += text.trim().split(/\s+/).filter(Boolean).length;
          }
          if (block.type === 'paragraph' || block.type === 'heading') {
            paragraphCount += 1;
          }
        }
        return { charCount, wordCount, paragraphCount };
      },

      async getMarkdown() {
        const raw = await editor.blocksToMarkdownLossy(editor.document);
        return postprocessMarkdown(raw);
      },

      async setContent(markdown: string) {
        const blocks = editor.tryParseMarkdownToBlocks(preprocessMarkdown(markdown));
        editor.replaceBlocks(editor.document, blocks);
      },

      focus() {
        editor.focus();
      },

      scrollToBlock(id: string) {
        try {
          editor.setTextCursorPosition(id, 'start');
          const element = document.querySelector(`[data-id="${id}"]`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {
          // Block may no longer exist
        }
      },

      onChange(callback: () => void) {
        return editor.onChange(callback);
      },
    };

    onEditorReady?.(handle);
    return () => { onEditorDestroy?.(); };
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wire onContentChange
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

function extractBlockText(block: { content?: unknown; children?: unknown[] }): string {
  let text = '';
  if (Array.isArray(block.content)) {
    for (const inline of block.content) {
      if (typeof inline === 'string') {
        text += inline;
      } else if (inline && typeof inline === 'object' && 'text' in inline) {
        text += (inline as { text: string }).text;
      } else if (inline && typeof inline === 'object' && 'type' in inline) {
        // Custom inline content (e.g., wikiLink) — extract props
        const ic = inline as { type: string; props?: Record<string, string> };
        if (ic.type === 'wikiLink' && ic.props?.target) {
          text += ic.props.target;
        }
      }
    }
  }
  if (Array.isArray(block.children)) {
    for (const child of block.children) {
      text += ' ' + extractBlockText(child as { content?: unknown; children?: unknown[] });
    }
  }
  return text;
}
