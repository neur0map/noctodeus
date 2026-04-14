import { invoke } from '@tauri-apps/api/core';

export interface WikiMeta {
  lastIngestAt: number;
  lastLintAt: number;
  pageCount: number;
  linkCount: number;
}

export async function wikiGetMeta(): Promise<WikiMeta> {
  return invoke<WikiMeta>('wiki_get_meta');
}

export async function wikiGetIngestHash(sourcePath: string): Promise<string | null> {
  return invoke<string | null>('wiki_get_ingest_hash', { sourcePath });
}

export async function wikiGetPageHash(pagePath: string): Promise<string | null> {
  return invoke<string | null>('wiki_get_page_hash', { pagePath });
}

export async function wikiRecordIngest(
  id: string,
  sourcePath: string,
  sourceType: string,
  contentHash: string,
  wikiPagesAffected: string,
): Promise<void> {
  return invoke('wiki_record_ingest', {
    id,
    sourcePath,
    sourceType,
    contentHash,
    wikiPagesAffected,
  });
}

export async function wikiUpdateMeta(pageCount: number, linkCount: number): Promise<void> {
  return invoke('wiki_update_meta', { pageCount, linkCount });
}

export async function wikiSetPageHash(pagePath: string, writtenHash: string): Promise<void> {
  return invoke('wiki_set_page_hash', { pagePath, writtenHash });
}

export async function wikiReset(): Promise<void> {
  return invoke('wiki_reset');
}

export interface WikiSearchResult {
  path: string;
  title: string | null;
  chunk: string;
  score: number;
}

export async function wikiSearch(query: string, corePath: string, topK = 5): Promise<WikiSearchResult[]> {
  return invoke<WikiSearchResult[]>('wiki_search', { query, corePath, topK });
}
