<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    sidebar,
    content,
    sidebarVisible = true,
    sidebarCollapsed = false,
  }: {
    sidebar: Snippet;
    content: Snippet;
    sidebarVisible?: boolean;
    sidebarCollapsed?: boolean;
  } = $props();
</script>

<div
  class="app-shell"
  class:app-shell--sidebar-hidden={!sidebarVisible}
  class:app-shell--sidebar-collapsed={sidebarCollapsed}
>
  {#if sidebarVisible}
    <aside class="app-shell__sidebar">
      {@render sidebar()}
    </aside>
  {/if}

  <main class="app-shell__content">
    {@render content()}
  </main>
</div>

<style lang="scss">
  .app-shell {
    display: grid;
    grid-template-columns: 276px 1fr;
    height: calc(100vh - 8px);
    margin: 0 8px 8px 8px;
    border-radius: 12px;
    background: var(--color-background);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
    transition: grid-template-columns 400ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .app-shell--sidebar-hidden {
    grid-template-columns: 0 1fr;
  }

  .app-shell--sidebar-collapsed {
    grid-template-columns: 48px 1fr;
  }

  .app-shell__sidebar {
    overflow: hidden;
    border-right: 1px solid var(--border-subtle, var(--color-border));
    background: var(--surface-1, var(--color-card));
    transition: width 150ms var(--ease-expo-out);
  }

  .app-shell__content {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    .app-shell {
      transition: none;
    }
  }
</style>
