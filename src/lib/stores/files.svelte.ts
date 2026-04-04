import type { FileNode, TreeNode } from '../types/core';

export type SortMode = 'name-asc' | 'name-desc' | 'modified-new' | 'modified-old';

let fileMap = $state<Map<string, FileNode>>(new Map());
let expandedDirs = $state<Set<string>>(new Set());
let activeFilePath = $state<string | null>(null);
let sortMode = $state<SortMode>('name-asc');

// Derived tree structure from flat map
let tree = $derived.by(() => {
  return buildTree(fileMap, expandedDirs, sortMode);
});

const HIDDEN_FILES = new Set(['.DS_Store', '.noctodeus', 'Thumbs.db', '.git', '.gitignore', 'media']);

function buildTree(files: Map<string, FileNode>, expanded: Set<string>, sort: SortMode): TreeNode[] {
  const childMap = new Map<string, TreeNode[]>();

  // Group files by parent_dir, skipping hidden/system files
  for (const file of files.values()) {
    if (HIDDEN_FILES.has(file.name) || file.name.startsWith('.')) continue;
    const parent = file.parent_dir || '';
    if (!childMap.has(parent)) childMap.set(parent, []);
    childMap.get(parent)!.push({
      ...file,
      children: [],
      expanded: expanded.has(file.path),
    });
  }

  // Sort: directories first, then by chosen mode
  const sortNodes = (a: TreeNode, b: TreeNode) => {
    if (a.is_directory !== b.is_directory) return a.is_directory ? -1 : 1;
    switch (sort) {
      case 'name-asc':
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      case 'name-desc':
        return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      case 'modified-new':
        return b.modified_at - a.modified_at;
      case 'modified-old':
        return a.modified_at - b.modified_at;
      default:
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }
  };

  // Build tree recursively
  function attachChildren(node: TreeNode): TreeNode {
    const children = childMap.get(node.path) || [];
    children.sort(sortNodes);
    node.children = children.map(attachChildren);
    return node;
  }

  // Root level entries (scanner uses "." for root, also check "" and "/")
  const roots = childMap.get('.') || childMap.get('') || childMap.get('/') || [];
  roots.sort(sortNodes);
  return roots.map(attachChildren);
}

export function getFilesState() {
  return {
    get fileMap() {
      return fileMap;
    },
    get tree() {
      return tree;
    },
    get activeFilePath() {
      return activeFilePath;
    },
    get expandedDirs() {
      return expandedDirs;
    },
    get sortMode() {
      return sortMode;
    },

    setSortMode(mode: SortMode) {
      sortMode = mode;
    },
    setFiles(files: FileNode[]) {
      const map = new Map<string, FileNode>();
      for (const f of files) map.set(f.path, f);
      fileMap = map;
    },
    addFile(file: FileNode) {
      const newMap = new Map(fileMap);
      newMap.set(file.path, file);
      fileMap = newMap;
    },
    updateFile(file: FileNode) {
      const newMap = new Map(fileMap);
      newMap.set(file.path, file);
      fileMap = newMap;
    },
    removeFile(path: string) {
      const newMap = new Map(fileMap);
      newMap.delete(path);
      fileMap = newMap;
    },
    renameFile(oldPath: string, newPath: string, file: FileNode) {
      const newMap = new Map(fileMap);
      newMap.delete(oldPath);
      newMap.set(newPath, file);
      fileMap = newMap;
    },
    toggleDir(path: string) {
      const newSet = new Set(expandedDirs);
      if (newSet.has(path)) newSet.delete(path);
      else newSet.add(path);
      expandedDirs = newSet;
    },
    setActiveFile(path: string | null) {
      activeFilePath = path;
    },
    reset() {
      fileMap = new Map();
      expandedDirs = new Set();
      activeFilePath = null;
    },
  };
}
