<script lang="ts">
  import type { SupportedLanguage } from './types';
  import { createLowlight, common } from 'lowlight';
  import { toHtml } from 'hast-util-to-html';

  let {
    code,
    language,
    onchange,
    onrun,
  }: {
    code: string;
    language: SupportedLanguage;
    onchange: (code: string) => void;
    onrun: () => void;
  } = $props();

  const lowlight = createLowlight(common);

  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let editorEl: HTMLDivElement | undefined = $state();

  let lineCount = $derived(Math.max((code || '').split('\n').length, 1));

  // Map our language IDs to highlight.js language names
  const LANG_MAP: Record<SupportedLanguage, string> = {
    python: 'python',
    html: 'xml',
    css: 'css',
    js: 'javascript',
  };

  // Generate syntax-highlighted HTML from code
  let highlightedHtml = $derived.by(() => {
    const src = code || '';
    if (!src.trim()) return '';
    try {
      const hlLang = LANG_MAP[language] ?? 'plaintext';
      const tree = lowlight.highlight(hlLang, src);
      return toHtml(tree);
    } catch {
      // Fallback: escape HTML and return plain
      return src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!textareaEl) return;
      const start = textareaEl.selectionStart;
      const end = textareaEl.selectionEnd;
      const value = textareaEl.value;

      if (e.shiftKey) {
        const beforeCursor = value.substring(0, start);
        const lineStart = beforeCursor.lastIndexOf('\n') + 1;
        const lineContent = value.substring(lineStart);
        if (lineContent.startsWith('  ')) {
          const updated = value.substring(0, lineStart) + lineContent.substring(2);
          onchange(updated);
          requestAnimationFrame(() => {
            if (textareaEl) {
              textareaEl.selectionStart = Math.max(lineStart, start - 2);
              textareaEl.selectionEnd = Math.max(lineStart, end - 2);
            }
          });
        }
      } else {
        const updated = value.substring(0, start) + '  ' + value.substring(end);
        onchange(updated);
        requestAnimationFrame(() => {
          if (textareaEl) {
            textareaEl.selectionStart = start + 2;
            textareaEl.selectionEnd = start + 2;
          }
        });
      }
      return;
    }

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onrun();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      if (!textareaEl) return;
      const start = textareaEl.selectionStart;
      const value = textareaEl.value;
      const beforeCursor = value.substring(0, start);
      const lineStart = beforeCursor.lastIndexOf('\n') + 1;
      const currentLine = value.substring(lineStart, start);
      const indent = currentLine.match(/^(\s*)/)?.[1] ?? '';

      if (indent) {
        e.preventDefault();
        const updated = value.substring(0, start) + '\n' + indent + value.substring(textareaEl.selectionEnd);
        onchange(updated);
        const newPos = start + 1 + indent.length;
        requestAnimationFrame(() => {
          if (textareaEl) {
            textareaEl.selectionStart = newPos;
            textareaEl.selectionEnd = newPos;
          }
        });
      }
    }
  }

  function handleInput(e: Event) {
    const target = e.currentTarget as HTMLTextAreaElement;
    onchange(target.value);
  }

  // Sync scroll between textarea and highlight overlay
  function handleScroll() {
    if (textareaEl && editorEl) {
      const highlight = editorEl.querySelector('.ce__highlight') as HTMLElement;
      if (highlight) {
        highlight.scrollTop = textareaEl.scrollTop;
        highlight.scrollLeft = textareaEl.scrollLeft;
      }
    }
  }

  // Auto-resize
  $effect(() => {
    if (textareaEl) {
      void code;
      textareaEl.style.height = 'auto';
      textareaEl.style.height = textareaEl.scrollHeight + 'px';
    }
  });
</script>

