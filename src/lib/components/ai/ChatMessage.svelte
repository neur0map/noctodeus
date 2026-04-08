<script lang="ts">
  import type { AiMessage } from '$lib/ai/types';
  import ClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
  import FileInput from '@lucide/svelte/icons/file-input';
  import ToolCallBlock from './ToolCallBlock.svelte';

  let {
    message,
    oninsert,
  }: {
    message: AiMessage;
    oninsert?: (content: string) => void;
  } = $props();

  let hovered = $state(false);

  let timeLabel = $derived(() => {
    if (!message.timestamp) return '';
    const d = new Date(message.timestamp);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  });

  let isUser = $derived(message.role === 'user');
  let isAssistant = $derived(message.role === 'assistant');
  let isTool = $derived(message.role === 'tool');

  let toolExpanded = $state(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      // fallback — ignore
    }
  }
</script>

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
        <pre class="cm__text cm__text--assistant">{message.content}{#if message.streaming}<span class="cm__cursor">&#x2588;</span>{/if}</pre>
      {:else}
        <pre class="cm__text cm__text--user">{message.content}</pre>
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
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
  }

  // ---- Shared text ----
  .cm__text {
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    padding: 0;
    background: transparent;
    border: none;
  }

  .cm__text--user {
    color: var(--color-foreground);
  }

  .cm__text--assistant {
    color: var(--color-muted-foreground);
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
