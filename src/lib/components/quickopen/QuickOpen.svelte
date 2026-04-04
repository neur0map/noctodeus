<script lang="ts">
  import SearchInput from './SearchInput.svelte';
  import ResultsList from './ResultsList.svelte';
  import type { QuickOpenItem } from '../../types/ui';

  let {
    visible = false,
    items = [],
    onselect,
    onclose,
  }: {
    visible?: boolean;
    items?: QuickOpenItem[];
    onselect: (path: string) => void;
    onclose: () => void;
  } = $props();

  let query = $state('');
  let selectedIndex = $state(0);

  let filtered = $derived(
    query.length === 0
      ? items
      : items.filter((item) => {
          const q = query.toLowerCase();
          return (
            item.name.toLowerCase().includes(q) ||
            item.path.toLowerCase().includes(q) ||
            (item.title && item.title.toLowerCase().includes(q))
          );
        })
  );

  // Reset state when toggling visibility
  $effect(() => {
    if (visible) {
      query = '';
      selectedIndex = 0;
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onselect(filtered[selectedIndex].path);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onclose();
        break;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('quick-open__backdrop')) {
      onclose();
    }
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="quick-open__backdrop"
    onkeydown={handleKeydown}
    onclick={handleBackdropClick}
  >
    <div class="quick-open" role="dialog" aria-label="Quick open">
      <SearchInput bind:value={query} placeholder="Search files..." />
      <ResultsList
        items={filtered}
        {selectedIndex}
        onselect={(path) => onselect(path)}
      />
    </div>
  </div>
{/if}

<style>
  .quick-open__backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 20vh;
    background: rgba(0, 0, 0, 0.5);
    z-index: 100;
    animation: fade-in var(--duration-fast) var(--ease-out) both;
  }

  .quick-open {
    width: 560px;
    max-height: 400px;
    background: var(--color-bg-elevated);
    border-radius: 12px;
    box-shadow: var(--shadow-elevated);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: quick-open-enter var(--duration-normal) var(--ease-spring) both;
  }

  @keyframes quick-open-enter {
    from {
      opacity: 0;
      transform: scale(0.98);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
