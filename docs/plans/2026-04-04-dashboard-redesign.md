# Dashboard Redesign — Knowledge Observatory

## Problem

The initial dashboard felt like a generic AI-generated SaaS admin panel:
- "New Note" appeared in 3 places on one screen (dashboard, utility rail, command palette)
- Action buttons on the dashboard duplicated utility rail functionality
- Three stacked sections with uppercase labels, bordered stat cards, and chip rows
- Equal visual weight on everything — no hierarchy, no point of view

## Principles

- Dashboard is read-only orientation + navigation. No action buttons.
- Knowledge graph intelligence is the primary surface (left column, 60%)
- Recent context is secondary (right column, 40%)
- Single ambient header (core name). No section labels.
- Clicking a file navigates to it. That's navigation, not an action.

## Layout

Two-column side-by-side with core name header.

**Left column (60%):**
- Inline stat numbers (total links, avg/note, orphans) — raw numbers, no cards
- Most Connected notes list — name + count badge rows

**Right column (40%):**
- Recent edits list — name + relative time rows
- Pinned notes list — name rows (only if pinned files exist)

Column separator: 1px vertical line at rgba(255,255,255,0.04).

## Visual

- Stats: text-2xl mono, weight 600, tiny muted label below. No borders/cards.
- Rows: consistent across all lists — subtle hover, no icons, no prefixes.
- Scanning: stat numbers show `--` and pulse. No text label.
- No section headers, no subsection headers, no uppercase labels.

## Files

- Rewrite: `src/lib/components/dashboard/Dashboard.svelte`
- Delete: `ActivitySection.svelte`, `QuickAccessSection.svelte`, `GraphSection.svelte`
- Modify: `src/routes/+page.svelte` (remove onnewnote/onopencore props from Dashboard)
