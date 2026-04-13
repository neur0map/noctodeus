<script lang="ts">
  import FileText from '@lucide/svelte/icons/file-text';
  import X from '@lucide/svelte/icons/x';
  import { getResearchState } from '$lib/stores/research.svelte';
  import { getFilesState } from '$lib/stores/files.svelte';
  import { getTabsState } from '$lib/stores/tabs.svelte';
  import type { FileNode } from '$lib/types/core';

  import { onMount } from 'svelte';

  const research = getResearchState();
  const filesState = getFilesState();
  const tabsState = getTabsState();

  // Load saved sessions on mount
  onMount(() => {
    research.loadSessions();
  });

  // --- Input state ---
  let inputValue = $state('');
  let inputEl: HTMLInputElement | undefined = $state();

  // --- Note search mode ---
  let showDropdown = $state(false);
  let dropdownResults = $state<FileNode[]>([]);
  let blurTimeout: ReturnType<typeof setTimeout> | undefined;

  // --- Paste-text mode ---
  let pasteMode = $state(false);
  let pastedContent = $state('');
  let pasteLabel = $state('');
  let pasteLabelEl: HTMLInputElement | undefined = $state();

  // --- "Add all notes" feedback ---
  let addAllFeedback = $state('');
  let addAllTimeout: ReturnType<typeof setTimeout> | undefined;

  // --- Derived ---
  let sourceCount = $derived(research.sources.length);

  // --- Highlight state ---
  let highlightedId = $state<string | null>(null);
  let highlightTimeout: ReturnType<typeof setTimeout> | undefined;

  // --- Expose focus for parent ---
  export function focusInput() {
    inputEl?.focus();
  }

  /** Briefly highlight a source card by its citationId. */
  export function highlightSource(citationId: string) {
    highlightedId = citationId;
    if (highlightTimeout) clearTimeout(highlightTimeout);
    highlightTimeout = setTimeout(() => {
      highlightedId = null;
    }, 1500);
  }

  // --- Helpers ---
  function isUrl(val: string): boolean {
    return val.startsWith('http://') || val.startsWith('https://');
  }

  function shortDate(): string {
    return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  function getMarkdownFiles(): FileNode[] {
    const results: FileNode[] = [];
    for (const file of filesState.fileMap.values()) {
      if (
        !file.is_directory &&
        (file.extension === 'md' || file.extension === 'markdown')
      ) {
        results.push(file);
      }
    }
    return results;
  }

  function filterNotes(query: string): FileNode[] {
    const q = query.toLowerCase();
    const loadedPaths = new Set(
      research.sources.filter((s) => s.type === 'note').map((s) => s.origin),
    );
    const mdFiles = getMarkdownFiles();
    return mdFiles
      .filter((f) => {
        if (loadedPaths.has(f.path)) return false;
        const name = f.name.toLowerCase();
        const title = (f.title ?? '').toLowerCase();
        return name.includes(q) || title.includes(q);
      })
      .slice(0, 15);
  }

  function enterPasteMode(content: string) {
    pasteMode = true;
    pastedContent = content;
    pasteLabel = `Pasted text · ${shortDate()}`;
    requestAnimationFrame(() => {
      pasteLabelEl?.focus();
      pasteLabelEl?.select();
    });
  }

  // --- Input handlers ---
  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      showDropdown = false;
      inputValue = '';
      return;
    }

    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) {
        enterPasteMode(inputValue);
        inputValue = '';
        showDropdown = false;
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const val = inputValue.trim();
      if (!val) return;

      if (isUrl(val)) {
        research.addUrlSource(val);
        inputValue = '';
        showDropdown = false;
        return;
      }

      // If dropdown is visible and has results, select the first one
      if (showDropdown && dropdownResults.length > 0) {
        selectNote(dropdownResults[0]);
        return;
      }

      // If long text, enter paste mode
      if (val.length > 200 || val.includes('\n')) {
        enterPasteMode(val);
        inputValue = '';
        showDropdown = false;
        return;
      }
    }
  }

  function handleInputChange() {
    const val = inputValue.trim();

    if (!val) {
      showDropdown = false;
      dropdownResults = [];
      return;
    }

    if (isUrl(val)) {
      showDropdown = false;
      return;
    }

    if (val.length > 200 || val.includes('\n')) {
      showDropdown = false;
      return;
    }

    // Note search mode
    dropdownResults = filterNotes(val);
    showDropdown = dropdownResults.length > 0;
  }

  function handleInputFocus() {
    if (blurTimeout) clearTimeout(blurTimeout);
    const val = inputValue.trim();
    if (val && !isUrl(val) && val.length <= 200 && !val.includes('\n')) {
      dropdownResults = filterNotes(val);
      showDropdown = dropdownResults.length > 0;
    }
  }

  function handleInputBlur() {
    blurTimeout = setTimeout(() => {
      showDropdown = false;
    }, 150);
  }

  function selectNote(file: FileNode) {
    research.addNoteSource(file.path, file.title || file.name);
    inputValue = '';
    showDropdown = false;
    dropdownResults = [];
    inputEl?.focus();
  }

  // --- Paste label handlers ---
  function handlePasteLabelKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      pasteMode = false;
      // Keep pasted text in main input
      inputValue = pastedContent;
      pastedContent = '';
      pasteLabel = '';
      inputEl?.focus();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const label = pasteLabel.trim() || `Pasted text · ${shortDate()}`;
      research.addTextSource(label, pastedContent);
      pasteMode = false;
      pastedContent = '';
      pasteLabel = '';
      inputValue = '';
      inputEl?.focus();
    }
  }

  // --- Add all notes from active core ---
  function addAllNotes() {
    const mdFiles = getMarkdownFiles();
    const notes = mdFiles.map((f) => ({
      path: f.path,
      title: f.title || f.name,
    }));
    research.addBulkNotes(notes);

    if (addAllTimeout) clearTimeout(addAllTimeout);
    addAllFeedback = `Added ${notes.length} notes`;
    addAllTimeout = setTimeout(() => {
      addAllFeedback = '';
    }, 2000);
  }

  // --- Source card click ---
  async function handleSourceClick(source: typeof research.sources[0]) {
    if (source.type === 'note') {
      const fileNode = filesState.fileMap.get(source.origin);
      if (fileNode) {
        tabsState.openFile(fileNode);
      }
    } else if (source.type === 'url' && source.origin) {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(source.origin);
      } catch {
        window.open(source.origin, '_blank');
      }
    }
  }

  function hostnameFromUrl(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
</script>

<div class="shelf">
  <!-- Source input -->
  <div class="shelf__input-area">
    <input
      class="shelf__input"
      type="text"
      bind:this={inputEl}
      bind:value={inputValue}
      oninput={handleInputChange}
      onkeydown={handleInputKeydown}
      onfocus={handleInputFocus}
      onblur={handleInputBlur}
      placeholder="Add notes, URLs, or paste text..."
    />

    <!-- Note search dropdown -->
    {#if showDropdown}
      <div class="shelf__dropdown">
        {#each dropdownResults as file (file.path)}
          <button
            class="shelf__dropdown-item"
            onmousedown={(e) => { e.preventDefault(); selectNote(file); }}
          >
            <span class="shelf__dropdown-title">{file.title || file.name}</span>
            <span class="shelf__dropdown-path">{file.path}</span>
          </button>
        {/each}
      </div>
    {/if}

    <!-- Paste-text label input -->
    {#if pasteMode}
      <input
        class="shelf__input shelf__input--label"
        type="text"
        bind:this={pasteLabelEl}
        bind:value={pasteLabel}
        onkeydown={handlePasteLabelKeydown}
        placeholder="Name this source:"
      />
    {/if}
  </div>

  <!-- Add all notes link -->
  <button class="shelf__add-all" onclick={addAllNotes}>
    {addAllFeedback || 'Add all notes'}
  </button>

  <!-- Source list -->
  <div class="shelf__list">
    {#if sourceCount > 0}
      <span class="shelf__count">{sourceCount} source{sourceCount !== 1 ? 's' : ''}</span>

      {#each research.sources as source (source.id)}
        <div
          class="shelf__card"
          class:shelf__card--loading={source.loading}
          class:shelf__card--error={!!source.error}
          class:shelf__card--highlight={highlightedId === source.citationId}
          role="button"
          tabindex={0}
          onclick={() => handleSourceClick(source)}
          onkeydown={(e) => { if (e.key === 'Enter') handleSourceClick(source); }}
        >
          <span class="shelf__card-title" class:shelf__card-title--error={!!source.error}>
            {#if source.loading}
              {hostnameFromUrl(source.origin)}
            {:else}
              {source.title}
            {/if}
          </span>
          <span class="shelf__card-badge">{source.type}</span>
          {#if source.error}
            <button
              class="shelf__card-retry"
              onclick={(e) => { e.stopPropagation(); research.retrySource(source.id); }}
            >Retry</button>
          {/if}
          <button
            class="shelf__card-remove"
            onclick={(e) => { e.stopPropagation(); research.removeSource(source.id); }}
            title="Remove source"
          >
            <X size={12} />
          </button>
        </div>
      {/each}

      <!-- Clear all -->
      <div class="shelf__clear-row">
        <button class="shelf__clear" onclick={() => research.clearSources()}>Clear all</button>
      </div>
    {:else}
      <!-- Empty state -->
      <div class="shelf__empty">
        <FileText size={20} />
        <span>Add notes to start researching</span>
      </div>
    {/if}
  </div>

  <!-- Session history -->
  <div class="shelf__sessions">
    <div class="shelf__sessions-header">
      <span class="shelf__sessions-label">Sessions</span>
      {#if research.sessionId}
        <button class="shelf__new-session" onclick={() => research.newSession()}>
          New
        </button>
      {/if}
    </div>
    {#each research.sessions as session (session.id)}
      <button
        class="shelf__session"
        class:shelf__session--active={session.id === research.sessionId}
        onclick={() => research.resumeSession(session.id)}
      >
        <span class="shelf__session-title">{session.title}</span>
        <span class="shelf__session-meta">
          {session.sourceCount}s · {session.messageCount}m
        </span>
      </button>
    {:else}
      <span class="shelf__sessions-empty">No saved sessions</span>
    {/each}
  </div>
</div>

<style lang="scss">
  .shelf {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 16px;
    background: var(--surface-2);
    font-family: var(--font-mono);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  // --- Input area ---
  .shelf__input-area {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
  }

  .shelf__input {
    width: 100%;
    padding: 8px 10px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-foreground);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    outline: none;
    transition: border-color 150ms, box-shadow 150ms;

    &:focus {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 15%, transparent);
    }

    &::placeholder {
      color: var(--color-placeholder);
    }
  }

  .shelf__input--label {
    font-size: 11px;
  }

  // --- Dropdown ---
  .shelf__dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 50;
    max-height: 300px;
    overflow-y: auto;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .shelf__dropdown-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 8px 10px;
    text-align: left;
    font-family: var(--font-mono);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--color-border);
    cursor: pointer;
    transition: background 100ms;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.03);
    }
  }

  .shelf__dropdown-title {
    font-size: 12px;
    color: var(--color-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shelf__dropdown-path {
    font-size: 10px;
    color: var(--color-placeholder);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // --- Add all link ---
  .shelf__add-all {
    display: block;
    margin-bottom: 12px;
    padding: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: color 150ms;

    &:hover {
      color: var(--color-foreground);
    }
  }

  // --- Source list ---
  .shelf__list {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 4px;
    min-height: 0;
  }

  .shelf__count {
    font-size: 10px;
    color: var(--color-placeholder);
    margin-bottom: 4px;
  }

  // --- Source card ---
  .shelf__card {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 100ms;
    animation: fadeSlideIn 150ms ease-out;

    &:hover {
      background: rgba(255, 255, 255, 0.03);

      .shelf__card-remove {
        opacity: 1;
      }
    }

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 15%, transparent);
    }
  }

  .shelf__card--highlight {
    background: color-mix(in srgb, var(--color-accent) 12%, transparent);
    transition: background 300ms ease-out;
  }

  .shelf__card--loading .shelf__card-title {
    animation: pulse 1.5s ease-in-out infinite;
  }

  .shelf__card-title {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: var(--color-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shelf__card-title--error {
    color: var(--color-error);
  }

  .shelf__card-badge {
    flex-shrink: 0;
    font-size: 10px;
    color: var(--color-placeholder);
  }

  .shelf__card-retry {
    flex-shrink: 0;
    padding: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-accent);
    background: none;
    border: none;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  .shelf__card-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    padding: 0;
    color: var(--color-placeholder);
    background: none;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 150ms, color 150ms;

    &:hover {
      color: var(--color-error);
    }
  }

  // --- Clear all ---
  .shelf__clear-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .shelf__clear {
    padding: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 150ms;

    &:hover {
      color: var(--color-foreground);
    }
  }

  // --- Empty state ---
  .shelf__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex: 1;
    color: var(--color-placeholder);
    font-size: 11px;
    text-align: center;
  }

  // --- Animations ---
  @keyframes fadeSlideIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  @media (prefers-reduced-motion: reduce) {
    .shelf__card {
      animation: none;
    }
    .shelf__card--loading .shelf__card-title {
      animation: none;
    }
  }

  // --- Session history ---
  .shelf__sessions {
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--color-border);
  }

  .shelf__sessions-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .shelf__sessions-label {
    font-size: 9px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-placeholder);
  }

  .shelf__new-session {
    padding: 2px 6px;
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-accent, #7aa2f7);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    transition: border-color 150ms;

    &:hover {
      border-color: var(--color-accent, #7aa2f7);
    }
  }

  .shelf__session {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 5px 6px;
    background: none;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: background 120ms;

    &:hover {
      background: rgba(255, 255, 255, 0.03);
    }
  }

  .shelf__session--active {
    background: rgba(122, 162, 247, 0.08);
  }

  .shelf__session-title {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-muted-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .shelf__session:hover .shelf__session-title {
    color: var(--color-foreground);
  }

  .shelf__session--active .shelf__session-title {
    color: var(--color-foreground);
  }

  .shelf__session-meta {
    font-size: 9px;
    color: var(--color-placeholder);
    flex-shrink: 0;
  }

  .shelf__sessions-empty {
    font-size: 10px;
    color: var(--color-placeholder);
    padding: 4px 0;
  }
</style>
