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

<section class="worksurface" class:worksurface--flush={flush}>
  {#if toolbar}
    <div class="worksurface__toolbar">
      {@render toolbar()}
    </div>
  {/if}

  <div class="worksurface__body">
    {@render children()}
  </div>
</section>

<style>
  .worksurface {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    width: min(100%, var(--stage-max-width));
    margin: 0 auto;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.012), transparent 10%),
      var(--stage-bg);
    border-radius: var(--stage-radius);
    box-shadow: var(--stage-shadow);
    overflow: hidden;
    isolation: isolate;
  }

  .worksurface::before,
  .worksurface::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: inherit;
  }

  .worksurface::before {
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.01),
      transparent 14%
    );
    opacity: 0.52;
    z-index: 0;
  }

  .worksurface::after {
    border: 1px solid var(--stage-border);
    opacity: var(--stage-border-opacity);
    z-index: 1;
  }

  .worksurface__toolbar,
  .worksurface__body {
    position: relative;
    z-index: 2;
  }

  .worksurface__toolbar {
    flex-shrink: 0;
  }

  .worksurface__body {
    flex: 1;
    min-height: 0;
    position: relative;
  }
  .worksurface--flush .worksurface__body {
    display: flex;
    flex-direction: column;
  }
</style>
