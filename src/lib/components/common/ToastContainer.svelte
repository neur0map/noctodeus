<script lang="ts">
  import Toast from './Toast.svelte';
  import { getToastState } from '../../stores/toast.svelte';

  const MAX_VISIBLE = 3;

  const toastState = getToastState();

  let visibleToasts = $derived(toastState.toasts.slice(-MAX_VISIBLE));
  let hiddenCount = $derived(Math.max(0, toastState.toasts.length - MAX_VISIBLE));
</script>

<div class="toast-container" aria-live="polite" aria-label="Notifications">
  {#if hiddenCount > 0}
    <div class="toast-container__overflow">+{hiddenCount} more</div>
  {/if}

  {#each visibleToasts as item (item.id)}
    <Toast
      id={item.id}
      type={item.type}
      message={item.message}
      ondismiss={(id) => toastState.remove(id)}
    />
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: var(--space-4);
    right: var(--space-4);
    display: flex;
    flex-direction: column-reverse;
    gap: var(--space-2);
    z-index: 200;
    pointer-events: none;
  }

  .toast-container > :global(*) {
    pointer-events: auto;
  }

  .toast-container__overflow {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-align: right;
    padding-right: var(--space-2);
    pointer-events: none;
  }
</style>
