import type { EditorHandle } from '$lib/editor/blocknote/types';

let activeHandle = $state<EditorHandle | null>(null);
let charCount = $state(0);
let cleanup: (() => void) | null = null;

function updateCharCount(handle: EditorHandle) {
  const stats = handle.getStats();
  charCount = stats.charCount;
}

export function getActiveEditorState() {
  return {
    get handle() { return activeHandle; },
    /** @deprecated — use handle instead. Kept for transition. */
    get editor() { return activeHandle; },
    get charCount() { return charCount; },

    set(handle: EditorHandle | null) {
      cleanup?.();
      cleanup = null;
      activeHandle = handle;

      if (handle) {
        updateCharCount(handle);
        cleanup = handle.onChange(() => updateCharCount(handle));
      } else {
        charCount = 0;
      }
    },
  };
}
