import { getSettings } from './settings.svelte';

// ---------------------------------------------------------------------------
// Module-level $state
// ---------------------------------------------------------------------------

let ingesting = $state(false);
let lastIngestAt = $state(0);
let lastLintAt = $state(0);
let pageCount = $state(0);
let linkCount = $state(0);
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

function scheduleIntervalMs(schedule: string): number | null {
  switch (schedule) {
    case '6h': return 6 * 60 * 60 * 1000;
    case '12h': return 12 * 60 * 60 * 1000;
    case 'daily': return 24 * 60 * 60 * 1000;
    case 'weekly': return 7 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

async function checkSchedule() {
  const settings = getSettings();
  if (!settings.wikiEnabled) return;

  const interval = scheduleIntervalMs(settings.wikiSchedule);
  if (!interval) return;

  const now = Date.now();
  const lastMs = lastIngestAt * 1000;
  if (now - lastMs < interval) return;

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

  try {
    const { toast } = await import('$lib/stores/toast.svelte');
    const { collectChangedSources, runIngest } = await import('$lib/wiki/ingest');

    await ensureWikiFolder();

    const sources = await collectChangedSources();
    if (sources.length === 0) {
      if (!silent) toast.info('Wiki is up to date — no changes to ingest.');
      return;
    }

    if (!silent) toast.info(`Wiki ingest started (${sources.length} sources)...`);

    const result = await runIngest(sources);
    await refreshMeta();

    const parts: string[] = [];
    if (result.pagesCreated > 0) parts.push(`${result.pagesCreated} new`);
    if (result.pagesUpdated > 0) parts.push(`${result.pagesUpdated} updated`);
    if (result.pagesSkipped > 0) parts.push(`${result.pagesSkipped} skipped (manually edited)`);
    const summary = parts.length > 0 ? parts.join(', ') : 'no changes';

    if (result.errors.length > 0) {
      toast.warn(`Wiki updated (${summary}) with ${result.errors.length} error(s)`);
    } else {
      toast.success(`Wiki updated: ${summary}`);
    }
  } catch (err) {
    const { toast } = await import('$lib/stores/toast.svelte');
    toast.error(`Wiki ingest failed: ${err}`);
  } finally {
    ingesting = false;
  }
}

async function ingestNote(path: string) {
  if (ingesting) return;
  ingesting = true;

  try {
    const { toast } = await import('$lib/stores/toast.svelte');
    const { runIngest, hashContent } = await import('$lib/wiki/ingest');
    const { invoke } = await import('@tauri-apps/api/core');

    await ensureWikiFolder();

    const { content } = await invoke<{ content: string }>('file_read', { path });
    const source = { path, type: 'note' as const, content, contentHash: hashContent(content) };

    toast.info(`Ingesting "${path}" into wiki...`);
    const result = await runIngest([source]);
    await refreshMeta();

    if (result.errors.length > 0) {
      toast.warn(`Ingest completed with errors: ${result.errors[0]}`);
    } else {
      toast.success(`Ingested: ${result.pagesCreated} new, ${result.pagesUpdated} updated`);
    }
  } catch (err) {
    const { toast } = await import('$lib/stores/toast.svelte');
    toast.error(`Ingest failed: ${err}`);
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
