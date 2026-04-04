<script lang="ts">
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
    padding: 0 var(--space-4);
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .search-input__prefix {
    font-family: var(--font-mono);
    font-size: var(--text-lg);
    line-height: var(--text-lg-leading);
    color: var(--color-text-muted);
    margin-right: var(--space-1);
    user-select: none;
  }

  .search-input__field {
    flex: 1;
    padding: var(--space-4) 0;
    font-family: var(--font-mono);
    font-size: var(--text-lg);
    line-height: var(--text-lg-leading);
    color: var(--color-text-primary);
    background: transparent;
    border: none;
    outline: none;
  }

  .search-input__field::placeholder {
    color: var(--color-text-muted);
  }
</style>
