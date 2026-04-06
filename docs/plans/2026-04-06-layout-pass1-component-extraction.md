# Layout Pass 1: Component Extraction — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract 5 visual region components from the 1147-line `+layout.svelte` monolith, reducing it to ~350-450 lines with zero visual changes.

**Architecture:** Each visual region becomes its own Svelte component in `src/lib/components/layout/`. Components render inside the existing `{#snippet}` blocks — AppShell's contract is unchanged. Components import stores directly via singleton getters (`getUiState()`, etc.). Event handlers that modify file state stay in `+layout.svelte` and are passed as props.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript

**Spec:** `docs/specs/2026-04-06-layout-rework-design.md`

---

## Chunk 1: Extract UtilityRail and RightPanelContent

### Task 1: Extract UtilityRail.svelte

**Files:**
- Create: `src/lib/components/layout/UtilityRail.svelte`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Create UtilityRail.svelte**

Cut the utility rail template (lines 830-876) and styles (lines 1059-1099) from `+layout.svelte` into a new component.

```svelte
<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import { getUiState } from "$lib/stores/ui.svelte";
  import { nerdIcon } from "$lib/utils/nerd-icons";

  let { onNewNote }: { onNewNote: () => void } = $props();

  const ui = getUiState();
</script>

<div class="utility-rail">
  <button
    class="utility-rail__button"
    class:utility-rail__button--active={ui.commandPaletteVisible}
    onclick={() => ui.showCommandPalette()}
    title="Command palette"
  >
    <span class="utility-rail__icon">{nerdIcon('search')}</span>
    <span class="utility-rail__label">cmd</span>
  </button>
  <button
    class="utility-rail__button"
    class:utility-rail__button--active={ui.tasksVisible}
    onclick={() => ui.showTasks()}
    title="Tasks"
  >
    <span class="utility-rail__icon">{nerdIcon('tasks')}</span>
    <span class="utility-rail__label">tasks</span>
  </button>
  <button
    class="utility-rail__button"
    class:utility-rail__button--active={ui.graphPanelVisible}
    onclick={() => ui.toggleGraphPanel()}
    title="Toggle graph"
  >
    <span class="utility-rail__icon">{nerdIcon('graph')}</span>
    <span class="utility-rail__label">graph</span>
  </button>
  <button
    class="utility-rail__button"
    class:utility-rail__button--active={ui.rightPanelVisible}
    onclick={() => ui.toggleRightPanel()}
    title="Toggle detail rail"
  >
    <span class="utility-rail__icon">{nerdIcon('info')}</span>
    <span class="utility-rail__label">panel</span>
  </button>
  <button
    class="utility-rail__button"
    onclick={onNewNote}
    title="New note"
  >
    <Plus size={16} />
    <span class="utility-rail__label">new</span>
  </button>
</div>

<style>
  .utility-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding-top: 12px;
  }

  .utility-rail__button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    color: var(--text-muted, var(--color-placeholder));
    transition: color 150ms ease-out;
    cursor: pointer;
    background: none;
    border: none;
    width: 100%;
  }

  .utility-rail__button:hover {
    color: var(--text-secondary, var(--color-muted-foreground));
  }

  .utility-rail__button--active {
    color: var(--accent-blue, var(--color-accent));
  }

  .utility-rail__icon {
    font-family: var(--font-mono);
    font-size: 16px;
    line-height: 1;
  }

  .utility-rail__label {
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1;
  }
</style>
```

- [ ] **Step 2: Update +layout.svelte to use UtilityRail**

Import the new component and replace the snippet body:

```svelte
<!-- Add import -->
import UtilityRail from "../lib/components/layout/UtilityRail.svelte";

<!-- Replace snippet body -->
{#snippet utilityRail()}
  <UtilityRail onNewNote={handleNewNote} />
{/snippet}
```

Remove the `.utility-rail*` styles from `+layout.svelte`'s `<style>` block (lines 1059-1099).

Remove the `nerdIcon` import from `+layout.svelte` if it's no longer used elsewhere in the file (check first — it may be used in other places).

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: 0 errors.

