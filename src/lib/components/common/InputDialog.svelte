<script lang="ts">
  let {
    visible = false,
    title = '',
    value = '',
    placeholder = '',
    onsubmit,
    oncancel,
  }: {
    visible: boolean;
    title: string;
    value: string;
    placeholder?: string;
    onsubmit: (value: string) => void;
    oncancel: () => void;
  } = $props();

  let inputEl: HTMLInputElement | undefined = $state();
  let inputValue = $state(value);

  $effect(() => {
    if (visible) {
      inputValue = value;
      requestAnimationFrame(() => {
        inputEl?.focus();
        inputEl?.select();
      });
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) onsubmit(inputValue.trim());
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      oncancel();
    }
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="id-backdrop" onclick={oncancel}></div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="id" onkeydown={handleKeydown}>
    <div class="id__title">{title}</div>
    <input
      class="id__input"
      type="text"
      bind:this={inputEl}
      bind:value={inputValue}
      {placeholder}
    />
    <div class="id__actions">
      <button class="id__btn id__btn--cancel" onclick={oncancel}>Cancel</button>
      <button class="id__btn id__btn--ok" onclick={() => { if (inputValue.trim()) onsubmit(inputValue.trim()); }} disabled={!inputValue.trim()}>
        OK
      </button>
    </div>
  </div>
{/if}

<style>
  .id-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    z-index: 399;
    animation: id-backdrop-in 300ms ease both;
  }

  @keyframes id-backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .id {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 400;
    width: 320px;
    background: var(--color-popover);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: var(--shadow-float);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: id-in 450ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes id-in {
    from { opacity: 0; transform: translate(-50%, -48%) scale(0.95); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  .id__title {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-foreground);
  }

  .id__input {
    width: 100%;
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-foreground);
    background: var(--color-hover);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    outline: none;
  }

  .id__input:focus {
    border-color: var(--color-accent);
  }

  .id__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .id__btn {
    padding: 6px 14px;
    font-family: var(--font-sans);
    font-size: 13px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .id__btn--cancel {
    background: transparent;
    color: var(--color-placeholder);
  }

  .id__btn--cancel:hover {
    color: var(--color-foreground);
  }

  .id__btn--ok {
    background: var(--color-accent);
    color: #fff;
  }

  .id__btn--ok:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .id-backdrop,
    .id { animation: none; }
  }
</style>
