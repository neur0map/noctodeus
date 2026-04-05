import type { Editor } from '@tiptap/core';

let activeEditor = $state<Editor | null>(null);
let wordCount = $state(0);
let cleanup: (() => void) | null = null;

function countWords(ed: Editor) {
  const text = ed.state.doc.textBetween(0, ed.state.doc.content.size, ' ', ' ').trim();
  if (!text) { wordCount = 0; return; }

  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
    let count = 0;
    for (const segment of segmenter.segment(text)) {
      if (segment.isWordLike) count++;
    }
    wordCount = count;
  } else {
    const matches = text.match(/\S+/g);
    wordCount = matches ? matches.length : 0;
  }
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
