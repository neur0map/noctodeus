import { getSettings } from './settings.svelte';

// ---------------------------------------------------------------------------
// Module-level $state
// ---------------------------------------------------------------------------

export interface WikiProgress {
  phase: string;
  totalSources: number;
  processedSources: number;
  currentSource: string;
  currentAction: string;
  log: string[];
}

let ingesting = $state(false);
let lastIngestAt = $state(0);
let lastLintAt = $state(0);
let pageCount = $state(0);
let linkCount = $state(0);
let progress = $state<WikiProgress | null>(null);
let progressVisible = $state(false);
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function refreshMeta() {
  try {
    const { wikiGetMeta } = await import('$lib/bridge/wiki');
    const meta = await wikiGetMeta();
    lastIngestAt = meta.lastIngestAt;
    lastLintAt = meta.lastLintAt;
    pageCount = meta.pageCount;
    linkCount = meta.linkCount;
  } catch {
    // Silent — wiki tables may not exist on older cores
  }
}

async function checkSchedule() {
  const settings = getSettings();
  if (!settings.wikiEnabled) return;

  const schedule = settings.wikiSchedule;
  if (schedule === 'manual') return;

  const now = Date.now();
  const lastMs = lastIngestAt * 1000;

  if (schedule === '6h' || schedule === '12h') {
    // Interval-based: just check elapsed time
    const interval = schedule === '6h' ? 6 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
    if (now - lastMs < interval) return;
  } else {
    // Time-of-day based (daily/weekly)
    const [hours, minutes] = (settings.wikiScheduleTime || '09:00').split(':').map(Number);
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    // If target time hasn't passed today, skip
    if (now < target.getTime()) return;

    // If we already ingested after this target time today, skip
    if (lastMs >= target.getTime()) return;

    // For weekly, also check if at least 6 days have elapsed
    if (schedule === 'weekly') {
      const sixDays = 6 * 24 * 60 * 60 * 1000;
      if (now - lastMs < sixDays) return;
    }
  }

  await ingestAll(true);
}

/** Create the wiki folder structure if it doesn't exist. */
async function ensureWikiFolder() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('dir_create', { path: 'wiki' });
    await invoke('dir_create', { path: 'wiki/concepts' });
    await invoke('dir_create', { path: 'wiki/entities' });
    await invoke('dir_create', { path: 'wiki/summaries' });

    try {
      await invoke('file_read', { path: 'wiki/index.md' });
    } catch {
      await invoke('file_create', {
        path: 'wiki/index.md',
        content: '# Wiki Index\n\nThis wiki is maintained by AI. Pages are created and updated automatically as you add notes.\n\n## Concepts\n\n## Entities\n\n## Summaries\n',
      });
    }

    try {
      await invoke('file_read', { path: 'wiki/changelog.md' });
    } catch {
      await invoke('file_create', {
        path: 'wiki/changelog.md',
        content: '# Wiki Changelog\n\nRecent changes to the wiki are logged here.\n',
      });
    }
  } catch {
    // Silent
  }
}

// ---------------------------------------------------------------------------
// Ingest / Lint — stubs for now, wired in Task 8
// ---------------------------------------------------------------------------

