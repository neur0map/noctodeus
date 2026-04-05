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
    gap: 12px;
    padding: 48px 16px;
  }

  .empty-state__icon {
    font-size: 32px;
    opacity: 0.25;
    color: var(--color-placeholder);
    user-select: none;
  }

  .empty-state__message {
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-placeholder);
    text-align: center;
    max-width: 280px;
  }

  .empty-state__action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--color-muted-foreground);
    background: var(--color-hover);
    border-radius: 6px;
    transition:
      color 150ms var(--ease-expo-out),
      background 150ms var(--ease-expo-out);
  }

  .empty-state__action:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  .empty-state__hint {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-placeholder);
    background: var(--color-card);
    padding: 1px 8px;
    border-radius: 4px;
  }
</style>
