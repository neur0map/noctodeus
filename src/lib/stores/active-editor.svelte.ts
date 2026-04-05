import type { Editor } from '@tiptap/core';

let activeEditor = $state<Editor | null>(null);

export function getActiveEditorState() {
  return {
    get editor() { return activeEditor; },
    set(editor: Editor | null) { activeEditor = editor; },
  };
}
