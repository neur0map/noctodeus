<script lang="ts">
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Square from '@lucide/svelte/icons/square';

  let {
    streaming = false,
    placeholder = 'Ask anything...',
    onsend,
    onstop,
  }: {
    streaming?: boolean;
    placeholder?: string;
    onsend: (text: string) => void;
    onstop: () => void;
  } = $props();

  let text = $state('');
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  /** Focus the textarea programmatically. */
  export function focus() {
    textareaEl?.focus();
  }

  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = '0';
    textareaEl.style.height = `${Math.min(textareaEl.scrollHeight, 22 * 8)}px`;
  }

  function send() {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    onsend(trimmed);
    text = '';
    if (textareaEl) textareaEl.style.height = '';
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      send();
    }
  }
</script>

<div class="ci">
  <textarea
    class="ci__textarea"
    bind:this={textareaEl}
    bind:value={text}
    oninput={autoResize}
    {onkeydown}
    {placeholder}
    rows="1"
  ></textarea>

  {#if streaming}
    <button class="ci__btn ci__btn--stop" onclick={onstop} title="Stop generating">
      <Square size={14} />
    </button>
  {:else}
    <button
      class="ci__btn ci__btn--send"
      class:ci__btn--hidden={!text.trim()}
      onclick={send}
      title="Send message"
    >
      <ArrowUp size={14} />
    </button>
  {/if}
</div>

<style lang="scss">
  .ci {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 12px 14px;
    border-top: 1px solid var(--color-border);
  }

  .ci__textarea {
    flex: 1;
    min-height: 22px;
    max-height: calc(22px * 8);
    padding: 10px 14px;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 22px;
    color: var(--color-foreground);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    outline: none;
    resize: none;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
    transition: border-color 150ms, box-shadow 150ms;

    &:focus {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 15%, transparent);
    }

    &::placeholder {
      color: var(--color-placeholder);
    }
  }

  .ci__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 150ms, color 150ms, opacity 150ms;
  }

  .ci__btn--send {
    background: var(--color-accent, #7AA2F7);
    color: #fff;
    &:hover { filter: brightness(1.1); }
  }

  .ci__btn--hidden {
    opacity: 0.15;
    pointer-events: none;
  }

  .ci__btn--stop {
    background: color-mix(in srgb, #f7768e 15%, transparent);
    color: #f7768e;
    &:hover { background: color-mix(in srgb, #f7768e 25%, transparent); }
  }
</style>
