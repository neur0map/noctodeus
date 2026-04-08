<script lang="ts">
  import { getSettings } from '$lib/stores/settings.svelte';
  import Import from '@lucide/svelte/icons/import';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import FileText from '@lucide/svelte/icons/file-text';
  import Apple from '@lucide/svelte/icons/apple';
  import BookOpen from '@lucide/svelte/icons/book-open';

  let { settings }: { settings: ReturnType<typeof getSettings> } = $props();

  function openImportWizard(source: string) {
    window.dispatchEvent(new CustomEvent(`noctodeus-import-${source}`));
  }
</script>

<div class="settings__section">
  <div class="imp__grid">
    <button class="imp__card" onclick={() => openImportWizard('obsidian')}>
      <div class="imp__card-icon imp__card-icon--obsidian">
        <BookOpen size={20} />
      </div>
      <div class="imp__card-info">
        <span class="imp__card-title">Obsidian</span>
        <span class="imp__card-desc">Import an entire vault. Wiki-links, frontmatter, and media transfer seamlessly.</span>
      </div>
      <span class="imp__card-badge">Ready</span>
    </button>

    <button class="imp__card imp__card--disabled" disabled>
      <div class="imp__card-icon imp__card-icon--apple">
        <Apple size={20} />
      </div>
      <div class="imp__card-info">
        <span class="imp__card-title">Apple Notes</span>
        <span class="imp__card-desc">Import from iCloud Notes via AppleScript. macOS only.</span>
      </div>
      <span class="imp__card-badge imp__card-badge--soon">Soon</span>
    </button>

    <button class="imp__card imp__card--disabled" disabled>
      <div class="imp__card-icon imp__card-icon--logseq">
        <BookOpen size={20} />
      </div>
      <div class="imp__card-info">
        <span class="imp__card-title">Logseq</span>
        <span class="imp__card-desc">Import journals and pages from a Logseq graph.</span>
      </div>
      <span class="imp__card-badge imp__card-badge--soon">Soon</span>
    </button>

    <button class="imp__card" onclick={() => openImportWizard('obsidian')}>
      <div class="imp__card-icon">
        <FolderOpen size={20} />
      </div>
      <div class="imp__card-info">
        <span class="imp__card-title">Markdown folder</span>
        <span class="imp__card-desc">Import any folder of .md files as a new core.</span>
      </div>
      <span class="imp__card-badge">Ready</span>
    </button>
  </div>
</div>

<style lang="scss">
  .imp__grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .imp__card {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    transition: all 150ms ease-out;

    &:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.1);
    }
  }

  .imp__card--disabled {
    opacity: 0.45;
    cursor: default;
    &:hover {
      background: rgba(255, 255, 255, 0.02);
      border-color: rgba(255, 255, 255, 0.06);
    }
  }

  .imp__card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-muted-foreground);
    flex-shrink: 0;
  }

  .imp__card-icon--obsidian {
    background: rgba(124, 77, 255, 0.1);
    color: #7C4DFF;
  }

  .imp__card-icon--apple {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-muted-foreground);
  }

  .imp__card-icon--logseq {
    background: rgba(133, 199, 86, 0.1);
    color: #85C756;
  }

  .imp__card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .imp__card-title {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-foreground);
  }

  .imp__card-desc {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--color-placeholder);
    line-height: 1.4;
  }

  .imp__card-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-accent, #7AA2F7);
    background: rgba(122, 162, 247, 0.1);
    padding: 3px 8px;
    border-radius: 4px;
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .imp__card-badge--soon {
    color: var(--color-placeholder);
    background: rgba(255, 255, 255, 0.04);
  }
</style>
