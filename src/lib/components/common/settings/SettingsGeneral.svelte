<script lang="ts">
  import { getSettings } from '../../../stores/settings.svelte';

  type Settings = ReturnType<typeof getSettings>;

  let { settings }: { settings: Settings } = $props();
</script>

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
