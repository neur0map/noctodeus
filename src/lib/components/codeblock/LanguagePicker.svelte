<script lang="ts">
  import { SUPPORTED_LANGUAGES, type SupportedLanguage } from './types';

  let {
    onselect,
    onclose,
  }: {
    onselect: (lang: SupportedLanguage) => void;
    onclose: () => void;
  } = $props();

  $effect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') onclose();
    }
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="lang-picker">
  {#each SUPPORTED_LANGUAGES as lang}
    <button
      class="lang-picker__item"
      onclick={() => { onselect(lang.id); onclose(); }}
    >
      <span class="lang-picker__label">{lang.label}</span>
      <span class="lang-picker__ext">{lang.ext}</span>
    </button>
  {/each}
</div>

<style>
  .lang-picker {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    min-width: 140px;
    padding: 4px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle, #1E2336);
    background: var(--surface-2, #1A1E2E);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .lang-picker__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text-primary, #C0CAF5);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }

  .lang-picker__item:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .lang-picker__ext {
    color: var(--text-muted, #6B7394);
    font-family: var(--font-mono);
    font-size: 11px;
  }
</style>
