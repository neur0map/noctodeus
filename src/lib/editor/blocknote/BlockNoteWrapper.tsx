import React, { useEffect, useRef } from 'react';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { filterSuggestionItems } from '@blocknote/core';

import '@mantine/core/styles.css';
import '@blocknote/mantine/style.css';

import type { BlockNoteEditorProps, EditorHandle } from './types';
import { preprocessMarkdown, postprocessMarkdown } from './markdown';

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
    wikiItems,
  } = props;

  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const editor = useCreateBlockNote({
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

  // Detect clicks on [[wiki-link]] text patterns in the editor
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const el = e.target as HTMLElement;
      // Check if click is inside the editor
      if (!el.closest('.bn-editor')) return;

      // Get the text node at click position
      const selection = window.getSelection();
      if (!selection || !selection.anchorNode) return;

      const textContent = selection.anchorNode.textContent ?? '';
      const offset = selection.anchorOffset;

      // Find [[target]] pattern around the click position
      const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
      let match: RegExpExecArray | null;
      while ((match = wikiLinkRegex.exec(textContent)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (offset >= start && offset <= end) {
          e.preventDefault();
          onNavigateRef.current?.(match[1]);
          return;
        }
      }
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
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

  // Build wiki-link suggestion items from the file list
  const getWikiSuggestions = (query: string) => {
    const items = wikiItems?.() ?? [];
    const suggestions = items.map((item) => ({
      title: item.name.replace(/\.(md|markdown)$/i, ''),
      onItemClick: () => {
        const target = item.path.replace(/\.(md|markdown)$/i, '');
        editor.insertInlineContent([
          { type: 'text' as const, text: `[[${target}]]`, styles: {} },
        ]);
      },
      aliases: [item.title ?? ''].filter(Boolean),
      group: 'Wiki Links',
    }));
    return filterSuggestionItems(suggestions, query);
  };

  return (
    <BlockNoteView
      editor={editor}
      theme={darkMode ? 'dark' : 'light'}
      sideMenu={true}
      formattingToolbar={true}
      slashMenu={false}
    >
      {/* Default slash menu */}
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems(getDefaultReactSlashMenuItems(editor), query)
        }
      />
      {/* Wiki-link suggestion menu triggered by [[ */}
      <SuggestionMenuController
        triggerCharacter="["
        getItems={async (query) => getWikiSuggestions(query)}
      />
    </BlockNoteView>
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
