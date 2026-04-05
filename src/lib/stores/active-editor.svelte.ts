import type { Editor } from '@tiptap/core';

let activeEditor = $state<Editor | null>(null);
let wordCount = $state(0);
let cleanup: (() => void) | null = null;

function countWords(ed: Editor) {
  const text = ed.state.doc.textContent.trim();
  wordCount = text ? text.split(/\s+/).length : 0;
}

export function getActiveEditorState() {
  return {
    get editor() { return activeEditor; },
    get wordCount() { return wordCount; },

    set(editor: Editor | null) {
      cleanup?.();
      cleanup = null;
      activeEditor = editor;

      if (editor) {
        countWords(editor);
        const handler = () => countWords(editor);
        editor.on('update', handler);
        cleanup = () => editor.off('update', handler);
      } else {
        wordCount = 0;
      }
    },
  };
}
