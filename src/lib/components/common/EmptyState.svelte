<script lang="ts">
  let {
    icon = '\u25CB',
    message = 'Nothing here',
    actionLabel = '',
    actionHint = '',
    onaction,
  }: {
    icon?: string;
    message?: string;
    actionLabel?: string;
    actionHint?: string;
    onaction?: () => void;
  } = $props();
</script>

<div class="empty-state">
  <span class="empty-state__icon">{icon}</span>
  <p class="empty-state__message">{message}</p>

  {#if actionLabel && onaction}
    <button class="empty-state__action" onclick={onaction}>
      <span>{actionLabel}</span>
      {#if actionHint}
        <kbd class="empty-state__hint">{actionHint}</kbd>
      {/if}
    </button>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-12) var(--space-4);
  }

  .empty-state__icon {
    font-size: 32px;
    opacity: 0.25;
    color: var(--color-text-muted);
    user-select: none;
  }

  .empty-state__message {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: var(--text-sm-leading);
    color: var(--color-text-muted);
    text-align: center;
    max-width: 280px;
  }

  .empty-state__action {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    background: var(--color-bg-hover);
    border-radius: 6px;
    transition:
      color var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out);
  }

  .empty-state__action:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-active);
  }

  .empty-state__hint {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    background: var(--color-bg-surface);
    padding: 1px var(--space-2);
    border-radius: 4px;
  }
</style>
