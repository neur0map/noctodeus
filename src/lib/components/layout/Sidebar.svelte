<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    header,
    children,
    footer,
  }: {
    header?: Snippet;
    children: Snippet;
    footer?: Snippet;
  } = $props();
</script>

<div class="sidebar">
  {#if header}
    <div class="sidebar__header">
      {@render header()}
    </div>
  {/if}

  <div class="sidebar__body">
    {@render children()}
  </div>

  {#if footer}
    <div class="sidebar__footer">
      {@render footer()}
    </div>
  {/if}
</div>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 16%),
      rgba(10, 11, 15, 0.86);
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    overflow: hidden;
  }

  .sidebar__header {
    flex-shrink: 0;
    padding: calc(var(--space-3) * var(--sidebar-density))
      calc(var(--space-4) * var(--sidebar-density));
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .sidebar__body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .sidebar__footer {
    flex-shrink: 0;
    padding: calc(var(--space-2) * var(--sidebar-density))
      calc(var(--space-4) * var(--sidebar-density));
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }
</style>
