<script lang="ts">
  import type { QuickOpenItem } from '../../types/ui';

  let {
    items = [],
    selectedIndex = 0,
    onselect,
  }: {
    items?: QuickOpenItem[];
    selectedIndex?: number;
    onselect: (path: string) => void;
  } = $props();

  let listEl: HTMLElement | undefined = $state();

  // Scroll selected item into view
  $effect(() => {
    if (!listEl) return;
    const selected = listEl.querySelector('.results-list__item--selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  });

  function getDisplayName(item: QuickOpenItem): string {
    return item.title || item.name;
  }

  function getDisplayPath(item: QuickOpenItem): string {
    return item.parentPath || item.path;
  }

  function getFileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'md': return '\u25A0';
      case 'txt': return '\u25A1';
      case 'json': return '\u25C6';
      case 'yaml':
      case 'yml': return '\u25C7';
      case 'toml': return '\u25C8';
      default: return '\u25CB';
    }
  }
</script>

<div class="results-list" role="listbox" bind:this={listEl}>
  {#if items.length === 0}
    <div class="results-list__empty">No results</div>
  {:else}
    {#each items as item, i (item.path)}
      <button
        class="results-list__item"
        class:results-list__item--selected={i === selectedIndex}
        role="option"
        aria-selected={i === selectedIndex}
        onclick={() => onselect(item.path)}
      >
        <span class="results-list__icon">{getFileIcon(item.name)}</span>
        <span class="results-list__name">{getDisplayName(item)}</span>
        <span class="results-list__path">{getDisplayPath(item)}</span>
      </button>
    {/each}
  {/if}
</div>

<style>
  .results-list {
    overflow-y: auto;
    max-height: 340px;
    padding: var(--space-1) 0;
  }

  .results-list__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8) var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .results-list__item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-4);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .results-list__item:hover,
  .results-list__item--selected {
    background: var(--color-bg-hover);
  }

  .results-list__icon {
    flex-shrink: 0;
    width: 16px;
    font-size: 8px;
    color: var(--color-text-muted);
    text-align: center;
  }

  .results-list__name {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: var(--text-sm-leading);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .results-list__path {
    flex: 1;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--text-xs-leading);
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
  }
</style>
