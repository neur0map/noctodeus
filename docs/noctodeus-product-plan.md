# Noctodeus

## Brand Direction

**Noctodeus** is a premium, local-first desktop knowledge system for serious thinking, study, and research. Its identity should feel dark, calm, intelligent, and trustworthy — closer to a high-end instrument than a trendy AI app.

### Product feel
- High-end, editorial, and deliberate.
- Dark-first UI with strong contrast, restrained accents, and minimal visual noise.
- Motion should feel precise and expensive, not flashy.
- AI should feel grounded, useful, and quiet — never loud, gimmicky, or "magic for magic's sake."
- The product should communicate permanence, control, and clarity.

### Naming system
- **Product:** Noctodeus
- **Storage root:** Core
- **Organization layer:** Workspace

Example product language:
- Create a new Core
- Open Workspace
- Sync Core
- Ask Noctodeus
- Add sources to this Core

---

## App Idea

Noctodeus is a local-first desktop app that merges the strongest ideas from Markdown note systems, structured workspaces, and source-grounded AI research tools into one premium knowledge environment.

It is designed for users who want:
- Real local ownership of their notes and research files.
- A serious Markdown-based workflow.
- AI that understands structure, sources, and context.
- Beautiful UI that feels premium, calm, and trustworthy.
- Git-backed sync and optional cloud connectivity without cloud lock-in.

The app should feel like a hybrid of:
- Obsidian-style local files and knowledge structure.
- Notion-like organization and fluid productivity.
- NotebookLM-style source-grounded research and citation-aware answers.
- A premium desktop product with stronger visual confidence than typical PKM tools.

---

## Goal and Purpose

### Primary goal
Build a premium local-first knowledge app that helps students, researchers, and technical users think better, organize better, and study better without giving up ownership of their data.

### Core purpose
- Make Markdown notes feel powerful, visual, and alive.
- Make AI genuinely useful by grounding it in the user's own files and note structure.
- Keep local storage as the canonical source of truth.
- Provide a trustworthy workspace for thinking, not just another generic note app.

### Product thesis
Most note apps are either:
- Good at local files but weak at AI and source reasoning, or
- Good at AI experiences but weak at ownership, structure, and long-term reliability.

Noctodeus exists to unify:
- Local-first data ownership,
- premium desktop UX,
- Markdown-native structure,
- source-grounded AI,
- and sync that respects the filesystem.

---

## Desktop App Stack

### Recommended stack
1. **Desktop shell:** Tauri 2
2. **Frontend:** SvelteKit + TypeScript
3. **Core backend/services:** Rust
4. **Local database:** SQLite
5. **Search/indexing:** Rust-based local indexing and full-text search
6. **Editor layer:** Markdown editor with structured parsing, custom blocks, and preview pipeline
7. **AI orchestration:** Local adapters for Ollama-compatible models plus cloud providers
8. **Sync layer:** Git-based sync engine first, cloud-folder sync later
9. **Packaging/update system:** Tauri updater plugin
10. **OAuth/provider connectivity:** Tauri-compatible auth/plugin flow

### Why this stack
- Tauri is the best fit for a lightweight, local-first desktop app with strong filesystem access and long-term feature runway.
- SvelteKit is the best fit for premium-feeling UI, subtle motion, and custom design systems without falling into generic component-library aesthetics.
- Rust is the right place for filesystem operations, indexing, sync, Git integration, and local AI/runtime orchestration.
- SQLite should be the local metadata and cache layer, while the filesystem remains central for actual user-owned content.
- The local Core must remain the canonical source of truth.

---

## Priority Order

This section is ordered by implementation priority.

---

## Initial Must-Have Features

### 1. Core system
- Create, open, and manage multiple Cores.
- Each Core is a real local folder on disk.
- Markdown files remain user-visible and portable.
- Workspace state can be layered on top without obscuring the underlying files.

### 2. File and note management
- File tree with folders, notes, attachments, and drag-and-drop organization.
- Fast note creation, rename, move, duplicate, delete, and restore.
- Tabs or split panes for working across multiple notes.
- Recent files and pinned files.

### 3. Markdown-first editing
- Clean editor with live preview or split preview.
- Headings, lists, code blocks, callouts, links, embeds, checklists.
- Internal linking and backlink support.
- Strong keyboard workflow and command palette.
- Beautiful typography and reading mode.

### 4. Search and navigation
- Fast global search across current Core.
- Search by title, content, tags, and linked references.
- Quick open panel.
- Recent activity and note history.

### 5. Local-first architecture
- Full offline usability.
- Instant local writes.
- Local metadata persisted to disk.
- No required account to use the app.
- Core is always usable without internet.

### 6. Premium UI foundation
- Dark-first theme with polished spacing, typography, and motion.
- Custom design system; no obvious template look.
- High-quality transitions for panes, dialogs, search, and navigation.
- Dense but calm information hierarchy.

### 7. Source bank v1
- Upload PDFs and other key research files into a Core.
- Associate uploaded sources with a Workspace or topic.
- View source list and basic metadata.
- Prepare source ingestion pipeline for AI usage.

### 8. AI assistant v1
- Chat over selected notes and uploaded sources.
- Answers grounded in Core content and selected sources.
- Basic citation references in responses, similar in spirit to NotebookLM.
- Summarize selected note or selected sources.
- Generate quiz questions and study guides from selected material.

