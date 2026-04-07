<p align="center">
  <img src="static/noctodeous-logo.png" alt="Noctodeus" width="80" />
</p>

<h1 align="center">Noctodeus</h1>

<p align="center">
  <a href="https://github.com/neur0map/noctodeus/releases/latest">Download</a> &middot;
  <a href="#what-it-does">What It Does</a> &middot;
  <a href="#shortcuts">Shortcuts</a> &middot;
  <a href="https://github.com/neur0map/noctodeus/issues">Feedback</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/neur0map/noctodeus?color=%23c0a0f0&style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/github/v/release/neur0map/noctodeus?color=%23c0a0f0&style=for-the-badge" alt="Release" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=for-the-badge" alt="Platform" />
</p>

<br />

<p align="center">
  <img src="static/noctodeus-1.png" alt="Noctodeus" width="800" />
</p>

## Why This Exists

You already have Obsidian, Logseq, Notion. They work. They have teams, funding, and years of polish.

Noctodeus is one person building the note app they actually want to use.

The whole thing is one binary. No Electron. No hidden browser eating 400MB of RAM. Tauri 2 with a Rust backend, Svelte 5 frontend. Starts in under a second, sits around 80MB of memory, and your notes stay on your machine unless you push them to your own GitHub repo.

If you care about owning your tools and not just your data, give it 5 minutes.

---

## What It Does

**Markdown editor** with slash commands, tables, task lists, code blocks with syntax highlighting, drag-and-drop images. WYSIWYG that saves as plain `.md` files. No proprietary format.

**`[[Wiki-links]]`** between notes. Backlinks in the side panel. Graph view that grows as you write.

**Full-text search** across every note. SQLite FTS5 with stemming, so "writing" matches "write" and "written." Highlighted snippets in results.

**Daily notes.** Click a date in the sidebar calendar. A templated journal entry appears. No plugins, no setup.

**GitHub sync.** One button. Pulls remote changes, merges, pushes. Two devices edit the same file? Both versions kept. No merge conflicts in your notes.

**8 themes** across dark, light, and warm palettes. Each one tuned across the entire UI, not just syntax colors.

**Customizable shortcuts, fonts, editor width, and custom CSS injection.**

**macOS, Windows, Linux.** Same app. Shortcuts adapt automatically (Cmd on Mac, Ctrl elsewhere).

<p align="center">
  <img src="static/noctodeus-2.png" alt="Graph View" width="800" />
</p>

---

## Download

| Platform | Arch | |
|----------|------|-|
| macOS | Apple Silicon | [`.dmg`](https://github.com/neur0map/noctodeus/releases/latest) |
| macOS | Intel | [`.dmg`](https://github.com/neur0map/noctodeus/releases/latest) |
| Windows | x64 | [`.exe`](https://github.com/neur0map/noctodeus/releases/latest) |
| Linux | x64 | [`.AppImage`](https://github.com/neur0map/noctodeus/releases/latest) / [`.deb`](https://github.com/neur0map/noctodeus/releases/latest) |

---

## Shortcuts

All rebindable in Settings > Hotkeys.

| | macOS | Windows / Linux |
|-|-------|-----------------|
| Quick Open | `Cmd+P` | `Ctrl+P` |
| Search | `Cmd+K` | `Ctrl+K` |
| Command Palette | `Cmd+Shift+P` | `Ctrl+Shift+P` |
| New Note | `Cmd+N` | `Ctrl+N` |
| Toggle Sidebar | `Cmd+B` | `Ctrl+B` |
| Find in Note | `Cmd+F` | `Ctrl+F` |

---

## Built With

Rust, [Tauri 2](https://tauri.app), [Svelte 5](https://svelte.dev), [TipTap 3](https://tiptap.dev), SQLite + FTS5, Tailwind CSS v4.

---

## Build From Source

```bash
# needs: node 18+, rust toolchain, git
# linux: sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

npm install
npm run tauri dev
```

---

## Status

Early release. Used daily by its author. Rough edges exist. [Open an issue](https://github.com/neur0map/noctodeus/issues) if you find bugs or want something added.

---

## License

[AGPL-3.0](LICENSE)