<div class="ce" data-language={language} bind:this={editorEl}>
  <div class="ce__gutter">
    {#each { length: lineCount } as _, i}
      <div class="ce__line-num">{i + 1}</div>
    {/each}
  </div>
  <div class="ce__body">
    <!-- Highlighted code layer (behind textarea) -->
    <pre class="ce__highlight" aria-hidden="true"><code>{@html highlightedHtml || '&nbsp;'}</code></pre>
    <!-- Transparent textarea (user types here) -->
    <textarea
      bind:this={textareaEl}
      class="ce__input"
      value={code}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onscroll={handleScroll}
      spellcheck={false}
      autocapitalize="off"
      autocomplete="off"
      placeholder={`Write ${language} here...`}
    ></textarea>
  </div>
</div>

<style>
  .ce {
    display: flex;
    min-height: 60px;
    background: var(--surface-1, #13161f);
  }

  .ce__gutter {
    display: flex;
    flex-direction: column;
    padding: 10px 0;
    min-width: 36px;
    text-align: right;
    user-select: none;
    flex-shrink: 0;
  }

  .ce__line-num {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 20px;
    color: var(--text-faint, #3b4261);
    padding: 0 8px 0 0;
  }

  .ce__body {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  /* Shared text styles between highlight and textarea — MUST match exactly */
  .ce__highlight,
  .ce__input {
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 20px;
    tab-size: 2;
    white-space: pre;
    word-wrap: normal;
    padding: 10px 12px 10px 0;
    margin: 0;
  }

  /* Highlighted code (visual layer) */
  .ce__highlight {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    background: transparent;
    color: var(--text-primary, #c0caf5);
  }

  .ce__highlight code {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    background: none;
    padding: 0;
  }

  /* highlight.js token colors — Tokyo Night inspired */
  .ce__highlight :global(.hljs-keyword) { color: #bb9af7; }
  .ce__highlight :global(.hljs-built_in) { color: #7dcfff; }
  .ce__highlight :global(.hljs-type) { color: #7dcfff; }
  .ce__highlight :global(.hljs-literal) { color: #ff9e64; }
  .ce__highlight :global(.hljs-number) { color: #ff9e64; }
  .ce__highlight :global(.hljs-string) { color: #9ece6a; }
  .ce__highlight :global(.hljs-regexp) { color: #e0af68; }
  .ce__highlight :global(.hljs-symbol) { color: #7dcfff; }
  .ce__highlight :global(.hljs-variable) { color: #c0caf5; }
  .ce__highlight :global(.hljs-template-variable) { color: #7dcfff; }
  .ce__highlight :global(.hljs-link) { color: #7aa2f7; }
  .ce__highlight :global(.hljs-selector-class) { color: #7dcfff; }
  .ce__highlight :global(.hljs-selector-id) { color: #7aa2f7; }
  .ce__highlight :global(.hljs-selector-tag) { color: #f7768e; }
  .ce__highlight :global(.hljs-selector-pseudo) { color: #bb9af7; }
  .ce__highlight :global(.hljs-selector-attr) { color: #7dcfff; }
  .ce__highlight :global(.hljs-tag) { color: #f7768e; }
  .ce__highlight :global(.hljs-name) { color: #f7768e; }
  .ce__highlight :global(.hljs-attr) { color: #7dcfff; }
  .ce__highlight :global(.hljs-attribute) { color: #9ece6a; }
  .ce__highlight :global(.hljs-property) { color: #7aa2f7; }
  .ce__highlight :global(.hljs-params) { color: #c0caf5; }
  .ce__highlight :global(.hljs-comment) { color: #565f89; font-style: italic; }
  .ce__highlight :global(.hljs-doctag) { color: #565f89; }
  .ce__highlight :global(.hljs-meta) { color: #565f89; }
  .ce__highlight :global(.hljs-section) { color: #7aa2f7; }
  .ce__highlight :global(.hljs-title) { color: #7aa2f7; }
  .ce__highlight :global(.hljs-title.function_) { color: #7aa2f7; }
  .ce__highlight :global(.hljs-title.class_) { color: #e0af68; }
  .ce__highlight :global(.hljs-function) { color: #7aa2f7; }
  .ce__highlight :global(.hljs-deletion) { color: #f7768e; background: rgba(247, 118, 142, 0.1); }
  .ce__highlight :global(.hljs-addition) { color: #9ece6a; background: rgba(158, 206, 106, 0.1); }
  .ce__highlight :global(.hljs-operator) { color: #89ddff; }
  .ce__highlight :global(.hljs-punctuation) { color: #89ddff; }

  /* Textarea (input layer) — transparent text, visible caret */
  .ce__input {
    position: relative;
    z-index: 1;
    width: 100%;
    min-height: 60px;
    border: none;
    background: transparent;
    color: transparent;
    caret-color: var(--accent-blue, #7aa2f7);
    resize: none;
    outline: none;
    overflow: hidden;
    user-select: text;
    -webkit-user-select: text;
    -webkit-text-fill-color: transparent;
  }

  .ce__input::placeholder {
    color: var(--text-faint, #3b4261);
    -webkit-text-fill-color: var(--text-faint, #3b4261);
  }

  .ce__input::selection {
    background: rgba(122, 162, 247, 0.2);
    color: transparent;
    -webkit-text-fill-color: transparent;
  }
</style>
