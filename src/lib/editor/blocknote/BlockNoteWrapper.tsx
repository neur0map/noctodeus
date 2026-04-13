import React, { useEffect, useRef } from 'react';
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  FormattingToolbar,
  FormattingToolbarController,
  getFormattingToolbarItems,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { filterSuggestionItems } from '@blocknote/core';
import { en as blockNoteEn } from '@blocknote/core/locales';
import {
  AIExtension,
  AIMenu,
  AIMenuController,
  AIToolbarButton,
  getAISlashMenuItems,
  getDefaultAIMenuItems,
} from '@blocknote/xl-ai';
import { en as aiEn } from '@blocknote/xl-ai/locales';
import '@blocknote/xl-ai/style.css';
import { multiColumnDropCursor, locales as multiColumnLocales } from '@blocknote/xl-multi-column';
import { getFabricAICommands } from './ai-commands';

import '@mantine/core/styles.css';
import '@blocknote/mantine/style.css';

import type { BlockNoteEditorProps, EditorHandle } from './types';
import { nodeusSchema } from './schema';
import { nodeusAITransport } from './ai-transport';
import {
  preprocessMarkdown,
  postprocessMarkdown,
  markdownToHTMLWithWikiLinks,
} from './markdown';

async function uploadFile(file: File): Promise<string> {
  try {
    // Send raw bytes to Rust which saves them directly into the core's media/ folder.
    // Returns a vault-relative path like "media/abc123.png".
    const { invoke } = await import('@tauri-apps/api/core');

    const buf = await file.arrayBuffer();
    const data = Array.from(new Uint8Array(buf));
    const ext = file.name.split('.').pop() || 'bin';

    const relativePath: string = await invoke('media_save', { data, extension: ext });
    return relativePath;
  } catch (err) {
    console.error('[uploadFile] Failed to save to media/:', err);
    return URL.createObjectURL(file);
  }
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
    schema: nodeusSchema,
    uploadFile,
    dropCursor: multiColumnDropCursor,
    dictionary: { ...blockNoteEn, ai: aiEn, multi_column: multiColumnLocales.en },
    extensions: [
      AIExtension({
        transport: nodeusAITransport(),
      }),
    ],
  });

  // Space on empty paragraph → open xl-ai's AIMenu at that block. This
  // preserves the Notion-style "Space to summon AI" UX while delegating
  // all the menu rendering to BlockNote's native components.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== ' ' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;

      const cursor = editor.getTextCursorPosition();
      const block = cursor.block;

      if (block.type !== 'paragraph') return;
      if (block.content && Array.isArray(block.content) && block.content.length > 0) {
        const text = block.content
          .map((ic: any) => (typeof ic === 'string' ? ic : ic.text ?? ''))
          .join('');
        if (text.length > 0) return;
      }

      e.preventDefault();
      editor.getExtension(AIExtension)?.openAIMenuAtBlock(block.id);
    }

    const editorEl = document.querySelector('.bn-editor');
    editorEl?.addEventListener('keydown', handleKeyDown as EventListener);
    return () => editorEl?.removeEventListener('keydown', handleKeyDown as EventListener);
  }, [editor]);

  // Load initial content using the wiki-link-aware HTML pipeline
  useEffect(() => {
    if (!initialContent?.trim()) return;
    try {
      const cleaned = preprocessMarkdown(initialContent);
      // Convert markdown to HTML, then inject wiki-link spans into the HTML,
      // then parse the HTML into blocks. This allows the WikiLink parse rule
      // to recognize <span data-wiki-target="..."> elements.
      const html = markdownToHTMLWithWikiLinks(cleaned);
      const blocks = editor.tryParseHTMLToBlocks(html);
      editor.replaceBlocks(editor.document, blocks);
    } catch (err) {
      console.error('[BlockNote] Failed to parse markdown:', err);
    }
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle clicks on wiki-link elements (dispatched as custom events from the WikiLink render)
  useEffect(() => {
    function handleWikiLinkClick(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.target) {
        onNavigateRef.current?.(detail.target);
      }
    }

    document.addEventListener('wiki-link-click', handleWikiLinkClick, true);
    return () => {
      document.removeEventListener('wiki-link-click', handleWikiLinkClick, true);
    };
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
        // Collect image widths from the block tree so we can reattach
        // =WIDTHx hints to the markdown output. blocksToMarkdownLossy
        // drops previewWidth by design (standard markdown has no image
        // size syntax), so resizes would otherwise not persist.
        const imageWidths: Record<string, number> = {};
        for (const block of editor.document) {
          collectImageWidths(block as any, imageWidths);
        }
        const raw = await editor.blocksToMarkdownLossy(editor.document);
        return postprocessMarkdown(raw, imageWidths);
      },

      async setContent(markdown: string) {
        const html = markdownToHTMLWithWikiLinks(preprocessMarkdown(markdown));
        const blocks = editor.tryParseHTMLToBlocks(html);
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

      blockNoteEditor: editor,
    };

    onEditorReady?.(handle);
    return () => { onEditorDestroy?.(); };
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wire onContentChange
  useEffect(() => {
    if (!onContentChange) return;
    return editor.onChange(onContentChange);
  }, [editor, onContentChange]);

  // Wiki-link suggestion items for the [[ trigger
  const getWikiMenuItems = () => {
    const items = wikiItems?.() ?? [];
    return items.map((item) => {
      const target = item.path.replace(/\.(md|markdown)$/i, '');
      const display = item.name.replace(/\.(md|markdown)$/i, '');
      return {
        title: display,
        onItemClick: () => {
          // clearQuery already removed [[ + query text before this runs.
          // Insert an actual wikiLink inline content node.
          editor.insertInlineContent([
            {
              type: 'wikiLink' as const,
              props: { target },
            },
            ' ',
          ]);
        },
        aliases: [target, item.title ?? ''].filter(Boolean),
        subtext: item.path,
      };
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <BlockNoteView
        editor={editor}
        theme={darkMode ? 'dark' : 'light'}
        sideMenu={true}
        formattingToolbar={false}
        slashMenu={false}
      >
        <AIMenuController
          aiMenu={(props) => (
            <AIMenu
              {...props}
              items={(ed, aiResponseStatus) => [
                ...getDefaultAIMenuItems(ed, aiResponseStatus),
                ...(aiResponseStatus === 'user-input' ? getFabricAICommands(ed) : []),
              ]}
            />
          )}
        />

        <FormattingToolbarController
          formattingToolbar={() => (
            <FormattingToolbar>
              {...getFormattingToolbarItems()}
              <AIToolbarButton />
            </FormattingToolbar>
          )}
        />

        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(
              [
                ...getDefaultReactSlashMenuItems(editor),
                ...getAISlashMenuItems(editor),
              ],
              query,
            )
          }
        />

        <SuggestionMenuController
          triggerCharacter="[["
          getItems={async (query) =>
            filterSuggestionItems(getWikiMenuItems(), query)
          }
        />
      </BlockNoteView>
    </div>
  );
}

/**
 * Walk a block and its children, collecting image URLs → previewWidth
 * into the target record. Used by getMarkdown() to preserve image
 * resizes across markdown round-trips.
 */
function collectImageWidths(
  block: { type?: string; props?: Record<string, unknown>; children?: unknown[] },
  out: Record<string, number>,
): void {
  if (block.type === 'image' && block.props) {
    const url = block.props.url as string | undefined;
    const previewWidth = block.props.previewWidth as number | undefined;
    if (url && typeof previewWidth === 'number' && Number.isFinite(previewWidth)) {
      out[url] = previewWidth;
    }
  }
  if (Array.isArray(block.children)) {
    for (const child of block.children) {
      collectImageWidths(child as any, out);
    }
  }
}

/**
 * Walk all image blocks in the editor document. If any use asset:// or blob:
 * URLs, fetch the image data and save to media/ via media_save, then update
 * the block's URL to the vault-relative path. This ensures images are portable
 * and sync-friendly.
 */
async function migrateImageUrls(editor: any): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const blocks = editor.document;
    const updates: Array<{ id: string; url: string }> = [];

    collectMigratableImages(blocks, updates);
    if (updates.length === 0) return;

    for (const { id, url } of updates) {
      try {
        let ext = 'png';

        if (url.startsWith('asset://')) {
          // asset://localhost/%2FUsers%2F... → /Users/...
          let filePath = url.replace(/^asset:\/\/localhost\//, '');
          filePath = decodeURIComponent(filePath);
          // Ensure leading slash on macOS/Linux
          if (!filePath.startsWith('/')) filePath = '/' + filePath;

          const dotIdx = filePath.lastIndexOf('.');
          if (dotIdx > 0) ext = filePath.substring(dotIdx + 1);

          // Use media_copy (reads from absolute path on disk) instead of
          // trying to read bytes in JS — avoids FS plugin permission issues
          const relativePath: string = await invoke('media_copy', { sourcePath: filePath });
          editor.updateBlock(id, { props: { url: relativePath } });
        } else if (url.startsWith('blob:')) {
          // Blob URL — fetch the bytes and save via media_save
          const resp = await fetch(url);
          const buf = await resp.arrayBuffer();
          const data = Array.from(new Uint8Array(buf));
          const relativePath: string = await invoke('media_save', { data, extension: ext });
          editor.updateBlock(id, { props: { url: relativePath } });
        }
      } catch (err) {
        console.warn(`[migrateImageUrls] Failed to migrate image ${url}:`, err);
      }
    }
  } catch {
    // If Tauri APIs aren't available, skip migration silently
  }
}

function collectMigratableImages(
  blocks: any[],
  out: Array<{ id: string; url: string }>,
): void {
  for (const block of blocks) {
    if (block.type === 'image' && block.props?.url) {
      const url = block.props.url as string;
      if (url.startsWith('asset://') || url.startsWith('blob:')) {
        out.push({ id: block.id, url });
      }
    }
    if (Array.isArray(block.children)) {
      collectMigratableImages(block.children, out);
    }
  }
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
        // Custom inline content (e.g., wikiLink) -- extract props
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
