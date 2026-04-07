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

---

## The Honest Pitch

You probably already use Obsidian, Logseq, or Notion. They work. They have teams, funding, and years of polish behind them.

Noctodeus doesn't have any of that. It's one person building the note app they actually want to use.

Here's what's different: **the entire thing is one binary.** No Electron. No hidden browser eating 400MB of RAM. Tauri 2 + Rust backend, Svelte 5 frontend. It starts in under a second, uses ~80MB of memory, and your notes never leave your machine unless you explicitly sync them to your own GitHub repo.

If you care about owning your tools — not just your data, but the actual software — this might be worth 5 minutes of your time.

---

## What It Does

**Write in markdown** with a proper editor. Slash commands, tables, task lists, code blocks with syntax highlighting, drag-and-drop images. No mode switching — it's WYSIWYG that saves as clean `.md` files.

**Link notes with `[[wiki-links]]`.** Backlinks show up in the side panel. The graph view renders your connections — it's not something you build, it just emerges as you write.

**Search everything.** Full-text search powered by SQLite FTS5 with stemming. "Writing" finds "write" and "written." Results show highlighted snippets.

**Journal with daily notes.** Click a date in the sidebar calendar. A templated note appears. That's it — no setup, no plugins.

**Sync to GitHub.** One button. Pull, merge, push. If two devices edit the same file, both versions are kept. No merge conflicts in your notes, ever.

**15+ themes.** Dark, light, warm. Every theme is hand-tuned across the entire UI — not just syntax colors on top of a white background.

**Runs on macOS, Windows, and Linux.** Same app, native on each platform. Shortcuts adapt automatically (Cmd on Mac, Ctrl elsewhere).

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

Rebindable in Settings > Hotkeys.

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

Early release. Used daily by its author. Rough edges exist. If you find bugs or want something added, [open an issue](https://github.com/neur0map/noctodeus/issues).

---

## License

[AGPL-3.0](LICENSE)
