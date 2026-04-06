# Midnight Tokyo UI Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme the entire Noctodeus app with a Deeper Midnight Tokyo design system — dark OLED palette, Nerd Font typography, deeply restyled shadcn components, and targeted layout fixes — to eliminate the generic "AI-generated shadcn" look.

**Architecture:** Override the existing CSS custom property system in `app.css` with Midnight Tokyo tokens aliased to shadcn variable names, then propagate changes through SCSS partials, shadcn component files, and application component styles. Nerd Font glyphs replace Lucide icons in specific surfaces (file tree, tabs, sidebar rail). No structural changes to AppShell grid.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Tailwind v4 `@theme`, SCSS partials, shadcn-svelte (local copies), JetBrainsMono Nerd Font, IBM Plex Sans.

**Spec:** `docs/specs/2026-04-06-midnight-tokyo-ui-overhaul-design.md`

---

## Chunk 1: Foundation — Tokens, Fonts, Global Styles

### Task 1: Define Midnight Tokyo CSS custom properties

**Files:**
- Modify: `src/lib/styles/app.css` (lines 1-170)

This is the single highest-leverage change. Every component that uses `var(--color-*)` tokens will update automatically.

- [ ] **Step 1: Read the current app.css to understand the token structure**

The file defines `:root` (light) and `.dark` color blocks, then a `@theme inline` block for Tailwind. Key variables to map:

| Current shadcn variable | New Midnight Tokyo token | New value |
|------------------------|-------------------------|-----------|
| `--background` | `--base` | `#0A0E1A` |
| `--foreground` | `--text-primary` | `#C0CAF5` |
| `--card` | `--surface-1` | `#13161F` |
| `--card-foreground` | `--text-primary` | `#C0CAF5` |
| `--popover` | `--surface-2` | `#1A1E2E` |
| `--popover-foreground` | `--text-primary` | `#C0CAF5` |
| `--primary` | `--accent-blue` | `#7AA2F7` |
| `--primary-foreground` | `--base` | `#0A0E1A` |
| `--secondary` | `--surface-2` | `#1A1E2E` |
| `--secondary-foreground` | `--text-secondary` | `#A9B1D6` |
| `--muted` | `--surface-1` | `#13161F` |
| `--muted-foreground` | `--text-muted` | `#6B7394` |
| `--accent` | `--surface-3` | `#212537` |
| `--accent-foreground` | `--text-primary` | `#C0CAF5` |
| `--destructive` | `--accent-red` | `#F7768E` |
| `--border` | `--border-subtle` | `#1E2336` |
| `--input` | `--border-active` | `#2A2F45` |
| `--ring` | `--accent-blue` | `#7AA2F7` |

- [ ] **Step 2: Replace the `.dark` block in app.css**

Replace the entire `.dark { }` color block with Midnight Tokyo values. Keep the shadcn variable names (components reference them) but set them to Midnight Tokyo hex values. Also add the new semantic tokens that don't map to existing shadcn names:

```css
.dark {
  /* Midnight Tokyo — Backgrounds & Surfaces */
  --background: #0A0E1A;
  --foreground: #C0CAF5;
  --card: #13161F;
  --card-foreground: #C0CAF5;
  --popover: #1A1E2E;
  --popover-foreground: #C0CAF5;
  --muted: #13161F;
  --muted-foreground: #6B7394;
  --accent: #212537;
  --accent-foreground: #C0CAF5;
  --secondary: #1A1E2E;
  --secondary-foreground: #A9B1D6;
  --destructive: #F7768E;
  --border: #1E2336;
  --input: #2A2F45;
  --ring: #7AA2F7;

  /* Midnight Tokyo — Extended tokens */
  --base: #0A0E1A;
  --surface-1: #13161F;
  --surface-2: #1A1E2E;
  --surface-3: #212537;
  --border-subtle: #1E2336;
  --border-active: #2A2F45;

  --accent-blue: #7AA2F7;
  --accent-purple: #BB9AF7;
  --accent-cyan: #7DCFFF;
  --accent-green: #9ECE6A;
  --accent-red: #F7768E;
  --accent-orange: #FF9E64;
  --accent-yellow: #E0AF68;

  --text-primary: #C0CAF5;
  --text-secondary: #A9B1D6;
  --text-muted: #6B7394;
  --text-faint: #3B4261;

  /* Sidebar tokens — note: codebase uses --sidebar, NOT --sidebar-background */
  --sidebar: #13161F;
  --sidebar-foreground: #C0CAF5;
  --sidebar-primary: #7AA2F7;
  --sidebar-primary-foreground: #0A0E1A;
  --sidebar-accent: #1A1E2E;
  --sidebar-accent-foreground: #C0CAF5;
  --sidebar-border: #1E2336;
  --sidebar-ring: #7AA2F7;

  /* Variables referenced by @theme inline block — must keep these names */
  --hover: #212537;
  --placeholder: #6B7394;
  --accent-hover: #9BABF8;
  --float-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);

  /* Shadows */
  --shadow-float: 0 4px 16px rgba(0, 0, 0, 0.4);
  --shadow-elevated: 0 2px 8px rgba(0, 0, 0, 0.25);
  --shadow-modal: 0 8px 32px rgba(0, 0, 0, 0.4);
  --glow-focus: 0 0 0 2px rgba(122, 162, 247, 0.15);
}
```

- [ ] **Step 3: Update the `@theme inline` block**

In the `@theme inline` block, update the `--color-accent` mapping so it resolves to accent-blue (not surface-3):

```css
--color-accent: var(--accent-blue, #7AA2F7);
```

This overrides the default `var(--accent)` which now maps to surface-3 (`#212537`). Without this change, any Tailwind utility using `accent` would get the wrong color.

Also update the font stacks (will be completed in Task 2, but note the dependency):

```css
--font-mono: 'JetBrainsMono Nerd Font', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
--font-sans: 'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
--font-content: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
```

- [ ] **Step 4: Update the selection highlight**

Change the selection colors at the bottom of app.css from indigo to accent-blue:

```css
::selection {
  background: rgba(122, 162, 247, 0.2);
  color: inherit;
}
```

- [ ] **Step 5: Update EXPORT_CSS constant in +layout.svelte**

In `src/routes/+layout.svelte` (~line 610), the `EXPORT_CSS` constant hardcodes `color:#6366f1` for links. Update to `color:#7AA2F7` and `background:#0A0E1A` to match Midnight Tokyo.

- [ ] **Step 6: Verify the app loads with new tokens**

