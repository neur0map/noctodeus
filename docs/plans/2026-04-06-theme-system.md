# Theme System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark/light/system toggle with 8 visual themes shown as preview cards in settings, with full color token definitions applied at runtime.

**Architecture:** Themes are defined as TypeScript objects in `src/lib/themes/`. A `applyTheme()` function sets CSS custom properties on `:root`. The settings store saves theme ID. The settings modal Appearance section shows a grid of preview cards. The hardcoded `.dark` CSS block is removed — all colors are runtime-applied.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, CSS custom properties

**Spec:** `docs/specs/2026-04-06-theme-system-design.md`

---

### Task 1: Create theme definitions

**Files:**
- Create: `src/lib/themes/themes.ts`

Define all 8 themes with complete color token values. Each theme must provide values for every CSS variable currently in the `:root, .dark` block of `app.css`.

### Task 2: Create theme application function

**Files:**
- Create: `src/lib/themes/apply.ts`

A function that takes a theme ID, looks it up, and sets all CSS variables on `document.documentElement`. Also sets `color-scheme`, `data-theme` attribute, and dark/light class.

### Task 3: Update settings store

**Files:**
- Modify: `src/lib/stores/settings.svelte.ts`

Change `theme` type from `ThemeMode` to `string` (theme ID). Default to `'midnight-tokyo'`. Add migration logic in `loadFromStorage` to convert old `'dark'`/`'light'`/`'system'` values. Remove `accentColor` from defaults.

### Task 4: Update +layout.svelte theme effects

**Files:**
- Modify: `src/routes/+layout.svelte`

Replace the existing theme `$effect` (applyTheme/watchSystemTheme) and accent color `$effect` with a single effect that calls the new `applyTheme(appSettings.theme)`. Keep font and custom CSS effects as-is.

### Task 5: Remove hardcoded colors from app.css

**Files:**
- Modify: `src/lib/styles/app.css`

Remove the `:root, .dark { }` and `.light { }` color blocks. Keep spacing tokens, radius, `@theme inline` block, keyframes, global styles, and utilities. The color values are now set by JS at runtime.

### Task 6: Redesign Appearance section in SettingsModal

**Files:**
- Modify: `src/lib/components/common/SettingsModal.svelte`

Replace the theme toggle + accent swatches with a grid of preview cards. Each card shows the theme's colors with sample text. Selected theme has glow-trace animation. Keep font and custom CSS controls below. Add helper text for custom CSS selectors.

### Task 7: Clean up old theme utilities

**Files:**
- Modify or delete: `src/lib/utils/theme.ts`

Remove `applyTheme`, `watchSystemTheme`, `getSystemTheme` — replaced by the new theme system. If any other file imports from here, update those imports.
