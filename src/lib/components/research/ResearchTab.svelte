<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import ResearchShelf from './ResearchShelf.svelte';
  import ResearchConversation from './ResearchConversation.svelte';
  import { getResearchState } from '$lib/stores/research.svelte';

  const research = getResearchState();

  // --- Refs ---
  let containerEl: HTMLDivElement | undefined = $state();
  let shelfRef: ReturnType<typeof ResearchShelf> | undefined = $state();
  let convRef: ReturnType<typeof ResearchConversation> | undefined = $state();

  // --- Responsive state ---
  let collapsed = $state(false);
  let overlayOpen = $state(false);
  let resizeObserver: ResizeObserver | undefined;

  // --- Derived ---
  let sourceCount = $derived(research.sources.length);
  let toggleLabel = $derived(
    sourceCount > 0 ? `${sourceCount} source${sourceCount !== 1 ? 's' : ''}` : 'Sources',
  );

  // --- ResizeObserver for responsive collapse ---
  onMount(() => {
    if (containerEl) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect.width;
          collapsed = width < 700;
          if (!collapsed) overlayOpen = false;
        }
      });
      resizeObserver.observe(containerEl);
    }

    // Focus routing
    tick().then(() => {
      if (research.sources.length === 0) {
        shelfRef?.focusInput();
      } else {
        convRef?.focusInput();
      }
    });
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
  });

  // --- Overlay toggle ---
  function openOverlay() {
    overlayOpen = true;
    tick().then(() => {
      shelfRef?.focusInput();
    });
  }

  function closeOverlay() {
    overlayOpen = false;
  }

  // --- Keyboard: Escape closes overlay ---
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && overlayOpen) {
      e.preventDefault();
      closeOverlay();
    }
  }

  // --- Highlight-source event from conversation citations ---
  function handleHighlightSource(e: Event) {
    const detail = (e as CustomEvent).detail;
    if (detail?.id && shelfRef) {
      // If collapsed, open overlay first
      if (collapsed && !overlayOpen) {
        overlayOpen = true;
        tick().then(() => {
          shelfRef?.highlightSource(detail.id);
        });
      } else {
        shelfRef.highlightSource(detail.id);
      }
    }
  }

  onMount(() => {
    window.addEventListener('highlight-source', handleHighlightSource);
    return () => {
      window.removeEventListener('highlight-source', handleHighlightSource);
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="rt" bind:this={containerEl} onkeydown={handleKeydown}>
  {#if !collapsed}
    <!-- Wide layout: inline shelf -->
    <aside class="rt__shelf">
      <ResearchShelf bind:this={shelfRef} />
    </aside>
    <div class="rt__divider"></div>
  {:else}
    <!-- Narrow layout: toggle button + overlay -->
    <button class="rt__shelf-toggle" onclick={openOverlay} title="Show sources">
      <BookOpen size={14} />
      <span>{toggleLabel}</span>
    </button>

    {#if overlayOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="rt__backdrop" onclick={closeOverlay}></div>
      <aside class="rt__shelf-overlay">
        <ResearchShelf bind:this={shelfRef} />
      </aside>
    {/if}
  {/if}

  <main class="rt__conv">
    <ResearchConversation bind:this={convRef} />
  </main>
</div>

<style lang="scss">
  .rt {
    position: relative;
    display: flex;
    height: 100%;
    overflow: hidden;
  }

  // --- Shelf (inline, wide layout) ---
  .rt__shelf {
    width: 280px;
    flex-shrink: 0;
    overflow: hidden;
  }

  // --- Divider ---
  .rt__divider {
    width: 1px;
    flex-shrink: 0;
    background: var(--color-border);
  }

  // --- Conversation ---
  .rt__conv {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  // --- Collapsed toggle button ---
  .rt__shelf-toggle {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-placeholder);
    background: var(--surface-2);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    transition: color 150ms, border-color 150ms;

    &:hover {
      color: var(--color-foreground);
      border-color: var(--color-foreground);
    }
  }

  // --- Overlay backdrop ---
  .rt__backdrop {
    position: absolute;
    inset: 0;
    z-index: 9;
    background: rgba(0, 0, 0, 0.3);
  }

  // --- Shelf overlay (narrow layout) ---
  .rt__shelf-overlay {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 280px;
    z-index: 10;
    background: var(--surface-2);
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }
</style>
