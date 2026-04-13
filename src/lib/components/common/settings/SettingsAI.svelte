<script lang="ts">
  import { getSettings } from '../../../stores/settings.svelte';
  import { aiProviders, aiModels } from '$lib/bridge/ai-providers';
  import type { ModelInfo } from '$lib/bridge/ai-providers';
  import type { AiProvider } from '$lib/ai/types';

  type Settings = ReturnType<typeof getSettings>;
  let { settings }: { settings: Settings } = $props();

  let presets = $state<AiProvider[]>([]);
  let models = $state<ModelInfo[]>([]);
  let loadingModels = $state(false);
  let testStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
  let testMessage = $state('');

  $effect(() => {
    aiProviders().then((p) => { presets = p; }).catch(() => { presets = []; });
  });

  // Fetch models when base URL and API key are both set
  $effect(() => {
    const url = settings.aiBaseUrl;
    const key = settings.aiApiKey;
    if (url && key) {
      fetchModels(url, key);
    } else {
      models = [];
    }
  });

  async function fetchModels(baseUrl: string, apiKey: string) {
    loadingModels = true;
    try {
      models = await aiModels(baseUrl, apiKey);
    } catch {
      models = [];
    }
    loadingModels = false;
  }

  function handlePresetChange(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    if (!id) {
      settings.update('aiProviderId', '');
      return;
    }

    // Use switchAiProvider so credentials are preserved per-provider:
    // the previous provider's current fields stay in its slot, and the
    // new provider's stored credentials (or preset defaults) are loaded
    // into the active aiBaseUrl / aiApiKey / aiModel fields.
    const preset = presets.find(p => p.id === id);
    settings.switchAiProvider(id, preset
      ? { baseUrl: preset.baseUrl, apiKey: preset.apiKey, model: preset.model }
      : undefined);
  }

  function handleModelChange(e: Event) {
    settings.update('aiModel', (e.target as HTMLSelectElement).value);
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
      const { generateText } = await import('ai');
      const { getAIModel } = await import('$lib/ai/client');
      const model = getAIModel();
      if (!model) throw new Error('AI provider not configured — fill in base URL, API key, and model.');

      const { text } = await generateText({
        model,
        prompt: 'Respond with only the word "connected".',
        maxOutputTokens: 16,
      });

      if (text.toLowerCase().includes('connect')) {
        testStatus = 'success';
        testMessage = 'Connection successful.';
      } else {
        testStatus = 'error';
        testMessage = `Unexpected response: ${text.slice(0, 80)}`;
      }
    } catch (err: any) {
      testStatus = 'error';
      testMessage = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    }
  }
</script>

<div class="settings__section">
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

  <div class="settings__row settings__row--vertical">
    <div class="settings__row-info">
      <span class="settings__row-label">API Key</span>
      <span class="settings__row-desc">Stored locally, never sent to Nodeus servers.</span>
    </div>
    <input
      class="settings__font-input"
      type="password"
      placeholder="sk-..."
      value={settings.aiApiKey}
      onchange={(e) => settings.update('aiApiKey', e.currentTarget.value)}
    />
  </div>

  <div class="settings__row">
    <div class="settings__row-info">
      <span class="settings__row-label">Model</span>
      <span class="settings__row-desc">
        {#if loadingModels}
          Loading models...
        {:else if models.length > 0}
          {models.length} models available
        {:else if settings.aiBaseUrl && settings.aiApiKey}
          Enter API key to load models
        {:else}
          Configure provider first
        {/if}
      </span>
    </div>
    {#if models.length > 0}
      <select
        class="settings__select"
        value={settings.aiModel}
        onchange={handleModelChange}
      >
        <option value="">Select model...</option>
        {#each models as model}
          <option value={model.id}>{model.id}</option>
        {/each}
      </select>
    {:else}
      <input
        class="settings__font-input"
        type="text"
        placeholder="gpt-4o"
        value={settings.aiModel}
        onchange={(e) => settings.update('aiModel', e.currentTarget.value)}
        style="max-width: 200px;"
      />
    {/if}
  </div>

  <div class="settings__row settings__row--css">
    <div class="settings__row-info">
      <span class="settings__row-label">Custom Instructions</span>
      <span class="settings__row-desc">Added to the AI's context alongside its built-in Nodeus awareness. Use this to set tone, focus areas, or rules.</span>
    </div>
    <textarea
      class="settings__css-editor"
      rows="4"
      placeholder="You are a helpful writing assistant..."
      value={settings.aiSystemPrompt}
      onchange={(e) => settings.update('aiSystemPrompt', e.currentTarget.value)}
    ></textarea>
  </div>

  <div class="settings__row">
    <div class="settings__row-info">
      <span class="settings__row-label">Max Output Tokens</span>
      <span class="settings__row-desc">
        Upper limit for AI completions. Raise this for long summaries or structured
        output (glossaries, flashcards). <strong>0 = provider default.</strong>
      </span>
    </div>
    <div class="ai-tokens">
      <input
        class="ai-tokens__range"
        type="range"
        min="0"
        max="16000"
        step="500"
        value={settings.aiMaxTokens}
        oninput={(e) => settings.update('aiMaxTokens', Number(e.currentTarget.value))}
      />
      <input
        class="ai-tokens__number"
        type="number"
        min="0"
        max="32000"
        step="500"
        value={settings.aiMaxTokens}
        onchange={(e) => {
          const v = Number(e.currentTarget.value);
          settings.update('aiMaxTokens', Number.isFinite(v) && v >= 0 ? v : 0);
        }}
      />
    </div>
  </div>

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

  /* ── Max-tokens slider + numeric input ── */
  .ai-tokens {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 260px;
  }

  .ai-tokens__range {
    flex: 1;
    min-width: 140px;
    appearance: none;
    -webkit-appearance: none;
    height: 4px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--foreground) 14%, transparent);
    outline: none;
    cursor: pointer;
  }

  .ai-tokens__range::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent-blue, var(--color-accent, #7aa2f7));
    border: 2px solid var(--surface-2, var(--color-popover));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--foreground) 18%, transparent);
    cursor: pointer;
    transition: transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ai-tokens__range::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  .ai-tokens__range::-webkit-slider-thumb:active {
    transform: scale(0.9);
  }

  .ai-tokens__range::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent-blue, var(--color-accent, #7aa2f7));
    border: 2px solid var(--surface-2, var(--color-popover));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--foreground) 18%, transparent);
    cursor: pointer;
  }

  .ai-tokens__number {
    width: 84px;
    padding: 6px 10px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 5%, transparent);
    border: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent);
    border-radius: 6px;
    text-align: right;
    transition: border-color 140ms ease, background 140ms ease;
  }

  .ai-tokens__number:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--accent-blue, #7aa2f7) 50%, var(--foreground) 10%);
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
  }

  /* Hide the spinner arrows in most browsers — cleaner look */
  .ai-tokens__number::-webkit-outer-spin-button,
  .ai-tokens__number::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .ai-tokens__number {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
