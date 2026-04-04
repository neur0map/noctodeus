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

  function handleDragStart(index: number, e: DragEvent) {
    if (index === 0) return;
    dragFromIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  }

  function handleDragOver(index: number, e: DragEvent) {
    if (index === 0) return;
    e.preventDefault();
  }

  function handleDrop(index: number) {
    if (dragFromIndex !== null && index !== 0 && dragFromIndex !== index) {
      onreorder(dragFromIndex, index);
    }
    dragFromIndex = null;
  }

  function handleDragEnd() {
    dragFromIndex = null;
  }
</script>

<div class="tab-bar">
  <div class="tab-bar__tabs">
    {#each tabs as tab, i (tab.id)}
      <TabItem
        {tab}
        isActive={tab.id === activeTabId}
        onactivate={() => onactivate(tab.id)}
        onclose={tab.type !== 'home' ? () => onclose(tab.id) : undefined}
        ondragstart={(e) => handleDragStart(i, e)}
        ondragover={(e) => handleDragOver(i, e)}
        ondrop={() => handleDrop(i)}
        ondragend={handleDragEnd}
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
