<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    header,
    children,
  }: {
    header?: Snippet;
    children: Snippet;
  } = $props();
</script>

<div class="content-area">
  {#if header}
    <div class="content-area__header">
      {@render header()}
    </div>
  {/if}

  <div class="content-area__body">
    {@render children()}
  </div>
</div>

<style>
  .content-area {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-base);
    overflow: hidden;
  }

  .content-area__header {
    flex-shrink: 0;
  }

  .content-area__body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
