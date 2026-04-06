<script lang="ts">
  import SearchInput from './SearchInput.svelte';
  import ResultsList from './ResultsList.svelte';
  import type { QuickOpenItem } from '../../types/ui';
  import { searchQuery } from '../../bridge/commands';

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
  let contentResults = $state<QuickOpenItem[]>([]);
  let searching = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  /** Strip common markdown syntax from snippet text while preserving <b> highlight tags. */
  function cleanSnippet(s: string): string {
    // Temporarily replace <b> tags
    const preserved: string[] = [];
    let cleaned = s.replace(/<b>(.*?)<\/b>/g, (_, content) => {
      preserved.push(content);
      return `\x00${preserved.length - 1}\x00`;
    });

    // Strip markdown
    cleaned = cleaned
      .replace(/#{1,6}\s*/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
      .replace(/[*_~`]/g, '')
      .replace(/---+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Restore <b> tags
    cleaned = cleaned.replace(/\x00(\d+)\x00/g, (_, i) => `<b>${preserved[parseInt(i)]}</b>`);

    return cleaned;
  }

  // File-name matches (instant, client-side)
  let nameMatches = $derived(
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

  // Merged results: name matches first, then content-only matches (deduplicated)
  let filtered = $derived.by(() => {
    if (query.length === 0) return items;
    const seen = new Set<string>();
    const result: QuickOpenItem[] = [];

    // Name matches first
    for (const item of nameMatches) {
      if (!seen.has(item.path)) {
        seen.add(item.path);
        result.push(item);
      }
    }

    // Then content-only matches
    for (const item of contentResults) {
      if (!seen.has(item.path)) {
        seen.add(item.path);
        result.push(item);
      }
    }

    return result;
  });

  // FTS search with debounce
  $effect(() => {
    const q = query;
    if (debounceTimer) clearTimeout(debounceTimer);

    if (q.length < 2) {
      contentResults = [];
      searching = false;
      return;
    }

    searching = true;
    debounceTimer = setTimeout(async () => {
      try {
        // Sanitize query for FTS5: strip characters that break MATCH syntax
        const sanitized = q.replace(/['"()\-{}[\]:^~@!]/g, ' ').trim();
        if (!sanitized) {
          contentResults = [];
          searching = false;
          return;
        }
        const ftsQuery = sanitized.split(/\s+/).filter(Boolean).map(w => `${w}*`).join(' ');
        const hits = await searchQuery(ftsQuery);
        contentResults = hits.map(h => ({
          path: h.path,
          name: h.path.split('/').pop() ?? h.path,
          title: h.title,
          snippet: cleanSnippet(h.snippet),
          parentPath: h.path.includes('/') ? h.path.slice(0, h.path.lastIndexOf('/')) : undefined,
        }));
      } catch {
        contentResults = [];
      }
      searching = false;
    }, 200);
  });

  // Reset state when toggling visibility
  $effect(() => {
    if (visible) {
      query = '';
      selectedIndex = 0;
      contentResults = [];
      searching = false;
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
      <SearchInput bind:value={query} placeholder="Search files and content..." />
      {#if searching}
        <div class="quick-open__searching">Searching...</div>
      {/if}
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
    backdrop-filter: blur(8px);
    z-index: 100;
    animation: quick-open-backdrop-in 300ms ease both;
  }

  @keyframes quick-open-backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .quick-open {
    width: min(600px, 90vw);
    max-height: 480px;
    background: var(--surface-2, var(--color-popover));
    border-radius: 12px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: quick-open-enter 450ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes quick-open-enter {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .quick-open__searching {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-placeholder);
    padding: 2px 16px 4px;
    opacity: 0.7;
  }

  @media (prefers-reduced-motion: reduce) {
    .quick-open__backdrop,
    .quick-open {
      animation: none;
    }
  }
</style>
