<script lang="ts">
  import type { ToastType } from '../../stores/toast.svelte';
  import X from "@lucide/svelte/icons/x";

  let {
    id,
    type = 'info',
    message,
    ondismiss,
  }: {
    id: string;
    type?: ToastType;
    message: string;
    ondismiss: (id: string) => void;
  } = $props();

  let exiting = $state(false);

  function getIcon(t: ToastType): string {
    switch (t) {
      case 'info': return '\u2139';
      case 'success': return '\u2713';
      case 'warning': return '\u26A0';
      case 'error': return '\u2717';
    }
  }

  function handleDismiss() {
    exiting = true;
    setTimeout(() => ondismiss(id), 200);
  }
</script>

<div
  class="toast toast--{type}"
  class:toast--exiting={exiting}
  role="alert"
  aria-live={type === 'error' ? 'assertive' : 'polite'}
>
  <span class="toast__icon">{getIcon(type)}</span>
  <span class="toast__message">{message}</span>
  <button
    class="toast__dismiss"
    onclick={handleDismiss}
    aria-label="Dismiss notification"
  >
    <X size={12} />
  </button>
</div>

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--color-popover);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: var(--shadow-float);
    animation: toast-enter 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
    max-width: 360px;
  }

  .toast--exiting {
    animation: toast-exit 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes toast-enter {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes toast-exit {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(20px);
    }
  }

  .toast__icon {
    flex-shrink: 0;
    width: 16px;
    text-align: center;
    font-size: 13px;
  }

  .toast--info .toast__icon { color: var(--color-accent); }
  .toast--success .toast__icon { color: #22c55e; }
  .toast--warning .toast__icon { color: #eab308; }
  .toast--error .toast__icon { color: var(--color-destructive); }

  .toast__message {
    flex: 1;
    font-family: var(--font-sans);
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-foreground);
  }

  .toast__dismiss {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--color-placeholder);
    border-radius: 4px;
    transition:
      color 150ms var(--ease-expo-out),
      background 150ms var(--ease-expo-out);
  }

  .toast__dismiss:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  @media (prefers-reduced-motion: reduce) {
    .toast,
    .toast--exiting {
      animation: none;
    }
  }
</style>
