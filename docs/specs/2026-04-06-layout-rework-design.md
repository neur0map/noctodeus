# Layout Rework — Component Extraction + Spacing System

**Date:** 2026-04-06
**Status:** Approved

## Problem

The Midnight Tokyo color theme is applied, but the layout still feels generic and cramped. The root causes:

1. **`+layout.svelte` is a 1147-line monolith** — sidebar content, tab bar, utility rail, right panel, modals/dialogs, keyboard shortcuts, initialization, and theme logic all in one file. Impossible to iterate on individual regions.
2. **Inconsistent, cramped spacing** — sidebar body has 4px padding, search inputs have 5px padding, file tree rows are 28px, context menus have 3px padding. Meanwhile the editor gets luxurious 36px/28px. No unified spacing system.
3. **Unused layout variables** — `$shell-outer-gutter: 8px` and `$shell-frame-radius: 8px` are defined in SCSS but never applied. The app is a flat edge-to-edge rectangle with no frame presence.

Apps like Bear, Raycast, Arc, and Warp feel crafted because of generous consistent spacing, rounded frames, and breathing room between regions. The current layout lacks all three.

## Goal

**Pass 1:** Extract visual region components from the monolith. Zero visual changes. `+layout.svelte` shrinks to ~350-450 lines.

**Pass 2:** Define a spacing system and apply it everywhere. Add outer gutter + frame radius. Tune visually.

## Approach

Split by visual region — one component per zone. Non-visual concerns (init, theme, shortcuts, file handlers) stay in `+layout.svelte`. Shared state accessed via existing Svelte 5 rune stores (`ui.svelte.ts`, `files.svelte.ts`, `tabs.svelte.ts`, `settings.svelte.ts`).

**Snippet integration pattern:** Extracted components render inside the existing `{#snippet}` blocks in `+layout.svelte`. AppShell continues to receive snippets — each snippet simply renders the corresponding extracted component. This is the minimal-refactor approach that preserves the AppShell contract.

```svelte
<!-- Example: snippet renders extracted component -->
{#snippet utilityRail()}
  <UtilityRail onNewNote={handleNewNote} />
{/snippet}
```

**Scope:** Only `+layout.svelte` is refactored in this pass. `+page.svelte` (691 lines, contains QuickOpen and CommandPalette) is out of scope — it can be addressed in a future iteration.

---

## Pass 1: Component Extraction

### New Components

| Component | Location | Contents |
|-----------|----------|----------|
| `SidebarContent.svelte` | `src/lib/components/layout/` | Wraps the existing `<Sidebar>` component, providing all three snippet regions (header, children, footer). Contains: sidebar menu button, collapse toggle, search bar, file tree, calendar widget, core switcher. |
| `TabBarContent.svelte` | `src/lib/components/layout/` | Tab list rendering via `<TabBar>`, `<SaveIndicator>` snippet. Small component (~50-80 lines). |
| `UtilityRail.svelte` | `src/lib/components/layout/` | The 5 Nerd Font icon buttons (cmd, tasks, graph, panel, new). Already mostly extracted in Midnight Tokyo work. |
| `RightPanelContent.svelte` | `src/lib/components/layout/` | Graph panel section, backlinks panel, outline panel, note details panel, section switching. |
| `Dialogs.svelte` | `src/lib/components/layout/` | SettingsModal, TasksModal, ExportDialog, ToastContainer. Does NOT include QuickOpen or CommandPalette (those are in `+page.svelte`). Does NOT include ContextMenu (stays co-located with its trigger handlers in `+layout.svelte`). |

### What stays in `+layout.svelte`

**All non-visual logic:**
- Imports and composition of the 5 extracted components
- AppShell grid with `{#snippet}` blocks that render each component
- `$effect` blocks: theme application, accent color, fonts, custom CSS
- `onMount`/`onDestroy`: core initialization, file watcher setup, event listeners
- `FocusManager` and `KeyboardManager` wrappers (non-visual, wrap the entire app)
- Keyboard shortcut handlers (toggle UI state via stores)

**All file operation handlers:**
- `handleFileSelect`, `handleDirToggle`
- `handleDeleteFile`, `handleInlineRename`, `handleFileMove`
- `handleNewNote`, `handleNewFolder`, `handleDuplicateFile`
- `handleImportFiles`
- `EXPORT_CSS`, `handleExport`, `copyMediaForExport`

**Context menu system (stays co-located with handlers):**
- `ctxVisible`, `ctxPosition`, `ctxItems`, `ctxTargetPath`, `ctxTargetIsDir` state
- `handleTreeContextMenu`, `handleCtxSelect`
- Both `<ContextMenu>` renders (tree context menu + sidebar menu)

**Input dialog promise pattern (stays co-located with handlers):**
- `showInputDialog`, `cancelInputDialog`, `inputDialogCallback` state
- `<InputDialog>` render
- These use a promise-based pattern where `showInputDialog()` returns a `Promise<string>` that resolves when the user submits. The handlers that call it (rename, new folder, etc.) must be in the same component.

**Sidebar-specific handlers passed as props:**
- `handleSearch`, `searchResults` state → passed to `SidebarContent` via props
- `handleDailyNote`, `journalDates` → passed to `SidebarContent` via props
- `sidebarMenuItems`, `handleSidebarMenu` → passed to `SidebarContent` via props

**Utilities to extract to shared module:**
- `sanitizeFileName` → move to `src/lib/utils/files.ts` (used by multiple handlers)

### What moves to each component

