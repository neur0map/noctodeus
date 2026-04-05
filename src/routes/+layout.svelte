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
  import SearchBar from "../lib/components/search/SearchBar.svelte";
  import ContextMenu from "../lib/components/common/ContextMenu.svelte";
  import type { MenuItem } from "../lib/components/common/ContextMenu.svelte";
  import InputDialog from "../lib/components/common/InputDialog.svelte";
  import KeyboardManager from "../lib/components/common/KeyboardManager.svelte";
  import ToastContainer from "../lib/components/common/ToastContainer.svelte";
  import SaveIndicator from "../lib/editor/SaveIndicator.svelte";
  import GraphView from "../lib/components/graph/GraphView.svelte";
  import BacklinksPanel from "../lib/components/panels/BacklinksPanel.svelte";
  import OutlinePanel from "../lib/components/panels/OutlinePanel.svelte";
  import { getActiveEditorState } from "../lib/stores/active-editor.svelte";

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
  import { createFile, deleteFile, renameFile, duplicateFile, createDir, searchQuery, addPin, removePin, searchPinned } from "../lib/bridge/commands";
  import { ask as tauriAsk } from "@tauri-apps/plugin-dialog";
  import type { SearchHit } from "../lib/types/core";
  import { logger } from "../lib/logger";
  import { APP_SHORTCUTS } from "../lib/utils/shortcuts";

  let { children }: { children: Snippet } = $props();

  const ui = getUiState();
  const core = getCoreState();
  const files = getFilesState();
  const editor = getEditorState();
  const tabsState = getTabsState();
  const graphState = getGraphState();
  const activeEditorState = getActiveEditorState();

  let unlisteners: UnlistenFn[] = [];
  let overlayOpen = $derived(ui.quickOpenVisible || ui.commandPaletteVisible);

  // Context menu state
  let ctxVisible = $state(false);
  let ctxPosition = $state({ top: 0, left: 0 });
  let ctxItems = $state<MenuItem[]>([]);
  let ctxTargetPath = $state<string | null>(null);
  let ctxTargetIsDir = $state(false);

  // Input dialog state
  let inputDialogVisible = $state(false);
  let inputDialogTitle = $state('');
  let inputDialogValue = $state('');
  let inputDialogCallback: ((value: string) => void) | null = null;

  function showInputDialog(title: string, defaultValue: string): Promise<string | null> {
    return new Promise((resolve) => {
      inputDialogTitle = title;
      inputDialogValue = defaultValue;
      inputDialogCallback = (val) => {
        inputDialogVisible = false;
        resolve(val);
      };
      inputDialogVisible = true;
    });
  }

  function cancelInputDialog() {
    inputDialogVisible = false;
    inputDialogCallback = null;
  }

  // Search state
  let searchResults = $state<SearchHit[]>([]);

  // Sidebar ⋯ menu state
  let sidebarMenuVisible = $state(false);
  let sidebarMenuPosition = $state({ top: 0, left: 0 });

  const sidebarMenuItems: MenuItem[] = [
    { id: 'new-file', label: 'New File', icon: '＋' },
    { id: 'new-folder', label: 'New Folder', icon: '▸' },
    { id: 'sep1', label: '', separator: true },
    { id: 'sort-name-asc', label: 'Sort A → Z', icon: '↑' },
    { id: 'sort-name-desc', label: 'Sort Z → A', icon: '↓' },
    { id: 'sort-modified-new', label: 'Sort Newest', icon: '◷' },
    { id: 'sort-modified-old', label: 'Sort Oldest', icon: '◶' },
  ];

  async function handleSidebarMenu(id: string) {
    sidebarMenuVisible = false;
    switch (id) {
      case 'new-file': {
        const rawName = await showInputDialog('New file name', 'untitled');
        if (!rawName) return;
        const name = sanitizeFileName(rawName, false);
        try {
          const node = await createFile(name, '');
          files.addFile(node);
          files.setActiveFile(node.path);
        } catch (err) { logger.error(`Create file failed: ${err}`); }
        break;
      }
      case 'new-folder':
        await handleNewFolder();
        break;
      case 'sort-name-asc': files.setSortMode('name-asc'); break;
      case 'sort-name-desc': files.setSortMode('name-desc'); break;
      case 'sort-modified-new': files.setSortMode('modified-new'); break;
      case 'sort-modified-old': files.setSortMode('modified-old'); break;
    }
  }

  // Pinned files state
  let pinnedPaths = $state<Set<string>>(new Set());

  async function loadPinned() {
    try {
      const pinned = await searchPinned();
      pinnedPaths = new Set(pinned.map(f => f.path));
    } catch {}
  }

  async function handleSearch(query: string) {
    // Filter the file tree instantly as user types
    files.setFilterQuery(query);

    // Try FTS5 backend first (with prefix matching)
    try {
      const ftsQuery = query.split(/\s+/).map(w => `${w}*`).join(' ');
      searchResults = await searchQuery(ftsQuery);
    } catch {
      searchResults = [];
    }

    // Fallback: client-side fuzzy search across file names and titles
    if (searchResults.length === 0) {
      const q = query.toLowerCase();
      searchResults = Array.from(files.fileMap.values())
        .filter(f => !f.is_directory)
        .filter(f => {
          const name = f.name.toLowerCase();
          const title = (f.title ?? '').toLowerCase();
          return name.includes(q) || title.includes(q);
        })
        .slice(0, 10)
        .map(f => ({
          path: f.path,
          title: f.title,
          snippet: f.path,
          score: 1,
        }));
    }
  }

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
      { id: 'pin', label: pinnedPaths.has(path) ? 'Unpin' : 'Pin', icon: pinnedPaths.has(path) ? '★' : '☆' },
      { id: 'rename', label: 'Rename', icon: '✎' },
      { id: 'duplicate', label: 'Duplicate', icon: '⊕' },
      { id: 'export-html', label: 'Export HTML', icon: '↗' },
      { id: 'sep1', label: '', separator: true },
      { id: 'delete', label: 'Delete', icon: '✕', danger: true },
    ];
    ctxVisible = true;
  }

  function sanitizeFileName(name: string, isDir: boolean): string {
    // Replace spaces with dashes
    let clean = name.trim().replace(/\s+/g, '-');
    // Remove unsafe characters
    clean = clean.replace(/[<>:"|?*\\]/g, '');
    // Ensure .md extension for files (not directories)
    if (!isDir && !clean.includes('.')) {
      clean += '.md';
    }
    return clean;
  }

  async function handleCtxSelect(id: string) {
    ctxVisible = false;
    if (!ctxTargetPath) return;

    switch (id) {
      case 'export-html': {
        try {
          const { readFile } = await import('../lib/bridge/commands');
          const { content } = await readFile(ctxTargetPath);
          const { parseMarkdown } = await import('../lib/editor/serializer');
          const html = parseMarkdown(content);
          const defaultName = ctxTargetPath.split('/').pop()?.replace(/\.(md|markdown)$/i, '.html') ?? 'export.html';
          const fullHtml = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${defaultName}</title>\n<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#e0e0e0;background:#1a1a2e;line-height:1.7;}a{color:#6366f1;}pre{background:#111;padding:1rem;border-radius:8px;overflow-x:auto;}code{font-family:monospace;font-size:0.9em;}img{max-width:100%;border-radius:8px;}blockquote{border-left:3px solid #444;padding-left:1rem;color:#aaa;}h1,h2,h3{font-weight:600;letter-spacing:-0.02em;}</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;

          // Use Tauri save dialog
          const { save: saveDialog } = await import('@tauri-apps/plugin-dialog');
          const savePath = await saveDialog({
            defaultPath: defaultName,
            filters: [{ name: 'HTML', extensions: ['html'] }],
          });
          if (savePath) {
            const { writeFile: tauriWrite } = await import('@tauri-apps/plugin-fs');
            await tauriWrite(savePath, new TextEncoder().encode(fullHtml));
            const { toast } = await import('../lib/stores/toast.svelte');
            toast.success(`Exported to ${savePath.split('/').pop()}`);
          }
        } catch (err) {
          logger.error(`Export failed: ${err}`);
        }
        break;
      }
      case 'pin': {
        try {
          if (pinnedPaths.has(ctxTargetPath)) {
            await removePin(ctxTargetPath);
            pinnedPaths = new Set([...pinnedPaths].filter(p => p !== ctxTargetPath));
          } else {
            await addPin(ctxTargetPath);
            pinnedPaths = new Set([...pinnedPaths, ctxTargetPath]);
          }
        } catch (err) {
          logger.error(`Pin failed: ${err}`);
        }
        break;
      }
      case 'rename': {
        const oldPath = ctxTargetPath;
        const oldName = oldPath.split('/').pop() ?? oldPath;
        const rawName = await showInputDialog('Rename', oldName);
        if (!rawName) return;
        const newName = sanitizeFileName(rawName, ctxTargetIsDir);
        if (newName === oldName) return;
        const parentDir = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : '';
        const newPath = parentDir ? `${parentDir}/${newName}` : newName;
        try {
          const updated = await renameFile(oldPath, newPath);
          files.renameFile(oldPath, newPath, updated);
          tabsState.updateFileTab(oldPath, updated);
          if (files.activeFilePath === oldPath) files.setActiveFile(newPath);
        } catch (err) {
          logger.error(`Rename failed: ${err}`);
          const { toast } = await import('../lib/stores/toast.svelte');
          toast.error(`Rename failed: ${err}`);
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
        const confirmed = await tauriAsk(`Move "${ctxTargetPath.split('/').pop()}" to trash?`, { title: 'Delete', kind: 'warning' });
        if (!confirmed) return;
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
        const rawName = await showInputDialog('New file name', 'untitled');
        if (!rawName) return;
        const name = sanitizeFileName(rawName, false);
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
        const rawName = await showInputDialog('Folder name', '');
        if (!rawName) return;
        const name = sanitizeFileName(rawName, true);
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
        loadPinned();
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

  async function handleNewFolder() {
    const rawName = await showInputDialog('Folder name', '');
    if (!rawName) return;
    const name = sanitizeFileName(rawName, true);
    try {
      await createDir(name);
      const { scanCore } = await import('../lib/bridge/commands');
      const fileTree = await scanCore();
      files.setFiles(fileTree);
    } catch (err) {
      logger.error(`Create folder failed: ${err}`);
    }
  }

  async function handleInlineRename(oldPath: string, rawNewName: string) {
    const isDir = files.fileMap.get(oldPath)?.is_directory ?? false;
    const newName = sanitizeFileName(rawNewName, isDir);
    if (newName === oldPath.split('/').pop()) return;
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
  }

  async function handleFileMove(sourcePath: string, targetDir: string) {
    try {
      const { moveFile } = await import('../lib/bridge/commands');
      const updated = await moveFile(sourcePath, targetDir);
      const newPath = updated.path;
      files.removeFile(sourcePath);
      files.addFile(updated);
      tabsState.updateFileTab(sourcePath, updated);
      if (files.activeFilePath === sourcePath) files.setActiveFile(newPath);
    } catch (err) {
      logger.error(`Move failed: ${err}`);
    }
  }

  async function handleDeleteFile() {
    const path = files.activeFilePath;
    if (!path) return;
    const name = path.split('/').pop() ?? path;
    const confirmed = await tauriAsk(`Move "${name}" to trash?`, { title: 'Delete', kind: 'warning' });
    if (!confirmed) return;
    try {
      await deleteFile(path);
      files.removeFile(path);
      tabsState.removeFileTab(path);
      files.setActiveFile(null);
    } catch (err) {
      logger.error(`Delete failed: ${err}`);
    }
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
          <button class="sidebar-header__btn" onclick={(e) => {
            sidebarMenuPosition = { top: e.clientY + 4, left: e.clientX - 140 };
            sidebarMenuVisible = true;
          }} title="Actions">
            ⋯
          </button>
        </div>
      {/snippet}

      {#if pinnedPaths.size > 0}
        <div class="sidebar-pinned">
          {#each [...pinnedPaths] as path}
            {@const file = files.fileMap.get(path)}
            {#if file}
              <button
                class="sidebar-pinned__item"
                class:sidebar-pinned__item--active={files.activeFilePath === path}
                onclick={() => handleFileSelect(path)}
              >
                <span class="sidebar-pinned__star">★</span>
                <span class="sidebar-pinned__name">{file.title || file.name}</span>
              </button>
            {/if}
          {/each}
        </div>
      {/if}

      <SearchBar
        results={searchResults}
        onselect={handleFileSelect}
        onsearch={handleSearch}
      />

      <FileTree
        tree={files.tree}
        activeFilePath={files.activeFilePath}
        onselect={handleFileSelect}
        ontoggle={handleDirToggle}
        oncontextmenu={handleTreeContextMenu}
        ondelete={handleDeleteFile}
        onmove={handleFileMove}
        onrename={handleInlineRename}
      />

      {#snippet footer()}
        <div class="sidebar-footer">
          <span class="sidebar-footer__count">
            {files.fileMap.size} files
          </span>
          {#if activeEditorState.editor}
            <span class="sidebar-footer__words">
              {activeEditorState.editor.storage.characterCount?.words?.() ?? activeEditorState.editor.state.doc.textContent.trim().split(/\s+/).filter(Boolean).length}w
            </span>
          {/if}
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
    <div class="right-panel">
      <div class="right-panel__section right-panel__section--graph">
        <div class="right-panel__section-header">
          <span class="right-panel__section-label">Graph</span>
        </div>
        <div class="right-panel__graph-body">
          <GraphView
            nodes={graphState.nodes}
            edges={graphState.edges}
            activeFilePath={files.activeFilePath}
            onselect={handleFileSelect}
          />
        </div>
      </div>

      <div class="right-panel__section right-panel__section--scroll">
        <OutlinePanel editor={activeEditorState.editor} />
      </div>

      <div class="right-panel__section right-panel__section--scroll">
        <BacklinksPanel
          currentPath={files.activeFilePath}
          nodes={graphState.nodes}
          edges={graphState.edges}
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

<ContextMenu
  visible={sidebarMenuVisible}
  position={sidebarMenuPosition}
  items={sidebarMenuItems}
  onselect={handleSidebarMenu}
  onclose={() => sidebarMenuVisible = false}
/>

<InputDialog
  visible={inputDialogVisible}
  title={inputDialogTitle}
  value={inputDialogValue}
  onsubmit={(val) => inputDialogCallback?.(val)}
  oncancel={cancelInputDialog}
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

  .sidebar-pinned {
    padding: var(--space-1) calc(var(--space-3) * var(--sidebar-density));
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    margin-bottom: var(--space-1);
  }

  .sidebar-pinned__item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    width: 100%;
    padding: 3px var(--space-2);
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.56);
    background: transparent;
    border: none;
    border-radius: 4px;
    text-align: left;
    cursor: pointer;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .sidebar-pinned__item:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text-primary);
  }

  .sidebar-pinned__item--active {
    color: var(--color-text-primary);
    background: rgba(122, 141, 255, 0.08);
  }

  .sidebar-pinned__star {
    color: rgba(255, 200, 50, 0.6);
    font-size: 9px;
    flex-shrink: 0;
  }

  .sidebar-pinned__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 28px;
  }

  .sidebar-header__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(255, 255, 255, 0.36);
    font-size: 12px;
    cursor: pointer;
    transition: color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out);
  }

  .sidebar-header__btn:hover {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.06);
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
    justify-content: space-between;
    height: 24px;
  }

  .sidebar-footer__count,
  .sidebar-footer__words {
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

  .right-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(10, 12, 16, 0.72);
    overflow: hidden;
  }

  .right-panel__section {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .right-panel__section--graph {
    flex: 1;
    min-height: 140px;
    display: flex;
    flex-direction: column;
  }

  .right-panel__section--scroll {
    flex-shrink: 0;
    max-height: 35%;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .right-panel__section--scroll::-webkit-scrollbar { display: none; }

  .right-panel__section-header {
    padding: var(--space-2) var(--space-3);
  }

  .right-panel__section-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.36);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .right-panel__graph-body {
    flex: 1;
    min-height: 0;
    padding: 0 var(--space-2) var(--space-2);
  }
</style>
