<script lang="ts">
  import { getUiState } from '$lib/stores/ui.svelte';
  import ChatPanel from './ChatPanel.svelte';
  import X from '@lucide/svelte/icons/x';
  import MessageCircle from '@lucide/svelte/icons/message-circle';

  const ui = getUiState();

  let open = $state(false);
  let hoverTooltip = $state(false);

  function toggle() {
    open = !open;
  }

  function close() {
    open = false;
  }

  // Sync with global ui state so Cmd+J shortcut works
  $effect(() => {
    open = ui.aiChatVisible;
  });

  $effect(() => {
    if (open !== ui.aiChatVisible) {
      if (open) ui.showAiChat();
      else ui.hideAiChat();
    }
  });
</script>

<!-- Chat panel (shown when open) -->
{#if open}
  <div class="bubble-panel">
    <ChatPanel visible={true} onclose={close} />
  </div>
{/if}

<!-- Floating bubble button -->
<div class="bubble-wrap">
  {#if hoverTooltip && !open}
    <div class="bubble-tooltip">
      Chat about this page
      <span class="bubble-tooltip__kbd">⌘J</span>
    </div>
  {/if}

  <button
    class="bubble-btn"
    class:bubble-btn--open={open}
    onclick={toggle}
    onmouseenter={() => (hoverTooltip = true)}
    onmouseleave={() => (hoverTooltip = false)}
    aria-label={open ? 'Close AI chat' : 'Open AI chat'}
  >
    {#if open}
      <X size={20} />
    {:else}
      <MessageCircle size={20} />
    {/if}
  </button>
</div>

<style>
  .bubble-wrap {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .bubble-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    background: var(--surface-2, var(--card));
    color: var(--foreground);
    cursor: pointer;
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 color-mix(in srgb, var(--foreground) 8%, transparent);
    transition:
      transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1),
      background 120ms ease,
      border-color 120ms ease;
  }

  .bubble-btn:hover {
    transform: scale(1.05);
    background: var(--surface-3, var(--popover));
    border-color: color-mix(in srgb, var(--border-active) 80%, transparent);
  }

  .bubble-btn:active {
    transform: scale(0.97);
  }

  .bubble-btn--open {
    background: var(--accent-blue, var(--color-accent));
    color: var(--primary-foreground, #fff);
    border-color: color-mix(in srgb, var(--accent-blue, var(--color-accent)) 60%, transparent);
  }

  .bubble-tooltip {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--popover);
    border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    color: var(--popover-foreground);
    font-family: var(--font-content);
    font-size: 13px;
    white-space: nowrap;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    animation: bubble-tooltip-in 140ms ease;
  }

  .bubble-tooltip__kbd {
    padding: 2px 7px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .bubble-panel {
    position: fixed;
    bottom: 88px;
    right: 24px;
    z-index: 99;
    width: 420px;
    height: min(640px, calc(100vh - 120px));
    border-radius: 16px;
    overflow: hidden;
    background: var(--surface-1, var(--card));
    border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.35),
      0 4px 20px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    animation: bubble-panel-in 180ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .bubble-panel :global(> *) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  @keyframes bubble-tooltip-in {
    from { opacity: 0; transform: translateX(8px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes bubble-panel-in {
    from { opacity: 0; transform: translateY(10px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (max-width: 720px) {
    .bubble-panel {
      right: 16px;
      left: 16px;
      width: auto;
      bottom: 80px;
    }
    .bubble-wrap {
      right: 16px;
      bottom: 16px;
    }
  }
</style>
