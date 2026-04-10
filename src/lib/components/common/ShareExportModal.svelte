<script lang="ts">
  import { shareNote } from '$lib/bridge/share';
  import { getSettings } from '$lib/stores/settings.svelte';
  import { getFilesState } from '$lib/stores/files.svelte';
  import { getActiveEditorState } from '$lib/stores/active-editor.svelte';
  import { readFile } from '$lib/bridge/commands';
  import { exportPDF, exportDOCX, exportODT, copyAsMarkdown } from '$lib/editor/export';
  import X from '@lucide/svelte/icons/x';
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';
  import FileText from '@lucide/svelte/icons/file-text';
  import FileType from '@lucide/svelte/icons/file-type';
  import FileCode from '@lucide/svelte/icons/file-code';
  import FileDown from '@lucide/svelte/icons/file-down';

  let {
    visible = false,
    onclose,
  }: { visible: boolean; onclose: () => void } = $props();

  const settings = getSettings();
  const files = getFilesState();
  const activeEditor = getActiveEditorState();

  // Closing animation state
  let closing = $state(false);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const CLOSE_MS = 240;

  function dismiss() {
    if (closing) return;
    closing = true;
    closeTimer = setTimeout(() => {
      closing = false;
      closeTimer = undefined;
      onclose();
    }, CLOSE_MS);
  }

  // Reset state whenever modal becomes visible; cancel in-flight close
  $effect(() => {
    if (visible) {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = undefined;
        closing = false;
      }
      shareLink = '';
      shareError = '';
      exportError = '';
      copied = false;
      sharing = false;
      exporting = null;
    }
  });

  // Share state
  let views = $state<1 | 3 | 5 | 10>(1);
  let expireMinutes = $state<number>(60); // 1 hour default
  let sharing = $state(false);
  let shareLink = $state('');
  let shareError = $state('');
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const VIEW_OPTIONS: Array<1 | 3 | 5 | 10> = [1, 3, 5, 10];
  const EXPIRE_OPTIONS: Array<{ label: string; minutes: number }> = [
    { label: '15 min', minutes: 15 },
    { label: '1 hour', minutes: 60 },
    { label: '24 hours', minutes: 60 * 24 },
    { label: '7 days', minutes: 60 * 24 * 7 },
  ];

  async function doGenerate() {
    if (!files.activeFilePath) {
      shareError = 'No active file';
      return;
    }
    sharing = true;
    shareError = '';
    shareLink = '';
    try {
      // Read fresh content from disk — matches legacy share flow
      const { content } = await readFile(files.activeFilePath);
      const link = await shareNote(
        content,
        views,
        expireMinutes,
        null,
        settings.cryptgeonServer,
      );
      shareLink = link;
    } catch (err: any) {
      shareError =
        err?.message ||
        err?.detail ||
        (typeof err === 'string' ? err : JSON.stringify(err));
    } finally {
      sharing = false;
    }
  }

  async function doCopy() {
    if (!shareLink) return;
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(shareLink);
    } catch {
      // Fall back to navigator clipboard (dev-mode browser)
      try {
        await navigator.clipboard.writeText(shareLink);
      } catch {
        // ignore
      }
    }
    copied = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied = false;
    }, 1400);
  }

  // Export state
  type ExportFmt = 'pdf' | 'docx' | 'odt' | 'md';
  let exporting = $state<ExportFmt | null>(null);
  let exportError = $state('');

  function baseName(): string {
    const p = files.activeFilePath;
    if (!p) return 'note';
    const last = p.split('/').pop() ?? 'note';
    return last.replace(/\.(md|markdown|mdx|txt)$/i, '') || 'note';
  }

  async function doExport(fmt: ExportFmt) {
    const editor = activeEditor.handle?.blockNoteEditor;
    if (!editor) {
      exportError = 'No active editor';
      return;
    }
    exporting = fmt;
    exportError = '';
    try {
      const name = baseName();
      if (fmt === 'pdf') await exportPDF(editor, `${name}.pdf`);
      else if (fmt === 'docx') await exportDOCX(editor, `${name}.docx`);
      else if (fmt === 'odt') await exportODT(editor, `${name}.odt`);
      else if (fmt === 'md') await copyAsMarkdown(editor);
    } catch (err: any) {
      // Surface the raw message to the user AND dump the full error to the
      // console so devtools has a stack trace when an export fails.
      console.error('[ShareExport] export failed:', fmt, err);
      const rawMessage =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : JSON.stringify(err);
      // Known failure: react-pdf glyph-positioning error when fonts didn't
      // register properly. Explain what to try.
      if (rawMessage.includes('unsupported number')) {
        exportError =
          'Export failed because the PDF font engine received bad glyph metrics. ' +
          'This usually means Vite pre-bundled the exporter package. Fully ' +
          'restart the dev server (stop and re-run `npm run tauri dev`) so the ' +
          'new optimizeDeps.exclude config takes effect.';
      } else {
        exportError = rawMessage;
      }
    } finally {
      exporting = null;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      dismiss();
    }
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) dismiss();
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="se-backdrop"
    class:se-backdrop--closing={closing}
    onclick={handleBackdrop}
    onkeydown={handleKeydown}
  >
    <div
      class="se"
      class:se--closing={closing}
      role="dialog"
      aria-label="Share and export"
    >
      <!-- Header -->
      <div class="se__head">
        <h3 class="se__title">Share &amp; Export</h3>
        <button class="se__close" onclick={dismiss} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <!-- ── Share section ── -->
      <section class="se__section">
        <div class="se__label">Share · Encrypted Link</div>

        <div class="se__row">
          <div class="se__field">
            <label class="se__field-label" for="se-views">Views</label>
            <select
              id="se-views"
              class="se__select"
              bind:value={views}
              disabled={sharing}
            >
              {#each VIEW_OPTIONS as v}
                <option value={v}>{v}</option>
              {/each}
            </select>
          </div>

          <div class="se__field">
            <label class="se__field-label" for="se-expire">Expires</label>
            <select
              id="se-expire"
              class="se__select"
              bind:value={expireMinutes}
              disabled={sharing}
            >
              {#each EXPIRE_OPTIONS as opt}
                <option value={opt.minutes}>{opt.label}</option>
              {/each}
            </select>
          </div>
        </div>

        {#if !shareLink}
          <button
            class="se__btn se__btn--primary"
            onclick={doGenerate}
            disabled={sharing || !files.activeFilePath}
          >
            {#if sharing}
              <span class="se__spinner"></span>
              Encrypting…
            {:else}
              Generate encrypted link
            {/if}
          </button>
        {:else}
          <div class="se__link-row">
            <input
              class="se__link-input"
              type="text"
              readonly
              value={shareLink}
            />
            <button class="se__btn se__btn--ghost se__copy-btn" onclick={doCopy}>
              {#if copied}
                <Check size={13} />
                Copied
              {:else}
                <Copy size={13} />
                Copy
              {/if}
            </button>
          </div>
          <button class="se__btn se__btn--ghost se__regen" onclick={doGenerate} disabled={sharing}>
            Generate new link
          </button>
        {/if}

        {#if shareError}
          <div class="se__error">{shareError}</div>
        {/if}
      </section>

      <div class="se__divider"></div>

      <!-- ── Export section ── -->
      <section class="se__section">
        <div class="se__label">Export</div>

        <div class="se__grid">
          <button
            class="se__grid-btn"
            onclick={() => doExport('pdf')}
            disabled={exporting !== null}
          >
            {#if exporting === 'pdf'}
              <span class="se__spinner se__spinner--dark"></span>
            {:else}
              <FileText size={15} />
            {/if}
            <span>PDF</span>
          </button>

          <button
            class="se__grid-btn"
            onclick={() => doExport('docx')}
            disabled={exporting !== null}
          >
            {#if exporting === 'docx'}
              <span class="se__spinner se__spinner--dark"></span>
            {:else}
              <FileType size={15} />
            {/if}
            <span>DOCX</span>
          </button>

          <button
            class="se__grid-btn"
            onclick={() => doExport('odt')}
            disabled={exporting !== null}
          >
            {#if exporting === 'odt'}
              <span class="se__spinner se__spinner--dark"></span>
            {:else}
              <FileCode size={15} />
            {/if}
            <span>ODT</span>
          </button>

          <button
            class="se__grid-btn"
            onclick={() => doExport('md')}
            disabled={exporting !== null}
          >
            {#if exporting === 'md'}
              <span class="se__spinner se__spinner--dark"></span>
            {:else}
              <FileDown size={15} />
            {/if}
            <span>Copy Markdown</span>
          </button>
        </div>

        {#if exportError}
          <div class="se__error">{exportError}</div>
        {/if}
      </section>
    </div>
  </div>
{/if}

<style>
  .se-backdrop {
    position: fixed;
    inset: 0;
    z-index: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--background, var(--color-background)) 70%, transparent);
    backdrop-filter: blur(12px) saturate(0.9);
    -webkit-backdrop-filter: blur(12px) saturate(0.9);
    animation: se-backdrop-in 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .se-backdrop--closing {
    animation: se-backdrop-out 240ms cubic-bezier(0.4, 0, 1, 1) forwards;
    pointer-events: none;
  }

  @keyframes se-backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes se-backdrop-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  .se {
    width: min(520px, 92vw);
    background: var(--popover, var(--color-popover));
    color: var(--foreground, var(--color-foreground));
    border: 1px solid color-mix(in srgb, var(--border, var(--color-border)) 70%, transparent);
    border-radius: 12px;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.25),
      0 24px 72px rgba(0, 0, 0, 0.45);
    overflow: hidden;
    font-family: var(--font-sans);
    animation: se-enter 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
    transform-origin: center;
  }

  .se--closing {
    animation: se-exit 240ms cubic-bezier(0.4, 0, 1, 1) forwards;
  }

  @keyframes se-enter {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @keyframes se-exit {
    from {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
    to {
      opacity: 0;
      transform: scale(0.97) translateY(6px);
    }
  }

  /* ── Header ── */
  .se__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 22px 14px;
    border-bottom: 1px solid color-mix(in srgb, var(--border, var(--color-border)) 50%, transparent);
  }

  .se__title {
    margin: 0;
    font-family: var(--font-content, var(--font-sans));
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--foreground, var(--color-foreground));
  }

  .se__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--muted-foreground, var(--color-placeholder));
    cursor: pointer;
    transition:
      color 150ms ease-out,
      background 150ms ease-out,
      transform 120ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .se__close:hover {
    color: var(--foreground, var(--color-foreground));
    background: color-mix(in srgb, var(--foreground, var(--color-foreground)) 6%, transparent);
  }

  .se__close:active {
    transform: scale(0.92);
  }

  /* ── Sections ── */
  .se__section {
    padding: 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .se__label {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted-foreground, var(--color-placeholder));
  }

  .se__divider {
    height: 1px;
    margin: 0 22px;
    background: color-mix(in srgb, var(--border, var(--color-border)) 50%, transparent);
  }

  /* ── Field row ── */
  .se__row {
    display: flex;
    gap: 10px;
  }

  .se__field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .se__field-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted-foreground, var(--color-placeholder));
  }

  .se__select {
    width: 100%;
    padding: 9px 12px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--foreground, var(--color-foreground));
    background: var(--surface-1, var(--card, var(--color-card)));
    border: 1px solid color-mix(in srgb, var(--border, var(--color-border)) 70%, transparent);
    border-radius: 8px;
    outline: none;
    cursor: pointer;
    transition: border-color 150ms ease-out, background 150ms ease-out;
    appearance: none;
    background-image: linear-gradient(45deg, transparent 50%, currentColor 50%),
      linear-gradient(135deg, currentColor 50%, transparent 50%);
    background-position:
      right 13px top 50%,
      right 8px top 50%;
    background-size:
      5px 5px,
      5px 5px;
    background-repeat: no-repeat;
    padding-right: 28px;
  }

  .se__select:hover {
    border-color: color-mix(in srgb, var(--border, var(--color-border)) 100%, transparent);
  }

  .se__select:focus {
    border-color: var(--accent-blue, #7aa2f7);
  }

  .se__select:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* ── Buttons ── */
  .se__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.01em;
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid transparent;
    transition:
      background 150ms ease-out,
      color 150ms ease-out,
      border-color 150ms ease-out,
      filter 150ms ease-out,
      transform 120ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .se__btn:disabled {
    opacity: 0.4;
    cursor: default;
    pointer-events: none;
  }

  .se__btn:active:not(:disabled) {
    transform: scale(0.96);
  }

  .se__btn--primary {
    background: var(--accent-blue, #7aa2f7);
    color: var(--primary-foreground, #0b0d12);
    border-color: transparent;
  }

  .se__btn--primary:hover {
    filter: brightness(1.08);
  }

  .se__btn--ghost {
    background: transparent;
    color: var(--muted-foreground, var(--color-placeholder));
    border-color: color-mix(in srgb, var(--border, var(--color-border)) 70%, transparent);
  }

  .se__btn--ghost:hover {
    color: var(--foreground, var(--color-foreground));
    background: color-mix(in srgb, var(--foreground, var(--color-foreground)) 5%, transparent);
    border-color: var(--border, var(--color-border));
  }

  .se__regen {
    align-self: flex-start;
    padding: 7px 11px;
    font-size: 11px;
  }

  /* ── Link row ── */
  .se__link-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }

  .se__link-input {
    flex: 1;
    min-width: 0;
    padding: 10px 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--foreground, var(--color-foreground));
    background: var(--surface-1, var(--card, var(--color-card)));
    border: 1px solid color-mix(in srgb, var(--border, var(--color-border)) 70%, transparent);
    border-radius: 8px;
    outline: none;
    text-overflow: ellipsis;
  }

  .se__link-input:focus {
    border-color: var(--accent-blue, #7aa2f7);
  }

  .se__copy-btn {
    flex-shrink: 0;
  }

  /* ── Export grid ── */
  .se__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .se__grid-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 12px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--foreground, var(--color-foreground));
    background: var(--surface-1, var(--card, var(--color-card)));
    border: 1px solid color-mix(in srgb, var(--border, var(--color-border)) 70%, transparent);
    border-radius: 8px;
    cursor: pointer;
    transition:
      background 150ms ease-out,
      color 150ms ease-out,
      border-color 150ms ease-out,
      transform 120ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .se__grid-btn:hover:not(:disabled) {
    border-color: var(--border, var(--color-border));
    background: color-mix(in srgb, var(--foreground, var(--color-foreground)) 5%, transparent);
  }

  .se__grid-btn:active:not(:disabled) {
    transform: scale(0.96);
  }

  .se__grid-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* ── Spinner ── */
  .se__spinner {
    width: 12px;
    height: 12px;
    border: 2px solid color-mix(in srgb, var(--primary-foreground, #0b0d12) 30%, transparent);
    border-top-color: var(--primary-foreground, #0b0d12);
    border-radius: 50%;
    animation: se-spin 600ms linear infinite;
    flex-shrink: 0;
  }

  .se__spinner--dark {
    border: 2px solid color-mix(in srgb, var(--foreground, var(--color-foreground)) 20%, transparent);
    border-top-color: var(--foreground, var(--color-foreground));
  }

  @keyframes se-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Error ── */
  .se__error {
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.5;
    color: var(--accent-red, #f7768e);
    padding: 8px 12px;
    background: color-mix(in srgb, var(--accent-red, #f7768e) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-red, #f7768e) 20%, transparent);
    border-radius: 6px;
    word-break: break-word;
  }

  @media (prefers-reduced-motion: reduce) {
    .se-backdrop,
    .se,
    .se__spinner {
      animation: none;
    }
  }
</style>
