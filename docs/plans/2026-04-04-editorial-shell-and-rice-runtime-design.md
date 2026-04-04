# Noctodeus Editorial Shell + Rice Runtime Design

**Date:** 2026-04-04
**Status:** Validated design
**Scope:** Base UI redesign plus global dotfile-driven ricing

## Summary

Noctodeus should ship with a premium default interface that already feels close to the validated reference direction:

- dark, calm, high-trust shell
- floating central writing stage with breathing room
- visually separate editor surface that does not touch the content edges
- tighter, more infrastructural sidebar
- restrained top chrome
- strong editorial reading experience

On top of that base UI, Noctodeus should support power-user "ricing" through `~/.config/noctodeus/` using an override-only configuration model.

The default UI lives in the app. Dotfiles only patch it.

If the config files are missing, empty, or fully commented out, Noctodeus should render the stock UI with no degradation. Users can revert to the shipped default by commenting overrides back out.

## Goals

1. Ship a strong default shell and editor stage that feels premium without any user customization.
2. Make Noctodeus feel closer to a tuned environment than a generic notes app.
3. Support runtime-safe, dotfile-native customization from `~/.config/noctodeus/`.
4. Preserve the current app architecture: Rust owns filesystem/config truth, Svelte renders resolved state.
5. Ensure bad rice cannot brick the app or interfere with note editing.

## Non-Goals

- Replacing the app's fundamental layout grammar.
- Letting user CSS mutate data flow or component behavior.
- Per-Core visual overrides in the first version.
- A visual theme builder UI as the primary customization workflow.
- Marketplace-style theming before the base system is hardened.

## Product Decisions

### Stable skeleton

The core shell structure stays stable:

- sidebar remains sidebar
- content area remains content area
- editor stage remains central
- command palette, quick open, header, file tree, and toolbar keep their semantic roles

Ricing changes presentation, proportion, density, material feel, motion, and emphasis. It does not redefine the shell architecture.

### Config ownership

Global ricing is canonical and lives in:

```text
~/.config/noctodeus/
```

Per-Core `.noctodeus/` remains reserved for core metadata and app operations:

- manifest
- SQLite metadata
- logs
- cache

Visual customization should not depend on `.noctodeus/` in the first release of the rice system.

### Override-only philosophy

Built-in defaults remain authoritative.

User config is an optional override layer. This avoids config drift and supports a clean "comment out to revert" workflow.

Merge order:

1. built-in app defaults
2. uncommented values from `~/.config/noctodeus/`
3. optional preset imports
4. optional advanced CSS snippets

## Design Principles

### 1. Premium by default

The shipped UI should already be excellent before any rice is applied.

### 2. Same skeleton, tunable skin

Users can tune mood, proportion, material, and density without breaking the app's behavioral grammar.

### 3. CSS for appearance, TOML for structure

User-facing config should be easy to edit by hand and easy to validate safely.

### 4. Runtime-safe

Invalid config must never prevent startup. Last-known-good and safe mode are mandatory.

### 5. No generic AI aesthetics

The UI should avoid obvious startup-dashboard patterns, bright gradient gimmicks, generic glassmorphism, and template-like component styling.

## Target UX

### Editorial Monolith

The shell should feel like a precision instrument housing a softer editorial core.

Visual read:

- shell = tuned machine
- writing stage = protected thinking space

The main emotional goal is contrast between:

- dense, infrastructural chrome
- spacious, deliberate note surface

### Floating Worksurface

The editor should sit inside an inset stage with:

- generous outer gutter
- distinct radius
- inner stroke with soft opacity
- low, wide shadow for lift
- separate material value from the shell
- enough inner padding to make the content feel protected

The writing surface should never feel edge-to-edge or fused to the app chrome.

### Sidebar Character

The sidebar should be:

- tighter than the editor stage
- more mono/technical in rhythm
- visually recessed
- denser and more infrastructural than document-like

The editor stays airy and editorial while the shell stays tool-like.

## Shell Architecture Contract

The first version of the rice system should preserve this structure:

```text
AppShell
  Sidebar
  ContentArea
    Header
    WritingStage
      Toolbar
      EditorSurface
  Optional UtilityRail / RightPanel
  QuickOpen
  CommandPalette
  Toasts
```

Allowed to change through config:

- widths
- gutters
- density
- border softness
- radii
- shadows
- token values
- motion
- optional module visibility
- icon styling

Not allowed to change through config:

- command plumbing
- editor data flow
- note storage behavior
- layout grammar
- accessibility semantics

