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
  let time = 0;

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

  // Ambient particles
  type Particle = { x: number; y: number; vx: number; vy: number; r: number; a: number; phase: number };
  let particles: Particle[] = [];

  function initParticles() {
    particles = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 1200,
        y: (Math.random() - 0.5) * 1200,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: Math.random() * 1.2 + 0.3,
        a: Math.random() * 0.15 + 0.03,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  $effect(() => {
    sim = nodes.map(n => ({ ...n }));
    simEdges = [...edges];
    if (sim.length > 0 && sc === 1 && ox === 0 && oy === 0) {
      sc = Math.max(0.4, Math.min(1.2, 400 / (sim.length * 12 + 100)));
    }
    initParticles();
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
    return Math.max(4, Math.min(16, 4 + n.linkCount * 2));
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

    // Drift particles
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x > 600) p.x = -600;
      if (p.x < -600) p.x = 600;
      if (p.y > 600) p.y = -600;
      if (p.y < -600) p.y = 600;
    }
  }

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    time += 0.008;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cw / 2 + ox, ch / 2 + oy);
    ctx.scale(sc, sc);

    const map = new Map(sim.map(n => [n.id, n]));
    const hoveredId = hovered?.id ?? null;

    // Build adjacency for hover highlighting
    const connectedToHover = new Set<string>();
    if (hoveredId) {
      connectedToHover.add(hoveredId);
      for (const e of simEdges) {
        if (e.source === hoveredId) connectedToHover.add(e.target);
        if (e.target === hoveredId) connectedToHover.add(e.source);
      }
    }

    // ── Ambient particles ──
    for (const p of particles) {
      const flicker = Math.sin(time * 2 + p.phase) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(169, 177, 214, ${p.a * flicker})`;
      ctx.fill();
    }

    // ── Edges — curved bezier with pulse ──
    for (const e of simEdges) {
      const a = map.get(e.source), b = map.get(e.target);
      if (!a || !b) continue;

      const isHighlighted = hoveredId && (e.source === hoveredId || e.target === hoveredId);
      const dimmed = hoveredId && !isHighlighted;

      // Curved line — offset control point perpendicular to the midpoint
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const curvature = Math.min(d * 0.1, 20);
      const cx = mx + (-dy / d) * curvature;
      const cy = my + (dx / d) * curvature;

      // Base edge
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cx, cy, b.x, b.y);
      const baseAlpha = dimmed ? 0.08 : isHighlighted ? 0.35 : 0.15;
      ctx.strokeStyle = `rgba(107, 115, 148, ${baseAlpha})`;
      ctx.lineWidth = (isHighlighted ? 1.5 : 0.8) / sc;
      ctx.stroke();

      // Traveling pulse along edge
      if (!dimmed) {
        const pulseT = (time * 0.3 + d * 0.002) % 1;
        const px = (1 - pulseT) * (1 - pulseT) * a.x + 2 * (1 - pulseT) * pulseT * cx + pulseT * pulseT * b.x;
        const py = (1 - pulseT) * (1 - pulseT) * a.y + 2 * (1 - pulseT) * pulseT * cy + pulseT * pulseT * b.y;
        const pulseAlpha = isHighlighted ? 0.5 : 0.2;
        const pulseR = (isHighlighted ? 2.5 : 1.5) / sc;
        ctx.beginPath();
        ctx.arc(px, py, pulseR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(122, 162, 247, ${pulseAlpha * (Math.sin(pulseT * Math.PI) * 0.5 + 0.5)})`;
        ctx.fill();
      }
    }

    // ── Nodes ──
    for (const n of sim) {
      const r = nr(n);
      const active = n.path === activeFilePath;
      const hover = n === hovered;
      const connected = connectedToHover.has(n.id);
      const dimmed = hoveredId !== null && !connected && !active;

      // Breathing animation — each node on its own phase
      const breathe = 1 + Math.sin(time * 0.8 + n.x * 0.01 + n.y * 0.01) * 0.015;
      const drawR = r * breathe;

      // Active node: warm breathing ring
      if (active) {
        const ringPulse = 1 + Math.sin(time * 1.2) * 0.08;
        const ringR = (drawR + 10) * ringPulse;

        // Outer glow
        const glow = ctx.createRadialGradient(n.x, n.y, drawR, n.x, n.y, ringR + 4);
        glow.addColorStop(0, 'rgba(122, 162, 247, 0.12)');
        glow.addColorStop(0.6, 'rgba(122, 162, 247, 0.04)');
        glow.addColorStop(1, 'rgba(122, 162, 247, 0)');
        ctx.beginPath();
        ctx.arc(n.x, n.y, ringR + 4, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(122, 162, 247, ${0.25 + Math.sin(time * 1.2) * 0.1})`;
        ctx.lineWidth = 1 / sc;
        ctx.stroke();
      }

      // Hover ring
      if (hover && !active) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, drawR + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(169, 177, 214, 0.2)';
        ctx.lineWidth = 0.8 / sc;
        ctx.stroke();
      }

      // Node body — radial gradient (brighter center, softer edge)
      const grad = ctx.createRadialGradient(
        n.x - drawR * 0.25, n.y - drawR * 0.25, 0,
        n.x, n.y, drawR
      );

      if (active) {
        grad.addColorStop(0, 'rgba(122, 162, 247, 0.95)');
        grad.addColorStop(0.7, 'rgba(122, 162, 247, 0.7)');
        grad.addColorStop(1, 'rgba(107, 140, 220, 0.5)');
      } else if (dimmed) {
        grad.addColorStop(0, 'rgba(107, 115, 148, 0.2)');
        grad.addColorStop(1, 'rgba(107, 115, 148, 0.08)');
      } else if (n.linkCount === 0) {
        grad.addColorStop(0, 'rgba(107, 115, 148, 0.3)');
        grad.addColorStop(1, 'rgba(107, 115, 148, 0.12)');
      } else {
        const intensity = Math.min(1, n.linkCount / 8);
        const baseA = 0.35 + intensity * 0.3;
        const edgeA = 0.15 + intensity * 0.15;
        grad.addColorStop(0, `rgba(169, 177, 214, ${baseA})`);
        grad.addColorStop(1, `rgba(107, 115, 148, ${edgeA})`);
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, drawR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Inner highlight — top-left specular dot
      if (!dimmed) {
        const specGrad = ctx.createRadialGradient(
          n.x - drawR * 0.3, n.y - drawR * 0.3, 0,
          n.x - drawR * 0.3, n.y - drawR * 0.3, drawR * 0.5
        );
        specGrad.addColorStop(0, `rgba(255, 255, 255, ${active ? 0.2 : 0.08})`);
        specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(n.x, n.y, drawR, 0, Math.PI * 2);
        ctx.fillStyle = specGrad;
        ctx.fill();
      }

      // Labels — only for hover, active, or heavily connected at close zoom
      const showLabel = hover || active || (connected && hoveredId) || (n.linkCount >= 3 && sc > 0.7);
      if (showLabel) {
        const fontSize = Math.max(9, 11 / sc);
        ctx.font = `500 ${fontSize}px var(--font-mono), ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const label = n.title.length > 24 ? n.title.slice(0, 22) + '…' : n.title;
        const labelAlpha = active ? 0.9 : hover ? 0.8 : connected ? 0.6 : 0.4;

        // Text shadow for readability
        ctx.fillStyle = `rgba(10, 14, 26, ${labelAlpha * 0.8})`;
        ctx.fillText(label, n.x + 0.5, n.y + drawR + 6.5);

        // Text
        ctx.fillStyle = active
          ? `rgba(192, 202, 245, ${labelAlpha})`
          : hover
            ? `rgba(187, 154, 247, ${labelAlpha})`
            : `rgba(169, 177, 214, ${labelAlpha})`;
        ctx.fillText(label, n.x, n.y + drawR + 6);
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
    <button class="gv__btn" onclick={() => sc = Math.min(4, sc * 1.3)} title="Zoom in"><ZoomIn size={13} /></button>
    <button class="gv__btn" onclick={() => sc = Math.max(0.15, sc * 0.7)} title="Zoom out"><ZoomOut size={13} /></button>
    <button class="gv__btn" onclick={() => { sc = 1; ox = 0; oy = 0; }} title="Reset"><Maximize size={13} /></button>
  </div>
</div>

<style>
  .gv {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: radial-gradient(ellipse at 50% 40%, rgba(19, 22, 31, 1) 0%, rgba(10, 14, 26, 1) 70%);
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
    background: rgba(19, 22, 31, 0.8);
    backdrop-filter: blur(8px);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.04);
    padding: 3px;
  }
  .gv__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted, #6B7394);
    cursor: pointer;
    transition: color 150ms ease-out;
  }
  .gv__btn:hover { color: var(--text-primary, #C0CAF5); }
</style>
