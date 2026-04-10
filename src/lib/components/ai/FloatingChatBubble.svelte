<script lang="ts">
  import { getUiState } from '$lib/stores/ui.svelte';
  import ChatPanel from './ChatPanel.svelte';
  import EyeIcon from './EyeIcon.svelte';
  import X from '@lucide/svelte/icons/x';

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
      <EyeIcon size={22} />
    {/if}
  </button>
</div>

<style>
  .bubble-wrap {
    position: fixed;
    bottom: 28px;
    right: 28px;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 14px;
  }

  /* ── Refined bubble button ── */
  .bubble-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    background:
      radial-gradient(
        circle at 30% 30%,
        color-mix(in srgb, var(--surface-2, var(--card)) 96%, var(--foreground) 4%),
        var(--surface-1, var(--card)) 70%
      );
    color: var(--foreground);
    cursor: pointer;
    box-shadow:
      0 1px 0 color-mix(in srgb, var(--foreground) 10%, transparent) inset,
      0 0 0 1px color-mix(in srgb, var(--background) 40%, transparent),
      0 10px 40px -8px rgba(0, 0, 0, 0.45),
      0 2px 8px -2px rgba(0, 0, 0, 0.25);
    transition:
      transform 280ms cubic-bezier(0.16, 1, 0.3, 1),
      box-shadow 280ms cubic-bezier(0.16, 1, 0.3, 1),
      background 200ms ease;
  }

  .bubble-btn::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--foreground) 16%, transparent),
      transparent 50%,
      color-mix(in srgb, var(--foreground) 4%, transparent)
    );
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }

  .bubble-btn:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 color-mix(in srgb, var(--foreground) 14%, transparent) inset,
      0 0 0 1px color-mix(in srgb, var(--background) 40%, transparent),
      0 14px 48px -8px rgba(0, 0, 0, 0.55),
      0 4px 12px -2px rgba(0, 0, 0, 0.3);
  }

  .bubble-btn:active {
    transform: translateY(0) scale(0.98);
  }

  .bubble-btn--open {
    background: var(--foreground);
    color: var(--background);
    border-color: transparent;
  }

  /* ── Refined tooltip ── */
  .bubble-tooltip {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 9px 16px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--popover) 96%, var(--foreground) 4%);
    border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    color: var(--popover-foreground);
    font-family: var(--font-content);
    font-size: 13px;
    font-weight: 450;
    letter-spacing: -0.01em;
    white-space: nowrap;
    box-shadow:
      0 10px 40px -10px rgba(0, 0, 0, 0.4),
      0 2px 8px -2px rgba(0, 0, 0, 0.2);
    animation: bubble-tooltip-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .bubble-tooltip__kbd {
    padding: 3px 7px;
    border-radius: 5px;
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 500;
    line-height: 1;
  }

  /* ── Premium floating panel ── */
  .bubble-panel {
    position: fixed;
    bottom: 96px;
    right: 28px;
    z-index: 99;
    width: 440px;
    height: min(680px, calc(100vh - 140px));
    border-radius: 18px;
    overflow: hidden;
    background: var(--surface-1, var(--card));
    border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    box-shadow:
      0 1px 0 color-mix(in srgb, var(--foreground) 8%, transparent) inset,
      0 0 0 1px color-mix(in srgb, var(--background) 40%, transparent),
      0 32px 80px -20px rgba(0, 0, 0, 0.6),
      0 12px 40px -10px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    animation: bubble-panel-in 280ms cubic-bezier(0.16, 1, 0.3, 1);
    backdrop-filter: blur(20px) saturate(1.1);
    -webkit-backdrop-filter: blur(20px) saturate(1.1);
  }

  .bubble-panel :global(> *) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* Override ChatPanel's right-docked styles */
  .bubble-panel :global(.cp) {
    height: 100% !important;
    border-left: none !important;
    background: transparent !important;
    animation: none !important;
  }

  @keyframes bubble-tooltip-in {
    from { opacity: 0; transform: translateX(12px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes bubble-panel-in {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.94);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 720px) {
    .bubble-panel {
      right: 16px;
      left: 16px;
      width: auto;
      bottom: 88px;
    }
    .bubble-wrap {
      right: 16px;
      bottom: 16px;
    }
  }
</style>
