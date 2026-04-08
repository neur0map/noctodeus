<script lang="ts">
  import TabBar from '$lib/components/tabs/TabBar.svelte';
  import SaveIndicator from '$lib/editor/SaveIndicator.svelte';
  import { getTabsState } from '$lib/stores/tabs.svelte';
  import { getEditorState } from '$lib/stores/editor.svelte';
  import { getFilesState } from '$lib/stores/files.svelte';
  import { getUiState } from '$lib/stores/ui.svelte';
  import { nerdIcon } from '$lib/utils/nerd-icons';
  import Share2 from '@lucide/svelte/icons/share-2';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import BookOpen from '@lucide/svelte/icons/book-open';

  let {
    isMarkdownActive = false,
  }: {
    isMarkdownActive: boolean | undefined;
  } = $props();

  const tabsState = getTabsState();
  const editor = getEditorState();
  const files = getFilesState();
  const ui = getUiState();

  let hasActiveFile = $derived(!!files.activeFilePath);

  function handleShare() {
    if (!files.activeFilePath) return;
    window.dispatchEvent(new CustomEvent('noctodeus-share-file', { detail: { path: files.activeFilePath } }));
  }
</script>

<div class="tab-bar-row">
  <div class="tab-bar-row__tabs">
    <TabBar
      tabs={tabsState.tabs}
      activeTabId={tabsState.activeTabId}
      onactivate={(id) => tabsState.activateTab(id)}
      onclose={(id) => tabsState.closeTab(id)}
      onreorder={(from, to) => tabsState.reorderTabs(from, to)}
    >
      {#snippet trailing()}
        {#if isMarkdownActive}
          <SaveIndicator status={editor.saveStatus} />
        {/if}
      {/snippet}
    </TabBar>
  </div>
  <button class="search-trigger" onclick={() => ui.showQuickOpen()} title="Search (Cmd+K)">
    <span class="search-trigger__icon">{nerdIcon('search')}</span>
    <span class="search-trigger__text">Search...</span>
    <span class="search-trigger__shortcut">&#8984;K</span>
  </button>
  {#if hasActiveFile}
    <button class="share-trigger" onclick={handleShare} title="Share encrypted link">
      <Share2 size={13} />
    </button>
  {/if}
  <button
    class="research-trigger"
    class:research-trigger--active={ui.researchVisible}
    onclick={() => ui.toggleResearch()}
    title="Research"
  >
    <BookOpen size={13} />
  </button>
  <button
    class="ai-trigger"
    class:ai-trigger--active={ui.aiChatVisible}
    onclick={() => ui.toggleAiChat()}
    title="AI Chat ({navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+\u21e7+I)"
  >
    <Sparkles size={13} />
  </button>
</div>

<style>
  .tab-bar-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
  }

  .tab-bar-row__tabs {
    flex: 1;
    min-width: 0;
  }

  .search-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    margin-right: 8px;
    border: 1px solid var(--border-subtle, var(--color-border));
    border-radius: 6px;
    background: var(--surface-1, var(--color-card));
    color: var(--text-muted, var(--color-placeholder));
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: border-color 150ms ease-out, color 150ms ease-out, background 150ms ease-out;
  }

  .search-trigger:hover {
    border-color: var(--border-active, var(--color-border));
    color: var(--text-secondary, var(--color-muted-foreground));
    background: var(--surface-2, var(--color-hover));
  }

  .search-trigger__icon {
    font-size: 12px;
    line-height: 1;
  }

  .search-trigger__text {
    font-size: 11px;
  }

  .search-trigger__shortcut {
    font-size: 10px;
    opacity: 0.5;
    margin-left: 4px;
  }

  .share-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin-right: 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted, var(--color-placeholder));
    cursor: pointer;
    flex-shrink: 0;
    transition: color 150ms ease-out, background 150ms ease-out;
  }

  .share-trigger:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  .research-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin-right: 2px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted, var(--color-placeholder));
    cursor: pointer;
    flex-shrink: 0;
    transition: color 150ms ease-out, background 150ms ease-out;
  }

  .research-trigger:hover {
    color: var(--color-accent, #7AA2F7);
    background: rgba(122, 162, 247, 0.08);
  }

  .research-trigger--active {
    color: var(--color-accent, #7AA2F7);
    background: rgba(122, 162, 247, 0.1);
  }

  .ai-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin-right: 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted, var(--color-placeholder));
    cursor: pointer;
    flex-shrink: 0;
    transition: color 150ms ease-out, background 150ms ease-out;
  }

  .ai-trigger:hover {
    color: var(--color-accent, #7AA2F7);
    background: rgba(122, 162, 247, 0.08);
  }

  .ai-trigger--active {
    color: var(--color-accent, #7AA2F7);
    background: rgba(122, 162, 247, 0.1);
  }
</style>
