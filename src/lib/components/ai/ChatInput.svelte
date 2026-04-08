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
    placeholder="Ask anything..."
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
    transition: background 150ms, color 150ms, opacity 150ms;
  }

  .ci__btn--send {
    background: var(--color-accent, #7AA2F7);
    color: #fff;
    &:hover { filter: brightness(1.15); }
  }

  .ci__btn--hidden {
    opacity: 0.2;
    pointer-events: none;
  }

  .ci__btn--stop {
    background: rgba(247, 118, 142, 0.15);
    color: #f7768e;
    &:hover { background: rgba(247, 118, 142, 0.25); }
  }
</style>
