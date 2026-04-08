<script lang="ts">
  import { getSettings } from '../../stores/settings.svelte';
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import PencilLine from "@lucide/svelte/icons/pencil-line";
  import Palette from "@lucide/svelte/icons/palette";
  import FileText from "@lucide/svelte/icons/file-text";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import X from "@lucide/svelte/icons/x";

  import SettingsGeneral from './settings/SettingsGeneral.svelte';
  import SettingsEditor from './settings/SettingsEditor.svelte';
  import SettingsAppearance from './settings/SettingsAppearance.svelte';
  import SettingsFiles from './settings/SettingsFiles.svelte';
  import SettingsHotkeys from './settings/SettingsHotkeys.svelte';
  import SettingsSync from './settings/SettingsSync.svelte';
  import SettingsImport from './settings/SettingsImport.svelte';
  import Download from "@lucide/svelte/icons/download";

  let {
    visible = false,
    onclose,
  }: {
    visible: boolean;
    onclose: () => void;
  } = $props();

  const settings = getSettings();

  type Section = 'general' | 'editor' | 'appearance' | 'files' | 'hotkeys' | 'sync' | 'import';

  let activeSection = $state<Section>('general');

  const sections: { id: Section; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'editor', label: 'Editor' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'files', label: 'Files & Links' },
    { id: 'hotkeys', label: 'Hotkeys' },
    { id: 'sync', label: 'Sync' },
    { id: 'import', label: 'Import' },
  ];

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onclose();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="settings-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="settings" onkeydown={handleKeydown}>
      <!-- Sidebar nav -->
      <nav class="settings__nav">
        <div class="settings__nav-group">
          <span class="settings__nav-heading">Options</span>
          {#each sections as section}
            <button
              class="settings__nav-item"
              class:settings__nav-item--active={activeSection === section.id}
              onclick={() => activeSection = section.id}
            >
              <span class="settings__nav-icon">
                {#if section.id === 'general'}<SettingsIcon size={14} />
                {:else if section.id === 'editor'}<PencilLine size={14} />
                {:else if section.id === 'appearance'}<Palette size={14} />
                {:else if section.id === 'files'}<FileText size={14} />
                {:else if section.id === 'hotkeys'}<Keyboard size={14} />
                {:else if section.id === 'sync'}<RefreshCw size={14} />
                {:else if section.id === 'import'}<Download size={14} />
                {/if}
              </span>
              <span>{section.label}</span>
            </button>
          {/each}
        </div>
      </nav>

      <!-- Content pane -->
      <div class="settings__content">
        <div class="settings__content-header">
          <h2 class="settings__title">
            {sections.find(s => s.id === activeSection)?.label}
          </h2>
          <button class="settings__close" onclick={onclose} title="Close"><X size={14} /></button>
        </div>

        <div class="settings__body">
          {#if activeSection === 'general'}
            <SettingsGeneral {settings} />
          {:else if activeSection === 'editor'}
            <SettingsEditor {settings} />
          {:else if activeSection === 'appearance'}
            <SettingsAppearance {settings} />
          {:else if activeSection === 'files'}
            <SettingsFiles {settings} />
          {:else if activeSection === 'hotkeys'}
            <SettingsHotkeys {settings} />
          {:else if activeSection === 'sync'}
            <SettingsSync {settings} />
          {:else if activeSection === 'import'}
            <SettingsImport {settings} />
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .settings-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: backdrop-in 300ms ease both;
  }

  @keyframes backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .settings {
    display: flex;
    width: min(860px, 90vw);
    height: min(580px, 80vh);
    background: var(--surface-2, var(--color-popover));
    border: none;
    border-radius: 14px;
    box-shadow: var(--shadow-modal, 0 8px 32px rgba(0,0,0,0.4));
    overflow: hidden;
    animation: settings-in 450ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes settings-in {
    from { opacity: 0; transform: scale(0.95) translateY(8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  /* ── Nav sidebar ── */
  .settings__nav {
    width: 200px;
    flex-shrink: 0;
    padding: 16px 12px;
    border-right: 1px solid var(--color-border);
    overflow-y: auto;
    scrollbar-width: none;
  }
  .settings__nav::-webkit-scrollbar { display: none; }

  .settings__nav-group {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .settings__nav-heading {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0 8px;
    margin-bottom: 8px;
  }

  .settings__nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 8px;
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--color-muted-foreground);
    background: transparent;
    border: none;
    border-radius: 6px;
    text-align: left;
    cursor: pointer;
    transition:
      color 150ms var(--ease-expo-out),
      background 150ms var(--ease-expo-out);
  }

  .settings__nav-item:hover {
    color: var(--color-foreground);
  }

  .settings__nav-item--active {
    color: var(--color-foreground);
    font-weight: 500;
    position: relative;
  }

  .settings__nav-item--active::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: conic-gradient(
      from var(--glow-angle, 0deg),
      transparent 0%,
      transparent 65%,
      rgba(122, 162, 247, 0.1) 75%,
      rgba(122, 162, 247, 0.25) 82%,
      rgba(122, 162, 247, 0.1) 89%,
      transparent 100%
    );
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: glow-trace 7s linear infinite, glow-trace-fade-in 0.8s ease both;
    pointer-events: none;
  }

  .settings__nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    flex-shrink: 0;
  }

  /* ── Content pane ── */
  .settings__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .settings__content-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .settings__title {
    font-family: var(--font-sans);
    font-size: 20px;
    font-weight: 600;
    color: var(--color-foreground);
    letter-spacing: -0.02em;
  }

  .settings__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-placeholder);
    font-size: 14px;
    cursor: pointer;
    transition:
      color 150ms var(--ease-expo-out),
      background 150ms var(--ease-expo-out);
  }

  .settings__close:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  .settings__body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
  }

  /* ── Shared styles for child tab components (via :global) ── */
  .settings__body {
    :global(.settings__section) {
      display: flex;
      flex-direction: column;
    }

    :global(.settings__row) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    :global(.settings__row:last-child) {
      border-bottom: none;
    }

    :global(.settings__row-info) {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    :global(.settings__row-label) {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted, var(--color-placeholder));
    }

    :global(.settings__row-desc) {
      font-family: var(--font-sans);
      font-size: 12px;
      color: var(--color-placeholder);
      line-height: 1.4;
    }

    /* ── Toggle ── */
    :global(.settings__toggle) {
      position: relative;
      flex-shrink: 0;
      cursor: pointer;
    }

    :global(.settings__toggle input) {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }

    :global(.settings__toggle-track) {
      display: block;
      width: 36px;
      height: 20px;
      background: var(--color-hover);
      border-radius: 10px;
      transition: background 150ms var(--ease-expo-out);
      position: relative;
    }

    :global(.settings__toggle-track::after) {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: var(--color-muted-foreground);
      border-radius: 50%;
      transition: transform 150ms var(--ease-expo-out);
    }

    :global(.settings__toggle input:checked + .settings__toggle-track) {
      background: var(--color-accent);
    }

    :global(.settings__toggle input:checked + .settings__toggle-track::after) {
      transform: translateX(16px);
      background: #fff;
    }

    /* ── Select ── */
    :global(.settings__select) {
      padding: 5px 10px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--color-foreground);
      background: var(--color-hover);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      outline: none;
      cursor: pointer;
      flex-shrink: 0;
      appearance: none;
      -webkit-appearance: none;
      padding-right: 26px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='rgba(255,255,255,0.4)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
    }

    :global(.settings__select:hover) {
      border-color: var(--color-muted-foreground);
    }

    :global(.settings__select:focus) {
      border-color: var(--color-accent);
    }

    :global(.settings__select option) {
      background: #14151b;
      color: var(--color-foreground);
    }

    /* ── Kbd ── */
    :global(.settings__kbd) {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-muted-foreground);
      background: var(--color-hover);
      border: 1px solid var(--color-border);
      border-radius: 5px;
      padding: 3px 8px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    :global(.settings__kbd--editable) {
      cursor: pointer;
      transition: background 150ms ease-out, color 150ms ease-out;
    }

    :global(.settings__kbd--editable:hover) {
      background: rgba(255, 255, 255, 0.08);
    }

    :global(.settings__kbd--recording) {
      background: rgba(122, 162, 247, 0.12);
      color: var(--accent-blue, #7AA2F7);
      animation: pulse-recording 1s ease-in-out infinite alternate;
    }

    :global(.settings__keybind-actions) {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    :global(.settings__keybind-reset) {
      background: none;
      border: none;
      color: var(--text-muted, var(--color-placeholder));
      cursor: pointer;
      font-size: 14px;
      padding: 2px;
      opacity: 0.6;
      transition: opacity 150ms ease-out;
    }

    :global(.settings__keybind-reset:hover) {
      opacity: 1;
    }

    :global(.settings__row--action) {
      justify-content: flex-end;
    }

    :global(.settings__reset-all) {
      background: none;
      border: 1px solid var(--border-subtle, var(--color-border));
      color: var(--text-muted, var(--color-placeholder));
      font-family: var(--font-mono);
      font-size: 11px;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: color 150ms ease-out, border-color 150ms ease-out;
    }

    :global(.settings__reset-all:hover) {
      color: var(--text-primary, var(--color-foreground));
      border-color: var(--text-muted, var(--color-placeholder));
    }

    /* ── Font fields ── */
    :global(.settings__row--fonts) {
      border-bottom: none;
      padding-bottom: 4px;
    }

    :global(.settings__font-grid) {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    :global(.settings__font-field) {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    :global(.settings__font-label) {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-placeholder);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    :global(.settings__font-input) {
      width: 100%;
      padding: 5px 8px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--color-foreground);
      background: var(--color-hover);
      border: 1px solid transparent;
      border-radius: 6px;
      outline: none;
      transition: border-color 150ms var(--ease-expo-out);
    }

    :global(.settings__font-input:focus) {
      border-color: var(--color-accent);
    }

    :global(.settings__font-input::placeholder) {
      color: var(--color-placeholder);
    }

    /* ── Custom CSS editor ── */
    :global(.settings__row--css) {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    :global(.settings__css-editor) {
      width: 100%;
      padding: 10px 12px;
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
      color: var(--color-foreground);
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      outline: none;
      resize: vertical;
      min-height: 80px;
      tab-size: 2;
      transition: border-color 150ms var(--ease-expo-out);
    }

    :global(.settings__css-editor:focus) {
      border-color: var(--color-accent);
    }

    :global(.settings__css-editor::placeholder) {
      color: var(--color-placeholder);
    }

    /* ── Theme row ── */
    :global(.settings__row--theme) {
      border-bottom: none;
      padding-bottom: 8px;
    }

    /* ── Theme preview grid ── */
    :global(.theme-grid) {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    :global(.theme-grid__group-label) {
      font-family: var(--font-mono);
      font-size: 10px;
      font-variant: small-caps;
      color: var(--text-muted, var(--color-placeholder));
      letter-spacing: 0.04em;
      padding-left: 2px;
      margin-bottom: 6px;
      display: block;
    }

    :global(.theme-grid__cards) {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    :global(.theme-card) {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 14px;
      border-radius: 10px;
      border: 1px solid rgba(128, 128, 128, 0.1);
      cursor: pointer;
      text-align: left;
      transition: border-color 150ms ease-out;
    }

    :global(.theme-card:hover) {
      border-color: rgba(128, 128, 128, 0.2);
    }

    :global(.theme-card--active) {
      border-color: transparent;
    }

    :global(.theme-card--active::after) {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1px;
      background: conic-gradient(
        from var(--glow-angle, 0deg),
        transparent 0%,
        transparent 65%,
        rgba(122, 162, 247, 0.15) 75%,
        rgba(122, 162, 247, 0.35) 82%,
        rgba(122, 162, 247, 0.15) 89%,
        transparent 100%
      );
      -webkit-mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      animation: glow-trace 6s linear infinite;
      pointer-events: none;
    }

    :global(.theme-card__name) {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 600;
      line-height: 1.3;
    }

    :global(.theme-card__sample) {
      font-size: 11px;
      line-height: 1.5;
    }
  }

  @keyframes pulse-recording {
    from { opacity: 0.7; }
    to { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-backdrop,
    .settings {
      animation: none;
    }
  }
</style>
