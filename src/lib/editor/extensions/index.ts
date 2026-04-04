import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { createLowlight, common } from 'lowlight';
import { WikiLink } from './wiki-link.js';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';

import type { Extensions } from '@tiptap/core';

const lowlight = createLowlight(common);

export interface EditorExtensionOptions {
  placeholder?: string;
}

export function createEditorExtensions(
  options: EditorExtensionOptions = {},
): Extensions {
  const { placeholder = 'Start writing...' } = options;

  return [
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
    Image.configure({
      inline: false,
      allowBase64: false,
    }),
    Placeholder.configure({
      placeholder,
    }),
    WikiLink,
    GlobalDragHandle.configure({
      dragHandleWidth: 24,
    }),
  ];
}
