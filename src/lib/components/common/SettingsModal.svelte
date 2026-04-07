<script lang="ts">
  import { getSettings } from '../../stores/settings.svelte';
  import { THEMES } from '../../themes/themes';
  import { SHORTCUT_LABELS, getResolvedShortcuts, formatShortcutLabel } from '../../utils/shortcuts';
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

  // ── Keybind recording ──
  let recordingKey: string | null = $state(null);

  let resolvedShortcuts = $derived(getResolvedShortcuts(settings.keybinds));

  function startRecording(key: string) {
    recordingKey = key;
  }

  function handleShortcutCapture(e: KeyboardEvent) {
    if (!recordingKey) return;

    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      recordingKey = null;
      return;
    }

    // Ignore bare modifier keys
    if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return;

    // Build the shortcut string
    const parts: string[] = [];
    if (e.metaKey) parts.push('Meta');
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);

    const shortcut = parts.join('+');
    const newKeybinds = { ...settings.keybinds, [recordingKey]: shortcut };
    settings.update('keybinds', newKeybinds);
    recordingKey = null;
  }

  function resetKeybind(key: string) {
    const newKeybinds = { ...settings.keybinds };
    delete newKeybinds[key];
    settings.update('keybinds', newKeybinds);
  }

  function resetAllKeybinds() {
    settings.update('keybinds', {});
  }

  // Window-level listener in capture phase to intercept shortcuts during recording
  $effect(() => {
    if (recordingKey) {
      const handler = (e: KeyboardEvent) => handleShortcutCapture(e);
      window.addEventListener('keydown', handler, true);
      return () => window.removeEventListener('keydown', handler, true);
    }
  });
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
              <div class="settings__row settings__row--theme">
                <div class="settings__row-info">
                  <span class="settings__row-label">Theme</span>
                  <span class="settings__row-desc">Choose the interface theme.</span>
                </div>
              </div>
              <div class="theme-grid">
                {#each ['dark', 'light', 'warm'] as group}
                  <div class="theme-grid__group">
                    <span class="theme-grid__group-label">{group}</span>
                    <div class="theme-grid__cards">
                      {#each THEMES.filter(t => t.group === group) as theme (theme.id)}
                        <button
                          class="theme-card"
                          class:theme-card--active={settings.theme === theme.id}
                          style="background: {theme.preview.bg};"
                          onclick={() => settings.update('theme', theme.id)}
                        >
                          <span class="theme-card__name" style="color: {theme.preview.text};">{theme.name}</span>
                          <span class="theme-card__sample" style="color: {theme.preview.textMuted};">
                            Lorem ipsum <strong style="color: {theme.preview.text};">dolor sit</strong> amet, consectetur.
                          </span>
                          <span class="theme-card__sample" style="color: {theme.preview.textMuted};">
                            Mauris <em style="color: {theme.preview.link};">semper</em> pharetra.
                          </span>
                        </button>
                      {/each}
                    </div>
                  </div>
                {/each}
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
                  <span class="settings__row-label">Editor width</span>
                  <span class="settings__row-desc">Maximum width of the editor content area.</span>
                </div>
                <select
                  class="settings__select"
                  value={String(settings.editorWidth)}
                  onchange={(e) => settings.update('editorWidth', Number(e.currentTarget.value))}
                >
                  <option value="640">Narrow (640px)</option>
                  <option value="780">Default (780px)</option>
                  <option value="960">Wide (960px)</option>
                  <option value="1200">Extra wide (1200px)</option>
                  <option value="9999">Full width</option>
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
              <div class="settings__row settings__row--fonts">
                <div class="settings__row-info">
                  <span class="settings__row-label">Fonts</span>
                  <span class="settings__row-desc">Override the default font families. Leave blank for defaults.</span>
                </div>
              </div>
              <div class="settings__font-grid">
                <div class="settings__font-field">
                  <span class="settings__font-label">Mono (UI)</span>
                  <input
                    class="settings__font-input"
                    type="text"
                    placeholder="JetBrains Mono"
                    value={settings.fontMono}
                    onchange={(e) => settings.update('fontMono', e.currentTarget.value)}
                  />
                </div>
                <div class="settings__font-field">
                  <span class="settings__font-label">Sans (labels)</span>
                  <input
                    class="settings__font-input"
                    type="text"
                    placeholder="Inter"
                    value={settings.fontSans}
                    onchange={(e) => settings.update('fontSans', e.currentTarget.value)}
                  />
                </div>
                <div class="settings__font-field">
                  <span class="settings__font-label">Content (editor)</span>
                  <input
                    class="settings__font-input"
                    type="text"
                    placeholder="Source Serif 4"
                    value={settings.fontContent}
                    onchange={(e) => settings.update('fontContent', e.currentTarget.value)}
                  />
                </div>
              </div>
              <div class="settings__row settings__row--css">
                <div class="settings__row-info">
                  <span class="settings__row-label">Custom CSS</span>
                  <span class="settings__row-desc">Advanced: inject custom styles. Changes apply instantly.</span>
                </div>
                <textarea
                  class="settings__css-editor"
                  placeholder="/* Custom styles */"
                  value={settings.customCSS}
                  onchange={(e) => settings.update('customCSS', e.currentTarget.value)}
                  rows={5}
                ></textarea>
                <span class="settings__row-desc" style="margin-top: 4px; font-size: 10px;">
                  Selectors: .ProseMirror (editor), .app-shell (layout), :root (tokens)
                </span>
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
              {#each Object.entries(SHORTCUT_LABELS) as [key, meta] (key)}
                <div class="settings__row">
                  <div class="settings__row-info">
                    <span class="settings__row-label">{meta.label}</span>
                    <span class="settings__row-desc">{meta.desc}</span>
                  </div>
                  <div class="settings__keybind-actions">
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <kbd
                      class="settings__kbd settings__kbd--editable"
                      class:settings__kbd--recording={recordingKey === key}
                      onclick={() => startRecording(key)}
                      tabindex="0"
                    >
                      {recordingKey === key ? 'Press shortcut...' : formatShortcutLabel(resolvedShortcuts[key as keyof typeof resolvedShortcuts])}
                    </kbd>
                    {#if settings.keybinds[key]}
                      <button
                        class="settings__keybind-reset"
                        onclick={() => resetKeybind(key)}
                        title="Reset to default"
                      >&#8634;</button>
                    {/if}
                  </div>
                </div>
              {/each}
              <div class="settings__row settings__row--action">
                <button class="settings__reset-all" onclick={resetAllKeybinds}>
                  Reset all to defaults
                </button>
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
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);  /* intentionally subtle */
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
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted, var(--color-placeholder));
  }

  .settings__row-desc {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--color-placeholder);
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
    background: var(--color-hover);
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
    background: var(--color-muted-foreground);
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

  .settings__select:hover {
    border-color: var(--color-muted-foreground);
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
    color: var(--color-muted-foreground);
    background: var(--color-hover);
    border: 1px solid var(--color-border);
    border-radius: 5px;
    padding: 3px 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .settings__kbd--editable {
    cursor: pointer;
    transition: background 150ms ease-out, color 150ms ease-out;
  }

  .settings__kbd--editable:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .settings__kbd--recording {
    background: rgba(122, 162, 247, 0.12);
    color: var(--accent-blue, #7AA2F7);
    animation: pulse-recording 1s ease-in-out infinite alternate;
  }

  @keyframes pulse-recording {
    from { opacity: 0.7; }
    to { opacity: 1; }
  }

  .settings__keybind-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .settings__keybind-reset {
    background: none;
    border: none;
    color: var(--text-muted, var(--color-placeholder));
    cursor: pointer;
    font-size: 14px;
    padding: 2px;
    opacity: 0.6;
    transition: opacity 150ms ease-out;
  }

  .settings__keybind-reset:hover {
    opacity: 1;
  }

  .settings__row--action {
    justify-content: flex-end;
  }

  .settings__reset-all {
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

  .settings__reset-all:hover {
    color: var(--text-primary, var(--color-foreground));
    border-color: var(--text-muted, var(--color-placeholder));
  }

  /* ── Font fields ── */
  .settings__row--fonts {
    border-bottom: none;
    padding-bottom: 4px;
  }

  .settings__font-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .settings__font-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .settings__font-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .settings__font-input {
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

  .settings__font-input:focus {
    border-color: var(--color-accent);
  }

  .settings__font-input::placeholder {
    color: var(--color-placeholder);
  }

  /* ── Custom CSS editor ── */
  .settings__row--css {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .settings__css-editor {
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

  .settings__css-editor:focus {
    border-color: var(--color-accent);
  }

  .settings__css-editor::placeholder {
    color: var(--color-placeholder);
  }

  /* ── Theme row (no bottom border — grid follows) ── */
  .settings__row--theme {
    border-bottom: none;
    padding-bottom: 8px;
  }

  /* ── Theme preview grid ── */
  .theme-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .theme-grid__group-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-variant: small-caps;
    color: var(--text-muted, var(--color-placeholder));
    letter-spacing: 0.04em;
    padding-left: 2px;
    margin-bottom: 6px;
    display: block;
  }

  .theme-grid__cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .theme-card {
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

  .theme-card:hover {
    border-color: rgba(128, 128, 128, 0.2);
  }

  /* Active theme gets the glow-trace animation */
  .theme-card--active {
    border-color: transparent;
  }

  .theme-card--active::after {
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

  .theme-card__name {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
  }

  .theme-card__sample {
    font-size: 11px;
    line-height: 1.5;
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-backdrop,
    .settings {
      animation: none;
    }
  }
</style>
