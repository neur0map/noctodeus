<script lang="ts">
  import { onMount } from 'svelte';
  import { getVersion } from '@tauri-apps/api/app';
  import { getSettings } from '../../../stores/settings.svelte';

  type Settings = ReturnType<typeof getSettings>;

  let { settings }: { settings: Settings } = $props();

  // Pull the version from Tauri at runtime so it always matches the built binary.
  let version = $state('');
  onMount(async () => {
    try {
      version = await getVersion();
    } catch {
      version = '';
    }
  });
</script>

<div class="settings__section">
  <div class="settings__row">
    <div class="settings__row-info">
      <span class="settings__row-label">Version</span>
      <span class="settings__row-desc">
        {version ? `Nodeus v${version}` : 'Nodeus'}
      </span>
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
  <div class="settings__row settings__row--vertical">
    <div class="settings__row-info">
      <span class="settings__row-label">Cryptgeon server</span>
      <span class="settings__row-desc">For larger notes or private hosting, run your own instance.</span>
    </div>
    <input
      class="settings__font-input"
      type="text"
      placeholder="https://cryptgeon.org"
      value={settings.cryptgeonServer}
      onchange={(e) => settings.update('cryptgeonServer', e.currentTarget.value)}
    />
  </div>
</div>
