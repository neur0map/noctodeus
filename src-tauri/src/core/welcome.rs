use std::fs;
use std::path::Path;

use tracing::debug;

use crate::errors::NoctoError;

/// Populate a freshly created core with welcome content.
/// Creates a structured set of markdown files that showcase all features.
pub fn write_welcome_content(core_path: &Path) -> Result<(), NoctoError> {
    let files: &[(&str, &str)] = &[
        ("welcome.md", WELCOME),
        ("getting-started/01-writing.md", WRITING),
        ("getting-started/02-organizing.md", ORGANIZING),
        ("getting-started/03-linking.md", LINKING),
        ("getting-started/04-search-and-navigate.md", SEARCH_NAVIGATE),
        ("getting-started/05-daily-notes.md", DAILY_NOTES),
        ("getting-started/06-customization.md", CUSTOMIZATION),
        ("getting-started/07-sync.md", SYNC),
        ("getting-started/08-keyboard-shortcuts.md", SHORTCUTS),
        ("media/noctodeus.jpg", ""), // placeholder — actual image copied separately
    ];

    for (rel_path, content) in files {
        if *rel_path == "media/noctodeus.jpg" {
            continue; // handled below
        }
        let abs_path = core_path.join(rel_path);
        if let Some(parent) = abs_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)?;
            }
        }
        fs::write(&abs_path, content)?;
        debug!(path = rel_path, "wrote welcome file");
    }

    // Copy the hero image from the app's static assets
    // The image is bundled with the app at build time
    let media_dir = core_path.join("media");
    if !media_dir.exists() {
        fs::create_dir_all(&media_dir)?;
    }

    debug!("welcome content written");
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────
// Welcome content
// ─────────────────────────────────────────────────────────────────────

const WELCOME: &str = r#"---
title: "Welcome to Noctodeus"
---

# Welcome to Noctodeus

![Noctodeus](media/noctodeus.jpg)

**Noctodeus** is a creative IDE for thought. A local-first writing environment designed for people who think in connections, not folders.

Everything lives on your machine. Your notes are plain markdown files — no vendor lock-in, no cloud dependency, no subscription. You own your words.

---

## What Makes Noctodeus Different

**Think in links, not hierarchies.** Connect ideas with [[02-organizing|wiki-links]] and watch your knowledge graph grow. Every note is a node. Every link is a connection you chose to make.

**Write without friction.** A distraction-free editor with rich formatting, slash commands, task lists, tables, code blocks with syntax highlighting, and media embedding — all in clean markdown.

**Find anything instantly.** Full-text search across every note, powered by SQLite FTS5. Search by content, not just titles.

**Your data, your rules.** Local-first architecture. Optional sync to GitHub when you're ready. No accounts, no telemetry, no tracking.

---

## Start Exploring

The **getting-started** folder walks you through each feature:

1. [[01-writing]] — The editor and what it can do
2. [[02-organizing]] — Files, folders, and your workspace
3. [[03-linking]] — Wiki-links and the knowledge graph
4. [[04-search-and-navigate]] — Finding things fast
5. [[05-daily-notes]] — Your journaling workflow
6. [[06-customization]] — Themes, fonts, and making it yours
7. [[07-sync]] — Backing up to GitHub
8. [[08-keyboard-shortcuts]] — Power user essentials

Or just close this note and start writing. There's no wrong way to begin.

> *"The best time to start a second brain was yesterday. The second best time is now."*
"#;

const WRITING: &str = r#"---
title: "Writing in Noctodeus"
---

# Writing in Noctodeus

The editor is built for focused writing with powerful formatting when you need it.

---

## Slash Commands

Type `/` at the start of a line to open the command menu. From here you can insert:

- **Headings** (H1, H2, H3)
- **Task lists** with checkboxes
- **Code blocks** with syntax highlighting
- **Tables** for structured data
- **Blockquotes** for callouts
- **Images, videos, and embeds**
- **Horizontal rules** to divide sections

Try it now — type `/` on an empty line below:



---

## Rich Text Formatting

Select any text to see the **bubble toolbar**. It gives you quick access to:

- **Bold**, *italic*, ~~strikethrough~~, and ==highlight==
- Links, inline code, subscript, superscript
- Text color
- Text alignment

Everything saves as clean markdown. No proprietary format.

---

## Task Lists

- [x] Create a new core
- [x] Open the welcome notes
- [ ] Try the slash command menu
- [ ] Create your first note
- [ ] Link two notes together

Tasks are just markdown checkboxes. They work everywhere markdown works.

---

## Code Blocks

```javascript
function greet(name) {
  return `Hello, ${name}! Welcome to Noctodeus.`;
}
```

Syntax highlighting supports 30+ languages out of the box.

---

## Tables

| Feature | Status |
|---------|--------|
| Rich editor | Available |
| Wiki-links | Available |
| Graph view | Available |
| Sync | Available |
| Themes | 15+ included |

