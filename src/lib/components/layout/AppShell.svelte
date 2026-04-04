<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    sidebar,
    content,
    rightPanel,
    sidebarVisible = true,
    rightPanelVisible = false,
  }: {
    sidebar: Snippet;
    content: Snippet;
    rightPanel?: Snippet;
    sidebarVisible?: boolean;
    rightPanelVisible?: boolean;
  } = $props();
</script>

<div
  class="app-shell"
  class:sidebar-collapsed={!sidebarVisible}
  class:right-panel-open={rightPanelVisible}
>
  <aside class="app-shell__sidebar" class:collapsed={!sidebarVisible}>
    {@render sidebar()}
  </aside>

  <main class="app-shell__content">
    {@render content()}
  </main>

  {#if rightPanel}
    <aside class="app-shell__right-panel" class:open={rightPanelVisible}>
      {@render rightPanel()}
    </aside>
  {/if}
</div>

<style>
  .app-shell {
    display: grid;
    grid-template-columns: auto 1fr auto;
    height: 100vh;
    background: var(--color-bg-base);
    overflow: hidden;
  }

  .app-shell__sidebar {
    width: 260px;
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

  .app-shell__content {
    min-width: 0;
    overflow: hidden;
  }

  .app-shell__right-panel {
    width: 0;
    overflow: hidden;
    transition:
      width var(--duration-slow) var(--ease-in-out);
    will-change: width;
  }

  .app-shell__right-panel.open {
    width: 320px;
  }
</style>
