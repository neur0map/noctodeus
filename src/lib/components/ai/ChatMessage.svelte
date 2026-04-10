<script lang="ts">
  import type { AiMessage } from '$lib/ai/types';
  import ClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
  import FileInput from '@lucide/svelte/icons/file-input';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ToolCallBlock from './ToolCallBlock.svelte';
  import { getFilesState } from '$lib/stores/files.svelte';
  import { getUiState } from '$lib/stores/ui.svelte';
  import { onDestroy } from 'svelte';
  import { mountReadonlyBlockNote } from './readonly-blocknote';

  let {
    message,
    oninsert,
    onopenfile,
  }: {
    message: AiMessage;
    oninsert?: (content: string) => void;
    onopenfile?: (path: string) => void;
  } = $props();

  const filesState = getFilesState();
  const ui = getUiState();

  interface TextSegment {
    kind: 'text' | 'link';
    text: string;
    path?: string;
  }

  /**
   * Parse text into segments, converting note references into clickable links.
   * Matches: [[wiki-link]], wiki-link.md, path/to/note.md
   */
  function parseWithLinks(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    // Match either [[...]] or a bare path ending in .md (with optional parens around it)
    const re = /\[\[([^\]]+)\]\]|\(?([a-zA-Z0-9_\-./]+\.md)\)?/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ kind: 'text', text: text.slice(lastIndex, match.index) });
      }
      const rawPath = match[1] ?? match[2] ?? '';
      const path = rawPath.replace(/\.(md|markdown)$/i, '');
      // Validate that this path actually exists in the vault
      const exists = Array.from(filesState.fileMap.values()).some((f) => {
        if (f.is_directory) return false;
        const nameNoExt = f.name.replace(/\.(md|markdown)$/i, '');
        const pathNoExt = f.path.replace(/\.(md|markdown)$/i, '');
        return nameNoExt === path || pathNoExt === path;
      });
      if (exists) {
        segments.push({ kind: 'link', text: match[0], path });
      } else {
        segments.push({ kind: 'text', text: match[0] });
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      segments.push({ kind: 'text', text: text.slice(lastIndex) });
    }

    return segments;
  }

  function handleFileClick(path: string) {
    if (onopenfile) {
      onopenfile(path);
    } else {
      // Close the chat and open the file — dispatch a custom event the layout can catch
      const event = new CustomEvent('wiki-link-click', {
        bubbles: true,
        detail: { target: path },
      });
      window.dispatchEvent(event);
      ui.hideAiChat();
    }
  }

  let hovered = $state(false);
  let thinkingExpanded = $state(false);

  let timeLabel = $derived(() => {
    if (!message.timestamp) return '';
    const d = new Date(message.timestamp);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  });

  let isUser = $derived(message.role === 'user');
  let isAssistant = $derived(message.role === 'assistant');
  let isTool = $derived(message.role === 'tool');

  let toolExpanded = $state(false);

  /**
   * Strip AI internals (tool calls, thinking, reasoning blocks) from a
   * raw message so they don't leak into the rendered view.
   */
  function cleanContent(raw: string): string {
    return raw
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extract hidden AI internals (tool calls, thinking blocks) from
   * the visible content, so they can be shown collapsed instead of
   * polluting the chat view.
   */
  function processMessage(raw: string): { clean: string; hidden: string[] } {
    const hidden: string[] = [];
    let clean = raw;

    clean = clean.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, (match) => {
      hidden.push(match);
      return '';
    });

    clean = clean.replace(/<think>[\s\S]*?<\/think>/g, (match) => {
      hidden.push(match);
      return '';
    });

    clean = clean.replace(/<thinking>[\s\S]*?<\/thinking>/g, (match) => {
      hidden.push(match);
      return '';
    });

    clean = clean.replace(/<reasoning>[\s\S]*?<\/reasoning>/g, (match) => {
      hidden.push(match);
      return '';
    });

    clean = clean.replace(/\n{3,}/g, '\n\n').trim();
    return { clean, hidden };
  }

  let processed = $derived(processMessage(message.content ?? ''));
  let visible = $derived(cleanContent(message.content ?? ''));

  // Read-only BlockNote mount target + cleanup handle for assistant msgs
  let renderEl: HTMLDivElement | undefined = $state();
  let unmount: (() => void) | undefined;

  $effect(() => {
    // Re-mount whenever the visible content changes.
    const el = renderEl;
    const content = visible;
    if (!el || !isAssistant) return;
    if (unmount) {
      try { unmount(); } catch {}
      unmount = undefined;
    }
    let cancelled = false;
    mountReadonlyBlockNote(el, content).then((fn) => {
      if (cancelled) {
        try { fn(); } catch {}
        return;
      }
      unmount = fn;
    });
    return () => {
      cancelled = true;
    };
  });

  onDestroy(() => {
    try { unmount?.(); } catch {}
  });

  /**
   * Should this message render at all?
   * Skip assistant messages that are ONLY tool calls (no visible text).
   * The tool group card already shows what tools were used — no need
   * for a redundant empty "Thinking" bubble.
   */
  let shouldRender = $derived(() => {
    if (message.role !== 'assistant') return true;
    if (message.streaming) return true;
    // Only render if there's actual text content
    return !!processed.clean;
  });

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(processed.clean);
    } catch {
      // fallback — ignore
    }
  }
