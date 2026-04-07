<script lang="ts">
  import { getSyncState } from '$lib/stores/sync.svelte';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Check from '@lucide/svelte/icons/check';
  import AlertCircle from '@lucide/svelte/icons/alert-circle';
  import Circle from '@lucide/svelte/icons/circle';

  const sync = getSyncState();

  async function handleSync() {
    if (!sync.status.configured || sync.status.syncing) return;
    const { toast } = await import('$lib/stores/toast.svelte');
    const result = await sync.sync();
    if (result) {
      if (result.conflicts.length > 0) {
        toast.warn(`Synced with ${result.conflicts.length} conflict(s)`);
      } else {
        const total = result.filesPushed + result.filesPulled;
        toast.success(total > 0 ? `Synced -- ${total} files updated` : 'Already up to date');
      }
    } else if (sync.lastError) {
      toast.error(`Sync failed: ${sync.lastError}`);
    }
  }
</script>

{#if sync.status.configured}
  <button
    class="sync-btn"
    class:sync-btn--syncing={sync.status.syncing}
    class:sync-btn--error={!!sync.status.error}
    class:sync-btn--pending={sync.status.hasLocalChanges}
    onclick={handleSync}
    disabled={sync.status.syncing}
    title={sync.status.syncing ? 'Syncing...' : 'Sync now'}
  >
    {#if sync.status.syncing}
      <RefreshCw size={13} class="sync-btn__spin" />
    {:else if sync.status.error}
      <AlertCircle size={13} />
    {:else if sync.status.hasLocalChanges}
      <Circle size={13} />
    {:else}
      <Check size={13} />
    {/if}
  </button>
{/if}

<style>
  .sync-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-muted-foreground);
    cursor: pointer;
    transition: color 150ms ease-out, background 150ms ease-out;
  }

  .sync-btn:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  .sync-btn--syncing {
    color: var(--color-accent);
  }

  .sync-btn--syncing :global(.sync-btn__spin) {
    animation: spin 1s linear infinite;
  }

  .sync-btn--error {
    color: var(--color-error, #f7768e);
  }

  .sync-btn--pending {
    color: var(--color-accent);
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
