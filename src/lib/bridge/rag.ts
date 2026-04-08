import { invoke } from '@tauri-apps/api/core';

export interface RagResult {
  path: string;
  title: string | null;
  chunk: string;
  score: number;
}

export async function ragSearch(query: string, corePath: string, topK?: number): Promise<RagResult[]> {
  return invoke<RagResult[]>('rag_search', { query, corePath, topK });
}

export async function ragContext(query: string, corePath: string, maxTokens?: number): Promise<string> {
  return invoke<string>('rag_context', { query, corePath, maxTokens });
}
