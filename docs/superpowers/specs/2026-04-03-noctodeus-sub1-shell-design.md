# Noctodeus Sub-Project 1: App Shell + Core System + File Management + Premium UI

**Date:** 2026-04-03
**Scope:** Features 1 (Core system), 2 (File management), 5 (Local-first architecture), 6 (Premium UI foundation)
**Stack:** Tauri 2 + SvelteKit + TypeScript + Rust + SQLite
**Architecture:** Event-driven hybrid (Rust owns data state, frontend owns UI state)

---

## Decisions

- **Core storage:** `.noctodeus/` hidden folder per Core (like `.git/`, `.obsidian/`)
- **File tree:** shows all files honestly, no filtering or hiding
- **Layout:** adaptive two-to-three column (right panel appears on demand)
- **Navigation:** no tabs. Quick-open (centered modal, Cmd+P) is primary navigation
- **SQLite role:** derived cache only. Deletable and rebuildable from disk. Never source of truth for content.
- **Design direction:** Creative IDE (Linear/Warp feel). Tight spacing, keyboard-first, personality in micro-interactions. Premium motion, properly spaced, non-generic.
- **Logging:** separated log files per subsystem in `.noctodeus/logs/`, rotation, export support

---

## 1. Project Structure

```
noctodeus/
├── src-tauri/                    # Rust backend (Tauri)
│   ├── src/
│   │   ├── main.rs              # Tauri entry point
│   │   ├── commands/            # Tauri command handlers (frontend calls these)
│   │   │   ├── mod.rs
│   │   │   ├── core.rs          # Create/open/close Core
│   │   │   ├── files.rs         # CRUD file operations
│   │   │   └── search.rs        # Search queries
│   │   ├── events/              # Event types and emitters
│   │   │   ├── mod.rs
│   │   │   └── file_events.rs   # File system change events
│   │   ├── watcher/             # File system watcher (notify crate)
│   │   │   ├── mod.rs
│   │   │   └── debounce.rs      # Debounce rapid FS changes
│   │   ├── indexer/             # Async indexing pipeline
│   │   │   ├── mod.rs
│   │   │   ├── scanner.rs       # Full Core scan on open
│   │   │   ├── incremental.rs   # Process individual change events
│   │   │   └── fts.rs           # Full-text search index maintenance
│   │   ├── db/                  # SQLite layer
│   │   │   ├── mod.rs
│   │   │   ├── schema.rs        # Table definitions and migrations
│   │   │   ├── queries.rs       # Read queries
│   │   │   └── mutations.rs     # Write operations
│   │   └── core/                # Core management logic
│   │       ├── mod.rs
│   │       ├── manifest.rs      # Core config (.noctodeus/config.toml)
│   │       └── state.rs         # Active Core state
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                          # SvelteKit frontend
│   ├── lib/
│   │   ├── bridge/              # Typed Tauri command/event wrappers
│   │   │   ├── commands.ts      # invoke() wrappers with types
│   │   │   └── events.ts        # listen() wrappers with types
│   │   ├── stores/              # Svelte stores (UI state)
│   │   │   ├── core.ts          # Active Core state
│   │   │   ├── files.ts         # File tree state
│   │   │   ├── ui.ts            # Panel visibility, layout state
│   │   │   └── search.ts        # Search state
│   │   ├── components/          # UI components
│   │   │   ├── layout/          # Shell, sidebar, panels
│   │   │   ├── filetree/        # File tree components
│   │   │   ├── quickopen/       # Quick-open modal
│   │   │   ├── command/         # Command palette
│   │   │   └── common/          # Buttons, inputs, icons, transitions
│   │   ├── styles/              # Design system
│   │   │   ├── tokens.css       # CSS custom properties (colors, spacing, type)
│   │   │   ├── reset.css        # Base reset
│   │   │   ├── typography.css   # Type scale and font definitions
│   │   │   └── animations.css   # Shared transition/animation definitions
│   │   └── types/               # Shared TypeScript types
│   │       ├── core.ts          # Core, file, folder types
│   │       └── events.ts        # Event payload types (mirrors Rust)
│   ├── routes/
│   │   ├── +layout.svelte       # Root layout (app shell)
│   │   └── +page.svelte         # Main app view
│   └── app.html
├── static/                       # Static assets (fonts, icons)
├── docs/                         # Design docs and specs
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

Key points:
- `src/lib/bridge/` is the typed protocol boundary. Every Rust-frontend interaction goes through here.
- Svelte stores own UI state only. Data state comes from Rust via events.
- Design system lives in plain CSS custom properties. No utility framework.
- `src-tauri/src/events/` and `src/lib/types/events.ts` mirror each other to keep the protocol typed on both sides.

---

## 2. Rust Backend Architecture

### Core lifecycle

When the user opens a Core:
1. **Validate** — check the folder exists, create `.noctodeus/` if first open
2. **Initialize DB** — open/create `.noctodeus/meta.db`, run migrations
3. **Full scan** — walk the directory tree, index every file into SQLite (path, title from frontmatter or filename, size, modified timestamp, content hash)
4. **Build FTS** — populate full-text search index from Markdown content
5. **Start watcher** — `notify` crate watches the Core folder recursively
6. **Emit ready** — fire `core:ready` event to frontend with the file tree

When the user closes a Core:
1. Stop watcher
2. Flush any pending index writes
3. Close SQLite connection
4. Emit `core:closed`

### File watcher to indexer pipeline

```
filesystem change
    -> notify event
    -> debounce (100ms window, batches rapid saves)
    -> classify (create / modify / delete / rename)
    -> update SQLite index
    -> update FTS index
    -> emit typed event to frontend
        -> file:created { path, metadata }
        -> file:modified { path, metadata }
        -> file:deleted { path }
        -> file:renamed { old_path, new_path, metadata }
