<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Editor } from '@tiptap/core';

  let {
    editor = null,
  }: {
    editor?: Editor | null;
  } = $props();

  interface MinimapItem {
    level: number;
    text: string;
    pos: number;
    pct: number; // 0-100 vertical position percentage
  }

  let items = $state<MinimapItem[]>([]);
  let hoveredIndex = $state<number | null>(null);
  let cleanup: (() => void) | null = null;

  function extract(ed: Editor) {
    const docSize = ed.state.doc.content.size;
    if (docSize === 0) { items = []; return; }
    const result: MinimapItem[] = [];
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        result.push({
          level: node.attrs.level as number,
          text: node.textContent,
          pos,
          pct: (pos / docSize) * 100,
        });
      }
    });
    items = result;
  }

  $effect(() => {
    cleanup?.();
    cleanup = null;
    if (!editor) { items = []; return; }
    extract(editor);
    const ed = editor;
    const handler = () => extract(ed);
    ed.on('update', handler);
    cleanup = () => ed.off('update', handler);
  });

  onDestroy(() => cleanup?.());

  function scrollTo(pos: number) {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos).run();
    const dom = editor.view.domAtPos(pos);
    const el = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
</script>

{#if items.length > 0}
  <div class="minimap">
    {#each items as item, i}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="minimap__bar"
        class:minimap__bar--h1={item.level === 1}
        class:minimap__bar--h2={item.level === 2}
        class:minimap__bar--h3={item.level === 3}
        style="top: {item.pct}%"
        onclick={() => scrollTo(item.pos)}
        onmouseenter={() => hoveredIndex = i}
        onmouseleave={() => hoveredIndex = null}
      >
        {#if hoveredIndex === i}
          <div class="minimap__tooltip">
            {item.text || 'Untitled'}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .minimap {
    position: absolute;
    top: 60px;
    right: 6px;
    bottom: 20px;
    width: 24px;
    z-index: 3;
    pointer-events: none;
  }

  .minimap__bar {
    position: absolute;
    right: 0;
    height: 3px;
    border-radius: 1.5px;
    background: rgba(255, 255, 255, 0.18);
    cursor: pointer;
    pointer-events: auto;
    transition:
      background var(--duration-fast) var(--ease-out),
      width var(--duration-fast) var(--ease-out);
  }

  .minimap__bar--h1 {
    width: 20px;
    background: rgba(255, 255, 255, 0.28);
  }

  .minimap__bar--h2 {
    width: 14px;
    background: rgba(255, 255, 255, 0.2);
  }

  .minimap__bar--h3 {
    width: 10px;
    background: rgba(255, 255, 255, 0.14);
  }

  .minimap__bar:hover {
    background: var(--color-accent);
    width: 20px;
  }

  .minimap__tooltip {
    position: absolute;
    right: 28px;
    top: 50%;
    transform: translateY(-50%);
    padding: 3px 8px;
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--color-text-primary);
    background: rgba(18, 19, 24, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    white-space: nowrap;
    pointer-events: none;
    animation: tip-in 80ms var(--ease-out) both;
  }

  @keyframes tip-in {
    from { opacity: 0; transform: translateY(-50%) translateX(4px); }
    to { opacity: 1; transform: translateY(-50%) translateX(0); }
  }
</style>
