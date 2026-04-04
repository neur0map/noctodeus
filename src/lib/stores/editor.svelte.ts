let currentPath = $state<string | null>(null);
let dirty = $state(false);
let saveStatus = $state<'saved' | 'saving' | 'unsaved'>('saved');
let lastSavedHash = $state<string | null>(null);

export function getEditorState() {
  return {
    get currentPath() {
      return currentPath;
    },
    get dirty() {
      return dirty;
    },
    get saveStatus() {
      return saveStatus;
    },
    get lastSavedHash() {
      return lastSavedHash;
    },

    setPath(path: string | null) {
      currentPath = path;
      dirty = false;
      saveStatus = 'saved';
    },
    markDirty() {
      dirty = true;
      saveStatus = 'unsaved';
    },
    markSaving() {
      saveStatus = 'saving';
    },
    markSaved(hash: string) {
      dirty = false;
      saveStatus = 'saved';
      lastSavedHash = hash;
    },
    isOwnSave(hash: string | null): boolean {
      if (!hash || !lastSavedHash) return false;
      return lastSavedHash === hash;
    },

    reset() {
      currentPath = null;
      dirty = false;
      saveStatus = 'saved';
      lastSavedHash = null;
    },
  };
}
