<script lang="ts">
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Square from '@lucide/svelte/icons/square';

  let {
    streaming = false,
    onsend,
    onstop,
  }: {
    streaming?: boolean;
    onsend: (text: string) => void;
    onstop: () => void;
  } = $props();

  let text = $state('');
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  let hasText = $derived(text.trim().length > 0);

  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    const maxHeight = 6 * 22; // ~6 lines at ~22px line-height
    textareaEl.style.height = `${Math.min(textareaEl.scrollHeight, maxHeight)}px`;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function send() {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    onsend(trimmed);
    text = '';
    if (textareaEl) {
      textareaEl.style.height = 'auto';
    }
  }

  export function focus() {
    textareaEl?.focus();
  }
</script>

<div class="ci" class:ci--focus={false}>
  <textarea
    class="ci__textarea"
    bind:this={textareaEl}
    bind:value={text}
    oninput={autoResize}
    onkeydown={handleKeydown}
    placeholder="Ask anything..."
    rows="1"
  ></textarea>

  {#if streaming}
    <button class="ci__btn ci__btn--stop" onclick={onstop} title="Stop generating">
      <Square size={14} />
    </button>
  {:else if hasText}
    <button class="ci__btn ci__btn--send" onclick={send} title="Send message">
      <ArrowUp size={14} />
    </button>
  {/if}
</div>

<style lang="scss">
  .ci {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    padding: 10px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    background: rgba(0, 0, 0, 0.15);
  }

  .ci__textarea {
    flex: 1;
    min-height: 22px;
    max-height: calc(22px * 6);
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 22px;
    color: var(--color-foreground);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    outline: none;
    resize: none;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
    transition: border-color 150ms;

    &:focus {
      border-color: rgba(122, 162, 247, 0.4);
      box-shadow: 0 0 0 1px rgba(122, 162, 247, 0.08);
    }

    &::placeholder {
      color: rgba(255, 255, 255, 0.18);
    }
  }

  .ci__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 150ms, color 150ms, transform 100ms;
    animation: ci-pop 150ms ease both;

    &:active {
      transform: scale(0.92);
    }
  }

  .ci__btn--send {
    background: var(--color-accent, #7AA2F7);
    color: #fff;

    &:hover {
      filter: brightness(1.15);
    }
  }

  .ci__btn--stop {
    background: rgba(247, 118, 142, 0.15);
    color: #f7768e;

    &:hover {
      background: rgba(247, 118, 142, 0.25);
    }
  }

  @keyframes ci-pop {
    from { opacity: 0; transform: scale(0.85); }
    to { opacity: 1; transform: scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .ci__btn { animation: none; }
  }
</style>
