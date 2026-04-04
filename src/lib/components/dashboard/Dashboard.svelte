<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { FileNode } from '../../types/core';
  import type { GraphStats } from '../../stores/graph.svelte';

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
</script>

<div class="dashboard">
  <h1 class="dashboard__name">{coreName}</h1>

  <div class="dashboard__columns">
    <div class="dashboard__left">
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
        <div class="dashboard__list">
          {#each graphStats.mostConnected.filter(n => n.count > 0) as node (node.path)}
            <button class="row" onclick={() => onfileopen(node.path)}>
              <span class="row__name">{node.title}</span>
              <span class="row__badge">{node.count}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="dashboard__divider"></div>

    <div class="dashboard__right">
      {#if recentFiles.length > 0}
        <div class="dashboard__list">
          {#each recentFiles.slice(0, 10) as file (file.path)}
            <button class="row" onclick={() => onfileopen(file.path)}>
              <span class="row__name">{displayName(file)}</span>
              <span class="row__meta">{formatRelativeTime(file.modified_at, tick)}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#if pinnedFiles.length > 0}
        <div class="dashboard__list dashboard__list--pinned">
          {#each pinnedFiles as file (file.path)}
            <button class="row" onclick={() => onfileopen(file.path)}>
              <span class="row__name">{displayName(file)}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: calc(var(--space-8) * var(--density-scale));
    padding-top: calc(var(--space-10) * var(--density-scale));
    overflow-y: auto;
    overflow-x: hidden;
    animation: fade-up var(--duration-slow) var(--ease-out) both;
  }

  @keyframes fade-up {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .dashboard__name {
    font-family: var(--font-sans);
    font-size: clamp(1.6rem, 2.4vw, 2.2rem);
    color: var(--color-text-primary);
    font-weight: 600;
    letter-spacing: -0.035em;
    margin-bottom: calc(var(--space-8) * var(--density-scale));
  }

  .dashboard__columns {
    display: grid;
    grid-template-columns: 1.4fr 1px 1fr;
    gap: var(--space-8);
    flex: 1;
    min-height: 0;
  }

  .dashboard__divider {
    background: rgba(255, 255, 255, 0.04);
  }

  .dashboard__left {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }

  .dashboard__right {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }

  /* Stats */
  .dashboard__stats {
    display: flex;
    gap: var(--space-7);
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat__value {
    font-family: var(--font-mono);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--color-text-primary);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .stat__value--scanning {
    animation: stat-pulse 1.5s ease-in-out infinite;
    color: rgba(255, 255, 255, 0.3);
  }

  @keyframes stat-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }

  .stat__label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.28);
    letter-spacing: 0.02em;
  }

  /* Lists */
  .dashboard__list {
    display: flex;
    flex-direction: column;
  }

  .dashboard__list--pinned {
    padding-top: var(--space-2);
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  /* Rows */
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: 6px var(--space-2);
    border-radius: 4px;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .row__name {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: rgba(255, 255, 255, 0.72);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color var(--duration-fast) var(--ease-out);
  }

  .row:hover .row__name {
    color: var(--color-text-primary);
  }

  .row__meta {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.22);
    flex-shrink: 0;
  }

  .row__badge {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-accent);
    background: rgba(122, 141, 255, 0.08);
    padding: 1px 5px;
    border-radius: 6px;
    flex-shrink: 0;
  }
</style>
