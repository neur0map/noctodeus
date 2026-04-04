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
    onupload: (files: FileList) => void;
    onlinksubmit: (url: string) => void;
    onclose: () => void;
  } = $props();

  let activeTab = $state<'upload' | 'link'>('upload');
  let linkUrl = $state('');
  let dropActive = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();

  const acceptMap: Record<string, string> = {
    image: 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml',
    video: 'video/mp4,video/webm,video/quicktime',
    audio: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4',
  };

  const iconMap: Record<string, string> = {
    image: '▣',
    video: '▶',
    audio: '♫',
  };

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dropActive = false;
    if (e.dataTransfer?.files?.length) onupload(e.dataTransfer.files);
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) onupload(input.files);
  }

  function handleLinkSubmit() {
    if (!linkUrl.trim()) return;
    onlinksubmit(linkUrl.trim());
    linkUrl = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onclose(); }
    if (e.key === 'Enter' && activeTab === 'link') { e.preventDefault(); handleLinkSubmit(); }
  }

  // Reset state when panel opens
  $effect(() => {
    if (visible) {
      activeTab = 'upload';
      linkUrl = '';
      dropActive = false;
    }
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
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="mp__drop"
        class:mp__drop--active={dropActive}
        ondragover={(e) => { e.preventDefault(); dropActive = true; }}
        ondragleave={() => dropActive = false}
        ondrop={handleDrop}
        onclick={() => fileInput?.click()}
      >
        <span class="mp__drop-icon">{iconMap[mediaType] ?? '▣'}</span>
        <span class="mp__drop-label">
          {#if dropActive}
            Drop to upload
          {:else}
            Click to choose {mediaType}
          {/if}
        </span>
        <span class="mp__drop-hint">or drag and drop</span>
      </div>
      <input
        bind:this={fileInput}
        type="file"
        accept={acceptMap[mediaType] ?? '*/*'}
        onchange={handleFileSelect}
        style="display: none;"
      />
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
    background: rgba(18, 19, 24, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 10px;
    box-shadow:
      0 6px 32px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px);
    overflow: hidden;
    animation: mp-in var(--duration-fast) var(--ease-out) both;
  }

  @keyframes mp-in {
    from { opacity: 0; transform: translateY(-3px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Tabs */
  .mp__tabs {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .mp__tab {
    flex: 1;
    padding: 8px 0;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.32);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: color var(--duration-fast) var(--ease-out);
  }

  .mp__tab:hover { color: rgba(255, 255, 255, 0.56); }

  .mp__tab--active {
    color: var(--color-text-primary);
    border-bottom-color: var(--color-accent);
  }

  /* Upload drop zone */
  .mp__drop {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin: var(--space-3);
    padding: var(--space-5) var(--space-3);
    border: 1.5px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition:
      border-color var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out);
  }

  .mp__drop:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.02);
  }

  .mp__drop--active {
    border-color: var(--color-accent);
    background: rgba(122, 141, 255, 0.06);
  }

  .mp__drop-icon {
    font-size: 18px;
    color: rgba(255, 255, 255, 0.3);
    margin-bottom: 2px;
  }

  .mp__drop-label {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: rgba(255, 255, 255, 0.64);
  }

  .mp__drop-hint {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.22);
  }

  /* Link form */
  .mp__link {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3);
  }

  .mp__link-input {
    flex: 1;
    min-width: 0;
    padding: 6px 10px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    outline: none;
    transition: border-color var(--duration-fast) var(--ease-out);
  }

  .mp__link-input:focus {
    border-color: var(--color-accent);
  }

  .mp__link-input::placeholder {
    color: rgba(255, 255, 255, 0.22);
  }

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
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .mp__link-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .mp__link-btn:not(:disabled):hover {
    opacity: 0.85;
  }

  @media (prefers-reduced-motion: reduce) {
    .mp { animation: none; }
  }
</style>
