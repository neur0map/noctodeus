<script lang="ts">
  import { getSettings } from '../../../stores/settings.svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';

  type Settings = ReturnType<typeof getSettings>;
  let { settings }: { settings: Settings } = $props();

  let showAdvanced = $state(false);
  let confirmingReset = $state(false);

  async function handleReset() {
    if (!confirmingReset) {
      confirmingReset = true;
      return;
    }
    try {
      const { wikiReset } = await import('$lib/bridge/wiki');
      await wikiReset();
      const { invoke } = await import('@tauri-apps/api/core');
      try { await invoke('dir_delete', { path: 'wiki' }); } catch { /* may not exist */ }
      const { toast } = await import('$lib/stores/toast.svelte');
      toast.success('Wiki reset. It will rebuild on next ingest.');
    } catch (err) {
      const { toast } = await import('$lib/stores/toast.svelte');
      toast.error(`Reset failed: ${err}`);
    }
    confirmingReset = false;
  }
</script>

<div class="settings__section">
  <div class="settings__row">
    <div class="settings__row-info">
      <span class="settings__row-label">Enable Wiki</span>
      <span class="settings__row-desc">
        AI builds a structured knowledge base from your notes.
        {#if settings.wikiEnabled && !settings.wikiFocus}
          Wiki grows as you add notes. Start with a few notes, then ingest.
        {/if}
      </span>
    </div>
    <label class="settings__toggle">
      <input type="checkbox" checked={settings.wikiEnabled} onchange={(e) => settings.update('wikiEnabled', e.currentTarget.checked)} />
      <span class="settings__toggle-track"></span>
    </label>
  </div>

  {#if settings.wikiEnabled}
    <div class="settings__row">
      <div class="settings__row-info">
        <span class="settings__row-label">Wiki Focus</span>
        <span class="settings__row-desc">Guides what the AI emphasizes when building wiki pages.</span>
      </div>
      <input class="settings__font-input" type="text" placeholder="e.g., Machine learning research" value={settings.wikiFocus} onchange={(e) => settings.update('wikiFocus', e.currentTarget.value)} style="max-width: 240px;" />
    </div>

    <div class="settings__row">
      <div class="settings__row-info">
        <span class="settings__row-label">Auto-Ingest Schedule</span>
        <span class="settings__row-desc">How often the wiki automatically updates from your notes.</span>
      </div>
      <select class="settings__select" value={settings.wikiSchedule} onchange={(e) => settings.update('wikiSchedule', e.currentTarget.value as any)}>
        <option value="manual">Manual only</option>
        <option value="6h">Every 6 hours</option>
        <option value="12h">Every 12 hours</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
      </select>
    </div>

    {#if settings.wikiSchedule === 'daily' || settings.wikiSchedule === 'weekly'}
      <div class="settings__row">
        <div class="settings__row-info">
          <span class="settings__row-label">Ingest Time</span>
          <span class="settings__row-desc">When to run the scheduled ingest.</span>
        </div>
        <input class="settings__font-input" type="time" value={settings.wikiScheduleTime} onchange={(e) => settings.update('wikiScheduleTime', e.currentTarget.value)} style="max-width: 120px;" />
      </div>
    {/if}

    <button class="wiki-advanced-toggle" onclick={() => showAdvanced = !showAdvanced}>
      <ChevronDown size={12} style={showAdvanced ? 'transform: rotate(180deg)' : ''} />
      Advanced
    </button>

    {#if showAdvanced}
      <div class="settings__row">
        <div class="settings__row-info">
          <span class="settings__row-label">Ingest User Notes</span>
          <span class="settings__row-desc">Process your markdown notes into the wiki.</span>
        </div>
        <label class="settings__toggle">
          <input type="checkbox" checked={settings.wikiIngestNotes} onchange={(e) => settings.update('wikiIngestNotes', e.currentTarget.checked)} />
          <span class="settings__toggle-track"></span>
        </label>
      </div>

      <div class="settings__row">
        <div class="settings__row-info">
          <span class="settings__row-label">Ingest Research Sessions</span>
          <span class="settings__row-desc">Process URLs and text from your research sessions.</span>
        </div>
        <label class="settings__toggle">
          <input type="checkbox" checked={settings.wikiIngestResearch} onchange={(e) => settings.update('wikiIngestResearch', e.currentTarget.checked)} />
          <span class="settings__toggle-track"></span>
        </label>
      </div>

      <div class="settings__row">
        <div class="settings__row-info">
          <span class="settings__row-label">Ingest URLs in Notes</span>
          <span class="settings__row-desc">Fetch and process links found in your notes.</span>
        </div>
        <label class="settings__toggle">
          <input type="checkbox" checked={settings.wikiIngestUrls} onchange={(e) => settings.update('wikiIngestUrls', e.currentTarget.checked)} />
          <span class="settings__toggle-track"></span>
        </label>
      </div>
    {/if}

    <div class="settings__row">
      <div class="settings__row-info">
        <span class="settings__row-label">Reset Wiki</span>
        <span class="settings__row-desc">
          {#if confirmingReset}
            This will delete all wiki pages. Your notes are not affected.
          {:else}
            Delete all wiki pages and rebuild on next ingest.
          {/if}
        </span>
      </div>
      <button class="wiki-reset-btn" class:wiki-reset-btn--confirm={confirmingReset} onclick={handleReset}>
        {confirmingReset ? 'Confirm Reset' : 'Reset Wiki'}
      </button>
    </div>
  {/if}
</div>

<style>
  .wiki-advanced-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 0;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-placeholder);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 150ms ease-out;
  }
  .wiki-advanced-toggle:hover {
    color: var(--color-foreground);
  }
  .wiki-reset-btn {
    padding: 6px 14px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-muted-foreground);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 150ms ease-out, border-color 150ms ease-out;
  }
  .wiki-reset-btn:hover {
    color: var(--accent-red, #f7768e);
    border-color: var(--accent-red, #f7768e);
  }
  .wiki-reset-btn--confirm {
    color: #fff;
    background: var(--accent-red, #f7768e);
    border-color: var(--accent-red, #f7768e);
  }
  .wiki-reset-btn--confirm:hover {
    color: #fff;
    opacity: 0.9;
  }
</style>
