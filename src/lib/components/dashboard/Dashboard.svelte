<script lang="ts">
  import type { FileNode } from '../../types/core';
  import type { GraphStats } from '../../stores/graph.svelte';
  import ActivitySection from './ActivitySection.svelte';
  import QuickAccessSection from './QuickAccessSection.svelte';
  import GraphSection from './GraphSection.svelte';

  let {
    coreName = 'Noctodeus',
    recentFiles = [],
    pinnedFiles = [],
    totalNotes = 0,
    graphStats,
    graphScanning = false,
    onfileopen,
    onnewnote,
    onopencore,
  }: {
    coreName?: string;
    recentFiles?: FileNode[];
    pinnedFiles?: FileNode[];
    totalNotes?: number;
    graphStats: GraphStats;
    graphScanning?: boolean;
    onfileopen: (path: string) => void;
    onnewnote: () => void;
    onopencore?: () => void;
  } = $props();
</script>

<div class="dashboard">
  <div class="dashboard__content">
    <header class="dashboard__header">
      <h1 class="dashboard__title">{coreName}</h1>
      <div class="dashboard__actions">
        {#if onopencore}
          <button class="dashboard__action dashboard__action--primary" onclick={onopencore}>
            Open Core
          </button>
        {/if}
        <button class="dashboard__action" onclick={onnewnote}>
          New Note
        </button>
      </div>
    </header>

    <div class="dashboard__sections">
      <div class="dashboard__section" style="animation-delay: 0ms">
        <ActivitySection {recentFiles} {totalNotes} {onfileopen} />
      </div>

      <div class="dashboard__section" style="animation-delay: 60ms">
        <QuickAccessSection {pinnedFiles} {recentFiles} {onfileopen} />
      </div>

      <div class="dashboard__section" style="animation-delay: 120ms">
        <GraphSection stats={graphStats} scanning={graphScanning} {onfileopen} />
      </div>
    </div>
  </div>
</div>

<style>
  .dashboard {
    display: flex;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .dashboard__content {
    display: flex;
    flex-direction: column;
    gap: calc(var(--space-8) * var(--density-scale));
    max-width: 920px;
    width: 100%;
    padding: calc(var(--stage-inner-padding) * var(--density-scale));
  }

  .dashboard__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .dashboard__title {
    font-family: var(--font-sans);
    font-size: clamp(2rem, 3vw, 3rem);
    line-height: var(--text-2xl-leading);
    color: var(--color-text-primary);
    font-weight: 600;
    letter-spacing: -0.04em;
  }

  .dashboard__actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .dashboard__action {
    display: inline-flex;
    align-items: center;
    padding: var(--space-1) var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: rgba(255, 255, 255, 0.64);
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    cursor: pointer;
    transition:
      color var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .dashboard__action:hover {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .dashboard__sections {
    display: flex;
    flex-direction: column;
    gap: calc(var(--space-8) * var(--density-scale));
  }

  .dashboard__section {
    animation: section-enter var(--duration-slow) var(--ease-out) both;
  }

  @keyframes section-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
