import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { createLowlight, common } from 'lowlight';
import { WikiLink } from './wiki-link.js';
import { createSlashCommand } from './slash-command.js';
import { VideoBlock } from './video-block.js';
import { AudioBlock } from './audio-block.js';
import { EmbedBlock } from './embed-block.js';
import { createMediaDrop, type MediaUploader } from './media-drop.js';

import type { Extensions } from '@tiptap/core';

const lowlight = createLowlight(common);

export interface EditorExtensionOptions {
  placeholder?: string;
  slashPopup?: () => any;
  mediaUploader?: MediaUploader;
}

export function createEditorExtensions(
  options: EditorExtensionOptions = {},
): Extensions {
  const { placeholder = 'Start writing...', slashPopup, mediaUploader } = options;

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
    Image.configure({
      inline: false,
      allowBase64: false,
    }),
    Placeholder.configure({
      placeholder,
    }),
    WikiLink,
    VideoBlock,
    AudioBlock,
    EmbedBlock,
  ];

  if (slashPopup) {
    extensions.push(createSlashCommand(slashPopup));
  }

  if (mediaUploader) {
    extensions.push(createMediaDrop(mediaUploader));
  }

  return extensions;
}
