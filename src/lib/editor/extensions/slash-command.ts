import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import type { Editor, Range } from '@tiptap/core';
import { detectEmbed } from './embed-block.js';

export interface SlashCommandItem {
  id: string;
  label: string;
  icon: string;
  description: string;
  shortcut?: string;
  group: string;
  command: (editor: Editor, range: Range) => void;
}

const COMMANDS: SlashCommandItem[] = [
  // --- Basic blocks ---
  {
    id: 'text',
    label: 'Text',
    icon: 'T',
    description: 'Plain text block',
    group: 'Basic blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    id: 'heading1',
    label: 'Heading 1',
    icon: 'H1',
    description: 'Large heading',
    shortcut: '#',
    group: 'Basic blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    icon: 'H2',
    description: 'Medium heading',
    shortcut: '##',
    group: 'Basic blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    icon: 'H3',
    description: 'Small heading',
    shortcut: '###',
    group: 'Basic blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    id: 'bullet-list',
    label: 'Bulleted list',
    icon: '•',
    description: 'Unordered list',
    shortcut: '-',
    group: 'Basic blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: 'numbered-list',
    label: 'Numbered list',
    icon: '1.',
    description: 'Ordered list',
    shortcut: '1.',
    group: 'Basic blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: 'task-list',
    label: 'To-do list',
    icon: '☐',
    description: 'Checklist with tasks',
    shortcut: '[]',
    group: 'Basic blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: 'blockquote',
    label: 'Quote',
    icon: '❝',
    description: 'Block quote',
    shortcut: '>',
    group: 'Basic blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setBlockquote().run();
    },
  },
  {
    id: 'code-block',
    label: 'Code block',
    icon: '</>',
    description: 'Syntax highlighted code',
    shortcut: '```',
    group: 'Basic blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run();
    },
  },
  {
    id: 'horizontal-rule',
    label: 'Divider',
    icon: '—',
    description: 'Horizontal rule',
    shortcut: '---',
    group: 'Basic blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },

  // --- Advanced blocks ---
  {
    id: 'table',
    label: 'Table',
    icon: '⊞',
    description: 'Insert a table',
    group: 'Advanced',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    id: 'highlight',
    label: 'Highlight',
    icon: '🖍',
    description: 'Highlight selected text',
    group: 'Advanced',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleHighlight().run();
    },
  },

  // --- Media ---
  {
    id: 'image',
    label: 'Image',
    icon: '▣',
    description: 'Upload or embed an image',
    group: 'Media',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      // Dispatch custom event — Editor.svelte handles the file picker
      (globalThis as any).__noctodeusShowMediaPanel?.('image');
    },
  },
  {
    id: 'video',
    label: 'Video',
    icon: '▶',
    description: 'Upload a video file',
    group: 'Media',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      (globalThis as any).__noctodeusShowMediaPanel?.('video');
    },
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: '♫',
    description: 'Upload an audio file',
    group: 'Media',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      (globalThis as any).__noctodeusShowMediaPanel?.('audio');
    },
  },
  {
    id: 'embed-url',
    label: 'Embed URL',
    icon: '⊞',
    description: 'YouTube, Spotify, or any link',
    group: 'Media',
    command: (editor, range) => {
      const url = window.prompt('Paste a URL');
      if (!url) return;

      editor.chain().focus().deleteRange(range).run();

      const embed = detectEmbed(url);
      const attrs: Record<string, unknown> = {
        url,
        embedType: embed.type,
        embedUrl: embed.embedUrl ?? null,
        provider: embed.provider ?? null,
      };

      (editor.commands as any).setEmbed(attrs);
    },
  },
];

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export type CreatePopup = () => any;

export function createSlashCommand(createPopup: CreatePopup) {
  return Extension.create({
    name: 'slashCommand',

    addOptions() {
      return {
        suggestion: {
          char: '/',
          startOfLine: false,
          items: ({ query }: { query: string }) => {
            if (!query) return COMMANDS;
            return COMMANDS.filter(
              (cmd) =>
                fuzzyMatch(query, cmd.label) ||
                fuzzyMatch(query, cmd.description) ||
                (cmd.shortcut && fuzzyMatch(query, cmd.shortcut)),
            );
          },
          render: createPopup,
          command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashCommandItem }) => {
            props.command(editor, range);
          },
        },
      };
    },

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          pluginKey: new PluginKey('slashCommandSuggestion'),
          ...this.options.suggestion,
        }),
      ];
    },
  });
}
