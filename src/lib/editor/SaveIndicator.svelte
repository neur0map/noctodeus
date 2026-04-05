<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";

  let {
    status = 'saved',
  }: {
    status: 'saved' | 'saving' | 'unsaved';
  } = $props();

  const label = $derived(
    status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving...' : 'Unsaved',
  );

  const variant = $derived<"outline" | "secondary" | "default">(
    status === 'unsaved' ? 'default' : 'outline',
  );
</script>

<Badge {variant} class="save-indicator {status === 'saving' ? 'save-indicator--saving' : ''}">
  <span class="save-indicator__dot" data-status={status}></span>
  {label}
</Badge>

<style>
  :global(.save-indicator) {
    font-family: var(--font-mono);
    font-size: 11px;
    gap: 6px;
    user-select: none;
  }

  .save-indicator__dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .save-indicator__dot[data-status='saved'] {
    background-color: var(--color-placeholder);
  }

  .save-indicator__dot[data-status='saving'] {
    background-color: var(--color-placeholder);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .save-indicator__dot[data-status='unsaved'] {
    background-color: var(--color-accent);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  @media (prefers-reduced-motion: reduce) {
    .save-indicator__dot[data-status='saving'] {
      animation: none;
    }
  }
</style>
