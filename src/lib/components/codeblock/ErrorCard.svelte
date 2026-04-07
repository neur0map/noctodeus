<script lang="ts">
  import { animate } from '$lib/utils/motion';

  let {
    error,
    onrestart,
  }: {
    error: { kind: string; message: string; platform_hint?: string };
    onrestart: () => void;
  } = $props();

  let cardEl: HTMLDivElement | undefined = $state();

  const headings: Record<string, string> = {
    not_found: 'Python not found',
    spawn_failed: 'Kernel failed to start',
    execution_error: 'Execution error',
    timeout: 'Execution timed out',
    crashed: 'Kernel crashed',
  };

  $effect(() => {
    if (cardEl) {
      animate(cardEl, {
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 300,
        ease: 'outQuint',
      });
    }
  });
</script>

<div class="error-card" bind:this={cardEl}>
  <div class="error-card__icon">&#x26A0;</div>
  <div class="error-card__body">
    <div class="error-card__heading">{headings[error.kind] ?? 'Error'}</div>
    <div class="error-card__message">{error.message}</div>
    {#if error.platform_hint}
      <code class="error-card__hint">{error.platform_hint}</code>
    {/if}
  </div>
  <button class="error-card__action" onclick={onrestart}>
    {error.kind === 'crashed' ? 'Restart kernel' : 'Retry'}
  </button>
</div>

<style>
  .error-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 14px;
    border-top: 1px solid rgba(247, 118, 142, 0.12);
    background: rgba(247, 118, 142, 0.03);
    opacity: 0;
  }

  .error-card__icon {
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .error-card__body {
    flex: 1;
    min-width: 0;
  }

  .error-card__heading {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent-red, #f7768e);
    margin-bottom: 2px;
  }

  .error-card__message {
    font-size: 11px;
    color: var(--text-muted, #6b7394);
    line-height: 1.4;
  }

  .error-card__hint {
    display: block;
    margin-top: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.2);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-primary, #c0caf5);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .error-card__action {
    flex-shrink: 0;
    padding: 4px 12px;
    border: 1px solid rgba(247, 118, 142, 0.2);
    border-radius: 6px;
    background: none;
    color: var(--accent-red, #f7768e);
    font-size: 11px;
    cursor: pointer;
    transition:
      background 120ms,
      border-color 120ms;
    white-space: nowrap;
  }

  .error-card__action:hover {
    background: rgba(247, 118, 142, 0.08);
    border-color: rgba(247, 118, 142, 0.3);
  }
</style>
