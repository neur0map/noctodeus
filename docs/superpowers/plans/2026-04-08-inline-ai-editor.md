# Inline AI Editor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Press Space on an empty line to open an inline AI prompt that generates content directly into the editor with accept/reject approval.

**Architecture:** A custom TipTap Node extension (`aiPrompt`) that replaces empty paragraphs with an inline prompt bar. The node manages three states (input → loading → preview) via a Svelte NodeView component. Content is generated server-side, parsed as markdown→HTML, and inserted into the document on approval.

**Tech Stack:** TipTap 3 (custom Node + NodeView), Svelte 5, existing `aiChat` bridge, `parseMarkdown` serializer

**Spec:** `docs/superpowers/specs/2026-04-08-inline-ai-editor-design.md`

---

## File Structure

### New files
- `src/lib/editor/extensions/ai-prompt.ts` — TipTap Node extension with Space trigger
- `src/lib/editor/AiPromptView.svelte` — NodeView component (input, loading, preview states)

### Modified files
- `src/lib/editor/extensions/index.ts` — register `aiPrompt` extension
- `src/lib/editor/Editor.svelte` — pass settings to extension context

---

## Chunk 1: The Extension + NodeView

### Task 1: Create the TipTap aiPrompt Node extension

**Files:**
- Create: `src/lib/editor/extensions/ai-prompt.ts`

- [ ] **Step 1: Write the extension**

```typescript
import { Node, mergeAttributes } from '@tiptap/core';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import AiPromptView from '../AiPromptView.svelte';

export interface AiPromptOptions {
  isConfigured: () => boolean;
}

export const AiPrompt = Node.create<AiPromptOptions>({
  name: 'aiPrompt',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      isConfigured: () => false,
    };
  },

  addAttributes() {
    return {
      prompt: { default: '' },
      state: { default: 'input' },    // 'input' | 'loading' | 'preview'
      generatedHtml: { default: '' }, // HTML from AI response
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-ai-prompt]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-ai-prompt': '' })];
  },

  addNodeView() {
    return SvelteNodeViewRenderer(AiPromptView);
  },

  addKeyboardShortcuts() {
    return {
      'Space': ({ editor }) => {
        // Only trigger on empty paragraphs
        const { $from } = editor.state.selection;
        const node = $from.parent;

        // Must be an empty paragraph
        if (node.type.name !== 'paragraph' || node.content.size > 0) {
          return false;
        }

        // Must have AI configured
        if (!this.options.isConfigured()) {
          return false;
        }

        // Only one aiPrompt at a time
        let hasExisting = false;
        editor.state.doc.descendants((n) => {
          if (n.type.name === 'aiPrompt') hasExisting = true;
        });
        if (hasExisting) return false;

        // Replace the empty paragraph with aiPrompt node
        const pos = $from.before();
        const end = $from.after();

        editor.chain()
          .focus()
          .deleteRange({ from: pos, to: end })
          .insertContentAt(pos, { type: 'aiPrompt', attrs: { state: 'input' } })
          .run();

        return true; // consume the Space
      },
    };
  },
});
```

**Note:** This uses `svelte-tiptap` for the NodeView renderer. Check if it's already a dependency — if not, we'll need to add it or use a vanilla JS NodeView adapter.

- [ ] **Step 2: Check if svelte-tiptap is available**

Run: `grep svelte-tiptap package.json`

If not present, we'll need an alternative approach for the NodeView. Options:
- Install `svelte-tiptap`
- Write a plain JS NodeView that creates a DOM container and mounts a Svelte component into it
- Use `addNodeView()` with a raw DOM renderer

The simplest approach if `svelte-tiptap` isn't present: create a vanilla NodeView that mounts a Svelte component:

