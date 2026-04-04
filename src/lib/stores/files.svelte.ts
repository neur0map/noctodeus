import type { FileNode, TreeNode } from '../types/core';

let fileMap = $state<Map<string, FileNode>>(new Map());
let expandedDirs = $state<Set<string>>(new Set());
let activeFilePath = $state<string | null>(null);

// Derived tree structure from flat map
let tree = $derived.by(() => {
  return buildTree(fileMap, expandedDirs);
});

function buildTree(files: Map<string, FileNode>, expanded: Set<string>): TreeNode[] {
  const childMap = new Map<string, TreeNode[]>();

  // Group files by parent_dir
  for (const file of files.values()) {
    const parent = file.parent_dir || '';
    if (!childMap.has(parent)) childMap.set(parent, []);
    childMap.get(parent)!.push({
      ...file,
      children: [],
      expanded: expanded.has(file.path),
    });
  }

  // Sort: directories first, then alphabetical case-insensitive
  const sortNodes = (a: TreeNode, b: TreeNode) => {
    if (a.is_directory !== b.is_directory) return a.is_directory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  };

  // Build tree recursively
  function attachChildren(node: TreeNode): TreeNode {
    const children = childMap.get(node.path) || [];
    children.sort(sortNodes);
    node.children = children.map(attachChildren);
    return node;
  }

  // Root level entries (empty parent_dir or "/" or the core root)
  const roots = childMap.get('') || childMap.get('/') || [];
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
