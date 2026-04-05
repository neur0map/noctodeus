import type { Editor } from '@tiptap/core';

let activeEditor = $state<Editor | null>(null);
let charCount = $state(0);
let cleanup: (() => void) | null = null;

function updateCharCount(ed: Editor) {
  const text = ed.state.doc.textContent;
  charCount = text.replace(/\s/g, '').length;
}

export function getActiveEditorState() {
  return {
    get editor() { return activeEditor; },
    get charCount() { return charCount; },

    set(editor: Editor | null) {
      cleanup?.();
      cleanup = null;
      activeEditor = editor;

      if (editor) {
        updateCharCount(editor);
        const handler = () => updateCharCount(editor);
        editor.on('update', handler);
        cleanup = () => editor.off('update', handler);
      } else {
        charCount = 0;
      }
    },
  };
}