Manually test: utility rail buttons all work (command palette, tasks, graph, panel toggle, new note).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/layout/UtilityRail.svelte src/routes/+layout.svelte
git commit -m "refactor: extract UtilityRail component from +layout.svelte"
```

---

### Task 2: Extract RightPanelContent.svelte

**Files:**
- Create: `src/lib/components/layout/RightPanelContent.svelte`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Create RightPanelContent.svelte**

Cut the right panel template (lines 878-917) and styles (lines 1101-1147) from `+layout.svelte`.

```svelte
<script lang="ts">
  import GraphView from "$lib/components/graph/GraphView.svelte";
  import BacklinksPanel from "$lib/components/panels/BacklinksPanel.svelte";
  import OutlinePanel from "$lib/components/panels/OutlinePanel.svelte";
  import NoteDetailsPanel from "$lib/components/panels/NoteDetailsPanel.svelte";
  import { getUiState } from "$lib/stores/ui.svelte";
  import { getFilesState } from "$lib/stores/files.svelte";
  import { getGraphState } from "$lib/stores/graph.svelte";
  import { getActiveEditorState } from "$lib/stores/active-editor.svelte";

  let { onFileSelect }: { onFileSelect: (path: string) => void } = $props();

  const ui = getUiState();
  const files = getFilesState();
  const graphState = getGraphState();
  const activeEditorState = getActiveEditorState();
</script>

