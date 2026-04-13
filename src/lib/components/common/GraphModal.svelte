<script lang="ts">
  import GraphView from "$lib/components/graph/GraphView.svelte";
  import { getFilesState } from "$lib/stores/files.svelte";
  import { getGraphState } from "$lib/stores/graph.svelte";
  import type { GraphNode, GraphEdge } from "$lib/stores/graph.svelte";
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";

  let {
    visible,
    onclose,
    onfileselect,
  }: {
    visible: boolean;
    onclose: () => void;
    onfileselect: (path: string) => void;
  } = $props();

  const files = getFilesState();
  const graphState = getGraphState();

  let searchQuery = $state('');
  let localMode = $state(false);
  let selectedNode = $state<string | null>(null);
  let hoveredSidebarNode = $state<string | null>(null);

  // ── Folder grouping ──
  let folderGroups = $derived.by(() => {
    const groups = new Map<string, GraphNode[]>();
    for (const n of graphState.nodes) {
      const slash = n.path.lastIndexOf('/');
      const folder = slash > 0 ? n.path.substring(0, slash) : '/';
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder)!.push(n);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([folder, nodes]) => ({
        folder,
        label: folder === '/' ? 'Root' : folder,
        nodes: nodes.sort((a, b) => a.title.localeCompare(b.title)),
      }));
  });

  // ── Search filter ──
  let filteredNodes = $derived.by(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return graphState.nodes.filter(n =>
      n.title.toLowerCase().includes(q) || n.path.toLowerCase().includes(q)
    );
  });

  // ── Local graph mode ──
  // When active, only show the selected node and its direct neighbors
  let displayNodes = $derived.by(() => {
    const allNodes = graphState.nodes;
    const allEdges = graphState.edges;

    if (!localMode || !selectedNode) return allNodes;

    const neighborIds = new Set<string>([selectedNode]);
    for (const e of allEdges) {
      if (e.source === selectedNode) neighborIds.add(e.target);
      if (e.target === selectedNode) neighborIds.add(e.source);
    }
    return allNodes.filter(n => neighborIds.has(n.id));
  });

  let displayEdges = $derived.by(() => {
    const allEdges = graphState.edges;
    if (!localMode || !selectedNode) return allEdges;

    const nodeIds = new Set(displayNodes.map(n => n.id));
    return allEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  });

  function handleNodeSelect(path: string) {
    selectedNode = path;
    if (!localMode) {
      onclose();
      onfileselect(path);
    }
  }

  function handleSidebarClick(path: string) {
    selectedNode = path;
    if (!localMode) {
      onclose();
      onfileselect(path);
    }
  }

  function toggleLocalMode() {
    if (!localMode) {
      // Enter local mode — use active file or first selected node
      selectedNode = selectedNode || files.activeFilePath || graphState.nodes[0]?.path || null;
    }
    localMode = !localMode;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onclose();
    }
  }

  // ── Folder color helper ──
  const PALETTE_CSS = [
    '122, 162, 247', '187, 154, 247', '125, 207, 255', '158, 206, 106',
    '224, 175, 104', '247, 118, 142', '115, 218, 202', '255, 158, 100',
    '192, 202, 245', '219, 75, 75',
  ];
  const folderIdxMap = new Map<string, number>();
  let colorIdx = 0;

  function nodeColorCSS(node: { path: string }): string {
    const slash = node.path.lastIndexOf('/');
    const folder = slash > 0 ? node.path.substring(0, slash) : '.';
    if (!folderIdxMap.has(folder)) {
      folderIdxMap.set(folder, colorIdx++);
    }
    return PALETTE_CSS[folderIdxMap.get(folder)! % PALETTE_CSS.length];
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="gm__backdrop" onclick={onclose} onkeydown={handleKeydown}></div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="gm" onkeydown={handleKeydown}>
    <!-- Sidebar -->
    <aside class="gm__side">
      <div class="gm__side-header">
        <span class="gm__side-title">Graph</span>
        <button class="gm__close" onclick={onclose}><X size={14} /></button>
      </div>

      <!-- Search -->
      <div class="gm__search">
        <Search size={12} />
        <input
          class="gm__search-input"
          type="text"
          placeholder="Search notes..."
          bind:value={searchQuery}
        />
      </div>

      <!-- Stats strip -->
      <div class="gm__stats">
        <span class="gm__stat">{graphState.nodes.length} <small>notes</small></span>
        <span class="gm__stat">{graphState.edges.length} <small>links</small></span>
        <span class="gm__stat">{graphState.stats.orphanCount} <small>orphans</small></span>
      </div>

      <!-- Node list -->
      <div class="gm__list">
        {#if filteredNodes}
          <!-- Search results -->
          <div class="gm__group">
            <span class="gm__group-label">{filteredNodes.length} result{filteredNodes.length === 1 ? '' : 's'}</span>
            {#each filteredNodes as node (node.id)}
              <button
                class="gm__node"
                class:gm__node--active={node.path === selectedNode}
                onclick={() => handleSidebarClick(node.path)}
                onmouseenter={() => hoveredSidebarNode = node.path}
                onmouseleave={() => hoveredSidebarNode = null}
              >
                <span class="gm__node-dot" style:background="rgba({nodeColorCSS(node)}, 0.7)"></span>
                <span class="gm__node-name">{node.title}</span>
                {#if node.linkCount > 0}
                  <span class="gm__node-count">{node.linkCount}</span>
                {/if}
              </button>
            {/each}
          </div>
        {:else}
          <!-- Grouped by folder -->
          {#each folderGroups as group (group.folder)}
            <div class="gm__group">
              <span class="gm__group-label">{group.label}</span>
              {#each group.nodes as node (node.id)}
                <button
                  class="gm__node"
                  class:gm__node--active={node.path === selectedNode}
                  onclick={() => handleSidebarClick(node.path)}
                  onmouseenter={() => hoveredSidebarNode = node.path}
                  onmouseleave={() => hoveredSidebarNode = null}
                >
                  <span class="gm__node-dot" style:background="rgba({nodeColorCSS(node)}, 0.7)"></span>
                  <span class="gm__node-name">{node.title}</span>
                  {#if node.linkCount > 0}
                    <span class="gm__node-count">{node.linkCount}</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/each}
        {/if}
      </div>
    </aside>

    <!-- Canvas area -->
    <div class="gm__canvas">
      <GraphView
        nodes={displayNodes}
        edges={displayEdges}
        activeFilePath={selectedNode || files.activeFilePath}
        highlightPath={hoveredSidebarNode}
        {localMode}
        onselect={handleNodeSelect}
        onfocustoggle={toggleLocalMode}
      />
      {#if localMode && selectedNode}
        <div class="gm__local-badge">
          Local: {displayNodes.length} node{displayNodes.length === 1 ? '' : 's'}
        </div>
      {/if}
    </div>
  </div>
{/if}


<style>
  .gm__backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(6px);
    z-index: 500;
    animation: gm-fade-in 200ms ease both;
  }

  .gm {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(92vw, 1100px);
    height: min(85vh, 750px);
    display: flex;
    background: #10131e;
    border-radius: 10px;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04);
    z-index: 501;
    overflow: hidden;
    animation: gm-scale-in 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes gm-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes gm-scale-in {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  /* ── Sidebar — forced dark theme ── */
  .gm__side {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    background: #0e111c;
    color: #c0caf5;
  }

  .gm__side-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 16px 12px;
  }

  .gm__side-title {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: #c0caf5;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .gm__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: #6b7394;
    cursor: pointer;
    transition: color 150ms ease, background 150ms ease;
  }
  .gm__close:hover {
    color: #c0caf5;
    background: rgba(255, 255, 255, 0.06);
  }

  /* Search */
  .gm__search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 12px 10px;
    padding: 7px 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    color: #6b7394;
    transition: border-color 150ms ease;
  }
  .gm__search:focus-within {
    border-color: rgba(122, 162, 247, 0.4);
  }
  .gm__search-input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-family: var(--font-mono);
    font-size: 11px;
    color: #c0caf5;
  }
  .gm__search-input::placeholder {
    color: #6b7394;
  }

  /* Stats */
  .gm__stats {
    display: flex;
    gap: 3px;
    padding: 0 12px 10px;
  }
  .gm__stat {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    color: #c0caf5;
    background: rgba(255, 255, 255, 0.04);
    padding: 3px 8px;
    border-radius: 4px;
  }
  .gm__stat small {
    font-weight: 400;
    color: #6b7394;
    margin-left: 2px;
  }

  /* Node list */
  .gm__list {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px 12px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.06) transparent;
  }

  .gm__group {
    margin-bottom: 8px;
  }
  .gm__group-label {
    display: block;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 500;
    color: #565f89;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 6px 8px 4px;
  }

  .gm__node {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    background: transparent;
    border-radius: 5px;
    cursor: pointer;
    text-align: left;
    transition: background 120ms ease;
  }
  .gm__node:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  .gm__node--active {
    background: rgba(122, 162, 247, 0.1);
  }
  .gm__node-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .gm__node-name {
    font-family: var(--font-mono);
    font-size: 11px;
    color: #a9b1d6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  .gm__node:hover .gm__node-name {
    color: #c0caf5;
  }
  .gm__node--active .gm__node-name {
    color: #c0caf5;
  }
  .gm__node-count {
    font-family: var(--font-mono);
    font-size: 9px;
    color: #565f89;
    flex-shrink: 0;
  }

  /* ── Canvas area ── */
  .gm__canvas {
    flex: 1;
    min-width: 0;
    position: relative;
  }

  .gm__local-badge {
    position: absolute;
    top: 12px;
    left: 12px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(122, 162, 247, 0.8);
    background: rgba(14, 17, 28, 0.8);
    backdrop-filter: blur(8px);
    padding: 4px 10px;
    border-radius: 5px;
    border: 1px solid rgba(122, 162, 247, 0.15);
    pointer-events: none;
  }
</style>
