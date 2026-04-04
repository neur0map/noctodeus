import type { CoreInfo } from '../types/core';

// Svelte 5 rune-based store
let activeCore = $state<CoreInfo | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);

export function getCoreState() {
  return {
    get activeCore() {
      return activeCore;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    setCore(core: CoreInfo | null) {
      activeCore = core;
    },
    setLoading(v: boolean) {
      loading = v;
    },
    setError(e: string | null) {
      error = e;
    },
    reset() {
      activeCore = null;
      loading = false;
      error = null;
    },
  };
}
