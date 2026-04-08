<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { EditorHandle } from '$lib/editor/blocknote/types';

  let {
    editor = null,
  }: {
    editor?: EditorHandle | null;
  } = $props();

  interface HeadingItem {
    id: string;
    level: number;
    text: string;
  }

  let headings = $state<HeadingItem[]>([]);
  let cleanup: (() => void) | null = null;

  function extractHeadings(handle: EditorHandle) {
    headings = handle.getHeadings();
  }

  $effect(() => {
    cleanup?.();
    cleanup = null;

    if (!editor) {
      headings = [];
      return;
    }

    extractHeadings(editor);
    const handle = editor;
    cleanup = handle.onChange(() => extractHeadings(handle));
  });

  onDestroy(() => { cleanup?.(); });
</script>

<div class="outline">
  <div class="outline__header">
    <span class="outline__label">Outline</span>
  </div>
  {#if headings.length > 0}
    <div class="outline__list">
      {#each headings as h (h.id)}
        <button
          class="outline__item outline__item--h{h.level}"
          onclick={() => editor?.scrollToBlock(h.id)}
        >
          {h.text || 'Untitled'}
        </button>
      {/each}
    </div>
  {:else}
    <div class="outline__empty">No headings</div>
  {/if}
</div>

<style>
  .outline {
    padding: 0 12px;
  }

  .outline__header {
    padding: 8px 0;
  }

  .outline__label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .outline__list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .outline__item {
    display: block;
    width: 100%;
    padding: 3px 6px;
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--color-muted-foreground);
    background: transparent;
    border: none;
    border-radius: 4px;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: background 150ms var(--ease-expo-out);
  }

  .outline__item:hover {
    background: var(--color-hover);
    color: var(--color-foreground);
  }

  .outline__item--h1 { padding-left: 6px; font-weight: 600; color: var(--color-foreground); }
  .outline__item--h2 { padding-left: 18px; }
  .outline__item--h3 { padding-left: 30px; font-size: 11px; }

  .outline__empty {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    padding: 4px 0;
  }
</style>
