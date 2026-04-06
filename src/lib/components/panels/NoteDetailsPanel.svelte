<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import type { FileNode } from '../../types/core';
  import FileText from '@lucide/svelte/icons/file-text';
  import Clock from '@lucide/svelte/icons/clock';
  import LetterText from '@lucide/svelte/icons/letter-text';
  import BookOpen from '@lucide/svelte/icons/book-open';

  let {
    editor = null,
    fileNode = null,
  }: {
    editor?: Editor | null;
    fileNode?: FileNode | null;
  } = $props();

  let wordCount = $state(0);
  let charCount = $state(0);
  let readingTime = $state('0 min');
  let cleanup: (() => void) | null = null;

  function updateCounts(ed: Editor) {
    const text = ed.state.doc.textContent;
    charCount = text.replace(/\s/g, '').length;
    const words = text.split(/\s+/).filter(w => w.length > 0);
    wordCount = words.length;
    const minutes = Math.max(1, Math.ceil(wordCount / 200));
    readingTime = `${minutes} min`;
  }

  $effect(() => {
    cleanup?.();
    cleanup = null;
    if (!editor) { wordCount = 0; charCount = 0; readingTime = '0 min'; return; }
    updateCounts(editor);
    const handler = () => updateCounts(editor!);
    editor.on('update', handler);
    cleanup = () => editor!.off('update', handler);
  });

  function formatDate(unixSeconds: number | undefined): string {
    if (!unixSeconds) return '—';
    const d = new Date(unixSeconds * 1000);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(unixSeconds: number | undefined): string {
    if (!unixSeconds) return '';
    const d = new Date(unixSeconds * 1000);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
</script>

{#if editor && fileNode}
  <div class="note-details">
    <div class="note-details__header">
      <span class="note-details__label">Details</span>
    </div>

    <div class="note-details__grid">
      <div class="note-details__stat">
        <LetterText size={12} />
        <span class="note-details__value">{wordCount.toLocaleString()}</span>
        <span class="note-details__unit">words</span>
      </div>
      <div class="note-details__stat">
        <FileText size={12} />
        <span class="note-details__value">{charCount.toLocaleString()}</span>
        <span class="note-details__unit">chars</span>
      </div>
      <div class="note-details__stat">
        <BookOpen size={12} />
        <span class="note-details__value">{readingTime}</span>
        <span class="note-details__unit">read</span>
      </div>
      <div class="note-details__stat">
        <Clock size={12} />
        <span class="note-details__value">{formatDate(fileNode.modified_at)}</span>
        <span class="note-details__unit">{formatTime(fileNode.modified_at)}</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .note-details {
    padding: 0 12px 8px;
  }

  .note-details__header {
    padding: 8px 0 6px;
  }

  .note-details__label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .note-details__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .note-details__stat {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 6px;
    background: var(--color-hover);
    color: var(--color-muted-foreground);
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .note-details__value {
    font-weight: 600;
    color: var(--color-foreground);
  }

  .note-details__unit {
    color: var(--color-placeholder);
    font-size: 10px;
  }
</style>
