# Markdown Editor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the read-only Markdown viewer with a full TipTap WYSIWYG block editor with auto-save and [[wiki-links]].

**Architecture:** TipTap (ProseMirror) edits an in-memory document. markdown-it parses Markdown to HTML on load. A custom serializer converts ProseMirror back to Markdown on save. Markdown on disk is always the source of truth. Auto-save with 1s debounce.

**Tech Stack:** TipTap, ProseMirror, markdown-it, lowlight, Svelte 5, existing Tauri backend

**Spec:** `docs/superpowers/specs/2026-04-04-noctodeus-sub2-markdown-editor-design.md`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/lib/editor/serializer/from-markdown.ts` | Parse Markdown string to HTML via markdown-it |
| `src/lib/editor/serializer/to-markdown.ts` | Serialize ProseMirror document to Markdown string |
| `src/lib/editor/serializer/index.ts` | Re-exports parseMarkdown and serializeMarkdown |
| `src/lib/editor/extensions/wiki-link.ts` | TipTap WikiLink node extension |
| `src/lib/editor/extensions/index.ts` | Extension bundle factory |
| `src/lib/editor/Editor.svelte` | TipTap editor wrapper with auto-save |
| `src/lib/editor/EditorToolbar.svelte` | Formatting toolbar |
| `src/lib/editor/WikiLinkSuggest.svelte` | [[wiki-link]] autocomplete dropdown |
| `src/lib/editor/SaveIndicator.svelte` | Save state indicator |
| `src/lib/editor/styles/editor.css` | Editor content styles |
| `src/lib/stores/editor.svelte.ts` | Editor state (dirty, save status, hash) |
| `src/lib/editor/__tests__/serializer.test.ts` | Serializer round-trip tests |

### Modified files
| File | Change |
|---|---|
| `package.json` | Add TipTap + markdown-it deps, remove `marked` |
| `src-tauri/src/indexer/scanner.rs` | Make `compute_hash` pub |
| `src-tauri/src/commands/files.rs` | Add content hash to `file_write` return |
| `src/lib/components/layout/ContentHeader.svelte` | Add trailing snippet slot for save indicator |
| `src/routes/+page.svelte` | Replace read-only viewer with Editor, add conflict handling |
| `vite.config.js` | Add vitest test config |

---

## Chunk 1: Foundation (deps, config, serializer, store)

### Task 1: Install dependencies and configure vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`

- [ ] **Step 1: Install TipTap and markdown-it dependencies**

```bash
npm install @tiptap/core @tiptap/pm @tiptap/starter-kit @tiptap/extension-code-block-lowlight @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-link @tiptap/extension-image @tiptap/extension-placeholder lowlight markdown-it
npm install -D @types/markdown-it
```

- [ ] **Step 2: Remove `marked` from dependencies**

```bash
npm uninstall marked
```

- [ ] **Step 3: Add vitest config to `vite.config.js`**

Add a `test` block to the existing vite config:

```javascript
// Add to the returned config object:
test: {
  environment: 'jsdom',
  include: ['src/**/*.test.ts'],
},
```

- [ ] **Step 4: Verify vitest runs (no tests yet)**

Run: `npx vitest run`
Expected: "no test files found" (no error)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.js
git commit -m "Add TipTap, markdown-it dependencies and vitest config"
```

---

### Task 2: Implement Markdown serializer (from-markdown)

**Files:**
- Create: `src/lib/editor/serializer/from-markdown.ts`

- [ ] **Step 1: Create the from-markdown parser**

This module configures markdown-it with a custom wiki-link plugin and exports a function that converts a Markdown string to HTML suitable for TipTap's `setContent()`.

```typescript
// src/lib/editor/serializer/from-markdown.ts
import MarkdownIt from 'markdown-it';