```

The debouncer collapses rapid events (text editors often write temp files and rename, triggering multiple events for a single save). 100ms window handles this.

### Tauri commands (frontend to Rust)

```
core:create    { path, name }           -> Result<CoreInfo>
core:open      { path }                 -> Result<CoreInfo>
core:close     {}                       -> Result<()>
core:list      {}                       -> Result<Vec<CoreInfo>>

file:create    { path, content? }       -> Result<FileInfo>
file:read      { path }                 -> Result<FileContent>
file:write     { path, content }        -> Result<FileInfo>
file:delete    { path }                 -> Result<()>
file:rename    { old_path, new_path }   -> Result<FileInfo>
file:move      { path, new_parent }     -> Result<FileInfo>
file:duplicate { path }                 -> Result<FileInfo>

dir:create     { path }                 -> Result<()>
dir:delete     { path, recursive }      -> Result<()>

search:query   { text, scope? }         -> Result<Vec<SearchHit>>
search:recent  { limit }                -> Result<Vec<FileInfo>>
search:pinned  {}                       -> Result<Vec<FileInfo>>

pin:add        { path }                 -> Result<()>
pin:remove     { path }                 -> Result<()>

state:save     { key, value }           -> Result<()>
state:load     { key }                  -> Result<Value>

log:export     {}                       -> Result<String>
log:clear      {}                       -> Result<()>
```

### SQLite schema

```sql
-- File index (rebuilt on scan, updated incrementally)
files (
    path        TEXT PRIMARY KEY,
    parent_dir  TEXT NOT NULL,
    name        TEXT NOT NULL,
    extension   TEXT,
    title       TEXT,          -- extracted from frontmatter or first heading
    size        INTEGER,
    modified_at INTEGER,       -- unix timestamp
    content_hash TEXT,
    is_directory BOOLEAN DEFAULT FALSE
)

-- Full-text search (SQLite FTS5)
files_fts (
    path        TEXT,
    title       TEXT,
    content     TEXT
)

-- Pinned files
pinned (
    path        TEXT PRIMARY KEY,
    pinned_at   INTEGER
)

-- Recent file access
recents (
    path        TEXT PRIMARY KEY,
    accessed_at INTEGER
)

