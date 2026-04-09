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

  // Wrap [[wiki-link]] text in styled <span> elements and handle clicks.
  // Runs after content changes to find and decorate wiki-link patterns.
  useEffect(() => {
    function decorateWikiLinks() {
      const editorEl = document.querySelector('.bn-editor');
      if (!editorEl) return;

      // Walk all text nodes looking for [[...]] patterns
      const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
      const nodesToProcess: { node: Text; matches: RegExpExecArray[] }[] = [];

      let textNode: Text | null;
      while ((textNode = walker.nextNode() as Text | null)) {
        // Skip if already inside a wiki-link span
        if (textNode.parentElement?.classList.contains('wiki-link')) continue;

        const matches: RegExpExecArray[] = [];
        const regex = /\[\[([^\]]+)\]\]/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(textNode.textContent ?? '')) !== null) {
          matches.push({ ...match, index: match.index } as RegExpExecArray);
        }
        if (matches.length > 0) {
          nodesToProcess.push({ node: textNode, matches });
        }
      }

      // Process in reverse to not invalidate indices
      for (const { node, matches } of nodesToProcess.reverse()) {
        const parent = node.parentNode;
        if (!parent) continue;

        let lastIndex = 0;
        const frag = document.createDocumentFragment();

        for (const m of matches) {
          // Text before the match
          if (m.index > lastIndex) {
            frag.appendChild(document.createTextNode(node.textContent!.slice(lastIndex, m.index)));
          }
          // The wiki-link span
          const span = document.createElement('span');
          span.className = 'wiki-link';
          span.dataset.target = m[1];
          span.textContent = m[0];
          span.setAttribute('contenteditable', 'false');
          frag.appendChild(span);
          lastIndex = m.index + m[0].length;
        }

        // Remaining text after last match
        if (lastIndex < (node.textContent?.length ?? 0)) {
          frag.appendChild(document.createTextNode(node.textContent!.slice(lastIndex)));
        }

        parent.replaceChild(frag, node);
      }
    }

    // Run decoration after content loads and on changes
    const timer = setTimeout(decorateWikiLinks, 100);
    const unsub = editor.onChange(() => {
      // Debounce decoration to avoid running on every keystroke
      clearTimeout(decorateTimer);
      decorateTimer = setTimeout(decorateWikiLinks, 300);
    });
    let decorateTimer: ReturnType<typeof setTimeout>;

    // Handle clicks on wiki-link spans
    function handleClick(e: MouseEvent) {
      const span = (e.target as HTMLElement).closest('.wiki-link') as HTMLElement | null;
      if (!span) return;
      e.preventDefault();
      e.stopPropagation();
      const target = span.dataset.target;
      if (target) onNavigateRef.current?.(target);
    }

    document.addEventListener('click', handleClick, true);

    return () => {
      clearTimeout(timer);
      clearTimeout(decorateTimer);
      unsub();
      document.removeEventListener('click', handleClick, true);
    };
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

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