// markdown-it plugin for [[wiki-links]]
function wikiLinkPlugin(md: MarkdownIt) {
  // Match [[...]] in inline content
  md.inline.ruler.after('link', 'wiki_link', (state, silent) => {
    const start = state.pos;
    const max = state.posMax;

    // Must start with [[
    if (start + 2 >= max) return false;
    if (state.src.charCodeAt(start) !== 0x5B) return false;     // [
    if (state.src.charCodeAt(start + 1) !== 0x5B) return false; // [

    // Find closing ]]
    let end = start + 2;
    while (end + 1 < max) {
      if (state.src.charCodeAt(end) === 0x5D && state.src.charCodeAt(end + 1) === 0x5D) {
        break;
      }
      end++;
    }
    if (end + 1 >= max) return false;

    const target = state.src.slice(start + 2, end).trim();
    if (!target) return false;

    if (!silent) {
      const token = state.push('wiki_link', 'wiki-link', 0);
      token.attrSet('target', target);
      token.content = target;
    }

    state.pos = end + 2;
    return true;
  });

  md.renderer.rules['wiki_link'] = (tokens, idx) => {
    const target = tokens[idx].attrGet('target') ?? '';
    const escaped = target.replace(/"/g, '&quot;');
    return `<wiki-link target="${escaped}">${target}</wiki-link>`;
  };
}

const md = new MarkdownIt('default', {
  html: false,
  linkify: true,
  typographer: false,
});

md.use(wikiLinkPlugin);

/**
 * Parse a Markdown string to HTML for TipTap's setContent().
 * Wiki-links become <wiki-link target="..."> elements.
 */
export function parseMarkdown(markdown: string): string {
  return md.render(markdown);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/editor/serializer/from-markdown.ts
git commit -m "Add markdown-it parser with wiki-link plugin"
```

---

### Task 3: Implement Markdown serializer (to-markdown)

**Files:**
- Create: `src/lib/editor/serializer/to-markdown.ts`

- [ ] **Step 1: Create the to-markdown serializer**

This module walks a ProseMirror JSON document and outputs a Markdown string.

```typescript
// src/lib/editor/serializer/to-markdown.ts
import type { JSONContent } from '@tiptap/core';

/**
 * Serialize a TipTap/ProseMirror JSON document to a Markdown string.
 */
export function serializeMarkdown(doc: JSONContent): string {
  if (!doc.content) return '';
  return doc.content.map((node) => serializeNode(node, 0)).join('\n');
}

function serializeNode(node: JSONContent, indent: number): string {
  switch (node.type) {
    case 'paragraph':
      return serializeInline(node.content) + '\n';

    case 'heading': {
      const level = node.attrs?.level ?? 1;
      const hashes = '#'.repeat(level);
      return `${hashes} ${serializeInline(node.content)}\n`;
    }

    case 'bulletList':
      return (node.content ?? [])
        .map((item) => serializeListItem(item, indent, '- '))
        .join('') + '\n';

    case 'orderedList':
      return (node.content ?? [])
        .map((item, i) => serializeListItem(item, indent, `${i + 1}. `))
        .join('') + '\n';

    case 'taskList':
      return (node.content ?? [])
        .map((item) => {
          const checked = item.attrs?.checked ? 'x' : ' ';
          return serializeListItem(item, indent, `- [${checked}] `);
        })
        .join('') + '\n';

    case 'codeBlock': {
      const lang = node.attrs?.language ?? '';
      const code = node.content?.map((c) => c.text ?? '').join('') ?? '';
      return '```' + lang + '\n' + code + '\n```\n';
    }

    case 'blockquote':
      return (node.content ?? [])
        .map((child) => serializeNode(child, indent))
        .split('\n')
        .filter((line, i, arr) => i < arr.length - 1 || line !== '')
        .map((line) => (line === '' ? '>' : `> ${line}`))
        .join('\n') + '\n';

    case 'horizontalRule':
      return '---\n';

    case 'image': {
      const src = node.attrs?.src ?? '';
      const alt = node.attrs?.alt ?? '';
      return `![${alt}](${src})\n`;
    }

    default:
      return serializeInline(node.content) + '\n';
  }
}

function serializeListItem(item: JSONContent, indent: number, prefix: string): string {
  const pad = '  '.repeat(indent);
  const children = item.content ?? [];
  const lines: string[] = [];

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.type === 'paragraph') {
      const text = serializeInline(child.content);
      if (i === 0) {
        lines.push(`${pad}${prefix}${text}`);
      } else {
        lines.push(`${pad}${'  '.repeat(prefix.length)}${text}`);
      }
    } else if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
      lines.push(serializeNode(child, indent + 1).trimEnd());
    }
  }

  return lines.join('\n') + '\n';
}

function serializeInline(content?: JSONContent[]): string {
  if (!content) return '';
  return content.map(serializeInlineNode).join('');
}

