import { getAIModel, getMaxTokens } from '$lib/ai/client';
import { generateText } from 'ai';
import { getSettings } from '$lib/stores/settings.svelte';
import { buildWikiSchemaPrompt } from './schema-prompt';

export interface IngestSource {
  path: string;
  type: 'note' | 'url' | 'research_session';
  content: string;
  contentHash: string;
}

export interface IngestResult {
  pagesCreated: number;
  pagesUpdated: number;
  pagesSkipped: number;
  errors: string[];
}

export interface IngestProgress {
  phase: 'collecting' | 'processing' | 'writing' | 'done' | 'error';
  totalSources: number;
  processedSources: number;
  currentSource: string;
  currentAction: string;
  log: string[];
}

export type ProgressCallback = (progress: IngestProgress) => void;

interface WikiAIResponse {
  pages: Array<{
    action: 'create' | 'update';
    path: string;
    content: string;
    reason: string;
  }>;
  indexUpdates: string;
  changelogEntry: string;
}

export function hashContent(content: string): string {
  // FNV-1a 64-bit hash (via two 32-bit halves for JS compatibility)
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    const chr = content.charCodeAt(i);
    if (i % 2 === 0) {
      h1 ^= chr;
      h1 = Math.imul(h1, 0x01000193);
    } else {
      h2 ^= chr;
      h2 = Math.imul(h2, 0x01000193);
    }
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

/**
 * Collect sources to ingest.
 * @param force — if true, skip hash comparison and include all sources regardless of whether they changed.
 */
export async function collectChangedSources(force = false): Promise<IngestSource[]> {
  const settings = getSettings();
  const sources: IngestSource[] = [];
  const { invoke } = await import('@tauri-apps/api/core');
  const { wikiGetIngestHash } = await import('$lib/bridge/wiki');

  if (settings.wikiIngestNotes) {
    try {
      const { getFilesState } = await import('$lib/stores/files.svelte');
      const fileState = getFilesState();
      const mdFiles = Array.from(fileState.fileMap.values())
        .filter(f => !f.is_directory && f.path.endsWith('.md') && !f.path.startsWith('wiki/'));

      for (const file of mdFiles) {
        try {
          const { content } = await invoke<{ content: string }>('file_read', { path: file.path });
          const hash = hashContent(content);
          if (!force) {
            const lastHash = await wikiGetIngestHash(file.path);
            if (lastHash === hash) continue;
          }
          sources.push({ path: file.path, type: 'note', content, contentHash: hash });
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip if scan fails */ }
  }

  if (settings.wikiIngestResearch) {
    try {
      const { researchListSessions, researchLoadSession } = await import('$lib/bridge/commands');
      const sessions = await researchListSessions();
      for (const session of sessions) {
        const srcPath = `research:${session.id}`;
        try {
          const full = await researchLoadSession(session.id);
          const messagesJson = typeof full.messages === 'string' ? full.messages : JSON.stringify(full.messages);
          const hash = hashContent(messagesJson);
          if (!force) {
            const lastHash = await wikiGetIngestHash(srcPath);
            if (lastHash === hash) continue;
          }
            const msgs = JSON.parse(messagesJson) as Array<{ role: string; content: string }>;
            const readable = msgs
              .filter(m => m.role === 'user' || m.role === 'assistant')
              .map(m => `${m.role}: ${m.content}`)
              .join('\n\n');
            sources.push({
              path: srcPath,
              type: 'research_session',
              content: `Research Session: ${session.title}\n\n${readable}`,
              contentHash: hash,
            });
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  return sources;
}

export async function runIngest(sources: IngestSource[], onProgress?: ProgressCallback): Promise<IngestResult> {
  const progress: IngestProgress = {
    phase: 'processing',
    totalSources: sources.length,
    processedSources: 0,
    currentSource: '',
    currentAction: 'Initializing...',
    log: [],
  };

  function emit(updates: Partial<IngestProgress>) {
    Object.assign(progress, updates);
    onProgress?.({ ...progress, log: [...progress.log] });
  }

  const model = getAIModel();
  if (!model) {
    return { pagesCreated: 0, pagesUpdated: 0, pagesSkipped: 0, errors: ['No AI model configured'] };
  }

  const settings = getSettings();
  const { invoke } = await import('@tauri-apps/api/core');
  const { wikiRecordIngest, wikiSetPageHash, wikiGetPageHash, wikiUpdateMeta } = await import('$lib/bridge/wiki');

  const result: IngestResult = { pagesCreated: 0, pagesUpdated: 0, pagesSkipped: 0, errors: [] };

  let currentIndex = '';
  try {
    const { content } = await invoke<{ content: string }>('file_read', { path: 'wiki/index.md' });
    currentIndex = content;
  } catch { /* empty */ }

  const schemaPrompt = buildWikiSchemaPrompt(settings.wikiFocus, currentIndex);

  const batchSize = 3;
  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize);
    const batchNames = batch.map(s => s.path).join(', ');
    emit({
      processedSources: i,
      currentSource: batchNames,
      currentAction: `Sending to AI (batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(sources.length / batchSize)})...`,
    });
    progress.log.push(`Processing: ${batchNames}`);

    const sourceContent = batch
      .map(s => `--- Source: ${s.path} (${s.type}) ---\n${s.content}`)
      .join('\n\n');

    try {
      const { text } = await generateText({
        model,
        system: schemaPrompt,
        prompt: sourceContent.slice(0, 60000),
        maxOutputTokens: getMaxTokens() ?? 4000,
      });

      let response: WikiAIResponse;
      try {
        // Try direct parse first
        let jsonStr = text.trim();
        // Strip markdown code fences if present
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
        // If still not valid JSON, try extracting the first {...} block
        if (!jsonStr.startsWith('{')) {
          const start = jsonStr.indexOf('{');
          const end = jsonStr.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end > start) {
            jsonStr = jsonStr.slice(start, end + 1);
          }
        }
        response = JSON.parse(jsonStr);
      } catch {
        result.errors.push(`Failed to parse AI response for batch starting at ${batch[0].path}`);
        continue;
      }

      for (const page of response.pages) {
        // Guard against AI-generated paths outside wiki/
        if (!page.path.startsWith('wiki/') || page.path.includes('..')) {
          result.errors.push(`Skipped unsafe path: ${page.path}`);
          progress.log.push(`Skipped unsafe path: ${page.path}`);
          continue;
        }
        emit({ phase: 'writing', currentAction: `${page.action === 'create' ? 'Creating' : 'Updating'} ${page.path}` });
        try {
          if (page.action === 'update') {
            const storedHash = await wikiGetPageHash(page.path);
            if (storedHash) {
              try {
                const { content: current } = await invoke<{ content: string }>('file_read', { path: page.path });
                const currentHash = hashContent(current);
                if (currentHash !== storedHash) {
                  result.pagesSkipped++;
                  continue;
                }
              } catch { /* treat as create */ }
            }
          }

          // Write the page
          const dir = page.path.split('/').slice(0, -1).join('/');
          if (dir) {
            try { await invoke('dir_create', { path: dir }); } catch { /* exists */ }
          }
          try {
            await invoke('file_read', { path: page.path });
            await invoke('file_write', { path: page.path, content: page.content });
          } catch {
            await invoke('file_create', { path: page.path, content: page.content });
          }

          await wikiSetPageHash(page.path, hashContent(page.content));

          if (page.action === 'create') {
            result.pagesCreated++;
            progress.log.push(`Created ${page.path}`);
          } else {
            result.pagesUpdated++;
            progress.log.push(`Updated ${page.path}`);
          }
          emit({});
        } catch (err) {
          result.errors.push(`Failed to write ${page.path}: ${err}`);
          progress.log.push(`Error: ${page.path} — ${err}`);
        }
      }

      if (response.indexUpdates) {
        try {
          await invoke('file_write', { path: 'wiki/index.md', content: response.indexUpdates });
        } catch { /* not critical */ }
      }

      if (response.changelogEntry) {
        try {
          const { content: changelog } = await invoke<{ content: string }>('file_read', { path: 'wiki/changelog.md' });
          const lines = changelog.split('\n');
          const headerEnd = lines.findIndex(l => l.trim() === '') + 1 || 2;
          const header = lines.slice(0, headerEnd);
          const entries = lines.slice(headerEnd).filter(l => l.trim());
          const newEntry = `- **${new Date().toISOString().split('T')[0]}**: ${response.changelogEntry}`;
          const allEntries = [newEntry, ...entries].slice(0, 50);
          await invoke('file_write', {
            path: 'wiki/changelog.md',
            content: [...header, '', ...allEntries, ''].join('\n'),
          });
        } catch { /* not critical */ }
      }

      for (const src of batch) {
        const id = `ingest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const pagesAffected = response.pages.map(p => p.path);
        await wikiRecordIngest(id, src.path, src.type, src.contentHash, JSON.stringify(pagesAffected));
      }
    } catch (err) {
      result.errors.push(`AI call failed for batch: ${err}`);
      progress.log.push(`Error: AI call failed — ${err}`);
      emit({});
    }
  }

  emit({ phase: 'done', processedSources: sources.length, currentAction: 'Complete' });

  try {
    const { getFilesState } = await import('$lib/stores/files.svelte');
    const fileState = getFilesState();
    const wikiFiles = Array.from(fileState.fileMap.values())
      .filter(f => !f.is_directory && f.path.startsWith('wiki/') && f.path.endsWith('.md'));
    await wikiUpdateMeta(wikiFiles.length, 0);
  } catch { /* non-critical */ }

  return result;
}
