# Midnight Tokyo UI Overhaul

**Date:** 2026-04-06
**Status:** Approved

## Problem

The current UI uses default shadcn-svelte component styling on a generic dark theme. It reads as "AI-generated shadcn app" — indistinguishable from thousands of other projects using the same stack. The three-panel layout mirrors Obsidian without adding visual identity. The app has no personality beyond the welcome page. There is no clear answer to "why does this exist instead of Obsidian?"

## Goal

Retheme the entire app surface with a deep, opinionated design system inspired by Tokyo Night color palette, Nerd Font typography, and the craft sensibility of Bear, Raycast, Arc, Warp, and Zed. Every shadcn component gets its defaults overridden until nothing looks like stock shadcn. The result is a note-taking app that technical minds (developers, researchers, hackers, students) recognize as *theirs* at a glance.

## Identity

**Noctodeus is a nocturnal note-taking app for technical minds.** Not an IDE. Not Obsidian. A note-taking app that happens to understand how technical people think, and will eventually gain IDE-like capabilities (executable code blocks, split panes) as features inside the note-taking experience.

## Approach

Restyle existing shadcn-svelte components deeply — override every default so they no longer look like shadcn, while keeping the accessible primitives (keyboard handling, ARIA, focus management) under the hood. No component library replacement. No changes to the AppShell grid or panel architecture; individual component internals may be restructured where the spec calls for it (e.g., Settings modal split layout, Tasks modal sizing).

---

## 1. Color System — Deeper Midnight Tokyo

Based on Tokyo Night palette, pushed darker for OLED-deep midnight feel.

### Backgrounds & Surfaces

| Token | Hex | shadcn variable it replaces | Usage |
|-------|-----|-----------------------------|-------|
| `--base` | `#0A0E1A` | `--background` | App background, editor, tab bar, deepest layer |
| `--surface-1` | `#13161F` | `--card`, `--sidebar-background` | Sidebar, right sidebar rail, panel backgrounds |
| `--surface-2` | `#1A1E2E` | `--popover`, `--sidebar-accent` | Modals, dropdowns, cards, elevated elements |
| `--surface-3` | `#212537` | `--accent`, `--sidebar-accent-foreground` context | Active/selected states, hover backgrounds |
| `--border-subtle` | `#1E2336` | `--border`, `--sidebar-border` | Separator lines — barely visible, navy tone |
| `--border-active` | `#2A2F45` | `--input`, `--ring` | Focused element edges |

### Accents

| Token | Hex | shadcn variable it replaces | Usage |
|-------|-----|-----------------------------|-------|
| `--accent-blue` | `#7AA2F7` | `--primary`, `--ring` | Links, active indicators, primary actions, focus glow |
| `--accent-purple` | `#BB9AF7` | — (new) | Tags, secondary highlights, h3 headings |
| `--accent-cyan` | `#7DCFFF` | — (new) | Inline code, special syntax |
| `--accent-green` | `#9ECE6A` | — (new) | Done/checked states, success |
| `--accent-red` | `#F7768E` | `--destructive` | Delete actions, errors |
| `--accent-orange` | `#FF9E64` | — (new) | Warnings, due dates |
| `--accent-yellow` | `#E0AF68` | — (new) | Search highlights |

### Text

| Token | Hex | shadcn variable it replaces | Usage |
|-------|-----|-----------------------------|-------|
| `--text-primary` | `#C0CAF5` | `--foreground`, `--card-foreground` | Body text, headings |
| `--text-secondary` | `#A9B1D6` | `--muted-foreground` | Subheadings, metadata |
| `--text-muted` | `#6B7394` | `--muted-foreground` (secondary use) | Placeholders, timestamps, disabled labels |
| `--text-faint` | `#3B4261` | — (new, decorative only) | Decorative elements only — never for functional text |

