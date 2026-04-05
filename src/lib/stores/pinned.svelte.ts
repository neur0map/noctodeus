import type { FileNode } from '../types/core';
import { addPin, removePin, searchPinned } from '../bridge/commands';

let pinnedFiles = $state<FileNode[]>([]);
let pinnedPaths = $state<Set<string>>(new Set());

export function getPinnedState() {
  return {
    get files() { return pinnedFiles; },
    get paths() { return pinnedPaths; },

    async load() {
      try {
        const files = await searchPinned();
        pinnedFiles = files;
        pinnedPaths = new Set(files.map(f => f.path));
      } catch {
        pinnedFiles = [];
        pinnedPaths = new Set();
      }
    },

    isPinned(path: string): boolean {
      return pinnedPaths.has(path);
    },

    async pin(path: string) {
      try {
        await addPin(path);
        pinnedPaths = new Set([...pinnedPaths, path]);
        // Reload full list to get FileNode metadata
        await this.load();
      } catch {
        // revert
      }
    },

    async unpin(path: string) {
      try {
        await removePin(path);
        pinnedPaths = new Set([...pinnedPaths].filter(p => p !== path));
        pinnedFiles = pinnedFiles.filter(f => f.path !== path);
      } catch {
        // revert
      }
    },

    async toggle(path: string) {
      if (pinnedPaths.has(path)) {
        await this.unpin(path);
      } else {
        await this.pin(path);
      }
    },

    reset() {
      pinnedFiles = [];
      pinnedPaths = new Set();
    },
  };
}
