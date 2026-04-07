<script lang="ts">
  import { getSettings } from '../../../stores/settings.svelte';

  type Settings = ReturnType<typeof getSettings>;

  let { settings }: { settings: Settings } = $props();
</script>

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
