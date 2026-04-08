import { invoke } from '@tauri-apps/api/core';

export interface ServerStatus {
  version: string;
  max_size: number;
  max_views: number;
  max_expiration: number;
  allow_advanced: boolean;
  allow_files: boolean;
}

export async function shareNote(
  content: string,
  views: number | null,
  expiration: number | null,
  password: string | null,
  server: string,
): Promise<string> {
  return invoke<string>('share_note', { content, views, expiration, password, server });
}

export async function shareStatus(server: string): Promise<ServerStatus> {
  return invoke<ServerStatus>('share_status', { server });
}
