<script lang="ts">
  let {
    path = '',
  }: {
    path?: string;
  } = $props();

  let segments = $derived(
    path
      ? path.split('/').filter(Boolean)
      : []
  );
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
</div>

<style>
  .content-header {
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 var(--space-4);
    border-bottom: 1px solid var(--color-border-subtle);
    background: var(--color-bg-base);
    flex-shrink: 0;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: var(--text-sm-leading);
    color: var(--color-text-secondary);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .breadcrumb__separator {
    color: var(--color-text-muted);
    user-select: none;
  }

  .breadcrumb__segment--last {
    color: var(--color-text-primary);
  }
</style>
