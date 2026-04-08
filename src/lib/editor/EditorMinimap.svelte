<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { EditorHandle } from '$lib/editor/blocknote/types';

  let {
    editor = null,
  }: {
    editor?: EditorHandle | null;
  } = $props();

  interface MinimapItem {
    level: number;
    text: string;
    id: string;
  }

  let items = $state<MinimapItem[]>([]);
  let hovered = $state(false);
  let activeIndex = $state<number | null>(null);
  let cleanup: (() => void) | null = null;

  function extract(handle: EditorHandle) {
    items = handle.getHeadings();
  }

  $effect(() => {
    cleanup?.();
    cleanup = null;
    if (!editor) { items = []; return; }
    extract(editor);
    const handle = editor;
    cleanup = handle.onChange(() => extract(handle));
  });

  onDestroy(() => cleanup?.());
</script>

{#if items.length > 0}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="mm"
    onmouseenter={() => hovered = true}
    onmouseleave={() => { hovered = false; activeIndex = null; }}
  >
    <!-- Collapsed: tiny bars -->
    <div class="mm__bars" class:mm__bars--hidden={hovered}>
      {#each items as item}
        <div
          class="mm__bar"
          class:mm__bar--h1={item.level === 1}
          class:mm__bar--h2={item.level === 2}
          class:mm__bar--h3={item.level === 3}
        ></div>
      {/each}
    </div>

    <!-- Expanded: full outline popup -->
    <div class="mm__popup" class:mm__popup--visible={hovered}>
      {#each items as item, i}
        <button
          class="mm__item"
          class:mm__item--active={activeIndex === i}
          class:mm__item--h1={item.level === 1}
          class:mm__item--h2={item.level === 2}
          class:mm__item--h3={item.level === 3}
          onmouseenter={() => activeIndex = i}
          onclick={() => editor?.scrollToBlock(item.id)}
        >
          {item.text || 'Untitled'}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .mm {
    position: absolute;
    top: 16px;
    right: 10px;
    z-index: 4;
  }

  /* Collapsed bars */
  .mm__bars {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 6px 4px;
    cursor: pointer;
    opacity: 1;
    transform: scale(1);
    transition:
      opacity 150ms var(--ease-expo-out),
      transform 150ms var(--ease-expo-out);
  }

  .mm__bars--hidden {
    opacity: 0;
    transform: scale(0.8);
    pointer-events: none;
  }

  .mm__bar {
    height: 2.5px;
    border-radius: 1px;
    background: var(--color-muted-foreground);
    opacity: 0.3;
    transition: background 150ms var(--ease-expo-out);
  }

  .mm__bar--h1 { width: 22px; opacity: 0.45; }
  .mm__bar--h2 { width: 16px; }
  .mm__bar--h3 { width: 11px; opacity: 0.2; }

  /* Expanded popup */
  .mm__popup {
    position: absolute;
    top: 0;
    right: 0;
    background: var(--color-popover);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    box-shadow: var(--shadow-float);
    backdrop-filter: blur(16px);
    padding: 8px;
    min-width: 160px;
    max-width: 240px;
    max-height: 320px;
    overflow-y: auto;
    scrollbar-width: none;
    opacity: 0;
    transform: scale(0.92) translateX(6px);
    transform-origin: top right;
    pointer-events: none;
    transition:
      opacity 150ms var(--ease-expo-out),
      transform 150ms var(--ease-expo-out);
  }

  .mm__popup--visible {
    opacity: 1;
    transform: scale(1) translateX(0);
    pointer-events: auto;
  }

  .mm__popup::-webkit-scrollbar { display: none; }

  .mm__item {
    display: block;
    width: 100%;
    padding: 5px 10px;
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--color-muted-foreground);
    background: transparent;
    border: none;
    border-radius: 5px;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 150ms var(--ease-expo-out);
  }

  .mm__item--h1 {
    font-weight: 600;
    font-size: 13px;
    color: var(--color-foreground);
  }

  .mm__item--h2 {
    padding-left: 20px;
  }

  .mm__item--h3 {
    padding-left: 30px;
    font-size: 11px;
  }

  .mm__item:hover,
  .mm__item--active {
    color: var(--color-accent);
    background: var(--color-hover);
  }

  @media (prefers-reduced-motion: reduce) {
    .mm__popup { animation: none; }
  }
</style>
