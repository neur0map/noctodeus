<script lang="ts">
  import "../lib/styles/app.css";
  import "../lib/styles/app.scss";
  import "../lib/styles/fonts.css";

  import type { Snippet } from "svelte";
  import { onMount, onDestroy } from "svelte";
  import { applyTheme } from "$lib/themes/apply";
  import type { UnlistenFn } from "@tauri-apps/api/event";

  import AppShell from "../lib/components/layout/AppShell.svelte";
  import SidebarContent from "../lib/components/layout/SidebarContent.svelte";
  import ContentArea from "../lib/components/layout/ContentArea.svelte";
  import TabBarContent from "../lib/components/layout/TabBarContent.svelte";
  import ContextMenu from "../lib/components/common/ContextMenu.svelte";
  import type { MenuItem } from "../lib/components/common/ContextMenu.svelte";
  import InputDialog from "../lib/components/common/InputDialog.svelte";
  import KeyboardManager from "../lib/components/common/KeyboardManager.svelte";
  import Dialogs from "../lib/components/layout/Dialogs.svelte";
  import { getSettings } from "../lib/stores/settings.svelte";

  import { getUiState } from "../lib/stores/ui.svelte";
  import { getCoreState } from "../lib/stores/core.svelte";
  import { getFilesState } from "../lib/stores/files.svelte";
  import { getTabsState } from "../lib/stores/tabs.svelte";
  import {
    onCoreReady,
    onCoreClosed,
    onFileCreated,
    onFileModified,
    onFileDeleted,
    onFileRenamed,
  } from "../lib/bridge/events";
  import { createFile, deleteFile, renameFile, duplicateFile, createDir, searchQuery } from "../lib/bridge/commands";
  import { getPinnedState } from "../lib/stores/pinned.svelte";
  import { ask as tauriAsk } from "@tauri-apps/plugin-dialog";
  import type { SearchHit } from "../lib/types/core";
  import { logger } from "../lib/logger";
  import { getResolvedShortcuts } from "../lib/utils/shortcuts";
  import { sanitizeFileName } from "../lib/utils/files";
  import { handleExport as doExport } from "../lib/utils/export";

  import FocusManager from "../lib/components/common/FocusManager.svelte";
  import ShareModal from "../lib/components/common/ShareModal.svelte";
  import FloatingChatBubble from "../lib/components/ai/FloatingChatBubble.svelte";

  let { children }: { children: Snippet } = $props();

  const ui = getUiState();
  const core = getCoreState();
  const files = getFilesState();
  const tabsState = getTabsState();
  const appSettings = getSettings();
  const pinned = getPinnedState();

  let keymap = $derived(getResolvedShortcuts(appSettings.keybinds));

  // Apply theme reactively
  $effect(() => {
    applyTheme(appSettings.theme);
  });

  // Apply custom font overrides reactively
  $effect(() => {
    const root = document.documentElement;

    if (appSettings.fontMono) root.style.setProperty('--font-mono', `"${appSettings.fontMono}", ui-monospace, monospace`);
    else root.style.removeProperty('--font-mono');

    if (appSettings.fontSans) root.style.setProperty('--font-sans', `"${appSettings.fontSans}", ui-sans-serif, system-ui, sans-serif`);
    else root.style.removeProperty('--font-sans');

    if (appSettings.fontContent) root.style.setProperty('--font-content', `"${appSettings.fontContent}", ui-serif, serif`);
    else root.style.removeProperty('--font-content');
  });

  // Apply custom CSS snippet
  $effect(() => {
    const css = appSettings.customCSS;
    let styleEl = document.getElementById('noctodeus-custom-css') as HTMLStyleElement | null;
    if (css) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'noctodeus-custom-css';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = css;
    } else if (styleEl) {
      styleEl.remove();
    }
  });

  let unlisteners: UnlistenFn[] = [];
  let overlayOpen = $derived(ui.quickOpenVisible || ui.commandPaletteVisible || ui.panelModalVisible || ui.graphPanelVisible);

  // Calendar: scan journal/ folder for existing daily notes
  let journalDates = $derived(
    new Set(
      Array.from(files.fileMap.keys())
        .filter(p => p.startsWith('journal/') && p.endsWith('.md'))
        .map(p => p.replace('journal/', '').replace('.md', ''))
    )
  );

  async function handleDailyNote(dateStr: string) {
    const path = `journal/${dateStr}.md`;
    const existing = files.fileMap.get(path);
    if (existing) {
      handleFileSelect(path);
      return;
    }
    try { await createDir('journal'); } catch {}
    const d = new Date(dateStr + 'T12:00:00');
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    const month = d.toLocaleDateString('en-US', { month: 'long' });
    const day = d.getDate();
    const year = d.getFullYear();
    const content = `---\ntitle: "${dateStr}"\ntags: [journal, daily]\n---\n\n# ${weekday}, ${month} ${day} ${year}\n\n## Tasks\n\n- [ ] \n\n## Notes\n\n`;
    const node = await createFile(path, content);
    files.addFile(node);
    handleFileSelect(path);
  }

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

  // Export dialog state
  let exportDialogVisible = $state(false);
  let exportDialogPath = $state('');

  // Share modal state
  let shareModalVisible = $state(false);
  let shareContent = $state('');

  // Search state
  let searchResults = $state<SearchHit[]>([]);

  // Sidebar ⋯ menu state
  let sidebarMenuVisible = $state(false);
  let sidebarMenuPosition = $state({ top: 0, left: 0 });

  const sidebarMenuItems: MenuItem[] = [
    { id: 'new-file', label: 'New File' },
    { id: 'new-folder', label: 'New Folder' },
    { id: 'import-files', label: 'Import Files...' },
    { id: 'sep1', label: '', separator: true },
    { id: 'sort-name-asc', label: 'Sort A \u2192 Z' },
    { id: 'sort-name-desc', label: 'Sort Z \u2192 A' },
    { id: 'sort-modified-new', label: 'Sort Newest' },
    { id: 'sort-modified-old', label: 'Sort Oldest' },
  ];

  async function handleSidebarMenu(id: string) {
    sidebarMenuVisible = false;
    switch (id) {
      case 'new-file': {
        const rawName = await showInputDialog('New file name', 'untitled');
        if (!rawName) return;
        const name = sanitizeFileName(rawName, false, appSettings.defaultExtension);
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
      case 'import-files':
        await handleImportFiles();
        break;
      case 'sort-name-asc': files.setSortMode('name-asc'); break;
      case 'sort-name-desc': files.setSortMode('name-desc'); break;
      case 'sort-modified-new': files.setSortMode('modified-new'); break;
      case 'sort-modified-old': files.setSortMode('modified-old'); break;
    }
  }


  async function handleSearch(query: string) {
    // Filter the file tree instantly as user types
    files.setFilterQuery(query);

    if (!query.trim()) {
      searchResults = [];
      return;
    }

    // Sanitize query for FTS5: strip characters that break MATCH syntax
    const sanitized = query.replace(/['"()\-{}[\]:^~@!]/g, ' ').trim();
    if (!sanitized) {
      searchResults = [];
      return;
    }

    // Try FTS5 backend — searches across path, title, AND content
    try {
      const ftsQuery = sanitized.split(/\s+/).filter(Boolean).map(w => `${w}*`).join(' ');
      searchResults = await searchQuery(ftsQuery);
    } catch {
      searchResults = [];
    }

    // Fallback: client-side search across file names and titles
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

    // Also try RAG search in parallel and merge results
    try {
      const corePath = core.activeCore?.path;
      if (corePath) {
        const { ragSearch } = await import('../lib/bridge/rag');
        const ragResults = await ragSearch(sanitized, corePath, 10);
        const existingPaths = new Set(searchResults.map(r => r.path));
        for (const rr of ragResults) {
          if (!existingPaths.has(rr.path) && rr.path) {
            searchResults = [...searchResults, {
              path: rr.path,
              title: rr.title,
              snippet: rr.chunk,
              score: rr.score,
            }];
          }
        }
      }
    } catch {
      // RAG not available, continue with FTS5 results
    }
  }

  async function handleShareNote(path: string) {
    try {
      const { readFile } = await import('../lib/bridge/commands');
      const { content } = await readFile(path);
      shareContent = content;
      shareModalVisible = true;
    } catch (err) {
      logger.error(`Failed to read file for sharing: ${err}`);
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
      { id: 'new-file', label: 'New File' },
      { id: 'new-folder', label: 'New Folder' },
      { id: 'sep1', label: '', separator: true },
      { id: 'rename', label: 'Rename' },
      { id: 'sep2', label: '', separator: true },
      { id: 'delete', label: 'Delete', danger: true },
    ] : [
      { id: 'pin', label: pinned.isPinned(path) ? 'Unpin' : 'Pin' },
      { id: 'rename', label: 'Rename' },
      { id: 'duplicate', label: 'Duplicate' },
      { id: 'export', label: 'Export...' },
      { id: 'share', label: 'Share encrypted link' },
      { id: 'sep1', label: '', separator: true },
      { id: 'delete', label: 'Delete', danger: true },
    ];
    ctxVisible = true;
  }

  async function handleCtxSelect(id: string) {
    ctxVisible = false;
    if (!ctxTargetPath) return;

    switch (id) {
      case 'export': {
        exportDialogPath = ctxTargetPath;
        exportDialogVisible = true;
        break;
      }
      case 'pin': {
        try {
          await pinned.toggle(ctxTargetPath);
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
        const newName = sanitizeFileName(rawName, ctxTargetIsDir, appSettings.defaultExtension);
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
      case 'share': {
        await handleShareNote(ctxTargetPath);
        break;
      }
      case 'delete': {
        if (appSettings.confirmBeforeDelete) {
          const confirmed = await tauriAsk(`Move "${ctxTargetPath.split('/').pop()}" to trash?`, { title: 'Delete', kind: 'warning' });
          if (!confirmed) return;
        }
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
        const name = sanitizeFileName(rawName, false, appSettings.defaultExtension);
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
        const name = sanitizeFileName(rawName, true, appSettings.defaultExtension);
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
        pinned.load();
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

    const handleShareEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      shareContent = detail.content;
      shareModalVisible = true;
    };
    window.addEventListener('noctodeus-share', handleShareEvent);
    unlisteners.push(() => window.removeEventListener('noctodeus-share', handleShareEvent));

    const handleShareFileEvent = async (e: Event) => {
      const path = (e as CustomEvent).detail.path;
      await handleShareNote(path);
    };
    window.addEventListener('noctodeus-share-file', handleShareFileEvent);
    unlisteners.push(() => window.removeEventListener('noctodeus-share-file', handleShareFileEvent));

    // Auto-start configured MCP servers
    if (appSettings.mcpServers && appSettings.mcpServers.length > 0) {
      const { getMcpState } = await import('../lib/stores/mcp.svelte');
      const mcp = getMcpState();
      for (const server of appSettings.mcpServers) {
        mcp.startServer(server.name, server.command, server.args, server.env).catch((err: any) => {
          logger.warn(`Auto-start MCP server '${server.name}' failed: ${err?.message || err}`);
        });
      }
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
      const ext = appSettings.defaultExtension;
      const name = `untitled-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}${ext}`;
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
    const name = sanitizeFileName(rawName, true, appSettings.defaultExtension);
    try {
      await createDir(name);
      const { scanCore } = await import('../lib/bridge/commands');
      const fileTree = await scanCore();
      files.setFiles(fileTree);
    } catch (err) {
      logger.error(`Create folder failed: ${err}`);
    }
  }

  async function handleImportFiles() {
    try {
      const { open: openFileDialog } = await import('@tauri-apps/plugin-dialog');
      const { readFile: tauriReadFile } = await import('@tauri-apps/plugin-fs');
      const { toast } = await import('../lib/stores/toast.svelte');

      const selected = await openFileDialog({
        multiple: true,
        directory: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdx', 'txt'] }],
        title: 'Import files (copies into core)',
      });
      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      let imported = 0;

      for (const fp of paths) {
        try {
          const absPath = typeof fp === 'string' ? fp : String(fp);
          const fileName = absPath.split('/').pop() ?? absPath.split('\\').pop() ?? 'imported.md';
          const bytes = await tauriReadFile(absPath);
          const content = new TextDecoder().decode(bytes);

          let targetPath = fileName;
          if (files.fileMap.has(targetPath)) {
            const base = fileName.replace(/\.(md|markdown|mdx|txt)$/i, '');
            const ext = fileName.slice(base.length);
            targetPath = `${base}-imported${ext}`;
          }

          const node = await createFile(targetPath, content);
          files.addFile(node);
          imported++;
        } catch (err) {
          logger.error(`Failed to import file: ${err}`);
        }
      }

      if (imported > 0) {
        const { toast } = await import('../lib/stores/toast.svelte');
        toast.success(`Imported ${imported} file${imported > 1 ? 's' : ''}`);
      }
    } catch (err) {
      logger.error(`Import failed: ${err}`);
    }
  }

  async function handleInlineRename(oldPath: string, rawNewName: string) {
    const isDir = files.fileMap.get(oldPath)?.is_directory ?? false;
    const newName = sanitizeFileName(rawNewName, isDir, appSettings.defaultExtension);
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
    if (appSettings.confirmBeforeDelete) {
      const name = path.split('/').pop() ?? path;
      const confirmed = await tauriAsk(`Move "${name}" to trash?`, { title: 'Delete', kind: 'warning' });
      if (!confirmed) return;
    }
    try {
      await deleteFile(path);
      files.removeFile(path);
      tabsState.removeFileTab(path);
      files.setActiveFile(null);
    } catch (err) {
      logger.error(`Delete failed: ${err}`);
    }
  }

  async function handleExport(format: string, includeMedia: boolean) {
    exportDialogVisible = false;
    const targetPath = exportDialogPath;
    if (!targetPath) return;
    const allMarkdownFiles = Array.from(files.fileMap.values())
      .filter(f => !f.is_directory && (f.extension === 'md' || f.extension === 'markdown'))
      .map(f => ({ path: f.path, title: f.title }));
    await doExport(format, includeMedia, targetPath, {
      corePath: core.activeCore?.path,
      coreName: core.activeCore?.name,
      allMarkdownFiles,
    });
  }
</script>

<FocusManager {overlayOpen}>

<KeyboardManager
  {overlayOpen}
  {keymap}
  onsearch={() => ui.showQuickOpen()}
  onquickopen={() => ui.showCommandPalette()}
  oncommandpalette={() => ui.showCommandPalette()}
  onnewnote={handleNewNote}
  ontogglesidebar={() => ui.toggleSidebar()}
  ontogglerightpanel={() => ui.panelModalVisible ? ui.hidePanelModal() : ui.showPanelModal()}
  oncollapsesidebar={() => ui.toggleSidebarCollapse()}
  ondeletefile={handleDeleteFile}
  ontoggleaichat={() => ui.toggleAiChat()}
  oncloseoverlay={() => ui.closeAllOverlays()}
/>

<AppShell
  sidebarVisible={ui.sidebarVisible}
  sidebarCollapsed={ui.sidebarCollapsed}
  rightPanelVisible={ui.aiChatVisible}
>
  {#snippet sidebar()}
    <SidebarContent
      {journalDates}
      onFileSelect={handleFileSelect}
      onDirToggle={handleDirToggle}
      onContextMenu={handleTreeContextMenu}
      onDelete={handleDeleteFile}
      onMove={handleFileMove}
      onRename={handleInlineRename}
      onDailyNote={handleDailyNote}
      onSidebarMenuOpen={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        sidebarMenuPosition = { top: rect.bottom + 4, left: rect.left };
        sidebarMenuVisible = true;
      }}
    />
  {/snippet}

  {#snippet content()}
    <ContentArea>
      {#snippet header()}
        <TabBarContent {isMarkdownActive} />
      {/snippet}

      {@render children()}
    </ContentArea>
  {/snippet}

</AppShell>

<FloatingChatBubble />

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

<Dialogs
  {exportDialogVisible}
  {exportDialogPath}
  onExport={handleExport}
  onExportCancel={() => exportDialogVisible = false}
  onFileOpen={(path) => { ui.hideTasks(); handleFileSelect(path); }}
/>

<ShareModal
  visible={shareModalVisible}
  content={shareContent}
  onclose={() => shareModalVisible = false}
/>

</FocusManager>

<style>
  /* ── Global ── */
  :global(html),
  :global(body) {
    height: 100%;
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-foreground);
    background: var(--color-background);
  }

</style>