## Configuration Model

Recommended config root:

```text
~/.config/noctodeus/
  config.toml
  layout.toml
  motion.toml
  keymap.toml
  theme.css
  presets/
    monolith/
      theme.css
      layout.toml
      motion.toml
    inkwell/
      theme.css
      layout.toml
      motion.toml
    operator/
      theme.css
      layout.toml
      motion.toml
  snippets/
    shell.css
    editor.css
    sidebar.css
```

### File responsibilities

`config.toml`

- active preset selection
- import toggles
- snippet enablement
- safe-mode flags
- future feature flags for rice runtime

`layout.toml`

- sidebar width
- shell gutters
- stage outer gutter
- content max width
- stage radius
- rail visibility
- density tuning

`motion.toml`

- durations
- easing profile
- hover softness
- transition intensity
- reduced-motion behavior

`keymap.toml`

- shortcut remaps
- optional command aliases

`theme.css`

- CSS variable overrides
- supported shell/editor/sidebar visual hooks
- typography slot overrides

`snippets/*.css`

- advanced optional overrides
- supported but explicitly secondary to the token system

## Commented Template Strategy

The app should create example config files with most or all override lines commented out.

Example behavior:

- commented files = stock Noctodeus
- uncommented values = override defaults
- re-commenting values = revert to built-in defaults

This keeps the default design authoritative while giving users familiar dotfile ergonomics.

## Internal Styling Recommendation

Internal app styles may use Sass if desired for maintainability.

User-facing ricing should remain plain CSS rather than Sass:

- no build step for users
- easier runtime loading
- simpler failure handling
- better hot reload story
- lower risk of breaking the app

Recommendation:

- internal app styling: Sass allowed
- user dotfile styling: plain CSS only

## Runtime Architecture

### Ownership

Rust should own:

- config discovery
- parsing
- validation
- merge order
- hot-reload watching
- last-known-good cache
- safe mode

Svelte should consume:

- a resolved runtime UI snapshot
- root `data-*` attributes
- CSS custom properties
- config reload events

Frontend should not directly crawl user dotfiles.

### Proposed data flow

Startup:

1. Rust loads built-in defaults.
2. Rust checks `~/.config/noctodeus/`.
3. Rust parses TOML files and records any errors.
4. Rust loads `theme.css` and optional snippet CSS.
5. Rust merges defaults plus overrides.
6. Rust sends resolved UI config to the frontend.
7. Frontend applies root attributes and CSS variables.

Hot reload:

1. Rust watches `~/.config/noctodeus/`.
2. On file change, Rust reparses only affected files.
3. If valid, Rust updates last-known-good state.
4. Frontend receives updated resolved config and reapplies.
5. If invalid, Rust retains previous valid state and emits an error payload.

## Safety model

- invalid TOML does not replace active config
- invalid CSS does not block boot
- safe mode bypasses all user overrides
- note editing must remain functional regardless of rice errors

## Recommended API surface

The app should expose a supported override surface through:

- root CSS variables
- root `data-*` attributes
- documented shell class names
- documented snippet targets

Anything outside that supported surface is internal and may change.

## Visual Token System

The first high-leverage token families should be:

### Shell

- `--shell-bg`
- `--shell-surface`
- `--shell-border`
- `--shell-vignette-opacity`
- `--sidebar-width`
- `--sidebar-density`
- `--header-height`
- `--utility-rail-width`

### Stage

- `--stage-max-width`
- `--stage-outer-gutter`
- `--stage-inner-padding`
- `--stage-radius`
- `--stage-bg`
- `--stage-border`
- `--stage-border-opacity`
- `--stage-shadow`
- `--stage-paper-tint`
- `--stage-toolbar-height`

### Rhythm

- `--density-scale`
- `--content-line-height`
- `--hover-softness`
- `--focus-ring-strength`
- `--motion-speed`
- `--motion-springiness`

The most important first-pass tokens are:

- `--stage-outer-gutter`
- `--stage-max-width`
- `--stage-radius`
- `--stage-shadow`

These will do the most to establish the premium floating-editor feel.

## Error Handling and Recovery

### Parse failure

- show visible but non-fatal rice error state
- keep using last-known-good config
- expose exact file and parse error

### Missing files

- silently use app defaults

### Broken CSS

- log error
- continue with defaults plus valid overrides
- optionally disable only the bad snippet

### Safe mode

Provide a recovery path that boots with:

- no user theme CSS
- no user snippets
- no user layout/motion/keymap overrides

