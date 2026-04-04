<script lang="ts">
  import type { TreeNode } from "../../types/core";
  import FileTreeNode from "./FileTreeNode.svelte";

  let {
    node,
    depth = 0,
    activeFilePath = null,
    onselect,
    ontoggle,
  }: {
    node: TreeNode;
    depth?: number;
    activeFilePath?: string | null;
    onselect: (path: string) => void;
    ontoggle: (path: string) => void;
  } = $props();

  let isActive = $derived(node.path === activeFilePath);

  function handleClick() {
    if (node.is_directory) {
      ontoggle(node.path);
    } else {
      onselect(node.path);
    }
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
      case "md":
        return "\u25A0";
      case "txt":
        return "\u25A1";
      case "json":
        return "\u25C6";
      case "yaml":
      case "yml":
        return "\u25C7";
      case "toml":
        return "\u25C8";
      default:
        return "\u25CB";
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
    style:padding-left="{depth * 16 + 8}px"
    onclick={handleClick}
    onkeydown={handleKeydown}
    tabindex={0}
    aria-label={node.name}
  >
    {#if node.is_directory}
      <span
        class="tree-node__chevron"
        class:tree-node__chevron--expanded={node.expanded}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M4.5 2.5L8 6L4.5 9.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    {:else}
      <span class="tree-node__icon">{getFileIcon(node.extension)}</span>
    {/if}
    <span class="tree-node__name">{node.name}</span>
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
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .tree-node__row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    width: 100%;
    height: calc(30px * var(--sidebar-density));
    padding-right: var(--space-2);
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: var(--text-sm-leading);
    color: rgba(255, 255, 255, 0.56);
    background: transparent;
    border: none;
    border-left: 2px solid transparent;
    border-radius: 0 6px 6px 0;
    cursor: pointer;
    user-select: none;
    text-align: left;
    transition:
      background var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
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
    background: linear-gradient(
      90deg,
      rgba(122, 141, 255, 0.12),
      rgba(122, 141, 255, 0.03)
    );
    color: var(--color-text-primary);
    border-left-color: var(--color-accent);
  }

  .tree-node__chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--color-text-muted);
    transition: transform var(--duration-fast) var(--ease-out);
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

  .tree-node__children {
    overflow: hidden;
    animation: expand var(--duration-fast) var(--ease-out);
  }

  @keyframes expand {
    from {
      opacity: 0;
      max-height: 0;
    }
    to {
      opacity: 1;
      max-height: 500px;
    }
  }
</style>
