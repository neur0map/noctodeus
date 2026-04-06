<script lang="ts">
  import FileTreeNode from './FileTreeNode.svelte';
  import type { TreeNode } from '../../types/core';

  let {
    tree = [],
    activeFilePath = null,
    onselect,
    ontoggle,
    oncontextmenu,
    ondelete,
    onmove,
    onrename,
  }: {
    tree?: TreeNode[];
    activeFilePath?: string | null;
    onselect: (path: string) => void;
    ontoggle: (path: string) => void;
    oncontextmenu?: (path: string, isDir: boolean, e: MouseEvent) => void;
    ondelete?: () => void;
    onmove?: (sourcePath: string, targetDir: string) => void;
    onrename?: (oldPath: string, newName: string) => void;
  } = $props();

  import { onMount } from 'svelte';

  let container: HTMLElement | undefined = $state();
  let zoneActive = $state(false);

  onMount(() => {
    function handleZoneChange(e: Event) {
      const zone = (e as CustomEvent).detail;
      zoneActive = zone === 'filetree';
      if (zoneActive && container) {
        // Focus the active file or first item
        const active = container.querySelector<HTMLElement>('.tree-node__row--active') ??
          container.querySelector<HTMLElement>('button[tabindex="0"]');
        active?.focus();
      }
    }
    window.addEventListener('noctodeus-zone-change', handleZoneChange);
    return () => window.removeEventListener('noctodeus-zone-change', handleZoneChange);
  });

  // Drag state shared with all tree nodes
  let dragState = $state<{ dragging: string | null; overDir: string | null }>({
    dragging: null,
    overDir: null,
  });

  let ghost: HTMLDivElement | null = null;

  function handlePointerDown(e: PointerEvent) {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.tree-node__row');
    if (!row) return;
    const path = row.dataset.path;
    const isDir = row.dataset.isDir === 'true';
    const name = row.dataset.name ?? '';
    if (!path || isDir) return; // Only files are draggable

    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;

    function onMove(ev: PointerEvent) {
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);

      if (!started && dx + dy < 6) return;

      if (!started) {
        started = true;
        dragState = { dragging: path!, overDir: null };

        // Create ghost
        ghost = document.createElement('div');
        ghost.className = 'file-drag-ghost';
        ghost.textContent = name;
        document.body.appendChild(ghost);
      }

      // Move ghost
      if (ghost) {
        ghost.style.left = `${ev.clientX + 12}px`;
        ghost.style.top = `${ev.clientY - 10}px`;
      }

      // Hit-test for drop target
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.tree-node__row');
      if (el && el.dataset.isDir === 'true' && el.dataset.path !== path) {
        dragState = { ...dragState, overDir: el.dataset.path! };
      } else if (container?.contains(document.elementFromPoint(ev.clientX, ev.clientY) ?? null)) {
        // Over the tree but not on a folder — root drop
        dragState = { ...dragState, overDir: '.' };
      } else {
        dragState = { ...dragState, overDir: null };
      }
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);

      if (started && dragState.dragging && dragState.overDir) {
        onmove?.(dragState.dragging, dragState.overDir);
      }

      // Cleanup
      ghost?.remove();
      ghost = null;
      dragState = { dragging: null, overDir: null };
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!container) return;

    if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace') {
      e.preventDefault();
      ondelete?.();
      return;
    }

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
        current?.click();
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        current?.click();
        break;
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="file-tree"
  class:file-tree--zone-active={zoneActive}
  role="tree"
  tabindex="0"
  aria-label="File tree"
  bind:this={container}
  onkeydown={handleKeydown}
  onpointerdown={handlePointerDown}
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
        {oncontextmenu}
        {onrename}
        {dragState}
      />
    {/each}
  {/if}
</div>

<style>
  .file-tree {
    padding: 4px 0;
  }

  .file-tree__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-placeholder);
  }

  .file-tree--zone-active :global(.tree-node__row:focus) {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  :global(.file-drag-ghost) {
    position: fixed;
    z-index: 9999;
    padding: 4px 10px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-foreground);
    background: rgba(20, 21, 27, 0.95);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    pointer-events: none;
    white-space: nowrap;
    backdrop-filter: blur(12px);
  }
</style>
