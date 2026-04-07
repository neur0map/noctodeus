<script lang="ts">
  let {
    error,
    onrestart,
  }: {
    error: { kind: string; message: string; platform_hint?: string };
    onrestart: () => void;
  } = $props();
</script>

<div class="error-card">
  <p>{error.message}</p>
  {#if error.platform_hint}
    <code>{error.platform_hint}</code>
  {/if}
  <button onclick={onrestart}>Restart</button>
</div>

<style>
  .error-card {
    padding: 8px 12px;
    border-top: 1px solid rgba(247, 118, 142, 0.15);
    background: rgba(247, 118, 142, 0.04);
  }

  p {
    margin: 0;
    color: var(--accent-red, #f7768e);
    font-size: 12px;
  }

  code {
    display: block;
    margin-top: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted, #6b7394);
  }

  button {
    margin-top: 6px;
    padding: 4px 10px;
    border: 1px solid rgba(247, 118, 142, 0.2);
    border-radius: 4px;
    background: none;
    color: var(--accent-red, #f7768e);
    font-size: 11px;
    cursor: pointer;
  }
</style>
