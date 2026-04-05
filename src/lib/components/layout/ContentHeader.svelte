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
    height: 52px;
    padding: 0 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.045);
    background: transparent;
    flex-shrink: 0;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.52);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    padding: 0 8px 0 0;
    min-height: auto;
    border-radius: 0;
    background: none;
    border: none;
    letter-spacing: 0.03em;
  }

  .breadcrumb::before {
    content: "";
    width: 20px;
    height: 1px;
    background: rgba(255, 255, 255, 0.15);
    flex-shrink: 0;
  }

  .breadcrumb__separator {
    color: rgba(255, 255, 255, 0.24);
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
