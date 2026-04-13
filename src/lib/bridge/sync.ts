import { invoke } from '@tauri-apps/api/core';

export interface SyncStatus {
  configured: boolean;
  syncing: boolean;
  lastPushAt: string | null;
  lastPullAt: string | null;
  hasLocalChanges: boolean;
  error: string | null;
  syncedCoreIds: string[];
  remoteUrl: string | null;
}

export interface SyncResult {
  filesPushed: number;
  filesPulled: number;
  conflicts: string[];
}

export async function syncSetup(remoteUrl: string, token: string): Promise<void> {
  return invoke('sync_setup', { remoteUrl, token });
}

export async function syncStatus(): Promise<SyncStatus> {
  return invoke<SyncStatus>('sync_status');
}

export async function syncSmart(syncMedia?: boolean): Promise<SyncResult> {
  return invoke<SyncResult>('sync_smart', { syncMedia: syncMedia ?? false });
}

export async function syncPush(syncMedia?: boolean): Promise<SyncResult> {
  return invoke<SyncResult>('sync_push', { syncMedia: syncMedia ?? false });
}

export async function syncPull(): Promise<SyncResult> {
  return invoke<SyncResult>('sync_pull');
}

export async function syncEnableCore(coreId: string, coreName: string): Promise<void> {
  return invoke('sync_enable_core', { coreId, coreName });
}

export async function syncDisableCore(coreId: string): Promise<void> {
  return invoke('sync_disable_core', { coreId });
}

export async function syncResolve(conflictPath: string): Promise<void> {
  return invoke('sync_resolve', { conflictPath });
}

export async function syncDisconnect(): Promise<void> {
  return invoke('sync_disconnect');
}

// ---------------------------------------------------------------------------
// iCloud sync
// ---------------------------------------------------------------------------

export interface ICloudInfo {
  available: boolean;
  path: string | null;
}

export interface ICloudVaultStatus {
  onICloud: boolean;
  evictedFiles: string[];
  syncedCount: number;
}

export async function icloudDetect(): Promise<ICloudInfo> {
  return invoke<ICloudInfo>('icloud_detect');
}

export async function icloudValidateVault(): Promise<ICloudVaultStatus> {
  return invoke<ICloudVaultStatus>('icloud_validate_vault');
}

export async function icloudDownloadFile(path: string): Promise<void> {
  return invoke('icloud_download_file', { path });
}
