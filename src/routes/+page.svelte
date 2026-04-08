<script lang="ts">
  import { onMount, untrack } from "svelte";

  import Dashboard from "../lib/components/dashboard/Dashboard.svelte";
  import QuickOpen from "../lib/components/quickopen/QuickOpen.svelte";
  import CommandPalette from "../lib/components/command/CommandPalette.svelte";
  import Worksurface from "../lib/components/layout/Worksurface.svelte";
  import EditorComponent from "../lib/editor/Editor.svelte";

  import type { Command } from "../lib/types/ui";

  import { getUiState } from "../lib/stores/ui.svelte";
  import { getCoreState } from "../lib/stores/core.svelte";
  import { getFilesState } from "../lib/stores/files.svelte";
  import { getEditorState } from "../lib/stores/editor.svelte";
  import { getGraphState } from "../lib/stores/graph.svelte";
  import { getTabsState } from "../lib/stores/tabs.svelte";
  import { getPinnedState } from "../lib/stores/pinned.svelte";
  import { getSyncState } from "../lib/stores/sync.svelte";
  import { syncSmart, syncPush, syncPull } from "../lib/bridge/sync";
  import {
    readFile,
    createFile,
    renameFile,
    openCore,
    createCore,
    scanCore,
    listCores,
  } from "../lib/bridge/commands";
  import { open as openDialog } from "@tauri-apps/plugin-dialog";
  import { toast } from "../lib/stores/toast.svelte";
  import { logger } from "../lib/logger";
  import { APP_SHORTCUTS, formatShortcutLabel } from "../lib/utils/shortcuts";
  import type { FileNode } from "../lib/types/core";
  import { parseMarkdown } from "../lib/editor/serializer";
  import PropertiesPanel from "../lib/components/editor/PropertiesPanel.svelte";
  import Eye from "@lucide/svelte/icons/eye";
  import PencilLine from "@lucide/svelte/icons/pencil-line";

  const ui = getUiState();
  const core = getCoreState();
  const files = getFilesState();
  const editorState = getEditorState();
  const tabsState = getTabsState();
  const graphState = getGraphState();
  const syncState = getSyncState();

  // --- State ---
  let currentFilePath = $state<string | null>(null);
  let currentContent = $state<string | null>(null);
  let currentMetadata = $state<FileNode | null>(null);
  const HIDDEN_NAMES = new Set(['.DS_Store', '.noctodeus', '.obsidian', '.logseq', 'logseq', '.git', '.gitignore', '.trash', '.svn', '.hg', '.vscode', 'node_modules', 'Thumbs.db', 'desktop.ini']);

  let recentFiles = $derived(
    Array.from(files.fileMap.values())
      .filter((f) => !f.is_directory && !HIDDEN_NAMES.has(f.name) && !f.name.startsWith('.'))
      .sort((a, b) => b.modified_at - a.modified_at)
      .slice(0, 10),
  );
  const pinned = getPinnedState();
  let editorRef: EditorComponent | undefined = $state();

  // Edit/View mode toggle
  let viewMode = $state(false);
  let renderedHtml = $state('');

  function toggleViewMode() {
    if (!viewMode) {
      // Flush editor content before switching to view
      editorRef?.flush();
      renderedHtml = parseMarkdown(currentContent ?? '');
    }
    viewMode = !viewMode;
  }

  // Inline title editing
  let inlineTitle = $state('');
  let titleInputEl: HTMLInputElement | undefined = $state();

  // Sync inline title when file changes
  $effect(() => {
    if (currentMetadata) {
      inlineTitle = currentMetadata.title || currentMetadata.name.replace(/\.(md|markdown)$/i, '');
    }
  });

  async function handleTitleRename() {
    if (!currentFilePath || !currentMetadata) return;
    const newName = inlineTitle.trim();
    if (!newName) {
      // Revert to original
      inlineTitle = currentMetadata.title || currentMetadata.name.replace(/\.(md|markdown)$/i, '');
      return;
    }

    // Build new filename (preserve extension)
    const ext = currentMetadata.extension ? `.${currentMetadata.extension}` : '.md';
    const cleanName = newName.replace(/[<>:"|?*\\/]/g, '').replace(/\s+/g, '-');
    const newFileName = cleanName.endsWith(ext) ? cleanName : `${cleanName}${ext}`;

    if (newFileName === currentMetadata.name) return;

    const parentDir = currentFilePath.includes('/')
      ? currentFilePath.slice(0, currentFilePath.lastIndexOf('/'))
      : '';
    const newPath = parentDir ? `${parentDir}/${newFileName}` : newFileName;

    try {
      const updated = await renameFile(currentFilePath, newPath);
      files.renameFile(currentFilePath, newPath, updated);
      tabsState.updateFileTab(currentFilePath, updated);
      currentFilePath = newPath;
      currentMetadata = updated;
    } catch (err) {
      toast.error(`Rename failed: ${err}`);
      inlineTitle = currentMetadata.title || currentMetadata.name.replace(/\.(md|markdown)$/i, '');
    }
  }

  function handleTitleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      inlineTitle = currentMetadata?.title || currentMetadata?.name.replace(/\.(md|markdown)$/i, '') || '';
      (e.target as HTMLInputElement).blur();
    }
  }

  async function handlePropertiesUpdate(newFrontmatter: string) {
    if (!currentFilePath || currentContent === null) return;
    const body = currentContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
    const newContent = newFrontmatter + body;
    currentContent = newContent;
    try {
      const { writeFile } = await import('../lib/bridge/commands');
      await writeFile(currentFilePath, newContent);
    } catch {}
  }

  let isMarkdown = $derived(
    currentFilePath?.endsWith(".md") || currentFilePath?.endsWith(".markdown"),
  );

  let quickOpenItems = $derived(
    Array.from(files.fileMap.values())
      .filter((f) => !f.is_directory)
      .map((f) => ({
        path: f.path,
        name: f.name,
        title: f.title,
        parentPath: f.parent_dir,
      })),
  );

  let commands: Command[] = $derived([
    {
      id: "new-note",
      label: "New Note",
      shortcut: formatShortcutLabel(APP_SHORTCUTS.new_note),
      action: handleNewNote,
    },
    {
      id: "open-file",
      label: "Search Files",
      shortcut: formatShortcutLabel(APP_SHORTCUTS.search),
      action: () => {
        ui.hideCommandPalette();
        ui.showQuickOpen();
      },
    },
    {
      id: "toggle-sidebar",
      label: "Toggle Sidebar",
      shortcut: formatShortcutLabel(APP_SHORTCUTS.toggle_sidebar),
      action: () => ui.toggleSidebar(),
    },
    {
      id: "toggle-right-panel",
      label: "Toggle Right Panel",
      shortcut: formatShortcutLabel(APP_SHORTCUTS.toggle_right_panel),
      action: () => ui.toggleRightPanel(),
    },
    {
      id: "sync-now",
      label: "Sync Now",
      action: async () => {
        ui.hideCommandPalette();
        const result = await syncState.sync();
        if (result) {
          const total = result.filesPushed + result.filesPulled;
          toast.success(total > 0 ? `Synced -- ${total} files updated` : 'Already up to date');
        } else if (syncState.lastError) {
          toast.error(`Sync failed: ${syncState.lastError}`);
        }
      },
    },
    {
      id: "sync-push",
      label: "Sync: Push Only",
      action: async () => {
        ui.hideCommandPalette();
        try {
          const result = await syncPush();
          toast.success(`Pushed ${result.filesPushed} file(s)`);
          await syncState.refresh();
        } catch (err) {
          toast.error(`Push failed: ${err}`);
        }
      },
    },
    {
      id: "sync-pull",
      label: "Sync: Pull Only",
      action: async () => {
        ui.hideCommandPalette();
        try {
          const result = await syncPull();
          toast.success(`Pulled ${result.filesPulled} file(s)`);
          await syncState.refresh();
        } catch (err) {
          toast.error(`Pull failed: ${err}`);
        }
      },
    },
    {
      id: "sync-settings",
      label: "Sync: Open Settings",
      action: () => {
        ui.hideCommandPalette();
        ui.showSettings();
      },
    },
    {
      id: "share-note",
      label: "Share: Encrypted Link",
      action: async () => {
        ui.hideCommandPalette();
        if (!currentFilePath || !currentContent) return;
        window.dispatchEvent(new CustomEvent('noctodeus-share', { detail: { content: currentContent } }));
      },
    },
    {
      id: "ai-chat",
      label: "AI: Open Chat",
      shortcut: formatShortcutLabel(APP_SHORTCUTS.toggle_ai_chat),
      action: () => {
        ui.hideCommandPalette();
        ui.toggleAiChat();
      },
    },
  ]);

  // --- Helpers ---
  function errorMessage(err: unknown): string {
    if (err && typeof err === "object" && "message" in err)
      return (err as any).message;
    if (typeof err === "string") return err;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  // --- File opening (imperative, not reactive) ---
  let opening = false;
  let viewKey = $state(0);

  async function openFile(path: string) {
    if (opening) return;
    opening = true;

    // Flush current editor if dirty
    if (editorRef && editorState.dirty) {
      try {
        await editorRef.flush();
      } catch {}
    }

    try {
      // Load content FIRST, then swap all state at once — no null flash
      const result = await readFile(path);
      editorRef = undefined;
      editorState.reset();
      currentContent = result.content;
      currentMetadata = result.metadata;
      currentFilePath = path;
      viewKey++;
      files.setActiveFile(path);
      const fileNode = files.fileMap.get(path);
      if (fileNode) {
        tabsState.openFile(fileNode);
      }
      await refreshHomeLists();
    } catch (err) {
      logger.error(`Failed to read file: ${errorMessage(err)}`);
      toast.error(`Failed to open: ${path}`);
    } finally {
      opening = false;
    }
  }

  function closeFile() {
    currentFilePath = null;
    currentContent = null;
    currentMetadata = null;
    editorRef = undefined;
    files.setActiveFile(null);
    editorState.reset();
    tabsState.goHome();
  }

  // --- Core management ---
  async function handleOpenCore() {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Open or Create Core",
      });
      if (!selected) return;
      const folderPath =
        typeof selected === "string" ? selected : String(selected);
      await openOrCreateCore(folderPath);
    } catch (err) {
      logger.error(`Failed to open Core: ${errorMessage(err)}`);
      toast.error(`Failed to open Core: ${errorMessage(err)}`);
    }
  }

  async function openOrCreateCore(folderPath: string) {
    let info;
    try {
      info = await openCore(folderPath);
      toast.success(`Opened Core: ${info.name}`);
    } catch {
      const name = folderPath.split("/").pop() ?? "Untitled";
      info = await createCore(folderPath, name);
      toast.success(`Created Core: ${info.name}`);
    }

    core.setCore(info);
    closeFile();
    const fileTree = await scanCore();
    files.setFiles(fileTree);
    await refreshHomeLists();
    graphState.scan(files.fileMap);
  }

  // --- Note creation ---
  async function handleNewNote() {
    ui.closeAllOverlays();
    if (!core.activeCore) {
      toast.error("Open a Core first");
      return;
    }
    try {
      const now = new Date();
      const name = `untitled-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}.md`;
      const node = await createFile(name, "");
      files.addFile(node);
      // Open the newly created file
      await openFile(node.path);
      await refreshHomeLists();
      toast.success("Note created");
    } catch (err) {
      toast.error(`Failed to create note: ${errorMessage(err)}`);
    }
  }

  async function refreshHomeLists() {
    if (!core.activeCore) return;
    try {
      await pinned.load();
    } catch (err) {
      logger.warn(`Failed to refresh home lists: ${errorMessage(err)}`);
    }
  }

  // --- Wiki-link navigation ---
  function handleWikiLinkNavigate(target: string) {
    const match = Array.from(files.fileMap.values()).find((f) => {
      if (f.is_directory) return false;
      const nameWithoutExt = f.name.replace(/\.(md|markdown)$/i, "");
      if (nameWithoutExt === target) return true;
      if (f.aliases?.some(a => a === target)) return true;
      return false;
    });
    if (match) {
      openFile(match.path);
    } else {
      toast.info(`Note "${target}" not found`);
    }
  }

  // --- Startup ---
  onMount(() => {
    // Auto-open last Core
    (async () => {
      try {
        const cores = await listCores();
        const lastCore = cores
          .filter((c) => c.last_opened)
          .sort((a, b) =>
            (b.last_opened ?? "").localeCompare(a.last_opened ?? ""),
          )[0];
        if (lastCore) {
          await openOrCreateCore(lastCore.path);
        }
      } catch {}
    })();

    // Safety net
    const handleBeforeUnload = () => {
      if (editorRef && editorState.dirty) {
        editorRef.flush();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    const handleOpenCoreEvent = () => handleOpenCore();
    window.addEventListener("noctodeus-open-core", handleOpenCoreEvent);

    const handleSwitchCoreEvent = (e: Event) => {
      const path = (e as CustomEvent).detail;
      if (path) openOrCreateCore(path);
    };
    window.addEventListener("noctodeus-switch-core", handleSwitchCoreEvent);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("noctodeus-open-core", handleOpenCoreEvent);
      window.removeEventListener("noctodeus-switch-core", handleSwitchCoreEvent);
    };
  });

  // Watch for sidebar file tree clicks (layout sets files.activeFilePath)
  let lastSeenPath = $state<string | null>(null);
  $effect(() => {
    const sidebarPath = files.activeFilePath;
    // untrack non-trigger deps to prevent effect loops
    const current = untrack(() => currentFilePath);
    const seen = untrack(() => lastSeenPath);
    if (sidebarPath && sidebarPath !== seen && sidebarPath !== current) {
      lastSeenPath = sidebarPath;
      openFile(sidebarPath);
    } else if (!sidebarPath && current) {
      lastSeenPath = null;
      closeFile();
    }
  });

  // Sync tab activation → file opening
  $effect(() => {
    const active = tabsState.activeTab;
    // untrack currentFilePath — only react to tab changes, not file state
    const current = untrack(() => currentFilePath);
    if (active.type === 'home') {
      if (current) {
        currentFilePath = null;
        currentContent = null;
        currentMetadata = null;
        editorRef = undefined;
        files.setActiveFile(null);
        editorState.reset();
      }
    } else if (active.type === 'file' && active.fileNode) {
      const path = active.fileNode.path;
      if (path !== current) {
        lastSeenPath = path;
        openFile(path);
      }
    }
  });

  // Get editor instance for toolbar (reactive to editorRef)

</script>

{#if currentFilePath && currentContent !== null}
  {#if isMarkdown}
    <Worksurface flush={true}>
      {#snippet toolbar()}
        <div class="inline-title-bar">
          <input
            class="inline-title"
            type="text"
            bind:this={titleInputEl}
            bind:value={inlineTitle}
            onblur={handleTitleRename}
            onkeydown={handleTitleKeydown}
            spellcheck="false"
          />
          <button class="view-toggle" onclick={toggleViewMode} title={viewMode ? 'Edit' : 'Preview'}>
            {#if viewMode}
              <PencilLine size={14} />
            {:else}
              <Eye size={14} />
            {/if}
          </button>
        </div>
      {/snippet}
      <PropertiesPanel
        content={currentContent ?? ''}
        onupdate={handlePropertiesUpdate}
      />
      {#if viewMode}
        <div class="rendered-view">
          {@html renderedHtml}
        </div>
      {:else}
        {#key viewKey}
          <div class="view-enter">
            <EditorComponent
              path={currentFilePath}
              initialContent={currentContent}
              onnavigate={handleWikiLinkNavigate}
              bind:this={editorRef}
            />
          </div>
        {/key}
      {/if}
    </Worksurface>
  {:else}
    <Worksurface>
      <div class="file-view">
        <div class="file-view__info">
          {#if currentMetadata}
            <div class="file-view__info-row">
              <span class="file-view__info-label">Name</span>
              <span class="file-view__info-value">{currentMetadata.name}</span>
            </div>
            <div class="file-view__info-row">
              <span class="file-view__info-label">Path</span>
              <span class="file-view__info-value">{currentMetadata.path}</span>
            </div>
            <div class="file-view__info-row">
              <span class="file-view__info-label">Size</span>
              <span class="file-view__info-value"
                >{currentMetadata.size} bytes</span
              >
            </div>
            {#if currentMetadata.extension}
              <div class="file-view__info-row">
                <span class="file-view__info-label">Extension</span>
                <span class="file-view__info-value"
                  >{currentMetadata.extension}</span
                >
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </Worksurface>
  {/if}
{:else}
  <Worksurface>
    <Dashboard
      coreName={core.activeCore?.name ?? "Noctodeus"}
      {recentFiles}
      pinnedFiles={pinned.files}
      totalNotes={Array.from(files.fileMap.values()).filter(f => !f.is_directory).length}
      graphStats={graphState.stats}
      graphScanning={graphState.scanning}
      graphNodes={graphState.nodes}
      graphEdges={graphState.edges}
      onfileopen={openFile}
    />
  </Worksurface>
{/if}

<QuickOpen
  visible={ui.quickOpenVisible}
  items={quickOpenItems}
  onselect={openFile}
  onclose={() => ui.hideQuickOpen()}
/>

<CommandPalette
  visible={ui.commandPaletteVisible}
  {commands}
  onclose={() => ui.hideCommandPalette()}
/>

<style>
  .inline-title-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 20px 28px 0;
    max-width: 780px;
    margin: 0 auto;
    width: 100%;
  }

  .inline-title {
    width: 100%;
    font-family: var(--font-sans);
    font-size: clamp(1.6rem, 2.5vw, 2.2rem);
    font-weight: 600;
    letter-spacing: -0.03em;
    color: var(--color-foreground);
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    caret-color: var(--color-accent);
  }

  .inline-title::placeholder {
    color: var(--color-placeholder);
  }

  .inline-title:focus {
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 4px;
    margin-bottom: -5px;
  }

  .view-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 150ms var(--ease-expo-out), background 150ms var(--ease-expo-out);
  }

  .view-toggle:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  .rendered-view {
    flex: 1;
    overflow-y: auto;
    padding: 8px 28px 40px;
    max-width: 780px;
    margin: 0 auto;
    width: 100%;
    font-family: var(--font-content);
    font-size: 14px;
    line-height: 1.8;
    color: var(--color-foreground);
    animation: content-fade 250ms var(--ease-expo-out) both;
  }

  .rendered-view :global(h1),
  .rendered-view :global(h2),
  .rendered-view :global(h3) {
    font-family: var(--font-sans);
    font-weight: 600;
    line-height: 1.3;
  }

  .rendered-view :global(h1) { font-size: clamp(2rem, 3vw, 2.8rem); margin: 24px 0 16px; letter-spacing: -0.04em; }
  .rendered-view :global(h2) { font-size: 20px; margin: 24px 0 12px; letter-spacing: -0.03em; }
  .rendered-view :global(h3) { font-size: 18px; margin: 20px 0 8px; }

  .rendered-view :global(p) { margin-bottom: 12px; }
  .rendered-view :global(a) { color: var(--color-accent); text-decoration: none; }
  .rendered-view :global(a:hover) { text-decoration: underline; }

  .rendered-view :global(pre) {
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 16px;
    overflow-x: auto;
    margin: 16px 0;
    font-family: var(--font-mono);
    font-size: 0.9em;
  }

  .rendered-view :global(code) {
    font-family: var(--font-mono);
    font-size: 0.9em;
    background: var(--color-hover);
    border-radius: 4px;
    padding: 2px 6px;
  }

  .rendered-view :global(pre code) { background: none; padding: 0; }

  .rendered-view :global(blockquote) {
    border-left: 2px solid var(--color-border);
    padding-left: 16px;
    color: var(--color-muted-foreground);
    margin: 16px 0;
    font-style: italic;
  }

  .rendered-view :global(table) { border-collapse: collapse; width: 100%; margin: 16px 0; }
  .rendered-view :global(th),
  .rendered-view :global(td) { border: 1px solid var(--color-border); padding: 8px 12px; text-align: left; }
  .rendered-view :global(th) { background: var(--color-card); font-weight: 600; }

  .rendered-view :global(hr) { border: none; border-top: 1px solid var(--color-border); margin: 32px 0; }

  .rendered-view :global(ul),
  .rendered-view :global(ol) { padding-left: 24px; margin: 12px 0; }

  .rendered-view :global(mark) { background: rgba(253, 224, 71, 0.65); border-radius: 3px; padding: 1px 4px; }

  .rendered-view :global(img) { max-width: 100%; border-radius: 8px; margin: 16px 0; }

  .view-enter {
    height: 100%;
    display: flex;
    flex-direction: column;
    animation: content-fade 150ms var(--ease-expo-out) both;
  }

  @keyframes content-fade {
    from { opacity: 0.6; }
    to { opacity: 1; }
  }

  .file-view {
    height: 100%;
    overflow-y: auto;
    padding: 28px;
  }

  .file-view__info {
    max-width: 680px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .file-view__info-row {
    display: flex;
    align-items: baseline;
    gap: 16px;
  }

  .file-view__info-label {
    flex-shrink: 0;
    width: 96px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .file-view__info-value {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-foreground);
    word-break: break-all;
  }
</style>