Run: `cargo tauri dev`
Expected: App background is deep midnight (#0A0E1A), sidebar is slightly lighter (#13161F), text is soft blue-white (#C0CAF5). Many components should already look different because they reference `var(--color-*)` tokens.

- [ ] **Step 7: Commit**

```bash
git add src/lib/styles/app.css
git commit -m "feat(theme): replace dark theme tokens with Midnight Tokyo palette"
```

---

### Task 2: Bundle JetBrainsMono Nerd Font

**Files:**
- Create: `static/fonts/JetBrainsMonoNerdFont-Regular.woff2`
- Create: `static/fonts/JetBrainsMonoNerdFont-Medium.woff2`
- Create: `static/fonts/JetBrainsMonoNerdFont-SemiBold.woff2`
- Create: `static/fonts/JetBrainsMonoNerdFont-Bold.woff2`
- Create: `src/lib/styles/fonts.css`
- Modify: `src/lib/styles/app.css` (add import or @font-face)

- [ ] **Step 1: Download JetBrainsMono Nerd Font**

Download the 4 weights (Regular 400, Medium 500, SemiBold 600, Bold 700) in woff2 format from the Nerd Fonts release:

```bash
mkdir -p static/fonts
# Download from https://github.com/ryanoasis/nerd-fonts/releases/latest
# Extract JetBrainsMonoNerdFont-{Regular,Medium,SemiBold,Bold}.woff2
# Place in static/fonts/
```

If woff2 is not available in the release, download the ttf files and convert with a font tool, or use the ttf directly (slightly larger but works fine in Tauri).

- [ ] **Step 2: Create @font-face declarations**

Create `src/lib/styles/fonts.css`:

```css
@font-face {
  font-family: 'JetBrainsMono Nerd Font';
  src: url('/fonts/JetBrainsMonoNerdFont-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: 'JetBrainsMono Nerd Font';
  src: url('/fonts/JetBrainsMonoNerdFont-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: 'JetBrainsMono Nerd Font';
  src: url('/fonts/JetBrainsMonoNerdFont-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: 'JetBrainsMono Nerd Font';
  src: url('/fonts/JetBrainsMonoNerdFont-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: block;
}
```

Note: `font-display: block` prevents FOUT (flash of unstyled text) — acceptable in Tauri since fonts are local.

- [ ] **Step 3: Update font stacks in app.css @theme block**

In the `@theme inline` block of `app.css`, update the font family variables:

```css
--font-mono: 'JetBrainsMono Nerd Font', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
--font-sans: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
--font-content: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
```

- [ ] **Step 4: Import fonts.css in the app entry point**

Add the import to the root layout or app.css (whichever loads first). Check `src/routes/+layout.svelte` for the current CSS import chain and add:

```svelte
<script>
  import '$lib/styles/fonts.css';
</script>
```

Or import from app.css:
```css
@import './fonts.css';
```

- [ ] **Step 5: Verify fonts render correctly**

Run: `cargo tauri dev`
Expected: UI chrome text (sidebar labels, tab titles) renders in JetBrainsMono Nerd Font. Check the browser devtools font panel to confirm the correct font is loading.

- [ ] **Step 6: Commit**

```bash
git add static/fonts/ src/lib/styles/fonts.css src/lib/styles/app.css
git commit -m "feat(theme): bundle JetBrainsMono Nerd Font with @font-face declarations"
```

---

### Task 3: Create Nerd Font icon mapping utility

**Files:**
- Create: `src/lib/utils/nerd-icons.ts`

- [ ] **Step 1: Create the mapping utility**

```typescript
/**
 * Nerd Font glyph mapping for file types and UI elements.
 * Falls back to text labels if Nerd Font is unavailable.
 * Unicode codepoints from: https://www.nerdfonts.com/cheat-sheet
 */

const NERD_GLYPHS: Record<string, string> = {
  // File types
  'md': '\ue73e',       //
  'json': '\ue60b',     //
  'ts': '\ue628',       //
  'js': '\ue74e',       //
  'svelte': '\ue6b4',   // (or closest match)
  'css': '\ue749',      //
  'scss': '\ue74b',     //
  'html': '\ue736',     //
  'rs': '\ue7a8',       //
  'toml': '\ue6b2',     //
  'yaml': '\ue6a8',     //
  'yml': '\ue6a8',      //
  'png': '\uf1c5',      //
  'jpg': '\uf1c5',      //
  'svg': '\uf1c5',      //
  'default': '\uf15b',  //

  // Folders
  'folder-closed': '\uf07b',  //
  'folder-open': '\uf07c',    //

  // UI elements
  'home': '\uf015',     //
  'search': '\uf002',   //
  'vault': '\udb80\udf43', //
  'outline': '\uf0cb',  //
  'graph': '\udb81\ude1a', //
  'links': '\uf0c1',    //
  'tasks': '\uf0ae',    //
  'info': '\uf05a',     //
  'recent': '\uf017',   //
  'most-linked': '\uf0c1', //
  'gear': '\uf013',     //
};

/**
 * Get a Nerd Font glyph for a file extension or UI element.
 * Returns the Unicode character for rendering in elements with font-family set to Nerd Font.
 */
export function nerdIcon(key: string): string {
  return NERD_GLYPHS[key] ?? NERD_GLYPHS['default'];
}

/**
 * Get the Nerd Font glyph for a file based on its extension.
 */
export function fileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return NERD_GLYPHS[ext] ?? NERD_GLYPHS['default'];
}
```

- [ ] **Step 2: Verify the utility compiles**

Run: `npm run check`
Expected: No type errors in `nerd-icons.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/nerd-icons.ts
git commit -m "feat(theme): add Nerd Font icon mapping utility"
```

---

### Task 4: Global styles — scrollbars, focus, transitions, typography

**Files:**
- Modify: `src/lib/styles/app.css`

- [ ] **Step 1: Add global scrollbar styling**

Add to app.css after the theme blocks:

```css
/* Midnight Tokyo — Scrollbars */
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-active, #2A2F45);
  border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted, #6B7394);
}

/* Only show scrollbar on hover */
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

*:hover {
  scrollbar-color: var(--border-active, #2A2F45) transparent;
}
```

- [ ] **Step 2: Add global focus state override**

```css
/* Midnight Tokyo — Focus states (soft glow, no hard rings) */
:focus-visible {
  outline: none;
  box-shadow: var(--glow-focus, 0 0 0 2px rgba(122, 162, 247, 0.15));
}
```

- [ ] **Step 3: Add global transition defaults**

```css
/* Midnight Tokyo — Transitions */
button, a, input, textarea, select, [role="button"], [role="tab"] {
  transition: background-color 150ms ease-out, color 150ms ease-out, box-shadow 150ms ease-out, border-color 150ms ease-out, opacity 150ms ease-out;
}
```

- [ ] **Step 4: Verify scrollbars and focus states look correct**

Run: `cargo tauri dev`
Expected: Scrollbars are thin and appear on hover. Focus rings are soft blue glow, not hard outlines. Transitions are smooth on buttons and inputs.

- [ ] **Step 5: Commit**

```bash
git add src/lib/styles/app.css
git commit -m "feat(theme): add global scrollbar, focus glow, and transition styles"
```

---

## Chunk 2: shadcn Component Overrides

### Task 5: Override Button component

**Files:**
- Modify: `src/lib/components/ui/button/button.svelte`

- [ ] **Step 1: Read the current button component to understand variant structure**

The component uses `tailwind-variants` (tv) to define variant classes. We need to override the class strings for each variant.

- [ ] **Step 2: Update variant classes**

Replace the variant class definitions:

- `default` variant: `bg-[var(--accent-blue)] text-[var(--base)] hover:brightness-110 border-none`
- `ghost` variant: `bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]`
- `outline` variant: `bg-transparent border border-[var(--border-active)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]`
- `destructive` variant: `bg-[var(--accent-red)]/10 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/20`
- `secondary` variant: `bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]`
- `link` variant: `text-[var(--accent-blue)] underline-offset-4 hover:underline`

Update base classes: remove `focus-visible:border-ring focus-visible:ring-ring/50` → add `focus-visible:shadow-[var(--glow-focus)]`. Change radius to `rounded-[4px]`. Set `font-family: var(--font-mono)`.

- [ ] **Step 3: Verify buttons render correctly**

Run: `cargo tauri dev`
Expected: Primary buttons are accent-blue with dark text. Ghost buttons are transparent with hover to surface-3. Focus shows soft glow. Font is monospace.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/ui/button/button.svelte
git commit -m "feat(theme): override Button with Midnight Tokyo styling"
```

---

### Task 6: Override Input and Textarea components

**Files:**
- Modify: `src/lib/components/ui/input/input.svelte`
- Modify: `src/lib/components/ui/textarea/textarea.svelte`

- [ ] **Step 1: Read current input component**

- [ ] **Step 2: Update Input classes**

Replace the class string:
- Background: `bg-[var(--surface-1)]`
- Border: `border-none` (remove default border)
- Radius: `rounded-[4px]`
- Text: `text-[var(--text-primary)] font-[family-name:var(--font-mono)]`
- Placeholder: `placeholder:text-[var(--text-muted)]`
- Focus: `focus-visible:shadow-[var(--glow-focus)] focus-visible:outline-none`
- Remove: any `focus-visible:border-ring focus-visible:ring-ring` classes

- [ ] **Step 3: Update Textarea with same treatment**

Same changes as Input, plus appropriate `min-height`.

- [ ] **Step 4: Verify inputs and textareas**

Run: `cargo tauri dev`
Open Settings modal → check font override inputs, search bar, custom CSS textarea.
Expected: Dark surface-1 background, no border, soft glow on focus, monospace text.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/input/input.svelte src/lib/components/ui/textarea/textarea.svelte
git commit -m "feat(theme): override Input and Textarea with Midnight Tokyo styling"
```

---

### Task 7: Override Dialog / Modal components

**Files:**
- Modify: `src/lib/components/ui/dialog/dialog-content.svelte`
- Modify: `src/lib/components/ui/dialog/dialog-overlay.svelte`
- Modify: `src/lib/components/ui/dialog/dialog-title.svelte`

- [ ] **Step 1: Read current dialog components**

- [ ] **Step 2: Update dialog-overlay**

Change backdrop to: `bg-black/60 backdrop-blur-sm`

- [ ] **Step 3: Update dialog-content**

- Background: `bg-[var(--surface-2)]`
- Border: remove `ring-foreground/10` → `border-none`
- Shadow: `shadow-[var(--shadow-modal)]`
- Radius: `rounded-[6px]`

- [ ] **Step 4: Update dialog-title**

Font: `font-[family-name:var(--font-mono)] font-semibold`

- [ ] **Step 5: Verify modals**

Run: `cargo tauri dev`
Open any dialog (e.g., create new file, export).
Expected: Surface-2 background, dark overlay, no ring border, strong shadow lift, monospace title.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/ui/dialog/
git commit -m "feat(theme): override Dialog with Midnight Tokyo styling"
```

---

### Task 8: Override Command Palette, Dropdown, Select, Tooltip, Toast, Badge, Separator, ScrollArea

**Files:**
- Modify: `src/lib/components/ui/command/command-item.svelte`
- Modify: `src/lib/components/ui/command/command-input.svelte`
- Modify: `src/lib/components/ui/dropdown-menu/dropdown-menu-content.svelte`
- Modify: `src/lib/components/ui/dropdown-menu/dropdown-menu-item.svelte`
- Modify: `src/lib/components/ui/select/select-trigger.svelte`
- Modify: `src/lib/components/ui/select/select-content.svelte`
- Modify: `src/lib/components/ui/select/select-item.svelte`
- Modify: `src/lib/components/ui/tooltip/tooltip-content.svelte`
- Modify: `src/lib/components/ui/toggle/toggle.svelte`
- Modify: `src/lib/components/ui/badge/badge.svelte`
- Modify: `src/lib/components/ui/separator/separator.svelte`
- Modify: `src/lib/components/ui/scroll-area/scroll-area.svelte`

Note: No shadcn Checkbox component exists in the UI directory. Task checkboxes are handled in ProseMirror editor CSS (Task 9).

This task batches the remaining shadcn component overrides. Each follows the same pattern: replace default classes with Midnight Tokyo tokens.

- [ ] **Step 1: Read all target component files**

- [ ] **Step 2: Override Command Palette components**

**command-input.svelte:**
- Font: `font-[family-name:var(--font-mono)]`
- Placeholder: `text-[var(--text-muted)]`

**command-item.svelte:**
- Selected: `data-selected:bg-[var(--surface-3)] data-selected:text-[var(--text-primary)]`
- Add: left border on selected: `data-selected:border-l-2 data-selected:border-[var(--accent-blue)]`

- [ ] **Step 3: Override Dropdown components**

**dropdown-menu-content.svelte:**
- Background: `bg-[var(--surface-2)]`
- Shadow: `shadow-[var(--shadow-elevated)]`
- Border: remove `ring-foreground/10` → `border-none`

**dropdown-menu-item.svelte:**
- Hover: `hover:bg-[var(--surface-3)]`
- Transition: `transition-colors duration-150`

- [ ] **Step 4: Override Select components**

**select-trigger.svelte:**
- Background: `bg-[var(--surface-1)]`
- Border: `border-none`
- Focus: `focus-visible:shadow-[var(--glow-focus)]`
- Font: `font-[family-name:var(--font-mono)]`

**select-content.svelte:**
- Background: `bg-[var(--surface-2)]`
- Shadow: `shadow-[var(--shadow-elevated)]`
- Border: remove ring → `border-none`

**select-item.svelte:**
- Hover: `hover:bg-[var(--surface-3)]`
- Selected: `data-selected:text-[var(--accent-blue)]`

- [ ] **Step 5: Override Tooltip**

**tooltip-content.svelte:**
- Background: `bg-[var(--surface-3)]` (not inverted foreground/background)
- Text: `text-[var(--text-secondary)] text-xs font-[family-name:var(--font-mono)]`
- Radius: `rounded-[4px]`
- Shadow: `shadow-[var(--shadow-elevated)]`
- Arrow: match `bg-[var(--surface-3)]`

- [ ] **Step 6: Override Toggle**

**toggle.svelte:**
- Pressed/on: `aria-pressed:bg-[var(--surface-3)] data-[state=on]:bg-[var(--surface-3)]`
- Hover: `hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]`

- [ ] **Step 7: Override Badge**

**badge.svelte:**
- Default: `bg-[var(--surface-3)] text-[var(--text-secondary)] border-none rounded-[2px]`

- [ ] **Step 8: Override Separator**

**separator.svelte:**
- Color: `bg-[var(--border-subtle)]`

- [ ] **Step 9: Override ScrollArea**

**scroll-area.svelte:**
- Thumb: update to use `--border-active` color
- Track: transparent

- [ ] **Step 10: Verify all overridden components**

Run: `cargo tauri dev`
Check: Command palette (Cmd+K), right-click context menus, tooltips on hover, toggle buttons in toolbar, badges if visible.
Expected: All use Midnight Tokyo surfaces and accent colors. No default shadcn rings or borders visible.

- [ ] **Step 11: Commit**

```bash
git add src/lib/components/ui/
git commit -m "feat(theme): override remaining shadcn components with Midnight Tokyo styling"
```

---

## Chunk 3: Editor Styling

### Task 9: Restyle ProseMirror editor content

**Files:**
- Modify: `src/lib/editor/styles/editor.css` (494 lines)

- [ ] **Step 1: Read the current editor.css**

- [ ] **Step 2: Update heading styles**

Replace heading rules (~lines 30-56):

```css
.ProseMirror h1 {
  font-family: var(--font-mono);
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary, #C0CAF5);
  margin: 1.5em 0 0.5em;
  letter-spacing: -0.01em;
}

