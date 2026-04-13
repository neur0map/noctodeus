<script lang="ts">
  import { tick, onDestroy } from 'svelte';
  import { getResearchState } from '$lib/stores/research.svelte';
  import { getSettings } from '$lib/stores/settings.svelte';
  import { getUiState } from '$lib/stores/ui.svelte';
  import { getFilesState } from '$lib/stores/files.svelte';
  import { getTabsState } from '$lib/stores/tabs.svelte';
  import { mountReadonlyBlockNote } from '$lib/components/ai/readonly-blocknote';
  import ChatInput from '$lib/components/ai/ChatInput.svelte';

  const research = getResearchState();
  const settings = getSettings();
  const ui = getUiState();
  const filesState = getFilesState();
  const tabsState = getTabsState();

  // --- Refs ---
  let scrollEl: HTMLDivElement | undefined = $state();
  let chatInputRef: ReturnType<typeof ChatInput> | undefined = $state();

  // --- Derived state ---
  let aiConfigured = $derived(!!settings.aiApiKey && !!settings.aiModel);
  let hasSources = $derived(research.sources.length > 0);
  let hasMessages = $derived(research.messages.length > 0);
  let inputDisabled = $derived(!hasSources && !hasMessages);

  let inputPlaceholder = $derived(
    hasSources ? 'Ask about your sources...' : 'Add sources to begin...',
  );

  // --- Assistant message rendering ---
  // During streaming: render as plain HTML (fast, no React overhead, no flicker).
  // After streaming ends: mount BlockNote for the final rich view.
  let unmountFns = new Map<number, () => void>();
  let assistantEls = new Map<number, HTMLDivElement>();
  let renderedFinalContent = new Map<number, string>();

  function trackAssistantEl(el: HTMLDivElement, idx: number) {
    assistantEls.set(idx, el);
    return {
      destroy() {
        assistantEls.delete(idx);
        const fn = unmountFns.get(idx);
        if (fn) { try { fn(); } catch {} unmountFns.delete(idx); }
        renderedFinalContent.delete(idx);
      },
    };
  }

  // Render streaming messages as simple HTML (no BlockNote mount/unmount per chunk)
  $effect(() => {
    const msgs = research.messages;
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      if (msg.role !== 'assistant') continue;

      const el = assistantEls.get(i);
      if (!el) continue;

      const content = cleanContent(msg.content ?? '');

      if (msg.streaming) {
        // During streaming: render as simple HTML to avoid flicker
        // Convert [[wiki-links]] to styled spans for visual consistency
        const htmlContent = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\[\[([^\]]+)\]\]/g, '<span class="rc-conv__wiki-link" data-wiki-target="$1">$1</span>')
          .replace(/\n/g, '<br>');
        el.innerHTML = `<div class="rc-conv__streaming-text">${htmlContent}</div>`;
        // Mark as not final so we know to mount BlockNote later
        renderedFinalContent.delete(i);
      } else if (content && renderedFinalContent.get(i) !== content) {
        // Streaming ended — mount BlockNote for rich rendering
        renderedFinalContent.set(i, content);

        // Unmount previous BlockNote if any
        const prevUnmount = unmountFns.get(i);
        if (prevUnmount) {
          try { prevUnmount(); } catch {}
          unmountFns.delete(i);
        }

        el.innerHTML = ''; // Clear streaming HTML
        const idx = i;
        mountReadonlyBlockNote(el, content).then((fn) => {
          unmountFns.set(idx, fn);
        });
      }
    }
  });

  onDestroy(() => {
    for (const fn of unmountFns.values()) {
      try { fn(); } catch {}
    }
    unmountFns.clear();
    renderedFinalContent.clear();
  });

  // --- Auto-scroll ---
  $effect(() => {
    const _len = research.messages.length;
    const _streaming = research.streaming;
    tick().then(() => {
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    });
  });

  // --- Focus management: refocus input when streaming ends ---
  let wasStreaming = $state(false);

  $effect(() => {
    const isStreaming = research.streaming;
    if (wasStreaming && !isStreaming) {
      // Streaming just ended, refocus input
      tick().then(() => {
        chatInputRef?.focus();
      });
    }
    wasStreaming = isStreaming;
  });

  // --- Expose focus for parent ---
  export function focusInput() {
    chatInputRef?.focus();
  }

  // --- Helpers ---

  /** Strip AI internals from visible content. */
  function cleanContent(raw: string): string {
    return raw
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function handleSend(text: string) {
    research.send(text);
  }

  // --- Citation click handling ---
  function handleCitationClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    // Check the clicked element and its parent for data-wiki-target
    const wikiEl = target.closest('[data-wiki-target]') as HTMLElement | null;
    if (!wikiEl) return;

    e.preventDefault();
    e.stopPropagation();

    const wikiTarget = wikiEl.dataset.wikiTarget ?? '';

    if (wikiTarget.startsWith('url:')) {
      // Find matching source by citationId and open in browser
      const source = research.sources.find((s) => s.citationId === wikiTarget);
      if (source?.origin) {
        import('@tauri-apps/plugin-opener')
          .then(({ openUrl }) => openUrl(source.origin))
          .catch(() => window.open(source.origin, '_blank'));
      }
      return;
    }

    if (wikiTarget.startsWith('text:')) {
      // Dispatch highlight event for the shelf
      window.dispatchEvent(
        new CustomEvent('highlight-source', { detail: { id: wikiTarget } }),
      );
      return;
    }

    // Default: note path
    const fileNode = findFileByPath(wikiTarget);
    if (fileNode) {
      tabsState.openFile(fileNode);
    }
  }

  function findFileByPath(target: string): import('$lib/types/core').FileNode | undefined {
    // Try exact match first
    for (const f of filesState.fileMap.values()) {
      if (f.is_directory) continue;
      const pathNoExt = f.path.replace(/\.(md|markdown)$/i, '');
      const nameNoExt = f.name.replace(/\.(md|markdown)$/i, '');
      if (pathNoExt === target || nameNoExt === target || f.path === target) {
        return f;
      }
    }
    return undefined;
  }
