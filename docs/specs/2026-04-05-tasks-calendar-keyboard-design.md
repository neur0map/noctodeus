# Task Extraction, Daily Notes Calendar, Keyboard Navigation

**Date:** 2026-04-05
**Status:** Approved

## 1. Task Extraction Modal

**Trigger:** Utility rail button with ListChecks Lucide icon. Opens a full modal (same pattern as SettingsModal).

**Layout:** Title bar with close button. Three filter tabs (All / Todo / Done) as pill buttons. Scrollable body with tasks grouped by file.

**Data flow:** On open, iterates files.fileMap, calls readFile for each markdown file, regex-parses `- [ ]` and `- [x]` lines, builds grouped task list. Cached until modal closes.

**Task item:** Checkbox + task text. Checked tasks get muted color + strikethrough. Click the file header to open the file.

**Styling:** Same modal chrome as SettingsModal (popover bg, border, shadow, blur backdrop). Filter tabs use pill buttons with accent active state. Tasks mono 13px. File headers 10px uppercase mono.

**Component:** `src/lib/components/common/TasksModal.svelte`

**UI state:** Add `tasksVisible` to ui.svelte.ts store with `showTasks()` / `hideTasks()`.

## 2. Daily Notes with Calendar

**Placement:** Sidebar, between search bar and file tree. Compact month grid.

**Calendar component:** `src/lib/components/sidebar/CalendarWidget.svelte`. Self-contained, no external library. Month grid is a 7-column CSS grid with date math.

**Layout:** Month/year header with left/right chevron arrows and "Today" button. 7-column day grid. Day cells 28x28px, border-radius 6px.

**Visual indicators:**
- Today: accent background (filled)
- Days with existing notes: 4px dot below the number
- Hover: var(--color-hover)
- Selected/clicked: brief accent highlight

**Behavior:**
- Click any date: opens `journal/YYYY-MM-DD.md`. If doesn't exist, creates it from template.
- Arrows navigate months. "Today" jumps to current month.
- Scans `journal/` folder in fileMap for `YYYY-MM-DD.md` filenames to determine dots.

**Daily note template:**
```markdown
---
title: "YYYY-MM-DD"
tags: [journal, daily]
---

# Weekday, Month Dth YYYY

## Tasks

- [ ]

## Notes


```

**File creation:** Uses existing `createFile` bridge command with path `journal/YYYY-MM-DD.md`. Creates `journal/` directory if needed via `createDir`.

**Styling:** Mono 11px for grid. Day header (Mo Tu We...) in placeholder color. Transitions 150ms. Animation: calendar slides in when sidebar expands.

## 3. Keyboard Navigation

**Zone system:** 4 zones — file tree, editor, right panel, utility rail. FocusManager tracks active zone.

**Zone switching:**
- `Ctrl+Tab`: next zone
- `Ctrl+Shift+Tab`: previous zone
- `Escape`: return to editor from any zone

**File tree keys (when zone is active):**
- `↑`/`↓`: navigate files/folders
- `→`: expand folder
- `←`: collapse folder or move to parent
- `Enter`: open file / toggle folder
- `Delete`/`Backspace`: delete (with confirmation if enabled)

**Right panel keys (when zone is active):**
- `↑`/`↓`: scroll outline/backlinks
- `Enter`: click selected item

**Visual indicator:** Focused item in file tree gets accent bg highlight (same as active file style but with a distinct focus ring).

**Implementation:** `FocusManager.svelte` wraps AppShell. Document-level keydown listener. Maintains `currentZone` state. Only intercepts keys when NOT in editor. Editor focus is default — zone nav only activates after Ctrl+Tab or clicking outside editor.

**No conflicts:** Ctrl+Tab doesn't conflict with any TipTap, browser, or existing app shortcut. Arrow keys only activate in file tree zone, not in editor. Escape from editor already handled by existing overlay close logic — only activates for zone nav when no overlay is open.

**Component:** `src/lib/components/common/FocusManager.svelte` — wraps AppShell in +layout.svelte.

## Files to create/modify

| File | Action |
|------|--------|
| `src/lib/components/common/TasksModal.svelte` | Create |
| `src/lib/components/sidebar/CalendarWidget.svelte` | Create |
| `src/lib/components/common/FocusManager.svelte` | Create |
| `src/lib/stores/ui.svelte.ts` | Add tasksVisible state |
| `src/routes/+layout.svelte` | Wire TasksModal, CalendarWidget, FocusManager, utility rail button |
| `src/lib/components/filetree/FileTree.svelte` | Add keyboard focus support |
| `src/lib/components/filetree/FileTreeNode.svelte` | Add focused state styling |