function serializeInlineNode(node: JSONContent): string {
  if (node.type === 'text') {
    let text = node.text ?? '';
    const marks = node.marks ?? [];

    for (const mark of marks) {
      switch (mark.type) {
        case 'bold':
          text = `**${text}**`;
          break;
        case 'italic':
          text = `*${text}*`;
          break;
        case 'code':
          text = `\`${text}\``;
          break;
        case 'link':
          text = `[${text}](${mark.attrs?.href ?? ''})`;
          break;
      }
    }

    return text;
  }

  if (node.type === 'wikiLink') {
    return `[[${node.attrs?.target ?? ''}]]`;
  }

  if (node.type === 'hardBreak') {
    return '  \n';
  }

  if (node.type === 'image') {
    return `![${node.attrs?.alt ?? ''}](${node.attrs?.src ?? ''})`;
  }

  return '';
}
```

Note: The `blockquote` serializer has a deliberate pattern — it serializes children then prefixes each line with `> `. This handles nested content correctly.

- [ ] **Step 2: Create the serializer index**

```typescript
// src/lib/editor/serializer/index.ts
export { parseMarkdown } from './from-markdown';
export { serializeMarkdown } from './to-markdown';
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/editor/serializer/
git commit -m "Add ProseMirror-to-Markdown serializer"
```

---

### Task 4: Write serializer round-trip tests

**Files:**
- Create: `src/lib/editor/__tests__/serializer.test.ts`

- [ ] **Step 1: Write round-trip tests**

```typescript
// src/lib/editor/__tests__/serializer.test.ts
import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../serializer/from-markdown';
import { serializeMarkdown } from '../serializer/to-markdown';

// Helper: to test round-tripping we need a TipTap editor instance
// to parse HTML into ProseMirror JSON. For unit tests, we test
// each direction independently.

