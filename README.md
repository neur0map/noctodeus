<p align="center">
  <img src="static/noctodeous-logo.png" alt="Noctodeus" width="80" />
</p>

<h1 align="center">Noctodeus</h1>

<p align="center">
  A local-first note-taking app for people who think in connections.
</p>

<p align="center">
  <a href="https://github.com/neur0map/noctodeus/releases/latest">Download</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#getting-started">Getting Started</a> &middot;
  <a href="#keyboard-shortcuts">Shortcuts</a> &middot;
  <a href="https://github.com/neur0map/noctodeus/issues">Feedback</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/neur0map/noctodeus?color=%23c0a0f0&style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/github/v/release/neur0map/noctodeus?color=%23c0a0f0&style=for-the-badge" alt="Release" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/github/stars/neur0map/noctodeus?style=for-the-badge" alt="Stars" />
</p>

<br />

<p align="center">
  <img src="static/noctodeus-1.png" alt="Noctodeus Editor" width="800" />
</p>

---

## Why Noctodeus

Your notes live on your machine as plain markdown files. No cloud accounts. No subscriptions. No vendor lock-in. You own everything you write.

Noctodeus treats your notes as a connected network, not a folder hierarchy. Link ideas together with wiki-links, watch patterns emerge in the graph view, and find anything instantly with full-text search. When you're ready, sync to a private GitHub repo — your data never touches a server you don't control.

Built with Rust, Svelte 5, and Tauri 2 for a native desktop experience that feels fast and stays fast.

---

## Features

**Editor** — Rich markdown editing with slash commands, tables, task lists, code blocks with syntax highlighting for 30+ languages, images, video, audio, and embeds. Everything saves as clean `.md` files.

**Wiki-links & Graph** — Type `[[` to link notes. See backlinks in the side panel. Open the graph view to visualize your entire knowledge network — larger nodes have more connections.

**Full-text Search** — SQLite FTS5 with Porter stemming. Search across titles and content. Results show highlighted snippets. Press one shortcut and start typing.

**Daily Notes** — Click any date in the sidebar calendar to create or open a journal entry. Templated with frontmatter, tasks section, and notes section.

**GitHub Sync** — Push and pull your notes to a private GitHub repo. One button. Automatic three-way merge. Conflicts fork into separate files — nothing is ever lost.

**15+ Themes** — Dark, light, and warm palettes. Each theme is crafted with consistent color tokens across every UI element. Switch instantly from settings.

**Customizable** — Rebind any keyboard shortcut. Override fonts. Inject custom CSS. Adjust editor width, font size, and more.

**Multiple Cores** — Keep personal notes, work projects, and research in separate vaults. Switch between them from the sidebar.

<p align="center">
  <img src="static/noctodeus-2.png" alt="Graph View" width="800" />
</p>

---

## Download

Get the latest release for your platform:

| Platform | Architecture | Download |
|----------|-------------|----------|
| macOS | Apple Silicon (M1+) | [`.dmg`](https://github.com/neur0map/noctodeus/releases/latest) |
| macOS | Intel | [`.dmg`](https://github.com/neur0map/noctodeus/releases/latest) |
| Windows | x64 | [`.exe`](https://github.com/neur0map/noctodeus/releases/latest) |
| Linux | x64 | [`.AppImage`](https://github.com/neur0map/noctodeus/releases/latest) / [`.deb`](https://github.com/neur0map/noctodeus/releases/latest) |

Or build from source — see [Development](#development) below.

---

## Getting Started

1. **Create a core** — Pick an empty folder (or an existing folder with markdown files). This becomes your vault.
2. **Start writing** — New cores include a welcome guide that walks through every feature.
3. **Link ideas** — Type `[[` to create wiki-links between notes. The graph grows as you write.
4. **Set up sync** — Go to Settings > Sync, paste a GitHub PAT and repo URL, and click Connect.

---

## Keyboard Shortcuts

All shortcuts are customizable in Settings > Hotkeys.

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| Quick Open | `Cmd+P` | `Ctrl+P` |
| Search | `Cmd+K` | `Ctrl+K` |
| Command Palette | `Cmd+Shift+P` | `Ctrl+Shift+P` |
| New Note | `Cmd+N` | `Ctrl+N` |
| Toggle Sidebar | `Cmd+B` | `Ctrl+B` |
| Toggle Panel | `Cmd+\` | `Ctrl+\` |
| Find in Note | `Cmd+F` | `Ctrl+F` |
| Delete File | `Cmd+Backspace` | `Ctrl+Backspace` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | [Tauri 2](https://tauri.app) + Rust |
| Frontend | [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) + TypeScript |
| Editor | [TipTap 3](https://tiptap.dev) + ProseMirror |
| Database | SQLite (rusqlite) with FTS5 full-text search |
| Styling | Tailwind CSS v4 + shadcn-svelte |
| Sync | Git CLI (GitHub) |

---

## Development

```bash
# Prerequisites: Node.js 18+, Rust toolchain, git
# On Linux: sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

npm install
npm run tauri dev

# Tests
cd src-tauri && cargo test
npm test

# Type check
npm run check

# Production build
npm run tauri build
```

---

## Contributing

Issues and pull requests are welcome. If you find a bug or have a feature request, [open an issue](https://github.com/neur0map/noctodeus/issues).

---

## License

[GNU Affero General Public License v3.0](LICENSE)
