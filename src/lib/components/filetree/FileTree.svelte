<script lang="ts">
  import FileTreeNode from './FileTreeNode.svelte';
  import type { TreeNode } from '../../types/core';

  let {
    tree = [],
    activeFilePath = null,
    onselect,
    ontoggle,
  }: {
    tree?: TreeNode[];
    activeFilePath?: string | null;
    onselect: (path: string) => void;
    ontoggle: (path: string) => void;
  } = $props();

  let container: HTMLElement | undefined = $state();

  function handleKeydown(e: KeyboardEvent) {
    if (!container) return;

    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>('button[tabindex="0"]')
    );
    const current = document.activeElement as HTMLElement;
    const idx = focusable.indexOf(current);

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = focusable[idx + 1];
        if (next) next.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = focusable[idx - 1];
        if (prev) prev.focus();
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        // Expand if directory and collapsed
        current?.click();
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        // Collapse if directory and expanded, otherwise focus parent
        current?.click();
        break;
      }
    }
  }
</script>

<div
  class="file-tree"
  role="tree"
  tabindex="0"
  aria-label="File tree"
  bind:this={container}
  onkeydown={handleKeydown}
>
  {#if tree.length === 0}
    <div class="file-tree__empty">
      <span>No files</span>
    </div>
  {:else}
    {#each tree as node (node.path)}
      <FileTreeNode
        {node}
        {activeFilePath}
        {onselect}
        {ontoggle}
      />
    {/each}
  {/if}
</div>

<style>
  .file-tree {
    padding: var(--space-1) 0;
  }

  .file-tree__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8) var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
</style>
