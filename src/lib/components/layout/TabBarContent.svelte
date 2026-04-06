<script lang="ts">
  import TabBar from '$lib/components/tabs/TabBar.svelte';
  import SaveIndicator from '$lib/editor/SaveIndicator.svelte';
  import { getTabsState } from '$lib/stores/tabs.svelte';
  import { getEditorState } from '$lib/stores/editor.svelte';

  let {
    isMarkdownActive = false,
  }: {
    isMarkdownActive: boolean | undefined;
  } = $props();

  const tabsState = getTabsState();
  const editor = getEditorState();
</script>

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
