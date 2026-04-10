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
  import EyeIcon from './EyeIcon.svelte';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import PenLine from '@lucide/svelte/icons/pen-line';
  import Search from '@lucide/svelte/icons/search';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';

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
    { icon: Lightbulb, text: 'Brainstorm ideas' },
    { icon: PenLine, text: 'Refine this paragraph' },
    { icon: Search, text: 'Summarize recent notes' },
  ];

  // Get current note name for the context chip
  let activeNoteName = $derived(() => {
    const path = filesState.activeFilePath;
    if (!path) return null;
    const name = path.split('/').pop() ?? path;
    return name.replace(/\.(md|markdown)$/i, '');
  });

  // Group messages — consecutive tool calls collapse into one group
  type MessageGroup =
    | { kind: 'msg'; msg: any; key: string }
    | { kind: 'tools'; tools: any[]; key: string };

  let groupedMessages = $derived(() => {
    const groups: MessageGroup[] = [];
    let toolBuffer: any[] = [];

    for (let i = 0; i < ai.messages.length; i++) {
      const m = ai.messages[i];
      if (m.role === 'tool') {
        toolBuffer.push(m);
        continue;
      }
      if (toolBuffer.length > 0) {
        groups.push({ kind: 'tools', tools: toolBuffer, key: `tools-${i - toolBuffer.length}` });
        toolBuffer = [];
      }
      groups.push({ kind: 'msg', msg: m, key: `msg-${i}` });
    }
    if (toolBuffer.length > 0) {
      groups.push({ kind: 'tools', tools: toolBuffer, key: `tools-${ai.messages.length - toolBuffer.length}` });
    }
    return groups;
  });

  let expandedToolGroups = $state<Record<string, boolean>>({});
  function toggleToolGroup(key: string) {
    expandedToolGroups[key] = !expandedToolGroups[key];
  }

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
    <!-- Compact header: model name on left, actions on right -->
    <div class="cp__head">
      <div class="cp__head-id">
        <EyeIcon size={13} />
        <div class="cp__head-meta">
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
          <button class="cp__head-btn" onclick={() => ai.clear()} title="Clear">
            <Trash2 size={12} />
          </button>
        {/if}
        <button class="cp__head-btn" onclick={onclose} title="Close">
          <X size={13} />
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="cp__messages" bind:this={scrollEl} role="list">
      {#if !isConfigured}
        <div class="cp__greet">
          <div class="cp__greet-mark">
            <Settings size={20} />
          </div>
          <h2 class="cp__greet-title">Configure AI</h2>
          <p class="cp__greet-desc">Add a provider in Settings to start.</p>
          <button class="cp__greet-btn" onclick={openSettings}>Open Settings</button>
        </div>
      {:else if ai.messages.length === 0}
        <div class="cp__greet">
          <div class="cp__greet-mark">
            <EyeIcon size={22} />
          </div>
          <h2 class="cp__greet-title">How may I be of service?</h2>
          <div class="cp__sug-list">
            {#each suggestions as sug}
              <button class="cp__sug-row" onclick={() => handleSuggestion(sug.text)}>
                <sug.icon size={14} />
                <span>{sug.text}</span>
              </button>
            {/each}
          </div>
        </div>
      {:else}
        {#each groupedMessages() as group (group.key)}
          {#if group.kind === 'msg'}
            <ChatMessage message={group.msg} {oninsert} />
          {:else}
            <div class="cp__tool-group">
              <button
                class="cp__tool-group-head"
                class:cp__tool-group-head--open={expandedToolGroups[group.key]}
                onclick={() => toggleToolGroup(group.key)}
              >
                <ChevronRight size={11} />
                <span class="cp__tool-group-label">
                  {group.tools.length === 1 ? 'Used tool' : `Used ${group.tools.length} tools`}
                </span>
                <span class="cp__tool-group-names">
                  {group.tools.map((t: any) => t.toolCalls?.name ?? t.toolCallId ?? '?').join(', ')}
                </span>
              </button>
              {#if expandedToolGroups[group.key]}
                <div class="cp__tool-group-body">
                  {#each group.tools as tool, ti (ti)}
                    <ChatMessage message={tool} {oninsert} />
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/each}
        {#if ai.error}
          <div class="cp__error">{ai.error}</div>
        {/if}
      {/if}
    </div>

    <!-- Input area with context chip -->
    {#if isConfigured}
      <div class="cp__input-wrap">
        {#if activeNoteName()}
          <div class="cp__ctx-chip" title="Current note context">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            <span>{activeNoteName()}</span>
          </div>
        {/if}
        <ChatInput
          streaming={ai.streaming}
          onsend={handleSend}
          onstop={() => ai.cancel()}
          bind:this={inputRef}
        />
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  .cp {
    display: flex;
    flex-direction: column;
    height: auto;
    max-height: 100%;
    background: transparent;
    font-family: var(--font-content);
    animation: cp-fade 180ms ease both;
  }

  @keyframes cp-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ── Header: tight, model info + actions ── */
  .cp__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    flex-shrink: 0;
  }

  .cp__head-id {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    color: var(--muted-foreground);
  }

  .cp__head-meta {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
  }

  .cp__model {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--foreground);
    letter-spacing: -0.01em;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cp__provider {
    font-family: var(--font-mono);
    font-size: 9.5px;
    color: var(--muted-foreground);
    letter-spacing: 0.02em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .cp__head-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .cp__head-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: color 120ms, background 120ms;

    &:hover {
      color: var(--foreground);
      background: color-mix(in srgb, var(--foreground) 6%, transparent);
    }
  }

  /* ── Body: flex:1 only when there are messages, auto when empty ── */
  .cp__messages {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--foreground) 12%, transparent) transparent;
  }

  /* When only the greeting is inside, don't let it stretch */
  .cp__messages:has(.cp__greet) {
    flex: 0 0 auto;
  }

  .cp__messages::-webkit-scrollbar {
    width: 6px;
  }

  .cp__messages::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    border-radius: 3px;
  }

  /* ── Greeting (empty state) ── */
  .cp__greet {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 12px 20px 8px;
    gap: 14px;
  }

  .cp__greet-mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    color: var(--foreground);
  }

  .cp__greet-title {
    font-family: var(--font-content);
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--foreground);
    margin: 0;
    line-height: 1.15;
  }

  .cp__greet-desc {
    font-size: 13px;
    color: var(--muted-foreground);
    margin: -4px 0 0;
    line-height: 1.5;
  }

  .cp__greet-btn {
    margin-top: 4px;
    padding: 8px 16px;
    font-family: var(--font-content);
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius: 8px;
    cursor: pointer;
    transition: background 120ms;

    &:hover {
      background: color-mix(in srgb, var(--foreground) 12%, transparent);
    }
  }

  /* ── Suggestion rows (inline, no boxy buttons) ── */
  .cp__sug-list {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-top: 6px;
  }

  .cp__sug-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    font-family: var(--font-content);
    font-size: 14px;
    font-weight: 450;
    color: var(--foreground);
    background: transparent;
    border: none;
    border-radius: 0;
    cursor: pointer;
    text-align: left;
    transition: color 120ms, transform 120ms;
  }

  .cp__sug-row :global(svg) {
    color: var(--muted-foreground);
    flex-shrink: 0;
    transition: color 120ms;
  }

  .cp__sug-row:hover {
    color: var(--accent-blue, var(--color-accent));
  }

  .cp__sug-row:hover :global(svg) {
    color: var(--accent-blue, var(--color-accent));
  }

  /* ── Input wrap with context chip ── */
  .cp__input-wrap {
    padding: 8px 16px 16px;
    flex-shrink: 0;
  }

  /* Override ChatInput's default border and padding when inside the wrap */
  .cp__input-wrap :global(.ci) {
    padding: 0 !important;
    border-top: none !important;
    border-radius: 12px;
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    padding: 6px 6px 6px 14px !important;
    align-items: center !important;
  }

  .cp__input-wrap :global(.ci:focus-within) {
    border-color: color-mix(in srgb, var(--foreground) 16%, transparent);
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
  }

  .cp__input-wrap :global(.ci__textarea) {
    font-family: var(--font-content) !important;
    font-size: 14px !important;
    background: transparent !important;
    border: none !important;
    padding: 6px 0 !important;
    box-shadow: none !important;
  }

  .cp__input-wrap :global(.ci__textarea:focus) {
    border: none !important;
    box-shadow: none !important;
  }

  .cp__input-wrap :global(.ci__btn--send) {
    width: 30px !important;
    height: 30px !important;
    border-radius: 50% !important;
    background: color-mix(in srgb, var(--foreground) 12%, transparent) !important;
    color: var(--foreground) !important;
  }

  .cp__input-wrap :global(.ci__btn--send:not(.ci__btn--hidden)) {
    background: var(--foreground) !important;
    color: var(--background) !important;
  }

  .cp__ctx-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px 5px 8px;
    margin-bottom: 8px;
    border-radius: 999px;
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    max-width: 100%;
    overflow: hidden;
  }

  .cp__ctx-chip :global(svg) {
    flex-shrink: 0;
  }

  .cp__ctx-chip span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Error ── */
  .cp__error {
    margin: 8px 16px;
    padding: 10px 12px;
    font-family: var(--font-content);
    font-size: 12px;
    color: var(--accent-red, #f7768e);
    line-height: 1.4;
    background: color-mix(in srgb, var(--accent-red, #f7768e) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-red, #f7768e) 14%, transparent);
    border-radius: 8px;
  }

  /* ── Tool group (collapsed consecutive tool calls) ── */
  .cp__tool-group {
    margin: 6px 16px;
  }

  .cp__tool-group-head {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius: 8px;
    cursor: pointer;
    font-family: var(--font-content);
    font-size: 12px;
    color: var(--muted-foreground);
    text-align: left;
    transition: background 120ms, color 120ms, border-color 120ms;
  }

  .cp__tool-group-head:hover {
    background: color-mix(in srgb, var(--foreground) 7%, transparent);
    color: var(--foreground);
    border-color: color-mix(in srgb, var(--foreground) 14%, transparent);
  }

  .cp__tool-group-head :global(svg) {
    flex-shrink: 0;
    transition: transform 140ms ease;
  }

  .cp__tool-group-head--open :global(svg) {
    transform: rotate(90deg);
  }

  .cp__tool-group-label {
    font-weight: 500;
    color: var(--foreground);
    flex-shrink: 0;
  }

  .cp__tool-group-names {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
  }

  .cp__tool-group-body {
    margin-top: 4px;
    padding-left: 12px;
    border-left: 2px solid color-mix(in srgb, var(--foreground) 10%, transparent);
  }

  /* ── Tools badge ── */
  .cp__tools-badge {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--accent-green, #9ece6a);
    background: color-mix(in srgb, var(--accent-green, #9ece6a) 10%, transparent);
    border-radius: 999px;
  }

  @media (prefers-reduced-motion: reduce) {
    .cp { animation: none; }
  }
</style>
