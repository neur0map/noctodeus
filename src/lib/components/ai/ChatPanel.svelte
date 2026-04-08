<script lang="ts">
  import { tick } from 'svelte';
  import { getAiState } from '$lib/stores/ai.svelte';
  import { getSettings } from '$lib/stores/settings.svelte';
  import { getUiState } from '$lib/stores/ui.svelte';
  import ChatMessage from './ChatMessage.svelte';
  import ChatInput from './ChatInput.svelte';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import X from '@lucide/svelte/icons/x';
  import Settings from '@lucide/svelte/icons/settings';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import PenLine from '@lucide/svelte/icons/pen-line';
  import Search from '@lucide/svelte/icons/search';

  let {
    visible = false,
    onclose,
    oninsert,
  }: {
    visible: boolean;
    onclose: () => void;
    oninsert?: (content: string) => void;
  } = $props();

  import { getMcpState } from '$lib/stores/mcp.svelte';
  import { getCoreState } from '$lib/stores/core.svelte';
  import { getFilesState } from '$lib/stores/files.svelte';
  import type { AiContext } from '$lib/stores/ai.svelte';
  import Wrench from '@lucide/svelte/icons/wrench';

  const ai = getAiState();
  const settings = getSettings();
  const ui = getUiState();
  const mcp = getMcpState();
  const coreState = getCoreState();
  const filesState = getFilesState();

  let scrollEl: HTMLDivElement | undefined = $state();
  let inputRef: ChatInput | undefined = $state();

  let isConfigured = $derived(
    !!(settings.aiApiKey && settings.aiBaseUrl && settings.aiModel)
  );

  let modelLabel = $derived(() => {
    const model = settings.aiModel;
    if (!model) return 'No model';
    // Truncate long model names
    return model.length > 28 ? model.slice(0, 26) + '...' : model;
  });

  let providerLabel = $derived(() => {
    const id = settings.aiProviderId;
    if (!id) return '';
    // Capitalize provider name
    const names: Record<string, string> = {
      'openai': 'OpenAI',
      'anthropic-openai': 'Anthropic',
      'ollama': 'Ollama',
      'openrouter': 'OpenRouter',
      'groq': 'Groq',
      'custom': 'Custom',
    };
    return names[id] ?? id;
  });

  const suggestions = [
    { icon: Lightbulb, text: 'Brainstorm ideas for my project' },
    { icon: PenLine, text: 'Help me refine this paragraph' },
    { icon: Search, text: 'Summarize my recent notes' },
  ];

  // Auto-scroll to bottom when messages change
  $effect(() => {
    // Read messages length to track changes
    const _len = ai.messages.length;
    const _streaming = ai.streaming;
    tick().then(() => {
      if (scrollEl) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
    });
  });

  // Sync provider from settings whenever settings change
  $effect(() => {
    const apiKey = settings.aiApiKey;
    const baseUrl = settings.aiBaseUrl;
    const model = settings.aiModel;
    const id = settings.aiProviderId;
    if (apiKey && baseUrl && model) {
      ai.setProvider({
        id: id || 'custom',
        name: providerLabel() || 'Custom',
        baseUrl,
        apiKey,
        model,
      });
    }
  });

  async function handleSend(text: string) {
    if (!ai.provider) {
      // Provider not synced yet — force sync now
      const apiKey = settings.aiApiKey;
      const baseUrl = settings.aiBaseUrl;
      const model = settings.aiModel;
      const id = settings.aiProviderId;
      if (apiKey && baseUrl && model) {
        ai.setProvider({
          id: id || 'custom',
          name: providerLabel() || 'Custom',
          baseUrl,
          apiKey,
          model,
        });
      }
    }
    await ai.send(text, settings.aiSystemPrompt || undefined, buildContext());
  }

  function handleSuggestion(text: string) {
    ai.send(text, settings.aiSystemPrompt || undefined, buildContext());
  }

  function buildContext(): AiContext {
    const noteList = Array.from(filesState.fileMap.values())
      .filter(f => !f.is_directory && (f.extension === 'md' || f.extension === 'markdown'))
      .map(f => f.title || f.name);

    return {
      coreName: coreState.activeCore?.name,
      corePath: coreState.activeCore?.path,
      activeFilePath: filesState.activeFilePath ?? undefined,
      noteList,
    };
  }

  function openSettings() {
    ui.showSettings();
  }
</script>

