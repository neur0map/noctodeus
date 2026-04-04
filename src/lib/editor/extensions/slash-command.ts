import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type { Editor, Range } from '@tiptap/core';

export interface SlashCommandItem {
  id: string;
  label: string;
  icon: string;
  description: string;
  shortcut?: string;
  command: (editor: Editor, range: Range) => void;
}

const COMMANDS: SlashCommandItem[] = [
  {
    id: 'text',
    label: 'Text',
    icon: 'T',
    description: 'Plain text block',
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
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    id: 'image',
    label: 'Image',
    icon: '▣',
    description: 'Embed an image from URL',
    command: (editor, range) => {
      const url = window.prompt('Image URL');
      if (url) {
        editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
      }
    },
  },
];

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  // Simple fuzzy: every char in query appears in order in text
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

// The popup renderer interface expected by @tiptap/suggestion
export interface SlashCommandPopup {
  show: (props: { query: string; items: SlashCommandItem[]; clientRect: (() => DOMRect | null) | null; command: (item: SlashCommandItem) => void }) => void;
  update: (props: { query: string; items: SlashCommandItem[]; clientRect: (() => DOMRect | null) | null; command: (item: SlashCommandItem) => void }) => void;
  hide: () => void;
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export type CreatePopup = () => SlashCommandPopup;

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
          ...this.options.suggestion,
        }),
      ];
    },
  });
}
