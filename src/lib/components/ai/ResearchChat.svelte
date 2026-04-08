<script lang="ts">
  import { tick } from 'svelte';
  import { getResearchState } from '$lib/stores/research.svelte';
  import { getSettings } from '$lib/stores/settings.svelte';
  import { getUiState } from '$lib/stores/ui.svelte';
  import { getFilesState } from '$lib/stores/files.svelte';
  import ChatMessage from './ChatMessage.svelte';
  import ChatInput from './ChatInput.svelte';
  import X from '@lucide/svelte/icons/x';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Search from '@lucide/svelte/icons/search';
  import FileText from '@lucide/svelte/icons/file-text';
  import Settings from '@lucide/svelte/icons/settings';

  const research = getResearchState();
  const settings = getSettings();
  const ui = getUiState();
  const filesState = getFilesState();

  let scrollEl: HTMLDivElement | undefined = $state();
  let pickerOpen = $state(false);
  let pickerQuery = $state('');
  let pickerInputEl: HTMLInputElement | undefined = $state();

  let isConfigured = $derived(
    !!(settings.aiApiKey && settings.aiBaseUrl && settings.aiModel)
  );

  let modelLabel = $derived(() => {
    const model = settings.aiModel;
    if (!model) return 'No model';
    return model.length > 28 ? model.slice(0, 26) + '...' : model;
  });

  // All markdown files available to add as sources
  let availableNotes = $derived(() => {
    const loaded = new Set(research.sources.map(s => s.path));
    return Array.from(filesState.fileMap.values())
      .filter(f => !f.is_directory && (f.extension === 'md' || f.extension === 'markdown'))
      .filter(f => !loaded.has(f.path))
      .sort((a, b) => b.modified_at - a.modified_at);
  });

  // Filtered by picker search
  let filteredNotes = $derived(() => {
    const notes = availableNotes();
    if (!pickerQuery.trim()) return notes.slice(0, 20);
    const q = pickerQuery.toLowerCase();
    return notes
      .filter(f => {
        const name = f.name.toLowerCase();
        const title = (f.title ?? '').toLowerCase();
        return name.includes(q) || title.includes(q);
      })
      .slice(0, 20);
  });

  // Auto-scroll to bottom when messages change
  $effect(() => {
    const _len = research.messages.length;
    const _streaming = research.streaming;
    tick().then(() => {
      if (scrollEl) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
    });
  });

  // Sync provider from settings
  $effect(() => {
    const apiKey = settings.aiApiKey;
    const baseUrl = settings.aiBaseUrl;
    const model = settings.aiModel;
    const id = settings.aiProviderId;
    if (apiKey && baseUrl && model) {
      research.setProvider({
        id: id || 'custom',
        name: 'Custom',
        baseUrl,
        apiKey,
        model,
      });
    }
  });

  // Focus picker input when opened
  $effect(() => {
    if (pickerOpen) {
      tick().then(() => pickerInputEl?.focus());
    }
  });

  async function handleSend(text: string) {
    await research.send(text);
  }

  function openPicker() {
    pickerQuery = '';
    pickerOpen = true;
  }

  function closePicker() {
    pickerOpen = false;
    pickerQuery = '';
  }

  async function addNote(path: string) {
    await research.addSource(path);
    // Keep picker open for multi-add
  }

  function removeSource(path: string) {
    research.removeSource(path);
  }

  function handlePickerKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePicker();
    }
  }

  function openSettings() {
    ui.showSettings();
  }
</script>

