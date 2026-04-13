<script lang="ts">
  import { getSettings } from '$lib/stores/settings.svelte';
  import { getSyncState } from '$lib/stores/sync.svelte';
  import { syncSetup, syncEnableCore, syncDisableCore, syncDisconnect } from '$lib/bridge/sync';
  import { listCores } from '$lib/bridge/commands';

  let { settings }: { settings: ReturnType<typeof getSettings> } = $props();

  const syncState = getSyncState();

  // ── Shared state ──
  let error = $state<string | null>(null);

  // ── GitHub state ──
  let token = $state('');
  let repoUrl = $state('');
  let connecting = $state(false);
  let cores = $state<{ id: string; name: string; synced: boolean }[]>([]);

  // ── iCloud state ──
  let icloudAvailable = $state(false);
  let icloudPath = $state<string | null>(null);
  let icloudOnVault = $state(false);
  let icloudEvicted = $state<string[]>([]);
  let icloudSyncedCount = $state(0);
  let icloudLoading = $state(false);
  let downloadingFiles = $state<Set<string>>(new Set());

  // ── Auto-migrate existing GitHub users ──
  $effect(() => {
    if (settings.syncMethod === 'none' && syncState.status.configured) {
      settings.update('syncMethod', 'github');
    }
  });

  // ── GitHub helpers ──
  async function loadCores() {
    try {
      const allCores = await listCores();
      const syncedIds = new Set(syncState.status.syncedCoreIds ?? []);
      cores = allCores.map(c => ({
        id: c.id,
        name: c.name,
        synced: syncedIds.has(c.id),
      }));
    } catch {}
  }

  async function handleConnect() {
    if (!token.trim() || !repoUrl.trim()) return;
    connecting = true;
    error = null;
    try {
      await syncSetup(repoUrl.trim(), token.trim());
      await syncState.refresh();
      await loadCores();
    } catch (err) {
      error = (err as any)?.message || (err as any)?.detail || (typeof err === 'string' ? err : JSON.stringify(err));
    }
    connecting = false;
  }

  async function handleDisconnect() {
    try {
      await syncDisconnect();
      syncState.reset();
      cores = [];
      token = '';
      repoUrl = '';
    } catch (err) {
      error = (err as any)?.message || (err as any)?.detail || (typeof err === 'string' ? err : JSON.stringify(err));
    }
  }

  async function toggleCoreSync(coreId: string, coreName: string, enabled: boolean) {
    try {
      if (enabled) {
        await syncEnableCore(coreId, coreName);
      } else {
        await syncDisableCore(coreId);
      }
      await syncState.refresh();
      await loadCores();
    } catch (err) {
      error = (err as any)?.message || (err as any)?.detail || (typeof err === 'string' ? err : JSON.stringify(err));
    }
  }

  $effect(() => {
    if (settings.syncMethod === 'github' && syncState.status.configured) {
      loadCores();
    }
  });

  // ── iCloud helpers (lazy-loaded to avoid import errors) ──
  async function detectICloud() {
    try {
      const { icloudDetect } = await import('$lib/bridge/sync');
      const info = await icloudDetect();
      icloudAvailable = info.available;
      icloudPath = info.path;
    } catch {
      icloudAvailable = false;
    }
  }

  async function loadICloudStatus() {
    icloudLoading = true;
    error = null;
    try {
      const { icloudDetect, icloudValidateVault } = await import('$lib/bridge/sync');
      const info = await icloudDetect();
      icloudAvailable = info.available;
      icloudPath = info.path;
      if (info.available) {
        const status = await icloudValidateVault();
        icloudOnVault = status.onICloud;
        icloudEvicted = status.evictedFiles;
        icloudSyncedCount = status.syncedCount;
      }
    } catch (err) {
      error = (err as any)?.message || (err as any)?.detail || (typeof err === 'string' ? err : JSON.stringify(err));
    }
    icloudLoading = false;
  }

  async function handleDownloadFile(path: string) {
    downloadingFiles = new Set([...downloadingFiles, path]);
    try {
      const { icloudDownloadFile } = await import('$lib/bridge/sync');
      await icloudDownloadFile(path);
    } catch (err) {
      error = (err as any)?.message || (err as any)?.detail || (typeof err === 'string' ? err : JSON.stringify(err));
    }
  }

  async function handleDownloadAll() {
    if (!icloudEvicted.length) return;
    for (const f of icloudEvicted) {
      await handleDownloadFile(f);
    }
  }

  $effect(() => {
    if (settings.syncMethod === 'icloud') {
      loadICloudStatus();
    }
  });

  // Detect iCloud on mount (for dropdown option visibility)
  let icloudChecked = $state(false);
  $effect(() => {
    if (!icloudChecked) {
      icloudChecked = true;
      detectICloud();
    }
  });

  function handleSyncMethodChange(value: string) {
    settings.update('syncMethod', value as 'none' | 'github' | 'icloud');
    error = null;
  }
