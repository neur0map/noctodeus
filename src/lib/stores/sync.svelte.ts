import { syncStatus, syncSmart, type SyncStatus, type SyncResult } from '$lib/bridge/sync';

let status = $state<SyncStatus>({
  configured: false,
  syncing: false,
  lastPushAt: null,
  lastPullAt: null,
  hasLocalChanges: false,
  error: null,
  syncedCoreIds: [],
  remoteUrl: null,
});

let lastError = $state<string | null>(null);
let initialized = false;

export function getSyncState() {
  // Auto-refresh on first access
  if (!initialized) {
    initialized = true;
    syncStatus().then(s => { status = s; }).catch(() => {});
  }

  return {
    get status() { return status; },
    get lastError() { return lastError; },

    async refresh() {
      try {
        status = await syncStatus();
        lastError = null;
      } catch (err) {
        lastError = ((err as any)?.message || (err as any)?.detail || (typeof err === 'string' ? err : JSON.stringify(err)));
      }
    },

    async sync(): Promise<SyncResult | null> {
      if (status.syncing) return null;
      status = { ...status, syncing: true, error: null };
      try {
        const result = await syncSmart();
        await this.refresh();
        return result;
      } catch (err) {
        lastError = ((err as any)?.message || (err as any)?.detail || (typeof err === 'string' ? err : JSON.stringify(err)));
        status = { ...status, syncing: false, error: ((err as any)?.message || (err as any)?.detail || (typeof err === 'string' ? err : JSON.stringify(err))) };
        return null;
      }
    },

    reset() {
      status = {
        configured: false,
        syncing: false,
        lastPushAt: null,
        lastPullAt: null,
        hasLocalChanges: false,
        error: null,
        syncedCoreIds: [],
        remoteUrl: null,
      };
      lastError = null;
    },
  };
}