-- Key-value state store (UI state, preferences)
state (
    key         TEXT PRIMARY KEY,
    value       TEXT  -- JSON
)
```

### Rust crate choices
- **notify** — file system watching
- **rusqlite** — SQLite with FTS5 support
- **serde** / **serde_json** — serialization for Tauri commands/events
- **walkdir** — fast recursive directory scanning
- **tokio** — async runtime (Tauri 2 uses this)
- **tracing** + **tracing-appender** — structured logging with file output
- **trash** — move files to OS trash instead of permanent delete

---

## 3. Frontend Architecture

### Bridge layer (`src/lib/bridge/`)

The bridge is the single point of contact between frontend and Rust. No Svelte component ever calls `invoke()` or `listen()` directly.

```typescript
// commands.ts
export async function openCore(path: string): Promise<CoreInfo> {
  return invoke('core:open', { path });
}
export async function createFile(path: string, content?: string): Promise<FileInfo> {
  return invoke('file:create', { path, content });
}
export async function searchQuery(text: string, scope?: string): Promise<SearchHit[]> {
  return invoke('search:query', { text, scope });
}

// events.ts
export function onFileCreated(cb: (e: FileCreatedEvent) => void): UnlistenFn {
  return listen('file:created', (event) => cb(event.payload));
}
export function onFileModified(cb: (e: FileModifiedEvent) => void): UnlistenFn {
  return listen('file:modified', (event) => cb(event.payload));
}
```

### Store architecture

```
bridge/events.ts  ->  stores  ->  components
bridge/commands.ts  <-  stores  <-  components (via actions)
```

- **`stores/core.ts`** — active Core info, loading state, error state. Resets all other stores when Core changes.
- **`stores/files.ts`** — file tree as a flat map (`Map<string, FileNode>`) plus a derived tree structure. Subscribes to file events from the bridge.
- **`stores/ui.ts`** — panel visibility (sidebar, right panel), quick-open/command palette visibility, active file path. Persisted to Rust `state:save` on change, restored on Core open.
- **`stores/search.ts`** — search query, results, loading state. Debounces input (150ms), calls `search:query` through bridge.

### Component hierarchy

```
+layout.svelte
  AppShell
    Sidebar (collapsible, left)
      CoreHeader (Core name, settings gear)
      FileTree
        FileTreeNode (recursive)
        FileTreeContextMenu
      SidebarFooter (pinned files, create new)
    ContentArea (center)
      ContentHeader (breadcrumb path, actions)
      FileViewer (renders file content)
      EmptyState (when no file selected)
    RightPanel (collapsible, animated, on-demand)
      (placeholder for future: outline, AI, sources)
    QuickOpen (modal overlay, Cmd+P)
      SearchInput
      ResultsList
    CommandPalette (modal overlay, Cmd+Shift+P)
    Toasts (bottom-right, non-blocking notifications)
```

### Keyboard map

| Shortcut | Action |
|---|---|
| `Cmd+P` | Quick-open |
| `Cmd+Shift+P` | Command palette |
| `Cmd+N` | New note |
| `Cmd+B` | Toggle sidebar |
| `Cmd+\` | Toggle right panel |
| `Cmd+Backspace` | Delete file (with confirmation) |
| `Escape` | Close any overlay |
| `Up/Down` | Navigate lists |
| `Enter` | Open selected |

Keyboard handling lives in a single `KeyboardManager` that checks context (overlay open? input focused?) before dispatching. Components never bind their own global key listeners.

### Sub-project 1 file viewer

Since the Markdown editor is sub-project 2, the content area in this phase renders:
- **Markdown files:** parsed to HTML via a lightweight parser (`marked` or `markdown-it`), displayed as read-only rendered content with the premium typography system
- **Images:** inline preview
- **Other files:** file info card (name, size, type, modified date)

---

## 4. Logging Architecture

### Rust-side logging

Uses **`tracing`** with two subscribers running simultaneously:
- **File subscriber** — structured logs to `.noctodeus/logs/`
- **Console subscriber** — stdout for dev mode

```
.noctodeus/logs/
  core.log        # Core lifecycle: open, close, scan, migrations
  watcher.log     # File system events: raw notify events, debounced results
  indexer.log     # Index operations: scan progress, FTS updates, errors
  commands.log    # Tauri command calls: what frontend requested, result/error
  db.log          # SQLite: migrations, query errors, slow queries (>50ms)
  frontend.log    # Frontend errors forwarded from browser
