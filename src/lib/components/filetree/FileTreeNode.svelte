<script lang="ts">
  import type { TreeNode } from "../../types/core";
  import FileTreeNode from "./FileTreeNode.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

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

  let isActive = $derived(node.path === activeFilePath);
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

  function getFileIcon(ext: string | null): string {
    if (!ext) return "\u25CB";
    switch (ext.toLowerCase()) {
      case "md": return "\u25A0";
      case "txt": return "\u25A1";
      case "json": return "\u25C6";
      case "yaml": case "yml": return "\u25C7";
      case "toml": return "\u25C8";
      default: return "\u25CB";
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
    {:else}
      <span class="tree-node__icon">{getFileIcon(node.extension)}</span>
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
    height: 30px;
    padding-right: 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.56);
    background: transparent;
    border: none;
    border-left: 2px solid transparent;
    border-radius: 0 6px 6px 0;
    cursor: pointer;
    user-select: none;
    text-align: left;
    transition:
      background 150ms var(--ease-expo-out),
      color 150ms var(--ease-expo-out),
      border-color 150ms var(--ease-expo-out),
      opacity 150ms var(--ease-expo-out);
  }

  .tree-node__row:hover {
    background: rgba(255, 255, 255, calc(0.03 * var(--hover-softness)));
    color: rgba(255, 255, 255, 0.84);
  }

  .tree-node__row:focus-visible {
    outline: calc(1px * var(--focus-ring-strength)) solid var(--color-accent);
    outline-offset: -1px;
  }

  .tree-node__row--active {
    background: linear-gradient(90deg, rgba(122, 141, 255, 0.12), rgba(122, 141, 255, 0.03));
    color: var(--color-foreground);
    border-left-color: var(--color-accent);
  }

  .tree-node__row--dragged {
    opacity: 0.3;
  }

  .tree-node__row--drop-target {
    background: rgba(122, 141, 255, 0.14);
    border-left-color: var(--color-accent);
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
    font-size: 8px;
    color: rgba(255, 255, 255, 0.38);
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
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--color-accent);
    border-radius: 3px;
    outline: none;
  }

  .tree-node__children {
    overflow: hidden;
    margin-left: 7px;
    padding-left: 9px;
    border-left: 1px solid rgba(255, 255, 255, 0.06);
    animation: expand 150ms var(--ease-expo-out);
    transition: border-color 150ms var(--ease-expo-out);
  }

  .tree-node__children:hover {
    border-left-color: rgba(255, 255, 255, 0.14);
  }

  @keyframes expand {
    from { opacity: 0; max-height: 0; }
    to { opacity: 1; max-height: 500px; }
  }
</style>
