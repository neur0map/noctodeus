<script lang="ts">
  import type { Tab } from '../../stores/tabs.svelte';

  let {
    tab,
    isActive = false,
    onactivate,
    onclose,
    ondragstart,
    ondragover,
    ondrop,
    ondragend,
  }: {
    tab: Tab;
    isActive?: boolean;
    onactivate: () => void;
    onclose?: () => void;
    ondragstart?: (e: DragEvent) => void;
    ondragover?: (e: DragEvent) => void;
    ondrop?: (e: DragEvent) => void;
    ondragend?: (e: DragEvent) => void;
  } = $props();

  let isDragOver = $state(false);

  function handleAuxClick(e: MouseEvent) {
    if (e.button === 1 && onclose) {
      e.preventDefault();
      onclose();
    }
  }

  function getTabIcon(tab: Tab): string {
    if (tab.type === 'home') return '\u2302';
    const ext = tab.fileNode?.extension?.toLowerCase();
    switch (ext) {
      case 'md': return '\u25A0';
      case 'txt': return '\u25A1';
      case 'json': return '\u25C6';
      case 'yaml': case 'yml': return '\u25C7';
      case 'toml': return '\u25C8';
      default: return '\u25CB';
    }
  }
</script>

<button
  class="tab-item"
  class:tab-item--active={isActive}
  class:tab-item--drag-over={isDragOver}
  class:tab-item--home={tab.type === 'home'}
  onclick={onactivate}
  onauxclick={handleAuxClick}
  draggable={tab.type !== 'home'}
  ondragstart={ondragstart}
  ondragover={(e) => {
    e.preventDefault();
    isDragOver = true;
    ondragover?.(e);
  }}
  ondragleave={() => isDragOver = false}
  ondrop={(e) => {
    isDragOver = false;
    ondrop?.(e);
  }}
  ondragend={ondragend}
  title={tab.type === 'file' ? tab.fileNode?.path : 'Home'}
>
  <span class="tab-item__icon">{getTabIcon(tab)}</span>
  <span class="tab-item__label">{tab.label}</span>
  {#if tab.type !== 'home' && onclose}
    <span
      class="tab-item__close"
      role="button"
      tabindex={0}
      onclick={(e) => { e.stopPropagation(); onclose?.(); }}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onclose?.(); } }}
      aria-label="Close tab"
    >
      ×
    </span>
  {/if}
</button>

<style>
  .tab-item {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: 36px;
    padding: 0 var(--space-3);
    font-family: var(--font-mono);
    font-size: 12px;
    color: rgba(255, 255, 255, 0.52);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    position: relative;
    user-select: none;
    transition:
      color var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out);
    animation: tab-enter var(--duration-normal) var(--ease-out) both;
  }

  @keyframes tab-enter {
    from {
      opacity: 0;
      transform: translateX(12px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .tab-item:hover {
    color: rgba(255, 255, 255, 0.84);
    background: rgba(255, 255, 255, 0.03);
  }

  .tab-item--active {
    color: var(--color-text-primary);
    border-bottom-color: var(--color-accent);
  }

  .tab-item--drag-over {
    background: rgba(122, 141, 255, 0.08);
  }

  .tab-item--home {
    padding-left: var(--space-2);
  }

  .tab-item:active:not(.tab-item--home) {
    transform: scale(1.03);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .tab-item__icon {
    font-size: 10px;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .tab-item__label {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
  }

  .tab-item__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-left: var(--space-1);
    border-radius: 4px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.36);
    background: transparent;
    border: none;
    cursor: pointer;
    opacity: 0;
    transition:
      opacity var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out);
  }

  .tab-item:hover .tab-item__close {
    opacity: 1;
  }

  .tab-item__close:hover {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.08);
  }
</style>
