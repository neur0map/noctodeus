<script lang="ts">
  import { getSettings } from '../../../stores/settings.svelte';
  import { SHORTCUT_LABELS, getResolvedShortcuts, formatShortcutLabel } from '../../../utils/shortcuts';

  type Settings = ReturnType<typeof getSettings>;

  let { settings }: { settings: Settings } = $props();

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
