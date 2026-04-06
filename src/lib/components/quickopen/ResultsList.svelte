<script lang="ts">
  import type { QuickOpenItem } from '../../types/ui';
  import { fileIcon } from '$lib/utils/nerd-icons';
  import { animate } from 'animejs';

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

  $effect(() => {
    if (!listEl) return;
    const selected = listEl.querySelector('.rl__item--sel');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  });

  function displayName(item: QuickOpenItem): string {
    return item.title || item.name.replace(/\.\w+$/, '');
  }

  function shortPath(item: QuickOpenItem): string {
    const p = item.parentPath || item.path;
    const parts = p.split('/').filter(Boolean);
    if (parts.length <= 1) return parts[0] || '';
    return parts.slice(-2).join('/');
  }

  /** Micro-press on click — gives tactile feedback */
  function handleItemClick(e: MouseEvent, path: string) {
    const el = (e.currentTarget as HTMLElement);
    animate(el, {
      scale: [1, 0.97, 1],
      duration: 200,
      ease: 'outQuint',
    });
    setTimeout(() => onselect(path), 100);
  }
</script>

<div class="rl" role="listbox" bind:this={listEl}>
  {#if items.length === 0}
    <div class="rl__empty">
      <span class="rl__empty-icon">⌕</span>
      <span>No matches found</span>
    </div>
  {:else}
    {#each items as item, i (item.path + i)}
      <button
        class="rl__item"
        class:rl__item--sel={i === selectedIndex}
        role="option"
        aria-selected={i === selectedIndex}
        onclick={(e) => handleItemClick(e, item.path)}
      >
        <span class="rl__icon">{fileIcon(item.name)}</span>
        <div class="rl__content">
          <div class="rl__top">
            <span class="rl__name">{displayName(item)}</span>
            <span class="rl__path">{shortPath(item)}</span>
          </div>
          {#if item.snippet}
            <div class="rl__snippet">{@html item.snippet}</div>
          {/if}
        </div>
      </button>
    {/each}
  {/if}
</div>

<style>
  .rl {
    overflow-y: auto;
    max-height: 420px;
    padding: 8px;
  }

  .rl__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 40px 16px;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-faint, #3B4261);
  }

  .rl__empty-icon {
    font-size: 24px;
    opacity: 0.5;
  }

  .rl__item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 120ms ease-out;
    position: relative;
    will-change: transform, opacity;
  }

  .rl__item:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .rl__item--sel {
    background: rgba(122, 162, 247, 0.08);
  }

  .rl__item--sel::before {
    content: '';
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    border-radius: 2px;
    background: var(--accent-blue, #7AA2F7);
  }

  .rl__icon {
    flex-shrink: 0;
    width: 20px;
    font-family: var(--font-mono);
    font-size: 15px;
    color: var(--text-muted, #6B7394);
    text-align: center;
    line-height: 1.4;
    padding-top: 1px;
  }

  .rl__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .rl__top {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .rl__name {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
    color: var(--text-primary, #C0CAF5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rl__item--sel .rl__name {
    color: var(--accent-blue, #7AA2F7);
  }

  .rl__path {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-faint, #3B4261);
    margin-left: auto;
  }

  .rl__snippet {
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.5;
    color: var(--text-muted, #6B7394);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.8;
  }

  /* Highlight matched terms — uses <span class="hl"> to avoid global <b> style conflicts */
  .rl__snippet :global(.hl) {
    color: var(--accent-blue, #7AA2F7);
    font-weight: 500;
  }

  /* Fallback: also override <b> in case any slip through */
  .rl__snippet :global(b),
  .rl__snippet :global(strong) {
    color: var(--accent-blue, #7AA2F7);
    font-weight: 500;
    background: none !important;
    background-color: transparent !important;
  }
</style>