```

**Rotation:** each file caps at 5MB, keeps 3 rotations. Uses `tracing-appender` for non-blocking file writes.

**Log entry format:**
- ISO 8601 timestamp
- Level (ERROR, WARN, INFO, DEBUG, TRACE)
- Module path (e.g. `noctodeus::watcher::debounce`)
- Span context (which Core, which operation)
- Structured fields

### Frontend-side logging

A `logger.ts` utility that:
- Logs to browser console in dev mode
- Forwards ERROR and WARN to Rust via `log:write` command, appending to `frontend.log`
- Captures unhandled promise rejections and Svelte component errors

### Log levels by environment

| Environment | Rust level | Frontend forwarding |
|---|---|---|
| Dev (`cargo tauri dev`) | DEBUG | ERROR, WARN |
| Release | INFO | ERROR only |

Configurable via `.noctodeus/config.toml`:

```toml
[logging]
level = "info"
max_file_size = 5242880  # 5MB
max_rotations = 3
```

### Debug commands

- `log:export` — creates `.noctodeus/logs/debug-export-{timestamp}.zip` containing all log files
- `log:clear` — wipes all log files

---

## 5. Core System & File Management

### Core manifest (`.noctodeus/config.toml`)

```toml
[core]
name = "Research Notes"
id = "a1b2c3d4"              # UUID, generated on creation
created_at = "2026-04-03T00:00:00Z"
version = 1                   # manifest schema version

[logging]
level = "info"
max_file_size = 5242880
max_rotations = 3
```

### `.noctodeus/` full structure

```
.noctodeus/
  config.toml              # Core manifest
  meta.db                  # SQLite (file index, FTS, state)
  meta.db-wal              # SQLite WAL mode journal
  logs/
    core.log
    watcher.log
    indexer.log
    commands.log
    db.log
    frontend.log
  cache/                   # Ephemeral, safe to delete
    thumbnails/            # Generated image previews
```

The watcher explicitly ignores `.noctodeus/`. Changes inside it never trigger indexing or events.

### Core manager (app-level)

Lives in app data directory, not inside any Core:

```
~/Library/Application Support/com.noctodeus.app/
  app.toml                 # App-level preferences
  cores.json               # Registry of known Cores
  logs/
    app.log                # App-level logs (startup, crashes)
```

**`cores.json`:**
```json
[
  {
    "id": "a1b2c3d4",
    "name": "Research Notes",
    "path": "/Users/neur0map/Documents/Research Notes",
    "last_opened": "2026-04-03T14:30:00Z"
  }
]
```

On startup, validates paths still exist. Dead entries get a "missing" badge, not auto-removed (drive might be unmounted).

### File operations behavior

**Create note:**
1. Frontend dispatches `file:create` via bridge
2. Rust writes file to disk
3. Watcher detects creation -> indexer updates SQLite -> event emitted
4. Frontend store updates reactively

No optimistic updates. Frontend waits for Rust event. Latency is imperceptible (<50ms local disk).

**Delete file:**
1. Confirmation dialog with file name and shortcut hint
2. Rust moves file to OS trash (`trash` crate) — not permanent delete
3. Watcher detects deletion -> indexer removes from SQLite -> event emitted
4. Toast: "Moved to Trash"

**Rename / move:**
1. Rust performs rename/move on disk
2. Watcher detects -> indexer updates path -> `file:renamed` event
3. Frontend tree updates reactively

**Duplicate:**
1. Rust copies file, appends ` (copy)` before extension
2. If exists, appends ` (copy 2)`, etc.
3. Normal watcher flow picks it up

### File tree behavior

- **Sort:** directories first, then files. Alphabetical, case-insensitive.
- **Expand/collapse:** smooth height + opacity animation. State persisted via `state:save`.
- **Selection:** single-click opens file. Active file gets `--color-bg-active`. Tree scrolls to keep active file visible.
- **Context menu:** right-click shows New Note, New Folder, Rename, Duplicate, Move to, Delete. Styled as elevated card with `--shadow-elevated`.
- **Drag and drop:** files/folders can be dragged to reparent. Drop target highlights with `--color-accent` at low opacity. Rust handles `fs::rename` on drop.
- **Inline rename:** double-click enters edit mode. Enter confirms, Escape cancels. Input matches tree typography exactly.

### Home view (no file selected)

- Core name in `--text-2xl` mono
- Recent files (last 8, with relative timestamps, click to open, keyboard navigable)
- Pinned files above recents if any, with subtle pin indicator
- Quick actions: "New Note" with `Cmd+N` hint, "Open File" with `Cmd+P` hint
- Background is `--color-bg-base`, no cards or boxes

---

## 6. Design System

### Color system

Two layers. Components only use the semantic layer.

```
Raw palette (never referenced by components):
  --raw-gray-950 through --raw-gray-50
  --raw-accent-500

