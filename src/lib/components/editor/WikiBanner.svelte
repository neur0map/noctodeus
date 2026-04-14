<script lang="ts">
  let { lastUpdated }: { lastUpdated?: number } = $props();

  let timeStr = $derived(
    lastUpdated && lastUpdated > 0
      ? new Date(lastUpdated * 1000).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : null
  );
</script>

<div class="wiki-banner">
  <span class="wiki-banner__text">
    AI-maintained page · Edits may be overwritten on next ingest
    {#if timeStr}
      · Last updated {timeStr}
    {/if}
  </span>
</div>

<style>
  .wiki-banner {
    display: flex;
    align-items: center;
    padding: 6px 16px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent-purple, #bb9af7);
    background: rgba(187, 154, 247, 0.06);
    border-bottom: 1px solid rgba(187, 154, 247, 0.1);
  }

  .wiki-banner__text {
    opacity: 0.8;
  }
</style>
