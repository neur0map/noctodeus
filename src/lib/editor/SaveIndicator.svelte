<script lang="ts">
  let {
    status = 'saved',
  }: {
    status: 'saved' | 'saving' | 'unsaved';
  } = $props();

  const label = $derived(
    status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving...' : 'Unsaved',
  );
</script>

<div class="save-indicator" data-status={status}>
  <span class="save-indicator__dot"></span>
  <span class="save-indicator__label">{label}</span>
</div>

<style>
  .save-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.4;
    color: var(--color-placeholder);
    transition: color 150ms var(--ease-expo-out);
  }

  .save-indicator__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: background-color 150ms var(--ease-expo-out);
  }

  [data-status='saved'] .save-indicator__dot {
    background-color: var(--color-placeholder);
  }

  [data-status='saving'] .save-indicator__dot {
    background-color: var(--color-placeholder);
    animation: pulse 1.2s ease-in-out infinite;
  }

  [data-status='unsaved'] .save-indicator__dot {
    background-color: var(--color-accent);
  }

  .save-indicator__label {
    user-select: none;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  @media (prefers-reduced-motion: reduce) {
    [data-status='saving'] .save-indicator__dot {
      animation: none;
    }
  }
</style>