<div class="rc">
  <!-- Left column: Sources -->
  <aside class="rc__sources">
    <div class="rc__sources-head">
      <span class="rc__sources-label">Sources</span>
      {#if research.sources.length > 0}
        <span class="rc__sources-count">{research.sources.length}</span>
      {/if}
    </div>

    <div class="rc__sources-list">
      {#if research.sources.length === 0}
        <div class="rc__sources-empty">
          <FileText size={20} />
          <p>Add notes to start researching</p>
        </div>
      {:else}
        {#each research.sources as src (src.path)}
          <div class="rc__source-card">
            <div class="rc__source-dot"></div>
            <div class="rc__source-info">
              <span class="rc__source-title" title={src.path}>{src.title}</span>
              <span class="rc__source-preview">{src.preview || 'Empty note'}</span>
            </div>
            <button
              class="rc__source-remove"
              onclick={() => removeSource(src.path)}
              title="Remove source"
            >
              <X size={12} />
            </button>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Add notes button / picker -->
    <div class="rc__sources-footer">
      {#if pickerOpen}
        <div class="rc__picker">
          <div class="rc__picker-search">
            <Search size={12} />
            <input
              bind:this={pickerInputEl}
              bind:value={pickerQuery}
              onkeydown={handlePickerKeydown}
              class="rc__picker-input"
              type="text"
              placeholder="Search notes..."
              spellcheck="false"
            />
            <button class="rc__picker-close" onclick={closePicker}>
              <X size={12} />
            </button>
          </div>
          <div class="rc__picker-list">
            {#each filteredNotes() as note (note.path)}
              <button class="rc__picker-item" onclick={() => addNote(note.path)}>
                <span class="rc__picker-item-title">{note.title || note.name}</span>
                <span class="rc__picker-item-path">{note.path}</span>
              </button>
            {:else}
              <div class="rc__picker-empty">No notes found</div>
            {/each}
          </div>
        </div>
      {:else}
        <button class="rc__add-btn" onclick={openPicker}>
          <Plus size={13} />
          <span>Add notes</span>
        </button>
      {/if}
    </div>
  </aside>

  <!-- Right column: Chat -->
  <div class="rc__chat">
    <!-- Header -->
    <div class="rc__head">
      <div class="rc__head-left">
        <div class="rc__head-icon">
          <BookOpen size={14} />
        </div>
        <div class="rc__head-info">
          <span class="rc__head-title">Research</span>
          <span class="rc__head-model">{modelLabel()}</span>
        </div>
      </div>
      <div class="rc__head-actions">
        {#if research.sources.length > 0}
          <span class="rc__source-badge">
            {research.sources.length} source{research.sources.length !== 1 ? 's' : ''}
          </span>
        {/if}
        {#if research.messages.length > 0}
          <button class="rc__head-btn" onclick={() => research.clear()} title="Clear conversation">
            <Trash2 size={13} />
          </button>
        {/if}
        <button class="rc__head-btn" onclick={() => ui.hideResearch()} title="Close research">
          <X size={14} />
        </button>
      </div>
    </div>

    <!-- Messages area -->
    <div class="rc__messages" bind:this={scrollEl} role="list">
      {#if !isConfigured}
        <div class="rc__empty">
          <div class="rc__empty-icon">
            <Settings size={24} />
          </div>
          <p class="rc__empty-title">Configure an AI provider</p>
          <p class="rc__empty-desc">Add an API key and provider in Settings to start researching.</p>
          <button class="rc__empty-btn" onclick={openSettings}>
            Open Settings
          </button>
        </div>
      {:else if research.messages.length === 0}
        <div class="rc__empty">
          <div class="rc__empty-icon rc__empty-icon--accent">
            <BookOpen size={24} />
          </div>
          <p class="rc__empty-title">Research workspace</p>
          <p class="rc__empty-desc">
            {#if research.sources.length === 0}
              Add notes as sources, then ask questions about their content.
            {:else}
              {research.sources.length} note{research.sources.length !== 1 ? 's' : ''} loaded. Ask a question to begin analysis.
            {/if}
          </p>
        </div>
      {:else}
        {#each research.messages as msg, i (i)}
          <div class="rc__message-wrap">
            <ChatMessage message={msg} />
          </div>
        {/each}
        {#if research.error}
          <div class="rc__error">{research.error}</div>
        {/if}
      {/if}
    </div>

    <!-- Input -->
    {#if isConfigured}
      <div class="rc__input-wrap">
        <ChatInput
          streaming={research.streaming}
          onsend={handleSend}
          onstop={() => research.cancel()}
        />
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .rc {
    display: flex;
    height: 100%;
    background: var(--color-background);
  }

  /* ── Left column: Sources ── */
  .rc__sources {
    display: flex;
    flex-direction: column;
    width: 280px;
    flex-shrink: 0;
    background: var(--surface-1, var(--color-card));
    border-right: 1px solid var(--color-border);
    animation: rc-slide-left 350ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes rc-slide-left {
    from { opacity: 0; transform: translateX(-12px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .rc__sources-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .rc__sources-label {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-placeholder);
  }

  .rc__sources-count {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    color: #9ece6a;
    background: rgba(158, 206, 106, 0.1);
    border-radius: 4px;
  }

  .rc__sources-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .rc__sources-list::-webkit-scrollbar {
    width: 3px;
  }

  .rc__sources-list::-webkit-scrollbar-thumb {
    background: var(--color-hover);
    border-radius: 2px;
  }

  .rc__sources-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 100%;
    color: var(--color-placeholder);
    text-align: center;
    padding: 24px;
    animation: rc-fade-up 400ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both;

    p {
      font-family: var(--font-sans);
      font-size: 12px;
      line-height: 1.5;
      margin: 0;
      color: var(--color-placeholder);
    }
  }

  /* ── Source cards ── */
  .rc__source-card {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 10px;
    margin-bottom: 4px;
    background: var(--color-hover);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    transition: background 150ms, border-color 150ms, transform 150ms;
    animation: rc-card-in 300ms cubic-bezier(0.16, 1, 0.3, 1) both;

    &:hover {
      background: var(--color-hover);
      border-color: var(--color-border);
      transform: translateX(2px);
    }

    &:hover .rc__source-remove {
      opacity: 1;
    }
  }

  .rc__source-dot {
    width: 6px;
    height: 6px;
    margin-top: 5px;
    border-radius: 50%;
    background: #9ece6a;
    flex-shrink: 0;
  }

  .rc__source-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rc__source-title {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rc__source-preview {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4;
  }

  .rc__source-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 150ms, color 150ms, background 150ms;

    &:hover {
      color: #f7768e;
      background: rgba(247, 118, 142, 0.1);
    }
  }

  /* ── Sources footer ── */
  .rc__sources-footer {
    flex-shrink: 0;
    padding: 8px;
    border-top: 1px solid var(--color-border);
  }

  .rc__add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 8px;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-accent, #7AA2F7);
    background: rgba(122, 162, 247, 0.06);
    border: 1px dashed var(--color-accent);
    border-radius: 4px;
    cursor: pointer;
    transition: background 150ms, border-color 150ms;

    &:hover {
      background: rgba(122, 162, 247, 0.12);
      border-color: rgba(122, 162, 247, 0.35);
    }
  }

  /* ── Picker ── */
  .rc__picker {
    display: flex;
    flex-direction: column;
    max-height: 320px;
    background: var(--surface-2, var(--color-popover));
    border: 1px solid var(--color-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .rc__picker-search {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-placeholder);
  }

  .rc__picker-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-foreground);

    &::placeholder {
      color: var(--color-placeholder);
    }
  }

  .rc__picker-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;

    &:hover {
      color: var(--color-foreground);
      background: var(--color-hover);
    }
  }

  .rc__picker-list {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .rc__picker-list::-webkit-scrollbar {
    width: 3px;
  }

  .rc__picker-list::-webkit-scrollbar-thumb {
    background: var(--color-hover);
    border-radius: 2px;
  }

  .rc__picker-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    padding: 7px 10px;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 100ms;

    &:hover {
      background: var(--color-hover);
    }
  }

  .rc__picker-item-title {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--color-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rc__picker-item-path {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rc__picker-empty {
    padding: 16px;
    text-align: center;
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--color-placeholder);
  }

  /* ── Right column: Chat ── */
  .rc__chat {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--color-background);
    animation: rc-slide-right 400ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both;
  }

  @keyframes rc-slide-right {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes rc-card-in {
    from { opacity: 0; transform: translateX(-6px); }
    to { opacity: 1; transform: translateX(0); }
  }

  /* ── Header ── */
  .rc__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    animation: rc-fade-up 300ms cubic-bezier(0.16, 1, 0.3, 1) 100ms both;
  }

  .rc__head-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .rc__head-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(122, 162, 247, 0.1);
    color: var(--color-accent, #7AA2F7);
    flex-shrink: 0;
  }

  .rc__head-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .rc__head-title {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 600;
    color: var(--color-foreground);
    letter-spacing: -0.01em;
  }

  .rc__head-model {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rc__head-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .rc__source-badge {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: #9ece6a;
    background: rgba(158, 206, 106, 0.08);
    border-radius: 4px;
  }

  .rc__head-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    transition: color 150ms, background 150ms;

    &:hover {
      color: var(--color-foreground);
      background: var(--color-hover);
    }
  }

  /* ── Messages ── */
  .rc__messages {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .rc__messages::-webkit-scrollbar {
    width: 4px;
  }

  .rc__messages::-webkit-scrollbar-thumb {
    background: var(--color-hover);
    border-radius: 2px;
  }

  .rc__message-wrap {
    max-width: 720px;
    margin: 0 auto;
    padding: 0 24px;
  }

  /* ── Empty state ── */
  .rc__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 40px 32px;
    text-align: center;
    gap: 12px;
    animation: rc-fade-up 450ms cubic-bezier(0.16, 1, 0.3, 1) 200ms both;
  }

  @keyframes rc-fade-up {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .rc__empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 6px;
    background: var(--color-hover);
    color: var(--color-placeholder);
    margin-bottom: 4px;
  }

  .rc__empty-icon--accent {
    background: rgba(122, 162, 247, 0.08);
    color: var(--color-accent, #7AA2F7);
  }

  .rc__empty-title {
    font-family: var(--font-sans);
    font-size: 15px;
    font-weight: 600;
    color: var(--color-foreground);
    letter-spacing: -0.01em;
    margin: 0;
  }

  .rc__empty-desc {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--color-placeholder);
    line-height: 1.5;
    max-width: 300px;
    margin: 0;
  }

  .rc__empty-btn {
    margin-top: 8px;
    padding: 8px 16px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-accent, #7AA2F7);
    background: rgba(122, 162, 247, 0.1);
    border: 1px solid rgba(122, 162, 247, 0.2);
    border-radius: 6px;
    cursor: pointer;
    transition: background 150ms, border-color 150ms;

    &:hover {
      background: rgba(122, 162, 247, 0.18);
      border-color: rgba(122, 162, 247, 0.35);
    }
  }

  /* ── Error ── */
  .rc__error {
    max-width: 720px;
    margin: 8px auto;
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: #f7768e;
    line-height: 1.4;
    background: rgba(247, 118, 142, 0.06);
    border: 1px solid rgba(247, 118, 142, 0.15);
    border-radius: 6px;
  }

  /* ── Input ── */
  .rc__input-wrap {
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
    padding: 0 24px;
  }

  @media (prefers-reduced-motion: reduce) {
    .rc, .rc__sources, .rc__chat, .rc__head,
    .rc__source-card, .rc__sources-empty, .rc__empty { animation: none; }
  }
</style>
