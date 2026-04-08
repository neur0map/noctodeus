import { invoke } from '@tauri-apps/api/core';

export interface VaultScan {
  path: string;
  name: string;
  markdownCount: number;
  mediaCount: number;
  folderCount: number;
  otherCount: number;
  totalSizeBytes: number;
  hasWikiLinks: boolean;
  hasFrontmatter: boolean;
  sampleFiles: string[];
}

export interface ImportResult {
  filesImported: number;
  foldersCreated: number;
  skipped: number;
  totalSizeBytes: number;
}

export async function importScan(vaultPath: string): Promise<VaultScan> {
  return invoke<VaultScan>('import_scan', { vaultPath });
}

export async function importObsidian(
  vaultPath: string,
  targetPath: string,
  createNewCore: boolean,
  coreName: string | null,
): Promise<ImportResult> {
  return invoke<ImportResult>('import_obsidian', { vaultPath, targetPath, createNewCore, coreName });
}
