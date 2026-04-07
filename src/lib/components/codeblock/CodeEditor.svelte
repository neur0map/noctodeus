<script lang="ts">
  import type { SupportedLanguage } from './types';

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

  let textareaEl: HTMLTextAreaElement | undefined = $state();

  let lineCount = $derived(Math.max((code || '').split('\n').length, 1));

  function handleKeydown(e: KeyboardEvent) {
    // Tab inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!textareaEl) return;

      const start = textareaEl.selectionStart;
      const end = textareaEl.selectionEnd;
      const value = textareaEl.value;

      if (e.shiftKey) {
        // Shift+Tab: dedent current line(s)
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

    // Cmd/Ctrl+Enter runs
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onrun();
      return;
    }

    // Enter: auto-indent — maintain indentation of current line
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

  // Auto-resize textarea height
  $effect(() => {
    if (textareaEl) {
      // Access code to make this effect reactive to content changes
      void code;
      textareaEl.style.height = 'auto';
      textareaEl.style.height = textareaEl.scrollHeight + 'px';
    }
  });
</script>

<div class="code-editor" data-language={language}>
  <div class="code-editor__gutter">
    {#each { length: lineCount } as _, i}
      <div class="code-editor__line-number">{i + 1}</div>
    {/each}
  </div>
  <textarea
    bind:this={textareaEl}
    class="code-editor__textarea"
    value={code}
    oninput={handleInput}
    onkeydown={handleKeydown}
    spellcheck={false}
    autocapitalize="off"
    placeholder={`Write ${language} here...`}
  ></textarea>
</div>

<style>
  .code-editor {
    display: flex;
    min-height: 60px;
    background: var(--surface-1, #13161f);
  }

  .code-editor__gutter {
    display: flex;
    flex-direction: column;
    padding: 10px 0;
    min-width: 36px;
    text-align: right;
    user-select: none;
    flex-shrink: 0;
  }

  .code-editor__line-number {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 20px;
    color: var(--text-faint, #3b4261);
    padding: 0 8px 0 0;
  }

  .code-editor__textarea {
    flex: 1;
    margin: 0;
    padding: 10px 12px 10px 0;
    border: none;
    background: transparent;
    color: var(--text-primary, #c0caf5);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 20px;
    tab-size: 2;
    resize: none;
    outline: none;
    overflow: hidden;
    white-space: pre;
    min-height: 60px;
    user-select: text;
    -webkit-user-select: text;
  }

  .code-editor__textarea::placeholder {
    color: var(--text-faint, #3b4261);
  }
</style>
