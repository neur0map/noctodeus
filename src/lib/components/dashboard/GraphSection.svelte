<script lang="ts">
  import type { GraphStats } from '../../stores/graph.svelte';

  let {
    stats,
    scanning = false,
    onfileopen,
  }: {
    stats: GraphStats;
    scanning?: boolean;
    onfileopen: (path: string) => void;
  } = $props();
</script>

<section class="graph-section">
  <h2 class="section-title">
    Knowledge Graph
    {#if scanning}
      <span class="scanning-indicator">scanning...</span>
    {/if}
  </h2>

  <div class="graph-stats">
    <div class="stat-block">
      <span class="stat-block__value">{stats.totalLinks}</span>
      <span class="stat-block__label">Links</span>
    </div>
    <div class="stat-block">
      <span class="stat-block__value">{stats.avgLinksPerNote}</span>
      <span class="stat-block__label">Avg / Note</span>
    </div>
    <div class="stat-block">
      <span class="stat-block__value">{stats.orphanCount}</span>
      <span class="stat-block__label">Orphans</span>
    </div>
  </div>

  {#if stats.mostConnected.length > 0}
    <div class="connected-list">
      <h3 class="subsection-title">Most Connected</h3>
      {#each stats.mostConnected as node (node.path)}
        <button class="connected-item" onclick={() => onfileopen(node.path)}>
          <span class="connected-item__name">{node.title}</span>
          <span class="connected-item__count">{node.count}</span>
        </button>
      {/each}
    </div>
  {/if}
</section>

<style>
  .graph-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .scanning-indicator {
    font-size: var(--text-xs);
    color: var(--color-accent);
    text-transform: lowercase;
    letter-spacing: 0;
    opacity: 0.7;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  .subsection-title {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: rgba(255, 255, 255, 0.36);
    letter-spacing: 0.03em;
    margin-bottom: var(--space-1);
  }

  .graph-stats {
    display: flex;
    gap: var(--space-3);
  }

  .stat-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3) var(--space-4);
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    min-width: 80px;
  }

  .stat-block__value {
    font-family: var(--font-mono);
    font-size: var(--text-lg);
    color: var(--color-text-primary);
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .stat-block__label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .connected-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .connected-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    margin: 0 calc(-1 * var(--space-2));
    width: calc(100% + var(--space-2) * 2);
    border-radius: 6px;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .connected-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .connected-item__name {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .connected-item__count {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-accent);
    background: rgba(122, 141, 255, 0.1);
    padding: 1px 6px;
    border-radius: 8px;
    flex-shrink: 0;
    margin-left: var(--space-2);
  }
</style>
