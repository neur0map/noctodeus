<script lang="ts">
  import '../lib/styles/reset.css';
  import '../lib/styles/tokens.css';
  import '../lib/styles/typography.css';
  import '../lib/styles/animations.css';

  import type { Snippet } from 'svelte';
  import { onMount, onDestroy } from 'svelte';
  import type { UnlistenFn } from '@tauri-apps/api/event';

  import AppShell from '../lib/components/layout/AppShell.svelte';
  import Sidebar from '../lib/components/layout/Sidebar.svelte';
  import ContentArea from '../lib/components/layout/ContentArea.svelte';
  import ContentHeader from '../lib/components/layout/ContentHeader.svelte';
  import FileTree from '../lib/components/filetree/FileTree.svelte';
  import KeyboardManager from '../lib/components/common/KeyboardManager.svelte';
  import ToastContainer from '../lib/components/common/ToastContainer.svelte';

  import { getUiState } from '../lib/stores/ui.svelte';
  import { getCoreState } from '../lib/stores/core.svelte';
  import { getFilesState } from '../lib/stores/files.svelte';
  import {
    onCoreReady,
    onCoreClosed,
    onFileCreated,
    onFileModified,
    onFileDeleted,
    onFileRenamed,
  } from '../lib/bridge/events';
  import { createFile } from '../lib/bridge/commands';
  import { logger } from '../lib/logger';

  let { children }: { children: Snippet } = $props();

  const ui = getUiState();
  const core = getCoreState();
  const files = getFilesState();

  let unlisteners: UnlistenFn[] = [];
  let overlayOpen = $derived(ui.quickOpenVisible || ui.commandPaletteVisible);

  onMount(async () => {
    logger.info('Layout mounted, subscribing to Tauri events');

    try {
      const u1 = await onCoreReady((e) => {
        logger.info('Core ready, loading file tree');
        files.setFiles(e.file_tree);
      });

      const u2 = await onCoreClosed(() => {
        logger.info('Core closed');
        core.reset();
        files.reset();
      });

      const u3 = await onFileCreated((e) => {
        files.addFile(e.metadata);
      });

      const u4 = await onFileModified((e) => {
        files.updateFile(e.metadata);
      });

      const u5 = await onFileDeleted((e) => {
        files.removeFile(e.path);
        if (files.activeFilePath === e.path) {
          files.setActiveFile(null);
        }
      });

      const u6 = await onFileRenamed((e) => {
        files.renameFile(e.old_path, e.new_path, e.metadata);
        if (files.activeFilePath === e.old_path) {
          files.setActiveFile(e.new_path);
        }
      });

      unlisteners = [u1, u2, u3, u4, u5, u6];
    } catch (err) {
      logger.warn('Tauri event subscription failed (expected in browser dev mode)');
    }
  });

  onDestroy(() => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
    unlisteners = [];
  });

  function handleFileSelect(path: string) {
    files.setActiveFile(path);
  }

  function handleDirToggle(path: string) {
    files.toggleDir(path);
  }

  async function handleNewNote() {
    ui.closeAllOverlays();
    try {
      const now = new Date();
      const name = `untitled-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.md`;
      const node = await createFile(name, '');
      files.addFile(node);
      files.setActiveFile(node.path);
    } catch (err) {
      logger.error(`Failed to create note: ${err}`);
    }
  }

  function handleDeleteFile() {
    // Placeholder: the page component handles confirmation
  }
</script>

<KeyboardManager
  {overlayOpen}
  onquickopen={() => ui.showQuickOpen()}
  oncommandpalette={() => ui.showCommandPalette()}
  onnewnote={handleNewNote}
  ontogglesidebar={() => ui.toggleSidebar()}
  ontogglrightpanel={() => ui.toggleRightPanel()}
  ondeletefile={handleDeleteFile}
  onclosoverlay={() => ui.closeAllOverlays()}
/>

<AppShell
  sidebarVisible={ui.sidebarVisible}
  rightPanelVisible={ui.rightPanelVisible}
>
  {#snippet sidebar()}
    <Sidebar>
      {#snippet header()}
        <div class="sidebar-header">
          <span class="sidebar-header__name">
            {core.activeCore?.name ?? 'Noctodeus'}
          </span>
        </div>
      {/snippet}

      <FileTree
        tree={files.tree}
        activeFilePath={files.activeFilePath}
        onselect={handleFileSelect}
        ontoggle={handleDirToggle}
      />

      {#snippet footer()}
        <div class="sidebar-footer">
          <span class="sidebar-footer__count">
            {files.fileMap.size} files
          </span>
        </div>
      {/snippet}
    </Sidebar>
  {/snippet}

  {#snippet content()}
    <ContentArea>
      {#snippet header()}
        <ContentHeader path={files.activeFilePath ?? ''} />
      {/snippet}

      {@render children()}
    </ContentArea>
  {/snippet}

  {#snippet rightPanel()}
    <div class="right-panel-placeholder">
      <!-- Right panel content will be added later -->
    </div>
  {/snippet}
</AppShell>

<ToastContainer />

<style>
  :global(html),
  :global(body) {
    height: 100%;
    font-family: var(--font-sans);
    font-size: var(--text-base);
    line-height: var(--text-base-leading);
    color: var(--color-text-primary);
    background: var(--color-bg-base);
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    height: 28px;
  }

  .sidebar-header__name {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: var(--text-sm-leading);
    color: var(--color-text-primary);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar-footer {
    display: flex;
    align-items: center;
    height: 24px;
  }

  .sidebar-footer__count {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--text-xs-leading);
    color: var(--color-text-muted);
  }

  .right-panel-placeholder {
    height: 100%;
    background: var(--color-bg-surface);
    border-left: 1px solid var(--color-border-subtle);
  }
</style>
