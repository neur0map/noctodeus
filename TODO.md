# TODO

## Current Stack (can build now with what we have)

- [x] **UI Overhaul — Midnight Tokyo** (deep retheme, Nerd Fonts, restyled shadcn, Bear/Raycast-inspired craft, two-column layout, 8 themes, editable keybinds, graph redesign)
- [ ] **Executable code blocks** (REWORK NEEDED — removed broken V1, needs new architecture: proper TipTap integration, no ProseMirror event hacking, fix auto-save sync race, persistent Python kernel, web preview)
- [ ] Split pane editing (side-by-side notes, note + graph, note + output)
- [ ] Version history / file recovery (automatic snapshots, restore previous versions)
- [ ] Quick capture (global hotkey to capture a thought without opening the full app)
- [ ] Queryable database views (filter, sort, group notes by metadata — table/kanban/calendar)
- [ ] Task management across vault (inline tasks with due dates, filtered/queried, kanban view)

## Next Up

- [ ] **Skills system** — SKILL.md prompt templates that auto-switch AI behavior. Drop a skill file in `skills/` with YAML frontmatter (name, description, keywords) + markdown prompt body. AI matches keywords and injects the skill into system prompt. Files: `ai/skills.rs` (parser, scanner, matcher), `commands/skills.rs` (skills_list, skills_match), `SkillBadge.svelte` in chat.
- [ ] **S3 + WebDAV sync backends** — Alternative sync backends implementing the existing `SyncBackend` trait. S3: AWS Signature V4 signing via sha2+hmac, put/get/list/delete objects. WebDAV: PROPFIND/PUT/GET/DELETE/MKCOL via reqwest with basic auth. Settings UI: backend picker (GitHub/S3/WebDAV) with per-backend config fields.

## Needs 3rd Party Libraries or Plugins

- [ ] Canvas / infinite whiteboard (tldraw or excalidraw integration)
- [ ] Spaced repetition / flashcards (SM-2 algorithm, review scheduler)
- [ ] Web clipper (browser extension to capture pages/highlights into vault)
- [ ] Excalidraw / visual sketching (embedded hand-drawn diagrams)
- [x] ~~AI integration — context-aware (semantic search, summarize, Q&A across vault)~~ — DONE: AI chat sidebar, RAG with memvid, MCP tools, Research Chat
- [x] ~~Sync across devices (E2E encrypted, conflict resolution)~~ — DONE: GitHub sync with three-way merge + fork-on-conflict
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
- [x] Light theme (Dark / Light / System toggle in settings)
- [x] Note details panel (word count, chars, reading time, modified date in right panel)
- [x] Edit/View mode toggle (rendered markdown preview with eye icon)
- [x] Syntax highlighting for code blocks (atom-one-dark theme)
- [x] Task extraction modal (scan all files, grouped by file, filter All/Todo/Done)
- [x] Daily notes with calendar widget (month grid, today highlight, note dots, auto-create)
- [x] Keyboard navigation (Ctrl+Tab zone cycling, arrow keys in file tree, Escape to editor)
- [x] Properties panel (collapsible YAML frontmatter editor with typed fields)
- [x] Aliases (frontmatter aliases resolve wiki-links, shown in suggest dropdown)
- [x] Unlinked mentions detection (scan for title/alias text, one-click convert to wiki link)
- [x] Import files and folders into core
- [x] Custom appearance (accent color picker, font overrides, editor width, custom CSS injection)
- [x] SQLite hardening (r2d2 connection pool, schema migrations, WAL+busy_timeout)
- [x] Links table + backend graph (wiki-link indexing in SQL, graph_links/stats/backlinks commands)
- [x] File watcher → incremental indexer (watcher spawns on core open, emits Tauri events)
- [x] Graceful shutdown (window close handler stops watcher, releases core)
- [x] Security hardening (CSP, scoped FS/asset permissions)
- [x] Deduplicated is_markdown() into shared util
- [x] SettingsModal split into 5 tab sub-components
- [x] Export logic extracted to utils/export.ts
- [x] GitHub sync (PAT auth via GIT_ASKPASS, push/pull, three-way merge, fork-on-conflict, auto-tag releases)
- [x] Encrypted note sharing via cryptgeon (AES-256-GCM, occulto-compatible format, ShareModal)
- [x] Smart core_open (auto-detects Obsidian vaults, markdown folders, empty folders)
- [x] Dotfile filtering (.obsidian, .logseq, .git, .DS_Store excluded from scanner, watcher, file tree)
- [x] Welcome content (9 markdown files covering all features, auto-populated on new core)
- [x] CI/CD (GitHub Actions: CI on push, release on tag with macOS ARM/x64 + Windows + Linux builds)
- [x] AI chat sidebar (SSE streaming, provider presets, settings tab, 3 toggle methods)
- [x] MCP client (process manager, JSON-RPC, tool calling loop, one-click presets, env vars)
- [x] MCP server (noctodeus-mcp binary: 9 tools for external AI agents to read/search/write notes)
- [x] RAG with memvid (Tantivy BM25 + bge-small-en-v1.5 embeddings, hybrid search, auto-index)
- [x] Semantic search in Cmd+K (RAG results merged with FTS5)
- [x] AI native RAG (auto-searches notes before every message, injects relevant context)
- [x] Research Chat (full-screen two-column layout, add source notes, separate conversation)
- [x] Noctodeus as MCP server setup instructions in settings (copy-to-clipboard config)