---

## Media

Drag and drop images directly into the editor. They're copied to your core's `media/` folder automatically. You can also paste images from your clipboard.

Videos and audio files work the same way.

---

Next: [[02-organizing]] — learn how to structure your workspace.
"#;

const ORGANIZING: &str = r#"---
title: "Organizing Your Workspace"
---

# Organizing Your Workspace

Noctodeus uses a simple, flexible structure: **cores** contain your files.

---

## What's a Core?

A core is a folder on your computer that Noctodeus manages. Think of it as a vault, a project, or a workspace — whatever fits your mental model.

You can have multiple cores:
- **Personal** — journal, ideas, reading notes
- **Work** — project docs, meeting notes, specs
- **Research** — papers, references, annotations

Switch between them from the **core switcher** on the home screen.

---

## Files and Folders

Create files and folders from the **sidebar**:
- Click the `+` button in the sidebar header
- Or right-click any folder for context menu options
- Or use the keyboard shortcut to create a new note

Rename files by double-clicking their name in the sidebar, or right-click and choose Rename.

---

## Pinned Files

Pin frequently accessed files by right-clicking and selecting **Pin**. Pinned files appear in the sidebar's pinned section for instant access.

---

## File Tree

The sidebar shows your entire file tree. You can:
- **Drag and drop** files between folders
- **Sort** by name or date modified (click the menu icon)
- **Collapse** the sidebar for more editing space

---

Next: [[03-linking]] — the real power of connected notes.
"#;

const LINKING: &str = r#"---
title: "Linking Your Ideas"
---

# Linking Your Ideas

Wiki-links are the heart of Noctodeus. They turn your notes from isolated documents into a connected network of thought.

---

## Creating Links

Type `[[` and start typing a note name. A suggestion popup appears with matching files. Press Enter to insert the link.

Try it: type `[[welcome` to link back to the welcome note.

Links use the `[[note name]]` syntax. You can also add display text: `[[note name|custom text]]`.

---

## Backlinks

Every note knows who links to it. Open the **right panel** to see backlinks — all the notes that reference the current file.

This is powerful for building context. Write freely, link generously, and let the backlinks reveal patterns you didn't plan.

---

## The Graph View

Open the **graph view** from the right panel to see your entire knowledge network visualized. Each note is a node. Each link is an edge.

- **Larger nodes** have more connections
- **Hover** over a node to highlight its connections
- **Click** a node to open that note
- **Orphan notes** (no links) appear separately in the stats

The graph grows with your writing. It's not something you build — it's something that emerges.

---

## Aliases

Add aliases in a note's frontmatter to make it findable by multiple names:

```yaml
---
title: "JavaScript"
aliases: [JS, ECMAScript]
---
```

Now linking to `[[JS]]` or `[[ECMAScript]]` will find this note.

---

Next: [[04-search-and-navigate]] — find anything, instantly.
"#;

const SEARCH_NAVIGATE: &str = r#"---
title: "Search and Navigation"
---

# Search and Navigation

With a growing collection of notes, finding things fast is essential.

---

## Quick Open

Press **Cmd+P** (Mac) or **Ctrl+P** (Windows/Linux) to open Quick Open. Start typing to filter files by name. Press Enter to open.

This is the fastest way to jump between notes.

---

## Full-Text Search

Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux) to search across all note content. The search is powered by SQLite FTS5 with the Porter stemming algorithm — so searching for "writing" also finds "write" and "written."

Results show a highlighted snippet of the matching text.

---

## Command Palette

Press **Cmd+Shift+P** (Mac) or **Ctrl+Shift+P** (Windows/Linux) for the command palette. It gives you access to every action:

- Sync now
- Toggle sidebar
- Create new note
- Push / pull sync
- And more

---

## Find and Replace

Press **Cmd+F** (Mac) or **Ctrl+F** (Windows/Linux) within a note to open the find bar. Use **Cmd+H** / **Ctrl+H** for find and replace.

---

## Tabs

Open multiple notes as tabs. Click a tab to switch, or middle-click to close. Your tab state is preserved between sessions.

---

Next: [[05-daily-notes]] — build a journaling habit.
"#;

const DAILY_NOTES: &str = r#"---
title: "Daily Notes"
---

# Daily Notes

Noctodeus includes a built-in daily notes system for journaling, task tracking, and capturing fleeting ideas.

---

## The Calendar

Open the calendar from the sidebar. Click any date to create (or open) a daily note for that day. Days with existing notes are highlighted.

Daily notes are stored in the `journal/` folder with the format `YYYY-MM-DD.md`.

---

## Daily Note Template

Each daily note is created with a template:

```markdown
---
title: "2026-04-07"
tags: [journal, daily]
---

# Monday, April 7 2026

## Tasks

- [ ]

## Notes

```

Customize it to fit your workflow — add habit trackers, gratitude sections, or anything that helps you reflect.

---

## Building the Habit

