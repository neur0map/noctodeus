# Noctodeus Sub-Project 2: Markdown Editor

**Date:** 2026-04-04
**Scope:** Feature 3 (Markdown-first editing) from the product plan
**Stack:** TipTap (ProseMirror) + markdown-it + custom serializer
**Architecture:** Markdown on disk is source of truth. TipTap edits an in-memory ProseMirror document. Parse on load, serialize on save.

---

## Decisions

- **Editor framework:** TipTap (ProseMirror-based), WYSIWYG block editor
- **Editing mode:** WYSIWYG only. No split view or source mode in this sub-project.
- **Markdown parser:** markdown-it with plugins for task lists and wiki-links
- **Serializer:** Custom ProseMirror-to-Markdown serializer
- **Save model:** Auto-save with 1-second debounce after last keystroke
- **Internal links:** [[wiki-link]] syntax with autocomplete, click-to-navigate, no backlinks yet
- **Scope boundary:** Essential Markdown only. No tables, math, diagrams, frontmatter editing, or custom blocks.

---

## 1. Data Flow

```
Open file:
  Rust reads file from disk
    -> frontend receives Markdown string via file:read command
    -> markdown-it parses to HTML (intermediate)
    -> TipTap/ProseMirror schema parses HTML to document model
    -> Editor renders WYSIWYG

Edit:
  User types/formats in TipTap
    -> ProseMirror document updates
    -> Debounce timer resets (1 second)
    -> After 1s idle: serialize document to Markdown string
    -> Frontend sends Markdown string via file:write command
    -> Rust writes to disk
    -> Watcher detects change (but auto-save writes are flagged to prevent echo events)

External change:
  Watcher detects file modified externally
    -> file:modified event fires
    -> If editor has no unsaved changes: reload content silently
    -> If editor has unsaved changes: show "File changed externally" notice with [Reload] [Keep mine] options
```

### Auto-save echo prevention

When the editor triggers a save, the frontend computes a SHA-256 hash of the serialized Markdown string *before* calling `writeFile()` and stores it as `lastSavedHash`. When the watcher fires a `file:modified` event, the `FileNode.content_hash` in the event metadata (populated by the Rust indexer using the same SHA-256 algorithm from `scanner.rs`) is compared against `lastSavedHash`. If they match, the event is silently ignored.

**Rust change required:** Modify `file_write` in `commands/files.rs` to compute and return the `content_hash` in the returned `FileInfo`, so the frontend can also get the hash from the write response as confirmation. Currently `file_info_from_path()` returns `content_hash: None`.

---

## 2. Project Structure (new/modified files)

```
src/
  lib/
    editor/
      Editor.svelte              # TipTap instance, mount/destroy, auto-save
      EditorToolbar.svelte        # Formatting toolbar
      WikiLinkSuggest.svelte      # [[ autocomplete dropdown
      SaveIndicator.svelte        # Save state indicator
      extensions/
        wiki-link.ts              # Custom TipTap extension for [[links]]
        index.ts                  # Extension bundle (StarterKit + all extensions)
      serializer/
        to-markdown.ts            # ProseMirror document -> Markdown string
        from-markdown.ts          # Markdown string -> ProseMirror document (via markdown-it)
        index.ts                  # Parse/serialize exports
      styles/
        editor.css                # Editor-specific styles (content typography, blocks)
    stores/
      editor.svelte.ts            # Editor state: content, save status, dirty flag
  routes/
    +page.svelte                  # (modified) Replace read-only viewer with Editor, handle conflicts
  components/
    layout/
      ContentHeader.svelte        # (modified) Add slot/snippet for save indicator
```

### Rust changes

Minimal Rust changes:
- **`commands/files.rs`**: Modify `file_write` to compute SHA-256 content hash and include it in the returned `FileInfo`. Use the same `compute_hash` function from `indexer/scanner.rs` (or extract it to a shared utility).

The editor uses existing `readFile()` and `writeFile()` bridge functions from `$lib/bridge/commands.ts`. The watcher and indexer pipeline already handles the save-to-disk flow.

---

## 3. TipTap Extension Setup

### Extension bundle (`extensions/index.ts`)

