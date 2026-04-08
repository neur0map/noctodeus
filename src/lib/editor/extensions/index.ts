import { DragHandle } from '@tiptap/extension-drag-handle';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import { TableKit } from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import CharacterCount from '@tiptap/extension-character-count';
import Focus from '@tiptap/extension-focus';
import { ResizableImage } from './resizable-image.js';
import Placeholder from '@tiptap/extension-placeholder';
import { createLowlight, common } from 'lowlight';
import { WikiLink } from './wiki-link.js';
import { createSlashCommand } from './slash-command.js';
import { createWikiLinkSuggest, type WikiSuggestItem } from './wiki-link-suggest.js';
import { VideoBlock } from './video-block.js';
import { AudioBlock } from './audio-block.js';
import { EmbedBlock } from './embed-block.js';
import { createMediaDrop, type MediaUploader } from './media-drop.js';
import { SearchReplace } from './search-replace.js';
import { AiPrompt, type AiPromptOptions } from './ai-prompt.js';
import type { Extensions } from '@tiptap/core';

const lowlight = createLowlight(common);

export interface EditorExtensionOptions {
  placeholder?: string;
  slashPopup?: () => any;
  wikiPopup?: () => any;
  wikiItems?: () => WikiSuggestItem[];
  mediaUploader?: MediaUploader;
  inlineAi?: Partial<AiPromptOptions>;
}

export function createEditorExtensions(
  options: EditorExtensionOptions = {},
): Extensions {
  const {
    placeholder = 'Start writing...',
    slashPopup,
    wikiPopup,
    wikiItems,
    mediaUploader,
    inlineAi,
  } = options;

  const extensions: Extensions = [
    StarterKit.configure({
      codeBlock: false,
    }),
    CodeBlockLowlight.configure({
      lowlight,
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
    }),

    // Tables (TableKit bundles Table, TableRow, TableCell, TableHeader)
    TableKit.configure({
      table: {
        allowTableNodeSelection: true,
      },
    }),

    // Text formatting
    Highlight.configure({
      multicolor: true,
    }),
    Subscript,
    Superscript,
    Underline,
    TextStyle,
    Color,

    // Alignment
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),

    // Typography (smart quotes, dashes, ellipsis)
    Typography,

    // Character count
    CharacterCount,

    // Focus styling
    Focus.configure({
      className: 'has-focus',
      mode: 'deepest',
    }),

    // Drag handle (Notion-style 6-dot grip)
    DragHandle.configure({
      nested: true,
      render() {
        const el = document.createElement('div');
        el.className = 'drag-handle';
        el.setAttribute('draggable', 'true');
        el.setAttribute('data-drag-handle', '');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', 'Drag to move');
        el.setAttribute('tabindex', '-1');
        // 6-dot grid icon (2 cols × 3 rows)
        el.innerHTML = `<svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor">
          <circle cx="4" cy="4" r="1.5"/>
          <circle cx="10" cy="4" r="1.5"/>
          <circle cx="4" cy="10" r="1.5"/>
          <circle cx="10" cy="10" r="1.5"/>
          <circle cx="4" cy="16" r="1.5"/>
          <circle cx="10" cy="16" r="1.5"/>
        </svg>`;
        return el;
      },
      onElementDragStart(e) {
        // Create a compact drag ghost instead of the browser's default
        // which snapshots the entire block and can be huge
        if (!e.dataTransfer) return;
        const ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.textContent = 'Moving block...';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        // Clean up after the browser captures the image
        requestAnimationFrame(() => ghost.remove());
      },
    }),

    // Custom extensions
    ResizableImage,
    Placeholder.configure({
      placeholder,
    }),
    WikiLink,
    VideoBlock,
    AudioBlock,
    EmbedBlock,
    SearchReplace,
    AiPrompt.configure(inlineAi ?? {}),
  ];

  if (slashPopup) {
    extensions.push(createSlashCommand(slashPopup));
  }

  if (wikiPopup && wikiItems) {
    extensions.push(createWikiLinkSuggest(wikiPopup, wikiItems));
  }

  if (mediaUploader) {
    extensions.push(createMediaDrop(mediaUploader));
  }

  return extensions;
}