Safe mode should not touch Core data or user notes.

## Testing Strategy

### Rust tests

- config discovery
- TOML parsing
- merge order
- last-known-good fallback
- safe mode boot
- watcher reload behavior
- missing file behavior

### Frontend tests

- resolved CSS variables apply correctly
- root `data-*` attributes switch visual states correctly
- shell does not crash on config refresh
- writing stage renders consistently under overrides

### Manual verification

- edit dotfiles while app is open
- comment/uncomment values live
- break TOML intentionally
- break CSS intentionally
- verify app remains usable and editable

## Phase Plan

## Phase 0: UI Contract

**Goal:** define what is stable and what is riceable.

Deliver:

- shell architecture contract
- supported override surface
- initial token families
- immutable behavioral boundaries

Exit criteria:

- implementation team knows exactly what users may and may not change

## Phase 1: Rice Runtime Foundation

**Goal:** add global dotfile discovery and safe runtime config.

Deliver:

- Rust config module
- schema types for `config.toml`, `layout.toml`, `motion.toml`, `keymap.toml`
- CSS loader for `theme.css`
- watcher for `~/.config/noctodeus/`
- last-known-good cache
- safe mode

Exit criteria:

- app hot-reloads config changes without crashing

## Phase 2: Editorial Shell Redesign

**Goal:** make the shipped UI visually match the validated direction.

Deliver:

- floating writing stage
- outer content gutter
- refined sidebar proportions
- calmer top bar
- optional subdued utility rail
- stage-specific material system

Exit criteria:

- note surface is visually insulated from the shell and does not touch edges

## Phase 3: Tokenization

**Goal:** make the new shell deeply configurable without selector hacks.

Deliver:

- shell tokens
- stage tokens
- rhythm tokens
- root `data-*` attributes
- documented supported hooks

Exit criteria:

- major visual changes are possible through tokens alone

## Phase 4: Presets

**Goal:** ship taste, not just raw controls.

Deliver:

- `monolith`
- `inkwell`
- `operator`
- preset activation through `config.toml`

Exit criteria:

- users can switch between multiple strong visual rigs instantly

## Phase 5: Advanced Snippets

**Goal:** support deeper ricing for power users.

Deliver:

- `snippets/shell.css`
- `snippets/editor.css`
- `snippets/sidebar.css`
- documented supported selectors and boundaries

Exit criteria:

- advanced users can customize deeper without changing app logic

## Phase 6: Hardening

**Goal:** prove runtime resilience.

Deliver:

- failure-path tests
- hot-reload tests
- fallback verification
- performance verification
- accessibility verification

Exit criteria:

- rice system is clearly production-safe

## Phase 7: Power UX

**Goal:** make dotfile customization discoverable and recoverable.

Deliver:

- open config folder action
- reload rice action
- parse error surface
- boot safe mode action
- example configs and docs

Exit criteria:

- power users can tune confidently and recover quickly

## Implementation Checklist

- [ ] Finalize supported override surface and shell contracts.
- [ ] Create Rust-side config module for global rice runtime.
- [ ] Define schema structs for `config.toml`, `layout.toml`, `motion.toml`, `keymap.toml`.
- [ ] Add loader for `theme.css` and optional snippet CSS.
- [ ] Implement merge order: app defaults -> overrides -> presets -> snippets.
- [ ] Implement last-known-good config storage in memory.
- [ ] Implement safe mode bypass.
- [ ] Add config watcher for `~/.config/noctodeus/`.
- [ ] Add frontend bridge for resolved rice config and reload events.
- [ ] Refactor shell layout to support outer content gutter and inset stage.
- [ ] Redesign the default content area around the floating worksurface concept.
- [ ] Refine sidebar density and shell contrast.
- [ ] Reduce top chrome visual dominance.
- [ ] Introduce shell/stage/rhythm token families in app styles.
- [ ] Create shipped commented template dotfiles.
- [ ] Add preset import support and ship curated presets.
- [ ] Add advanced snippet loading.
- [ ] Add UI recovery actions: open config folder, reload rice, safe mode.
- [ ] Write runtime safety tests.
- [ ] Write visual shell application tests.

## Acceptance Criteria

- Stock Noctodeus already feels premium and visually aligned with the validated reference direction.
- The writing area is inset and visually separate from the shell.
- User config lives only in `~/.config/noctodeus/` for the first version.
- Commented-out overrides cleanly revert to the stock UI.
- Broken user config never blocks startup or note editing.
- Ricing changes presentation and proportion, not core application structure.
