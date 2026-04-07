<script lang="ts">
  import type { Tab } from '../../stores/tabs.svelte';
  import { fileIcon, nerdIcon } from '$lib/utils/nerd-icons';

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
      {nerdIcon('home')}
    {:else}
      {fileIcon(tab.fileNode?.name ?? tab.label)}
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
    height: 34px;
    padding: 0 var(--space-md, 12px);
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-muted, var(--color-placeholder));
    background: transparent;
    border: none;
    border-top: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    position: relative;
    user-select: none;
    touch-action: none;
    transition:
      background 150ms var(--ease-expo-out),
      color 150ms var(--ease-expo-out),
      border-color 150ms var(--ease-expo-out);
    animation: tab-enter 400ms var(--ease-expo-out) both;
  }

  @keyframes tab-enter {
    from { opacity: 0; transform: translateY(-4px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .tab-item:hover:not(.tab-item--active) {
    color: var(--text-secondary, var(--color-muted-foreground));
  }

  .tab-item--active {
    color: var(--text-primary, var(--color-foreground));
  }

  .tab-item--dragging {
    opacity: 0.3;
  }

  .tab-item--drag-over {
    box-shadow: -2px 0 0 var(--accent-blue, var(--color-accent));
  }

  .tab-item__icon {
    display: flex;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 13px;
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
    color: var(--text-muted, var(--color-placeholder));
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
    opacity: 1;
  }

  .tab-item__close:hover {
    opacity: 1 !important;
    color: var(--accent-red, #F7768E);
    background: rgba(255, 255, 255, 0.08);
  }

  @media (prefers-reduced-motion: reduce) {
    .tab-item { animation: none; }
  }
</style>
