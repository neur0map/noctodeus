<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { GraphNode, GraphEdge } from '../../stores/graph.svelte';
  import Plus from "@lucide/svelte/icons/plus";
  import Minus from "@lucide/svelte/icons/minus";
  import LocateFixed from "@lucide/svelte/icons/locate-fixed";
  import Expand from "@lucide/svelte/icons/expand";
  import Focus from "@lucide/svelte/icons/orbit";

  let {
    nodes = [],
    edges = [],
    activeFilePath = null,
    highlightPath = null,
    localMode = false,
    onselect,
    onexpand,
    onfocustoggle,
  }: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    activeFilePath?: string | null;
    highlightPath?: string | null;
    localMode?: boolean;
    onselect: (path: string) => void;
    onexpand?: () => void;
    onfocustoggle?: () => void;
  } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let container: HTMLDivElement | undefined = $state();
  let animFrame = 0;
  let sim: GraphNode[] = [];
  let simEdges: GraphEdge[] = [];
  let dpr = 1;
  let cw = 0;
  let ch = 0;
  let time = 0;

  // View transform
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

  // ── Folder color palette ──
  // Muted, harmonious hues — each unique folder gets assigned one
  const PALETTE = [
    [122, 162, 247],  // blue
    [187, 154, 247],  // purple
    [125, 207, 255],  // cyan
    [158, 206, 106],  // green
    [224, 175, 104],  // amber
    [247, 118, 142],  // rose
    [115, 218, 202],  // teal
    [255, 158, 100],  // orange
    [192, 202, 245],  // lavender
    [219, 75, 75],    // crimson
  ];

  let folderColorMap = new Map<string, number[]>();

  function buildFolderColors() {
    folderColorMap.clear();
    const folders = new Set<string>();
    for (const n of sim) {
      const slash = n.path.lastIndexOf('/');
      const folder = slash > 0 ? n.path.substring(0, slash) : '.';
      folders.add(folder);
    }
    let idx = 0;
    for (const f of folders) {
      folderColorMap.set(f, PALETTE[idx % PALETTE.length]);
      idx++;
    }
  }

  function nodeColor(n: GraphNode): number[] {
    const slash = n.path.lastIndexOf('/');
    const folder = slash > 0 ? n.path.substring(0, slash) : '.';
    return folderColorMap.get(folder) ?? PALETTE[0];
  }

  // ── Sync sim data when props change ──
  $effect(() => {
    sim = nodes.map(n => ({ ...n }));
    simEdges = [...edges];
    if (sim.length > 0 && sc === 1 && ox === 0 && oy === 0) {
      sc = Math.max(0.3, Math.min(1.4, 500 / (sim.length * 10 + 100)));
    }
    buildFolderColors();
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
    return Math.max(4, Math.min(18, 4 + Math.sqrt(n.linkCount) * 3.5));
  }

  // ── Physics tick ──
  function tick() {
    const map = new Map(sim.map(n => [n.id, n]));

    // Repulsion
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i], b = sim[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = 1400 / (d * d);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    // Spring attraction along edges
    for (const e of simEdges) {
      const a = map.get(e.source), b = map.get(e.target);
      if (!a || !b) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 90) * 0.01;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }

    // Central gravity
    for (const n of sim) {
      n.vx -= n.x * 0.002;
      n.vy -= n.y * 0.002;
    }

    // Integrate
    for (const n of sim) {
      if (n === drag) { n.vx = 0; n.vy = 0; continue; }
      n.vx *= 0.84;
      n.vy *= 0.84;
      n.x += n.vx * 0.35;
      n.y += n.vy * 0.35;
    }
  }

  // ── Render ──
  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    time += 0.006;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cw / 2 + ox, ch / 2 + oy);
    ctx.scale(sc, sc);

    const map = new Map(sim.map(n => [n.id, n]));
    // External highlight (sidebar hover) takes precedence over canvas hover
    const hoveredId = highlightPath ?? hovered?.id ?? null;

    // Adjacency for hover
    const connSet = new Set<string>();
    if (hoveredId) {
      connSet.add(hoveredId);
      for (const e of simEdges) {
        if (e.source === hoveredId) connSet.add(e.target);
        if (e.target === hoveredId) connSet.add(e.source);
      }
    }

    // ── Edges ──
    for (const e of simEdges) {
      const a = map.get(e.source), b = map.get(e.target);
      if (!a || !b) continue;

      const isHL = hoveredId && (e.source === hoveredId || e.target === hoveredId);
      const dimmed = hoveredId && !isHL;

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const curve = Math.min(d * 0.08, 16);
      const cx = mx + (-dy / d) * curve;
      const cy = my + (dx / d) * curve;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cx, cy, b.x, b.y);

      if (isHL) {
        const col = nodeColor(a);
        ctx.strokeStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.4)`;
        ctx.lineWidth = 1.8 / sc;
      } else if (dimmed) {
        ctx.strokeStyle = `rgba(80, 86, 110, 0.06)`;
        ctx.lineWidth = 0.6 / sc;
      } else {
        ctx.strokeStyle = `rgba(80, 86, 110, 0.18)`;
        ctx.lineWidth = 0.7 / sc;
      }
      ctx.stroke();
    }

    // ── Nodes ──
    for (const n of sim) {
      const r = nr(n);
      const active = n.path === activeFilePath;
      const hover = n === hovered;
      const connected = connSet.has(n.id);
      const dimmed = hoveredId !== null && !connected && !active;
      const col = nodeColor(n);

      const breathe = 1 + Math.sin(time * 0.9 + n.x * 0.008 + n.y * 0.008) * 0.012;
      const drawR = r * breathe;

      // Active node: glow ring
      if (active) {
        const pulse = 1 + Math.sin(time * 1.0) * 0.06;
        const glowR = (drawR + 12) * pulse;
        const glow = ctx.createRadialGradient(n.x, n.y, drawR, n.x, n.y, glowR);
        glow.addColorStop(0, `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.15)`);
        glow.addColorStop(1, `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, drawR + 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.3)`;
        ctx.lineWidth = 1 / sc;
        ctx.stroke();
      }

      // Hover ring
      if (hover && !active) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, drawR + 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.25)`;
        ctx.lineWidth = 0.8 / sc;
        ctx.stroke();
      }

      // Node body — flat solid circle (Obsidian-style)
      const alpha = dimmed ? 0.15 : active ? 0.95 : hover ? 0.85 : (0.45 + Math.min(n.linkCount / 6, 0.35));

      ctx.beginPath();
      ctx.arc(n.x, n.y, drawR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${alpha})`;
      ctx.fill();

      // ── Labels with pill background ──
      const showLabel = hover || active || (connected && hoveredId) || (n.linkCount >= 2 && sc > 0.6);
      if (showLabel) {
        const fontSize = Math.max(9, Math.min(12, 11 / sc));
        ctx.font = `500 ${fontSize}px var(--font-mono), ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const label = n.title.length > 28 ? n.title.slice(0, 26) + '\u2026' : n.title;
        const metrics = ctx.measureText(label);
        const lw = metrics.width + 10;
        const lh = fontSize + 6;
        const lx = n.x;
        const ly = n.y + drawR + 10;

        // Pill background
        const pillAlpha = active ? 0.85 : hover ? 0.75 : 0.55;
        ctx.beginPath();
        const pillR = lh / 2;
        ctx.roundRect(lx - lw / 2, ly - lh / 2, lw, lh, pillR);
        ctx.fillStyle = `rgba(14, 17, 28, ${pillAlpha})`;
        ctx.fill();

        // Border
        if (active || hover) {
          ctx.strokeStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.3)`;
          ctx.lineWidth = 0.5 / sc;
          ctx.stroke();
        }

        // Text
        const textAlpha = active ? 0.95 : hover ? 0.9 : 0.65;
        ctx.fillStyle = active || hover
          ? `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${textAlpha})`
          : `rgba(192, 202, 245, ${textAlpha})`;
        ctx.fillText(label, lx, ly);
      }
    }

    ctx.restore();
    tick();
    animFrame = requestAnimationFrame(draw);
  }

  // ── Interaction handlers ──
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
      onselect(drag.path);
    }
    drag = null;
    pan = false;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    sc = Math.max(0.12, Math.min(5, sc * factor));
  }

  function fitView() {
    if (sim.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of sim) {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }
    const pad = 60;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    sc = Math.min(cw / w, ch / h, 2);
    ox = -(minX + maxX) / 2 * sc;
    oy = -(minY + maxY) / 2 * sc;
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
    <button class="gv__btn" onclick={() => sc = Math.min(5, sc * 1.3)} title="Zoom in"><Plus size={13} /></button>
    <button class="gv__btn" onclick={() => sc = Math.max(0.12, sc * 0.7)} title="Zoom out"><Minus size={13} /></button>
    <button class="gv__btn" onclick={fitView} title="Fit to view"><LocateFixed size={13} /></button>
    {#if onfocustoggle}
      <button
        class="gv__btn"
        class:gv__btn--active={localMode}
        onclick={onfocustoggle}
        title={localMode ? "Show full graph" : "Show local graph"}
      >
        <Focus size={13} />
      </button>
    {/if}
    {#if onexpand}
      <button class="gv__btn" onclick={onexpand} title="Expand graph">
        <Expand size={13} />
      </button>
    {/if}
  </div>
</div>

<style>
  .gv {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: radial-gradient(ellipse at 50% 40%, rgba(16, 19, 30, 1) 0%, rgba(8, 11, 22, 1) 80%);
    border-radius: 8px;
  }
  canvas { display: block; width: 100%; height: 100%; cursor: grab; }
  canvas:active { cursor: grabbing; }
  .gv__ctrl {
    position: absolute;
    bottom: 12px;
    right: 12px;
    display: flex;
    gap: 2px;
    background: rgba(14, 17, 28, 0.85);
    backdrop-filter: blur(12px);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 3px;
  }
  .gv__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(169, 177, 214, 0.5);
    cursor: pointer;
    transition: color 150ms ease-out, background 150ms ease-out;
  }
  .gv__btn:hover {
    color: rgba(192, 202, 245, 0.9);
    background: rgba(255, 255, 255, 0.04);
  }
  .gv__btn--active {
    color: rgba(122, 162, 247, 0.9);
    background: rgba(122, 162, 247, 0.1);
  }
</style>