```typescript
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { WikiLink } from './wiki-link';

export function createExtensions(options: { placeholder?: string }) {
  return [
    StarterKit.configure({
      codeBlock: false, // replaced by CodeBlockLowlight
    }),
    CodeBlockLowlight.configure({
      lowlight: createLowlight(common), // ~35 common languages from lowlight
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({
      openOnClick: false, // handle navigation ourselves
      autolink: true,
    }),
    Image.configure({
      inline: false,
      allowBase64: false,
    }),
    Placeholder.configure({
      placeholder: options.placeholder ?? 'Start writing...',
    }),
    WikiLink,
  ];
}
```

### WikiLink extension (`extensions/wiki-link.ts`)

Custom TipTap Node extension:
- **Node type:** `wikiLink` (inline, atom)
- **Attributes:** `target` (the note name/path inside [[ ]])
- **Input rule:** Typing `[[` opens the suggestion popup
- **Rendering:** Displays as a styled inline link with the note name
- **Click behavior:** Navigates to the linked note via the existing file open flow
- **Resolution:** On click, search `files.fileMap` for a `.md` file whose name (without extension) matches the target. If no match, show a toast offering to create the note.
- **Serialization:** Outputs `[[target]]` in Markdown
- **Parsing:** markdown-it plugin detects `[[...]]` and creates a token

---

## 4. Serializer Design

### From Markdown (`from-markdown.ts`)

```
Markdown string
  -> markdown-it.render() with wiki-link plugin
  -> HTML string with <wiki-link> custom elements
  -> TipTap editor.commands.setContent(html)
  -> ProseMirror parses HTML to document via schema
```

The markdown-it wiki-link plugin converts `[[note-name]]` to `<wiki-link target="note-name">note-name</wiki-link>` elements, which TipTap's schema maps to `wikiLink` nodes via the `parseHTML()` rule on the `wikiLink` extension.

**Normalization note:** The HTML intermediate step inherently normalizes Markdown syntax. Emphasis markers normalize to `*` (not `_`), list markers normalize to `- ` (not `*` or `+`), and extra whitespace is collapsed. Round-trip tests should compare against a canonical normalized form, not the original input verbatim.

### To Markdown (`to-markdown.ts`)

Custom serializer that walks the ProseMirror document tree and outputs Markdown:

| ProseMirror Node | Markdown Output |
|---|---|
| heading (level N) | `#` repeated N times + space + content |
| paragraph | content + blank line |
| bulletList > listItem | `- ` + content |
| orderedList > listItem | `1. ` + content (auto-numbered) |
| taskList > taskItem | `- [x] ` or `- [ ] ` + content |
| codeBlock | ```` ``` ```` + language + newline + content + ```` ``` ```` |
| blockquote | `> ` + content |
| horizontalRule | `---` |
| image | `![alt](src)` |
| hardBreak | `\n` (or two trailing spaces) |
| **bold** | `**content**` |
| *italic* | `*content*` |
| `code` | `` `content` `` |
| link | `[text](href)` |
| wikiLink | `[[target]]` |

### Round-trip testing

Automated tests that:
1. Take a Markdown string
2. Parse to ProseMirror document
3. Serialize back to Markdown
4. Assert output matches input (or a normalized canonical form)

Test fixtures cover: headings, nested lists, mixed formatting, code blocks with language tags, wiki-links, images, task lists, blockquotes, and edge cases (empty paragraphs, adjacent blocks).

---

## 5. Editor Component (`Editor.svelte`)

```svelte
Props:
  path: string              # File path (for save target)
  initialContent: string    # Markdown string from file:read
  onnavigate: (path: string) => void  # Wiki-link click handler

State:
  editor: Editor            # TipTap editor instance
  dirty: boolean            # Has unsaved changes
  saveStatus: 'saved' | 'saving' | 'unsaved'
  lastSavedHash: string     # Content hash of last save (for echo prevention)
```

