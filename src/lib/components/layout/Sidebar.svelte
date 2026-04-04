<script lang="ts">
  import type { Snippet } from 'svelte';

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
    background: var(--color-bg-surface);
    border-right: 1px solid var(--color-border-subtle);
    overflow: hidden;
  }

  .sidebar__header {
    flex-shrink: 0;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .sidebar__body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .sidebar__footer {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-4);
    border-top: 1px solid var(--color-border-subtle);
  }
</style>
