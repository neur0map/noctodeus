<script lang="ts">
  import type { ToastType } from '../../stores/toast.svelte';

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
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </button>
</div>

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    box-shadow: var(--shadow-elevated);
    animation: toast-enter var(--duration-normal) var(--ease-spring) both;
    max-width: 360px;
  }

  .toast--exiting {
    animation: toast-exit var(--duration-normal) var(--ease-in-out) both;
  }

  @keyframes toast-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes toast-exit {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  .toast__icon {
    flex-shrink: 0;
    width: 16px;
    text-align: center;
    font-size: var(--text-sm);
  }

  .toast--info .toast__icon { color: var(--color-accent); }
  .toast--success .toast__icon { color: #22c55e; }
  .toast--warning .toast__icon { color: #eab308; }
  .toast--error .toast__icon { color: var(--color-danger); }

  .toast__message {
    flex: 1;
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    line-height: var(--text-sm-leading);
    color: var(--color-text-primary);
  }

  .toast__dismiss {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--color-text-muted);
    border-radius: 4px;
    transition:
      color var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out);
  }

  .toast__dismiss:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-hover);
  }
</style>
