<script lang="ts">
  import type { TreeNode } from "../../types/core";
  import FileTreeNode from "./FileTreeNode.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderIcon from "@lucide/svelte/icons/folder";
  import FolderOpenIcon from "@lucide/svelte/icons/folder-open";
  import StarIcon from "@lucide/svelte/icons/star";
  import { getPinnedState } from "../../stores/pinned.svelte";

  let {
    node,
    depth = 0,
    activeFilePath = null,
    onselect,
    ontoggle,
    oncontextmenu,
    onrename,
    dragState,
  }: {
    node: TreeNode;
    depth?: number;
    activeFilePath?: string | null;
    onselect: (path: string) => void;
    ontoggle: (path: string) => void;
    oncontextmenu?: (path: string, isDir: boolean, e: MouseEvent) => void;
    onrename?: (oldPath: string, newName: string) => void;
    dragState?: { dragging: string | null; overDir: string | null };
  } = $props();

  const pinned = getPinnedState();
  let isActive = $derived(node.path === activeFilePath);
  let isPinned = $derived(!node.is_directory && pinned.isPinned(node.path));
  let isDragged = $derived(dragState?.dragging === node.path);
  let isDropTarget = $derived(node.is_directory && dragState?.overDir === node.path && dragState?.dragging !== node.path);
  let editing = $state(false);
  let editValue = $state('');
  let editInput: HTMLInputElement | undefined = $state();

  function handleClick() {
    if (node.is_directory) {
      ontoggle(node.path);
    } else {
      onselect(node.path);
    }
  }

  function handleDblClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    editing = true;
    editValue = node.name;
    requestAnimationFrame(() => {
      editInput?.focus();
      editInput?.select();
    });
  }

  function commitRename() {
    editing = false;
    const newName = editValue.trim();
    if (newName && newName !== node.name) {
      onrename?.(node.path, newName);
    }
  }

  function cancelRename() {
    editing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

</script>

<div
  class="tree-node"
  role="treeitem"
  aria-selected={isActive}
  aria-expanded={node.is_directory ? node.expanded : undefined}
>
  <button
    class="tree-node__row"
    class:tree-node__row--active={isActive}
    class:tree-node__row--dragged={isDragged}
    class:tree-node__row--drop-target={isDropTarget}
    style:padding-left="{8}px"
    onclick={handleClick}
    onkeydown={handleKeydown}
    oncontextmenu={(e) => { e.preventDefault(); oncontextmenu?.(node.path, node.is_directory, e); }}
    data-path={node.path}
    data-is-dir={node.is_directory}
    data-name={node.name}
    tabindex={0}
    aria-label={node.name}
  >
    {#if node.is_directory}
      <span
        class="tree-node__chevron"
        class:tree-node__chevron--expanded={node.expanded}
      >
        <ChevronRight size={12} />
      </span>
      <span class="tree-node__icon">
        {#if node.expanded}
          <FolderOpenIcon size={14} />
        {:else}
          <FolderIcon size={14} />
        {/if}
      </span>
    {:else}
      <span class="tree-node__icon">
        {#if node.extension === 'md' || node.extension === 'markdown' || node.extension === 'mdx'}
          <FileTextIcon size={14} />
        {:else}
          <FileIcon size={14} />
        {/if}
      </span>
    {/if}
    {#if editing}
      <input
        class="tree-node__rename"
        type="text"
        bind:this={editInput}
        bind:value={editValue}
        onblur={commitRename}
        onkeydown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
          if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
          e.stopPropagation();
        }}
        onclick={(e) => e.stopPropagation()}
      />
    {:else}
      <span class="tree-node__name" ondblclick={handleDblClick}>{node.name}</span>
    {/if}
    {#if !node.is_directory}
      <button
        class="tree-node__star"
        class:tree-node__star--pinned={isPinned}
        onclick={(e) => { e.stopPropagation(); pinned.toggle(node.path); }}
        title={isPinned ? 'Unpin' : 'Pin'}
      >
        <StarIcon size={11} />
      </button>
    {/if}
  </button>

  {#if node.is_directory && node.expanded && node.children.length > 0}
    <div class="tree-node__children" role="group">
      {#each node.children as child (child.path)}
        <FileTreeNode
          node={child}
          depth={depth + 1}
          {activeFilePath}
          {onselect}
          {ontoggle}
          {oncontextmenu}
          {onrename}
          {dragState}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .tree-node__row {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    height: 28px;
    padding-right: 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-muted-foreground);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    text-align: left;
    transition: background 150ms var(--ease-expo-out), color 150ms var(--ease-expo-out);
  }

  .tree-node__row:hover {
    background: var(--color-hover);
    color: var(--color-foreground);
  }

  .tree-node__row:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  .tree-node__row--active {
    background: rgba(99, 102, 241, 0.1);
    color: var(--color-foreground);
  }

  .tree-node__row--dragged {
    opacity: 0.3;
  }

  .tree-node__row--drop-target {
    background: rgba(99, 102, 241, 0.12);
    color: var(--color-foreground);
  }

  .tree-node__chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--color-placeholder);
    transition: transform 150ms var(--ease-expo-out);
  }

  .tree-node__chevron--expanded {
    transform: rotate(90deg);
  }

  .tree-node__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--color-placeholder);
  }

  .tree-node__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree-node__rename {
    flex: 1;
    min-width: 0;
    padding: 0 4px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-foreground);
    background: var(--color-hover);
    border: 1px solid var(--color-accent);
    border-radius: 4px;
    outline: none;
  }

  .tree-node__star {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-left: auto;
    flex-shrink: 0;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    opacity: 0;
    transition: opacity 150ms var(--ease-expo-out), color 150ms var(--ease-expo-out);
  }

  .tree-node__row:hover .tree-node__star {
    opacity: 0.6;
  }

  .tree-node__star:hover {
    opacity: 1 !important;
    color: var(--color-accent);
  }

  .tree-node__star--pinned {
    opacity: 1;
    color: #eab308;
  }

  .tree-node__star--pinned:hover {
    color: #ca8a04;
  }

  .tree-node__children {
    margin-left: 8px;
    padding-left: 8px;
    border-left: 1px solid var(--color-border);
  }
</style>
