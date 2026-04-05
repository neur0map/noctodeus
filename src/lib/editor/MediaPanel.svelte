<script lang="ts">
  let {
    visible = false,
    position = { top: 0, left: 0 },
    mediaType = 'image',
    onupload,
    onlinksubmit,
    onclose,
  }: {
    visible: boolean;
    position: { top: number; left: number };
    mediaType: string;
    onupload: () => void;
    onlinksubmit: (url: string) => void;
    onclose: () => void;
  } = $props();

  let activeTab = $state<'upload' | 'link'>('upload');
  let linkUrl = $state('');

  const iconMap: Record<string, string> = {
    image: '▣', video: '▶', audio: '♫',
  };

  function handleLinkSubmit() {
    if (!linkUrl.trim()) return;
    onlinksubmit(linkUrl.trim());
    linkUrl = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onclose(); }
    if (e.key === 'Enter' && activeTab === 'link') { e.preventDefault(); handleLinkSubmit(); }
  }

  $effect(() => {
    if (visible) { activeTab = 'upload'; linkUrl = ''; }
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="mp-backdrop" onmousedown={onclose}></div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="mp"
    style="top: {position.top}px; left: {position.left}px;"
    onkeydown={handleKeydown}
  >
    <div class="mp__tabs">
      <button class="mp__tab" class:mp__tab--active={activeTab === 'upload'} onclick={() => activeTab = 'upload'}>
        Upload
      </button>
      <button class="mp__tab" class:mp__tab--active={activeTab === 'link'} onclick={() => activeTab = 'link'}>
        Link
      </button>
    </div>

    {#if activeTab === 'upload'}
      <div class="mp__upload">
        <button class="mp__upload-btn" onclick={onupload}>
          <span class="mp__upload-icon">{iconMap[mediaType] ?? '▣'}</span>
          <span class="mp__upload-label">Choose {mediaType} file</span>
        </button>
      </div>
    {:else}
      <div class="mp__link">
        <input
          class="mp__link-input"
          type="url"
          placeholder="https://..."
          bind:value={linkUrl}
        />
        <button class="mp__link-btn" onclick={handleLinkSubmit} disabled={!linkUrl.trim()}>
          Embed
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .mp-backdrop {
    position: fixed;
    inset: 0;
    z-index: 199;
  }

  .mp {
    position: fixed;
    z-index: 200;
    width: 260px;
    background: var(--color-popover);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: var(--shadow-float);
    overflow: hidden;
    animation: mp-in 250ms var(--ease-expo-out) both;
  }

  @keyframes mp-in {
    from { opacity: 0; transform: translateY(-8px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .mp__tabs {
    display: flex;
    border-bottom: 1px solid var(--color-border);
  }

  .mp__tab {
    flex: 1;
    padding: 8px 0;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--color-placeholder);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: color 150ms var(--ease-expo-out);
  }

  .mp__tab:hover { color: var(--color-foreground); }

  .mp__tab--active {
    color: var(--color-foreground);
    border-bottom-color: var(--color-accent);
  }

  .mp__upload {
    padding: 12px;
  }

  .mp__upload-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 16px;
    background: var(--color-hover);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    cursor: pointer;
    transition:
      background 150ms var(--ease-expo-out),
      border-color 150ms var(--ease-expo-out);
  }

  .mp__upload-btn:hover {
    background: var(--color-popover);
    border-color: var(--color-muted-foreground);
  }

  .mp__upload-icon {
    font-size: 14px;
    color: var(--color-placeholder);
  }

  .mp__upload-label {
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--color-muted-foreground);
  }

  .mp__link {
    display: flex;
    gap: 8px;
    padding: 12px;
  }

  .mp__link-input {
    flex: 1;
    min-width: 0;
    padding: 6px 10px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-foreground);
    background: var(--color-hover);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    outline: none;
    transition: border-color 150ms var(--ease-expo-out);
  }

  .mp__link-input:focus { border-color: var(--color-accent); }
  .mp__link-input::placeholder { color: var(--color-placeholder); }

  .mp__link-btn {
    padding: 6px 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    color: #fff;
    background: var(--color-accent);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 150ms var(--ease-expo-out);
  }

  .mp__link-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .mp__link-btn:not(:disabled):hover { opacity: 0.85; }

  @media (prefers-reduced-motion: reduce) {
    .mp { animation: none; }
  }
</style>
