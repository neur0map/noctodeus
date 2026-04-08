<script lang="ts">
  import { importScan, importObsidian } from '$lib/bridge/import';
  import type { VaultScan, ImportResult } from '$lib/bridge/import';
  import { getCoreState } from '$lib/stores/core.svelte';

  import X from '@lucide/svelte/icons/x';
  import Diamond from '@lucide/svelte/icons/diamond';
  import FileText from '@lucide/svelte/icons/file-text';
  import Image from '@lucide/svelte/icons/image';
  import FolderClosed from '@lucide/svelte/icons/folder-closed';
  import HardDrive from '@lucide/svelte/icons/hard-drive';
  import Check from '@lucide/svelte/icons/check';
  import CircleDot from '@lucide/svelte/icons/circle-dot';
  import Circle from '@lucide/svelte/icons/circle';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import Loader from '@lucide/svelte/icons/loader';
  import CheckCircle from '@lucide/svelte/icons/check-circle-2';

  let {
    visible = false,
    onclose,
  }: {
    visible: boolean;
    onclose: () => void;
  } = $props();

  const core = getCoreState();

  // --- Wizard state ---
  let step = $state(1);
  let vaultPath = $state<string | null>(null);
  let scan = $state<VaultScan | null>(null);
  let scanning = $state(false);
  let scanError = $state<string | null>(null);

  // Step 2 options
  let createNewCore = $state(true);
  let coreName = $state('');

  // Step 3 state
  let importing = $state(false);
  let importError = $state<string | null>(null);
  let result = $state<ImportResult | null>(null);

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function resetWizard() {
    step = 1;
    vaultPath = null;
    scan = null;
    scanning = false;
    scanError = null;
    createNewCore = true;
    coreName = '';
    importing = false;
    importError = null;
    result = null;
  }

  function handleClose() {
    resetWizard();
    onclose();
  }

  async function handleBrowse() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, title: 'Select Obsidian vault' });
      if (!selected || typeof selected !== 'string') return;

      vaultPath = selected;
      scanning = true;
      scanError = null;
      step = 2;

      try {
        scan = await importScan(selected);
        coreName = scan.name;
      } catch (err) {
        scanError = String(err);
      }
      scanning = false;
    } catch (err) {
      scanError = String(err);
    }
  }

  async function handleImport() {
    if (!vaultPath) return;
    importing = true;
    importError = null;
    step = 3;

    try {
      const targetPath = core.activeCore?.path ?? '';
      result = await importObsidian(
        vaultPath,
        targetPath,
        createNewCore,
        createNewCore ? coreName || null : null,
      );
    } catch (err) {
      importError = String(err);
    }
    importing = false;
  }

  async function handleOpenCore() {
    if (!result || !createNewCore || !coreName) {
      handleClose();
      return;
    }
    try {
      const { openCore, scanCore } = await import('$lib/bridge/commands');
      const { getFilesState } = await import('$lib/stores/files.svelte');
      const coreInfo = await openCore(coreName);
      core.setCore(coreInfo);
      const fileTree = await scanCore();
      const files = getFilesState();
      files.setFiles(fileTree);
    } catch (err) {
      const { toast } = await import('$lib/stores/toast.svelte');
      toast.error(`Failed to open core: ${err}`);
    }
    handleClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) handleClose();
  }

  let hasActiveCore = $derived(core.activeCore !== null);
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="iw-backdrop" onclick={handleBackdrop} onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="iw" onkeydown={handleKeydown}>

      <!-- Header -->
      <div class="iw__head">
        <div class="iw__head-left">
          <div class="iw__icon-wrap">
            <Diamond size={16} />
          </div>
          <div>
            <h3 class="iw__title">Import from Obsidian</h3>
            <span class="iw__subtitle">Bring your vault into Noctodeus</span>
          </div>
        </div>
        <button class="iw__close" onclick={handleClose}><X size={14} /></button>
      </div>

      <!-- Step indicator -->
      <div class="iw__steps">
        {#each [1, 2, 3] as s}
          <div class="iw__step-dot" class:iw__step-dot--active={step === s} class:iw__step-dot--done={step > s}>
            {#if step > s}
              <Check size={10} />
            {:else if step === s}
              <CircleDot size={14} />
            {:else}
              <Circle size={14} />
            {/if}
          </div>
          {#if s < 3}
            <div class="iw__step-line" class:iw__step-line--done={step > s}></div>
          {/if}
        {/each}
      </div>

      <!-- Body -->
      <div class="iw__body">

        <!-- Step 1: Select Vault -->
        {#if step === 1}
          <div class="iw__step iw__step-select">
            <div class="iw__vault-icon">
              <Diamond size={48} strokeWidth={1.2} />
            </div>
            <p class="iw__step-heading">Select your Obsidian vault folder</p>
            <p class="iw__step-desc">Choose the root folder of your Obsidian vault to begin scanning.</p>
            <button class="iw__btn iw__btn--primary iw__btn--browse" onclick={handleBrowse}>
              <FolderOpen size={14} />
              Browse
            </button>
          </div>
        {/if}

        <!-- Step 2: Scanning / Preview -->
        {#if step === 2}
          <div class="iw__step iw__step-preview">
            {#if scanning}
              <div class="iw__scanning">
                <div class="iw__spinner"></div>
                <span>Scanning vault...</span>
              </div>
            {:else if scanError}
              <div class="iw__error">{scanError}</div>
              <button class="iw__btn iw__btn--ghost" onclick={() => { step = 1; scanError = null; }}>
                Go Back
              </button>
            {:else if scan}
              <!-- Vault name -->
              <div class="iw__vault-name">{scan.name}</div>

              <!-- Stats grid -->
              <div class="iw__stats">
                <div class="iw__stat">
                  <div class="iw__stat-icon"><FileText size={14} /></div>
                  <div class="iw__stat-value">{scan.markdownCount.toLocaleString()}</div>
                  <div class="iw__stat-label">Markdown</div>
                </div>
                <div class="iw__stat">
                  <div class="iw__stat-icon"><Image size={14} /></div>
                  <div class="iw__stat-value">{scan.mediaCount.toLocaleString()}</div>
                  <div class="iw__stat-label">Media</div>
                </div>
                <div class="iw__stat">
                  <div class="iw__stat-icon"><FolderClosed size={14} /></div>
                  <div class="iw__stat-value">{scan.folderCount.toLocaleString()}</div>
                  <div class="iw__stat-label">Folders</div>
                </div>
                <div class="iw__stat">
                  <div class="iw__stat-icon"><HardDrive size={14} /></div>
                  <div class="iw__stat-value">{formatBytes(scan.totalSizeBytes)}</div>
                  <div class="iw__stat-label">Total size</div>
                </div>
              </div>

              <!-- Compatibility badges -->
              <div class="iw__badges">
                <div class="iw__badge" class:iw__badge--ok={scan.hasWikiLinks}>
                  {#if scan.hasWikiLinks}<Check size={12} />{/if}
                  Wiki-links
                </div>
                <div class="iw__badge" class:iw__badge--ok={scan.hasFrontmatter}>
                  {#if scan.hasFrontmatter}<Check size={12} />{/if}
                  Frontmatter
                </div>
              </div>

              <!-- Sample files -->
              {#if scan.sampleFiles.length > 0}
                <div class="iw__samples">
                  <div class="iw__label-row">
                    <span class="iw__label">Sample files</span>
                  </div>
                  <div class="iw__sample-list">
                    {#each scan.sampleFiles.slice(0, 5) as file}
                      <div class="iw__sample-file">
                        <FileText size={12} />
                        <span>{file}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Import options -->
              <div class="iw__options">
                <button
                  class="iw__option"
                  class:iw__option--selected={createNewCore}
                  onclick={() => { createNewCore = true; }}
                >
                  <div class="iw__option-radio">
                    {#if createNewCore}<CircleDot size={16} />{:else}<Circle size={16} />{/if}
                  </div>
                  <div class="iw__option-content">
                    <span class="iw__option-title">Create new core</span>
                    <input
                      class="iw__input"
                      type="text"
                      placeholder="Core name"
                      bind:value={coreName}
                      onfocus={() => { createNewCore = true; }}
                    />
                  </div>
                </button>

                {#if hasActiveCore}
                  <button
                    class="iw__option"
                    class:iw__option--selected={!createNewCore}
                    onclick={() => { createNewCore = false; }}
                  >
                    <div class="iw__option-radio">
                      {#if !createNewCore}<CircleDot size={16} />{:else}<Circle size={16} />{/if}
                    </div>
                    <div class="iw__option-content">
                      <span class="iw__option-title">Import into current core</span>
                      <span class="iw__option-desc">{core.activeCore?.name}</span>
                    </div>
                  </button>
                {/if}
              </div>

              <!-- Import button -->
              <div class="iw__actions">
                <button class="iw__btn iw__btn--ghost" onclick={() => { step = 1; }}>
                  Back
                </button>
                <button
                  class="iw__btn iw__btn--primary"
                  onclick={handleImport}
                  disabled={createNewCore && !coreName.trim()}
                >
                  Import
                </button>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Step 3: Importing / Complete -->
        {#if step === 3}
          <div class="iw__step iw__step-progress">
            {#if importing}
              <div class="iw__importing">
                <div class="iw__spinner"></div>
                <span class="iw__import-text">Importing files...</span>
              </div>
            {:else if importError}
              <div class="iw__error">{importError}</div>
              <div class="iw__actions">
                <button class="iw__btn iw__btn--ghost" onclick={() => { step = 2; importError = null; }}>
                  Go Back
                </button>
              </div>
            {:else if result}
              <div class="iw__success">
                <div class="iw__success-icon">
                  <CheckCircle size={40} strokeWidth={1.2} />
                </div>
                <p class="iw__step-heading">Import Complete</p>
                <div class="iw__result-stats">
                  <div class="iw__result-stat">
                    <span class="iw__result-value">{result.filesImported}</span>
                    <span class="iw__result-label">Files imported</span>
                  </div>
                  <div class="iw__result-sep"></div>
                  <div class="iw__result-stat">
                    <span class="iw__result-value">{result.foldersCreated}</span>
                    <span class="iw__result-label">Folders created</span>
                  </div>
                  <div class="iw__result-sep"></div>
                  <div class="iw__result-stat">
                    <span class="iw__result-value">{result.skipped}</span>
                    <span class="iw__result-label">Skipped</span>
                  </div>
                </div>
              </div>
              <div class="iw__actions">
                {#if createNewCore}
                  <button class="iw__btn iw__btn--primary" onclick={handleOpenCore}>
                    Open Core
                  </button>
                {/if}
                <button class="iw__btn iw__btn--ghost" onclick={handleClose}>
                  Done
                </button>
              </div>
            {/if}
          </div>
        {/if}

      </div>

      <!-- Footer -->
      <div class="iw__foot">
        Your files stay local. Nothing is uploaded.
      </div>

    </div>
  </div>
{/if}

<style lang="scss">
  /* ── Backdrop ── */
  .iw-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(12px);
    z-index: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: iw-fade 200ms ease both;
  }

  @keyframes iw-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ── Modal ── */
  .iw {
    width: min(580px, 92vw);
    max-height: 90vh;
    background: var(--surface-2, #14151b);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.3),
      0 16px 48px rgba(0, 0, 0, 0.5),
      0 0 80px rgba(122, 162, 247, 0.03);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: iw-up 350ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes iw-up {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ── Header ── */
  .iw__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .iw__head-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .iw__icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(122, 162, 247, 0.1);
    color: var(--color-accent, #7AA2F7);
    flex-shrink: 0;
  }

  .iw__title {
    font-family: var(--font-sans);
    font-size: 15px;
    font-weight: 600;
    color: var(--color-foreground);
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .iw__subtitle {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-placeholder);
    letter-spacing: 0.01em;
  }

  .iw__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    transition: color 150ms, background 150ms;
    &:hover { color: var(--color-foreground); background: rgba(255, 255, 255, 0.06); }
  }

  /* ── Step indicator ── */
  .iw__steps {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 16px 24px 0;
  }

  .iw__step-dot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.2);
    transition: color 150ms ease-out;

    &--active {
      color: var(--color-accent, #7AA2F7);
    }

    &--done {
      color: #9ece6a;
    }
  }

  .iw__step-line {
    width: 48px;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0 4px;
    transition: background 150ms ease-out;

    &--done {
      background: rgba(158, 206, 106, 0.4);
    }
  }

  /* ── Body ── */
  .iw__body {
    padding: 20px 24px 24px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .iw__step {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Step 1: Select ── */
  .iw__step-select {
    align-items: center;
    padding: 24px 0;
    text-align: center;
  }

  .iw__vault-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 88px;
    height: 88px;
    border-radius: 20px;
    background: rgba(122, 162, 247, 0.06);
    border: 1px solid rgba(122, 162, 247, 0.12);
    color: var(--color-accent, #7AA2F7);
    margin-bottom: 8px;
  }

  .iw__step-heading {
    font-family: var(--font-sans);
    font-size: 15px;
    font-weight: 600;
    color: var(--color-foreground);
    letter-spacing: -0.01em;
  }

  .iw__step-desc {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-placeholder);
    line-height: 1.5;
    max-width: 320px;
  }

  .iw__btn--browse {
    margin-top: 8px;
    padding: 12px 32px;
    width: auto;
  }

  /* ── Step 2: Preview ── */
  .iw__scanning {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 40px 0;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-placeholder);
  }

  .iw__vault-name {
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 600;
    color: var(--color-foreground);
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 10px;
  }

  .iw__stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .iw__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 14px 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
  }

  .iw__stat-icon {
    color: var(--color-accent, #7AA2F7);
    opacity: 0.7;
  }

  .iw__stat-value {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--color-foreground);
  }

  .iw__stat-label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-placeholder);
  }

  /* ── Badges ── */
  .iw__badges {
    display: flex;
    gap: 8px;
  }

  .iw__badge {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-placeholder);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;

    &--ok {
      color: #9ece6a;
      background: rgba(158, 206, 106, 0.06);
      border-color: rgba(158, 206, 106, 0.15);
    }
  }

  /* ── Samples ── */
  .iw__samples {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .iw__label-row {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-placeholder);
  }

  .iw__label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-placeholder);
  }

  .iw__sample-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 10px;
  }

  .iw__sample-file {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-muted-foreground);
    padding: 4px 0;

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  /* ── Options ── */
  .iw__options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .iw__option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: all 150ms ease-out;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.1);
    }

    &--selected {
      background: rgba(122, 162, 247, 0.06);
      border-color: rgba(122, 162, 247, 0.2);
    }
  }

  .iw__option-radio {
    color: var(--color-placeholder);
    padding-top: 1px;
    flex-shrink: 0;

    .iw__option--selected & {
      color: var(--color-accent, #7AA2F7);
    }
  }

  .iw__option-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .iw__option-title {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-foreground);
  }

  .iw__option-desc {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-placeholder);
  }

  .iw__input {
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-foreground);
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    outline: none;
    width: 100%;
    transition: border-color 150ms ease-out;

    &:focus { border-color: rgba(122, 162, 247, 0.4); }
    &::placeholder { color: rgba(255, 255, 255, 0.15); }
  }

  /* ── Actions ── */
  .iw__actions {
    display: flex;
    gap: 10px;
    padding-top: 6px;
  }

  .iw__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 0;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease-out;

    &:disabled { opacity: 0.35; cursor: default; pointer-events: none; }
  }

  .iw__btn--primary {
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

  .iw__btn--ghost {
    background: transparent;
    color: var(--color-muted-foreground);
    border: 1px solid rgba(255, 255, 255, 0.08);

    &:hover {
      color: var(--color-foreground);
      border-color: rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.03);
    }
  }

  /* ── Step 3: Progress / Complete ── */
  .iw__importing {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 40px 0;
  }

  .iw__import-text {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-placeholder);
  }

  .iw__success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px 0;
  }

  .iw__success-icon {
    color: #9ece6a;
  }

  .iw__result-stats {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 16px 0;
    width: 100%;
  }

  .iw__result-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .iw__result-value {
    font-family: var(--font-mono);
    font-size: 20px;
    font-weight: 600;
    color: var(--color-foreground);
  }

  .iw__result-label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-placeholder);
  }

  .iw__result-sep {
    width: 1px;
    height: 32px;
    background: rgba(255, 255, 255, 0.06);
  }

  /* ── Error ── */
  .iw__error {
    font-family: var(--font-mono);
    font-size: 11px;
    color: #f7768e;
    line-height: 1.4;
    padding: 8px 12px;
    background: rgba(247, 118, 142, 0.06);
    border: 1px solid rgba(247, 118, 142, 0.15);
    border-radius: 8px;
  }

  /* ── Spinner ── */
  .iw__spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-top-color: var(--color-accent, #7AA2F7);
    border-radius: 50%;
    animation: iw-spin 600ms linear infinite;
  }

  @keyframes iw-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Footer ── */
  .iw__foot {
    padding: 12px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.2);
    text-align: center;
  }

  /* ── Reduced motion ── */
  @media (prefers-reduced-motion: reduce) {
    .iw-backdrop, .iw { animation: none; }
    .iw__spinner { animation: none; }
  }
</style>
