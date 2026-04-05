<script lang="ts">
  import type { Tab } from '../../stores/tabs.svelte';
  import Home from "@lucide/svelte/icons/house";
  import FileText from "@lucide/svelte/icons/file-text";
  import File from "@lucide/svelte/icons/file";

  let {
    tab,
    isActive = false,
    isDragging = false,
    isDragOver = false,
    onactivate,
    onclose,
    onpointerdown,
  }: {
    tab: Tab;
    isActive?: boolean;
    isDragging?: boolean;
    isDragOver?: boolean;
    onactivate: () => void;
    onclose?: () => void;
    onpointerdown?: (e: PointerEvent) => void;
  } = $props();

  function handleAuxClick(e: MouseEvent) {
    if (e.button === 1 && onclose) {
      e.preventDefault();
      onclose();
    }
  }

  function getTabIcon(tab: Tab): string {
    if (tab.type === 'home') return 'home';
    const ext = tab.fileNode?.extension?.toLowerCase();
    switch (ext) {
      case 'md': case 'markdown': case 'mdx': return 'markdown';
      case 'txt': return 'text';
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
  class:tab-item--dragging={isDragging}
  class:tab-item--drag-over={isDragOver}
  class:tab-item--home={tab.type === 'home'}
  onclick={onactivate}
  onauxclick={handleAuxClick}
  onpointerdown={onpointerdown}
  title={tab.type === 'file' ? tab.fileNode?.path : 'Home'}
>
  <span class="tab-item__icon">
    {#if tab.type === 'home'}
      <Home size={12} />
    {:else if tab.fileNode?.extension === 'md' || tab.fileNode?.extension === 'markdown'}
      <FileText size={12} />
    {:else}
      <File size={12} />
    {/if}
  </span>
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
    gap: 4px;
    height: 40px;
    padding: 0 12px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-placeholder);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    position: relative;
    user-select: none;
    touch-action: none;
    transition:
      background 150ms ease,
      color 150ms ease;
    animation: tab-enter 150ms ease both;
  }

  @keyframes tab-enter {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .tab-item:hover:not(.tab-item--active) {
    color: var(--color-muted-foreground);
  }

  .tab-item--active {
    color: var(--color-foreground);
    border-bottom-color: var(--color-accent);
  }

  .tab-item--dragging {
    opacity: 0.3;
  }

  .tab-item--drag-over {
    border-left: 2px solid var(--color-accent);
  }

  .tab-item--home {
    padding-left: 8px;
  }

  .tab-item__icon {
    font-size: 10px;
    color: currentColor;
    opacity: 0.6;
    flex-shrink: 0;
  }

  .tab-item__label {
    font-family: var(--font-mono);
    font-size: 12px;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-item__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    margin-left: 4px;
    border-radius: 4px;
    font-size: 13px;
    color: var(--color-placeholder);
    background: transparent;
    border: none;
    cursor: pointer;
    opacity: 0;
    transition:
      opacity 150ms ease,
      color 150ms ease;
  }

  .tab-item:hover .tab-item__close {
    opacity: 1;
  }

  .tab-item__close:hover {
    color: var(--color-foreground);
  }
</style>
