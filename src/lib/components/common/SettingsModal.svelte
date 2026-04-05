<script lang="ts">
  import { getSettings } from '../../stores/settings.svelte';
  import { APP_SHORTCUTS, formatShortcutLabel } from '../../utils/shortcuts';
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import PencilLine from "@lucide/svelte/icons/pencil-line";
  import Palette from "@lucide/svelte/icons/palette";
  import FileText from "@lucide/svelte/icons/file-text";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import X from "@lucide/svelte/icons/x";

  let {
    visible = false,
    onclose,
  }: {
    visible: boolean;
    onclose: () => void;
  } = $props();

  const settings = getSettings();

  type Section = 'general' | 'editor' | 'appearance' | 'files' | 'hotkeys';

  let activeSection = $state<Section>('general');

  const sections: { id: Section; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'editor', label: 'Editor' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'files', label: 'Files & Links' },
    { id: 'hotkeys', label: 'Hotkeys' },
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
            <div class="settings__section">
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Version</span>
                  <span class="settings__row-desc">Noctodeus v0.1.0</span>
                </div>
              </div>
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Restore last session</span>
                  <span class="settings__row-desc">Re-open the last core and files on startup.</span>
                </div>
                <label class="settings__toggle">
                  <input type="checkbox" checked={settings.restoreLastSession} onchange={(e) => settings.update('restoreLastSession', e.currentTarget.checked)} />
                  <span class="settings__toggle-track"></span>
                </label>
              </div>
            </div>

          {:else if activeSection === 'editor'}
            <div class="settings__section">
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Auto-save</span>
                  <span class="settings__row-desc">Automatically save files after changes.</span>
                </div>
                <label class="settings__toggle">
                  <input type="checkbox" checked={settings.autoSave} onchange={(e) => settings.update('autoSave', e.currentTarget.checked)} />
                  <span class="settings__toggle-track"></span>
                </label>
              </div>
            </div>

          {:else if activeSection === 'appearance'}
            <div class="settings__section">
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Theme</span>
                  <span class="settings__row-desc">Choose the interface theme.</span>
                </div>
                <select class="settings__select" disabled>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Font size</span>
                  <span class="settings__row-desc">Base font size for the editor.</span>
                </div>
                <select
                  class="settings__select"
                  value={String(settings.fontSize)}
                  onchange={(e) => settings.update('fontSize', Number(e.currentTarget.value))}
                >
                  <option value="14">14px</option>
                  <option value="15">15px</option>
                  <option value="16">16px</option>
                  <option value="18">18px</option>
                  <option value="20">20px</option>
                </select>
              </div>
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Show character count</span>
                  <span class="settings__row-desc">Display character count in the sidebar footer.</span>
                </div>
                <label class="settings__toggle">
                  <input type="checkbox" checked={settings.showCharCount} onchange={(e) => settings.update('showCharCount', e.currentTarget.checked)} />
                  <span class="settings__toggle-track"></span>
                </label>
              </div>
            </div>

          {:else if activeSection === 'files'}
            <div class="settings__section">
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Default file extension</span>
                  <span class="settings__row-desc">Extension used when creating new files.</span>
                </div>
                <select
                  class="settings__select"
                  value={settings.defaultExtension}
                  onchange={(e) => settings.update('defaultExtension', e.currentTarget.value)}
                >
                  <option value=".md">.md</option>
                  <option value=".markdown">.markdown</option>
                  <option value=".txt">.txt</option>
                </select>
              </div>
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Confirm before delete</span>
                  <span class="settings__row-desc">Show a confirmation dialog before deleting files.</span>
                </div>
                <label class="settings__toggle">
                  <input type="checkbox" checked={settings.confirmBeforeDelete} onchange={(e) => settings.update('confirmBeforeDelete', e.currentTarget.checked)} />
                  <span class="settings__toggle-track"></span>
                </label>
              </div>
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Wiki-style links</span>
                  <span class="settings__row-desc">Use [[wiki links]] instead of standard markdown links.</span>
                </div>
                <label class="settings__toggle">
                  <input type="checkbox" checked={settings.wikiStyleLinks} onchange={(e) => settings.update('wikiStyleLinks', e.currentTarget.checked)} />
                  <span class="settings__toggle-track"></span>
                </label>
              </div>
            </div>

          {:else if activeSection === 'hotkeys'}
            <div class="settings__section">
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Quick Open</span>
                  <span class="settings__row-desc">Open the file switcher.</span>
                </div>
                <kbd class="settings__kbd">{formatShortcutLabel(APP_SHORTCUTS.quick_open)}</kbd>
              </div>
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Command Palette</span>
                  <span class="settings__row-desc">Open the command palette.</span>
                </div>
                <kbd class="settings__kbd">{formatShortcutLabel(APP_SHORTCUTS.command_palette)}</kbd>
              </div>
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">New Note</span>
                  <span class="settings__row-desc">Create a new note.</span>
                </div>
                <kbd class="settings__kbd">{formatShortcutLabel(APP_SHORTCUTS.new_note)}</kbd>
              </div>
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Toggle Sidebar</span>
                  <span class="settings__row-desc">Show or hide the sidebar.</span>
                </div>
                <kbd class="settings__kbd">{formatShortcutLabel(APP_SHORTCUTS.toggle_sidebar)}</kbd>
              </div>
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Toggle Right Panel</span>
                  <span class="settings__row-desc">Show or hide the detail panel.</span>
                </div>
                <kbd class="settings__kbd">{formatShortcutLabel(APP_SHORTCUTS.toggle_right_panel)}</kbd>
              </div>
              <div class="settings__row">
                <div class="settings__row-info">
                  <span class="settings__row-label">Delete File</span>
                  <span class="settings__row-desc">Move the active file to trash.</span>
                </div>
                <kbd class="settings__kbd">{formatShortcutLabel(APP_SHORTCUTS.delete_file)}</kbd>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: backdrop-in 150ms var(--ease-expo-out) both;
  }

  @keyframes backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .settings {
    display: flex;
    width: min(860px, 90vw);
    height: min(580px, 80vh);
    background: rgba(16, 17, 22, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(24px);
    overflow: hidden;
    animation: settings-in 150ms var(--ease-expo-out) both;
  }

  @keyframes settings-in {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }

  /* ── Nav sidebar ── */
  .settings__nav {
    width: 200px;
    flex-shrink: 0;
    padding: 16px 12px;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
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
    color: rgba(255, 255, 255, 0.32);
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
    color: rgba(255, 255, 255, 0.6);
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
    background: rgba(255, 255, 255, 0.04);
  }

  .settings__nav-item--active {
    color: var(--color-foreground);
    background: rgba(99, 102, 241, 0.12);
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
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
    color: rgba(255, 255, 255, 0.4);
    font-size: 14px;
    cursor: pointer;
    transition:
      color 150ms var(--ease-expo-out),
      background 150ms var(--ease-expo-out);
  }

  .settings__close:hover {
    color: var(--color-foreground);
    background: rgba(255, 255, 255, 0.06);
  }

  .settings__body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
  }

  /* ── Setting rows ── */
  .settings__section {
    display: flex;
    flex-direction: column;
  }

  .settings__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .settings__row:last-child {
    border-bottom: none;
  }

  .settings__row-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .settings__row-label {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-foreground);
  }

  .settings__row-desc {
    font-family: var(--font-sans);
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    line-height: 1.4;
  }

  /* ── Toggle ── */
  .settings__toggle {
    position: relative;
    flex-shrink: 0;
    cursor: pointer;
  }

  .settings__toggle input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .settings__toggle-track {
    display: block;
    width: 36px;
    height: 20px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    transition: background 150ms var(--ease-expo-out);
    position: relative;
  }

  .settings__toggle-track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    transition: transform 150ms var(--ease-expo-out);
  }

  .settings__toggle input:checked + .settings__toggle-track {
    background: var(--color-accent);
  }

  .settings__toggle input:checked + .settings__toggle-track::after {
    transform: translateX(16px);
    background: #fff;
  }

  /* ── Select ── */
  .settings__select {
    padding: 5px 10px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-foreground);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
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

  .settings__select:hover {
    border-color: rgba(255, 255, 255, 0.18);
  }

  .settings__select:focus {
    border-color: var(--color-accent);
  }

  .settings__select option {
    background: #14151b;
    color: var(--color-foreground);
  }

  /* ── Kbd ── */
  .settings__kbd {
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.56);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 5px;
    padding: 3px 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-backdrop,
    .settings {
      animation: none;
    }
  }
</style>
