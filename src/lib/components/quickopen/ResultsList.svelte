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
        <div class="results-list__row">
          <span class="results-list__icon">{getFileIcon(item.name)}</span>
          <span class="results-list__name">{getDisplayName(item)}</span>
          <span class="results-list__path">{getDisplayPath(item)}</span>
        </div>
        {#if item.snippet}
          <div class="results-list__snippet">{@html item.snippet}</div>
        {/if}
      </button>
    {/each}
  {/if}
</div>

<style>
  .results-list {
    overflow-y: auto;
    max-height: 340px;
    padding: 4px 0;
  }

  .results-list__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-placeholder);
  }

  .results-list__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 8px 16px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 150ms var(--ease-expo-out);
  }

  .results-list__row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .results-list__item:hover,
  .results-list__item--selected {
    background: var(--color-hover);
  }

  .results-list__icon {
    flex-shrink: 0;
    width: 16px;
    font-size: 8px;
    color: var(--color-placeholder);
    text-align: center;
  }

  .results-list__name {
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .results-list__path {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.4;
    color: var(--color-placeholder);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
  }

  .results-list__snippet {
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-muted, var(--color-placeholder));
    padding-left: 24px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Highlight matched terms in snippet */
  .results-list__snippet :global(b) {
    color: var(--accent-yellow, #E0AF68);
    font-weight: 600;
  }
</style>
