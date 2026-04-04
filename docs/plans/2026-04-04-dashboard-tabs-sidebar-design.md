# Dashboard, Tab System & Collapsible Sidebar

## Overview

Three features that transform the app's navigation and landing experience:

1. **Browser-style tab system** with a persistent Home tab
2. **Dashboard** replacing HomeView as the Home tab content
3. **Collapsible sidebar** toggling between full file tree and icon rail

---

## 1. Tab System

### Structure

`TabBar` component replaces the current `ContentHeader` at the top of `ContentArea`.

- **Home tab** — always pinned at index 0. Home icon + "Home" label. No close button, not draggable past position 0.
- **File tabs** — one per open file. File icon + filename + close button. Middle-click closes. Tooltip shows full path.
- **Active tab** — accent blue gradient bottom border. Inactive tabs are muted.

### Behavior

- Opening a file adds a tab or focuses the existing one.
- Tabs are drag-reorderable (Home stays pinned at index 0). Pointer-event drag, no library.
- Closing the active tab focuses the nearest neighbor.
- Tab overflow: horizontal scroll with subtle fade edges.

### State

New `tabs.svelte.ts` store:

```ts
type Tab = {
  id: string;
  type: 'home' | 'file';
  fileNode?: FileNode;
  label: string;
};
```

Holds `tabs` array + `activeTabId`. Stays in sync with `files.activeFile`.

### Styling

- Inactive: `--bg-secondary`
- Hover: `--bg-tertiary`
- Active: accent bottom border
- Height: ~36px (matches current content header)

### Animation

- **Open:** `translateX(12px) + opacity 0 → 1`, 200ms ease-out.
- **Close:** width collapses (200ms) + content fades (120ms). Neighbors slide via flex.
- **Drag:** `scale(1.03)` + elevated shadow on dragged tab. 150ms ease settle on drop.
- **Active indicator:** pseudo-element slides between tabs via `left` + `width` transition (200ms ease-in-out).

---

## 2. Dashboard (Home Tab Content)

Renders when the Home tab is active. Three sections stacked vertically in a scrollable column.

### Section A — Activity Overview

- **Recent edits** — last 10 modified files with relative timestamps (reuses `relativeTime` util). Clickable to open in tab.
- **Writing stats** — inline metric blocks: total notes, total words, files created this week. No charts.

### Section B — Quick Access

- **Pinned notes** — card grid via `searchPinned` bridge command. Title + first-line preview + pin icon.
- **Recently opened** — horizontal scrollable chip row via `searchRecent`. Click opens in tab.

### Section C — Knowledge Graph Summary

- **Most connected notes** — top 5 by wiki-link count (inbound + outbound). Title + count badge.
- **Orphan notes** — count of zero-link notes, clickable to list.
- **Link stats** — total wiki-links, average per note.

Graph data computed on core load by scanning for `[[wiki-link]]` patterns. Cached in new `graph.svelte.ts` store.

### Animation

- Sections stagger in: `translateY(8px) + opacity`, 60ms stagger.
- Stat numbers count up on first load (400ms ease-out).
- Cards hover lift: `translateY(-2px) + box-shadow`, 200ms.

---

## 3. Collapsible Sidebar

### Collapsed State (48px wide)

- Vertical icon stack: Home, Search (quick-open), New Note.
- Expand toggle at bottom (chevron pointing right).
- File tree, header text, footer hidden.

### Expanded State (276px wide)

- Current sidebar as-is.
- Toggle button in sidebar header, right-aligned next to core name. Chevron points left.

### Toggle

- Button in sidebar header, `--bg-tertiary` hover, `--icon-muted` color.
- Keyboard shortcut: `Cmd+B`.
- State: `sidebarCollapsed` boolean in `ui.svelte.ts`.
- `AppShell` grid column swaps `276px` for `48px`.

### Animation

- Width: `350ms cubic-bezier(0.16, 1, 0.3, 1)` (spring ease).
- **Collapse sequence:** content fades out (120ms) → width shrinks → collapsed icons fade in (120ms) with `scale(0.9 → 1)` stagger (30ms per icon).
- **Expand sequence:** reverse — width grows → content fades in.
- Respects `prefers-reduced-motion`.

---

## New Files

| File | Purpose |
|------|---------|
| `src/lib/stores/tabs.svelte.ts` | Tab state management |
| `src/lib/stores/graph.svelte.ts` | Wiki-link graph cache |
| `src/lib/components/tabs/TabBar.svelte` | Tab bar component |
| `src/lib/components/tabs/Tab.svelte` | Individual tab component |
| `src/lib/components/dashboard/Dashboard.svelte` | Dashboard container |
| `src/lib/components/dashboard/ActivitySection.svelte` | Recent edits + stats |
| `src/lib/components/dashboard/QuickAccessSection.svelte` | Pinned + recent |
| `src/lib/components/dashboard/GraphSection.svelte` | Knowledge graph summary |

## Modified Files

| File | Change |
|------|--------|
| `src/lib/stores/ui.svelte.ts` | Add `sidebarCollapsed` state |
| `src/lib/components/layout/AppShell.svelte` | Grid responds to sidebar collapse |
| `src/lib/components/layout/Sidebar.svelte` | Collapsed/expanded modes + toggle |
| `src/lib/components/layout/ContentArea.svelte` | Replace header with TabBar |
| `src/lib/utils/shortcuts.ts` | Add `Cmd+B` binding |
| `src/routes/+page.svelte` | Route to Dashboard or Editor based on active tab |