{#if visible}
  <div class="cp">
    <!-- Header -->
    <div class="cp__head">
      <div class="cp__head-left">
        <div class="cp__icon-wrap">
          <Sparkles size={14} />
        </div>
        <div class="cp__head-info">
          <span class="cp__model">{modelLabel()}</span>
          {#if providerLabel()}
            <span class="cp__provider">{providerLabel()}</span>
          {/if}
        </div>
      </div>
      <div class="cp__head-actions">
        {#if mcp.tools.length > 0}
          <span class="cp__tools-badge" title="{mcp.tools.length} MCP tools active">
            <Wrench size={10} /> {mcp.tools.length}
          </span>
        {/if}
        {#if ai.messages.length > 0}
          <button class="cp__head-btn" onclick={() => ai.clear()} title="Clear conversation">
            <Trash2 size={13} />
          </button>
        {/if}
        <button class="cp__head-btn" onclick={onclose} title="Close">
          <X size={14} />
        </button>
      </div>
    </div>

    <!-- Messages area -->
    <div class="cp__messages" bind:this={scrollEl} role="list">
      {#if !isConfigured}
        <!-- No provider configured -->
        <div class="cp__empty">
          <div class="cp__empty-icon">
            <Settings size={24} />
          </div>
          <p class="cp__empty-title">Configure an AI provider</p>
          <p class="cp__empty-desc">Add an API key and provider in Settings to start chatting.</p>
          <button class="cp__empty-btn" onclick={openSettings}>
            Open Settings
          </button>
        </div>
      {:else if ai.messages.length === 0}
        <!-- Empty state with suggestions -->
        <div class="cp__empty">
          <div class="cp__empty-icon cp__empty-icon--accent">
            <Sparkles size={24} />
          </div>
          <p class="cp__empty-title">What can I help with?</p>
          <p class="cp__empty-desc">Ask about your notes, get writing help, or brainstorm ideas.</p>
          <div class="cp__suggestions">
            {#each suggestions as sug}
              <button class="cp__suggestion" onclick={() => handleSuggestion(sug.text)}>
                <sug.icon size={13} />
                <span>{sug.text}</span>
              </button>
            {/each}
          </div>
        </div>
      {:else}
        {#each ai.messages as msg, i (i)}
          <ChatMessage message={msg} {oninsert} />
        {/each}
        {#if ai.error}
          <div class="cp__error">{ai.error}</div>
        {/if}
      {/if}
    </div>

    <!-- Input -->
    {#if isConfigured}
      <ChatInput
        streaming={ai.streaming}
        onsend={handleSend}
        onstop={() => ai.cancel()}
        bind:this={inputRef}
      />
    {/if}
  </div>
{/if}

<style lang="scss">
  .cp {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-background);
    border-left: 1px solid var(--color-border);
    animation: cp-slide 250ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes cp-slide {
    from { opacity: 0; transform: translateX(12px); }
    to { opacity: 1; transform: translateX(0); }
  }

  /* ── Header ── */
  .cp__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .cp__head-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .cp__icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 7px;
    background: rgba(122, 162, 247, 0.1);
    color: var(--color-accent, #7AA2F7);
    flex-shrink: 0;
  }

  .cp__head-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .cp__model {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-foreground);
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cp__provider {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    letter-spacing: 0.01em;
  }

  .cp__head-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .cp__head-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    transition: color 150ms, background 150ms;

    &:hover {
      color: var(--color-foreground);
      background: var(--color-hover);
    }
  }

  /* ── Messages ── */
  .cp__messages {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .cp__messages::-webkit-scrollbar {
    width: 4px;
  }

  .cp__messages::-webkit-scrollbar-thumb {
    background: var(--color-hover);
    border-radius: 2px;
  }

  /* ── Empty state ── */
  .cp__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 32px 24px;
    text-align: center;
    gap: 12px;
  }

  .cp__empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 6px;
    background: var(--color-hover);
    color: var(--color-placeholder);
    margin-bottom: 4px;
  }

  .cp__empty-icon--accent {
    background: rgba(122, 162, 247, 0.08);
    color: var(--color-accent, #7AA2F7);
  }

  .cp__empty-title {
    font-family: var(--font-sans);
    font-size: 15px;
    font-weight: 600;
    color: var(--color-foreground);
    letter-spacing: -0.01em;
    margin: 0;
  }

  .cp__empty-desc {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--color-placeholder);
    line-height: 1.5;
    max-width: 240px;
    margin: 0;
  }

  .cp__empty-btn {
    margin-top: 8px;
    padding: 8px 16px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-accent, #7AA2F7);
    background: rgba(122, 162, 247, 0.1);
    border: 1px solid rgba(122, 162, 247, 0.2);
    border-radius: 6px;
    cursor: pointer;
    transition: background 150ms, border-color 150ms;

    &:hover {
      background: rgba(122, 162, 247, 0.18);
      border-color: rgba(122, 162, 247, 0.35);
    }
  }

  /* ── Suggestions ── */
  .cp__suggestions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    max-width: 280px;
    margin-top: 8px;
  }

  .cp__suggestion {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--color-muted-foreground);
    background: var(--color-hover);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: background 150ms, border-color 150ms, color 150ms;

    &:hover {
      background: var(--color-hover);
      border-color: var(--color-border);
      color: var(--color-foreground);
    }
  }

  /* ── Error ── */
  .cp__error {
    margin: 8px 16px;
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: #f7768e;
    line-height: 1.4;
    background: rgba(247, 118, 142, 0.06);
    border: 1px solid rgba(247, 118, 142, 0.15);
    border-radius: 6px;
  }

  .cp__tools-badge {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: #9ece6a;
    background: rgba(158, 206, 106, 0.08);
    border-radius: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .cp { animation: none; }
  }
</style>
