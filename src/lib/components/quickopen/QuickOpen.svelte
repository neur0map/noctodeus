<script lang="ts">
  import SearchInput from './SearchInput.svelte';
  import ResultsList from './ResultsList.svelte';
  import type { QuickOpenItem } from '../../types/ui';
  import { searchQuery } from '../../bridge/commands';
  import { animate, stagger, createSpring } from 'animejs';

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
  let modalEl: HTMLElement | undefined = $state();
  let backdropEl: HTMLElement | undefined = $state();
  let prevResultCount = 0;

  const entrySpring = createSpring({ stiffness: 260, damping: 22, mass: 0.7 });

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

    // Restore as <span class="hl"> — avoids global <b>/bold/yellow styles
    cleaned = cleaned.replace(/\x00(\d+)\x00/g, (_, i) => `<span class="hl">${preserved[parseInt(i)]}</span>`);

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

  // Reset state when toggling visibility + entrance animation
  $effect(() => {
    if (visible) {
      query = '';
      selectedIndex = 0;
      contentResults = [];
      searching = false;
      prevResultCount = 0;

      // Animate entrance with anime.js
      requestAnimationFrame(() => {
        if (backdropEl) {
          animate(backdropEl, {
            opacity: [0, 1],
            duration: 200,
            ease: 'outQuad',
          });
        }
        if (modalEl) {
          animate(modalEl, {
            opacity: [0, 1],
            scale: [0.96, 1],
            translateY: [8, 0],
            duration: 350,
            ease: entrySpring,
          });
        }
      });
    }
  });

  // Stagger-animate new results when they appear
  $effect(() => {
    const count = filtered.length;
    if (count > 0 && count !== prevResultCount) {
      requestAnimationFrame(() => {
        const items = modalEl?.querySelectorAll('.rl__item');
        if (items && items.length > 0) {
          animate(items, {
            opacity: [0, 1],
            translateY: [6, 0],
            delay: stagger(30, { start: 20 }),
            duration: 250,
            ease: 'outQuint',
          });
        }
      });
    }
    prevResultCount = count;
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
    bind:this={backdropEl}
    onkeydown={handleKeydown}
    onclick={handleBackdropClick}
  >
    <div class="quick-open" bind:this={modalEl} role="dialog" aria-label="Quick open">
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
    padding-top: 15vh;
    background: rgba(5, 8, 17, 0.7);
    backdrop-filter: blur(12px) saturate(0.8);
    z-index: 100;
    opacity: 0; /* anime.js handles entrance */
  }

  .quick-open {
    width: min(620px, 90vw);
    max-height: 520px;
    background: linear-gradient(
      180deg,
      rgba(26, 30, 46, 0.98) 0%,
      rgba(19, 22, 31, 0.99) 100%
    );
    border-radius: 14px;
    border: 1px solid rgba(122, 162, 247, 0.06);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.3),
      0 8px 24px rgba(0, 0, 0, 0.4),
      0 24px 64px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.03);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    opacity: 0; /* anime.js handles entrance */
  }

  .quick-open__searching {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted, #6B7394);
    padding: 4px 20px 2px;
    letter-spacing: 0.02em;
  }

  @media (prefers-reduced-motion: reduce) {
    .quick-open__backdrop,
    .quick-open {
      animation: none;
    }
  }
</style>
