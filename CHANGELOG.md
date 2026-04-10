# Changelog

All notable changes to Noctodeus are documented here.
The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] — 2026-04-10

The "actually usable with AI" release. Full editor migration, inline AI, native vault tools, and a polished UX pass across every modal and overlay.

### Added

- **Editor migration: TipTap → BlockNote.** Full rewrite of the editor layer to a React-in-Svelte bridge using BlockNote. Drag handles, the `+` add menu, and the formatting toolbar all work the way they should now.
- **Inline AI.** Press `Space` on an empty line to open a streaming prompt bar. Write, edit, or transform content in place with `[REPLACE]` support for targeted rewrites.
- **Block-level AI context.** Instead of sending the whole note, the inline AI now sends 10 blocks above + 5 blocks below the cursor as context. Stops the AI from duplicating existing content.
- **Native AI tools.** Four built-in tools (`list_recent_notes`, `search_notes`, `semantic_search`, `read_note`) that talk directly to SQLite + RAG without going through MCP. Much faster than filesystem-based MCP for basic vault queries.
- **Fabric AI patterns as slash commands.** 10 curated patterns — Summarize, Improve Writing, Fix Typos, Extract Wisdom, Create Tags, Create Outline, Create Flashcards, Explain Terms, Find Action Items, Translate. Each one runs through a streaming overlay with Keep / Discard actions. Adapted from [Fabric](https://github.com/danielmiessler/fabric).
- **Floating AI chat bubble.** Bottom-right assistant that can read and search the vault via the native tools. Replaces the old right-docked chat panel. `Cmd+J` to toggle.
- **Eye icon identity** for the AI across the editor, chat bubble, and pattern executor.
- **Max-tokens setting** in Settings > AI — pair of range slider + numeric input. `0` = provider default. Lets users with reasoning models (DeepSeek R1, QwQ, o1) give the AI enough budget to produce actual output.
- **Per-provider credential storage.** Switching between OpenAI / Anthropic / Ollama / etc. no longer wipes your previous API key. Each provider remembers its own baseUrl, key, and model independently.
- **Wiki-link inline content** — custom BlockNote inline spec with `[[target]]` click-to-navigate.
- **RAG auto-indexing** — notes are automatically embedded into a vector store on save (debounced 5 seconds).

### Changed

- **Modal animations: bidirectional.** Every custom modal (CommandPalette, QuickOpen, SettingsModal, PanelModal, chat bubble, inline AI prompt, Fabric pattern executor) now has both entry *and* exit animations. No more instant-unmount pop.
- **Animation pacing** — 280-360ms on entry, 220-240ms on exit, with spring curves. Slow enough to appreciate, fast enough to never feel sluggish.
- **Micro-interactions** on press feedback across tab close buttons, chat header actions, suggestion rows, and all toolbar buttons.
- **Chat AI system prompt** — added a "How to behave" section that kills the over-confirmation pattern. The assistant now acts on clear intent instead of asking `1/2/3` option questions.
- **Fix Typos, Improve Writing, Translate** changed from `replace-selection` mode to `replace-block` mode — they now work on the current paragraph by default, since slash menus can't coexist with text selection.
- **Pattern preview rendering** — the Fabric executor's streaming feed now renders markdown as HTML in real time (bullets as bullets, headers as headers), not raw `-` dashes.
- **Slash menu AI group** follows BlockNote's native convention: single `AI` group, 18px blue-tinted icons, consistent with `Basic blocks` / `Headings` / `Media`.
- **CI stability** — `passWithNoTests: true` in Vitest; Windows release matrix disabled while the MSVC linker issue is outstanding.

### Fixed

- **API key lost on provider switch.** Previously all providers shared one `aiApiKey` slot; switching away and back wiped it. Now each provider has its own stored credentials.
- **AI returning empty responses on long notes.** Increased max-tokens default to 4000 and added detection for reasoning models that spend the whole budget thinking. Shows a clear, actionable error instead of "empty response."
- **"No content to process" on empty blocks.** The pattern executor now walks upward through the document to find the nearest non-empty block when invoked from a blank line.
- **Reasoning tag noise.** `<think>` / `<thinking>` / `<reasoning>` blocks from models like DeepSeek R1 are now stripped from both the live preview and the applied output.
- **Stuck chat bubble tooltip** on click / blur / close.
- **Empty tool-only assistant messages** no longer create blank bubbles in the chat panel — consecutive tool calls collapse into a single "Used N tools" card.
- **File references in chat** are now clickable (`.md` paths open the note).
- **Plan files clutter** — 23 already-implemented design plans removed from `docs/superpowers/plans`.

### Removed

- TipTap and all its extensions (`@tiptap/core`, `@tiptap/react`, etc.) — editor is now pure BlockNote.
- Legacy inline AI TipTap extension — replaced by the BlockNote overlay.
- Old right-docked sidebar chat — replaced by the floating bubble.

---

## [0.1.0] — Initial release

First public build. Core note-taking, file tree, wiki links, full-text search, themes, daily notes, GitHub sync, encrypted sharing via Cryptgeon.
