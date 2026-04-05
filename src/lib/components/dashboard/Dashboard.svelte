<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { FileNode } from '../../types/core';
  import type { GraphStats } from '../../stores/graph.svelte';
  import { presets, stagger, animate } from '../../utils/motion';

  let {
    coreName = 'Noctodeus',
    recentFiles = [],
    pinnedFiles = [],
    totalNotes = 0,
    graphStats,
    graphScanning = false,
    onfileopen,
  }: {
    coreName?: string;
    recentFiles?: FileNode[];
    pinnedFiles?: FileNode[];
    totalNotes?: number;
    graphStats: GraphStats;
    graphScanning?: boolean;
    onfileopen: (path: string) => void;
  } = $props();

  // Tick every 15s so relative times stay fresh
  let tick = $state(0);
  const timer = setInterval(() => { tick++; }, 15_000);
  onDestroy(() => clearInterval(timer));

  // _tick param forces Svelte to re-evaluate when the clock ticks
  function formatRelativeTime(unixSeconds: number, _tick: number): string {
    const now = Date.now() / 1000;
    const diff = now - unixSeconds;
    if (diff < 10) return 'now';
    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return `${Math.floor(diff / 604800)}w`;
  }

  function displayName(file: FileNode): string {
    return file.title || file.name;
  }

  let dashboardEl: HTMLDivElement | undefined = $state();

  onMount(() => {
    if (!dashboardEl) return;

    // Animate title
    const title = dashboardEl.querySelector('.dashboard__name');
    if (title) presets.fadeInUp(title, { duration: 400 });

    // Stagger stats
    const stats = dashboardEl.querySelectorAll('.stat');
    if (stats.length) {
      presets.staggerIn(Array.from(stats), { delay: 100, staggerDelay: 60 });
    }

    // Stagger section rows
    const rows = dashboardEl.querySelectorAll('.dashboard__row');
    if (rows.length) {
      presets.staggerIn(Array.from(rows), { delay: 200, staggerDelay: 25 });
    }
  });
</script>

<div class="dashboard" bind:this={dashboardEl}>
  <h1 class="dashboard__name">{coreName}</h1>

  <div class="dashboard__stats">
    <div class="stat">
      <span class="stat__value" class:stat__value--scanning={graphScanning}>
        {graphScanning ? '--' : graphStats.totalLinks}
      </span>
      <span class="stat__label">links</span>
    </div>
    <div class="stat">
      <span class="stat__value" class:stat__value--scanning={graphScanning}>
        {graphScanning ? '--' : graphStats.avgLinksPerNote}
      </span>
      <span class="stat__label">avg / note</span>
    </div>
    <div class="stat">
      <span class="stat__value" class:stat__value--scanning={graphScanning}>
        {graphScanning ? '--' : graphStats.orphanCount}
      </span>
      <span class="stat__label">orphans</span>
    </div>
    <div class="stat">
      <span class="stat__value">{totalNotes}</span>
      <span class="stat__label">notes</span>
    </div>
  </div>

  {#if graphStats.mostConnected.some(n => n.count > 0)}
    <div class="dashboard__section">
      <h2 class="dashboard__section-title">Most Linked</h2>
      {#each graphStats.mostConnected.filter(n => n.count > 0) as node (node.path)}
        <button class="dashboard__row" onclick={() => onfileopen(node.path)}>
          <span class="dashboard__row-name">{node.title}</span>
          <span class="dashboard__row-meta">{node.count}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if recentFiles.length > 0}
    <div class="dashboard__section">
      <h2 class="dashboard__section-title">Recent</h2>
      {#each recentFiles.slice(0, 10) as file (file.path)}
        <button class="dashboard__row" onclick={() => onfileopen(file.path)}>
          <span class="dashboard__row-name">{displayName(file)}</span>
          <span class="dashboard__row-meta">{formatRelativeTime(file.modified_at, tick)}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if pinnedFiles.length > 0}
    <div class="dashboard__section">
      <h2 class="dashboard__section-title">Pinned</h2>
      {#each pinnedFiles as file (file.path)}
        <button class="dashboard__row" onclick={() => onfileopen(file.path)}>
          <span class="dashboard__row-name">{displayName(file)}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 28px;
    overflow-y: auto;
    gap: 32px;
  }

  .dashboard__name {
    font-family: var(--font-sans);
    font-size: clamp(1.8rem, 2.5vw, 2.4rem);
    color: var(--color-foreground);
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  /* Stats */
  .dashboard__stats {
    display: flex;
    flex-direction: row;
    gap: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--color-border);
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat__value {
    font-family: var(--font-mono);
    font-size: 20px;
    font-weight: 600;
    color: var(--color-foreground);
    line-height: 1;
  }

  .stat__value--scanning {
    animation: stat-pulse 1.5s ease-in-out infinite;
    color: var(--color-placeholder);
  }

  @keyframes stat-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }

  .stat__label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Sections */
  .dashboard__section {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .dashboard__section-title {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
  }

  /* Rows */
  .dashboard__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 8px 8px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: background 150ms ease;
  }

  .dashboard__row:hover {
    background: var(--color-hover);
  }

  .dashboard__row-name {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashboard__row-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-placeholder);
    flex-shrink: 0;
  }
</style>
