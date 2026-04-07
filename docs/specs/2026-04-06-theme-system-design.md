# Theme System — Visual Themes with Preview Cards

**Date:** 2026-04-06
**Status:** Approved

## Problem

The Appearance section in settings has a basic dark/light/system toggle and accent color swatches. This is generic — every shadcn app has the same thing. Users want real themes with distinct personalities, previewed visually before applying, like Bear's theme picker.

## Goal

Replace the theme toggle and accent swatches with a grid of 8 visual theme preview cards. Each theme is a complete color palette. Fonts, editor width, and custom CSS remain independent settings.

---

## 1. Themes

8 themes in 3 groups:

### Dark

**Midnight Tokyo** (default)
- Base: `#0A0E1A`, Foreground: `#C0CAF5`, Accent: `#7AA2F7`
- The current theme — deep navy, Tokyo Night-inspired

**Obsidian**
- Base: `#000000`, Foreground: `#E0E0E0`, Accent: `#FFFFFF`
- True black OLED. Minimal grays. High contrast. No color accent — pure white highlight.
- Surface-1: `#0A0A0A`, Surface-2: `#141414`, Border: `#1A1A1A`

**Nord Frost**
- Base: `#2E3440`, Foreground: `#ECEFF4`, Accent: `#88C0D0`
- Muted arctic palette. Cool blue-gray surfaces. Teal/frost accent.
- Surface-1: `#3B4252`, Surface-2: `#434C5E`, Border: `#4C566A`
- Uses Nord's official palette

### Light

**Dawn**
- Base: `#FFFFFF`, Foreground: `#1A1A2E`, Accent: `#4F6BED`
- Clean warm white. Soft gray UI chrome. Blue accent.
- Surface-1: `#F5F5F7`, Surface-2: `#EBEBEF`, Border: `#D8D8DC`

**Paper**
- Base: `#FAFAF8`, Foreground: `#1C1C1C`, Accent: `#2C2C2C`
- Off-white cream. Ink-black text. No-nonsense, editorial. Accent is dark gray — no color distraction.
- Surface-1: `#F0F0EE`, Surface-2: `#E6E6E4`, Border: `#D4D4D2`

**Solarized Light**
- Base: `#FDF6E3`, Foreground: `#657B83`, Accent: `#268BD2`
- Classic Solarized Light. Warm yellow-cream background. Blue/cyan accents.
- Surface-1: `#EEE8D5`, Surface-2: `#E8E2CF`, Border: `#D6D0BD`
- Uses Solarized official values

### Warm

**Khaki**
- Base: `#F5F0E8`, Foreground: `#3D3529`, Accent: `#A67C52`
- Warm sepia paper. Brown/amber tones. Like aged parchment under lamplight.
- Surface-1: `#ECE7DF`, Surface-2: `#E3DED6`, Border: `#D1CBBF`

**Rosé Pine**
- Base: `#191724`, Foreground: `#E0DEF4`, Accent: `#EB6F92`
- Muted rose on dark warm gray. Purple undertones. Uses Rosé Pine official palette.
- Surface-1: `#1F1D2E`, Surface-2: `#26233A`, Border: `#393552`

---

## 2. Theme Data Structure

```typescript
interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  // Sidebar
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  // Extended tokens
  base: string;
  surface1: string;
  surface2: string;
  surface3: string;
  borderSubtle: string;
  borderActive: string;
  accentBlue: string;
  accentPurple: string;
  accentCyan: string;
  accentGreen: string;
  accentRed: string;
  accentOrange: string;
  accentYellow: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  hover: string;
  placeholder: string;
  accentHover: string;
  floatShadow: string;
}

interface Theme {
  id: string;
  name: string;
  group: 'dark' | 'light' | 'warm';
  colorScheme: 'dark' | 'light';
  colors: ThemeColors;
  preview: {
    bg: string;
    text: string;
    textMuted: string;
    link: string;
  };
}
```

---

## 3. File Structure

