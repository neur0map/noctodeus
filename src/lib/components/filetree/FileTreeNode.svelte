<script lang="ts">
  import type { TreeNode } from "../../types/core";
  import FileTreeNode from "./FileTreeNode.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import StarIcon from "@lucide/svelte/icons/star";
  import CloudIcon from "@lucide/svelte/icons/cloud";
  import BookOpenIcon from "@lucide/svelte/icons/book-open";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import { getPinnedState } from "../../stores/pinned.svelte";
  import { nerdIcon, fileIcon } from "../../utils/nerd-icons";

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
  let isEvicted = $derived(!node.is_directory && !!node.evicted);
  let isWikiRoot = $derived(node.is_directory && node.path === 'wiki');
  let isWikiChild = $derived(node.path.startsWith('wiki/'));
  let isWiki = $derived(isWikiRoot || isWikiChild);
  let isDragged = $derived(dragState?.dragging === node.path);
  let isDropTarget = $derived(node.is_directory && dragState?.overDir === node.path && dragState?.dragging !== node.path);
  let editing = $state(false);
  let editValue = $state('');
  let editInput: HTMLInputElement | undefined = $state();

  async function handleClick() {
    if (node.is_directory) {
      ontoggle(node.path);
    } else if (isEvicted) {
      // Trigger iCloud download instead of opening
      try {
        const { icloudDownloadFile } = await import('$lib/bridge/sync');
        const { toast } = await import('$lib/stores/toast.svelte');
        await icloudDownloadFile(node.path);
        toast.info('Downloading from iCloud\u2026');
      } catch {}
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
    class:tree-node__row--wiki={isWiki}
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
      {#if isWikiRoot}
        <span class="tree-node__icon tree-node__icon--wiki"><BookOpenIcon size={13} /></span>
      {:else}
        <span class="tree-node__icon tree-node__icon--nerd">{node.expanded ? nerdIcon('folder-open') : nerdIcon('folder-closed')}</span>
      {/if}
    {:else if isEvicted}
      <span class="tree-node__icon tree-node__icon--evicted"><CloudIcon size={13} /></span>
    {:else}
      <span class="tree-node__icon tree-node__icon--nerd">{fileIcon(node.name)}</span>
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
      <span
        class="tree-node__name"
        class:tree-node__name--evicted={isEvicted}
        ondblclick={handleDblClick}
      >{node.name}</span>
    {/if}
    {#if isWikiRoot}
      <span class="tree-node__wiki-badge">AI</span>
      <button
        class="tree-node__wiki-ingest"
        onclick={async (e) => {
          e.stopPropagation();
          const { getSettings } = await import('$lib/stores/settings.svelte');
          if (!getSettings().wikiEnabled) {
            const { toast } = await import('$lib/stores/toast.svelte');
            toast.warn('Wiki is not enabled. Enable it in Settings > Wiki.');
            return;
          }
          const { getWikiState } = await import('$lib/stores/wiki.svelte');
          const wiki = getWikiState();
          wiki.ingestAll();
        }}
        title="Ingest notes into wiki"
      >
        <RefreshCwIcon size={11} />
      </button>
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
    gap: 6px;
    width: 100%;
    height: 32px;
    padding-right: var(--space-md, 12px);
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-muted-foreground);
    background: transparent;
    border: none;
    border-left: 3px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    text-align: left;
    transition: background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out;
  }

  .tree-node__row:hover {
    color: var(--text-primary, var(--color-foreground));
  }

  .tree-node__row:focus-visible {
    outline: none;
    box-shadow: var(--glow-focus, 0 0 0 2px rgba(122, 162, 247, 0.15));
  }

  .tree-node__row--active {
    color: var(--text-primary, var(--color-foreground));
    font-weight: 500;
    position: relative;
  }

  .tree-node__row--active::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 6px;
    padding: 1px;
    background: conic-gradient(
      from var(--glow-angle, 0deg),
      transparent 0%,
      transparent 65%,
      rgba(122, 162, 247, 0.1) 75%,
      rgba(122, 162, 247, 0.25) 82%,
      rgba(122, 162, 247, 0.1) 89%,
      transparent 100%
    );
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: glow-trace 8s linear infinite, glow-trace-fade-in 1s ease both;
    pointer-events: none;
  }

  .tree-node__row--dragged {
    opacity: 0.3;
  }

  .tree-node__row--drop-target {
    background: var(--surface-3, var(--color-hover));
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

  .tree-node__icon--nerd {
    font-family: var(--font-mono);
    font-size: 14px;
    line-height: 1;
  }

  .tree-node__icon--evicted {
    color: var(--color-placeholder);
    opacity: 0.6;
  }

  .tree-node__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree-node__name--evicted {
    opacity: 0.5;
    font-style: italic;
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
    color: var(--accent-yellow);
  }

  .tree-node__star--pinned:hover {
    color: var(--accent-orange);
  }

  /* ── Wiki folder styling ── */
  .tree-node__row--wiki {
    border-left: 2px solid var(--accent-purple, #bb9af7);
  }

  .tree-node__row--wiki:hover {
    border-left-color: var(--accent-purple, #bb9af7);
  }

  .tree-node__icon--wiki {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--accent-purple, #bb9af7);
  }

  .tree-node__wiki-badge {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    color: var(--accent-purple, #bb9af7);
    background: rgba(187, 154, 247, 0.1);
    border-radius: 3px;
    padding: 1px 4px;
    line-height: 1;
    flex-shrink: 0;
    margin-left: 4px;
  }

  .tree-node__wiki-ingest {
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

  .tree-node__row:hover .tree-node__wiki-ingest {
    opacity: 0.6;
  }

  .tree-node__wiki-ingest:hover {
    opacity: 1 !important;
    color: var(--accent-purple, #bb9af7);
  }

  .tree-node__children {
    margin-left: 8px;
    padding-left: 8px;
    border-left: 1px solid var(--color-border);
    animation: tree-expand 400ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes tree-expand {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .tree-node__children {
      animation: none;
    }
  }
</style>
