<script lang="ts">
  import { SUPPORTED_LANGUAGES, type SupportedLanguage } from './types';

  let {
    onselect,
    onclose,
  }: {
    onselect: (lang: SupportedLanguage) => void;
    onclose: () => void;
  } = $props();
</script>

<div class="lang-picker">
  {#each SUPPORTED_LANGUAGES as lang}
    <button
      class="lang-picker__item"
      onclick={(e) => { e.preventDefault(); e.stopPropagation(); onselect(lang.id); onclose(); }}
      onmousedown={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <span class="lang-picker__label">{lang.label}</span>
      <span class="lang-picker__ext">{lang.ext}</span>
    </button>
  {/each}
</div>

<style>
  .lang-picker {
    display: flex;
    flex-direction: column;
    min-width: 140px;
    padding: 4px;
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
