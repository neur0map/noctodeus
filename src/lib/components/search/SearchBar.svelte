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
    padding: 0 calc(var(--space-3) * var(--sidebar-density));
    margin-bottom: var(--space-1);
  }

  .search-bar__input {
    width: 100%;
    padding: 5px 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    outline: none;
    transition: border-color var(--duration-fast) var(--ease-out);
  }

  .search-bar__input:focus {
    border-color: var(--color-accent);
    background: rgba(255, 255, 255, 0.06);
  }

  .search-bar__input::placeholder {
    color: rgba(255, 255, 255, 0.24);
  }

  .search-bar__results {
    position: absolute;
    top: 100%;
    left: calc(var(--space-3) * var(--sidebar-density));
    right: calc(var(--space-3) * var(--sidebar-density));
    background: rgba(18, 19, 24, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
    padding: 3px;
    z-index: 50;
    max-height: 240px;
    overflow-y: auto;
    margin-top: 4px;
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
    transition: background var(--duration-fast) var(--ease-out);
  }

  .search-bar__result:hover,
  .search-bar__result--selected {
    background: rgba(255, 255, 255, 0.06);
  }

  .search-bar__result-title {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search-bar__result-snippet {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.36);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search-bar__result-snippet :global(mark) {
    background: rgba(99, 102, 241, 0.25);
    color: var(--color-text-primary);
    border-radius: 2px;
    padding: 0 1px;
  }
</style>
