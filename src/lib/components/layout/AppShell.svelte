<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    sidebar,
    content,
    rightPanel,
    sidebarVisible = true,
    sidebarCollapsed = false,
    rightPanelVisible = false,
  }: {
    sidebar: Snippet;
    content: Snippet;
    rightPanel?: Snippet;
    sidebarVisible?: boolean;
    sidebarCollapsed?: boolean;
    rightPanelVisible?: boolean;
  } = $props();
</script>

<div
  class="app-shell"
  class:app-shell--sidebar-hidden={!sidebarVisible}
  class:app-shell--sidebar-collapsed={sidebarCollapsed}
  class:app-shell--right-panel={rightPanelVisible}
>
  {#if sidebarVisible}
    <aside class="app-shell__sidebar">
      {@render sidebar()}
    </aside>
  {/if}

  <main class="app-shell__content">
    {@render content()}
  </main>

  {#if rightPanelVisible && rightPanel}
    <aside class="app-shell__right-panel">
      {@render rightPanel()}
    </aside>
  {/if}
</div>

<style lang="scss">
  .app-shell {
    display: grid;
    grid-template-columns: 276px 1fr;
    height: calc(100vh - 8px);
    margin: 0 8px 8px 8px;
    border-radius: 16px;
    background: var(--color-background);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
    transition: grid-template-columns 400ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .app-shell--sidebar-hidden {
    grid-template-columns: 0 1fr;
  }

  .app-shell--sidebar-hidden.app-shell--right-panel {
    grid-template-columns: 0 1fr 360px;
  }

  .app-shell--sidebar-collapsed {
    grid-template-columns: 48px 1fr;
  }

  .app-shell--sidebar-collapsed.app-shell--right-panel {
    grid-template-columns: 48px 1fr 360px;
  }

  .app-shell--right-panel {
    grid-template-columns: 276px 1fr 360px;
  }

  .app-shell__sidebar {
    overflow: hidden;
    border-right: 1px solid var(--border-subtle, var(--color-border));
    background: var(--surface-1, var(--color-card));
    border-radius: 16px 0 0 16px;
    transition: width 150ms var(--ease-expo-out);
  }

  .app-shell__content {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    border-radius: 0 16px 16px 0;
  }

  .app-shell--right-panel .app-shell__content {
    border-radius: 0;
  }

  .app-shell__right-panel {
    overflow: hidden;
    border-radius: 0 16px 16px 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .app-shell {
      transition: none;
    }
  }
</style>