| File | Purpose |
|------|---------|
| `src/lib/themes/themes.ts` | All 8 theme definitions as `Theme[]` export |
| `src/lib/themes/apply.ts` | `applyTheme(themeId: string)` — sets CSS variables on `:root`, sets `data-theme`, `color-scheme` |
| `src/lib/stores/settings.svelte.ts` | Change `theme` from `'dark' \| 'light' \| 'system'` to theme ID string (default `'midnight-tokyo'`) |
| `src/routes/+layout.svelte` | Update the theme `$effect` to use new `applyTheme()` |
| `src/lib/utils/theme.ts` | Simplify or remove — `applyTheme` moves to `themes/apply.ts` |
| `src/lib/components/common/SettingsModal.svelte` | Replace Appearance section with theme picker grid + font/CSS controls |
| `src/lib/styles/app.css` | Remove hardcoded `.dark { }` color block — themes define all values at runtime |

---

## 4. Theme Application

```typescript
// themes/apply.ts
import { THEMES } from './themes';

export function applyTheme(themeId: string) {
  const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0];
  const root = document.documentElement;

  // Set color scheme for browser chrome
  root.style.setProperty('color-scheme', theme.colorScheme);
  root.classList.remove('dark', 'light');
  root.classList.add(theme.colorScheme);
  root.setAttribute('data-theme', theme.colorScheme);

  // Apply all color tokens
  for (const [key, value] of Object.entries(theme.colors)) {
    const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
    root.style.setProperty(cssVar, value);
  }
}
```

The `$effect` in `+layout.svelte` calls `applyTheme(appSettings.theme)` whenever the theme setting changes.

---

## 5. Settings UI — Appearance Section

### Theme Picker Grid

2-column grid of preview cards. Each card:
- Background: the theme's `preview.bg` color
- Theme name: `preview.text` color, `font-weight: 600`, monospace
- Sample line 1: "Lorem ipsum **dolor sit** amet" — normal + bold in `preview.text`
- Sample line 2: "consectetur *semper* pharetra." — with "semper" in `preview.link` color
- Border: `1px solid` at 6% white/black opacity (depending on colorScheme)
- Border-radius: `10px`
- Selected card: glow-trace animation (existing signature effect)
- Click: immediately applies theme + saves to settings

Group headers above each section: "Dark", "Light", "Warm" — small-caps monospace labels.

### Font & Editor Controls (below themes)

Kept as-is:
- Font size dropdown
- Mono font override input
- Sans font override input
- Content font override input
- Editor width selector

### Custom CSS (bottom)

- Textarea (kept)
- Helper text below: "Use `.ProseMirror` for editor, `.app-shell` for layout, `:root` for tokens"
- Verify the injection `$effect` works — it exists at `+layout.svelte` and creates/updates a `<style id="noctodeus-custom-css">` element

### Removed

- Dark/Light/System toggle — replaced by theme cards
- Accent color swatch picker — themes bring their own accent

---

## 6. Migration

Users with old settings values:
- `theme: 'dark'` → `'midnight-tokyo'`
- `theme: 'light'` → `'dawn'`
- `theme: 'system'` → `'midnight-tokyo'` (default to dark, user can change)
- `accentColor` field: kept in settings interface but ignored — themes control accent. Remove the accent `$effect` override logic.

---

## 7. CSS Architecture Change

Currently the `.dark { }` block in `app.css` hardcodes Midnight Tokyo values. After this change:
- Remove the entire `:root, .dark { }` color block from `app.css`
- Keep only: spacing tokens (`--space-*`), `--radius`, `@theme inline` block, keyframes, global styles, utilities
- The `@theme inline` block's color mappings (`--color-background: var(--background)`) stay — they reference the runtime-set variables
- The `.light { }` block is also removed — light theme values come from the theme objects
- Theme values are set on `:root` via JS at runtime, so Tailwind's `var()` references resolve correctly

---

## 8. Out of Scope

- System theme auto-detection (follow OS dark/light) — can be added later as a "System" option that picks the closest matching theme
- Custom user-created themes
- Theme import/export
- Per-note theme override
