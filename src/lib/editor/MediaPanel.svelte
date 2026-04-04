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
  let dropZoneActive = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();

  const acceptMap: Record<string, string> = {
    image: 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml',
    video: 'video/mp4,video/webm,video/quicktime',
    audio: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4',
  };

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dropZoneActive = false;
    if (e.dataTransfer?.files?.length) {
      onupload(e.dataTransfer.files);
    }
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) {
      onupload(input.files);
    }
  }

  function handleLinkSubmit() {
    if (linkUrl.trim()) {
      onlinksubmit(linkUrl.trim());
      linkUrl = '';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onclose();
    }
    if (e.key === 'Enter' && activeTab === 'link') {
      e.preventDefault();
      handleLinkSubmit();
    }
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="media-panel-backdrop" onmousedown={onclose}></div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="media-panel"
    style="top: {position.top}px; left: {position.left}px;"
    onkeydown={handleKeydown}
  >
    <div class="media-panel__tabs">
      <button
        class="media-panel__tab"
        class:media-panel__tab--active={activeTab === 'upload'}
        onclick={() => activeTab = 'upload'}
      >
        Upload
      </button>
      <button
        class="media-panel__tab"
        class:media-panel__tab--active={activeTab === 'link'}
        onclick={() => activeTab = 'link'}
      >
        Link
      </button>
    </div>

    <div class="media-panel__body">
      {#if activeTab === 'upload'}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="media-panel__dropzone"
          class:media-panel__dropzone--active={dropZoneActive}
          ondragover={(e) => { e.preventDefault(); dropZoneActive = true; }}
          ondragleave={() => dropZoneActive = false}
          ondrop={handleDrop}
          onclick={() => fileInput?.click()}
        >
          <span class="media-panel__dropzone-icon">
            {mediaType === 'image' ? '▣' : mediaType === 'video' ? '▶' : '♫'}
          </span>
          <span class="media-panel__dropzone-text">
            Drop {mediaType} here or click to browse
          </span>
        </div>
        <input
          bind:this={fileInput}
          type="file"
          accept={acceptMap[mediaType] ?? '*/*'}
          onchange={handleFileSelect}
          style="display: none;"
        />
      {:else}
        <div class="media-panel__link-form">
          <input
            class="media-panel__link-input"
            type="url"
            placeholder="Paste a URL..."
            bind:value={linkUrl}
            autofocus
          />
          <button
            class="media-panel__link-submit"
            onclick={handleLinkSubmit}
            disabled={!linkUrl.trim()}
          >
            Embed
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .media-panel-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .media-panel {
    position: fixed;
    z-index: 100;
    width: 320px;
    background: rgba(20, 21, 27, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    box-shadow:
      0 8px 40px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(16px);
    animation: panel-enter var(--duration-fast) var(--ease-out) both;
    overflow: hidden;
  }

  @keyframes panel-enter {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .media-panel__tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .media-panel__tab {
    flex: 1;
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: rgba(255, 255, 255, 0.4);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition:
      color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .media-panel__tab:hover {
    color: rgba(255, 255, 255, 0.64);
  }

  .media-panel__tab--active {
    color: var(--color-text-primary);
    border-bottom-color: var(--color-accent);
  }

  .media-panel__body {
    padding: var(--space-4);
  }

  .media-panel__dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-4);
    border: 1.5px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition:
      border-color var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out);
  }

  .media-panel__dropzone:hover,
  .media-panel__dropzone--active {
    border-color: var(--color-accent);
    background: rgba(122, 141, 255, 0.04);
  }

  .media-panel__dropzone-icon {
    font-size: 20px;
    color: rgba(255, 255, 255, 0.3);
  }

  .media-panel__dropzone-text {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    color: rgba(255, 255, 255, 0.36);
    text-align: center;
  }

  .media-panel__link-form {
    display: flex;
    gap: var(--space-2);
  }

  .media-panel__link-input {
    flex: 1;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    outline: none;
    transition: border-color var(--duration-fast) var(--ease-out);
  }

  .media-panel__link-input:focus {
    border-color: var(--color-accent);
  }

  .media-panel__link-input::placeholder {
    color: rgba(255, 255, 255, 0.26);
  }

  .media-panel__link-submit {
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    background: var(--color-accent);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .media-panel__link-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .media-panel__link-submit:not(:disabled):hover {
    opacity: 0.85;
  }

  @media (prefers-reduced-motion: reduce) {
    .media-panel {
      animation: none;
    }
  }
</style>
