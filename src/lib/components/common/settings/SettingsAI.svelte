<script lang="ts">
  import { getSettings } from '../../../stores/settings.svelte';
  import { aiProviders, aiChat } from '$lib/bridge/ai';
  import type { AiProvider } from '$lib/ai/types';

  type Settings = ReturnType<typeof getSettings>;
  let { settings }: { settings: Settings } = $props();

  let presets = $state<AiProvider[]>([]);
  let testStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
  let testMessage = $state('');

  // Load provider presets on mount
  $effect(() => {
    aiProviders().then((p) => { presets = p; }).catch(() => {
      // Expected in browser dev mode
      presets = [];
    });
  });

  function handlePresetChange(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    settings.update('aiProviderId', id);

    const preset = presets.find(p => p.id === id);
    if (preset) {
      settings.update('aiBaseUrl', preset.baseUrl);
      settings.update('aiModel', preset.model);
      if (preset.apiKey) {
        settings.update('aiApiKey', preset.apiKey);
      }
    }
  }

  async function testConnection() {
    if (!settings.aiBaseUrl || !settings.aiModel) {
      testStatus = 'error';
      testMessage = 'Base URL and model are required.';
      return;
    }

    testStatus = 'testing';
    testMessage = '';

    try {
      await aiChat({
        provider: {
          id: settings.aiProviderId || 'custom',
          name: 'Test',
          baseUrl: settings.aiBaseUrl,
          apiKey: settings.aiApiKey,
          model: settings.aiModel,
        },
        messages: [{ role: 'user', content: 'Say "connected" and nothing else.' }],
        systemPrompt: 'Respond with only the word "connected".',
        maxTokens: 16,
      });
      testStatus = 'success';
      testMessage = 'Connection successful.';
    } catch (err) {
      testStatus = 'error';
      testMessage = String(err);
    }
  }
</script>

<div class="settings__section">
  <!-- Provider preset -->
  <div class="settings__row">
    <div class="settings__row-info">
      <span class="settings__row-label">Provider</span>
      <span class="settings__row-desc">Select a preset or choose Custom.</span>
    </div>
    <select
      class="settings__select"
      value={settings.aiProviderId}
      onchange={handlePresetChange}
    >
      <option value="">Select provider...</option>
      {#each presets as preset}
        <option value={preset.id}>{preset.name}</option>
      {/each}
    </select>
  </div>

  <!-- Base URL -->
  <div class="settings__row settings__row--vertical">
    <div class="settings__row-info">
      <span class="settings__row-label">Base URL</span>
      <span class="settings__row-desc">OpenAI-compatible API endpoint.</span>
    </div>
    <input
      class="settings__font-input"
      type="text"
      placeholder="https://api.openai.com/v1"
      value={settings.aiBaseUrl}
      onchange={(e) => settings.update('aiBaseUrl', e.currentTarget.value)}
    />
  </div>

  <!-- API Key -->
  <div class="settings__row settings__row--vertical">
    <div class="settings__row-info">
      <span class="settings__row-label">API Key</span>
      <span class="settings__row-desc">Your provider API key. Stored locally, never sent to Noctodeus servers.</span>
    </div>
    <input
      class="settings__font-input"
      type="password"
      placeholder="sk-..."
      value={settings.aiApiKey}
      onchange={(e) => settings.update('aiApiKey', e.currentTarget.value)}
    />
  </div>

  <!-- Model -->
  <div class="settings__row settings__row--vertical">
    <div class="settings__row-info">
      <span class="settings__row-label">Model</span>
      <span class="settings__row-desc">Model identifier (e.g., gpt-4o, claude-sonnet-4-20250514).</span>
    </div>
    <input
      class="settings__font-input"
      type="text"
      placeholder="gpt-4o"
      value={settings.aiModel}
      onchange={(e) => settings.update('aiModel', e.currentTarget.value)}
    />
  </div>

  <!-- System Prompt -->
  <div class="settings__row settings__row--css">
    <div class="settings__row-info">
      <span class="settings__row-label">System Prompt</span>
      <span class="settings__row-desc">Instructions sent to the AI at the start of every conversation.</span>
    </div>
    <textarea
      class="settings__css-editor"
      rows="4"
      placeholder="You are a helpful writing assistant..."
      value={settings.aiSystemPrompt}
      onchange={(e) => settings.update('aiSystemPrompt', e.currentTarget.value)}
    ></textarea>
  </div>

  <!-- Test connection -->
  <div class="settings__row">
    <div class="settings__row-info">
      <span class="settings__row-label">Test Connection</span>
      <span class="settings__row-desc">
        {#if testStatus === 'testing'}
          Testing...
        {:else if testStatus === 'success'}
          <span class="ai-test--ok">{testMessage}</span>
        {:else if testStatus === 'error'}
          <span class="ai-test--err">{testMessage}</span>
        {:else}
          Send a quick test message to verify your config.
        {/if}
      </span>
    </div>
    <button
      class="settings__reset-all"
      onclick={testConnection}
      disabled={testStatus === 'testing'}
    >
      {testStatus === 'testing' ? 'Testing...' : 'Test'}
    </button>
  </div>
</div>

<style>
  .ai-test--ok {
    color: #9ece6a;
  }
  .ai-test--err {
    color: #f7768e;
    word-break: break-word;
  }

  :global(.settings__row--vertical) {
    flex-direction: column;
    align-items: stretch !important;
    gap: 8px;
  }
</style>
