<script lang="ts">
  import "../lib/styles/app.css";
  import "../lib/styles/app.scss";
  import "../lib/styles/fonts.css";

  import type { Snippet } from "svelte";
  import { onMount, onDestroy } from "svelte";
  import { applyTheme, watchSystemTheme } from "../lib/utils/theme";
  import type { UnlistenFn } from "@tauri-apps/api/event";

  import AppShell from "../lib/components/layout/AppShell.svelte";
  import SidebarContent from "../lib/components/layout/SidebarContent.svelte";
  import ContentArea from "../lib/components/layout/ContentArea.svelte";
  import TabBar from "../lib/components/tabs/TabBar.svelte";
  import ContextMenu from "../lib/components/common/ContextMenu.svelte";
  import type { MenuItem } from "../lib/components/common/ContextMenu.svelte";
  import InputDialog from "../lib/components/common/InputDialog.svelte";
  import KeyboardManager from "../lib/components/common/KeyboardManager.svelte";
  import ToastContainer from "../lib/components/common/ToastContainer.svelte";
  import SaveIndicator from "../lib/editor/SaveIndicator.svelte";
  import SettingsModal from "../lib/components/common/SettingsModal.svelte";
  import ExportDialog from "../lib/components/common/ExportDialog.svelte";
  import RightPanelContent from "../lib/components/layout/RightPanelContent.svelte";
  import { getSettings } from "../lib/stores/settings.svelte";

  import { getUiState } from "../lib/stores/ui.svelte";
  import { getCoreState } from "../lib/stores/core.svelte";
  import { getFilesState } from "../lib/stores/files.svelte";
  import { getEditorState } from "../lib/stores/editor.svelte";
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
  import { APP_SHORTCUTS } from "../lib/utils/shortcuts";

  import UtilityRail from "../lib/components/layout/UtilityRail.svelte";
  import TasksModal from "../lib/components/common/TasksModal.svelte";
  import FocusManager from "../lib/components/common/FocusManager.svelte";

  let { children }: { children: Snippet } = $props();

  const ui = getUiState();
  const core = getCoreState();
  const files = getFilesState();
  const editor = getEditorState();
  const tabsState = getTabsState();
  const appSettings = getSettings();
  const pinned = getPinnedState();

  // Apply theme reactively
  let unwatchTheme: (() => void) | undefined;
  $effect(() => {
    const mode = appSettings.theme;
    applyTheme(mode);
    unwatchTheme?.();
    unwatchTheme = watchSystemTheme(mode, () => applyTheme(mode));
  });

  // Apply custom appearance settings reactively
  $effect(() => {
    const root = document.documentElement;
    const accent = appSettings.accentColor;
    if (accent && accent !== '#7AA2F7') {
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--primary', accent);
      root.style.setProperty('--ring', accent);
      root.style.setProperty('--sidebar-primary', accent);
      root.style.setProperty('--sidebar-ring', accent);
    } else {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--sidebar-primary');
      root.style.removeProperty('--sidebar-ring');
    }

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
  let overlayOpen = $derived(ui.quickOpenVisible || ui.commandPaletteVisible);

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
      { id: 'sep1', label: '', separator: true },
      { id: 'delete', label: 'Delete', danger: true },
    ];
    ctxVisible = true;
  }

  function sanitizeFileName(name: string, isDir: boolean): string {
    // Replace spaces with dashes
    let clean = name.trim().replace(/\s+/g, '-');
    // Remove unsafe characters
    clean = clean.replace(/[<>:"|?*\\]/g, '');
    // Ensure default extension for files (not directories)
    if (!isDir && !clean.includes('.')) {
      clean += appSettings.defaultExtension;
    }
    return clean;
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

  const EXPORT_CSS = `body{font-family:system-ui,-apple-system,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#e0e0e0;background:#0A0E1A;line-height:1.7;}a{color:#7AA2F7;}pre{background:#111;padding:1rem;border-radius:8px;overflow-x:auto;}code{font-family:monospace;font-size:0.9em;}img{max-width:100%;border-radius:8px;}blockquote{border-left:3px solid #444;padding-left:1rem;color:#aaa;}h1,h2,h3{font-weight:600;letter-spacing:-0.02em;}`;

  function stripMediaFromMarkdown(md: string): string {
    // Remove image/video/audio lines: ![...](...)
    return md.replace(/^!\[.*?\]\(.*?\).*$/gm, '').replace(/\n{3,}/g, '\n\n');
  }

  function escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  async function handleExport(format: string, includeMedia: boolean) {
    exportDialogVisible = false;
    const targetPath = exportDialogPath;
    if (!targetPath) return;

    const { readFile } = await import('../lib/bridge/commands');
    const { save: saveDialog } = await import('@tauri-apps/plugin-dialog');
    const { writeFile: tauriWrite } = await import('@tauri-apps/plugin-fs');
    const { toast } = await import('../lib/stores/toast.svelte');

    try {
      const baseName = targetPath.split('/').pop()?.replace(/\.(md|markdown)$/i, '') ?? 'export';

      if (format === 'markdown') {
        const { content } = await readFile(targetPath);
        const output = includeMedia ? content : stripMediaFromMarkdown(content);
        const savePath = await saveDialog({
          defaultPath: `${baseName}.md`,
          filters: [{ name: 'Markdown', extensions: ['md'] }],
        });
        if (!savePath) return;
        await tauriWrite(savePath, new TextEncoder().encode(output));

        if (includeMedia) {
          await copyMediaForExport(content, savePath);
        }
        toast.success(`Exported ${baseName}.md`);

      } else if (format === 'html') {
        const { content } = await readFile(targetPath);
        const md = includeMedia ? content : stripMediaFromMarkdown(content);
        const { parseMarkdown } = await import('../lib/editor/serializer');
        const html = parseMarkdown(md);
        const fullHtml = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${baseName}</title>\n<style>${EXPORT_CSS}</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;
        const savePath = await saveDialog({
          defaultPath: `${baseName}.html`,
          filters: [{ name: 'HTML', extensions: ['html'] }],
        });
        if (!savePath) return;
        await tauriWrite(savePath, new TextEncoder().encode(fullHtml));

        if (includeMedia) {
          await copyMediaForExport(content, savePath);
        }
        toast.success(`Exported ${baseName}.html`);

      } else if (format === 'csv') {
        // Export ALL markdown files as CSV
        const allFiles = Array.from(files.fileMap.values()).filter(f => !f.is_directory && (f.extension === 'md' || f.extension === 'markdown'));
        const rows: string[] = ['path,title,content'];
        for (const file of allFiles) {
          try {
            const { content } = await readFile(file.path);
            const md = includeMedia ? content : stripMediaFromMarkdown(content);
            rows.push(`${escapeCsvField(file.path)},${escapeCsvField(file.title ?? '')},${escapeCsvField(md)}`);
          } catch {
            rows.push(`${escapeCsvField(file.path)},${escapeCsvField(file.title ?? '')},""`);
          }
        }
        const csvContent = rows.join('\n');
        const savePath = await saveDialog({
          defaultPath: `${core.activeCore?.name ?? 'noctodeus'}-export.csv`,
          filters: [{ name: 'CSV', extensions: ['csv'] }],
        });
        if (!savePath) return;
        await tauriWrite(savePath, new TextEncoder().encode(csvContent));
        toast.success(`Exported ${allFiles.length} files to CSV`);
      }
    } catch (err) {
      logger.error(`Export failed: ${err}`);
      const { toast } = await import('../lib/stores/toast.svelte');
      toast.error(`Export failed: ${err}`);
    }
  }

  async function copyMediaForExport(content: string, exportPath: string) {
    // Find all media references in the markdown
    const mediaRefs = [...content.matchAll(/!\[.*?\]\((.*?)\)/g)]
      .map(m => m[1])
      .filter(src => src && !src.startsWith('http'));

    if (mediaRefs.length === 0) return;

    const corePath = core.activeCore?.path;
    if (!corePath) return;

    const { mkdir, copyFile } = await import('@tauri-apps/plugin-fs');
    const exportDir = exportPath.substring(0, exportPath.lastIndexOf('/'));
    const mediaDir = `${exportDir}/media`;

    try {
      await mkdir(mediaDir, { recursive: true });
    } catch {
      // may already exist
    }

    for (const ref of mediaRefs) {
      try {
        const srcPath = `${corePath}/${ref}`;
        const destPath = `${exportDir}/${ref}`;
        const destDir = destPath.substring(0, destPath.lastIndexOf('/'));
        try { await mkdir(destDir, { recursive: true }); } catch {}
        await copyFile(srcPath, destPath);
      } catch {
        // skip files that can't be copied
      }
    }
  }
</script>

<FocusManager {overlayOpen}>

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
  rightPanelVisible={ui.rightPanelVisible || ui.graphPanelVisible}
>
  {#snippet sidebar()}
    <SidebarContent
      {searchResults}
      {journalDates}
      onFileSelect={handleFileSelect}
      onDirToggle={handleDirToggle}
      onContextMenu={handleTreeContextMenu}
      onDelete={handleDeleteFile}
      onMove={handleFileMove}
      onRename={handleInlineRename}
      onSearch={handleSearch}
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
    <UtilityRail onNewNote={handleNewNote} />
  {/snippet}

  {#snippet rightPanel()}
    <RightPanelContent onFileSelect={handleFileSelect} />
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

<SettingsModal
  visible={ui.settingsVisible}
  onclose={() => ui.hideSettings()}
/>

<ExportDialog
  visible={exportDialogVisible}
  filePath={exportDialogPath}
  onexport={handleExport}
  oncancel={() => exportDialogVisible = false}
/>

<TasksModal
  visible={ui.tasksVisible}
  onclose={() => ui.hideTasks()}
  onfileopen={(path) => { ui.hideTasks(); handleFileSelect(path); }}
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