Semantic tokens:
  --color-bg-base          # app background
  --color-bg-surface       # panels, sidebar
  --color-bg-elevated      # modals, dropdowns, quick-open
  --color-bg-hover         # interactive hover state
  --color-bg-active        # pressed/selected state
  --color-border-subtle    # panel dividers, low emphasis
  --color-border-strong    # focused inputs, active elements
  --color-text-primary     # main content text
  --color-text-secondary   # labels, metadata, breadcrumbs
  --color-text-muted       # placeholders, disabled
  --color-accent           # single accent for key actions, links, focus rings
  --color-accent-hover     # accent interactive state
  --color-danger           # destructive actions only
```

Single accent color used sparingly. Everything else communicates through value contrast and typography weight.

### Spacing scale

```
  --space-1: 4px
  --space-2: 8px
  --space-3: 12px
  --space-4: 16px
  --space-5: 20px
  --space-6: 24px
  --space-8: 32px
  --space-10: 40px
  --space-12: 48px
```

Tight by default. `--space-2` and `--space-3` are workhorses for dense UI. `--space-6` through `--space-12` for section separation.

### Typography

```
  --font-mono: 'Berkeley Mono', 'JetBrains Mono', monospace
  --font-sans: 'Inter', -apple-system, sans-serif
  --font-content: 'Source Serif 4', 'Charter', Georgia, serif

  --text-xs:  12px / 1.4
  --text-sm:  13px / 1.5
  --text-base: 14px / 1.6
  --text-lg:  16px / 1.5
  --text-xl:  20px / 1.4
  --text-2xl: 24px / 1.3
  --text-3xl: 32px / 1.2
```

Three font stacks:
- **Mono** — UI chrome: sidebar, file tree, metadata, breadcrumbs, command palette (IDE feel)
- **Sans** — secondary content: labels, buttons, toasts, dialog text
- **Serif** — content area only: rendered Markdown, reading mode (editorial quality)

Base size 14px. File tree and metadata at 13px.

### Animation system

```
  --duration-fast: 120ms      # hover states, focus rings
  --duration-normal: 200ms    # panel toggles, modal appear
  --duration-slow: 350ms      # layout shifts, right panel slide

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1)
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)   # sparingly
```

| Pattern | Duration | Easing | Properties |
|---|---|---|---|
| Sidebar toggle | slow | ease-in-out | width, opacity |
| Right panel slide | slow | ease-out | transform (translateX), opacity |
| Quick-open appear | normal | ease-out | opacity, transform (scale 0.98->1) |
| Modal backdrop | normal | linear | opacity |
| Hover states | fast | ease-out | background-color |
| File tree expand/collapse | normal | ease-out | height, opacity |
| Toast enter | normal | ease-spring | transform (translateY), opacity |
| Toast exit | fast | ease-in-out | opacity |

Rules:
- `prefers-reduced-motion: reduce` disables all transitions via single media query
- No animation exceeds 350ms
- Spring easing only on toasts and micro-feedback
- Panel transitions use `will-change`, removed after transition ends

### Visual identity

- **Borders:** 1px `--color-border-subtle`. Most separation through background contrast, not borders.
- **Shadows:** only on elevated elements: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)`
- **Focus rings:** `2px solid var(--color-accent)` with `2px offset`, `:focus-visible` only
- **Scrollbars:** 6px thin, visible on hover only, matches `--color-bg-hover`
- **Empty states:** minimal icon at reduced opacity, short muted message, single action with keyboard hint

