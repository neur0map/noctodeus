# TODO

## Current Stack (can build now with what we have)

- [ ] Light theme (Dark / Light / System toggle in settings)
- [ ] Note details panel (word count, timestamps, clickable TOC in right panel)
- [ ] Edit/View mode toggle (rendered markdown preview)
- [ ] Task extraction (consolidated task view across all notes)
- [ ] Keyboard navigation (arrow keys in file tree, Tab between zones, vim bindings)
- [ ] Daily / periodic notes with calendar view
- [ ] Properties panel (GUI for YAML frontmatter — typed fields: date, checkbox, number, list)
- [ ] Aliases (multiple names per note, link resolution)
- [ ] Unlinked mentions detection (find text matching a note title that isn't linked yet)
- [ ] Custom CSS themes (user-created themes, font/color customization beyond settings)
- [ ] Version history / file recovery (automatic snapshots, restore previous versions)
- [ ] Quick capture (global hotkey to capture a thought without opening the full app)
- [ ] Queryable database views (filter, sort, group notes by metadata — table/kanban/calendar)
- [ ] Task management across vault (inline tasks with due dates, filtered/queried, kanban view)

## Needs 3rd Party Libraries or Plugins

- [ ] Canvas / infinite whiteboard (tldraw or excalidraw integration)
- [ ] Spaced repetition / flashcards (SM-2 algorithm, review scheduler)
- [ ] Web clipper (browser extension to capture pages/highlights into vault)
- [ ] Excalidraw / visual sketching (embedded hand-drawn diagrams)
- [ ] AI integration — context-aware (semantic search, summarize, Q&A across vault)
- [ ] Sync across devices (E2E encrypted, conflict resolution)
- [ ] Spellcheck (research proper implementation for Tauri/WKWebView)

## Needs Custom Architecture / Major Engineering

- [ ] Block-level references & embeds (stable block IDs, transclusion, live propagation)
- [ ] Plugin / extension API (sandboxed API for community extensions)
- [ ] Publish / digital garden (select notes → public website)
- [ ] Real-time collaboration (CRDT-based multiplayer editing)
- [ ] Formulas / computed properties (expression evaluator for metadata fields)

## Completed

- [x] Inline title editing above editor
- [x] Find/Replace in editor (Cmd+F / Ctrl+F)
- [x] UI rework — Phase 0-7 (Tailwind v4, shadcn-svelte, minimal dark, Lucide icons)
- [x] anime.js v4 animations (staggered entries, view transitions, panel/modal animations)
- [x] Unified pinned files store
- [x] Star icon pin/unpin in file tree
- [x] Full-text content search (FTS5)
- [x] Export (Markdown, HTML, CSV with media toggle)
- [x] Settings modal with functional toggles
- [x] Cross-platform keyboard shortcuts (Cmd/Ctrl)
- [x] Cross-platform path normalization
- [x] AGPLv3 license
- [x] TipTap extensions (tables, highlight, sub/sup, underline, text align, typography, color, character count, focus)
- [x] Math rendering (KaTeX via @vscode/markdown-it-katex)
- [x] Core switcher dropdown (multiple vaults, switch/open/create)
- [x] Lucide icon library (replaced all Unicode and inline SVG icons)
- [x] Bubble toolbar (bold, italic, underline, strike, highlight, code, link + block type picker)
- [x] Search content inside files (FTS5 with snippet highlights)