.ProseMirror h2 {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #C0CAF5);
  border-left: 3px solid var(--accent-blue, #7AA2F7);
  padding-left: 8px;
  margin: 1.4em 0 0.4em;
}

.ProseMirror h3 {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 600;
  color: var(--accent-purple, #BB9AF7);
  margin: 1.2em 0 0.3em;
}
```

- [ ] **Step 3: Update code block styles**

Replace code block rules (~lines 71-88):

```css
.ProseMirror pre {
  background: var(--surface-1, #13161F);
  border: 1px solid var(--border-subtle, #1E2336);
  border-radius: 4px;
  padding: 16px;
  font-family: var(--font-mono);
  font-size: 14px;
  overflow-x: auto;
}
```

- [ ] **Step 4: Update inline code**

Replace inline code rules (~lines 93-99):

```css
.ProseMirror code {
  color: var(--accent-cyan, #7DCFFF);
  background: var(--surface-2, #1A1E2E);
  border-radius: 2px;
  padding: 1px 4px;
  font-family: var(--font-mono);
  font-size: 0.9em;
}
```

- [ ] **Step 5: Update blockquote styles**

```css
.ProseMirror blockquote {
  background: var(--surface-1, #13161F);
  border-left: 3px solid var(--border-active, #2A2F45);
  padding: 8px 16px;
  margin: 1em 0;
  font-style: italic;
  color: var(--text-secondary, #A9B1D6);
}
```

- [ ] **Step 6: Update link and wiki-link styles**

```css
.ProseMirror a {
  color: var(--accent-blue, #7AA2F7);
  text-decoration: none;
  cursor: pointer;
}
.ProseMirror a:hover {
  text-decoration: underline;
}

.wiki-link {
  color: var(--accent-blue, #7AA2F7);
  text-decoration: none;
  border-bottom: 1px dotted var(--accent-blue, #7AA2F7);
  cursor: pointer;
}
.wiki-link:hover {
  border-bottom-style: solid;
}
```

- [ ] **Step 7: Update task checkbox styles**

Update checkbox accent color from indigo to:
- Checked: `var(--accent-green, #9ECE6A)` for the fill/border
- Unchecked: `var(--border-active, #2A2F45)` for the border

- [ ] **Step 8: Update selection highlight**

```css
.ProseMirror .selection,
.ProseMirror ::selection {
  background: rgba(122, 162, 247, 0.16);
}
```

- [ ] **Step 9: Update search match highlight**

```css
.search-match {
  background: rgba(224, 175, 104, 0.25);
}
.search-match-active {
  background: rgba(224, 175, 104, 0.45);
  box-shadow: 0 0 4px rgba(224, 175, 104, 0.3);
}
```

- [ ] **Step 10: Update horizontal rule**

```css
.ProseMirror hr {
  border: none;
  border-top: 1px solid var(--border-subtle, #1E2336);
  margin: 2em 0;
}
```

- [ ] **Step 11: Update table styles**

Replace table header bg with `var(--surface-1)`, borders with `var(--border-subtle)`.

- [ ] **Step 12: Verify editor styling**

Run: `cargo tauri dev`
Open a note with h1, h2, h3, code blocks, inline code, blockquotes, links, wiki-links, task lists, tables, horizontal rules.
Expected: All elements use Midnight Tokyo colors. h2 has left blue border. h3 is purple. Code blocks are surface-1 with subtle border. Inline code is cyan.

- [ ] **Step 13: Commit**

```bash
git add src/lib/editor/styles/editor.css
git commit -m "feat(theme): restyle ProseMirror editor with Midnight Tokyo typography and colors"
```

---

### Task 10: Restyle editor toolbar and bubble menu

**Files:**
- Modify: `src/lib/editor/BubbleToolbar.svelte`
- Modify: `src/lib/editor/EditorToolbar.svelte`
- Modify: `src/lib/editor/FindReplaceBar.svelte`
- Modify: `src/lib/editor/SlashCommandMenu.svelte`
- Modify: `src/lib/editor/MediaPanel.svelte`

- [ ] **Step 1: Read each editor sub-component**

- [ ] **Step 2: Update BubbleToolbar**

Apply to the floating toolbar container:
- Background: `var(--surface-2)`
- Shadow: `var(--shadow-elevated)`
- Border: none (remove if present)
- Radius: `4px`
- Active formatting button: `color: var(--accent-blue)`. Inactive: `color: var(--text-muted)`. Hover: `background: var(--surface-3)`.

- [ ] **Step 3: Update EditorToolbar**

Same treatment as BubbleToolbar.

- [ ] **Step 4: Update FindReplaceBar**

- Background: `var(--surface-1)`
- Input fields: inherit Input override styling (surface-1, no border, focus glow)
- Match count text: `var(--text-muted)` monospace

- [ ] **Step 5: Update SlashCommandMenu**

- Background: `var(--surface-2)`
- Shadow: `var(--shadow-elevated)`
- Selected item: `var(--surface-3)` bg with `var(--accent-blue)` left border
- Text: `var(--text-primary)`, descriptions in `var(--text-muted)`

- [ ] **Step 6: Update MediaPanel**

- Background: `var(--surface-2)`
- Shadow: `var(--shadow-elevated)`

- [ ] **Step 7: Verify all editor toolbars**

Run: `cargo tauri dev`
Select text to show bubble toolbar. Use Cmd+F for find/replace. Type `/` for slash commands.
Expected: All popups use surface-2 bg, elevated shadow, accent-blue highlights. No default shadcn styling visible.

- [ ] **Step 8: Commit**

```bash
git add src/lib/editor/
git commit -m "feat(theme): restyle editor toolbars and menus with Midnight Tokyo styling"
```

---

### Task 11: Update media.css

**Files:**
- Modify: `src/lib/editor/styles/media.css`

- [ ] **Step 1: Read current media.css**

- [ ] **Step 2: Update media block backgrounds and borders**

Replace `--color-card` references with `var(--surface-1)`, border colors with `var(--border-subtle)`, hover states with `var(--surface-3)`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/editor/styles/media.css
git commit -m "feat(theme): update media block styles for Midnight Tokyo"
```

---

## Chunk 4: Targeted Layout Fixes

### Task 12: Restyle Home Dashboard

**Files:**
- Modify: `src/lib/components/home/HomeView.svelte`

- [ ] **Step 1: Read current HomeView.svelte**

- [ ] **Step 2: Restyle vault title**

Update the title element:
- Font: `var(--font-mono)`, `font-weight: 600`
- Size: keep current clamp, or tighten to `clamp(1.6rem, 2.2vw, 2rem)`
- Color: `var(--text-primary)`
- Add subtitle line below: `var(--text-muted)` with note count and link count, e.g., "37 notes · 73 links"

- [ ] **Step 3: Restyle stats row as cards**

Wrap each stat in a container with:
- Background: `var(--surface-1)`
- Shadow: `var(--shadow-elevated)`
- Radius: `6px`
- Padding: `12px 16px`
- Number: `var(--text-primary)`, `font-size: 1.5rem`, `font-weight: 600`, monospace
- Label: `var(--text-muted)`, `font-variant: small-caps`, `font-size: 10px`, monospace

- [ ] **Step 4: Restyle section headers**

"MOST LINKED" and "RECENT" headers:
- Font: `var(--font-mono)`, `font-variant: small-caps`, `10px`, `var(--text-muted)`
- Optional Nerd Font glyph prefix using `nerdIcon('most-linked')` and `nerdIcon('recent')`

- [ ] **Step 5: Restyle list items**

Each file entry in the lists:
- Add Nerd Font file icon via `fileIcon(filename)` before the title
- Title: `var(--text-primary)`, `var(--font-mono)`, `13px`
- Count/time: `var(--text-muted)`, right-aligned
- Hover: `background: var(--surface-3)`, `border-radius: 4px`, `150ms ease-out`
- Generous row height: `36-40px` with proper vertical centering

- [ ] **Step 6: Add spacing between sections**

Increase vertical gap between stats row, most-linked, and recent sections to `32px+`.

- [ ] **Step 7: Verify home dashboard**

Run: `cargo tauri dev`
Expected: Dashboard looks like a crafted overview, not a debug printout. Stats are in subtle cards. Lists have file icons. Typography is monospace. Everything uses Midnight Tokyo colors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/home/HomeView.svelte
git commit -m "feat(theme): restyle home dashboard with Midnight Tokyo cards and typography"
```

---

### Task 13: Restyle Tab Bar

**Files:**
- Modify: `src/lib/components/tabs/TabBar.svelte`
- Modify: `src/lib/components/tabs/TabItem.svelte`

- [ ] **Step 1: Read current tab components**

- [ ] **Step 2: Update TabBar container**

- Background: `var(--base)` (flush with title bar)
- Border-bottom: `1px solid var(--border-subtle)`
- Remove any existing background that differs from base

- [ ] **Step 3: Update TabItem styling**

- Font: `var(--font-mono)`, `12px`
- Active tab: `background: var(--surface-3)`, `border-top: 2px solid var(--accent-blue)`, `color: var(--text-primary)`
- Inactive tab: `background: transparent`, `color: var(--text-muted)`
- Hover (inactive): `color: var(--text-secondary)`, `background: var(--surface-3)`
- Close button: `opacity: 0` by default, `opacity: 1` on tab hover, color `var(--text-muted)`, hover color `var(--accent-red)`
- Drag-over indicator: `var(--accent-blue)` instead of current indigo
- Remove any hardcoded `rgba(99, 102, 241, ...)` indigo references

- [ ] **Step 4: Add Nerd Font file-type icon**

Import `fileIcon` from `nerd-icons.ts`. Before the tab label text, add a `<span>` with the glyph:

```svelte
<span class="tab-icon" style="font-family: var(--font-mono)">{fileIcon(tab.name)}</span>
```

For the Home tab, use `nerdIcon('home')`.

- [ ] **Step 5: Verify tabs**

Run: `cargo tauri dev`
Open multiple files. Check active/inactive states, hover, close button visibility, drag reorder.
Expected: Monospace labels, file-type icons, accent-blue top border on active, clean transitions.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/tabs/
git commit -m "feat(theme): restyle TabBar with Midnight Tokyo colors and Nerd Font icons"
```

---

### Task 14: Restyle Left Sidebar — File Tree, Search, Calendar, Core Switcher

**Files:**
- Modify: `src/lib/components/filetree/FileTreeNode.svelte`
- Modify: `src/lib/components/filetree/FileTree.svelte`
- Modify: `src/lib/components/search/SearchBar.svelte`
- Modify: `src/lib/components/sidebar/CalendarWidget.svelte`
- Modify: `src/lib/components/common/CoreSwitcher.svelte`

- [ ] **Step 1: Read all sidebar component files**

- [ ] **Step 2: Update FileTreeNode — icons and active state**

Replace Lucide file/folder icons with Nerd Font glyphs:
- Import `fileIcon`, `nerdIcon` from `nerd-icons.ts`
- Folders: `nerdIcon('folder-open')` / `nerdIcon('folder-closed')` instead of Lucide Folder/FolderOpen
- Files: `fileIcon(node.name)` instead of Lucide FileText/File
- Render glyphs in a `<span>` with `font-family: var(--font-mono)` and `font-size: 14px`

Update active file styling:
- Remove: `background: rgba(99, 102, 241, 0.1)` (hardcoded indigo)
- Add: `background: var(--surface-3)`, `border-left: 3px solid var(--accent-blue)`
- Hover: `background: var(--surface-3)`, `transition: background 150ms ease-out`
- Focus: `box-shadow: var(--glow-focus)` instead of `outline: 2px solid var(--color-accent)`

Update pin star color:
- Pinned: keep `#eab308` (gold) — it's distinctive and intentional
- Hover: `var(--accent-blue)` instead of current accent

- [ ] **Step 3: Update FileTree container**

- Drag ghost: update `background` to `var(--surface-2)`, `border` to `var(--border-subtle)`
- Zone active focus: use `var(--glow-focus)` instead of `outline: 2px solid`

- [ ] **Step 4: Update Search bar**

- Background: `var(--surface-2)`
- No border
- Placeholder: `var(--text-muted)`, monospace
- Add Nerd Font search glyph (``): `nerdIcon('search')` as prefix
- Focus: `var(--glow-focus)`

- [ ] **Step 5: Update CalendarWidget**

- Today marker: `background: var(--accent-blue)` instead of green
- Note-exists dot: `background: var(--accent-purple)` instead of green
- Day hover: `background: var(--surface-3)`
- Month/year header: `var(--font-mono)`, `var(--text-primary)`
- Day labels (MO, TU...): `var(--text-muted)`, monospace
- Navigation arrows: `var(--text-muted)`, hover `var(--text-primary)`
- "Today" button: `var(--accent-blue)` border/text

- [ ] **Step 6: Update CoreSwitcher**

- Font: `var(--font-mono)`
- Add Nerd Font vault glyph: `nerdIcon('vault')` before vault name
- Gear icon: `color: var(--text-muted)`, hover `var(--text-secondary)`

- [ ] **Step 7: Verify entire left sidebar**

Run: `cargo tauri dev`
Check: file tree icons, active file state, search bar, calendar today/dots, core switcher.
Expected: Nerd Font icons in tree, accent-blue active indicator, purple calendar dots, monospace throughout.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/filetree/ src/lib/components/search/ src/lib/components/sidebar/ src/lib/components/common/CoreSwitcher.svelte
git commit -m "feat(theme): restyle left sidebar with Nerd Font icons and Midnight Tokyo colors"
```

---

### Task 15: Restyle Right Sidebar Rail — labels and icons

**Files:**
- Modify: `src/routes/+layout.svelte` (where the utility rail icons are rendered)
- Modify: `src/lib/components/layout/AppShell.svelte` (rail styling)

- [ ] **Step 1: Read +layout.svelte to find the utility rail icon rendering**

The utility rail is likely a `{#snippet}` passed to AppShell. Find where the 5 icons (Rows3, Network, Link, ListChecks, Info) are rendered.

- [ ] **Step 2: Replace Lucide icons with Nerd Font glyphs + labels**

The **actual** utility rail buttons in `+layout.svelte` (lines 831-872) are:

| Current Lucide | Function | New Nerd Font glyph | Label |
|----------------|----------|---------------------|-------|
| `Menu` | Command palette | `nerdIcon('search')` | `cmd` |
| `ListChecks` | Tasks modal | `nerdIcon('tasks')` | `tasks` |
| `GitFork` | Graph panel | `nerdIcon('graph')` | `graph` |
| `PanelRight` | Detail rail toggle | `nerdIcon('info')` | `panel` |
| `Plus` | New note | (keep Lucide Plus or use `+` text) | `new` |

For each rail button, replace the Lucide component with:

```svelte
<button
  class="rail-btn"
  class:active={ui.commandPaletteVisible}
  onclick={() => ui.showCommandPalette()}
  aria-label="Command palette"
>
  <span class="rail-icon">{nerdIcon('search')}</span>
  <span class="rail-label">cmd</span>
</button>
```

Note: Use `onclick` (Svelte 5 syntax), not `on:click`.

- [ ] **Step 3: Style the rail buttons**

```css
.rail-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  color: var(--text-muted);
  transition: color 150ms ease-out;
  cursor: pointer;
  background: none;
  border: none;
}
.rail-btn:hover {
  color: var(--text-secondary);
}
.rail-btn.active {
  color: var(--accent-blue);
}
.rail-icon {
  font-family: var(--font-mono);
  font-size: 16px;
  line-height: 1;
}
.rail-label {
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1;
}
```

- [ ] **Step 4: Update AppShell rail background**

In AppShell.svelte, update `.app-shell__rail`:
- Background: `var(--surface-1)` instead of `var(--color-background)`
- Border: `border-left: 1px solid var(--border-subtle)`

- [ ] **Step 5: Verify right sidebar rail**

Run: `cargo tauri dev`
Expected: 5 icons with tiny monospace labels below. Active panel icon is accent-blue. Inactive icons are text-muted. No more mystery meat.

- [ ] **Step 6: Commit**

```bash
git add src/routes/+layout.svelte src/lib/components/layout/AppShell.svelte
git commit -m "feat(theme): add labeled Nerd Font icons to right sidebar rail"
```

---

### Task 16: Restyle AppShell borders and surfaces

**Files:**
- Modify: `src/lib/components/layout/AppShell.svelte`

- [ ] **Step 1: Read current AppShell styles**

- [ ] **Step 2: Update surface colors**

- `.app-shell__sidebar`: `background: var(--surface-1)`, `border-right: 1px solid var(--border-subtle)`
- `.app-shell__content`: background inherits `var(--base)` from body
- `.app-shell__rail`: `background: var(--surface-1)`, `border-left: 1px solid var(--border-subtle)`
- `.app-shell__right`: `background: var(--surface-2)`, `border-left: 1px solid var(--border-subtle)`

- [ ] **Step 3: Verify layout regions**

Run: `cargo tauri dev`
Expected: Clear visual distinction between sidebar (surface-1), editor (base), and right panel (surface-2). Borders are barely visible, navy-toned.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/layout/AppShell.svelte
git commit -m "feat(theme): update AppShell surface colors and borders for Midnight Tokyo"
```

---

### Task 17: Restyle Tasks Modal

**Files:**
- Modify: `src/lib/components/common/TasksModal.svelte`

- [ ] **Step 1: Read current TasksModal**

- [ ] **Step 2: Update modal sizing**

Change from standard dialog size to large overlay:
- Width: `min(80vw, 900px)`
- Max-height: `80vh`
- Center: use existing dialog positioning or add `margin: auto`

- [ ] **Step 3: Update filter tabs**

Replace current tab styling with pill toggles:
- Active: `background: var(--accent-blue)`, `color: var(--base)`, `border-radius: 16px`, `padding: 4px 12px`
- Inactive: `background: var(--surface-3)`, `color: var(--text-muted)`, same radius/padding
- Transition: `150ms ease-out`

- [ ] **Step 4: Update task items**

- Row height: `40px+`
- Checkbox: `var(--accent-green)` checked, `var(--border-active)` unchecked
- Checked text: `color: var(--text-muted)`, `text-decoration: line-through`
- File group headers: `var(--font-mono)`, `var(--text-muted)`, `font-variant: small-caps`

- [ ] **Step 5: Verify tasks modal**

Run: `cargo tauri dev`
Click tasks icon in right rail.
Expected: Large centered overlay, pill filter tabs, properly styled checkboxes, monospace file headers.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/common/TasksModal.svelte
git commit -m "feat(theme): restyle Tasks modal as large overlay with Midnight Tokyo styling"
```

---

### Task 18: Restyle Settings Modal

**Files:**
- Modify: `src/lib/components/common/SettingsModal.svelte`

- [ ] **Step 1: Read current SettingsModal**

- [ ] **Step 2: Update backdrop and container**

- Backdrop: `background: rgba(0, 0, 0, 0.6)`, `backdrop-filter: blur(8px)`
- Container: `background: var(--surface-2)`, `border: none`, `box-shadow: var(--shadow-modal)`

- [ ] **Step 3: Update nav item active state**

Replace `rgba(99, 102, 241, 0.12)` (hardcoded indigo) with `var(--surface-3)` and add `border-left: 2px solid var(--accent-blue)` on active.

- [ ] **Step 4: Update accent color swatches**

Replace the current 9-color swatch array:
```typescript
const accentSwatches = [
  { color: '#7AA2F7', label: 'Blue' },
  { color: '#BB9AF7', label: 'Purple' },
  { color: '#7DCFFF', label: 'Cyan' },
  { color: '#9ECE6A', label: 'Green' },
  { color: '#F7768E', label: 'Red' },
  { color: '#FF9E64', label: 'Orange' },
];
```

- [ ] **Step 5: Update form inputs and labels**

- Labels: `var(--font-mono)`, `var(--text-muted)`, `11px`
- Inputs/selects: inherit from shadcn overrides (surface-1, no border, focus glow)

- [ ] **Step 6: Verify settings modal**

Run: `cargo tauri dev`
Open Settings (gear icon or Cmd+,).
Expected: Surface-2 background, no hardcoded indigo, Tokyo Night accent swatches, monospace labels, clean active nav state.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/common/SettingsModal.svelte
git commit -m "feat(theme): restyle Settings modal with Midnight Tokyo colors and Tokyo Night swatches"
```

---

### Task 19: Update settings store defaults

**Files:**
- Modify: `src/lib/stores/settings.svelte.ts`

- [ ] **Step 1: Read current settings store**

- [ ] **Step 2: Update default accent color**

Change `accentColor: '#6366f1'` to `accentColor: '#7AA2F7'` (Midnight Tokyo blue).

- [ ] **Step 3: Fix accent color sentinel in +layout.svelte**

In `src/routes/+layout.svelte` (~line 90), the `$effect` checks `accent !== '#6366f1'` as the default sentinel. After changing the default to `#7AA2F7`, this check is stale — it would always override.

Update the sentinel from `'#6366f1'` to `'#7AA2F7'`:

```typescript
if (accent && accent !== '#7AA2F7') {
```

This ensures the accent color only applies inline overrides when the user has picked a non-default swatch.

- [ ] **Step 4: Update default font preferences if applicable**

If the store has default font values, update:
- `fontMono`: `'JetBrainsMono Nerd Font'`
- `fontSans`: `'IBM Plex Sans'`
- `fontContent`: `'IBM Plex Sans'`

Only set defaults — users can still override via settings UI.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/settings.svelte.ts src/routes/+layout.svelte
git commit -m "feat(theme): update default accent and font settings for Midnight Tokyo"
```

---

## Chunk 5: Remaining Surfaces & Polish

### Task 20: Restyle remaining common and layout components

**Files:**
- Modify: `src/lib/components/common/ContextMenu.svelte`
- Modify: `src/lib/components/common/ExportDialog.svelte`
- Modify: `src/lib/components/common/InputDialog.svelte`
- Modify: `src/lib/components/common/EmptyState.svelte`
- Modify: `src/lib/components/common/Toast.svelte` (or ToastContainer.svelte)
- Modify: `src/lib/components/quickopen/QuickOpen.svelte`
- Modify: `src/lib/components/quickopen/ResultsList.svelte`
- Modify: `src/lib/components/quickopen/SearchInput.svelte`
- Modify: `src/lib/components/dashboard/Dashboard.svelte`
- Modify: `src/lib/components/layout/Worksurface.svelte`
- Modify: `src/lib/components/layout/ContentHeader.svelte`
- Modify: `src/lib/components/layout/Sidebar.svelte`

- [ ] **Step 1: Read each component**

- [ ] **Step 2: Update ContextMenu**

- Background: `var(--surface-2)`
- Shadow: `var(--shadow-elevated)`
- Item hover: `var(--surface-3)`
- Destructive items: `var(--accent-red)`

- [ ] **Step 3: Update ExportDialog and InputDialog**

These use Dialog under the hood — should inherit most styling. Check for any hardcoded colors and replace.

- [ ] **Step 4: Update EmptyState**

- Text: `var(--text-muted)`
- Any icons: `var(--text-faint)` (decorative use)

- [ ] **Step 5: Update Toast**

If using svelte-sonner, check if it picks up CSS variables or needs explicit overrides:
- Success toast: left border `var(--accent-green)`
- Error toast: left border `var(--accent-red)`
- Background: `var(--surface-2)`

- [ ] **Step 6: Update QuickOpen components**

**QuickOpen.svelte:** Container uses `var(--surface-2)` bg, `var(--shadow-modal)` shadow, dark overlay.
**SearchInput.svelte:** Same Input override treatment — `var(--surface-1)` bg, monospace, focus glow.
**ResultsList.svelte:** Selected item `var(--surface-3)` bg with `var(--accent-blue)` left border. File names in `var(--text-primary)`, paths in `var(--text-muted)`.

- [ ] **Step 7: Update Dashboard.svelte**

Read the component and apply Midnight Tokyo tokens. It may overlap with HomeView — check whether Dashboard wraps HomeView or is a separate surface.

- [ ] **Step 8: Update layout components (Worksurface, ContentHeader, Sidebar)**

These are structural wrappers. Read each and replace any hardcoded colors with Midnight Tokyo tokens. Sidebar background: `var(--surface-1)`. ContentHeader: `var(--base)` with `var(--border-subtle)` bottom border if present. Worksurface: should inherit from parent.

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/common/ src/lib/components/quickopen/ src/lib/components/dashboard/ src/lib/components/layout/
git commit -m "feat(theme): restyle remaining common, quickopen, dashboard, and layout components"
```

---

### Task 21: Restyle right panels (Backlinks, Outline, NoteDetails)

**Files:**
- Modify: `src/lib/components/panels/BacklinksPanel.svelte`
- Modify: `src/lib/components/panels/OutlinePanel.svelte`
- Modify: `src/lib/components/panels/NoteDetailsPanel.svelte`

- [ ] **Step 1: Read each panel component**

- [ ] **Step 2: Update panel styles**

These panels render inside the right panel area (`.app-shell__right` which is already `var(--surface-2)`).

For each panel:
- Section headers: `var(--font-mono)`, `font-variant: small-caps`, `var(--text-muted)`, `11px`
- List items: `var(--text-primary)`, hover `var(--surface-3)`
- Links/file references: `var(--accent-blue)`
- Metadata values: `var(--text-secondary)`

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/panels/
git commit -m "feat(theme): restyle right panel components for Midnight Tokyo"
```

---

### Task 22: Restyle Properties Panel

**Files:**
- Modify: `src/lib/components/editor/PropertiesPanel.svelte`

- [ ] **Step 1: Read current PropertiesPanel**

- [ ] **Step 2: Update styles**

- Container border-bottom: `var(--border-subtle)`
- Key labels: `var(--font-mono)`, `var(--text-muted)`, `12px`
- Value inputs: inherit Input override styling
- Tag pills: `background: rgba(122, 162, 247, 0.1)`, `color: var(--accent-blue)`, `border-radius: 4px`
- "+ Add property" button: `var(--text-muted)`, `var(--font-mono)`, `11px`
- Collapsed state: `var(--text-muted)` chevron and label

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/editor/PropertiesPanel.svelte
git commit -m "feat(theme): restyle Properties panel for Midnight Tokyo"
```

---

### Task 23: Restyle Graph View

**Files:**
- Modify: `src/lib/components/graph/GraphView.svelte`

Note: Per spec, graph view gets Midnight Tokyo colors only — no cosmetic upgrade to constellation aesthetic.

- [ ] **Step 1: Read current GraphView**

- [ ] **Step 2: Update canvas colors**

- Background: `var(--base)` or `#0A0E1A`
- Node fill: `var(--text-muted)` or `#6B7394`
- Active node: `var(--accent-blue)` or `#7AA2F7`
- Edge stroke: `var(--border-subtle)` or `#1E2336`
- Hovered/connected node: `var(--accent-purple)` or `#BB9AF7`
- Label text: `var(--text-secondary)` or `#A9B1D6`

Since this is canvas-based, these need to be set as hex values in the JS draw calls, not CSS variables. Use the hex values directly.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/graph/GraphView.svelte
git commit -m "feat(theme): update graph view colors for Midnight Tokyo"
```

---

### Task 24: Final visual audit and cleanup

**Files:**
- Potentially any file with hardcoded colors

- [ ] **Step 1: Search for remaining hardcoded indigo references**

Search the codebase for `#6366f1`, `rgb(99, 102, 241)`, `rgba(99, 102, 241`, and `indigo` to find any remaining old accent colors.

```bash
grep -rn "6366f1\|rgb(99.*102.*241\|indigo" src/
```

- [ ] **Step 2: Replace any remaining hardcoded colors**

Update any found references to use the appropriate Midnight Tokyo CSS variable or hex value.

- [ ] **Step 3: Search for other hardcoded grays that should use tokens**

```bash
grep -rn "#09090b\|#0f0f12\|#fafafa\|#27272a\|#18181b" src/
```

Replace with appropriate `var(--*)` tokens.

- [ ] **Step 4: Full visual walkthrough**

Run: `cargo tauri dev`
Check every surface:
- [ ] Home dashboard
- [ ] File tree (expanded, collapsed, active, hover)
- [ ] Calendar (today, dots, navigation)
- [ ] Tabs (active, inactive, hover, close, drag)
- [ ] Editor (h1-h3, code, blockquotes, links, tasks, tables)
- [ ] Bubble toolbar
- [ ] Find/Replace
- [ ] Right sidebar rail (icons + labels)
- [ ] Backlinks panel
- [ ] Outline panel
- [ ] Note details panel
- [ ] Properties panel
- [ ] Graph view
- [ ] Settings modal
- [ ] Tasks modal
- [ ] Command palette (Cmd+K)
- [ ] Context menu (right-click)
- [ ] Export dialog
- [ ] Core switcher
- [ ] Scrollbars
- [ ] Toast notifications

- [ ] **Step 5: Fix any visual inconsistencies found**

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(theme): final cleanup — remove hardcoded colors, visual consistency pass"
```

---

## Summary

| Chunk | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-4 | Foundation: tokens, fonts, globals |
| 2 | 5-8 | shadcn component overrides |
| 3 | 9-11 | Editor styling |
| 4 | 12-19 | Targeted layout fixes |
| 5 | 20-24 | Remaining surfaces & polish |

**Total tasks:** 24
**Total commits:** ~24

Each chunk produces a visually reviewable state. Chunk 1 alone will dramatically change the app's feel because the token system cascades to every component.
