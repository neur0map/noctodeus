<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { FileNode } from '$lib/types/core';
  import type { GraphStats, GraphNode, GraphEdge } from '$lib/stores/graph.svelte';
  import { stagger, animate } from '$lib/utils/motion';
  import type { AnimationParams } from 'animejs';
  import GraphView from '$lib/components/graph/GraphView.svelte';

  let {
    coreName = 'Noctodeus',
    recentFiles = [],
    pinnedFiles = [],
    totalNotes = 0,
    graphStats,
    graphScanning = false,
    graphNodes = [],
    graphEdges = [],
    onfileopen,
    onexpandgraph,
  }: {
    coreName?: string;
    recentFiles?: FileNode[];
    pinnedFiles?: FileNode[];
    totalNotes?: number;
    graphStats: GraphStats;
    graphScanning?: boolean;
    graphNodes?: GraphNode[];
    graphEdges?: GraphEdge[];
    onfileopen: (path: string) => void;
    onexpandgraph?: () => void;
  } = $props();

  // Tick every 15s so relative times stay fresh
  let tick = $state(0);
  const timer = setInterval(() => { tick++; }, 15_000);
  onDestroy(() => clearInterval(timer));

  // Time-of-day greeting
  function getGreeting(): string {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  // Context-aware subtitle
  let greetingLine = $derived.by(() => {
    void tick; // refresh on tick
    const greeting = getGreeting();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayUnix = todayStart.getTime() / 1000;
    const changedToday = recentFiles.filter(f => f.modified_at >= todayUnix).length;

    if (changedToday > 0) {
      return `${greeting} — ${changedToday} note${changedToday === 1 ? '' : 's'} changed today`;
    }
    return `${greeting} — ${totalNotes} notes`;
  });

  // _tick param forces re-evaluation
  function formatRelativeTime(unixSeconds: number, _tick: number): string {
    const now = Date.now() / 1000;
    const diff = now - unixSeconds;
    if (diff < 10) return 'now';
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 604800)}w ago`;
  }

  function displayName(file: FileNode): string {
    return file.title || file.name;
  }

  // Hero card — most recently edited file
  let heroFile = $derived(recentFiles.length > 0 ? recentFiles[0] : null);

  // Mini graph — top 10 most connected nodes + their edges
  let miniNodes = $derived.by(() => {
    if (graphNodes.length === 0) return [];
    const sorted = [...graphNodes].sort((a, b) => b.linkCount - a.linkCount);
    return sorted.slice(0, 10);
  });

  let miniNodeIds = $derived(new Set(miniNodes.map(n => n.id)));

  let miniEdges = $derived.by(() => {
    if (miniNodes.length === 0) return [];
    return graphEdges.filter(e => miniNodeIds.has(e.source) && miniNodeIds.has(e.target));
  });

  // Two-column data
  let recentList = $derived(recentFiles.slice(heroFile ? 1 : 0, 6));

  let rightColumnFiles = $derived.by(() => {
    if (pinnedFiles.length > 0) return { title: 'Pinned', files: pinnedFiles.slice(0, 5) };
    const connected = graphStats.mostConnected.filter(n => n.count > 0).slice(0, 5);
    return { title: 'Most Linked', files: connected };
  });

  // Orphan nudge
  let orphanCount = $derived(graphStats.orphanCount);

  // --- Animations ---
  let dashboardEl: HTMLDivElement | undefined = $state();
  let animatedEls = new WeakSet<Element>();

  function animateOnce(selector: string, opts: AnimationParams) {
    if (!dashboardEl) return;
    requestAnimationFrame(() => {
      const els = dashboardEl!.querySelectorAll(selector);
      const newEls = Array.from(els).filter(el => !animatedEls.has(el));
      if (newEls.length === 0) return;
      newEls.forEach(el => animatedEls.add(el));
      animate(newEls, opts);
    });
  }

  // Animate greeting (always present on mount)
  onMount(() => {
    animateOnce('.ds__greeting', { opacity: [0, 1], duration: 400, ease: 'outQuint' });
  });

  // Animate hero when recent files arrive
  $effect(() => {
    if (recentFiles.length > 0) {
      animateOnce('.ds__hero', { opacity: [0, 1], translateY: [20, 0], scale: [0.98, 1], duration: 500, delay: 100, ease: 'outQuint' });
    }
  });

  // Animate graph when nodes arrive
  $effect(() => {
    if (graphNodes.length > 0) {
      animateOnce('.ds__graph-wrap', { opacity: [0, 1], duration: 500, delay: 200, ease: 'outQuint' });
      animateOnce('.ds__stat-value', { opacity: [0, 1], delay: stagger(60, { start: 350 }), duration: 400, ease: 'outQuint' });
    }
  });

  // Animate columns when data arrives
  $effect(() => {
    if (recentFiles.length > 0 || pinnedFiles.length > 0) {
      animateOnce('.ds__col', { opacity: [0, 1], translateY: [16, 0], delay: stagger(80, { start: 350 }), duration: 500, ease: 'outQuint' });
    }
  });

  // Animate orphan nudge
  $effect(() => {
    if (graphStats.orphanCount > 0) {
      animateOnce('.ds__orphan', { opacity: [0, 1], duration: 400, delay: 500, ease: 'outQuint' });
    }
  });
</script>

<div class="ds" bind:this={dashboardEl}>
  <!-- 1. Greeting Strip -->
  <p class="ds__greeting">{greetingLine}</p>

  <!-- 2. Continue Where You Left Off -->
  {#if heroFile}
    <button class="ds__hero" onclick={() => onfileopen(heroFile!.path)}>
      <span class="ds__hero-title">{displayName(heroFile)}</span>
      <span class="ds__hero-time">{formatRelativeTime(heroFile.modified_at, tick)}</span>
    </button>
  {/if}

  <!-- 3. Mini Graph -->
  {#if miniNodes.length > 0}
    <div class="ds__graph-wrap">
      <div class="ds__graph">
        <GraphView
          nodes={miniNodes}
          edges={miniEdges}
          onselect={onfileopen}
          onexpand={onexpandgraph}
        />
      </div>
      <div class="ds__stats">
        <span class="ds__stat">
          <span class="ds__stat-value">{graphScanning ? '--' : graphStats.totalLinks}</span>
          <span class="ds__stat-label">links</span>
        </span>
        <span class="ds__stat">
          <span class="ds__stat-value">{graphScanning ? '--' : graphStats.avgLinksPerNote}</span>
          <span class="ds__stat-label">avg / note</span>
        </span>
        <span class="ds__stat">
          <span class="ds__stat-value">{graphScanning ? '--' : graphStats.orphanCount}</span>
          <span class="ds__stat-label">orphans</span>
        </span>
        <span class="ds__stat">
          <span class="ds__stat-value">{totalNotes}</span>
          <span class="ds__stat-label">notes</span>
        </span>
      </div>
    </div>
  {/if}

  <!-- 4. Two Columns -->
  {#if recentList.length > 0 || rightColumnFiles.files.length > 0}
    <div class="ds__columns">
      <!-- Left: Recent -->
      {#if recentList.length > 0}
        <div class="ds__col">
          <h2 class="ds__col-title">Recent</h2>
          {#each recentList as file (file.path)}
            <button class="ds__row" onclick={() => onfileopen(file.path)}>
              <span class="ds__row-name">{displayName(file)}</span>
              <span class="ds__row-meta">{formatRelativeTime(file.modified_at, tick)}</span>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Right: Pinned or Most Linked -->
      {#if rightColumnFiles.files.length > 0}
        <div class="ds__col">
          <h2 class="ds__col-title">{rightColumnFiles.title}</h2>
          {#each rightColumnFiles.files as item (item.path)}
            <button class="ds__row" onclick={() => onfileopen(item.path)}>
              <span class="ds__row-name">{'title' in item && typeof item.title === 'string' ? item.title : ('name' in item ? (item as FileNode).title || (item as FileNode).name : '')}</span>
              {#if 'count' in item}
                <span class="ds__row-meta">{item.count}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- 5. Orphan Nudge -->
  {#if orphanCount > 0 && !graphScanning}
    <p class="ds__orphan">
      {orphanCount} note{orphanCount === 1 ? ' has' : 's have'} no links — connect them?
    </p>
  {/if}
</div>

<style>
  .ds {
    display: flex;
    flex-direction: column;
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 28px;
    overflow-y: auto;
    gap: 28px;
  }

  /* 1. Greeting */
  .ds__greeting {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-placeholder);
    letter-spacing: 0.01em;
    opacity: 0;
  }

  /* 2. Hero Card */
  .ds__hero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    opacity: 0;
    transition: border-color 150ms ease;
  }

  .ds__hero:hover {
    border-color: var(--color-accent);
  }

  .ds__hero-title {
    font-family: var(--font-sans);
    font-size: 15px;
    font-weight: 500;
    color: var(--color-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .ds__hero-time {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-placeholder);
    flex-shrink: 0;
    margin-left: 16px;
  }

  /* 3. Mini Graph */
  .ds__graph-wrap {
    display: flex;
    flex-direction: column;
    gap: 12px;
    opacity: 0;
  }

  .ds__graph {
    height: 200px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  .ds__stats {
    display: flex;
    gap: 20px;
    justify-content: center;
  }

  .ds__stat {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .ds__stat-value {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--color-foreground);
    opacity: 0;
  }

  .ds__stat-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* 4. Two Columns */
  .ds__columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .ds__col {
    display: flex;
    flex-direction: column;
    gap: 0;
    opacity: 0;
  }

  .ds__col-title {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
  }

  .ds__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 6px 4px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
  }

  .ds__row:hover .ds__row-name {
    color: var(--color-accent);
  }

  .ds__row-name {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 150ms ease;
  }

  .ds__row-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-placeholder);
    flex-shrink: 0;
    margin-left: 12px;
  }

  /* 5. Orphan Nudge */
  .ds__orphan {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-placeholder);
    text-align: center;
    opacity: 0;
  }

  /* Responsive stacking */
  @media (max-width: 560px) {
    .ds__columns {
      grid-template-columns: 1fr;
    }
  }
</style>
