# Noctodeus

A creative IDE for thought. Local-first, privacy-focused note-taking and knowledge management built as a native desktop application.

## Stack

### Core

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop Shell | [Tauri 2](https://tauri.app) | Native desktop wrapper with Rust backend |
| Frontend Framework | [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) | Reactive UI with runes-based state |
| Build Tool | [Vite 6](https://vitejs.dev) | Dev server, HMR, bundling |
| Language | [TypeScript 5.6](https://typescriptlang.org) | Type-safe frontend code |
| Backend Language | [Rust](https://rust-lang.org) (2021 edition) | Performance-critical backend logic |

### Editor

| Library | Purpose |
|---------|---------|
| [TipTap 3](https://tiptap.dev) | Headless rich text editor framework |
| [ProseMirror](https://prosemirror.net) | Document model and editing primitives |
| [lowlight](https://github.com/wooorm/lowlight) | Syntax highlighting for code blocks |
| [markdown-it](https://github.com/markdown-it/markdown-it) | Markdown parsing and HTML rendering |

TipTap Extensions: Starter Kit, Code Block Lowlight, Image, Link, Placeholder, Task List, Task Item, Suggestion

### Data

| Technology | Purpose |
|-----------|---------|
| [SQLite](https://sqlite.org) via [rusqlite](https://github.com/rusqlite/rusqlite) | Local database with FTS5 full-text search, WAL mode |
| File System | Markdown files stored as plain `.md` on disk |
| `localStorage` | Frontend preferences and settings persistence |

### Backend (Rust Crates)

| Crate | Purpose |
|-------|---------|
| `tauri` | App framework, IPC, window management |
| `rusqlite` | SQLite with bundled engine, FTS5 virtual tables |
| `tokio` | Async runtime |
| `notify` | File system watcher for live indexing |
| `walkdir` | Recursive directory scanning |
| `tracing` + `tracing-subscriber` + `tracing-appender` | Structured logging with file rotation |
| `serde` + `serde_json` | Serialization between Rust and frontend |
| `sha2` + `hex` | Content hashing for change detection |
| `trash` | Cross-platform move-to-trash |
| `chrono` | Date/time handling |
| `uuid` | Unique identifier generation |
| `toml` | Configuration file parsing |
| `dirs` | Platform-specific directory resolution |
| `thiserror` | Error type derivation |

### Tauri Plugins

| Plugin | Purpose |
|--------|---------|
| `tauri-plugin-dialog` | Native open/save file dialogs |
| `tauri-plugin-fs` | File system read/write from frontend |
| `tauri-plugin-opener` | Open files and URLs with system default apps |

### Dev & Testing

| Tool | Purpose |
|------|---------|
| [Vitest](https://vitest.dev) | Unit testing |
| [Testing Library](https://testing-library.com/svelte) | Component testing |
| [jsdom](https://github.com/jsdom/jsdom) | DOM environment for tests |
| [ESLint 9](https://eslint.org) | Linting |
| [Prettier](https://prettier.io) | Code formatting (with Svelte plugin) |
| `svelte-check` | Type checking |

## Architecture

```
noctodeus/
├── src/                          # Frontend (SvelteKit SPA)
│   ├── lib/
│   │   ├── bridge/               # Tauri command wrappers
│   │   ├── components/           # UI components
│   │   ├── editor/               # TipTap editor, extensions, serializer
│   │   ├── stores/               # Svelte 5 rune-based state
│   │   ├── styles/               # Design tokens, typography, animations
│   │   ├── types/                # TypeScript interfaces
│   │   └── utils/                # Shortcuts, helpers
│   └── routes/                   # SvelteKit pages
├── src-tauri/                    # Backend (Rust)
│   └── src/
│       ├── commands/             # Tauri IPC command handlers
│       ├── core/                 # Core (vault) state management
│       ├── db/                   # SQLite schema, queries, migrations
│       ├── indexer/              # FTS indexing, file scanning
│       └── watcher/              # File system change detection
└── static/                       # Static assets (logo, favicon)
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (frontend + Tauri)
cargo tauri dev

# Type check
npm run check

# Run tests
npm test

# Build for production
cargo tauri build
```

## Platform Support

Runs on macOS, Windows, and Linux. Keyboard shortcuts adapt automatically (Cmd on macOS, Ctrl on Windows/Linux). File paths are normalized to forward slashes internally for cross-platform consistency.

## Status

Early development. Not ready for use.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
