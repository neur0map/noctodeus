<script lang="ts">
  import { getSettings } from '$lib/stores/settings.svelte';
  import { getSyncState } from '$lib/stores/sync.svelte';
  import { syncSetup, syncEnableCore, syncDisableCore, syncDisconnect } from '$lib/bridge/sync';
  import { listCores } from '$lib/bridge/commands';

  let { settings }: { settings: ReturnType<typeof getSettings> } = $props();

  const syncState = getSyncState();

  let token = $state('');
  let repoUrl = $state('');
  let connecting = $state(false);
  let error = $state<string | null>(null);
  let cores = $state<{ id: string; name: string; synced: boolean }[]>([]);

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
      error = String(err);
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
      error = String(err);
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
      error = String(err);
    }
  }

  $effect(() => {
    if (syncState.status.configured) {
      loadCores();
    }
  });
</script>

<div class="settings__section">
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
        placeholder="https://github.com/user/noctodeus-vault.git"
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

  {#if error}
    <div class="settings__row">
      <span class="settings__row-desc" style="color: var(--color-error, #f7768e);">{error}</span>
    </div>
  {/if}
</div>