```typescript
addNodeView() {
  return ({ node, getPos, editor }) => {
    const dom = document.createElement('div');
    dom.classList.add('ai-prompt-wrapper');

    // Mount Svelte component into dom
    const component = mount(AiPromptView, {
      target: dom,
      props: {
        node,
        getPos,
        editor,
        updateAttributes: (attrs) => {
          if (typeof getPos === 'function') {
            const pos = getPos();
            editor.view.dispatch(
              editor.view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                ...attrs,
              })
            );
          }
        },
      },
    });

    return {
      dom,
      destroy() { unmount(component); },
      update(updatedNode) {
        if (updatedNode.type.name !== 'aiPrompt') return false;
        // Svelte reactivity handles updates via props
        return true;
      },
    };
  };
},
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/editor/extensions/ai-prompt.ts
git commit -m "feat(inline-ai): add aiPrompt TipTap node extension with Space trigger"
```

---

### Task 2: Create the AiPromptView Svelte component

**Files:**
- Create: `src/lib/editor/AiPromptView.svelte`

This is the core visual component. Three states: input, loading, preview.

- [ ] **Step 1: Write the component**

The component receives `node`, `editor`, `getPos`, `updateAttributes` as props.

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Editor } from '@tiptap/core';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Check from '@lucide/svelte/icons/check';
  import Undo2 from '@lucide/svelte/icons/undo-2';

  let {
    node,
    editor,
    getPos,
    updateAttributes,
  }: {
    node: any;
    editor: Editor;
    getPos: () => number;
    updateAttributes: (attrs: Record<string, any>) => void;
  } = $props();

  let state = $derived(node.attrs.state as 'input' | 'loading' | 'preview');
  let generatedHtml = $derived(node.attrs.generatedHtml as string);

  let inputEl: HTMLInputElement | undefined = $state();
  let inputValue = $state('');
  let phraseIndex = $state(0);
  let visible = $state(false);
  let contentVisible = $state(false);
  let barVisible = $state(false);

  const PHRASES = [
    'Conjuring...',
    'The mind stirs...',
    'Weaving thoughts...',
    'From the depths...',
    'Nocturnal vision...',
  ];

  // Entrance animation
  onMount(() => {
    requestAnimationFrame(() => { visible = true; });
    if (state === 'input') {
      setTimeout(() => inputEl?.focus(), 50);
    }
  });

  // Cycle loading phrases
  $effect(() => {
    if (state !== 'loading') return;
    const interval = setInterval(() => {
      phraseIndex = (phraseIndex + 1) % PHRASES.length;
    }, 2000); // 400ms in + 1.2s hold + 400ms out = 2s
    return () => clearInterval(interval);
  });

  // Show content + bar when preview state is reached
  $effect(() => {
    if (state === 'preview') {
      setTimeout(() => { contentVisible = true; }, 150); // pause after loading fades
      setTimeout(() => { barVisible = true; }, 550); // 150 + 400 content fade
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      e.stopPropagation();
      sendPrompt();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  }

  async function sendPrompt() {
    const prompt = inputValue.trim();
    if (!prompt) return;

    updateAttributes({ state: 'loading', prompt });

    try {
      // Get current note context (~2000 chars around cursor)
      const fullContent = editor.getText();
      const cursorPos = getPos();
      const start = Math.max(0, cursorPos - 1000);
      const end = Math.min(fullContent.length, cursorPos + 1000);
      const context = fullContent.slice(start, end);

      // Get settings for AI provider
      const settings = JSON.parse(localStorage.getItem('noctodeus-settings') || '{}');
      const { aiChat } = await import('$lib/bridge/ai');

      // Build inline system prompt
      const systemPrompt = [
        'You are the inline editor for Noctodeus. You generate content that will be inserted directly into the user\'s note at their cursor position.',
        '',
        'Rules:',
        '- Output ONLY raw markdown. No greetings, no explanations, no "here you go".',
        '- Never wrap output in a code fence unless the user explicitly asks for code.',
        '- Match the tone and style of the surrounding note content when possible.',
        '- For tables: use standard markdown table syntax.',
        '- For lists: use - or 1. syntax.',
        '- For code: use fenced code blocks with language identifier.',
        '- For headings: match the heading level context (if inside an H2 section, start with H3).',
        '- Keep output focused and concise. Do not over-generate.',
        '',
        'Surrounding note content for context:',
        '---',
        context,
        '---',
      ].join('\n');

      // Fetch RAG context
      let ragCtx = '';
      try {
        const corePath = settings.lastCorePath || '';
        if (corePath) {
          const { ragContext } = await import('$lib/bridge/rag');
          ragCtx = await ragContext(prompt, corePath, 1000);
        }
      } catch {}

      const fullSystem = ragCtx
        ? systemPrompt + '\n\nRelevant notes from vault:\n' + ragCtx
        : systemPrompt;

      // Single-shot generation
      const response = await aiChat({
        provider: {
          id: settings.aiProviderId || 'custom',
          name: 'inline',
          baseUrl: settings.aiBaseUrl || '',
          apiKey: settings.aiApiKey || '',
          model: settings.aiModel || '',
        },
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: fullSystem,
      });

      // Parse markdown to HTML
      const { parseMarkdown } = await import('$lib/editor/serializer');
      const html = parseMarkdown(response);

      updateAttributes({ state: 'preview', generatedHtml: html });
    } catch (err: any) {
      // On error, show error in preview
      const errMsg = err?.message || err?.detail || String(err);
      updateAttributes({
        state: 'preview',
        generatedHtml: `<p style="color: var(--color-error, #f7768e);">Error: ${errMsg}</p>`,
      });
    }
  }

  function accept() {
    const pos = getPos();
    const nodeSize = node.nodeSize;
    const html = generatedHtml;

    // Delete the aiPrompt node and insert the generated HTML
    editor.chain()
      .focus()
      .deleteRange({ from: pos, to: pos + nodeSize })
      .insertContentAt(pos, html, { parseOptions: { preserveWhitespace: 'full' } })
      .run();
  }

  function cancel() {
    const pos = getPos();
    const nodeSize = node.nodeSize;

    // Delete aiPrompt, insert empty paragraph
    editor.chain()
      .focus()
      .deleteRange({ from: pos, to: pos + nodeSize })
      .insertContentAt(pos, { type: 'paragraph' })
      .run();
  }
</script>

<div
  class="aip"
  class:aip--visible={visible}
  class:aip--input={state === 'input'}
  class:aip--loading={state === 'loading'}
  class:aip--preview={state === 'preview'}
>
  {#if state === 'input'}
    <div class="aip__input-wrap">
      <Sparkles size={14} class="aip__icon" />
      <input
        bind:this={inputEl}
        bind:value={inputValue}
        class="aip__input"
        type="text"
        placeholder="Ask the nocturnal mind..."
        onkeydown={handleKeydown}
        onblur={() => { if (!inputValue.trim()) cancel(); }}
      />
    </div>

  {:else if state === 'loading'}
    <div class="aip__loading">
      <span class="aip__phrase" key={phraseIndex}>{PHRASES[phraseIndex]}</span>
    </div>

  {:else if state === 'preview'}
    <div class="aip__preview" class:aip__preview--visible={contentVisible}>
      <div class="aip__content">
        {@html generatedHtml}
      </div>
      <div class="aip__bar" class:aip__bar--visible={barVisible}>
        <span class="aip__bar-label">
          <Sparkles size={11} /> Noctodeus
        </span>
        <div class="aip__bar-actions">
          <button class="aip__bar-btn aip__bar-btn--accept" onclick={accept} title="Accept (Enter)">
            <Check size={13} />
          </button>
          <button class="aip__bar-btn aip__bar-btn--discard" onclick={cancel} title="Discard (Escape)">
            <Undo2 size={13} />
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .aip {
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 200ms ease-out, transform 200ms ease-out;
    &--visible { opacity: 1; transform: translateY(0); }
  }

  /* ── Input state ── */
  .aip__input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-background);
    transition: border-color 200ms;
    &:focus-within { border-color: var(--color-accent); }
  }

  .aip :global(.aip__icon) { color: var(--color-placeholder); flex-shrink: 0; }

  .aip__input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-family: var(--font-content, var(--font-sans));
    font-size: inherit;
    line-height: inherit;
    color: var(--color-foreground);
    &::placeholder { color: var(--color-placeholder); }
  }

  /* ── Loading state ── */
  .aip__loading {
    padding: 10px 14px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    text-align: center;
    animation: aip-pulse 3s ease-in-out infinite;
  }

  .aip__phrase {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-muted-foreground);
    letter-spacing: 0.02em;
    animation: aip-phrase-fade 2s ease infinite;
  }

  @keyframes aip-pulse {
    0%, 100% { border-color: var(--color-border); }
    50% { border-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-border)); }
  }

  @keyframes aip-phrase-fade {
    0% { opacity: 0; }
    20% { opacity: 1; }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }

  /* ── Preview state ── */
  .aip__preview {
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 400ms ease-out, transform 400ms ease-out;
    &--visible { opacity: 1; transform: translateY(0); }
  }

  .aip__content {
    padding-left: 12px;
    border-left: 2px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
    transition: border-color 300ms;
    .aip:hover & { border-color: color-mix(in srgb, var(--color-accent) 50%, transparent); }
  }

  .aip__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    margin-top: 8px;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 200ms ease-out, transform 200ms ease-out;
    &--visible { opacity: 1; transform: translateY(0); }
  }

  .aip__bar-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-placeholder);
  }

  .aip__bar-actions {
    display: flex;
    gap: 4px;
  }

  .aip__bar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 150ms, color 150ms;
  }

  .aip__bar-btn--accept {
    background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    color: var(--color-accent);
    &:hover { background: color-mix(in srgb, var(--color-accent) 25%, transparent); }
  }

  .aip__bar-btn--discard {
    background: transparent;
    color: var(--color-placeholder);
    &:hover { color: var(--color-foreground); background: var(--color-hover); }
  }

  @media (prefers-reduced-motion: reduce) {
    .aip, .aip__preview, .aip__bar, .aip__loading, .aip__phrase {
      animation: none;
      transition: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/editor/AiPromptView.svelte
git commit -m "feat(inline-ai): add AiPromptView with input, loading, and preview states"
```

---

### Task 3: Register the extension and wire into the editor

**Files:**
- Modify: `src/lib/editor/extensions/index.ts`
- Modify: `src/lib/editor/Editor.svelte`

- [ ] **Step 1: Register extension in index.ts**

Import and add to the extensions array:

```typescript
import { AiPrompt } from './ai-prompt.js';
```

In `createEditorExtensions`, add to the extensions array:

```typescript
AiPrompt.configure({
  isConfigured: () => {
    const settings = JSON.parse(localStorage.getItem('noctodeus-settings') || '{}');
    return !!(settings.aiApiKey && settings.aiBaseUrl && settings.aiModel);
  },
}),
```

- [ ] **Step 2: Handle keyboard shortcut for accept/discard in preview state**

In `AiPromptView.svelte`, add a global keydown listener when in preview state:

```typescript
$effect(() => {
  if (state !== 'preview' || !contentVisible) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); accept(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
});
```

- [ ] **Step 3: Build and verify**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/editor/extensions/index.ts src/lib/editor/extensions/ai-prompt.ts src/lib/editor/AiPromptView.svelte
git commit -m "feat(inline-ai): register extension, wire Space trigger, add keyboard shortcuts"
```

---

### Task 4: Manual testing

- [ ] **Step 1: Run the app**

Run: `npm run tauri dev`

- [ ] **Step 2: Test the trigger**

1. Open a note
2. Go to an empty line
3. Press Space
4. The prompt bar should appear with "Ask the nocturnal mind..."
5. Type "make a table of planets" and press Enter
6. Loading phrases should cycle
7. Content should appear with approval bar
8. Click checkmark or press Enter to accept
9. Content should merge into the document

- [ ] **Step 3: Test cancel**

1. Open prompt bar with Space
2. Press Escape — should disappear
3. Open again, type something, press Escape — should disappear

- [ ] **Step 4: Test non-trigger cases**

1. Type text on a line, then press Space — should type a space normally
2. With no AI configured, press Space on empty line — should type a space

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "milestone: inline AI editor complete"
```