<div class="right-panel">
  {#if ui.graphPanelVisible}
    <div class="right-panel__section right-panel__section--graph">
      <div class="right-panel__section-header">
        <span class="right-panel__section-label">Graph</span>
      </div>
      <div class="right-panel__graph-body">
        <GraphView
          nodes={graphState.nodes}
          edges={graphState.edges}
          activeFilePath={files.activeFilePath}
          onselect={onFileSelect}
        />
      </div>
    </div>
  {/if}

  {#if ui.rightPanelVisible}
    <div class="right-panel__section right-panel__section--scroll">
      <NoteDetailsPanel
        editor={activeEditorState.editor}
        fileNode={files.activeFilePath ? files.fileMap.get(files.activeFilePath) ?? null : null}
      />
      <OutlinePanel editor={activeEditorState.editor} />
    </div>

    <div class="right-panel__section right-panel__section--scroll">
      <BacklinksPanel
        currentPath={files.activeFilePath}
        currentTitle={files.activeFilePath ? (files.fileMap.get(files.activeFilePath)?.title ?? null) : null}
        currentAliases={files.activeFilePath ? (files.fileMap.get(files.activeFilePath)?.aliases ?? []) : []}
        nodes={graphState.nodes}
        edges={graphState.edges}
        onselect={onFileSelect}
      />
    </div>
  {/if}
</div>

<style>
  /* Paste all .right-panel* styles from +layout.svelte here */
  .right-panel { /* ... */ }
  /* etc. — exact copy of lines 1101-1147 */
</style>
```

- [ ] **Step 2: Update +layout.svelte**

Import the component and replace the snippet:

```svelte
import RightPanelContent from "../lib/components/layout/RightPanelContent.svelte";

{#snippet rightPanel()}
  <RightPanelContent onFileSelect={handleFileSelect} />
{/snippet}
```

Remove `.right-panel*` styles from `+layout.svelte`. Remove now-unused imports: `GraphView`, `BacklinksPanel`, `OutlinePanel`, `NoteDetailsPanel`, `getGraphState`, `getActiveEditorState` — but ONLY if they are not used elsewhere in the file. Check each one.

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: 0 errors.

Manually test: graph panel toggle, backlinks panel, outline panel, note details panel. Click a graph node to navigate.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/layout/RightPanelContent.svelte src/routes/+layout.svelte
git commit -m "refactor: extract RightPanelContent component from +layout.svelte"
```

---

## Chunk 2: Extract SidebarContent, TabBarContent, Dialogs

### Task 3: Extract SidebarContent.svelte

**Files:**
- Create: `src/lib/components/layout/SidebarContent.svelte`
- Modify: `src/routes/+layout.svelte`

This is the largest extraction. The sidebar snippet (lines 752-805) wraps the `<Sidebar>` component with header, body, and footer snippets.

- [ ] **Step 1: Create SidebarContent.svelte**

The component wraps `<Sidebar>` and provides all three snippet regions.

```svelte
<script lang="ts">
  import type { SearchHit } from "$lib/types/core";
  import type { FileNode } from "$lib/types/core";
  import Sidebar from "$lib/components/layout/Sidebar.svelte";
  import SearchBar from "$lib/components/search/SearchBar.svelte";
  import FileTree from "$lib/components/filetree/FileTree.svelte";
  import CalendarWidget from "$lib/components/sidebar/CalendarWidget.svelte";
  import CoreSwitcher from "$lib/components/common/CoreSwitcher.svelte";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import Settings from "@lucide/svelte/icons/settings";
  import { getUiState } from "$lib/stores/ui.svelte";
  import { getCoreState } from "$lib/stores/core.svelte";
  import { getFilesState } from "$lib/stores/files.svelte";

  let {
    searchResults,
    journalDates,
    onFileSelect,
    onDirToggle,
    onContextMenu,
    onDelete,
    onMove,
    onRename,
    onSearch,
    onDailyNote,
    onSidebarMenuOpen,
  }: {
    searchResults: SearchHit[];
    journalDates: Set<string>;
    onFileSelect: (path: string) => void;
    onDirToggle: (path: string) => void;
    onContextMenu: (e: MouseEvent, node: FileNode) => void;
    onDelete: (path: string) => void;
    onMove: (oldPath: string, newPath: string) => void;
    onRename: (path: string) => void;
    onSearch: (query: string) => void;
    onDailyNote: (dateStr: string) => void;
    onSidebarMenuOpen: (e: MouseEvent) => void;
  } = $props();

  const ui = getUiState();
  const core = getCoreState();
  const files = getFilesState();
</script>

<Sidebar collapsed={ui.sidebarCollapsed} ontogglecollapse={() => ui.toggleSidebarCollapse()}>
  {#snippet header()}
    <div class="sidebar-header">
      <button class="sidebar-header__btn" onclick={onSidebarMenuOpen} title="Actions">
        <Ellipsis size={14} />
      </button>
    </div>
  {/snippet}

  <SearchBar
    results={searchResults}
    onselect={onFileSelect}
    onsearch={onSearch}
  />

  <FileTree
    tree={files.tree}
    activeFilePath={files.activeFilePath}
    onselect={onFileSelect}
    ontoggle={onDirToggle}
    oncontextmenu={onContextMenu}
    ondelete={onDelete}
    onmove={onMove}
    onrename={onRename}
  />

  <CalendarWidget
    existingDates={journalDates}
    onselect={onDailyNote}
  />

  {#snippet footer()}
    <div class="sidebar-footer">
      <CoreSwitcher
        activeCore={core.activeCore}
        onswitch={(c) => window.dispatchEvent(new CustomEvent('noctodeus-switch-core', { detail: c.path }))}
        onopen={() => window.dispatchEvent(new CustomEvent('noctodeus-open-core'))}
      />
      <button
        class="sidebar-footer__settings"
        onclick={() => ui.showSettings()}
        title="Settings"
      >
        <Settings size={15} />
      </button>
    </div>
  {/snippet}
</Sidebar>

<style>
  /* Paste .sidebar-header* and .sidebar-footer* styles here */
  .sidebar-header { /* ... exact copy from +layout.svelte lines 979-1016 */ }
  .sidebar-footer { /* ... exact copy from +layout.svelte lines 1019-1056 */ }
</style>
```

Note: The `onContextMenu` prop type uses `FileNode` — check the exact type signature of the `FileTree` `oncontextmenu` prop and match it. The `onSidebarMenuOpen` callback handles the ellipsis menu button click — the layout passes `(e: MouseEvent) => { sidebarMenuPosition = ...; sidebarMenuVisible = true; }` logic.

- [ ] **Step 2: Update +layout.svelte**

Import and replace the sidebar snippet:

```svelte
import SidebarContent from "../lib/components/layout/SidebarContent.svelte";

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
```

Remove `.sidebar-header*` and `.sidebar-footer*` styles from `+layout.svelte`.

Remove now-unused imports: `Sidebar`, `SearchBar`, `FileTree`, `CalendarWidget`, `CoreSwitcher`, `Ellipsis`, `Settings` — only if not used elsewhere.

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: 0 errors.

Manually test: sidebar shows search, file tree, calendar, core switcher. Ellipsis menu opens. File tree context menu works. Calendar daily note creation works. Core switching works. Collapse/expand works.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/layout/SidebarContent.svelte src/routes/+layout.svelte
git commit -m "refactor: extract SidebarContent component from +layout.svelte"
```

---

### Task 4: Extract TabBarContent.svelte

**Files:**
- Create: `src/lib/components/layout/TabBarContent.svelte`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Create TabBarContent.svelte**

This is a small component — the tab bar snippet is only ~16 lines of template.

```svelte
<script lang="ts">
  import TabBar from "$lib/components/tabs/TabBar.svelte";
  import SaveIndicator from "$lib/editor/SaveIndicator.svelte";
  import { getTabsState } from "$lib/stores/tabs.svelte";
  import { getEditorState } from "$lib/stores/editor.svelte";

  let { isMarkdownActive }: { isMarkdownActive: boolean } = $props();

  const tabsState = getTabsState();
  const editor = getEditorState();
</script>

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
```

- [ ] **Step 2: Update +layout.svelte**

```svelte
import TabBarContent from "../lib/components/layout/TabBarContent.svelte";

{#snippet content()}
  <ContentArea>
    {#snippet header()}
      <TabBarContent {isMarkdownActive} />
    {/snippet}

    {@render children()}
  </ContentArea>
{/snippet}
```

Remove now-unused imports: `TabBar`, `SaveIndicator` — only if not used elsewhere.

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: 0 errors.

Manually test: tabs render, activate, close, reorder via drag. Save indicator shows for markdown files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/layout/TabBarContent.svelte src/routes/+layout.svelte
git commit -m "refactor: extract TabBarContent component from +layout.svelte"
```

---

### Task 5: Extract Dialogs.svelte

**Files:**
- Create: `src/lib/components/layout/Dialogs.svelte`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Create Dialogs.svelte**

This component contains SettingsModal, TasksModal, ExportDialog, and ToastContainer. Context menus and InputDialog stay in `+layout.svelte` (co-located with their handlers).

```svelte
<script lang="ts">
  import SettingsModal from "$lib/components/common/SettingsModal.svelte";
  import TasksModal from "$lib/components/common/TasksModal.svelte";
  import ExportDialog from "$lib/components/common/ExportDialog.svelte";
  import ToastContainer from "$lib/components/common/ToastContainer.svelte";
  import { getUiState } from "$lib/stores/ui.svelte";

  let {
    exportDialogVisible,
    exportDialogPath,
    onExport,
    onExportCancel,
    onFileOpen,
  }: {
    exportDialogVisible: boolean;
    exportDialogPath: string | null;
    onExport: (format: string, path: string, includeMedia: boolean) => void;
    onExportCancel: () => void;
    onFileOpen: (path: string) => void;
  } = $props();

  const ui = getUiState();
</script>

<ToastContainer />

<SettingsModal
  visible={ui.settingsVisible}
  onclose={() => ui.hideSettings()}
/>

<ExportDialog
  visible={exportDialogVisible}
  filePath={exportDialogPath}
  onexport={onExport}
  oncancel={onExportCancel}
/>

<TasksModal
  visible={ui.tasksVisible}
  onclose={() => ui.hideTasks()}
  onfileopen={onFileOpen}
/>
```

No `<style>` block needed — each modal has its own styles.

- [ ] **Step 2: Update +layout.svelte**

Import and place the component after the `</AppShell>` tag, replacing the individual modal renders:

```svelte
import Dialogs from "../lib/components/layout/Dialogs.svelte";

<!-- After </AppShell> and before the ContextMenu renders: -->
<Dialogs
  {exportDialogVisible}
  {exportDialogPath}
  onExport={handleExport}
  onExportCancel={() => exportDialogVisible = false}
  onFileOpen={(path) => { ui.hideTasks(); handleFileSelect(path); }}
/>
```

Remove the individual `<ToastContainer />`, `<SettingsModal>`, `<ExportDialog>`, and `<TasksModal>` renders from `+layout.svelte`.

Remove now-unused imports: `ToastContainer`, `SettingsModal`, `ExportDialog`, `TasksModal` — only if not used elsewhere.

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: 0 errors.

Manually test: Settings modal (gear icon or Cmd+,), Tasks modal (tasks button), Export dialog (via context menu on file), Toast notifications.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/layout/Dialogs.svelte src/routes/+layout.svelte
git commit -m "refactor: extract Dialogs component from +layout.svelte"
```

---

## Chunk 3: Extract sanitizeFileName + Final Cleanup

### Task 6: Extract sanitizeFileName to shared utility

**Files:**
- Create: `src/lib/utils/files.ts`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Create src/lib/utils/files.ts**

Find the `sanitizeFileName` function in `+layout.svelte` and move it:

```typescript
/**
 * Sanitize a file name by removing or replacing invalid characters.
 */
export function sanitizeFileName(name: string): string {
  // Copy the exact implementation from +layout.svelte
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

Check the actual implementation in `+layout.svelte` first — copy it exactly.

- [ ] **Step 2: Update +layout.svelte**

Replace the local function with an import:

```typescript
import { sanitizeFileName } from "$lib/utils/files";
```

Remove the local `sanitizeFileName` function definition.

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: 0 errors.

Manually test: rename a file, create a new file with special characters.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/files.ts src/routes/+layout.svelte
git commit -m "refactor: extract sanitizeFileName to shared utility"
```

---

### Task 7: Clean up unused imports and verify final state

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Audit remaining imports**

Read the final `+layout.svelte` and check every import. Remove any that are no longer used after the 5 extractions. Common candidates:
- `GraphView`, `BacklinksPanel`, `OutlinePanel`, `NoteDetailsPanel` (moved to RightPanelContent)
- `Sidebar`, `SearchBar`, `FileTree`, `CalendarWidget`, `CoreSwitcher` (moved to SidebarContent)
- `TabBar`, `SaveIndicator` (moved to TabBarContent)
- `ToastContainer`, `SettingsModal`, `ExportDialog`, `TasksModal` (moved to Dialogs)
- `Ellipsis`, `Settings` Lucide icons (moved to SidebarContent)
- `nerdIcon` (moved to UtilityRail — check if used elsewhere)
- `getGraphState`, `getActiveEditorState` (moved to RightPanelContent — check if used elsewhere)

Only remove imports that have ZERO remaining references in the file.

- [ ] **Step 2: Audit remaining styles**

Check the `<style>` block. After extraction, only these should remain:
- Global html/body styles (lines 966-976)
- Any styles still referenced by remaining template elements

Remove any orphaned CSS rules.

- [ ] **Step 3: Count final lines**

Run: `wc -l src/routes/+layout.svelte`
Expected: ~350-450 lines. If significantly more, check if something was missed.

- [ ] **Step 4: Full verification**

Run: `npm run check`
Expected: 0 errors.

Full manual walkthrough:
- [ ] App loads, sidebar shows
- [ ] File tree navigation works
- [ ] Search works
- [ ] Calendar widget works
- [ ] Core switcher works
- [ ] Sidebar collapse/expand works
- [ ] Tab bar: open, close, reorder, switch tabs
- [ ] Utility rail: all 5 buttons work
- [ ] Right panel: graph, backlinks, outline, details
- [ ] Context menu on file tree
- [ ] Sidebar ellipsis menu
- [ ] Settings modal
- [ ] Tasks modal
- [ ] Export dialog
- [ ] Input dialog (rename file, new folder)
- [ ] Keyboard shortcuts (Cmd+K, Cmd+N, etc.)
- [ ] Toast notifications
- [ ] Theme/accent changes apply

- [ ] **Step 5: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "refactor: clean up imports and styles after component extraction"
```

---

## Summary

| Task | Component | Lines extracted |
|------|-----------|---------------|
| 1 | UtilityRail.svelte | ~80 (template + styles) |
| 2 | RightPanelContent.svelte | ~85 (template + styles) |
| 3 | SidebarContent.svelte | ~130 (template + styles) |
| 4 | TabBarContent.svelte | ~35 (template) |
| 5 | Dialogs.svelte | ~45 (template) |
| 6 | files.ts utility | ~10 (function) |
| 7 | Cleanup | removes dead imports/styles |

**Total commits:** 7
**Visual changes:** None — this is a pure refactor.
