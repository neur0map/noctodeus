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
    gap: 6px;
    height: 32px;
    padding: 0 10px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-placeholder);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    position: relative;
    user-select: none;
    touch-action: none;
    transition:
      background 150ms var(--ease-expo-out),
      color 150ms var(--ease-expo-out);
    animation: tab-enter 400ms var(--ease-expo-out) both;
  }

  @keyframes tab-enter {
    from { opacity: 0; transform: translateY(-4px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .tab-item:hover:not(.tab-item--active) {
    color: var(--color-muted-foreground);
    background: var(--color-hover);
  }

  .tab-item--active {
    color: var(--color-foreground);
    background: var(--color-card);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .tab-item--dragging {
    opacity: 0.3;
  }

  .tab-item--drag-over {
    box-shadow: -2px 0 0 var(--color-accent);
  }

  .tab-item__icon {
    display: flex;
    align-items: center;
    color: currentColor;
    opacity: 0.5;
    flex-shrink: 0;
  }

  .tab-item--active .tab-item__icon {
    opacity: 0.7;
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
    width: 16px;
    height: 16px;
    margin-left: 2px;
    margin-right: -4px;
    border-radius: 4px;
    font-size: 13px;
    color: var(--color-placeholder);
    background: transparent;
    border: none;
    cursor: pointer;
    opacity: 0;
    transition:
      opacity 150ms var(--ease-expo-out),
      color 150ms var(--ease-expo-out),
      background 150ms var(--ease-expo-out);
  }

  .tab-item:hover .tab-item__close {
    opacity: 0.6;
  }

  .tab-item__close:hover {
    opacity: 1 !important;
    color: var(--color-foreground);
    background: rgba(255, 255, 255, 0.08);
  }

  @media (prefers-reduced-motion: reduce) {
    .tab-item { animation: none; }
  }
</style>