**Lifecycle:**
1. On mount: create TipTap editor, parse `initialContent`, set `dirty = false`
2. On editor update: set `dirty = true`, reset debounce timer
3. After 1s idle: serialize to Markdown, call `file:write`, set `dirty = false`, update `lastSavedHash`
4. On `path` change: parent (`+page.svelte`) awaits dirty flush before swapping editor
5. On destroy: no async save attempt. The parent is responsible for flushing before destroying the editor. A `beforeunload` handler at the window level acts as a safety net for unexpected exits (fire-and-forget write).

**Focus behavior:**
- Editor auto-focuses on mount
- Click anywhere in the content area focuses the editor
- Editor maintains focus through toolbar interactions (toolbar buttons use `event.preventDefault()` to avoid stealing focus)

---

## 6. Editor Toolbar (`EditorToolbar.svelte`)

Fixed bar below the content header. Compact, single row.

**Buttons (left to right):**

| Button | Action | Active state |
|---|---|---|
| **B** | Toggle bold | Highlighted when selection is bold |
| *I* | Toggle italic | Highlighted when selection is italic |
| `<>` | Toggle inline code | Highlighted when selection is code |
| H1 | Set heading 1 | Highlighted when in h1 |
| H2 | Set heading 2 | Highlighted when in h2 |
| H3 | Set heading 3 | Highlighted when in h3 |
| List | Toggle bullet list | Highlighted when in list |
| Ordered | Toggle ordered list | Highlighted when in ordered list |
| Check | Toggle task list | Highlighted when in task list |
| Quote | Toggle blockquote | Highlighted when in blockquote |
| Code | Toggle code block | Highlighted when in code block |
| Link | Insert/edit link (shows URL input popover) | Highlighted when on link |
| Image | Insert image (shows path/URL input popover) | — |
| `---` | Insert horizontal rule | — |

**Styling:**
- Height: 36px
- Background: `--color-bg-surface`
- Border-bottom: 1px `--color-border-subtle`
- Button icons: simple mono glyphs or SVG, `--color-text-secondary`
- Active button: `--color-accent` text
- Hover: `--color-bg-hover` background
- Font: `--font-mono`, `--text-xs`
- Buttons don't steal editor focus (`mousedown` preventDefault)

---

## 7. WikiLink Autocomplete (`WikiLinkSuggest.svelte`)

Triggered when user types `[[` in the editor.

**Behavior:**
1. On `[[` input: show dropdown anchored below cursor
2. As user types after `[[`: filter file list by name/title (fuzzy)
3. Arrow keys navigate, Enter selects, Escape cancels
4. On select: insert `wikiLink` node with selected path, close dropdown
5. On `]]` typed manually: close dropdown, create link from typed text

**Dropdown styling:**
- Width: 300px, max-height: 240px
- Background: `--color-bg-elevated`
- Shadow: `--shadow-elevated`
- Border-radius: 8px
- Items: file icon + name + path, `--font-mono`, `--text-sm`
- Selected item: `--color-bg-hover`
- Same visual language as QuickOpen results

**Data source:** Uses the files store's `fileMap` filtered to non-directory entries.

---

## 8. Save Indicator (`SaveIndicator.svelte`)

Small status element in the content header, right-aligned.

**States:**
- **Saved:** Subtle checkmark or dot in `--color-text-muted`, text "Saved"
- **Saving:** Subtle pulse animation, text "Saving..."
- **Unsaved:** Dot in `--color-accent`, text "Unsaved"

Font: `--font-mono`, `--text-xs`. Transition between states with `--duration-fast` fade.

---

## 9. Editor Store (`stores/editor.svelte.ts`)

```typescript
let currentPath = $state<string | null>(null);
let dirty = $state(false);
let saveStatus = $state<'saved' | 'saving' | 'unsaved'>('saved');
let lastSavedHash = $state<string | null>(null);

export function getEditorState() {
  return {
    get currentPath() { return currentPath; },
    get dirty() { return dirty; },
    get saveStatus() { return saveStatus; },
    get lastSavedHash() { return lastSavedHash; },

    setPath(path: string | null) { currentPath = path; dirty = false; saveStatus = 'saved'; },
    markDirty() { dirty = true; saveStatus = 'unsaved'; },
    markSaving() { saveStatus = 'saving'; },
    markSaved(hash: string) { dirty = false; saveStatus = 'saved'; lastSavedHash = hash; },
    isOwnSave(hash: string) { return lastSavedHash === hash; },
    reset() { currentPath = null; dirty = false; saveStatus = 'saved'; lastSavedHash = null; },
  };
}
```

