<script lang="ts">
  interface SuggestItem {
    path: string;
    name: string;
    title: string | null;
  }

  let {
    query = '',
    items = [],
    visible = false,
    position = { top: 0, left: 0 },
    onselect,
    onclose,
  }: {
    query: string;
    items: SuggestItem[];
    visible: boolean;
    position: { top: number; left: number };
    onselect: (target: string) => void;
    onclose: () => void;
  } = $props();

  let selectedIndex = $state(0);

  const filtered = $derived(
    query
      ? items.filter((item) => {
          const q = query.toLowerCase();
          return (
            item.name.toLowerCase().includes(q) ||
            (item.title?.toLowerCase().includes(q) ?? false)
          );
        })
      : items,
  );

  $effect(() => {
    // Reset selection when query or filtered results change
    query;
    selectedIndex = 0;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (!visible || filtered.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % filtered.length;
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length;
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onselect(filtered[selectedIndex].name);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onclose();
        break;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if visible && filtered.length > 0}
  <div
    class="wiki-suggest"
    style="top: {position.top}px; left: {position.left}px;"
    role="listbox"
    aria-label="Wiki link suggestions"
  >
    {#each filtered as item, i (item.path)}
      <button
        class="wiki-suggest__item"
        class:wiki-suggest__item--selected={i === selectedIndex}
        role="option"
        aria-selected={i === selectedIndex}
        onmousedown={(e) => { e.preventDefault(); onselect(item.name); }}
        onmouseenter={() => { selectedIndex = i; }}
      >
        <span class="wiki-suggest__name">{item.name}</span>
        {#if item.title}
          <span class="wiki-suggest__title">{item.title}</span>
        {/if}
      </button>
    {/each}
  </div>
{/if}

<style>
  .wiki-suggest {
    position: fixed;
    z-index: 50;
    width: 300px;
    max-height: 240px;
    overflow-y: auto;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    box-shadow: var(--shadow-elevated);
    padding: var(--space-1);
    animation: slide-in var(--duration-fast) var(--ease-out) both;
  }

  .wiki-suggest__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .wiki-suggest__item:hover,
  .wiki-suggest__item--selected {
    background: var(--color-bg-hover);
  }

  .wiki-suggest__name {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: var(--text-sm-leading);
    color: var(--color-text-primary);
  }

  .wiki-suggest__title {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--text-xs-leading);
    color: var(--color-text-muted);
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .wiki-suggest {
      animation: none;
    }
  }
</style>
