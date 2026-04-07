<script lang="ts">
  import { getSettings } from '../../../stores/settings.svelte';
  import { THEMES } from '../../../themes/themes';

  type Settings = ReturnType<typeof getSettings>;

  let { settings }: { settings: Settings } = $props();
</script>

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
