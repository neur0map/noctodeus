<script lang="ts">
  import { onMount } from 'svelte';
  import type { CoreInfo } from '../../types/core';
  import Check from '@lucide/svelte/icons/check';
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import { toast } from '../../stores/toast.svelte';
  import { logger } from '../../logger';

  let {
    activeCore = null,
    onswitch,
    onopen,
  }: {
    activeCore: CoreInfo | null;
    onswitch: (core: CoreInfo) => void;
    onopen: () => void;
  } = $props();

  let open = $state(false);
  let cores = $state<CoreInfo[]>([]);
  let dropdownEl: HTMLDivElement | undefined = $state();

  async function loadCores() {
    try {
      const { listCores } = await import('../../bridge/commands');
      cores = await listCores();
    } catch (err) {
      logger.error(`Failed to list cores: ${err}`);
    }
  }

  function handleToggle() {
    if (!open) loadCores();
    open = !open;
  }

  function handleSelect(core: CoreInfo) {
    open = false;
    if (core.path !== activeCore?.path) {
      onswitch(core);
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (open && dropdownEl && !dropdownEl.contains(e.target as Node)) {
      open = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
</script>

<div class="core-switcher" bind:this={dropdownEl}>
  <button class="core-switcher__trigger" onclick={handleToggle} title="Switch core">
    <span class="core-switcher__name">{activeCore?.name ?? 'No core open'}</span>
    <ChevronsUpDown size={12} />
  </button>

  {#if open}
    <div class="core-switcher__dropdown">
      {#if cores.length > 0}
        {#each cores as core (core.id)}
          <button class="core-switcher__item" onclick={() => handleSelect(core)}>
            {#if core.path === activeCore?.path}
              <Check size={14} />
            {:else}
              <span class="core-switcher__spacer"></span>
            {/if}
            <span class="core-switcher__item-name">{core.name}</span>
          </button>
        {/each}
      {:else}
        <div class="core-switcher__empty">No cores yet</div>
      {/if}

      <div class="core-switcher__divider"></div>

      <button class="core-switcher__item" onclick={() => { open = false; onopen(); }}>
        <FolderOpen size={14} />
        <span>Open core</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .core-switcher {
    position: relative;
  }

  .core-switcher__trigger {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-muted-foreground);
    font-family: var(--font-mono);
    font-size: 12px;
    cursor: pointer;
    transition: color 150ms var(--ease-expo-out);
  }

  .core-switcher__trigger:hover {
    color: var(--color-foreground);
  }

  .core-switcher__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }

  .core-switcher__dropdown {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    min-width: 200px;
    max-width: 280px;
    background: var(--color-popover);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: var(--shadow-float);
    backdrop-filter: blur(12px);
    padding: 4px;
    z-index: 100;
    animation: switcher-in 250ms var(--ease-expo-out) both;
  }

  @keyframes switcher-in {
    from { opacity: 0; transform: translateY(4px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .core-switcher__item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-muted-foreground);
    font-family: var(--font-mono);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: background 150ms var(--ease-expo-out), color 150ms var(--ease-expo-out);
  }

  .core-switcher__item:hover {
    background: var(--color-hover);
    color: var(--color-foreground);
  }

  .core-switcher__item-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .core-switcher__spacer {
    width: 14px;
    flex-shrink: 0;
  }

  .core-switcher__divider {
    height: 1px;
    background: var(--color-border);
    margin: 4px 0;
  }

  .core-switcher__empty {
    padding: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-placeholder);
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .core-switcher__dropdown { animation: none; }
  }
</style>