describe('parseMarkdown', () => {
  it('converts headings to HTML', () => {
    const html = parseMarkdown('# Hello\n\n## World\n');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<h2>World</h2>');
  });

  it('converts wiki-links to custom elements', () => {
    const html = parseMarkdown('See [[my-note]] for details.\n');
    expect(html).toContain('<wiki-link target="my-note">my-note</wiki-link>');
  });

  it('converts task lists', () => {
    const html = parseMarkdown('- [x] Done\n- [ ] Todo\n');
    expect(html).toContain('type="checkbox"');
  });

  it('converts code blocks with language', () => {
    const html = parseMarkdown('```javascript\nconst x = 1;\n```\n');
    expect(html).toContain('const x = 1;');
  });

  it('converts blockquotes', () => {
    const html = parseMarkdown('> quoted text\n');
    expect(html).toContain('<blockquote>');
  });

  it('converts inline formatting', () => {
    const html = parseMarkdown('**bold** and *italic* and `code`\n');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('converts images', () => {
    const html = parseMarkdown('![alt text](image.png)\n');
    expect(html).toContain('<img');
    expect(html).toContain('src="image.png"');
  });

  it('converts links', () => {
    const html = parseMarkdown('[click here](https://example.com)\n');
    expect(html).toContain('href="https://example.com"');
  });

  it('handles empty input', () => {
    expect(parseMarkdown('')).toBe('');
  });
});

describe('serializeMarkdown', () => {
  it('serializes a heading', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hello' }] },
      ],
    };
    expect(serializeMarkdown(doc).trim()).toBe('# Hello');
  });

  it('serializes paragraphs with blank lines', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
      ],
    };
    const md = serializeMarkdown(doc);
    expect(md).toContain('First\n');
    expect(md).toContain('Second\n');
  });

  it('serializes bold and italic marks', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
          ],
        },
      ],
    };
    expect(serializeMarkdown(doc).trim()).toBe('**bold** and *italic*');
  });

  it('serializes wiki-links', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See ' },
            { type: 'wikiLink', attrs: { target: 'my-note' } },
          ],
        },
      ],
    };
    expect(serializeMarkdown(doc)).toContain('[[my-note]]');
  });

  it('serializes code blocks with language', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [{ type: 'text', text: 'const x = 1;' }],
        },
      ],
    };
    const md = serializeMarkdown(doc);
    expect(md).toContain('```typescript');
    expect(md).toContain('const x = 1;');
    expect(md).toContain('```');
  });

  it('serializes bullet lists', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }] },
          ],
        },
      ],
    };
    const md = serializeMarkdown(doc);
    expect(md).toContain('- Item 1');
    expect(md).toContain('- Item 2');
  });

  it('serializes horizontal rule', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'horizontalRule' }],
    };
    expect(serializeMarkdown(doc).trim()).toBe('---');
  });

  it('handles empty document', () => {
    expect(serializeMarkdown({ type: 'doc' })).toBe('');
    expect(serializeMarkdown({ type: 'doc', content: [] })).toBe('');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/lib/editor/__tests__/serializer.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/editor/__tests__/serializer.test.ts
git commit -m "Add serializer round-trip tests"
```

---

### Task 5: Create editor store

**Files:**
- Create: `src/lib/stores/editor.svelte.ts`

- [ ] **Step 1: Write the editor store**

```typescript
// src/lib/stores/editor.svelte.ts
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

    setPath(path: string | null) {
      currentPath = path;
      dirty = false;
      saveStatus = 'saved';
    },
    markDirty() {
      dirty = true;
      saveStatus = 'unsaved';
    },
    markSaving() {
      saveStatus = 'saving';
    },
    markSaved(hash: string) {
      dirty = false;
      saveStatus = 'saved';
      lastSavedHash = hash;
    },
    isOwnSave(hash: string | null): boolean {
      if (!hash || !lastSavedHash) return false;
      return lastSavedHash === hash;
    },
    reset() {
      currentPath = null;
      dirty = false;
      saveStatus = 'saved';
      lastSavedHash = null;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/stores/editor.svelte.ts
git commit -m "Add editor state store"
```

---

### Task 6: Rust — expose content hash from file_write

**Files:**
- Modify: `src-tauri/src/indexer/scanner.rs`
- Modify: `src-tauri/src/commands/files.rs`

- [ ] **Step 1: Make `compute_hash` public in scanner.rs**

In `src-tauri/src/indexer/scanner.rs`, find the `compute_hash` function and change visibility from `fn` to `pub fn`. Also change the signature to accept content bytes directly (for reuse by `file_write`):

Add a new public function:

```rust
/// Compute SHA-256 hash of a byte slice, returned as hex string.
pub fn hash_bytes(data: &[u8]) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}
```

- [ ] **Step 2: Update `file_write` in `commands/files.rs`**

After writing the file content to disk, compute the hash and include it in the returned `FileInfo`:

In the `file_write` function, after the `std::fs::write(&abs_path, &content)?;` line, before building the `FileInfo`, add:

```rust
let content_hash = Some(crate::indexer::scanner::hash_bytes(content.as_bytes()));
```

Then modify the `file_info_from_path` call or manually set the hash on the returned `FileInfo`:

```rust
let mut info = file_info_from_path(&abs_path, core_root)?;
info.content_hash = Some(crate::indexer::scanner::hash_bytes(content.as_bytes()));
Ok(info)
```

- [ ] **Step 3: Run Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: All 20 tests pass

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/indexer/scanner.rs src-tauri/src/commands/files.rs
git commit -m "Expose content hash from file_write for auto-save echo prevention"
```

---

## Chunk 2: TipTap Extensions and Editor Components

### Task 7: Create WikiLink TipTap extension

**Files:**
- Create: `src/lib/editor/extensions/wiki-link.ts`

- [ ] **Step 1: Implement the WikiLink node extension**

```typescript
// src/lib/editor/extensions/wiki-link.ts
import { Node, mergeAttributes } from '@tiptap/core';

export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      target: {
        default: null,
        parseHTML: (element) => element.getAttribute('target'),
        renderHTML: (attributes) => ({ target: attributes.target }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'wiki-link' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'wiki-link',
      mergeAttributes(HTMLAttributes),
      node.attrs.target ?? '',
    ];
  },

  addNodeView() {
    return ({ node, editor }) => {
      const dom = document.createElement('span');
      dom.classList.add('wiki-link');
      dom.textContent = node.attrs.target ?? '';
      dom.setAttribute('data-target', node.attrs.target ?? '');
      dom.addEventListener('click', () => {
        // Dispatch custom event for navigation
        const event = new CustomEvent('wiki-link-click', {
          detail: { target: node.attrs.target },
          bubbles: true,
        });
        dom.dispatchEvent(event);
      });
      return { dom };
    };
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/editor/extensions/wiki-link.ts
git commit -m "Add WikiLink TipTap extension"
```

---

### Task 8: Create extension bundle

**Files:**
- Create: `src/lib/editor/extensions/index.ts`

- [ ] **Step 1: Create the extension bundle factory**

```typescript
// src/lib/editor/extensions/index.ts
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { createLowlight, common } from 'lowlight';
import { WikiLink } from './wiki-link';

const lowlight = createLowlight(common);

export function createExtensions(options?: { placeholder?: string }) {
  return [
    StarterKit.configure({
      codeBlock: false,
    }),
    CodeBlockLowlight.configure({ lowlight }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({
      openOnClick: false,
      autolink: true,
    }),
    Image.configure({
      inline: false,
      allowBase64: false,
    }),
    Placeholder.configure({
      placeholder: options?.placeholder ?? 'Start writing...',
    }),
    WikiLink,
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/editor/extensions/index.ts
git commit -m "Add TipTap extension bundle"
```

---

### Task 9: Create editor styles

**Files:**
- Create: `src/lib/editor/styles/editor.css`

- [ ] **Step 1: Write editor content styles**

Full CSS using the design system tokens. See spec Section 10 for the complete token mapping. Key elements:

- `.ProseMirror` base: `--font-content`, `--text-base`, 1.7 line-height, 720px max-width, centered
- Headings: `--font-sans`, weight 600, sizes `--text-2xl` / `--text-xl` / `--text-lg`
- Code blocks: `--font-mono`, `--color-bg-surface` bg, 8px radius
- Inline code: `--font-mono`, 0.9em, `--color-bg-surface`, 4px radius
- Blockquotes: 2px left border `--color-border-strong`
- Task list checkboxes: accent-colored custom checkbox
- Links: `--color-accent`, underline on hover
- Wiki-links (`.wiki-link`): `--color-accent`, dotted underline, cursor pointer
- Selection: `--color-accent` at 20% opacity
- Placeholder (`.is-editor-empty:first-child::before`): `--color-text-muted`, italic
- `prefers-reduced-motion` media query

- [ ] **Step 2: Commit**

```bash
git add src/lib/editor/styles/editor.css
git commit -m "Add editor content styles"
```

---

### Task 10: Create SaveIndicator component

**Files:**
- Create: `src/lib/editor/SaveIndicator.svelte`

- [ ] **Step 1: Implement save indicator**

```svelte
<script lang="ts">
  let {
    status = 'saved',
  }: {
    status?: 'saved' | 'saving' | 'unsaved';
  } = $props();
</script>

<div class="save-indicator" class:save-indicator--unsaved={status === 'unsaved'} class:save-indicator--saving={status === 'saving'}>
  {#if status === 'saved'}
    <span class="save-indicator__dot save-indicator__dot--saved"></span>
    <span>Saved</span>
  {:else if status === 'saving'}
    <span class="save-indicator__dot save-indicator__dot--saving"></span>
    <span>Saving...</span>
  {:else}
    <span class="save-indicator__dot save-indicator__dot--unsaved"></span>
    <span>Unsaved</span>
  {/if}
</div>

<!-- styles: --font-mono, --text-xs, --color-text-muted, --duration-fast fade transitions -->
<!-- unsaved dot uses --color-accent, saving dot pulses -->
```

- [ ] **Step 2: Modify ContentHeader to accept trailing snippet**

In `src/lib/components/layout/ContentHeader.svelte`, add an optional `trailing` snippet prop and render it right-aligned inside the header bar.

- [ ] **Step 3: Commit**

```bash
git add src/lib/editor/SaveIndicator.svelte src/lib/components/layout/ContentHeader.svelte
git commit -m "Add save indicator and ContentHeader trailing slot"
```

---

### Task 11: Create EditorToolbar component

**Files:**
- Create: `src/lib/editor/EditorToolbar.svelte`

- [ ] **Step 1: Implement the toolbar**

The toolbar takes a TipTap `editor` instance as a prop and renders formatting buttons.

Props:
- `editor: Editor` (TipTap editor instance)

Each button calls the appropriate TipTap command (e.g., `editor.chain().focus().toggleBold().run()`) and uses `editor.isActive('bold')` for active state.

All buttons use `onmousedown` with `event.preventDefault()` to prevent stealing editor focus.

Link and Image buttons show a small inline popover with a text input for URL/path.

Styling per spec Section 6: 36px height, `--color-bg-surface`, `--font-mono --text-xs`, active buttons get `--color-accent`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/editor/EditorToolbar.svelte
git commit -m "Add editor formatting toolbar"
```

---

### Task 12: Create WikiLinkSuggest component

**Files:**
- Create: `src/lib/editor/WikiLinkSuggest.svelte`

- [ ] **Step 1: Implement wiki-link autocomplete**

Props:
- `query: string` — current text after `[[`
- `items: Array<{ path: string; name: string; title: string | null }>` — filtered file list
- `visible: boolean`
- `position: { top: number; left: number }` — anchor position
- `onselect: (target: string) => void`
- `onclose: () => void`

Behavior: filters items by query, keyboard navigation (ArrowDown/Up, Enter, Escape), click to select.

Styling per spec Section 7: 300px wide, `--color-bg-elevated`, `--shadow-elevated`, 8px radius.

- [ ] **Step 2: Commit**

```bash
git add src/lib/editor/WikiLinkSuggest.svelte
git commit -m "Add wiki-link autocomplete dropdown"
```

---

### Task 13: Create Editor component

**Files:**
- Create: `src/lib/editor/Editor.svelte`

- [ ] **Step 1: Implement the main editor component**

This is the central component. It:

1. Creates a TipTap `Editor` instance on mount with extensions from the bundle
2. Parses `initialContent` (Markdown string) to HTML via `parseMarkdown()` and sets it as content
3. Listens to TipTap's `onUpdate` to mark dirty and reset debounce timer
4. After 1s idle: serializes via `serializeMarkdown(editor.getJSON())`, computes SHA-256 hash, calls `writeFile()`, updates editor store
5. Listens for `wiki-link-click` custom events on the editor DOM for navigation
6. Exposes a `flush()` method so the parent can await a dirty save before switching files

Props:
- `path: string`
- `initialContent: string`
- `onnavigate: (path: string) => void`

Import `editor.css` styles. Mount TipTap into a container div.

SHA-256 in the browser: use the Web Crypto API (`crypto.subtle.digest('SHA-256', ...)`) and convert to hex.

- [ ] **Step 2: Commit**

```bash
git add src/lib/editor/Editor.svelte
git commit -m "Add TipTap editor component with auto-save"
```

---

## Chunk 3: Integration and Final Wiring

### Task 14: Integrate editor into +page.svelte

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Replace read-only viewer with Editor**

Replace the existing `file-view__markdown` section and `renderMarkdown` function with:

- Import `Editor` from `$lib/editor/Editor.svelte`
- Import `EditorToolbar` from `$lib/editor/EditorToolbar.svelte`
- Import `SaveIndicator` from `$lib/editor/SaveIndicator.svelte`
- Import `getEditorState` from `$lib/stores/editor.svelte`
- When active file is `.md`: show `EditorToolbar` + `Editor` instead of rendered HTML
- Pass `onnavigate` that resolves wiki-link targets to file paths by searching `files.fileMap` for matching `.md` file names
- When switching files: if editor is dirty, call `editor.flush()` before changing `activeFilePath`
- Remove the `renderMarkdown` and `escapeHtml` functions (no longer needed)
- Remove the `marked` import (already uninstalled)

- [ ] **Step 2: Add external change conflict handling**

In the existing `file:modified` event handler, add:
- If the modified path matches the active editor path:
  - If `editorState.isOwnSave(metadata.content_hash)`: ignore
  - If editor is not dirty: reload content silently
  - If editor is dirty: show an inline conflict notice

- [ ] **Step 3: Add `beforeunload` safety net**

Add a window `beforeunload` listener that fires a save if the editor is dirty (fire-and-forget).

- [ ] **Step 4: Verify the frontend compiles**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "Integrate TipTap editor into main page"
```

---

### Task 15: Run all tests and verify

**Files:** None (verification only)

- [ ] **Step 1: Run Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: All tests pass (20+)

- [ ] **Step 2: Run frontend tests**

Run: `npx vitest run`
Expected: All serializer tests pass

- [ ] **Step 3: Run frontend type check**

Run: `npm run check`
Expected: 0 errors, 0 warnings (or only non-blocking warnings)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "Sub-project 2 complete: TipTap WYSIWYG Markdown editor"
```