</script>

<div class="rc-conv">
  <!-- Messages area -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="rc-conv__messages" bind:this={scrollEl} onclick={handleCitationClick}>
    {#if !aiConfigured}
      <!-- Empty state: AI not configured -->
      <div class="rc-conv__empty">
        <span class="rc-conv__empty-text">Configure an AI provider</span>
        <button class="rc-conv__settings-link" onclick={() => ui.showSettings()}>
          Open Settings
        </button>
      </div>
    {:else if !hasSources && !hasMessages}
      <!-- Empty state: no sources, no messages -->
      <div class="rc-conv__empty">
        <span class="rc-conv__empty-text">Add notes, URLs, or paste text to begin researching.</span>
      </div>
    {:else}
      <!-- Message list -->
      <div class="rc-conv__list">
        {#each research.messages as msg, i (i)}
          {#if msg.role === 'user'}
            <div class="rc-conv__user-msg">{msg.content}</div>
          {:else if msg.role === 'assistant'}
            <div class="rc-conv__assistant-msg">
              {#if cleanContent(msg.content ?? '') || msg.streaming}
                <div
                  class="rc-conv__bn"
                  use:trackAssistantEl={i}
                ></div>
                {#if msg.streaming}
                  <span class="rc-conv__cursor">&#x2588;</span>
                {/if}
              {/if}
            </div>
          {/if}
        {/each}

        <!-- Error display -->
        {#if research.error}
          <div class="rc-conv__error">{research.error}</div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Input area -->
  <div class="rc-conv__input">
    {#if hasMessages}
      <button class="rc-conv__clear" onclick={() => research.clearMessages()}>
        Clear conversation
      </button>
    {/if}
    <div class="rc-conv__input-wrap" class:rc-conv__input-wrap--disabled={inputDisabled}>
      <ChatInput
        bind:this={chatInputRef}
        streaming={research.streaming}
        placeholder={inputPlaceholder}
        onsend={handleSend}
        onstop={() => research.cancel()}
      />
    </div>
  </div>
</div>

<style lang="scss">
  .rc-conv {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    height: 100%;
    background: var(--color-background);
  }

  // --- Messages scroll area ---
  .rc-conv__messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 32px;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .rc-conv__list {
    max-width: 680px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 44px;
    padding-bottom: 24px;
  }

  // --- Empty states ---
  .rc-conv__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    text-align: center;
  }

  .rc-conv__empty-text {
    font-family: var(--font-content);
    font-size: 14px;
    color: var(--color-placeholder);
    line-height: 1.6;
  }

  .rc-conv__settings-link {
    padding: 0;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-accent, #7aa2f7);
    background: none;
    border: none;
    cursor: pointer;
    transition: opacity 150ms;

    &:hover {
      opacity: 0.8;
    }
  }

  // --- User messages ---
  .rc-conv__user-msg {
    font-family: var(--font-content);
    font-size: 15px;
    font-weight: 500;
    line-height: 1.7;
    color: var(--color-foreground);
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(128, 128, 128, 0.08);
  }

  // --- Assistant messages ---
  .rc-conv__assistant-msg {
    position: relative;
    font-size: 15px;
    line-height: 1.8;
    color: var(--color-foreground);
  }

  .rc-conv__bn :global(.bn-editor) {
    padding: 0 !important;
    min-height: auto !important;
    font-size: 15px !important;
    line-height: 1.8 !important;
  }

  .rc-conv__bn :global(.bn-container) {
    min-height: auto !important;
  }

  // Paragraph spacing inside BlockNote rendered content
  .rc-conv__bn :global(.bn-block-group) {
    gap: 12px;
  }

  .rc-conv__bn :global([data-content-type="paragraph"]) {
    margin-bottom: 10px;
  }

  .rc-conv__bn :global([data-content-type="bulletListItem"]),
  .rc-conv__bn :global([data-content-type="numberedListItem"]) {
    margin-bottom: 6px;
    line-height: 1.8;
  }

  .rc-conv__bn :global([data-content-type="heading"]) {
    margin-top: 28px;
    margin-bottom: 12px;
  }

  // Streaming text (plain HTML, no BlockNote during stream)
  .rc-conv__bn :global(.rc-conv__streaming-text) {
    font-family: var(--font-content);
    font-size: 15px;
    line-height: 1.8;
    color: var(--color-foreground);
    white-space: pre-wrap;
    word-wrap: break-word;
    letter-spacing: 0.01em;
  }

  // Wiki-links in streaming and final rendered content
  .rc-conv__bn :global(.rc-conv__wiki-link),
  .rc-conv__bn :global([data-wiki-target]) {
    color: var(--color-accent, #7aa2f7);
    cursor: pointer;
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 150ms;

    &:hover {
      border-bottom-color: var(--color-accent, #7aa2f7);
    }
  }

  .rc-conv__cursor {
    color: var(--color-accent, #7aa2f7);
    animation: rc-blink 1s step-end infinite;
    font-weight: 400;
  }

  @keyframes rc-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  // --- Error ---
  .rc-conv__error {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-error);
    line-height: 1.5;
  }

  // --- Input area ---
  .rc-conv__input {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 32px 16px;
  }

  .rc-conv__input-wrap {
    width: 100%;
    max-width: 680px;
  }

  .rc-conv__input-wrap--disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .rc-conv__clear {
    padding: 4px 0;
    margin-bottom: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-placeholder);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 150ms;

    &:hover {
      color: var(--color-foreground);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rc-conv__cursor {
      animation: none;
      opacity: 1;
    }
  }
</style>
