<script lang="ts">
  import type { GraphEdge, GraphNode } from '../../stores/graph.svelte';

  let {
    currentPath = null,
    nodes = [],
    edges = [],
    onselect,
  }: {
    currentPath?: string | null;
    nodes: GraphNode[];
    edges: GraphEdge[];
    onselect: (path: string) => void;
  } = $props();

  let backlinks = $derived(() => {
    if (!currentPath) return [];
    // Find all edges that point TO this file
    const inbound = edges.filter(e => e.target === currentPath);
    return inbound
      .map(e => nodes.find(n => n.id === e.source))
      .filter((n): n is GraphNode => !!n);
  });
</script>

<div class="backlinks">
  <div class="backlinks__header">
    <span class="backlinks__label">Backlinks</span>
    <span class="backlinks__count">{backlinks().length}</span>
  </div>
  {#if backlinks().length > 0}
    <div class="backlinks__list">
      {#each backlinks() as node (node.id)}
        <button class="backlinks__item" onclick={() => onselect(node.path)}>
          {node.title}
        </button>
      {/each}
    </div>
  {:else if currentPath}
    <div class="backlinks__empty">No backlinks</div>
  {/if}
</div>

<style>
  .backlinks {
    padding: 0 var(--space-3);
  }

  .backlinks__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) 0;
  }

  .backlinks__label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.36);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .backlinks__count {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.22);
  }

  .backlinks__list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .backlinks__item {
    display: block;
    width: 100%;
    padding: 4px 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    background: transparent;
    border: none;
    border-radius: 4px;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .backlinks__item:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-primary);
  }

  .backlinks__empty {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.18);
    padding: var(--space-1) 0;
  }
</style>
