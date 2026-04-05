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
    bottom: 16px;
    right: 16px;
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    z-index: 200;
    pointer-events: none;
  }

  .toast-container > :global(*) {
    pointer-events: auto;
  }

  .toast-container__overflow {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-placeholder);
    text-align: right;
    padding-right: 8px;
    pointer-events: none;
  }
</style>
