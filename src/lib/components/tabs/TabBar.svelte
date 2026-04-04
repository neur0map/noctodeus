<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Tab } from '../../stores/tabs.svelte';
  import TabItem from './TabItem.svelte';

  let {
    tabs = [],
    activeTabId = '',
    trailing,
    onactivate,
    onclose,
    onreorder,
  }: {
    tabs?: Tab[];
    activeTabId?: string;
    trailing?: Snippet;
    onactivate: (id: string) => void;
    onclose: (id: string) => void;
    onreorder: (fromIndex: number, toIndex: number) => void;
  } = $props();

  let dragFromIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);
  let dragging = $state(false);
  let tabsContainer: HTMLDivElement | undefined = $state();

  function handlePointerDown(index: number, e: PointerEvent) {
    if (index === 0) return; // Home tab can't be dragged
    if ((e.target as HTMLElement).closest('.tab-item__close')) return; // Don't drag from close button

    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    let hasMoved = false;

    function onMove(ev: PointerEvent) {
      const dx = Math.abs(ev.clientX - startX);
      if (!hasMoved && dx < 5) return; // Threshold before drag starts

      if (!hasMoved) {
        hasMoved = true;
        dragging = true;
        dragFromIndex = index;
      }

      // Determine which tab the pointer is over
      if (!tabsContainer) return;
      const tabEls = Array.from(tabsContainer.querySelectorAll<HTMLElement>('.tab-item'));
      for (let i = 0; i < tabEls.length; i++) {
        const rect = tabEls[i].getBoundingClientRect();
        if (ev.clientX >= rect.left && ev.clientX <= rect.right) {
          dragOverIndex = i === 0 ? null : i; // Can't drop on home
          break;
        }
      }
    }

    function onUp() {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);

      if (hasMoved && dragFromIndex !== null && dragOverIndex !== null && dragFromIndex !== dragOverIndex) {
        onreorder(dragFromIndex, dragOverIndex);
      }

      dragFromIndex = null;
      dragOverIndex = null;
      dragging = false;
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }
</script>

<div class="tab-bar">
  <div class="tab-bar__tabs" bind:this={tabsContainer}>
    {#each tabs as tab, i (tab.id)}
      <TabItem
        {tab}
        isActive={tab.id === activeTabId}
        isDragging={dragging && dragFromIndex === i}
        isDragOver={dragging && dragOverIndex === i && dragFromIndex !== i}
        onactivate={() => onactivate(tab.id)}
        onclose={tab.type !== 'home' ? () => onclose(tab.id) : undefined}
        onpointerdown={(e) => handlePointerDown(i, e)}
      />
    {/each}
  </div>

  {#if trailing}
    <div class="tab-bar__trailing">
      {@render trailing()}
    </div>
  {/if}
</div>

<style>
  .tab-bar {
    display: flex;
    align-items: stretch;
    height: var(--shell-header-height);
    border-bottom: 1px solid rgba(255, 255, 255, 0.045);
    background: transparent;
    flex-shrink: 0;
    overflow: hidden;
  }

  .tab-bar__tabs {
    display: flex;
    align-items: stretch;
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1;
    min-width: 0;
    mask-image: linear-gradient(
      to right,
      black calc(100% - 24px),
      transparent 100%
    );
    -webkit-mask-image: linear-gradient(
      to right,
      black calc(100% - 24px),
      transparent 100%
    );
    scrollbar-width: none;
  }

  .tab-bar__tabs::-webkit-scrollbar {
    display: none;
  }

  .tab-bar__trailing {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding: 0 var(--space-2);
  }
</style>
