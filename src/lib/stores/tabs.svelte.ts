import type { FileNode } from '../types/core';

export interface Tab {
  id: string;
  type: 'home' | 'file' | 'research';
  fileNode?: FileNode;
  label: string;
}

const HOME_TAB: Tab = { id: '__home__', type: 'home', label: 'Home' };

let tabs = $state<Tab[]>([HOME_TAB]);
let activeTabId = $state<string>(HOME_TAB.id);

export function getTabsState() {
  return {
    get tabs() { return tabs; },
    get activeTabId() { return activeTabId; },
    get activeTab() { return tabs.find(t => t.id === activeTabId) ?? HOME_TAB; },

    activateTab(id: string) {
      if (tabs.some(t => t.id === id)) {
        activeTabId = id;
      }
    },

    openFile(file: FileNode) {
      const existing = tabs.find(t => t.type === 'file' && t.fileNode?.path === file.path);
      if (existing) {
        activeTabId = existing.id;
        return;
      }
      const tab: Tab = {
        id: `file:${file.path}`,
        type: 'file',
        fileNode: file,
        label: file.title || file.name,
      };
      tabs = [...tabs, tab];
      activeTabId = tab.id;
    },

    openResearch() {
      const existing = tabs.find(t => t.type === 'research');
      if (existing) {
        activeTabId = existing.id;
        return;
      }
      const tab: Tab = {
        id: '__research__',
        type: 'research',
        label: 'Research',
      };
      tabs = [...tabs, tab];
      activeTabId = tab.id;
    },

    closeTab(id: string) {
      if (id === HOME_TAB.id) return;
      const idx = tabs.findIndex(t => t.id === id);
      if (idx === -1) return;

      const wasActive = activeTabId === id;
      // Cleanup research session when closing research tab
      const closingTab = tabs.find(t => t.id === id);
      if (closingTab?.type === 'research') {
        import('$lib/stores/research.svelte').then(m => m.getResearchState().clearAll());
      }
      tabs = tabs.filter(t => t.id !== id);

      if (wasActive) {
        const newIdx = Math.min(idx, tabs.length - 1);
        activeTabId = tabs[newIdx].id;
      }
    },

    reorderTabs(fromIndex: number, toIndex: number) {
      if (fromIndex === 0 || toIndex === 0) return;
      if (fromIndex === toIndex) return;

      const newTabs = [...tabs];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      tabs = newTabs;
    },

    updateFileTab(oldPath: string, file: FileNode) {
      tabs = tabs.map(t => {
        if (t.type === 'file' && t.fileNode?.path === oldPath) {
          return { ...t, id: `file:${file.path}`, fileNode: file, label: file.title || file.name };
        }
        return t;
      });
      if (activeTabId === `file:${oldPath}`) {
        activeTabId = `file:${file.path}`;
      }
    },

    removeFileTab(path: string) {
      const id = `file:${path}`;
      const idx = tabs.findIndex(t => t.id === id);
      if (idx === -1) return;

      const wasActive = activeTabId === id;
      tabs = tabs.filter(t => t.id !== id);

      if (wasActive) {
        const newIdx = Math.min(idx, tabs.length - 1);
        activeTabId = tabs[newIdx].id;
      }
    },

    goHome() {
      activeTabId = HOME_TAB.id;
    },

    reset() {
      tabs = [HOME_TAB];
      activeTabId = HOME_TAB.id;
    },
  };
}
