<script lang="ts">
  let {
    visible = false,
    filePath = '',
    onexport,
    oncancel,
  }: {
    visible: boolean;
    filePath: string;
    onexport: (format: string, includeMedia: boolean) => void;
    oncancel: () => void;
  } = $props();

  let format = $state('markdown');
  let includeMedia = $state(false);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); oncancel(); }
  }

  function handleExport() {
    onexport(format, includeMedia);
  }

  const fileName = $derived(filePath.split('/').pop() ?? filePath);
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="export-backdrop" onclick={oncancel} onkeydown={handleKeydown}></div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="export-dialog" onkeydown={handleKeydown}>
    <div class="export-dialog__title">Export</div>
    <div class="export-dialog__file">{fileName}</div>

    <div class="export-dialog__section">
      <span class="export-dialog__label">Format</span>
      <div class="export-dialog__options">
        <label class="export-dialog__radio" class:export-dialog__radio--active={format === 'markdown'}>
          <input type="radio" name="format" value="markdown" bind:group={format} />
          <span>Markdown</span>
        </label>
        <label class="export-dialog__radio" class:export-dialog__radio--active={format === 'html'}>
          <input type="radio" name="format" value="html" bind:group={format} />
          <span>HTML</span>
        </label>
        <label class="export-dialog__radio" class:export-dialog__radio--active={format === 'csv'}>
          <input type="radio" name="format" value="csv" bind:group={format} />
          <span>CSV</span>
        </label>
      </div>
    </div>

    <div class="export-dialog__section">
      <label class="export-dialog__toggle-row">
        <span class="export-dialog__label">Include media</span>
        <label class="export-dialog__toggle">
          <input type="checkbox" bind:checked={includeMedia} />
          <span class="export-dialog__toggle-track"></span>
        </label>
      </label>
      <span class="export-dialog__hint">
        {#if includeMedia}
          Images and media files will be copied alongside the export.
        {:else}
          Export text only, media references will be removed.
        {/if}
      </span>
    </div>

    <div class="export-dialog__actions">
      <button class="export-dialog__btn export-dialog__btn--cancel" onclick={oncancel}>Cancel</button>
      <button class="export-dialog__btn export-dialog__btn--ok" onclick={handleExport}>Export</button>
    </div>
  </div>
{/if}

<style>
  .export-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 399;
  }

  .export-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 400;
    width: 360px;
    background: rgba(20, 21, 27, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 16px 64px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(20px);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: export-in 150ms var(--ease-expo-out) both;
  }

  @keyframes export-in {
    from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  .export-dialog__title {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-foreground);
  }

  .export-dialog__file {
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: -8px;
  }

  .export-dialog__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .export-dialog__label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .export-dialog__options {
    display: flex;
    gap: 6px;
  }

  .export-dialog__radio {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 7px 0;
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms var(--ease-expo-out);
  }

  .export-dialog__radio input { display: none; }

  .export-dialog__radio:hover {
    border-color: rgba(255, 255, 255, 0.14);
    color: var(--color-foreground);
  }

  .export-dialog__radio--active {
    border-color: var(--color-accent);
    color: var(--color-foreground);
    background: rgba(99, 102, 241, 0.1);
  }

  .export-dialog__toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .export-dialog__toggle {
    position: relative;
    flex-shrink: 0;
  }

  .export-dialog__toggle input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .export-dialog__toggle-track {
    display: block;
    width: 32px;
    height: 18px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 9px;
    transition: background 150ms var(--ease-expo-out);
    position: relative;
  }

  .export-dialog__toggle-track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    transition: transform 150ms var(--ease-expo-out);
  }

  .export-dialog__toggle input:checked + .export-dialog__toggle-track {
    background: var(--color-accent);
  }

  .export-dialog__toggle input:checked + .export-dialog__toggle-track::after {
    transform: translateX(14px);
    background: #fff;
  }

  .export-dialog__hint {
    font-family: var(--font-sans);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
    line-height: 1.4;
  }

  .export-dialog__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 4px;
  }

  .export-dialog__btn {
    padding: 6px 14px;
    font-family: var(--font-sans);
    font-size: 13px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .export-dialog__btn--cancel {
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
  }

  .export-dialog__btn--cancel:hover {
    color: var(--color-foreground);
  }

  .export-dialog__btn--ok {
    background: var(--color-accent);
    color: #fff;
  }

  @media (prefers-reduced-motion: reduce) {
    .export-dialog { animation: none; }
  }
</style>
