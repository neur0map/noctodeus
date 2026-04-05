<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    toolbar,
    children,
    flush = false,
  }: {
    toolbar?: Snippet;
    children: Snippet;
    flush?: boolean;
  } = $props();
</script>

<div class="worksurface" class:worksurface--flush={flush}>
  {#if toolbar}
    <div class="worksurface__toolbar">
      {@render toolbar()}
    </div>
  {/if}
  <div class="worksurface__body">
    {@render children()}
  </div>
</div>

<style lang="scss">
  .worksurface {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    max-width: 2200px;
    margin: 0 auto;
    width: 100%;
    background: var(--color-background);
  }

  .worksurface__toolbar {
    flex-shrink: 0;
  }

  .worksurface__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .worksurface--flush .worksurface__body {
    display: flex;
    flex-direction: column;
  }
</style>
