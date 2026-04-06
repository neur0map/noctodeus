<script lang="ts">
  import Search from '@lucide/svelte/icons/search';

  let {
    value = $bindable(''),
    placeholder = 'Search files and content...',
    prefix = '',
  }: {
    value?: string;
    placeholder?: string;
    prefix?: string;
  } = $props();

  let inputEl: HTMLInputElement | undefined = $state();

  $effect(() => {
    inputEl?.focus();
  });
</script>

<div class="si">
  {#if prefix}
    <span class="si__prefix">{prefix}</span>
  {:else}
    <Search size={18} class="si__icon" />
  {/if}
  <input
    bind:this={inputEl}
    bind:value
    type="text"
    class="si__input"
    {placeholder}
    autocomplete="off"
    spellcheck="false"
  />
  {#if value}
    <button class="si__clear" onclick={() => value = ''} aria-label="Clear search">×</button>
  {/if}
</div>

<style>
  .si {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .si :global(.si__icon) {
    color: var(--accent-blue, #7AA2F7);
    flex-shrink: 0;
    opacity: 0.6;
  }

  .si__input {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 16px;
    font-weight: 400;
    letter-spacing: -0.01em;
    line-height: 1.4;
    color: var(--text-primary, #C0CAF5);
    background: transparent;
    border: none;
    outline: none;
    caret-color: var(--accent-blue, #7AA2F7);
  }

  .si__input::placeholder {
    color: var(--text-faint, #3B4261);
  }

  .si__clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-muted, #6B7394);
    font-size: 14px;
    cursor: pointer;
    transition: background 150ms ease-out, color 150ms ease-out;
    flex-shrink: 0;
  }

  .si__clear:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary, #C0CAF5);
  }

  .si__prefix {
    font-family: var(--font-mono);
    font-size: 18px;
    color: var(--accent-blue, #7AA2F7);
    opacity: 0.7;
    user-select: none;
    flex-shrink: 0;
  }
</style>
