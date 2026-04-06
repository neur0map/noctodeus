<script lang="ts">
  import { nerdIcon } from '$lib/utils/nerd-icons';

  let {
    value = $bindable(''),
    placeholder = 'Search files...',
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

<div class="search-input">
  <span class="search-input__icon">{nerdIcon('search')}</span>
  {#if prefix}
    <span class="search-input__prefix">{prefix}</span>
  {/if}
  <input
    bind:this={inputEl}
    bind:value
    type="text"
    class="search-input__field"
    {placeholder}
    autocomplete="off"
    spellcheck="false"
  />
</div>

<style>
  .search-input {
    display: flex;
    align-items: center;
    padding: 0 16px;
    border-bottom: 1px solid var(--border-subtle, var(--color-border));
  }

  .search-input__icon {
    font-family: var(--font-mono);
    font-size: 16px;
    color: var(--text-muted, var(--color-placeholder));
    margin-right: 10px;
    flex-shrink: 0;
  }

  .search-input__prefix {
    font-family: var(--font-mono);
    font-size: 18px;
    line-height: 1.4;
    color: var(--color-placeholder);
    margin-right: 4px;
    user-select: none;
  }

  .search-input__field {
    flex: 1;
    padding: 16px 0;
    font-family: var(--font-mono);
    font-size: 18px;
    line-height: 1.4;
    color: var(--color-foreground);
    background: transparent;
    border: none;
    outline: none;
  }

  .search-input__field::placeholder {
    color: var(--color-placeholder);
  }
</style>
