<script lang="ts">
  import { onMount, untrack } from "svelte";

  import Dashboard from "../lib/components/dashboard/Dashboard.svelte";
  import QuickOpen from "../lib/components/quickopen/QuickOpen.svelte";
  import CommandPalette from "../lib/components/command/CommandPalette.svelte";
  import Worksurface from "../lib/components/layout/Worksurface.svelte";
  import EditorComponent from "../lib/editor/Editor.svelte";
  import EditorToolbar from "../lib/editor/EditorToolbar.svelte";
  import type { Command } from "../lib/types/ui";

  import { getUiState } from "../lib/stores/ui.svelte";
  import { getCoreState } from "../lib/stores/core.svelte";
  import { getFilesState } from "../lib/stores/files.svelte";
  import { getEditorState } from "../lib/stores/editor.svelte";
  import { getGraphState } from "../lib/stores/graph.svelte";
  import { getTabsState } from "../lib/stores/tabs.svelte";
  import {
    readFile,
    searchPinned,
    createFile,
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

  const ui = getUiState();
  const core = getCoreState();
  const files = getFilesState();
  const editorState = getEditorState();
  const tabsState = getTabsState();
  const graphState = getGraphState();

  // --- State ---
  let currentFilePath = $state<string | null>(null);
  let currentContent = $state<string | null>(null);
  let currentMetadata = $state<FileNode | null>(null);
  let recentFiles = $derived(
    Array.from(files.fileMap.values())
      .filter((f) => !f.is_directory)
      .sort((a, b) => b.modified_at - a.modified_at)
      .slice(0, 10),
  );
  let pinnedFiles = $state<FileNode[]>([]);
  let editorRef: EditorComponent | undefined = $state();

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
      label: "Open File",
      shortcut: formatShortcutLabel(APP_SHORTCUTS.quick_open),
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
    graphState.scan(files.fileMap, readFile);
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
    if (!core.activeCore) {
      pinnedFiles = [];
      return;
    }

    try {
      pinnedFiles = await searchPinned();
    } catch (err) {
      logger.warn(`Failed to refresh home lists: ${errorMessage(err)}`);
    }
  }

  // --- Wiki-link navigation ---
  function handleWikiLinkNavigate(target: string) {
    const match = Array.from(files.fileMap.values()).find((f) => {
      if (f.is_directory) return false;
      const nameWithoutExt = f.name.replace(/\.(md|markdown)$/i, "");
      return nameWithoutExt === target;
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
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
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
  let editorInstance = $derived(editorRef?.getEditor?.() ?? null);
</script>

{#if currentFilePath && currentContent !== null}
  {#if isMarkdown}
    <Worksurface flush={true}>
      {#snippet toolbar()}
        {#if editorInstance}
          <EditorToolbar editor={editorInstance} />
        {/if}
      {/snippet}

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
      {pinnedFiles}
      totalNotes={Array.from(files.fileMap.values()).filter(f => !f.is_directory).length}
      graphStats={graphState.stats}
      graphScanning={graphState.scanning}
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
  .view-enter {
    height: 100%;
    display: flex;
    flex-direction: column;
    animation: content-fade var(--duration-fast) var(--ease-out) both;
  }

  @keyframes content-fade {
    from { opacity: 0.6; }
    to { opacity: 1; }
  }

  .file-view {
    height: 100%;
    overflow-y: auto;
    padding: var(--stage-inner-padding);
  }

  .file-view__info {
    max-width: 680px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .file-view__info-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-4);
  }

  .file-view__info-label {
    flex-shrink: 0;
    width: 96px;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: rgba(255, 255, 255, 0.46);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .file-view__info-value {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    word-break: break-all;
  }
</style>
