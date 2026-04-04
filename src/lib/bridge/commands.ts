import { invoke } from '@tauri-apps/api/core';
import type { CoreInfo, FileContent, FileNode, SearchHit } from '../types/core';

// Re-export for convenience
export type { FileContent };

// ---------------------------------------------------------------------------
// Core commands
// ---------------------------------------------------------------------------

export async function createCore(path: string, name: string): Promise<CoreInfo> {
  return invoke('core_create', { path, name });
}

export async function openCore(path: string): Promise<CoreInfo> {
  return invoke('core_open', { path });
}

export async function closeCore(): Promise<void> {
  return invoke('core_close');
}

export async function listCores(): Promise<CoreInfo[]> {
  return invoke('core_list');
}

// ---------------------------------------------------------------------------
// File commands
// ---------------------------------------------------------------------------

export async function createFile(path: string, content?: string): Promise<FileNode> {
  return invoke('file_create', { path, content });
}

export async function readFile(path: string): Promise<FileContent> {
  return invoke('file_read', { path });
}

export async function writeFile(path: string, content: string): Promise<FileNode> {
  return invoke('file_write', { path, content });
}

export async function deleteFile(path: string): Promise<void> {
  return invoke('file_delete', { path });
}

export async function renameFile(oldPath: string, newPath: string): Promise<FileNode> {
  return invoke('file_rename', { oldPath, newPath });
}

export async function moveFile(path: string, newParent: string): Promise<FileNode> {
  return invoke('file_move', { path, newParent });
}

export async function duplicateFile(path: string): Promise<FileNode> {
  return invoke('file_duplicate', { path });
}

export async function createDir(path: string): Promise<void> {
  return invoke('dir_create', { path });
}

export async function deleteDir(path: string, recursive: boolean): Promise<void> {
  return invoke('dir_delete', { path, recursive });
}

// ---------------------------------------------------------------------------
// Search commands
// ---------------------------------------------------------------------------

export async function searchQuery(text: string, scope?: string): Promise<SearchHit[]> {
  return invoke('search_query', { text, scope });
}

export async function searchRecent(limit: number): Promise<FileNode[]> {
  return invoke('search_recent', { limit });
}

export async function searchPinned(): Promise<FileNode[]> {
  return invoke('search_pinned');
}

// ---------------------------------------------------------------------------
// Pin commands
// ---------------------------------------------------------------------------

export async function addPin(path: string): Promise<void> {
  return invoke('pin_add', { path });
}

export async function removePin(path: string): Promise<void> {
  return invoke('pin_remove', { path });
}

// ---------------------------------------------------------------------------
// State commands
// ---------------------------------------------------------------------------

export async function saveState(key: string, value: string): Promise<void> {
  return invoke('state_save', { key, value });
}

export async function loadState(key: string): Promise<string | null> {
  return invoke('state_load', { key });
}

// ---------------------------------------------------------------------------
// Log commands
// ---------------------------------------------------------------------------

export async function logWrite(level: string, message: string, ctx?: string): Promise<void> {
  return invoke('log_write', { level, message, ctx });
}

export async function logExport(): Promise<string> {
  return invoke('log_export');
}

export async function logClear(): Promise<void> {
  return invoke('log_clear');
}
