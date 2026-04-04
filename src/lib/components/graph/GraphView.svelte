<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { GraphNode, GraphEdge } from '../../stores/graph.svelte';

  let {
    nodes = [],
    edges = [],
    activeFilePath = null,
    onselect,
  }: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    activeFilePath?: string | null;
    onselect: (path: string) => void;
  } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let container: HTMLDivElement | undefined = $state();
  let animFrame: number = 0;
  let simNodes: GraphNode[] = [];
  let simEdges: GraphEdge[] = [];

  // View transform
  let offsetX = 0;
  let offsetY = 0;
  let scale = 1;

  // Interaction
  let dragging: GraphNode | null = null;
  let panning = false;
  let panStartX = 0;
  let panStartY = 0;
  let hoveredNode: GraphNode | null = null;

  // Sync props to simulation state
  $effect(() => {
    simNodes = nodes.map(n => ({ ...n }));
    simEdges = [...edges];
  });

  function screenToWorld(sx: number, sy: number) {
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (sx - rect.left - rect.width / 2 - offsetX) / scale,
      y: (sy - rect.top - rect.height / 2 - offsetY) / scale,
    };
  }

  function findNodeAt(wx: number, wy: number): GraphNode | null {
    for (let i = simNodes.length - 1; i >= 0; i--) {
      const n = simNodes[i];
      const r = nodeRadius(n);
      const dx = wx - n.x;
      const dy = wy - n.y;
      if (dx * dx + dy * dy < r * r + 100) return n;
    }
    return null;
  }

  function nodeRadius(n: GraphNode): number {
    return Math.max(4, Math.min(12, 4 + n.linkCount * 1.5));
  }

  // Force simulation tick
  function tick() {
    const alpha = 0.3;
    const nodeMap = new Map(simNodes.map(n => [n.id, n]));

    // Repulsion between all nodes
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const a = simNodes[i];
        const b = simNodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 800 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attraction along edges
    for (const e of simEdges) {
      const a = nodeMap.get(e.source);
      const b = nodeMap.get(e.target);
      if (!a || !b) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 80) * 0.01;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Center gravity
    for (const n of simNodes) {
      n.vx -= n.x * 0.002;
      n.vy -= n.y * 0.002;
    }

    // Apply velocity with damping
    for (const n of simNodes) {
      if (n === dragging) { n.vx = 0; n.vy = 0; continue; }
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += n.vx * alpha;
      n.y += n.vy * alpha;
    }
  }

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 + offsetX, h / 2 + offsetY);
    ctx.scale(scale, scale);

    const nodeMap = new Map(simNodes.map(n => [n.id, n]));

    // Draw edges
    for (const e of simEdges) {
      const a = nodeMap.get(e.source);
      const b = nodeMap.get(e.target);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(122, 141, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw nodes
    for (const n of simNodes) {
      const r = nodeRadius(n);
      const isActive = n.path === activeFilePath;
      const isHovered = n === hoveredNode;

      // Glow for active/hovered
      if (isActive || isHovered) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.06)';
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      if (isActive) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
      } else if (n.linkCount === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      }
      ctx.fill();

      // Label
      if (isHovered || isActive || scale > 0.8) {
        ctx.font = '10px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(n.title.length > 20 ? n.title.slice(0, 18) + '...' : n.title, n.x, n.y + r + 4);
      }
    }

    ctx.restore();
    tick();
    animFrame = requestAnimationFrame(draw);
  }

  function handlePointerDown(e: PointerEvent) {
    const world = screenToWorld(e.clientX, e.clientY);
    const node = findNodeAt(world.x, world.y);
    if (node) {
      dragging = node;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      panning = true;
      panStartX = e.clientX - offsetX;
      panStartY = e.clientY - offsetY;
    }
  }

  function handlePointerMove(e: PointerEvent) {
    const world = screenToWorld(e.clientX, e.clientY);
    if (dragging) {
      dragging.x = world.x;
      dragging.y = world.y;
    } else if (panning) {
      offsetX = e.clientX - panStartX;
      offsetY = e.clientY - panStartY;
    } else {
      hoveredNode = findNodeAt(world.x, world.y);
      if (canvas) canvas.style.cursor = hoveredNode ? 'pointer' : 'grab';
    }
  }

  function handlePointerUp() {
    if (dragging && hoveredNode === dragging) {
      // Click on node — navigate
    }
    dragging = null;
    panning = false;
  }

  function handleClick(e: MouseEvent) {
    const world = screenToWorld(e.clientX, e.clientY);
    const node = findNodeAt(world.x, world.y);
    if (node) onselect(node.path);
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    scale = Math.max(0.2, Math.min(3, scale * factor));
  }

  function resize() {
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(devicePixelRatio, devicePixelRatio);
  }

  onMount(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (container) ro.observe(container);
    animFrame = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(animFrame);
    };
  });

  onDestroy(() => {
    cancelAnimationFrame(animFrame);
  });
</script>

<div class="graph-view" bind:this={container}>
  <canvas
    bind:this={canvas}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onclick={handleClick}
    onwheel={handleWheel}
  ></canvas>
  <div class="graph-view__controls">
    <button class="graph-view__ctrl-btn" onclick={() => { scale = Math.min(3, scale * 1.2); }} title="Zoom in">+</button>
    <button class="graph-view__ctrl-btn" onclick={() => { scale = Math.max(0.2, scale * 0.8); }} title="Zoom out">−</button>
    <button class="graph-view__ctrl-btn" onclick={() => { scale = 1; offsetX = 0; offsetY = 0; }} title="Reset view">⌂</button>
  </div>
</div>

<style>
  .graph-view {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: rgba(8, 9, 12, 0.6);
    border-radius: calc(var(--stage-radius) - 6px);
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
  }

  canvas:active {
    cursor: grabbing;
  }

  .graph-view__controls {
    position: absolute;
    bottom: var(--space-3);
    right: var(--space-3);
    display: flex;
    gap: 2px;
    background: rgba(18, 19, 24, 0.9);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 2px;
  }

  .graph-view__ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    font-family: var(--font-mono);
    font-size: 13px;
    cursor: pointer;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .graph-view__ctrl-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-primary);
  }
</style>