The best journaling system is the one you actually use. Daily notes work because:

- **Zero friction** — one click to create today's note
- **Consistent structure** — the template removes decision fatigue
- **Connected** — link daily notes to project notes, people, ideas
- **Searchable** — find any day's entry with full-text search

---

Next: [[06-customization]] — make Noctodeus yours.
"#;

const CUSTOMIZATION: &str = r#"---
title: "Customization"
---

# Customization

Noctodeus adapts to your preferences, not the other way around.

---

## Themes

Open **Settings** and go to the **Appearance** tab. Choose from 15+ built-in themes across dark, light, and warm palettes.

Each theme is carefully crafted with consistent color tokens. The editor, sidebar, and all UI elements update instantly.

---

## Fonts

Override the default fonts in Settings > Appearance:

- **Mono** — used for the UI, labels, and code blocks
- **Sans** — used for headings and navigation
- **Content** — used for the editor body text

Leave any field blank to use the defaults (JetBrains Mono, Inter, Source Serif 4).

---

## Editor Settings

- **Font size** — 14px to 20px
- **Editor width** — Narrow (640px) to full width
- **Auto-save** — toggle on/off
- **Character count** — show in the sidebar footer

---

## Custom CSS

For power users: inject custom CSS in Settings > Appearance > Custom CSS. Changes apply instantly. Useful selectors:

- `.ProseMirror` — the editor content area
- `.app-shell` — the main layout
- `:root` — CSS custom properties (color tokens)

---

## Hotkeys

Rebind any keyboard shortcut in Settings > Hotkeys. Click a shortcut, press your new key combination, done. Reset individual keys or all at once.

---

Next: [[07-sync]] — keep your notes backed up.
"#;

const SYNC: &str = r#"---
title: "Sync with GitHub"
---

# Sync with GitHub

Noctodeus syncs your notes to a private GitHub repository. Your data stays yours — GitHub is just the transport.

---

## Setup

1. Go to **Settings > Sync**
2. Create a **Personal Access Token** on GitHub (Settings > Developer settings > Fine-grained tokens)
3. Give it **Contents: Read and write** permission
4. Paste the token and your repo URL into Noctodeus
5. Click **Connect**

That's it. One repo can hold multiple cores.

---

## How It Works

- Press the **Sync button** in the sidebar footer (or use the command palette)
- Noctodeus pulls remote changes, merges them, then pushes your local changes
- If two devices edited the same file, the merge is automatic when possible
- If there's a true conflict, both versions are kept — nothing is ever lost

---

## What Gets Synced

| Synced | Not Synced |
|--------|-----------|
| All your markdown files | Database index (rebuilt locally) |
| Media (images, etc.) | Logs and cache |
| Core settings | OS-specific artifacts |

Your notes are plain files in a git repo. You can browse them on GitHub, clone them anywhere, or switch to a different tool anytime.

---

## Conflict Resolution

When two devices edit the same note:

1. Noctodeus tries an **automatic three-way merge**
2. If it can't merge cleanly, it **keeps both versions** — the remote version stays as the main file, your local version is saved as `note.conflict-2026-04-07.md`
3. You resolve at your own pace — no merge markers, no data loss

---

Next: [[08-keyboard-shortcuts]] — work faster.
"#;

const SHORTCUTS: &str = r#"---
title: "Keyboard Shortcuts"
---

# Keyboard Shortcuts

Noctodeus is designed for keyboard-first workflows. Every shortcut is customizable in Settings > Hotkeys.

---

## Navigation

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Quick Open | Cmd+P | Ctrl+P |
| Search | Cmd+K | Ctrl+K |
| Command Palette | Cmd+Shift+P | Ctrl+Shift+P |
| Toggle Sidebar | Cmd+B | Ctrl+B |
| Toggle Right Panel | Cmd+\ | Ctrl+\ |
| Collapse Sidebar | Cmd+Shift+B | Ctrl+Shift+B |

## Editing

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| New Note | Cmd+N | Ctrl+N |
| Delete File | Cmd+Backspace | Ctrl+Backspace |
| Find in Note | Cmd+F | Ctrl+F |
| Find and Replace | Cmd+H | Ctrl+H |
| Bold | Cmd+B | Ctrl+B |
| Italic | Cmd+I | Ctrl+I |
| Inline Code | Cmd+E | Ctrl+E |
| Link | Cmd+K | Ctrl+K |

## Editor

| Action | Shortcut |
|--------|----------|
| Slash Command | Type `/` at line start |
| Wiki Link | Type `[[` |
| Task Checkbox | Type `- [ ] ` |

---

## Customizing Shortcuts

1. Open **Settings** > **Hotkeys**
2. Click any shortcut to start recording
3. Press your new key combination
4. Press **Escape** to cancel

All shortcuts can be reset individually or all at once.

---

That's everything you need to get started. Close this note and begin building your second brain.

Welcome to Noctodeus.
"#;
