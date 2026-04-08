import { invoke } from '@tauri-apps/api/core';

export interface RagResult {
  path: string;
  title: string | null;
  chunk: string;
  score: number;
}

export interface RagStatus {
  indexed: boolean;
  frameCount: number;
  fileSizeBytes: number;
  filePath: string;
}

export async function ragSearch(query: string, corePath: string, topK?: number): Promise<RagResult[]> {
  return invoke<RagResult[]>('rag_search', { query, corePath, topK });
}

export async function ragContext(query: string, corePath: string, maxTokens?: number): Promise<string> {
  return invoke<string>('rag_context', { query, corePath, maxTokens });
}

export async function ragIndex(corePath: string): Promise<number> {
  return invoke<number>('rag_index', { corePath });
}

export async function ragStatus(corePath: string): Promise<RagStatus> {
  return invoke<RagStatus>('rag_status', { corePath });
}
