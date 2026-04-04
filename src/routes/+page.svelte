<script lang="ts">
  import { onMount } from 'svelte';

  import HomeView from '../lib/components/home/HomeView.svelte';
  import QuickOpen from '../lib/components/quickopen/QuickOpen.svelte';
  import CommandPalette from '../lib/components/command/CommandPalette.svelte';
  import EditorComponent from '../lib/editor/Editor.svelte';
  import EditorToolbar from '../lib/editor/EditorToolbar.svelte';
  import SaveIndicator from '../lib/editor/SaveIndicator.svelte';
  import type { Command } from '../lib/types/ui';

  import { getUiState } from '../lib/stores/ui.svelte';
  import { getCoreState } from '../lib/stores/core.svelte';
  import { getFilesState } from '../lib/stores/files.svelte';
  import { getEditorState } from '../lib/stores/editor.svelte';
  import { readFile, searchRecent, searchPinned, createFile } from '../lib/bridge/commands';
  import { toast } from '../lib/stores/toast.svelte';
  import { logger } from '../lib/logger';
  import type { FileNode, FileContent } from '../lib/types/core';

  const ui = getUiState();
  const core = getCoreState();
  const files = getFilesState();
  const editorState = getEditorState();

  let fileContent = $state<FileContent | null>(null);
  let recentFiles = $state<FileNode[]>([]);
  let pinnedFiles = $state<FileNode[]>([]);
  let editorRef: EditorComponent | undefined = $state();
  let editorInstance = $state<any>(null);
  let showConflictNotice = $state(false);
  let pendingExternalContent = $state<string | null>(null);

  // Build quick-open items from file map
  let quickOpenItems = $derived(
    Array.from(files.fileMap.values())
      .filter((f) => !f.is_directory)
      .map((f) => ({
        path: f.path,
        name: f.name,
        title: f.title,
        parentPath: f.parent_dir,
      }))
  );

  // Command palette commands
  let commands: Command[] = $derived([
    {
      id: 'new-note',
      label: 'New Note',
      shortcut: '\u2318N',
      action: handleNewNote,
    },
    {
      id: 'open-file',
      label: 'Open File',
      shortcut: '\u2318P',
      action: () => {
        ui.hideCommandPalette();
        ui.showQuickOpen();
      },
    },
    {
      id: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      shortcut: '\u2318B',
      action: () => ui.toggleSidebar(),
    },
    {
      id: 'toggle-right-panel',
      label: 'Toggle Right Panel',
      shortcut: '\u2318\\',
      action: () => ui.toggleRightPanel(),
    },
  ]);

  let isMarkdown = $derived(
    files.activeFilePath?.endsWith('.md') || files.activeFilePath?.endsWith('.markdown')
  );

  // Load file content when active file changes
  $effect(() => {
    const path = files.activeFilePath;
    if (!path) {
      fileContent = null;
      editorState.reset();
      return;
    }

    loadFileContent(path);
  });

  async function loadFileContent(path: string) {
    // Flush any pending editor save before switching
    if (editorRef && editorState.dirty) {
      await editorRef.flush();
    }

    try {
      fileContent = await readFile(path);
      showConflictNotice = false;
      pendingExternalContent = null;
    } catch (err) {
      logger.error(`Failed to read file: ${err}`);
      fileContent = null;
      toast.error(`Failed to open file: ${path}`);
    }
  }

  async function loadRecents() {
    try {
      recentFiles = await searchRecent(8);
    } catch {
      // Expected to fail in browser dev mode
    }
  }

  async function loadPinned() {
    try {
      pinnedFiles = await searchPinned();
    } catch {
      // Expected to fail in browser dev mode
    }
  }

  onMount(() => {
    loadRecents();
    loadPinned();

    // Safety net: flush editor on window close
    const handleBeforeUnload = () => {
      if (editorRef && editorState.dirty) {
        editorRef.flush();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  function handleFileOpen(path: string) {
    files.setActiveFile(path);
    ui.closeAllOverlays();
  }

  async function handleNewNote() {
    ui.closeAllOverlays();
    try {
      const now = new Date();
      const name = `untitled-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.md`;
      const node = await createFile(name, '');
      files.addFile(node);
      files.setActiveFile(node.path);
      toast.success('Note created');
    } catch (err) {
      logger.error(`Failed to create note: ${err}`);
      toast.error('Failed to create note');
    }
  }

  function handleQuickOpenSelect(path: string) {
    handleFileOpen(path);
  }

  function handleWikiLinkNavigate(target: string) {
    // Resolve wiki-link target to a file path
    const match = Array.from(files.fileMap.values()).find((f) => {
      if (f.is_directory) return false;
      const nameWithoutExt = f.name.replace(/\.(md|markdown)$/i, '');
      return nameWithoutExt === target;
    });

    if (match) {
      handleFileOpen(match.path);
    } else {
      toast.info(`Note "${target}" not found`);
    }
  }

  /** Handle external file modification events */
  export function handleExternalChange(path: string, contentHash: string | null) {
    if (path !== files.activeFilePath) return;
    if (editorState.isOwnSave(contentHash)) return;

    if (!editorState.dirty) {
      // Silently reload
      loadFileContent(path);
    } else {
      // Show conflict notice
      showConflictNotice = true;
    }
  }

  function handleConflictReload() {
    showConflictNotice = false;
    if (files.activeFilePath) {
      editorState.setPath(files.activeFilePath);
      loadFileContent(files.activeFilePath);
    }
  }

  function handleConflictKeep() {
    showConflictNotice = false;
  }

  function getFileExtension(path: string): string {
    return path.split('.').pop()?.toLowerCase() ?? '';
  }

  // Poll editor instance for toolbar binding
  function handleEditorMount(e: EditorComponent) {
    editorRef = e;
    // Get editor instance after a tick
    setTimeout(() => {
      editorInstance = editorRef?.getEditor?.() ?? null;
    }, 50);
  }
</script>

{#if files.activeFilePath && fileContent}
  {#if isMarkdown}
    {#if showConflictNotice}
      <div class="conflict-notice">
        <span>File changed externally.</span>
        <button class="conflict-notice__btn" onclick={handleConflictReload}>Reload</button>
        <button class="conflict-notice__btn" onclick={handleConflictKeep}>Keep mine</button>
      </div>
    {/if}

    {#if editorInstance}
      <EditorToolbar editor={editorInstance} />
    {/if}

    <EditorComponent
      path={files.activeFilePath}
      initialContent={fileContent.content}
      onnavigate={handleWikiLinkNavigate}
      bind:this={editorRef}
    />
  {:else}
    <div class="file-view">
      <div class="file-view__info">
        <div class="file-view__info-row">
          <span class="file-view__info-label">Name</span>
          <span class="file-view__info-value">{fileContent.metadata.name}</span>
        </div>
        <div class="file-view__info-row">
          <span class="file-view__info-label">Path</span>
          <span class="file-view__info-value">{fileContent.metadata.path}</span>
        </div>
        <div class="file-view__info-row">
          <span class="file-view__info-label">Size</span>
          <span class="file-view__info-value">{fileContent.metadata.size} bytes</span>
        </div>
        {#if fileContent.metadata.extension}
          <div class="file-view__info-row">
            <span class="file-view__info-label">Extension</span>
            <span class="file-view__info-value">{fileContent.metadata.extension}</span>
          </div>
        {/if}
      </div>
    </div>
  {/if}
{:else}
  <HomeView
    coreName={core.activeCore?.name ?? 'Noctodeus'}
    {recentFiles}
    {pinnedFiles}
    onfileopen={handleFileOpen}
    onnewnote={handleNewNote}
    onquickopen={() => ui.showQuickOpen()}
  />
{/if}

<QuickOpen
  visible={ui.quickOpenVisible}
  items={quickOpenItems}
  onselect={handleQuickOpenSelect}
  onclose={() => ui.hideQuickOpen()}
/>

<CommandPalette
  visible={ui.commandPaletteVisible}
  {commands}
  onclose={() => ui.hideCommandPalette()}
/>

<style>
  .conflict-notice {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    background: var(--color-bg-surface);
    border-bottom: 1px solid var(--color-border-subtle);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .conflict-notice__btn {
    padding: var(--space-1) var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-accent);
    background: transparent;
    border: 1px solid var(--color-accent);
    border-radius: 4px;
    cursor: pointer;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .conflict-notice__btn:hover {
    background: var(--color-bg-hover);
  }

  .file-view {
    height: 100%;
    overflow-y: auto;
    padding: var(--space-6) var(--space-8);
  }

  .file-view__info {
    max-width: 480px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .file-view__info-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-4);
  }

  .file-view__info-label {
    flex-shrink: 0;
    width: 80px;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--text-xs-leading);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .file-view__info-value {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: var(--text-sm-leading);
    color: var(--color-text-primary);
    word-break: break-all;
  }
</style>
