<script lang="ts">
  import { getSettings } from '../../../stores/settings.svelte';

  type Settings = ReturnType<typeof getSettings>;

  let { settings }: { settings: Settings } = $props();
</script>

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
