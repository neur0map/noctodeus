# Changelog

All notable changes to Nodeus are documented here.
The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] — 2026-04-10

The BlockNote XL unification release. Migrates the entire editor-AI surface, the chat bubble, and the export surface to BlockNote's XL package suite under the GPL-3.0 license option (compatible with Nodeus's AGPL-3.0 per GPL-3.0 §13). Roughly 1,800 lines of custom AI UI code deleted in favor of battle-tested BlockNote components.

### Added

- **`@blocknote/xl-ai` native AI editing.** Inline diff review with accept/reject per change, tool-call-based block operations (add / update / delete), built-in selection toolbar button, `/ai` slash menu, and `Space`-bar activation on empty lines. The AI can surgically edit individual blocks instead of regenerating whole documents.
- **5 Nodeus-exclusive AI commands** layered on top of xl-ai's 8 defaults: Extract Wisdom, Create Tags, Create Outline, Create Flashcards, Explain Terms. Registered as `AIMenuSuggestionItem`s in the same menu. The 5 overlapping Fabric patterns (Summarize, Improve Writing, Fix Typos, Find Action Items, Translate) were removed — xl-ai's defaults cover them with better tool-call integration.
- **`@blocknote/xl-pdf-exporter`** — PDF export via `@react-pdf/renderer` with a custom `wikiLink` inline-content mapping so Nodeus's wiki links render as styled text.
- **`@blocknote/xl-docx-exporter`** — DOCX export via `docx` with the same wiki-link mapping.
- **`@blocknote/xl-odt-exporter`** — OpenDocument Text export.
- **Copy as Markdown** — uses BlockNote's built-in `blocksToMarkdownLossy()`.
- **Unified Share & Export premium modal** — replaces the previous ShareModal with a two-section layout: encrypted share link (views + expiry dropdowns, Cryptgeon-backed) on top, export actions (PDF / DOCX / ODT / Copy Markdown) below. Editorial-refinement aesthetic with hairline borders, small-caps labels, and the 360ms / 240ms spring animations established in v0.2.0.
- **`@blocknote/xl-multi-column`** — Notion-style multi-column layouts. Drag any block to the side of another to split it into columns.
- **Vercel AI SDK as the single AI pipeline.** All LLM calls (editor AI and chat bubble) now run JS-direct via `streamText`/`generateText` from the `ai` package, with `@ai-sdk/openai` for OpenAI proper and `@ai-sdk/openai-compatible` as a generic adapter for Ollama / Groq / OpenRouter / Anthropic's OpenAI-compat endpoint / any custom base URL.
- **Chat bubble runs through the AI SDK too.** Native tools (`list_recent_notes`, `search_notes`, `semantic_search`, `read_note`) and MCP tools are now first-class `tool()` definitions whose `execute` functions `invoke()` the existing Rust Tauri commands. The AI SDK's `stepCountIs(10)` handles the tool-call loop automatically, replacing ~200 lines of manual `<tool_call>` XML parsing and recursive `_sendRound` logic.
- **Chat assistant messages** now render with a read-only `BlockNoteView` — assistant output has the same typography, heading styles, code blocks, and wiki-link rendering as the main editor.

### Changed

- **Tauri CSP** `connect-src` relaxed from `ipc: http://ipc.localhost` to also allow `https:`, `http://localhost:*`, and `http://127.0.0.1:*` so the AI SDK can reach provider endpoints from the WebView. Provider-domain allowlisting deferred to v0.3.1.
- **`Space` bar** on an empty line now opens xl-ai's native AIMenu via `openAIMenuAtBlock` instead of the old custom overlay — same UX, BlockNote's rendering.
- **Research chat panel** (`src/lib/stores/research.svelte.ts`) also migrated to `streamText`. Same UI, new backend.
- **Share button** in `TabBarContent.svelte` now opens the unified Share & Export modal instead of dispatching a custom `nodeus-share-file` event.

### Removed

- `src/lib/editor/blocknote/PatternExecutor.tsx` — replaced by xl-ai's inline diff review
- `src/lib/editor/blocknote/ai-prompt-block.tsx` — replaced by xl-ai's AIMenuController
- `src/lib/editor/blocknote/ai-slash-items.tsx` — replaced by `getAISlashMenuItems` + `ai-commands.tsx`
- `src/lib/editor/blocknote/pattern-icons.tsx` — icons now come from `react-icons/ri`
- `src/lib/editor/blocknote/ai-prompt-system.ts` — xl-ai owns the system prompt
- `src/lib/ai/native-tools.ts` — logic moved into `ai.svelte.ts` as AI SDK tool definitions
- `src/lib/bridge/ai.ts` — replaced by `src/lib/ai/client.ts` (model factory) + `src/lib/bridge/ai-providers.ts` (preset/model listings only)
- `src-tauri/src/commands/ai.rs` `ai_chat` + `ai_chat_cancel` commands — no more Rust AI streaming
- `src-tauri/src/ai/stream.rs` — entire module deleted (~250 lines of Rust)
- `src/lib/components/common/ShareModal.svelte` — replaced by `ShareExportModal.svelte`
- Five overlapping Fabric patterns from `src/lib/ai/fabric-patterns.ts`
- All `.pattern-executor__*` / `.ai-prompt__*` CSS and their keyframes (~500 lines of CSS)
- Password field on the share link generator — the Cryptgeon bridge still supports it, but the premium modal exposes only Views + Expires. Can be restored in a follow-up if users ask.

### Breaking

- **The Rust `ai_chat` Tauri command is gone.** Any external automation that invoked it will break. The JS-direct `streamText` pipeline is the only supported path now.
- **Forks lose AGPL-3.0 escape hatch for non-copyleft projects.** Nodeus now pulls in GPL-3.0-licensed BlockNote XL packages, which means forks must either adopt AGPL-3.0/GPL-3.0 themselves or buy a BlockNote commercial license. See the README "BlockNote XL package licensing" note.
- **Chat history from v0.2.0 is incompatible** with the new AI SDK message shape. Chat history is session-only (not persisted), so this only affects users who had an open chat when upgrading — the session resets on first launch.

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
