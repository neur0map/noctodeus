<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { GraphNode, GraphEdge } from '../../stores/graph.svelte';
  import ZoomIn from "@lucide/svelte/icons/zoom-in";
  import ZoomOut from "@lucide/svelte/icons/zoom-out";
  import Maximize from "@lucide/svelte/icons/maximize";

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
  let animFrame = 0;
  let sim: GraphNode[] = [];
  let simEdges: GraphEdge[] = [];
  let dpr = 1;
  let cw = 0;
  let ch = 0;

  // View
  let ox = 0;
  let oy = 0;
  let sc = 1;

  // Interaction
  let drag: GraphNode | null = null;
  let dragMoved = false;
  let pan = false;
  let panSX = 0;
  let panSY = 0;
  let hovered: GraphNode | null = null;

  $effect(() => {
    sim = nodes.map(n => ({ ...n }));
    simEdges = [...edges];
    // Auto-fit on first load
    if (sim.length > 0 && sc === 1 && ox === 0 && oy === 0) {
      sc = Math.max(0.4, Math.min(1.2, 400 / (sim.length * 12 + 100)));
    }
  });

  function toWorld(sx: number, sy: number) {
    return {
      x: (sx - cw / 2 - ox) / sc,
      y: (sy - ch / 2 - oy) / sc,
    };
  }

  function nodeAt(wx: number, wy: number): GraphNode | null {
    for (let i = sim.length - 1; i >= 0; i--) {
      const n = sim[i];
      const r = nr(n) + 4;
      const dx = wx - n.x;
      const dy = wy - n.y;
      if (dx * dx + dy * dy < r * r) return n;
    }
    return null;
  }

  function nr(n: GraphNode) {
    return Math.max(5, Math.min(14, 5 + n.linkCount * 1.8));
  }

  function tick() {
    const map = new Map(sim.map(n => [n.id, n]));

    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i], b = sim[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = 1200 / (d * d);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    for (const e of simEdges) {
      const a = map.get(e.source), b = map.get(e.target);
      if (!a || !b) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 100) * 0.008;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }

    for (const n of sim) {
      n.vx -= n.x * 0.003;
      n.vy -= n.y * 0.003;
    }

    for (const n of sim) {
      if (n === drag) { n.vx = 0; n.vy = 0; continue; }
      n.vx *= 0.82;
      n.vy *= 0.82;
      n.x += n.vx * 0.3;
      n.y += n.vy * 0.3;
    }
  }

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cw / 2 + ox, ch / 2 + oy);
    ctx.scale(sc, sc);

    const map = new Map(sim.map(n => [n.id, n]));

    // Edges
    for (const e of simEdges) {
      const a = map.get(e.source), b = map.get(e.target);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(122, 141, 255, 0.15)';
      ctx.lineWidth = 1.2 / sc;
      ctx.stroke();
    }

    // Nodes
    for (const n of sim) {
      const r = nr(n);
      const active = n.path === activeFilePath;
      const hover = n === hovered;

      if (active || hover) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
        ctx.fillStyle = active ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.05)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = active ? 'rgba(99, 102, 241, 0.9)'
        : n.linkCount === 0 ? 'rgba(255, 255, 255, 0.18)'
        : 'rgba(255, 255, 255, 0.45)';
      ctx.fill();

      if (hover || active || sc > 0.6) {
        const fontSize = Math.max(9, 11 / sc);
        ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = active ? 'rgba(255,255,255,0.95)' : hover ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const label = n.title.length > 22 ? n.title.slice(0, 20) + '...' : n.title;
        ctx.fillText(label, n.x, n.y + r + 5);
      }
    }

    ctx.restore();
    tick();
    animFrame = requestAnimationFrame(draw);
  }

  function getCanvasPos(e: PointerEvent | MouseEvent) {
    const rect = canvas!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: PointerEvent) {
    const pos = getCanvasPos(e);
    const w = toWorld(pos.x, pos.y);
    const node = nodeAt(w.x, w.y);
    dragMoved = false;

    if (node) {
      drag = node;
      canvas!.setPointerCapture(e.pointerId);
    } else {
      pan = true;
      panSX = e.clientX - ox;
      panSY = e.clientY - oy;
      canvas!.setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: PointerEvent) {
    const pos = getCanvasPos(e);
    const w = toWorld(pos.x, pos.y);

    if (drag) {
      dragMoved = true;
      drag.x = w.x;
      drag.y = w.y;
    } else if (pan) {
      dragMoved = true;
      ox = e.clientX - panSX;
      oy = e.clientY - panSY;
    } else {
      hovered = nodeAt(w.x, w.y);
      if (canvas) canvas.style.cursor = hovered ? 'pointer' : 'grab';
    }
  }

  function handlePointerUp() {
    if (drag && !dragMoved) {
      // Click without drag = navigate
      onselect(drag.path);
    }
    drag = null;
    pan = false;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    sc = Math.max(0.15, Math.min(4, sc * (e.deltaY > 0 ? 0.92 : 1.08)));
  }

  function resize() {
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    dpr = devicePixelRatio || 1;
    cw = rect.width;
    ch = rect.height;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
  }

  onMount(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (container) ro.observe(container);
    animFrame = requestAnimationFrame(draw);
    return () => { ro.disconnect(); cancelAnimationFrame(animFrame); };
  });

  onDestroy(() => cancelAnimationFrame(animFrame));
</script>

<div class="gv" bind:this={container}>
  <canvas
    bind:this={canvas}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onwheel={handleWheel}
  ></canvas>
  <div class="gv__ctrl">
    <button class="gv__btn" onclick={() => sc = Math.min(4, sc * 1.3)} title="Zoom in"><ZoomIn size={12} /></button>
    <button class="gv__btn" onclick={() => sc = Math.max(0.15, sc * 0.7)} title="Zoom out"><ZoomOut size={12} /></button>
    <button class="gv__btn" onclick={() => { sc = 1; ox = 0; oy = 0; }} title="Reset"><Maximize size={12} /></button>
  </div>
</div>

<style>
  .gv {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--color-background);
    border-radius: 8px;
  }
  canvas { display: block; width: 100%; height: 100%; cursor: grab; }
  canvas:active { cursor: grabbing; }
  .gv__ctrl {
    position: absolute;
    bottom: 8px;
    right: 8px;
    display: flex;
    gap: 2px;
    background: var(--color-popover);
    border-radius: 6px;
    border: 1px solid var(--color-border);
    padding: 2px;
  }
  .gv__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-muted-foreground);
    cursor: pointer;
  }
  .gv__btn:hover { background: var(--color-hover); color: var(--color-foreground); }
</style>
