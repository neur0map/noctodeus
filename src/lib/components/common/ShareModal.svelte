<script lang="ts">
  import { shareNote } from '$lib/bridge/share';
  import { getSettings } from '$lib/stores/settings.svelte';
  import X from '@lucide/svelte/icons/x';
  import Lock from '@lucide/svelte/icons/lock';
  import Copy from '@lucide/svelte/icons/copy';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import Shield from '@lucide/svelte/icons/shield-check';
  import Eye from '@lucide/svelte/icons/eye';
  import Clock from '@lucide/svelte/icons/clock';

  let {
    visible = false,
    content = '',
    onclose,
  }: {
    visible: boolean;
    content: string;
    onclose: () => void;
  } = $props();

  const settings = getSettings();

  type ExpiryMode = 'views' | 'time';
  let expiryMode = $state<ExpiryMode>('views');
  let viewCount = $state(1);
  let expiryMinutes = $state(5);
  let password = $state('');
  let sharing = $state(false);
  let error = $state<string | null>(null);

  let preview = $derived(
    content.length > 120 ? content.slice(0, 120) + '...' : content
  );

  let charCount = $derived(content.length.toLocaleString());
  let lineCount = $derived(content.split('\n').length);

  function selectViews(n: number) {
    expiryMode = 'views';
    viewCount = n;
  }

  function selectTime(m: number) {
    expiryMode = 'time';
    expiryMinutes = m;
  }

  async function doShare(openBrowser: boolean) {
    sharing = true;
    error = null;
    try {
      const link = await shareNote(
        content,
        expiryMode === 'views' ? viewCount : null,
        expiryMode === 'time' ? expiryMinutes : null,
        password || null,
        settings.cryptgeonServer,
      );

      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(link);

      if (openBrowser) {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(link);
      }

      const { toast } = await import('$lib/stores/toast.svelte');
      toast.success('Encrypted link copied');
      onclose();
    } catch (err: any) {
      error = err?.message || err?.detail || (typeof err === 'string' ? err : JSON.stringify(err));
    }
    sharing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onclose();
    }
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="sh-backdrop" onclick={handleBackdrop} onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sh" onkeydown={handleKeydown}>

      <!-- Header -->
      <div class="sh__head">
        <div class="sh__head-left">
          <div class="sh__icon-wrap">
            <Shield size={16} />
          </div>
          <div>
            <h3 class="sh__title">Share Encrypted Note</h3>
            <span class="sh__subtitle">End-to-end encrypted. Self-destructing.</span>
          </div>
        </div>
        <button class="sh__close" onclick={onclose}><X size={14} /></button>
      </div>

      <!-- Content preview -->
      <div class="sh__preview-wrap">
        <div class="sh__preview">{preview}</div>
        <div class="sh__meta">
          <span>{charCount} chars</span>
          <span>{lineCount} lines</span>
        </div>
      </div>

      <!-- Expiry -->
      <div class="sh__body">
        <div class="sh__expiry">
          <div class="sh__expiry-col">
            <div class="sh__label-row">
              <Eye size={12} />
              <span class="sh__label">Views</span>
            </div>
            <div class="sh__pills">
              <button class="sh__pill" class:sh__pill--on={expiryMode === 'views' && viewCount === 1} onclick={() => selectViews(1)}>1</button>
              <button class="sh__pill" class:sh__pill--on={expiryMode === 'views' && viewCount === 5} onclick={() => selectViews(5)}>5</button>
              <button class="sh__pill" class:sh__pill--on={expiryMode === 'views' && viewCount === 10} onclick={() => selectViews(10)}>10</button>
            </div>
          </div>
          <div class="sh__expiry-sep"></div>
          <div class="sh__expiry-col">
            <div class="sh__label-row">
              <Clock size={12} />
              <span class="sh__label">Time</span>
            </div>
            <div class="sh__pills">
              <button class="sh__pill" class:sh__pill--on={expiryMode === 'time' && expiryMinutes === 5} onclick={() => selectTime(5)}>5m</button>
              <button class="sh__pill" class:sh__pill--on={expiryMode === 'time' && expiryMinutes === 60} onclick={() => selectTime(60)}>1h</button>
              <button class="sh__pill" class:sh__pill--on={expiryMode === 'time' && expiryMinutes === 360} onclick={() => selectTime(360)}>6h</button>
            </div>
          </div>
        </div>

        <!-- Password -->
        <div class="sh__field">
          <div class="sh__label-row">
            <Lock size={12} />
            <span class="sh__label">Password</span>
            <span class="sh__label-hint">optional</span>
          </div>
          <input
            class="sh__input"
            type="password"
            placeholder="Recipients will need this to decrypt"
            bind:value={password}
          />
        </div>

        <!-- Error -->
        {#if error}
          <div class="sh__error">{error}</div>
        {/if}

        <!-- Actions -->
        <div class="sh__actions">
          <button class="sh__btn sh__btn--primary" onclick={() => doShare(false)} disabled={sharing || !content}>
            {#if sharing}
              <span class="sh__spinner"></span>
              Encrypting...
            {:else}
              <Copy size={14} />
              Copy Link
            {/if}
          </button>
          <button class="sh__btn sh__btn--ghost" onclick={() => doShare(true)} disabled={sharing || !content}>
            <ExternalLink size={14} />
            Open in Browser
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div class="sh__foot">
        Encryption by <a href="https://github.com/cupcakearmy/cryptgeon" target="_blank" rel="noopener">cryptgeon</a>
        <span class="sh__foot-sep"></span>
        AES-256-GCM
        <span class="sh__foot-sep"></span>
        MIT License
      </div>

    </div>
  </div>
{/if}

<style lang="scss">
  .sh-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(12px);
    z-index: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: sh-fade 200ms ease both;
  }

  @keyframes sh-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .sh {
    width: min(560px, 92vw);
    background: var(--surface-2, #14151b);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.3),
      0 16px 48px rgba(0, 0, 0, 0.5),
      0 0 80px rgba(122, 162, 247, 0.03);
    overflow: hidden;
    animation: sh-up 350ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes sh-up {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ── Header ── */
  .sh__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .sh__head-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sh__icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 6px;
    background: rgba(122, 162, 247, 0.1);
    color: var(--color-accent, #7AA2F7);
    flex-shrink: 0;
  }

  .sh__title {
    font-family: var(--font-sans);
    font-size: 15px;
    font-weight: 600;
    color: var(--color-foreground);
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .sh__subtitle {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-placeholder);
    letter-spacing: 0.01em;
  }

  .sh__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    transition: color 150ms, background 150ms;
    &:hover { color: var(--color-foreground); background: rgba(255, 255, 255, 0.06); }
  }

  /* ── Preview ── */
  .sh__preview-wrap {
    margin: 0 24px;
    padding: 14px 16px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    margin-top: 20px;
  }

  .sh__preview {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-muted-foreground);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 80px;
    overflow: hidden;
    mask-image: linear-gradient(to bottom, #000 60%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, #000 60%, transparent 100%);
  }

  .sh__meta {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    letter-spacing: 0.02em;
  }

  /* ── Body ── */
  .sh__body {
    padding: 20px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  /* ── Expiry two-column ── */
  .sh__expiry {
    display: flex;
    gap: 0;
    align-items: stretch;
  }

  .sh__expiry-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sh__expiry-sep {
    width: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 0 16px;
    align-self: stretch;
  }

  .sh__label-row {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-placeholder);
  }

  .sh__label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-placeholder);
  }

  .sh__label-hint {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.15);
    margin-left: auto;
  }

  .sh__pills {
    display: flex;
    gap: 6px;
  }

  .sh__pill {
    flex: 1;
    padding: 10px 0;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-muted-foreground);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease-out;
    text-align: center;

    &:hover {
      color: var(--color-foreground);
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.1);
    }
  }

  .sh__pill--on {
    color: var(--color-foreground);
    background: rgba(122, 162, 247, 0.1);
    border-color: rgba(122, 162, 247, 0.3);
  }

  /* ── Password field ── */
  .sh__field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sh__input {
    padding: 10px 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-foreground);
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    outline: none;
    transition: border-color 150ms ease-out;

    &:focus { border-color: rgba(122, 162, 247, 0.4); }
    &::placeholder { color: rgba(255, 255, 255, 0.15); }
  }

  /* ── Error ── */
  .sh__error {
    font-family: var(--font-mono);
    font-size: 11px;
    color: #f7768e;
    line-height: 1.4;
    padding: 8px 12px;
    background: rgba(247, 118, 142, 0.06);
    border: 1px solid rgba(247, 118, 142, 0.15);
    border-radius: 6px;
  }

  /* ── Actions ── */
  .sh__actions {
    display: flex;
    gap: 10px;
    padding-top: 6px;
  }

  .sh__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 0;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease-out;

    &:disabled { opacity: 0.35; cursor: default; pointer-events: none; }
  }

  .sh__btn--primary {
    background: var(--color-accent, #7AA2F7);
    color: #fff;
    border: none;
    position: relative;

    &:hover { filter: brightness(1.1); }

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: 0 0 20px rgba(122, 162, 247, 0.2);
      opacity: 0;
      transition: opacity 200ms;
    }
    &:hover::after { opacity: 1; }
  }

  .sh__btn--ghost {
    background: transparent;
    color: var(--color-muted-foreground);
    border: 1px solid rgba(255, 255, 255, 0.08);

    &:hover {
      color: var(--color-foreground);
      border-color: rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.03);
    }
  }

  .sh__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: sh-spin 600ms linear infinite;
  }

  @keyframes sh-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Footer ── */
  .sh__foot {
    padding: 12px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.2);
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    a {
      color: rgba(122, 162, 247, 0.6);
      text-decoration: none;
      &:hover { color: var(--color-accent); }
    }
  }

  .sh__foot-sep {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
  }

  @media (prefers-reduced-motion: reduce) {
    .sh-backdrop, .sh { animation: none; }
    .sh__spinner { animation: none; }
  }
</style>