### 9. Git sync v1
- Connect a Core to a Git repository.
- One-click commit/push/pull flow.
- View sync status clearly.
- Conflict warnings before destructive actions.

---

## Initial Nice-to-Have Features

### 10. Visual quality upgrades
- Rich empty states.
- Animated panel transitions.
- Beautiful dashboard/home view for each Core.
- Reading progress indicators.
- Elegant hover, focus, and active states throughout.

### 11. Structure-aware note tools
- Outline view for active note.
- Heading-based navigation.
- Auto-generated note summaries.
- Tag browser.
- Linked mentions and relationship surfacing.

### 12. Workspace layer
- Multiple Workspaces inside a Core.
- Workspace-specific filters, views, pinned notes, and source sets.
- Workspace home page with quick actions and recent context.

### 13. Source workflows
- Convert selected notes into source context.
- Source grouping by class, project, or topic.
- Source-scoped chat.
- Source highlighting and per-document Q&A behavior.

### 14. AI convenience features
- Rewrite selected section.
- Turn notes into flashcards.
- Generate concise recap sheet.
- Suggest note title, tags, or folder destination.
- Ask AI to compare two notes or two source sets.

### 15. History and recovery
- Version snapshots for notes.
- File diff view.
- Restore deleted notes from trash/history.
- Git-aware activity log.

---

## Must-Have Overall, But Not For Initial MVP

### 16. Source-grounded research engine
- Full NotebookLM-style source bank experience.
- Granular source selection and deselection before asking questions.
- Strong citation mapping back to exact passages or sections.
- Cross-source synthesis and contradiction detection.
- "Convert notes into source" workflow.

### 17. Structural AI
- AI that understands Markdown hierarchy, note links, headings, and blocks.
- Suggest restructuring of notes and folders.
- Propose merges, splits, and topic clustering.
- AI-assisted organization that previews changes before applying.

### 18. Local model memory
- Built-in support for local models.
- Persistent per-Core memory layer for assistant context.
- Configurable memory scopes: note-level, Workspace-level, Core-level.
- Clear visibility into what memory is stored and why.

### 19. Multi-provider AI connectivity
- Local models via Ollama-compatible runtime.
- Cloud providers via API and OAuth.
- Per-Core or per-Workspace model selection.
- Clear cost and model visibility.
- Safe fallback between local and cloud models.

### 20. Advanced sync architecture
- Better Git conflict handling.
- Background sync queue.
- Optional cloud-drive sync support.
- Sync health diagnostics.
- Remote backup and restore flows.

### 21. Graph and visual thinking tools
- Knowledge graph view.
- Mind map or structured map view.
- Relationship explorer between notes and sources.
- Topic clusters and study maps.

### 22. Academic workflow tools
- Citation export.
- Paper/project workspace templates.
- Course view with syllabi, readings, tasks, and exams.
- Assignment planning and study schedule generation.
- Research notebook modes for thesis/project work.

### 23. Multi-window and power workflows
- Detached panels.
- Multi-window note comparison.
- Workspace-specific shortcuts.
- Advanced keyboard customization.
- Automation hooks and future plugin system.

### 24. Premium polish layer
- Carefully designed onboarding.
- High-end settings UX.
- Excellent command palette.
- Native-feeling dialogs and context menus.
- Refined soundless microinteractions.
- Export flows that feel editorial and professional.

---

## MVP Definition

### MVP should prove these things
1. Users trust the app as a serious local-first product.
2. Markdown files remain central and portable.
3. The UI already feels premium.
4. AI is grounded in user-owned notes and sources, not generic chat.
5. Git-backed sync works well enough for real use.
6. The app solves actual study and research workflows from day one.

### MVP should not try to prove everything
The MVP does not need:
- Mind maps,
- advanced graphing,
- complex plugin systems,
- full multi-provider orchestration,
- or highly autonomous AI editing.

It only needs to prove:
- beautiful local note-taking,
- reliable source-grounded assistance,
- strong desktop UX,
- and trustworthy file ownership.

---

## Product Standards

### Design standards
- No generic AI gradients.
- No obvious startup-template dashboard look.
- No shadcn-like visual fingerprints.
- Minimal but rich motion.
- Dark mode as first-class, not an afterthought.
- UI should feel like a premium writing instrument or creative IDE.

### UX standards
- Every action should feel reversible and safe.
- AI must explain where answers came from.
- Files must remain understandable outside the app.
- Sync must feel visible and trustworthy.
- Search, quick open, and keyboard flow must be excellent.

### Engineering standards
- Local Core is source of truth.
- Sync is additive, not authoritative.
- AI features degrade gracefully if offline.
- The product must remain useful with zero cloud connectivity.
- The architecture should support long-term growth without rewriting the app shell.

---

## Final Product Positioning

**Noctodeus** is a premium local-first desktop knowledge system for notes, research, and AI-assisted thinking.

It is built for users who want:
- the ownership of local Markdown,
- the organization of a modern workspace,
- the grounded intelligence of source-aware AI,
- and a dark, high-trust interface that feels expensive, stable, and serious.

It should feel less like "another notes app" and more like a private thinking environment.