**SidebarContent.svelte:**
- Template: `<Sidebar>` wrapper with header/children/footer snippets
- Header: menu button (triggers `handleSidebarMenu` via prop callback), collapse button
- Body: `<SearchBar>`, `<FileTree>`, `<CalendarWidget>`
- Footer: `<CoreSwitcher>`
- Styles: all `.sidebar-*` CSS rules from `+layout.svelte`
- Props received: `onFileSelect`, `onDirToggle`, `onContextMenu`, `onDelete`, `onMove`, `onRename`, `searchQuery`, `searchResults`, `onSearch`, `journalDates`, `onDailyNote`, `onSidebarMenu`, `onNewNote`

**TabBarContent.svelte:**
- Template: `<TabBar>` with tab data, `<SaveIndicator>` snippet
- Styles: minimal (TabBar has its own styles)
- Props: `isMarkdownActive` (for save indicator visibility)

**UtilityRail.svelte:**
- Template: 5 icon buttons
- Imports stores directly for active states (`ui.commandPaletteVisible`, etc.)
- Props: `onNewNote` callback
- Styles: `.utility-rail*` CSS rules

**RightPanelContent.svelte:**
- Template: conditional graph/backlinks/outline/details sections
- Imports stores directly for panel visibility
- Props: `onFileSelect` (for graph node click, backlink navigation)
- Styles: `.right-panel*` CSS rules

**Dialogs.svelte:**
- Template: `<SettingsModal>`, `<TasksModal>`, `<ExportDialog>`, `<ToastContainer>`
- Imports stores directly for visibility state
- Props: `onExport` callback (for export handler)
- Styles: none (each modal has its own styles)

### Target Line Counts

| File | Before | After |
|------|--------|-------|
| `+layout.svelte` | 1147 | ~350-450 |
| `SidebarContent.svelte` | — | ~200-250 |
| `TabBarContent.svelte` | — | ~50-80 |
| `UtilityRail.svelte` | — | ~80-100 |
| `RightPanelContent.svelte` | — | ~120-160 |
| `Dialogs.svelte` | — | ~60-100 |
| `src/lib/utils/files.ts` | — | ~20-30 (sanitizeFileName) |

### Verification

After extraction, the app must behave identically:
- All keyboard shortcuts work
- All modals open/close correctly
- Sidebar collapse/expand works
- Tab drag/drop works
- Right panel toggle works
- File operations (create, rename, delete) work
- Context menus work (both tree and sidebar menu)
- Input dialogs work (rename, new folder prompts)
- Theme/accent/font changes apply
- No TypeScript errors (`npm run check`)

---

## Pass 2: Spacing System + Frame

### Spacing Tokens

Define in `app.css` inside the `:root, .dark` block:

```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 12px;
--space-lg: 20px;
--space-xl: 32px;
```

These are starting values — tune visually after implementation. Some specific dimensions (e.g., tab height 34px, file tree row 32px) live outside the token scale as intentional one-offs.

### App Frame

Apply to the app shell container. Note: Tauri 2 on macOS uses native window decorations by default. The outer gutter creates an inset frame below the native title bar area.

- Outer gutter: `8px` padding on sides and bottom (app floats inside the window)
- Frame radius: `12px` border-radius on the app shell content area
- Frame background: the `<html>` body behind the gutter gets `#050811` (darker than base)
- Subtle inner shadow for depth: `inset 0 0 0 1px rgba(255,255,255,0.03)`
- `overflow: hidden` on the rounded container to clip child content

Implementation: modify `AppShell.svelte` `.app-shell` class. Also reconcile SCSS variables with actual grid values:
- `$right-panel-width` (380px in SCSS, 320px in grid) → unify
- `$utility-rail-width` (54px in SCSS, 48px in grid) → unify

### Region Spacing (starting values — tune visually)

**Sidebar (`SidebarContent.svelte`):**
- Header padding: `--space-md` all around
- Body padding: `--space-sm` horizontal
- Footer padding: `--space-md` all around
- Gap between header/body/footer: `--space-sm`

**File Tree (`FileTreeNode.svelte`):**
- Row height: `32px` (up from 28px)
- Horizontal padding: `--space-md` (up from 8px)
- Icon-to-text gap: `6px` (up from 4px)

**Search Bar (`SearchBar.svelte`):**
- Input padding: `--space-sm --space-md` (up from 5px 8px)
- Bottom margin: `--space-sm` (up from 4px)

**Tab Bar (`TabBarContent.svelte`):**
- Container height: `44px` (up from 42px)
- Tab gap: `--space-xs` (up from 2px)
- Tab horizontal padding: `--space-md` (up from 10px)
- Tab height: `34px` (up from 32px)

**Utility Rail (`UtilityRail.svelte`):**
- Button gap: `--space-sm` (up from 4px)
- Button padding: `10px 6px` (up from 8px 4px)
- Top padding: `--space-lg` (up from 12px)

**Right Panel (`RightPanelContent.svelte`):**
- Section header padding: `--space-md`
- Section body padding: `--space-sm --space-md --space-md`
- Between sections: `--space-sm` gap, no border separator (whitespace instead)

**Context Menu (`ContextMenu.svelte`):**
- Container padding: `6px` (up from 3px)
- Item padding: `--space-sm --space-md` (up from 6px 10px)

### What does NOT change
- Editor content spacing (already generous)
- AppShell grid column widths (except reconciling SCSS variables)
- Collapse/expand behavior
- Animation timing
- Color tokens

---

## Out of Scope

Deferred to future work:
- `+page.svelte` refactor (691 lines, contains QuickOpen + CommandPalette)
- Sidebar section grouping (rounded boxes for search/tree/calendar)
- Tab bar merged with title bar (Arc style)
- Right panel as slide-over with shadow
- Responsive/mobile layout