</script>

{#if shouldRender()}
<div
  class="cm"
  class:cm--user={isUser}
  class:cm--assistant={isAssistant}
  class:cm--tool={isTool}
  class:cm--streaming={message.streaming}
  role="listitem"
  onmouseenter={() => hovered = true}
  onmouseleave={() => hovered = false}
>
  {#if isTool && message.toolCalls}
    {@const tc = message.toolCalls as { name: string; arguments: any; loading?: boolean; error?: string | null; result?: string | null }}
    <ToolCallBlock
      toolName={tc.name}
      arguments={tc.arguments}
      result={tc.result ?? (tc.loading || tc.error ? null : message.content || null)}
      loading={tc.loading ?? false}
      error={tc.error ?? null}
    />
  {:else if isTool}
    <button class="cm__tool-header" onclick={() => toolExpanded = !toolExpanded}>
      <span class="cm__tool-label">tool</span>
      <span class="cm__tool-name">{message.toolCallId ?? 'call'}</span>
      <span class="cm__tool-chevron" class:cm__tool-chevron--open={toolExpanded}>
        &#x25B8;
      </span>
    </button>
    {#if toolExpanded}
      <pre class="cm__tool-body">{message.content}</pre>
    {/if}
  {:else}
    <div class="cm__content">
      {#if isAssistant}
        {#if processed.hidden.length > 0}
          <button
            class="cm__thinking"
            class:cm__thinking--open={thinkingExpanded}
            onclick={() => (thinkingExpanded = !thinkingExpanded)}
          >
            <ChevronRight size={11} />
            <span class="cm__thinking-label">Thinking</span>
            <span class="cm__thinking-count">{processed.hidden.length}</span>
          </button>
          {#if thinkingExpanded}
            <pre class="cm__thinking-body">{processed.hidden.join('\n\n')}</pre>
          {/if}
        {/if}
        {#if visible || (message.streaming && !processed.hidden.length)}
          <div class="msg__bn" bind:this={renderEl}></div>
          {#if message.streaming}<span class="cm__cursor">&#x2588;</span>{/if}
        {/if}
      {:else}
        <div class="cm__text cm__text--user">{message.content}</div>
      {/if}
    </div>
  {/if}

  <div class="cm__meta">
    <span class="cm__time">{timeLabel()}</span>
    {#if isAssistant && hovered && !message.streaming}
      <div class="cm__actions">
        <button class="cm__action" onclick={copyToClipboard} title="Copy">
          <ClipboardCopy size={12} />
        </button>
        {#if oninsert}
          <button class="cm__action" onclick={() => oninsert?.(message.content)} title="Insert into note">
            <FileInput size={12} />
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>
{/if}

<style lang="scss">
  .cm {
    padding: 10px 16px 6px;
    animation: cm-in 200ms ease both;
    position: relative;
  }

  @keyframes cm-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  // ---- User ----
  .cm--user {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .cm--user .cm__content {
    max-width: 85%;
    border-left: 2px solid rgba(122, 162, 247, 0.35);
    padding-left: 12px;
  }

  // ---- Assistant ----
  .cm--assistant {
    background: var(--color-hover);
    border-radius: 6px;
    margin: 2px 0;
  }

  // ---- Tool ----
  .cm--tool {
    margin: 4px 0;
  }

  .cm__tool-header {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--color-hover);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
    width: 100%;
    text-align: left;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-muted-foreground);
    transition: background 150ms;

    &:hover {
      background: var(--color-hover);
    }
  }

  .cm__tool-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-placeholder);
    background: var(--color-hover);
    padding: 1px 5px;
    border-radius: 3px;
  }

  .cm__tool-name {
    color: var(--color-accent, #7AA2F7);
  }

  .cm__tool-chevron {
    margin-left: auto;
    transition: transform 150ms;
    font-size: 10px;
  }

  .cm__tool-chevron--open {
    transform: rotate(90deg);
  }

  .cm__tool-body {
    margin: 4px 0 0;
    padding: 8px 10px;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.5;
    color: var(--color-muted-foreground);
    background: var(--color-hover);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
  }

  // ---- Thinking disclosure (hidden tool_call / think blocks) ----
  .cm__thinking {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 9px 4px 6px;
    margin-bottom: 6px;
    border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    background: transparent;
    border-radius: 999px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted-foreground);
    transition: color 120ms, background 120ms, border-color 120ms;
  }

  .cm__thinking:hover {
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 5%, transparent);
    border-color: color-mix(in srgb, var(--foreground) 16%, transparent);
  }

  .cm__thinking :global(svg) {
    transition: transform 150ms ease;
    flex-shrink: 0;
  }

  .cm__thinking--open :global(svg) {
    transform: rotate(90deg);
  }

  .cm__thinking-count {
    padding: 1px 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    font-size: 9px;
    min-width: 14px;
    text-align: center;
  }

  .cm__thinking-body {
    margin: 0 0 8px;
    padding: 10px 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.5;
    color: var(--muted-foreground);
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius: 8px;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
    max-height: 200px;
    overflow-y: auto;
  }

  // ---- Assistant BlockNote read-only view ----
  .msg__bn :global(.bn-editor) {
    padding: 0 !important;
    min-height: auto !important;
  }
  .msg__bn :global(.bn-container) {
    min-height: auto !important;
  }

  // ---- Shared text ----
  .cm__text {
    font-family: var(--font-content);
    font-size: 14px;
    line-height: 1.6;
    letter-spacing: -0.005em;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    margin: 0;
    padding: 0;
    background: transparent;
    border: none;
  }

  .cm__text--user {
    color: var(--foreground);
  }

  .cm__text--assistant {
    color: var(--foreground);
  }

  // ---- Clickable file references ----
  .cm__link {
    display: inline;
    padding: 0;
    margin: 0;
    border: none;
    background: transparent;
    color: var(--accent-blue, var(--color-accent, #7aa2f7));
    font: inherit;
    cursor: pointer;
    text-decoration: none;
    border-bottom: 1px dashed color-mix(in srgb, var(--accent-blue, #7aa2f7) 40%, transparent);
    transition: opacity 100ms, border-bottom-style 100ms;
  }

  .cm__link:hover {
    opacity: 0.85;
    border-bottom-style: solid;
  }

  // ---- Streaming cursor ----
  .cm__cursor {
    color: var(--color-accent, #7AA2F7);
    animation: cm-blink 1s step-end infinite;
    font-weight: 400;
  }

  @keyframes cm-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  // ---- Meta row ----
  .cm__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    min-height: 18px;
  }

  .cm__time {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    letter-spacing: 0.01em;
  }

  .cm__actions {
    display: flex;
    gap: 2px;
    animation: cm-in 150ms ease both;
  }

  .cm__action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    transition: color 150ms, background 150ms;

    &:hover {
      color: var(--color-foreground);
      background: var(--color-hover);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cm { animation: none; }
    .cm__cursor { animation: none; opacity: 1; }
    .cm__actions { animation: none; }
  }
</style>
