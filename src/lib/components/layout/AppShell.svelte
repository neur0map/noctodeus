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

<div
  class="app-shell"
  class:app-shell--sidebar-hidden={!sidebarVisible}
  class:app-shell--sidebar-collapsed={sidebarCollapsed}
  class:app-shell--right-panel-open={rightPanelVisible}
>
  {#if sidebarVisible}
    <aside class="app-shell__sidebar">
      {@render sidebar()}
    </aside>
  {/if}

  <main class="app-shell__content">
    {@render content()}
  </main>

  {#if utilityRail && utilityRailVisible}
    <div class="app-shell__rail">
      {@render utilityRail()}
    </div>
  {/if}

  {#if rightPanel && rightPanelVisible}
    <aside class="app-shell__right">
      {@render rightPanel()}
    </aside>
  {/if}
</div>

<style lang="scss">
  .app-shell {
    display: grid;
    grid-template-columns: 276px 1fr 48px;
    height: 100vh;
    background: var(--color-background);
    overflow: hidden;
    transition: grid-template-columns 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .app-shell--sidebar-hidden {
    grid-template-columns: 0 1fr 48px;
  }

  .app-shell--sidebar-collapsed {
    grid-template-columns: 48px 1fr 48px;
  }

  .app-shell--right-panel-open {
    grid-template-columns: 276px 1fr 48px 320px;
  }

  .app-shell--right-panel-open.app-shell--sidebar-collapsed {
    grid-template-columns: 48px 1fr 48px 320px;
  }

  .app-shell--right-panel-open.app-shell--sidebar-hidden {
    grid-template-columns: 0 1fr 48px 320px;
  }

  .app-shell__sidebar {
    overflow: hidden;
    border-right: 1px solid var(--color-border);
    background: var(--color-card);
    transition: width 150ms var(--ease-expo-out);
  }

  .app-shell__content {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .app-shell__rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    border-left: 1px solid var(--color-border);
    background: var(--color-background);
  }

  .app-shell__right {
    border-left: 1px solid var(--color-border);
    background: var(--color-card);
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    .app-shell {
      transition: none;
    }
  }
</style>