**Accessibility note:** `--text-muted` (#6B7394) achieves ~4.5:1 contrast against `--base` (#0A0E1A), meeting WCAG AA for normal text. `--text-faint` (~1.9:1) is restricted to purely decorative use.

### User-Configurable Accent Color

The existing accent color picker in Settings is **replaced** by a curated set of Tokyo Night accent presets: blue (`#7AA2F7`), purple (`#BB9AF7`), cyan (`#7DCFFF`), green (`#9ECE6A`), red (`#F7768E`), orange (`#FF9E64`). Selecting one changes `--accent-blue` (the primary accent used for links, focus, active states). The semantic accent tokens (`--accent-green` for success, `--accent-red` for errors, etc.) remain fixed regardless of user selection — only the primary interactive accent changes.

### Surface Assignments by Region

| Region | Background | Rationale |
|--------|-----------|-----------|
| Title bar | `--base` | Seamless with window chrome |
| Left sidebar | `--surface-1` | One step up, clearly a separate zone |
| Tab bar | `--base` | Flush with title bar |
| Editor area | `--base` | Deepest layer — content is king |
| Right sidebar rail | `--surface-1` | Matches left sidebar |
| Right panel (open) | `--surface-2` | Feels elevated, like a slide-over |
| Modals/dialogs | `--surface-2` + shadow | Lifted above everything |
| Dropdowns/menus | `--surface-2` + shadow | Consistent elevated treatment |
| Home dashboard cards | `--surface-1` | Slight lift from base |

### Light Theme

Light theme is explicitly out of scope for this overhaul. Existing light theme values remain as-is and will not be updated in this pass. A future spec can address a complementary light palette if needed. Dark is the identity.

---

## 2. Typography — Nerd Fonts

| Role | Font | Weight | Size |
|------|------|--------|------|
| UI chrome (sidebar labels, tab titles) | `JetBrainsMono Nerd Font` | 400-500 | 12-13px |
| Section headers | `JetBrainsMono Nerd Font` | 500 | 11px, `font-variant: small-caps` |
| Headings (h1-h3) | `JetBrainsMono Nerd Font` | 600-700 | 24/20/16px |
| Note body prose | `IBM Plex Sans` (user-configurable) | 400 | 16px |
| Code blocks & inline code | `JetBrainsMono Nerd Font` | 400 | 14px |
| Fallback chain | `JetBrains Mono` → `Fira Code` → `monospace` | — | — |

### Nerd Font Icon Map

| Context | Glyph examples |
|---------|----------------|
| File tree — markdown | `` |
| File tree — JSON | `` |
| File tree — folder closed | `` |
| File tree — folder open | `` |
| File tree — config | `` |
| Tabs | File-type glyph before tab label |
| Right sidebar rail | Glyph + small monospace label below each icon |
| Section headers | Optional glyph prefix (e.g., ` RECENT`, ` MOST LINKED`) |
| Core switcher | `` before vault name |

### Nerd Font vs Lucide Migration Scope

Nerd Font glyphs replace Lucide SVG icons **only** in these specific surfaces:
- File tree file/folder icons
- Tab bar file-type icons
- Right sidebar rail icons
- Section header prefixes (home dashboard)
- Core switcher icon

**All other Lucide icons remain as-is.** This includes: toolbar icons, editor bubble menu, settings modal controls, action buttons, context menus, and any icon not listed above. Lucide continues to be the icon system for general UI actions; Nerd Font glyphs are used where file-type identity and the monospace aesthetic matter most.

### Nerd Font Glyph Fallback

A thin mapping utility (`src/lib/utils/nerd-icons.ts`) maps file extensions to Nerd Font Unicode codepoints. If the Nerd Font fails to load (unlikely in Tauri, but possible), the utility falls back to a text label or a Lucide SVG equivalent. This prevents empty box rendering.

---

## 3. Component Principles

Design language inspired by Bear, Raycast, Arc, Warp, Zed. Every component override follows these rules:

- **No visible borders by default.** Separate layers with background contrast and subtle `box-shadow: 0 1px 3px rgba(0,0,0,0.3)`. Borders only for active/focused states, and then at `--border-active` color.
- **Border radius:** `6px` for containers/cards, `4px` for inputs/buttons, `2px` for inline elements. Not the rounder shadcn defaults.
- **Focus states:** `box-shadow: 0 0 0 2px rgba(122,162,247,0.15)` — a soft glow, never a hard outline ring.
- **Hover states:** Background shifts to next surface level, `150ms ease-out` transition.
- **All transitions:** `150-200ms ease-out` on interactive state changes. Existing anime.js stagger animations (staggerIn, fadeInUp) for sidebar/panel entry are kept as-is — they complement the transition system.
- **Spacing is generous:** Minimum `12px` between list items, `16-24px` section gaps, `32px+` between major regions. Nothing feels cramped.
- **Dividers:** Prefer whitespace and typography hierarchy over lines. When a line is unavoidable, `1px` at `--border-subtle`.
- **Scrollbars:** `4px` thin, `--border-active` color, appear on hover only.
- **Shadows over borders** for depth — `0 2px 8px rgba(0,0,0,0.25)` on elevated surfaces.

---

## 4. shadcn Component Overrides

Every shadcn-svelte component gets its defaults stripped. Components are in `src/lib/components/ui/` (local copies, fully editable).

### Button
- Primary: `--accent-blue` bg, `--base` text, no border, `4px` radius. Hover: slightly lighter.
- Ghost: transparent bg, `--text-secondary` color. Hover: `--surface-3` bg.
- No default shadcn ring on focus — use glow.
- Custom padding: `8px 16px`, monospace label font.

### Input / Textarea
- `--surface-1` bg, no border, `4px` radius.
- Placeholder: `--text-muted`.
- Focus: glow shadow, no border change.
- Text: `--text-primary`, monospace.
- Textarea: same treatment, with `min-height` appropriate to context.

### Dialog / Modal
- `--surface-2` bg, no default border.
- Overlay: `rgba(0,0,0,0.6)` — darker than shadcn default.
- Shadow: `0 8px 32px rgba(0,0,0,0.4)` for strong lift.
- Title: `JetBrainsMono NF` 600 weight.

### Command Palette
- `--surface-2` bg, monospace input field.
- Results: Nerd Font file-type icons, `--text-secondary` for paths.
- Selected item: `--surface-3` bg, `--accent-blue` left border 2px.

### Dropdown / Select
- `--surface-2` bg, shadow lift, no border.
- Items: hover to `--surface-3`, `150ms` transition.
- Selected: `--accent-blue` text.

### Tabs
- No underline or pill defaults.
- Active: `2px` top border `--accent-blue` + `--surface-3` bg.
- Inactive: `--text-muted` color, transparent bg.
- Close button appears on hover only.

### Checkbox / Toggle
- Checked: `--accent-green` fill.
- Unchecked: `--border-active` border, transparent fill.
- Custom sizing to feel proportional.

### Tooltip
- `--surface-3` bg, no border, subtle shadow.
- Monospace text, `12px`, `--text-secondary`.
- `4px` radius.

### Toast (svelte-sonner)
- `--surface-2` bg, shadow, no border.
- Text: `--text-primary`. Description: `--text-secondary`.
- Success: left accent border `--accent-green`. Error: `--accent-red`.

### Badge
- `--surface-3` bg, `--text-secondary` text, `2px` radius, no border.
- Accent variants: use accent color bg at 15% opacity with full accent text.

### Scroll Area
- Thumb: `--border-active`, `4px` width, appears on hover only.
- Track: transparent.

### Separator
- `1px` `--border-subtle`. Prefer whitespace over separators where possible.

---

## 5. Targeted Layout Fixes

No changes to the AppShell grid or panel architecture. Individual components get visual redesigns, which may include markup changes to their internals.

### 5.1 Home Dashboard

**Current:** Raw vault name as h1, stat numbers in plain text, flat lists with no visual hierarchy.

**Data note:** The stats (links, avg/note, orphans, notes) and lists (most linked, recent) already exist in the current HomeView component. This is a restyle of existing data, not new data/backend work.

**Proposed:**
- Vault name styled as monospace heading with `--text-muted` subtitle ("X notes · Y links").
- Stats row: 4 compact cards on `--surface-1` bg with subtle shadow. Each card: large number in `--text-primary`, small label in `--text-muted` monospace `font-variant: small-caps`. Icon glyph optional.
- "MOST LINKED" and "RECENT" sections: monospace section headers in `--text-muted` `font-variant: small-caps` with optional Nerd Font glyph prefix. List items get file-type icon, title in `--text-primary`, count/time in `--text-muted` right-aligned. Hover: `--surface-3` bg, `150ms`. Click: navigate to file.
- Generous vertical spacing between sections (`32px+`).

### 5.2 Tab Bar

- Monospace tab labels (`JetBrainsMono NF`).
- Nerd Font file-type icon before each tab label.
- Active tab: `--surface-3` bg, `2px` top accent border (`--accent-blue`).
- Inactive: transparent bg, `--text-muted` text.
- Close button (×) appears on hover only.
- Home tab: `` glyph + "Home".

### 5.3 Left Sidebar

- Search input: `--surface-2` bg, no border, Nerd Font search glyph (``), monospace placeholder. Focus glow.
- Section headers: `font-variant: small-caps`, monospace, `--text-muted`, `11px`.
- File tree: Nerd Font icons per file type. Folder expand/collapse uses `` / ``. Selected file: `3px` left border in `--accent-blue`, `--surface-3` bg. Hover: `--surface-3` bg, `150ms`.
- Calendar: Restyle with Midnight Tokyo colors. Today marker: `--accent-blue` bg (not green). Note-exists dot: `--accent-purple`. Day hover: `--surface-3`.
- Core switcher at bottom: `` glyph + vault name in monospace, gear icon in `--text-muted`.

### 5.4 Right Sidebar Rail

**Current:** 5 unlabeled Lucide icons — Rows3 (outline), Network (graph), Link (backlinks), ListChecks (tasks), Info (details).

**Proposed:** Vertical icon rail with Nerd Font glyphs, each with a tiny monospace label (`10px`) below:

| Current Lucide | Function | New Nerd Font glyph | Label |
|----------------|----------|---------------------|-------|
| Rows3 | Outline/TOC | `` | `outline` |
| Network | Graph view | `` | `graph` |
| Link | Backlinks | `` | `links` |
| ListChecks | Tasks | `` | `tasks` |
| Info | Note details | `` | `info` |

Active panel: `--accent-blue` icon + label. Inactive: `--text-muted`. Panel slides in with `150ms ease-out` when activated.

### 5.5 Tasks Modal

**Current:** Small dialog, debug-panel aesthetic.

**Proposed:** Large overlay (80% viewport width, centered). This is a markup change to the TasksModal component. `--surface-2` bg with shadow. Filter tabs (All/Todo/Done) as pill toggles: active pill gets `--accent-blue` bg, inactive gets `--surface-3`. Task items: checkbox + text, grouped by file with monospace file headers. Checked tasks: `--accent-green` checkbox, text gets `--text-muted` + strikethrough. Generous row height (`40px+`).

### 5.6 Settings Modal

**Current:** Standard shadcn dialog, single-column layout.

**Proposed:** Wide panel (`min(700px, 90vw)`), split layout: section nav on left (monospace labels, vertical list), content on right. This is a markup change to SettingsModal internals. `--surface-2` bg. Inputs use standard overridden styles. Accent color picker replaced with curated Tokyo Night preset swatches (see Section 1 — User-Configurable Accent Color). Section transitions: `150ms` fade.

### 5.7 Editor Area

- `h1`: `24px`, `JetBrainsMono NF` 700, `--text-primary`.
- `h2`: `20px`, weight 600, `--text-primary`, faint `3px` left border in `--accent-blue` with `8px` left padding.
- `h3`: `16px`, weight 600, `--accent-purple`.
- Blockquotes: `--surface-1` bg, `3px` left border `--border-active`, italic body.
- Code blocks: `--surface-1` bg, `1px` `--border-subtle` border, `4px` radius, `JetBrainsMono NF`, Tokyo Night syntax colors.
- Inline code: `--accent-cyan` text, `--surface-2` bg, `2px` radius, `JetBrainsMono NF`.
- Links: `--accent-blue`, underline on hover only.
- Task checkboxes: `--accent-green` checked, `--border-active` unchecked.
- Horizontal rules: `1px` `--border-subtle`, centered with generous vertical margin.
- Images: `6px` radius, subtle shadow.

### 5.8 Editor Toolbar / Bubble Menu

The BubbleToolbar and EditorToolbar inherit component principles: `--surface-2` bg, shadow lift, `4px` radius. Icon buttons use Lucide (not Nerd Font — these are action icons, not file-type icons). Active formatting state (e.g., bold active): `--accent-blue` icon color. Inactive: `--text-muted`. Hover: `--surface-3` bg.

FindReplaceBar: `--surface-1` bg, monospace input, same focus glow treatment as Input override.

---

## 6. Implementation Notes

### CSS Architecture
- Override shadcn defaults via Tailwind v4 `@theme` tokens and SCSS partials.
- Define all Midnight Tokyo tokens as CSS custom properties on `:root[data-theme="dark"]`.
- Maintain both the new Midnight Tokyo token names AND alias them to the existing shadcn variable names (e.g., `--background: var(--base)`) so that shadcn components pick up new values without requiring every utility class to change.
- Light theme is out of scope — existing light values remain untouched.

### Nerd Font Loading
- Bundle `JetBrainsMono Nerd Font` weights 400, 500, 600, 700 only (4 files, ~3-4MB total). Do not bundle the full family.
- Local `@font-face` declarations in the app's static assets (Tauri bundles everything locally — no network latency).
- Fallback chain in CSS: `'JetBrainsMono Nerd Font', 'JetBrains Mono', 'Fira Code', monospace`.
- Nerd Font glyphs used via Unicode codepoints through a thin mapping utility (`src/lib/utils/nerd-icons.ts`), with Lucide SVG fallback if glyph fails to render.

### Migration Path

Phase approach — each phase is independently testable and visually reviewable:

1. **Tokens & variables** — define Midnight Tokyo CSS custom properties, alias to shadcn variable names.
2. **Global styles** — base typography, scrollbars, focus states, transitions, body/html background.
3. **Component overrides** — restyle each shadcn component per Section 4 specs.
4. **Targeted layout fixes** — redesign specific surfaces per Section 5 specs. This phase includes markup changes to component internals (TasksModal sizing, SettingsModal layout, right sidebar labels).
5. **Nerd Font integration** — add font files, @font-face, nerd-icons utility, swap icons in specified surfaces.

---

## 7. Out of Scope

These are explicitly deferred to future work (added to TODO.md):
- Executable code blocks in notes
- Split pane editing
- Graph view cosmetic upgrade (constellation aesthetic)
- Plugin/extension API
- Light theme redesign
- New features — this spec is visual overhaul only
