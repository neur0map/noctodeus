<script lang="ts">
  import type { SearchHit } from '../../types/core';

  let {
    results = [],
    onselect,
    onsearch,
  }: {
    results: SearchHit[];
    onselect: (path: string) => void;
    onsearch: (query: string) => void;
  } = $props();

  let query = $state('');
  let focused = $state(false);
  let selectedIndex = $state(0);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function handleInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!query.trim()) {
      results = [];
      onsearch('');
      return;
    }
    debounceTimer = setTimeout(() => {
      onsearch(query.trim());
      selectedIndex = 0;
    }, 200);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!query.trim() || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % results.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + results.length) % results.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        onselect(results[selectedIndex].path);
        query = '';
      }
    } else if (e.key === 'Escape') {
      query = '';
      (e.target as HTMLElement).blur();
    }
  }
</script>

<div class="search-bar" class:search-bar--focused={focused}>
  <input
    class="search-bar__input"
    type="text"
    placeholder="Search files & content..."
    bind:value={query}
    oninput={handleInput}
    onfocus={() => focused = true}
    onblur={() => setTimeout(() => focused = false, 150)}
    onkeydown={handleKeydown}
  />

  {#if focused && query.trim() && results.length > 0}
    <div class="search-bar__results">
      {#each results.slice(0, 8) as hit, i (hit.path)}
        <button
          class="search-bar__result"
          class:search-bar__result--selected={i === selectedIndex}
          onmousedown={(e) => { e.preventDefault(); onselect(hit.path); query = ''; }}
        >
          <span class="search-bar__result-title">{hit.title || hit.path.split('/').pop()}</span>
          {#if hit.snippet}
            <span class="search-bar__result-snippet">{@html hit.snippet}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .search-bar {
    position: relative;
    padding: 0 var(--space-md, 12px);
    margin-bottom: var(--space-sm, 8px);
  }

  .search-bar__input {
    width: 100%;
    padding: var(--space-sm, 8px) var(--space-md, 12px);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-foreground);
    background: var(--surface-2, var(--color-hover));
    border: none;
    border-radius: 6px;
    outline: none;
    transition: box-shadow 150ms ease;
  }

  .search-bar__input:focus {
    box-shadow: var(--glow-focus, 0 0 0 2px rgba(122, 162, 247, 0.15));
  }

  .search-bar__input::placeholder {
    color: var(--text-muted, var(--color-placeholder));
    font-family: var(--font-mono);
  }

  .search-bar__results {
    position: absolute;
    top: 100%;
    left: 12px;
    right: 12px;
    background: var(--color-popover);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: var(--shadow-float);
    backdrop-filter: blur(12px);
    padding: 3px;
    z-index: 50;
    max-height: 240px;
    overflow-y: auto;
    margin-top: 4px;
    animation: dropdown-in 250ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes dropdown-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .search-bar__result {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    padding: 5px 8px;
    border: none;
    border-radius: 5px;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .search-bar__result:hover,
  .search-bar__result--selected {
    background: var(--color-hover);
  }

  .search-bar__result-title {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search-bar__result-snippet {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search-bar__result-snippet :global(mark) {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-foreground);
    border-radius: 2px;
    padding: 0 1px;
  }

  @media (prefers-reduced-motion: reduce) {
    .search-bar__results {
      animation: none;
    }
  }
</style>
