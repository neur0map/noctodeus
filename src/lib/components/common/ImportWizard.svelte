<script lang="ts">
  import { importScan, importObsidian } from '$lib/bridge/import';
  import type { VaultScan, ImportResult } from '$lib/bridge/import';
  import { getCoreState } from '$lib/stores/core.svelte';

  import X from '@lucide/svelte/icons/x';
  import FileText from '@lucide/svelte/icons/file-text';
  import Image from '@lucide/svelte/icons/image';
  import FolderClosed from '@lucide/svelte/icons/folder-closed';
  import HardDrive from '@lucide/svelte/icons/hard-drive';
  import Check from '@lucide/svelte/icons/check';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import CircleCheck from '@lucide/svelte/icons/circle-check';

  let {
    visible = false,
    onclose,
  }: {
    visible: boolean;
    onclose: () => void;
  } = $props();

  const core = getCoreState();

  let step = $state(1);
  let vaultPath = $state<string | null>(null);
  let scan = $state<VaultScan | null>(null);
  let scanning = $state(false);
  let scanError = $state<string | null>(null);
  let createNewCore = $state(true);
  let coreName = $state('');
  let importing = $state(false);
  let importError = $state<string | null>(null);
  let result = $state<ImportResult | null>(null);

  let hasActiveCore = $derived(core.activeCore !== null);

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function resetWizard() {
    step = 1; vaultPath = null; scan = null; scanning = false;
    scanError = null; createNewCore = true; coreName = '';
    importing = false; importError = null; result = null;
  }

  function handleClose() { resetWizard(); onclose(); }

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
      } catch (err) { scanError = String(err); }
      scanning = false;
    } catch (err) { scanError = String(err); }
  }

  async function handleImport() {
    if (!vaultPath) return;
    importing = true;
    importError = null;
    step = 3;
    try {
      const targetPath = createNewCore ? '' : (core.activeCore?.path ?? '');
      result = await importObsidian(vaultPath, targetPath, createNewCore, createNewCore ? coreName || null : null);
    } catch (err) { importError = String(err); }
    importing = false;
  }

  async function handleOpenCore() {
    if (!result || !createNewCore || !coreName) { handleClose(); return; }
    try {
      const { openCore, scanCore } = await import('$lib/bridge/commands');
      const { getFilesState } = await import('$lib/stores/files.svelte');
      const coreInfo = await openCore(coreName);
      core.setCore(coreInfo);
      const fileTree = await scanCore();
      getFilesState().setFiles(fileTree);
    } catch (err) {
      const { toast } = await import('$lib/stores/toast.svelte');
      toast.error(`Failed to open core: ${err}`);
    }
    handleClose();
  }

  function handleKeydown(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); handleClose(); } }
  function handleBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) handleClose(); }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="imp-bg" onclick={handleBackdrop} onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="imp" onkeydown={handleKeydown}>

      <!-- Top bar: step + close -->
      <div class="imp__bar">
        <div class="imp__progress">
          {#each [1, 2, 3] as s}
            <div class="imp__dot" class:imp__dot--now={step === s} class:imp__dot--done={step > s}></div>
          {/each}
        </div>
        <button class="imp__x" onclick={handleClose}><X size={14} /></button>
      </div>

      <!-- STEP 1: Pick folder -->
      {#if step === 1}
        <div class="imp__center">
          <div class="imp__drop" onclick={handleBrowse} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && handleBrowse()}>
            <FolderOpen size={28} strokeWidth={1.5} />
            <span class="imp__drop-text">Drop an Obsidian vault here or click to browse</span>
            <span class="imp__drop-hint">Select the root folder that contains your .obsidian directory</span>
          </div>
        </div>

      <!-- STEP 2: Preview -->
      {:else if step === 2}
        <div class="imp__scroll">
          {#if scanning}
            <div class="imp__loading">
              <div class="imp__pulse"></div>
              <span>Scanning vault...</span>
            </div>
          {:else if scanError}
            <div class="imp__err">{scanError}</div>
            <button class="imp__link" onclick={() => { step = 1; scanError = null; }}>
              <ArrowLeft size={12} /> Try again
            </button>
          {:else if scan}
            <div class="imp__vault-header">
              <span class="imp__vault-name">{scan.name}</span>
              <span class="imp__vault-path">{vaultPath}</span>
            </div>

            <div class="imp__grid">
              <div class="imp__cell">
                <FileText size={15} class="imp__cell-ico" />
                <span class="imp__cell-num">{scan.markdownCount}</span>
                <span class="imp__cell-lbl">notes</span>
              </div>
              <div class="imp__cell">
                <Image size={15} class="imp__cell-ico" />
                <span class="imp__cell-num">{scan.mediaCount}</span>
                <span class="imp__cell-lbl">media</span>
              </div>
              <div class="imp__cell">
                <FolderClosed size={15} class="imp__cell-ico" />
                <span class="imp__cell-num">{scan.folderCount}</span>
                <span class="imp__cell-lbl">folders</span>
              </div>
              <div class="imp__cell">
                <HardDrive size={15} class="imp__cell-ico" />
                <span class="imp__cell-num">{formatBytes(scan.totalSizeBytes)}</span>
                <span class="imp__cell-lbl">total</span>
              </div>
            </div>

            <div class="imp__tags">
              {#if scan.hasWikiLinks}
                <span class="imp__tag imp__tag--ok"><Check size={11} /> Wiki-links</span>
              {/if}
              {#if scan.hasFrontmatter}
                <span class="imp__tag imp__tag--ok"><Check size={11} /> Frontmatter</span>
              {/if}
              {#if scan.mediaCount > 0}
                <span class="imp__tag imp__tag--ok"><Check size={11} /> Attachments</span>
              {/if}
            </div>

            {#if scan.sampleFiles.length > 0}
              <div class="imp__files">
                {#each scan.sampleFiles.slice(0, 4) as f}
                  <span class="imp__file"><FileText size={11} /> {f}</span>
                {/each}
                {#if scan.markdownCount > 4}
                  <span class="imp__file imp__file--more">and {scan.markdownCount - 4} more</span>
                {/if}
              </div>
            {/if}

            <div class="imp__dest">
              <button class="imp__dest-opt" class:imp__dest-opt--on={createNewCore} onclick={() => { createNewCore = true; }}>
                <span class="imp__radio" class:imp__radio--on={createNewCore}></span>
                <span>New core</span>
                {#if createNewCore}
                  <input class="imp__name" type="text" placeholder="Core name" bind:value={coreName} onfocus={() => { createNewCore = true; }} />
                {/if}
              </button>
              {#if hasActiveCore}
                <button class="imp__dest-opt" class:imp__dest-opt--on={!createNewCore} onclick={() => { createNewCore = false; }}>
                  <span class="imp__radio" class:imp__radio--on={!createNewCore}></span>
                  <span>Into "{core.activeCore?.name}"</span>
                </button>
              {/if}
            </div>

            <div class="imp__row">
              <button class="imp__back" onclick={() => { step = 1; }}>
                <ArrowLeft size={13} /> Back
              </button>
              <button class="imp__go" onclick={handleImport} disabled={createNewCore && !coreName.trim()}>
                Import {scan.markdownCount} notes <ArrowRight size={13} />
              </button>
            </div>
          {/if}
        </div>

      <!-- STEP 3: Progress / Done -->
      {:else if step === 3}
        <div class="imp__center">
          {#if importing}
            <div class="imp__loading">
              <div class="imp__pulse"></div>
              <span>Importing files...</span>
            </div>
          {:else if importError}
            <div class="imp__err">{importError}</div>
            <button class="imp__link" onclick={() => { step = 2; importError = null; }}>
              <ArrowLeft size={12} /> Go back
            </button>
          {:else if result}
            <div class="imp__done">
              <CircleCheck size={36} strokeWidth={1.5} />
              <span class="imp__done-title">Done</span>
              <div class="imp__done-stats">
                <span><strong>{result.filesImported}</strong> imported</span>
                <span class="imp__done-dot"></span>
                <span><strong>{result.foldersCreated}</strong> folders</span>
                {#if result.skipped > 0}
                  <span class="imp__done-dot"></span>
                  <span><strong>{result.skipped}</strong> skipped</span>
                {/if}
              </div>
            </div>
            <div class="imp__row imp__row--center">
              {#if createNewCore}
                <button class="imp__go" onclick={handleOpenCore}>Open Core</button>
              {/if}
              <button class="imp__back" onclick={handleClose}>Close</button>
            </div>
          {/if}
        </div>
      {/if}

      <div class="imp__foot">Your files stay on your machine.</div>
    </div>
  </div>
{/if}

<style lang="scss">
  .imp-bg {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(16px);
    z-index: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: imp-in 180ms ease both;
  }
  @keyframes imp-in { from { opacity: 0; } }

  .imp {
    width: min(500px, 90vw);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    background: #0e0f14;
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 14px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    overflow: hidden;
    animation: imp-up 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes imp-up {
    from { opacity: 0; transform: translateY(16px) scale(0.96); }
  }

  .imp__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
  }

  .imp__progress {
    display: flex;
    gap: 6px;
  }

  .imp__dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    transition: all 200ms;
    &--now { background: var(--color-accent, #7AA2F7); box-shadow: 0 0 8px rgba(122,162,247,0.4); }
    &--done { background: #9ece6a; }
  }

  .imp__x {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    border: none; border-radius: 6px;
    background: transparent; color: rgba(255,255,255,0.25);
    cursor: pointer;
    &:hover { color: var(--color-foreground); background: rgba(255,255,255,0.06); }
  }

  /* ── Step 1: Drop zone ── */
  .imp__center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    gap: 16px;
  }

  .imp__drop {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 32px;
    width: 100%;
    border: 1.5px dashed rgba(255,255,255,0.08);
    border-radius: 12px;
    color: rgba(255,255,255,0.3);
    cursor: pointer;
    transition: all 200ms;
    &:hover {
      border-color: rgba(122,162,247,0.3);
      color: rgba(255,255,255,0.5);
      background: rgba(122,162,247,0.03);
    }
  }

  .imp__drop-text {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-foreground);
  }

  .imp__drop-hint {
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(255,255,255,0.2);
  }

  /* ── Step 2: Preview ── */
  .imp__scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .imp__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 48px 0;
    font-family: var(--font-mono);
    font-size: 12px;
    color: rgba(255,255,255,0.3);
  }

  .imp__pulse {
    width: 16px; height: 16px;
    border-radius: 50%;
    background: var(--color-accent, #7AA2F7);
    animation: imp-pulse 1s ease-in-out infinite alternate;
  }
  @keyframes imp-pulse {
    from { opacity: 0.3; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1.2); }
  }

  .imp__vault-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .imp__vault-name {
    font-family: var(--font-sans);
    font-size: 16px;
    font-weight: 600;
    color: var(--color-foreground);
    letter-spacing: -0.02em;
  }

  .imp__vault-path {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255,255,255,0.15);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .imp__grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .imp__cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 12px 4px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 8px;
  }

  .imp__cell :global(.imp__cell-ico) { color: rgba(255,255,255,0.2); }

  .imp__cell-num {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--color-foreground);
  }

  .imp__cell-lbl {
    font-family: var(--font-mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255,255,255,0.2);
  }

  .imp__tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .imp__tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-family: var(--font-mono);
    font-size: 10px;
    border-radius: 4px;
    color: rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.02);
    &--ok {
      color: #9ece6a;
      background: rgba(158,206,106,0.06);
    }
  }

  .imp__files {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 8px 12px;
    background: rgba(0,0,0,0.3);
    border-radius: 8px;
  }

  .imp__file {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(255,255,255,0.35);
    padding: 3px 0;
    &--more { color: rgba(255,255,255,0.15); font-style: italic; padding-left: 17px; }
  }

  .imp__dest {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .imp__dest-opt {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    width: 100%;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 8px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-muted-foreground);
    text-align: left;
    transition: all 150ms;
    &:hover { border-color: rgba(255,255,255,0.08); }
    &--on {
      border-color: rgba(122,162,247,0.25);
      background: rgba(122,162,247,0.04);
      color: var(--color-foreground);
    }
  }

  .imp__radio {
    width: 12px; height: 12px;
    border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,0.15);
    flex-shrink: 0;
    transition: all 150ms;
    &--on {
      border-color: var(--color-accent);
      background: var(--color-accent);
      box-shadow: inset 0 0 0 2px #0e0f14;
    }
  }

  .imp__name {
    flex: 1;
    margin-left: auto;
    padding: 4px 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-foreground);
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 4px;
    outline: none;
    max-width: 180px;
    &:focus { border-color: rgba(122,162,247,0.3); }
    &::placeholder { color: rgba(255,255,255,0.12); }
  }

  .imp__row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    &--center { justify-content: center; }
  }

  .imp__back {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 14px;
    font-family: var(--font-mono); font-size: 11px;
    color: rgba(255,255,255,0.3);
    background: transparent; border: none; border-radius: 6px;
    cursor: pointer;
    &:hover { color: var(--color-foreground); }
  }

  .imp__go {
    display: flex; align-items: center; gap: 6px;
    padding: 9px 18px;
    font-family: var(--font-mono); font-size: 12px; font-weight: 500;
    color: #fff;
    background: var(--color-accent, #7AA2F7);
    border: none; border-radius: 8px;
    cursor: pointer;
    transition: filter 150ms;
    &:hover { filter: brightness(1.15); }
    &:disabled { opacity: 0.3; cursor: default; }
  }

  .imp__link {
    display: inline-flex; align-items: center; gap: 5px;
    font-family: var(--font-mono); font-size: 11px;
    color: var(--color-accent); background: none; border: none;
    cursor: pointer;
    &:hover { text-decoration: underline; }
  }

  .imp__err {
    font-family: var(--font-mono); font-size: 11px;
    color: #f7768e; line-height: 1.4;
    padding: 10px 14px;
    background: rgba(247,118,142,0.05);
    border: 1px solid rgba(247,118,142,0.12);
    border-radius: 8px;
  }

  /* ── Step 3: Done ── */
  .imp__done {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #9ece6a;
  }

  .imp__done-title {
    font-family: var(--font-sans);
    font-size: 18px;
    font-weight: 600;
    color: var(--color-foreground);
  }

  .imp__done-stats {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    strong { color: var(--color-foreground); font-weight: 600; }
  }

  .imp__done-dot {
    width: 3px; height: 3px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
  }

  .imp__foot {
    padding: 10px 18px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255,255,255,0.12);
    text-align: center;
    border-top: 1px solid rgba(255,255,255,0.03);
  }

  @media (prefers-reduced-motion: reduce) {
    .imp-bg, .imp { animation: none; }
    .imp__pulse { animation: none; }
  }
</style>
