<script lang="ts">
  import "../lib/styles/reset.css";
  import "../lib/styles/tokens.css";
  import "../lib/styles/typography.css";
  import "../lib/styles/animations.css";

  import type { Snippet } from "svelte";
  import { onMount, onDestroy } from "svelte";
  import type { UnlistenFn } from "@tauri-apps/api/event";

  import AppShell from "../lib/components/layout/AppShell.svelte";
  import Sidebar from "../lib/components/layout/Sidebar.svelte";
  import ContentArea from "../lib/components/layout/ContentArea.svelte";
  import TabBar from "../lib/components/tabs/TabBar.svelte";
  import FileTree from "../lib/components/filetree/FileTree.svelte";
  import ContextMenu from "../lib/components/common/ContextMenu.svelte";
  import type { MenuItem } from "../lib/components/common/ContextMenu.svelte";
  import KeyboardManager from "../lib/components/common/KeyboardManager.svelte";
  import ToastContainer from "../lib/components/common/ToastContainer.svelte";
  import SaveIndicator from "../lib/editor/SaveIndicator.svelte";
  import GraphView from "../lib/components/graph/GraphView.svelte";

  import { getUiState } from "../lib/stores/ui.svelte";
  import { getCoreState } from "../lib/stores/core.svelte";
  import { getFilesState } from "../lib/stores/files.svelte";
  import { getEditorState } from "../lib/stores/editor.svelte";
  import { getTabsState } from "../lib/stores/tabs.svelte";
  import { getGraphState } from "../lib/stores/graph.svelte";
  import {
    onCoreReady,
    onCoreClosed,
    onFileCreated,
    onFileModified,
    onFileDeleted,
    onFileRenamed,
  } from "../lib/bridge/events";
  import { createFile, deleteFile, renameFile, duplicateFile, createDir } from "../lib/bridge/commands";
  import { logger } from "../lib/logger";
  import { APP_SHORTCUTS } from "../lib/utils/shortcuts";

  let { children }: { children: Snippet } = $props();

  const ui = getUiState();
  const core = getCoreState();
  const files = getFilesState();
  const editor = getEditorState();
  const tabsState = getTabsState();
  const graphState = getGraphState();

  let unlisteners: UnlistenFn[] = [];
  let overlayOpen = $derived(ui.quickOpenVisible || ui.commandPaletteVisible);

  // Context menu state
  let ctxVisible = $state(false);
  let ctxPosition = $state({ top: 0, left: 0 });
  let ctxItems = $state<MenuItem[]>([]);
  let ctxTargetPath = $state<string | null>(null);
  let ctxTargetIsDir = $state(false);

  function handleTreeContextMenu(path: string, isDir: boolean, e: MouseEvent) {
    ctxTargetPath = path;
    ctxTargetIsDir = isDir;
    ctxPosition = {
      top: Math.min(e.clientY, window.innerHeight - 250),
      left: Math.min(e.clientX, window.innerWidth - 200),
    };
    ctxItems = isDir ? [
      { id: 'new-file', label: 'New File', icon: '＋' },
      { id: 'new-folder', label: 'New Folder', icon: '▸' },
      { id: 'sep1', label: '', separator: true },
      { id: 'rename', label: 'Rename', icon: '✎' },
      { id: 'sep2', label: '', separator: true },
      { id: 'delete', label: 'Delete', icon: '✕', danger: true },
    ] : [
      { id: 'rename', label: 'Rename', icon: '✎' },
      { id: 'duplicate', label: 'Duplicate', icon: '⊕' },
      { id: 'sep1', label: '', separator: true },
      { id: 'delete', label: 'Delete', icon: '✕', danger: true },
    ];
    ctxVisible = true;
  }

  async function handleCtxSelect(id: string) {
    ctxVisible = false;
    if (!ctxTargetPath) return;

    switch (id) {
      case 'rename': {
        const oldPath = ctxTargetPath;
        const oldName = oldPath.split('/').pop() ?? oldPath;
        const newName = window.prompt('Rename', oldName);
        if (!newName || newName === oldName) return;
        const parentDir = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : '';
        const newPath = parentDir ? `${parentDir}/${newName}` : newName;
        try {
          const updated = await renameFile(oldPath, newPath);
          files.renameFile(oldPath, newPath, updated);
          tabsState.updateFileTab(oldPath, updated);
          if (files.activeFilePath === oldPath) files.setActiveFile(newPath);
        } catch (err) {
          logger.error(`Rename failed: ${err}`);
        }
        break;
      }
      case 'duplicate': {
        try {
          const dup = await duplicateFile(ctxTargetPath);
          files.addFile(dup);
        } catch (err) {
          logger.error(`Duplicate failed: ${err}`);
        }
        break;
      }
      case 'delete': {
        if (!window.confirm(`Move "${ctxTargetPath.split('/').pop()}" to trash?`)) return;
        try {
          await deleteFile(ctxTargetPath);
          files.removeFile(ctxTargetPath);
          tabsState.removeFileTab(ctxTargetPath);
          if (files.activeFilePath === ctxTargetPath) files.setActiveFile(null);
        } catch (err) {
          logger.error(`Delete failed: ${err}`);
        }
        break;
      }
      case 'new-file': {
        const name = window.prompt('File name', 'untitled.md');
        if (!name) return;
        const filePath = ctxTargetPath ? `${ctxTargetPath}/${name}` : name;
        try {
          const node = await createFile(filePath, '');
          files.addFile(node);
          files.setActiveFile(node.path);
        } catch (err) {
          logger.error(`Create file failed: ${err}`);
        }
        break;
      }
      case 'new-folder': {
        const name = window.prompt('Folder name');
        if (!name) return;
        const dirPath = ctxTargetPath ? `${ctxTargetPath}/${name}` : name;
        try {
          await createDir(dirPath);
          // Re-scan to pick up the new folder
          const { scanCore } = await import('../lib/bridge/commands');
          const fileTree = await scanCore();
          files.setFiles(fileTree);
        } catch (err) {
          logger.error(`Create folder failed: ${err}`);
        }
        break;
      }
    }
  }
  let isMarkdownActive = $derived(
    files.activeFilePath?.endsWith(".md") ||
      files.activeFilePath?.endsWith(".markdown"),
  );

  onMount(async () => {
    logger.info("Layout mounted, subscribing to Tauri events");

    try {
      const u1 = await onCoreReady((e) => {
        logger.info("Core ready, loading file tree");
        files.setFiles(e.file_tree);
      });

      const u2 = await onCoreClosed(() => {
        logger.info("Core closed");
        core.reset();
        files.reset();
        tabsState.reset();
      });

      const u3 = await onFileCreated((e) => {
        files.addFile(e.metadata);
      });

      const u4 = await onFileModified((e) => {
        files.updateFile(e.metadata);
      });

      const u5 = await onFileDeleted((e) => {
        files.removeFile(e.path);
        tabsState.removeFileTab(e.path);
        if (files.activeFilePath === e.path) {
          files.setActiveFile(null);
        }
      });

      const u6 = await onFileRenamed((e) => {
        files.renameFile(e.old_path, e.new_path, e.metadata);
        tabsState.updateFileTab(e.old_path, e.metadata);
        if (files.activeFilePath === e.old_path) {
          files.setActiveFile(e.new_path);
        }
      });

      unlisteners = [u1, u2, u3, u4, u5, u6];
    } catch (err) {
      logger.warn(
        `Tauri event subscription failed (expected in browser dev mode): ${err}`,
      );
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
      const name = `untitled-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}.md`;
      const node = await createFile(name, "");
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
  keymap={APP_SHORTCUTS}
  onquickopen={() => ui.showQuickOpen()}
  oncommandpalette={() => ui.showCommandPalette()}
  onnewnote={handleNewNote}
  ontogglesidebar={() => ui.toggleSidebar()}
  ontogglerightpanel={() => ui.toggleRightPanel()}
  oncollapsesidebar={() => ui.toggleSidebarCollapse()}
  ondeletefile={handleDeleteFile}
  oncloseoverlay={() => ui.closeAllOverlays()}
/>

<AppShell
  sidebarVisible={ui.sidebarVisible}
  sidebarCollapsed={ui.sidebarCollapsed}
  rightPanelVisible={ui.rightPanelVisible}
>
  {#snippet sidebar()}
    <Sidebar collapsed={ui.sidebarCollapsed} ontogglecollapse={() => ui.toggleSidebarCollapse()}>
      {#snippet header()}
        <div class="sidebar-header">
          <span class="sidebar-header__name">
            {core.activeCore?.name ?? "Noctodeus"}
          </span>
        </div>
      {/snippet}

      <FileTree
        tree={files.tree}
        activeFilePath={files.activeFilePath}
        onselect={handleFileSelect}
        ontoggle={handleDirToggle}
        oncontextmenu={handleTreeContextMenu}
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
        <TabBar
          tabs={tabsState.tabs}
          activeTabId={tabsState.activeTabId}
          onactivate={(id) => tabsState.activateTab(id)}
          onclose={(id) => tabsState.closeTab(id)}
          onreorder={(from, to) => tabsState.reorderTabs(from, to)}
        >
          {#snippet trailing()}
            {#if isMarkdownActive}
              <SaveIndicator status={editor.saveStatus} />
            {/if}
          {/snippet}
        </TabBar>
      {/snippet}

      {@render children()}
    </ContentArea>
  {/snippet}

  {#snippet utilityRail()}
    <div class="utility-rail">
      <button
        class="utility-rail__button"
        class:utility-rail__button--active={ui.quickOpenVisible}
        onclick={() => ui.showQuickOpen()}
        title="Quick open"
      >
        ⌕
      </button>
      <button
        class="utility-rail__button"
        class:utility-rail__button--active={ui.commandPaletteVisible}
        onclick={() => ui.showCommandPalette()}
        title="Command palette"
      >
        ≡
      </button>
      <button
        class="utility-rail__button"
        class:utility-rail__button--active={ui.rightPanelVisible}
        onclick={() => ui.toggleRightPanel()}
        title="Toggle detail rail"
      >
        ◎
      </button>
      <button
        class="utility-rail__button"
        onclick={handleNewNote}
        title="New note"
      >
        ＋
      </button>
    </div>
  {/snippet}

  {#snippet rightPanel()}
    <div class="right-panel-graph">
      <div class="right-panel-graph__header">
        <span class="right-panel-graph__label">Graph</span>
      </div>
      <div class="right-panel-graph__body">
        <GraphView
          nodes={graphState.nodes}
          edges={graphState.edges}
          activeFilePath={files.activeFilePath}
          onselect={handleFileSelect}
        />
      </div>
    </div>
  {/snippet}
</AppShell>

<ToastContainer />

<ContextMenu
  visible={ctxVisible}
  position={ctxPosition}
  items={ctxItems}
  onselect={handleCtxSelect}
  onclose={() => ctxVisible = false}
/>

<style>
  :global(html),
  :global(body) {
    height: 100%;
    font-family: var(--font-sans);
    font-size: var(--text-base);
    line-height: var(--text-base-leading);
    color: var(--color-text-primary);
    background: #050608;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    height: 28px;
  }

  .sidebar-header__name {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: var(--text-sm-leading);
    color: rgba(255, 255, 255, 0.84);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
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
    color: rgba(255, 255, 255, 0.36);
  }

  .utility-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding-top: calc(var(--shell-header-height) + var(--space-2));
  }

  .utility-rail__button {
    width: 34px;
    height: 38px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background:
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.028),
        rgba(255, 255, 255, 0.012)
      ),
      rgba(255, 255, 255, 0.016);
    color: rgba(255, 255, 255, 0.58);
    font-family: var(--font-mono);
    font-size: 13px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
    transition:
      color var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .utility-rail__button:hover,
  .utility-rail__button--active {
    color: var(--color-text-primary);
    background:
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.05),
        rgba(255, 255, 255, 0.022)
      ),
      rgba(255, 255, 255, 0.024);
    border-color: rgba(255, 255, 255, 0.13);
  }

  .right-panel-graph {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(10, 12, 16, 0.72);
  }

  .right-panel-graph__header {
    flex-shrink: 0;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .right-panel-graph__label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .right-panel-graph__body {
    flex: 1;
    min-height: 0;
    padding: var(--space-2);
  }
</style>