---

## 7. Error Handling & Recovery

### Error types (Rust)

```rust
enum NoctoError {
    // File system
    FileNotFound { path: String },
    PermissionDenied { path: String },
    DiskFull,
    PathConflict { path: String },

    // Core
    CoreNotFound { path: String },
    CoreAlreadyOpen,
    CoreCorrupted { detail: String },

    // Database
    DbMigrationFailed { detail: String },
    DbQueryFailed { detail: String },

    // Internal
    WatcherFailed { detail: String },
    IndexerFailed { detail: String },
    Unexpected { detail: String },
}
```

Every error serialized with `code` and `message`. Logged at ERROR before sending to frontend.

### Frontend error routing

- **User-facing errors** (file not found, permission denied, path conflict) -> toast with clear message, no jargon
- **Background errors** (watcher/indexer failed) -> persistent warning bar in sidebar with Retry action
- **Fatal errors** (DB corruption) -> full-screen error state with recovery options and Export Logs button

### Recovery flows

**SQLite corruption:**
1. Detect on open or query failure
2. Rename to `meta.db.corrupted.{timestamp}`
3. Create fresh `meta.db`, full rescan
4. Notify user: "Index was rebuilt. Your files were not affected."

**Watcher dies:**
1. Show sidebar warning
2. Auto-restart after 5 seconds, max 3 attempts
3. If all fail, degraded mode with manual Refresh button

**Core folder moved/deleted externally:**
1. Emit `core:lost` event
2. Show: "This Core's folder was moved or deleted. [Locate Folder] [Close Core]"
3. Locate Folder opens native file picker, updates `cores.json` on success

**File modified externally:**
1. Watcher detects, `file:modified` event fires
2. Content refreshes automatically (read-only viewer, no conflict)
3. Subtle toast: "File updated externally" (3s auto-dismiss)

### Toast system

- Bottom-right, stacked upward
- Types: info, success (accent), warning (amber), error (danger)
- Auto-dismiss: info/success 3s, warning 6s, errors persist until dismissed
- Max visible: 3, older compress to "+N more"
- Enter: ease-spring translateY. Exit: ease-in-out opacity fade.

---

## 8. Testing Strategy

### Rust testing

**Unit tests** (inline in each module):
- File operation logic (create, rename, move, duplicate naming)
- Debouncer behavior (batching, timing)
- Indexer (title parsing from frontmatter/headings, content hashing)
- SQLite queries and mutations (in-memory SQLite)
- Error serialization
- Core manifest parsing

**Integration tests** (`src-tauri/tests/`, using temp directories):
- Core lifecycle: create -> open -> scan -> close -> reopen
- Watcher pipeline: write file -> verify event arrives correctly
- Full-text search: index -> query -> verify ranking
- Corruption recovery: corrupt `meta.db` -> open -> verify rebuild
- Concurrent operations: rapid creates while indexer runs

No filesystem mocks. Always real temp directories.

### Frontend testing

**Component tests** (vitest + @testing-library/svelte):
- FileTree: structure, expand/collapse, selection, context menu
- QuickOpen: debounce, results, keyboard navigation
- CommandPalette: filtering, navigation, execution
- Toast system: stacking, auto-dismiss, max visible
- AppShell: sidebar toggle, right panel, layout states

**Store tests** (vitest, bridge mocked):
- `files`: reacts to each event type correctly
- `ui`: panel states, persistence calls
- `search`: debounce, loading states
- `core`: open/close lifecycle, reset behavior

**Bridge tests:**
- Each command wrapper calls `invoke()` with correct name and payload
- Each event wrapper passes correct event name to `listen()`

### Not tested in sub-project 1

- Visual regression (design still evolving)
- E2E Tauri tests (low ROI at this stage)
- Performance benchmarks (meaningful only with real data)

### Dev workflow

```
cargo tauri dev        # launches app with hot-reload
cargo test             # Rust unit + integration
npm run test           # Vitest frontend
npm run test:watch     # Vitest watch mode
npm run check          # svelte-check + tsc
npm run lint           # eslint + prettier
cargo clippy           # Rust linting
```
