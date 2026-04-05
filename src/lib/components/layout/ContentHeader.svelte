<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    path = "",
    trailing,
  }: {
    path?: string;
    trailing?: Snippet;
  } = $props();

  let segments = $derived(path ? path.split("/").filter(Boolean) : []);
</script>

<div class="content-header">
  {#if segments.length > 0}
    <nav class="breadcrumb" aria-label="File path">
      {#each segments as segment, i}
        {#if i > 0}
          <span class="breadcrumb__separator" aria-hidden="true">/</span>
        {/if}
        <span
          class="breadcrumb__segment"
          class:breadcrumb__segment--last={i === segments.length - 1}
        >
          {segment}
        </span>
      {/each}
    </nav>
  {/if}

  {#if trailing}
    <div class="content-header__trailing">
      {@render trailing()}
    </div>
  {/if}
</div>

<style>
  .content-header {
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 12px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-placeholder);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .breadcrumb__separator {
    color: var(--color-placeholder);
    opacity: 0.5;
    user-select: none;
  }

  .breadcrumb__segment--last {
    color: var(--color-foreground);
  }

  .content-header__trailing {
    margin-left: auto;
    display: flex;
    align-items: center;
  }
</style>
