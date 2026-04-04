<script lang="ts">
  import { onMount } from 'svelte';

  import HomeView from '../lib/components/home/HomeView.svelte';
  import QuickOpen from '../lib/components/quickopen/QuickOpen.svelte';
  import CommandPalette from '../lib/components/command/CommandPalette.svelte';
  import type { Command } from '../lib/types/ui';

  import { getUiState } from '../lib/stores/ui.svelte';
  import { getCoreState } from '../lib/stores/core.svelte';
  import { getFilesState } from '../lib/stores/files.svelte';
  import { readFile, searchRecent, searchPinned, createFile } from '../lib/bridge/commands';
  import { toast } from '../lib/stores/toast.svelte';
  import { logger } from '../lib/logger';
  import type { FileNode, FileContent } from '../lib/types/core';

  const ui = getUiState();
  const core = getCoreState();
  const files = getFilesState();

  let fileContent = $state<FileContent | null>(null);
  let recentFiles = $state<FileNode[]>([]);
  let pinnedFiles = $state<FileNode[]>([]);

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

  // Load file content when active file changes
  $effect(() => {
    const path = files.activeFilePath;
    if (!path) {
      fileContent = null;
      return;
    }

    loadFileContent(path);
  });

  async function loadFileContent(path: string) {
    try {
      fileContent = await readFile(path);
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

  function renderMarkdown(content: string): string {
    // Minimal markdown rendering for display
    return content
      .split('\n')
      .map((line) => {
        // Headings
        if (line.startsWith('### ')) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
        if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
        if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
        // Empty line
        if (line.trim() === '') return '<br />';
        // Paragraph
        return `<p>${escapeHtml(line)}</p>`;
      })
      .join('\n');
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getFileExtension(path: string): string {
    return path.split('.').pop()?.toLowerCase() ?? '';
  }
</script>

{#if files.activeFilePath && fileContent}
  <div class="file-view">
    {#if getFileExtension(files.activeFilePath) === 'md'}
      <article class="file-view__markdown">
        {@html renderMarkdown(fileContent.content)}
      </article>
    {:else}
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
    {/if}
  </div>
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
  .file-view {
    height: 100%;
    overflow-y: auto;
    padding: var(--space-6) var(--space-8);
  }

  .file-view__markdown {
    max-width: 720px;
    margin: 0 auto;
    font-family: var(--font-content);
    font-size: var(--text-base);
    line-height: 1.7;
    color: var(--color-text-primary);
  }

  .file-view__markdown :global(h1) {
    font-family: var(--font-sans);
    font-size: var(--text-2xl);
    line-height: var(--text-2xl-leading);
    font-weight: 600;
    margin-bottom: var(--space-4);
    color: var(--color-text-primary);
  }

  .file-view__markdown :global(h2) {
    font-family: var(--font-sans);
    font-size: var(--text-xl);
    line-height: var(--text-xl-leading);
    font-weight: 600;
    margin-top: var(--space-8);
    margin-bottom: var(--space-3);
    color: var(--color-text-primary);
  }

  .file-view__markdown :global(h3) {
    font-family: var(--font-sans);
    font-size: var(--text-lg);
    line-height: var(--text-lg-leading);
    font-weight: 600;
    margin-top: var(--space-6);
    margin-bottom: var(--space-2);
    color: var(--color-text-primary);
  }

  .file-view__markdown :global(p) {
    margin-bottom: var(--space-3);
  }

  .file-view__markdown :global(br) {
    display: block;
    content: '';
    margin-top: var(--space-2);
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