---

## 10. Editor Styles (`editor.css`)

The TipTap editor content area uses the existing design system:

```
.ProseMirror {
  font-family: var(--font-content);
  font-size: var(--text-base);
  line-height: 1.7;
  color: var(--color-text-primary);
  padding: var(--space-8) var(--space-10);
  max-width: 720px;
  margin: 0 auto;
  outline: none;
  min-height: 100%;
}

Headings: --font-sans (Inter), weight 600 (intentional — sans headings in serif body for contrast)
  h1: --text-2xl
  h2: --text-xl
  h3: --text-lg

Code blocks: --font-mono, --color-bg-surface background, 8px radius
Inline code: --font-mono, 0.9em, --color-bg-surface, 4px radius
Blockquotes: left border 2px --color-border-strong, --color-text-secondary
Task lists: custom checkbox styling matching accent color
Links: --color-accent, no underline, underline on hover
Wiki-links: --color-accent, dotted underline to distinguish from URLs
Images: max-width 100%, border-radius 8px
Horizontal rule: 1px --color-border-subtle, margin --space-8

Selection: --color-accent at 20% opacity
Placeholder: --color-text-muted, italic
```

Respects `prefers-reduced-motion` for any cursor or typing animations.

---

## 11. Integration with Existing App

### Page changes (`+page.svelte`)

Replace the read-only markdown renderer and raw file viewer with:
- If active file is `.md`/`.markdown`: mount `Editor` component with file content
- If active file is image: show image preview (unchanged)
- If active file is other type: show file info card (unchanged)
- If no active file: show HomeView (unchanged)

### External change conflict handling (in `+page.svelte`)

When `file:modified` event fires for the active file:
- Check `editorState.isOwnSave(hash)` — if true, ignore
- If editor is not dirty: silently reload content
- If editor is dirty: show inline notice below toolbar with [Reload] [Keep mine]

This logic lives in `+page.svelte` (not `+layout.svelte`) since it is editor-specific.

### Keyboard shortcut passthrough

The existing `KeyboardManager` must yield keyboard events to TipTap when the editor is focused. Since `KeyboardManager` already checks `isInputFocused()` (which returns true for contenteditable elements), standard formatting shortcuts (Cmd+B, Cmd+I, etc.) will pass through to TipTap. No changes needed — verify during implementation.

### Toolbar integration

Insert `EditorToolbar` between `ContentHeader` and `Editor` when editing a Markdown file. The toolbar is part of the page content, not the layout.

---

## 12. npm Dependencies

```
@tiptap/core
@tiptap/pm                    # ProseMirror dependencies
@tiptap/starter-kit
@tiptap/extension-code-block-lowlight
@tiptap/extension-task-list
@tiptap/extension-task-item
@tiptap/extension-link
@tiptap/extension-image
@tiptap/extension-placeholder
lowlight                       # Syntax highlighting for code blocks
markdown-it                    # Markdown parser (new — replaces `marked` which can be removed)
```

---

## 13. Testing Strategy

### Prerequisites

Add vitest configuration to `vite.config.js` (or create `vitest.config.ts`):
- `environment: 'jsdom'`
- Include `@testing-library/svelte` cleanup if needed

### Serializer tests (vitest)

- Round-trip tests: parse → serialize → compare for each Markdown feature
- Edge cases: empty document, consecutive headings, nested lists, code blocks with special chars
- Wiki-link round-trip: `[[note]]` survives parse/serialize
- Normalization: trailing whitespace, blank line handling

### Editor component tests (vitest + @testing-library/svelte)

- Mounts with initial content
- Auto-save triggers after debounce
- Dirty state management
- Wiki-link autocomplete filters correctly
- Toolbar button states reflect cursor position
- External change handling (reload vs conflict)

### Not tested in sub-project 2

- Visual regression
- Complex multi-user editing scenarios
- Performance with very large documents (>10k lines)