async function ingestAll(silent = false) {
  if (ingesting) return;
  ingesting = true;
  progressVisible = true;
  progress = {
    phase: 'collecting',
    totalSources: 0,
    processedSources: 0,
    currentSource: '',
    currentAction: 'Scanning for changes...',
    log: ['Starting wiki ingest...'],
  };

  try {
    const { collectChangedSources, runIngest } = await import('$lib/wiki/ingest');

    await ensureWikiFolder();
    progress!.log.push('Wiki folder ready');

    // Manual ingest (silent=false) forces all sources; scheduled (silent=true) only changed
    const sources = await collectChangedSources(!silent);
    if (sources.length === 0) {
      progress = { ...progress!, phase: 'done', currentAction: 'Up to date — no sources found', log: [...progress!.log, 'No sources found.'] };
      return;
    }

    progress = { ...progress!, totalSources: sources.length, currentAction: `Found ${sources.length} source(s) to process`, log: [...progress!.log, `Found ${sources.length} changed source(s)`] };

    const result = await runIngest(sources, (p) => {
      progress = { ...p };
    });
    await refreshMeta();

    const parts: string[] = [];
    if (result.pagesCreated > 0) parts.push(`${result.pagesCreated} new`);
    if (result.pagesUpdated > 0) parts.push(`${result.pagesUpdated} updated`);
    if (result.pagesSkipped > 0) parts.push(`${result.pagesSkipped} skipped (manually edited)`);
    const summary = parts.length > 0 ? parts.join(', ') : 'no changes';

    progress = {
      phase: 'done',
      totalSources: sources.length,
      processedSources: sources.length,
      currentSource: '',
      currentAction: result.errors.length > 0
        ? `Done with ${result.errors.length} error(s): ${summary}`
        : `Complete: ${summary}`,
      log: progress?.log ?? [],
    };
  } catch (err) {
    progress = {
      phase: 'error',
      totalSources: progress?.totalSources ?? 0,
      processedSources: progress?.processedSources ?? 0,
      currentSource: '',
      currentAction: `Failed: ${err}`,
      log: [...(progress?.log ?? []), `Error: ${err}`],
    };
  } finally {
    ingesting = false;
  }
}

async function ingestNote(path: string) {
  if (ingesting) return;
  ingesting = true;
  progressVisible = true;
  progress = {
    phase: 'processing',
    totalSources: 1,
    processedSources: 0,
    currentSource: path,
    currentAction: `Ingesting "${path}"...`,
    log: [`Ingesting single note: ${path}`],
  };

  try {
    const { runIngest, hashContent } = await import('$lib/wiki/ingest');
    const { invoke } = await import('@tauri-apps/api/core');

    await ensureWikiFolder();

    const { content } = await invoke<{ content: string }>('file_read', { path });
    const source = { path, type: 'note' as const, content, contentHash: hashContent(content) };

    const result = await runIngest([source], (p) => {
      progress = { ...p };
    });
    await refreshMeta();

    const parts: string[] = [];
    if (result.pagesCreated > 0) parts.push(`${result.pagesCreated} new`);
    if (result.pagesUpdated > 0) parts.push(`${result.pagesUpdated} updated`);
    const summary = parts.length > 0 ? parts.join(', ') : 'no changes';

    progress = {
      phase: result.errors.length > 0 ? 'error' : 'done',
      totalSources: 1,
      processedSources: 1,
      currentSource: '',
      currentAction: result.errors.length > 0
        ? `Done with errors: ${summary}`
        : `Complete: ${summary}`,
      log: progress?.log ?? [],
    };
  } catch (err) {
    progress = {
      phase: 'error',
      totalSources: 1,
      processedSources: 0,
      currentSource: '',
      currentAction: `Failed: ${err}`,
      log: [...(progress?.log ?? []), `Error: ${err}`],
    };
  } finally {
    ingesting = false;
  }
}

async function lint() {
  const { toast } = await import('$lib/stores/toast.svelte');
  toast.info('Wiki lint is not yet implemented. Coming soon!');
}

// ---------------------------------------------------------------------------
// Exported state accessor
// ---------------------------------------------------------------------------

export function getWikiState() {
  return {
    get ingesting() { return ingesting; },
    get lastIngestAt() { return lastIngestAt; },
    get lastLintAt() { return lastLintAt; },
    get pageCount() { return pageCount; },
    get linkCount() { return linkCount; },
    get enabled() { return getSettings().wikiEnabled; },
    get progress() { return progress; },
    get progressVisible() { return progressVisible; },

    dismissProgress() {
      progressVisible = false;
      progress = null;
    },

    async init() {
      await refreshMeta();
      await checkSchedule();
      this.startScheduler();
    },

    startScheduler() {
      if (schedulerTimer) clearInterval(schedulerTimer);
      schedulerTimer = setInterval(() => checkSchedule(), 15 * 60 * 1000);
    },

    stopScheduler() {
      if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
      }
    },

    refreshMeta,

    async ingestAll(silent = false) {
      return ingestAll(silent);
    },

    async ingestNote(path: string) {
      return ingestNote(path);
    },

    async lint() {
      return lint();
    },
  };
}
