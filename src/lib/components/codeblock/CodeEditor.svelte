<script lang="ts">
  import type { SupportedLanguage } from './types';

  let {
    code,
    language,
    onchange,
    onrun,
  }: {
    code: string;
    language: SupportedLanguage;
    onchange: (code: string) => void;
    onrun: () => void;
  } = $props();
</script>

<div class="code-editor">
  <textarea
    value={code}
    oninput={(e) => onchange(e.currentTarget.value)}
    placeholder={`Write ${language} here...`}
  ></textarea>
</div>

<style>
  .code-editor {
    padding: 8px;
  }

  textarea {
    width: 100%;
    min-height: 60px;
    background: transparent;
    border: none;
    color: var(--text-primary, #c0caf5);
    font-family: var(--font-mono);
    font-size: 13px;
    resize: vertical;
    outline: none;
  }
</style>