</script>

<div class="settings__section">
  <!-- Sync method selector -->
  <div class="settings__row">
    <div class="settings__row-info">
      <span class="settings__row-label">Sync method</span>
      <span class="settings__row-desc">How your notes sync across devices.</span>
    </div>
    <select
      class="settings__select"
      value={settings.syncMethod}
      onchange={(e) => handleSyncMethodChange(e.currentTarget.value)}
    >
      <option value="none">None</option>
      <option value="github">GitHub</option>
      {#if icloudAvailable}
        <option value="icloud">iCloud Drive</option>
      {/if}
    </select>
  </div>

  <!-- Sync media toggle (applies to all sync methods) -->
  {#if settings.syncMethod !== 'none'}
    <div class="settings__row">
      <div class="settings__row-info">
        <span class="settings__row-label">Sync images & media</span>
        <span class="settings__row-desc">Include images, PDFs, and other media files. Off by default to keep repos small.</span>
      </div>
      <label class="settings__toggle">
        <input type="checkbox" checked={settings.syncMedia} onchange={(e) => settings.update('syncMedia', e.currentTarget.checked)} />
        <span class="settings__toggle-track"></span>
      </label>
    </div>
  {/if}

  <!-- ═══ None ═══ -->
  {#if settings.syncMethod === 'none'}
    <div class="settings__row">
      <div class="settings__row-info">
        <span class="settings__row-desc">Notes are stored locally only. No sync across devices.</span>
      </div>
    </div>

  <!-- ═══ GitHub ═══ -->
  {:else if settings.syncMethod === 'github'}
    {#if !syncState.status.configured}
      <div class="settings__row settings__row--vertical">
        <div class="settings__row-info">
          <span class="settings__row-label">GitHub Token</span>
          <span class="settings__row-desc">Generate a fine-grained PAT with repo read/write access.</span>
        </div>
        <input
          class="settings__font-input"
          type="password"
          placeholder="ghp_xxxxxxxxxxxx"
          bind:value={token}
        />
      </div>
      <div class="settings__row settings__row--vertical">
        <div class="settings__row-info">
          <span class="settings__row-label">Repository URL</span>
          <span class="settings__row-desc">HTTPS URL of your sync repo.</span>
        </div>
        <input
          class="settings__font-input"
          type="text"
          placeholder="https://github.com/user/nodeus-vault.git"
          bind:value={repoUrl}
        />
      </div>
      <div class="settings__row settings__row--action">
        <button
          class="settings__reset-all"
          onclick={handleConnect}
          disabled={connecting || !token.trim() || !repoUrl.trim()}
        >
          {connecting ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    {:else}
      <div class="settings__row">
        <div class="settings__row-info">
          <span class="settings__row-label">Connected</span>
          <span class="settings__row-desc">
            {syncState.status.remoteUrl ?? 'Unknown repo'}
          </span>
        </div>
        <button class="settings__reset-all" onclick={handleDisconnect}>
          Disconnect
        </button>
      </div>

      <div class="settings__row">
        <div class="settings__row-info">
          <span class="settings__row-label">Last sync</span>
          <span class="settings__row-desc">
            {syncState.status.lastPushAt ?? 'never'}
          </span>
        </div>
      </div>

      {#each cores as c}
        <div class="settings__row">
          <div class="settings__row-info">
            <span class="settings__row-label">{c.name}</span>
            <span class="settings__row-desc">{c.synced ? 'Syncing' : 'Not synced'}</span>
          </div>
          <label class="settings__toggle">
            <input
              type="checkbox"
              checked={c.synced}
              onchange={() => toggleCoreSync(c.id, c.name, !c.synced)}
            />
            <span class="settings__toggle-track"></span>
          </label>
        </div>
      {/each}
    {/if}

  <!-- ═══ iCloud Drive ═══ -->
  {:else if settings.syncMethod === 'icloud'}
    {#if icloudLoading}
      <div class="settings__row">
        <div class="settings__row-info">
          <span class="settings__row-desc">Checking iCloud Drive status...</span>
        </div>
      </div>
    {:else if icloudOnVault}
      <div class="settings__row">
        <div class="settings__row-info">
          <span class="settings__row-label icloud-status icloud-status--ok">
            Vault is on iCloud Drive
          </span>
          <span class="settings__row-desc">
            macOS syncs your notes automatically across all devices.
          </span>
        </div>
      </div>

      <div class="settings__row">
        <div class="settings__row-info">
          <span class="settings__row-label">Synced notes</span>
          <span class="settings__row-desc">{icloudSyncedCount} files</span>
        </div>
      </div>

      {#if icloudEvicted.length > 0}
        <div class="settings__row">
          <div class="settings__row-info">
            <span class="settings__row-label icloud-status icloud-status--warn">
              {icloudEvicted.length} evicted file{icloudEvicted.length === 1 ? '' : 's'}
            </span>
            <span class="settings__row-desc">
              These files are in iCloud but not downloaded locally.
            </span>
          </div>
          <button class="settings__reset-all" onclick={handleDownloadAll}>
            Download all
          </button>
        </div>

        {#each icloudEvicted.slice(0, 10) as file}
          <div class="settings__row">
            <div class="settings__row-info">
              <span class="settings__row-desc">{file}</span>
            </div>
            {#if downloadingFiles.has(file)}
              <span class="settings__row-desc">Downloading...</span>
            {:else}
              <button
                class="settings__reset-all"
                onclick={() => handleDownloadFile(file)}
              >
                Download
              </button>
            {/if}
          </div>
        {/each}

        {#if icloudEvicted.length > 10}
          <div class="settings__row">
            <div class="settings__row-info">
              <span class="settings__row-desc">
                ...and {icloudEvicted.length - 10} more
              </span>
            </div>
          </div>
        {/if}
      {/if}

      {#if icloudPath}
        <div class="settings__row">
          <div class="settings__row-info">
            <span class="settings__row-label">iCloud Drive path</span>
            <span class="settings__row-desc">{icloudPath}</span>
          </div>
        </div>
      {/if}
    {:else}
      <div class="settings__row">
        <div class="settings__row-info">
          <span class="settings__row-label icloud-status icloud-status--warn">
            Vault is not on iCloud Drive
          </span>
          <span class="settings__row-desc">
            Move your vault folder to iCloud Drive to enable sync.
            {#if icloudPath}
              <br />Move it to: <code>{icloudPath}</code>
            {/if}
          </span>
        </div>
      </div>
    {/if}
  {/if}

  {#if error}
    <div class="settings__row">
      <span class="settings__row-desc" style="color: var(--color-error, #f7768e);">{error}</span>
    </div>
  {/if}
</div>

<style>
  .icloud-status {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .icloud-status--ok {
    color: var(--color-success, #9ece6a);
  }
  .icloud-status--warn {
    color: var(--color-warning, #e0af68);
  }
  code {
    font-family: var(--font-mono);
    font-size: 11px;
    background: var(--color-hover);
    padding: 1px 4px;
    border-radius: 3px;
  }
</style>
