<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    sidebar,
    content,
    utilityRail,
    rightPanel,
    sidebarVisible = true,
    utilityRailVisible = true,
    sidebarCollapsed = false,
    rightPanelVisible = false,
  }: {
    sidebar: Snippet;
    content: Snippet;
    utilityRail?: Snippet;
    rightPanel?: Snippet;
    sidebarVisible?: boolean;
    utilityRailVisible?: boolean;
    sidebarCollapsed?: boolean;
    rightPanelVisible?: boolean;
  } = $props();
</script>

<div class="app-shell__canvas">
  <div
    class="app-shell"
    class:sidebar-collapsed={!sidebarVisible}
    class:utility-rail-hidden={!utilityRailVisible}
    class:right-panel-open={rightPanelVisible}
  >
    <aside class="app-shell__sidebar" class:collapsed={!sidebarVisible} class:compact={sidebarCollapsed}>
      {@render sidebar()}
    </aside>

    <main class="app-shell__content">
      {@render content()}
    </main>

    {#if utilityRail}
      <aside class="app-shell__utility-rail" class:hidden={!utilityRailVisible}>
        {@render utilityRail()}
      </aside>
    {/if}

    {#if rightPanel}
      <aside class="app-shell__right-panel" class:open={rightPanelVisible}>
        {@render rightPanel()}
      </aside>
    {/if}
  </div>
</div>

<style>
  .app-shell__canvas {
    height: 100vh;
    padding: var(--shell-outer-gutter);
    background: var(--shell-bg);
    position: relative;
    overflow: hidden;
  }

  .app-shell {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    height: 100%;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 12%),
      var(--shell-surface);
    border: 1px solid var(--shell-border);
    border-radius: var(--shell-frame-radius);
    box-shadow: var(--shadow-shell);
    overflow: hidden;
    position: relative;
    backdrop-filter: blur(16px);
    z-index: 1;
  }

  .app-shell__sidebar {
    width: var(--shell-sidebar-width);
    min-width: 200px;
    overflow: hidden;
    transition:
      width var(--duration-slow) var(--ease-in-out),
      min-width var(--duration-slow) var(--ease-in-out);
    will-change: width, min-width;
  }

  .app-shell__sidebar.collapsed {
    width: 0;
    min-width: 0;
  }

  .app-shell__sidebar.compact {
    width: 48px;
    min-width: 48px;
  }

  .app-shell__content {
    min-width: 0;
    overflow: hidden;
    position: relative;
  }

  .app-shell__utility-rail {
    width: var(--utility-rail-width);
    border-left: 1px solid rgba(255, 255, 255, 0.04);
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.015),
      transparent 22%
    );
    transition:
      width var(--duration-normal) var(--ease-in-out),
      opacity var(--duration-normal) var(--ease-out);
  }

  .app-shell__utility-rail.hidden {
    width: 0;
    opacity: 0;
    border-left: none;
    overflow: hidden;
  }

  .app-shell__right-panel {
    width: 0;
    overflow: hidden;
    transition: width var(--duration-slow) var(--ease-in-out);
    will-change: width;
    border-left: 1px solid transparent;
  }

  .app-shell__right-panel.open {
    width: var(--right-panel-width);
    border-left-color: rgba(255, 255, 255, 0.05);
  }
</style>
