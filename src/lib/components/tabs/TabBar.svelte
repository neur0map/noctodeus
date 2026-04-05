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

  // Ghost state
  let ghost: HTMLDivElement | null = null;
  let ghostOffsetX = 0;

  function handlePointerDown(index: number, e: PointerEvent) {
    if (index === 0) return;
    if ((e.target as HTMLElement).closest('.tab-item__close')) return;

    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    let hasMoved = false;

    function onMove(ev: PointerEvent) {
      const dx = Math.abs(ev.clientX - startX);
      if (!hasMoved && dx < 5) return;

      if (!hasMoved) {
        hasMoved = true;
        dragging = true;
        dragFromIndex = index;

        // Create floating ghost from the source tab
        const rect = el.getBoundingClientRect();
        ghostOffsetX = ev.clientX - rect.left;

        ghost = document.createElement('div');
        ghost.className = 'tab-ghost';
        ghost.textContent = el.textContent;
        ghost.style.cssText = `
          position: fixed;
          top: ${rect.top}px;
          left: ${ev.clientX - ghostOffsetX}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 0 12px;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-foreground);
          background: rgba(25, 26, 35, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06);
          pointer-events: none;
          z-index: 9999;
          transform: scale(1.04);
          transition: transform 120ms cubic-bezier(0.16, 1, 0.3, 1);
          backdrop-filter: blur(12px);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        `;
        document.body.appendChild(ghost);
      }

      // Move ghost
      if (ghost) {
        ghost.style.left = `${ev.clientX - ghostOffsetX}px`;
      }

      // Determine drop target by midpoint comparison
      if (!tabsContainer) return;
      const tabEls = Array.from(tabsContainer.querySelectorAll<HTMLElement>('.tab-item'));
      let newOverIndex: number | null = null;
      for (let i = 0; i < tabEls.length; i++) {
        if (i === 0) continue; // Can't drop on home
        const rect = tabEls[i].getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        if (ev.clientX < mid) {
          newOverIndex = i;
          break;
        }
        newOverIndex = i;
      }
      dragOverIndex = newOverIndex;
    }

    function onUp() {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);

      if (hasMoved && dragFromIndex !== null && dragOverIndex !== null && dragFromIndex !== dragOverIndex) {
        onreorder(dragFromIndex, dragOverIndex);
      }

      // Remove ghost
      if (ghost) {
        ghost.remove();
        ghost = null;
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
    height: 52px;
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
    padding: 0 8px;
  }
</style>
