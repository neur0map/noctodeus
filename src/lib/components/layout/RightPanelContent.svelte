<script lang="ts">
  import GraphView from "$lib/components/graph/GraphView.svelte";
  import BacklinksPanel from "$lib/components/panels/BacklinksPanel.svelte";
  import OutlinePanel from "$lib/components/panels/OutlinePanel.svelte";
  import NoteDetailsPanel from "$lib/components/panels/NoteDetailsPanel.svelte";
  import { getUiState } from "$lib/stores/ui.svelte";
  import { getFilesState } from "$lib/stores/files.svelte";
  import { getGraphState } from "$lib/stores/graph.svelte";
  import { getActiveEditorState } from "$lib/stores/active-editor.svelte";

  let { onFileSelect }: { onFileSelect: (path: string) => void } = $props();

  const ui = getUiState();
  const files = getFilesState();
  const graphState = getGraphState();
  const activeEditorState = getActiveEditorState();
</script>

<div class="right-panel">
  {#if ui.graphPanelVisible}
    <div class="right-panel__section right-panel__section--graph">
      <div class="right-panel__section-header">
        <span class="right-panel__section-label">Graph</span>
      </div>
      <div class="right-panel__graph-body">
        <GraphView
          nodes={graphState.nodes}
          edges={graphState.edges}
          activeFilePath={files.activeFilePath}
          onselect={onFileSelect}
        />
      </div>
    </div>
  {/if}

  {#if ui.rightPanelVisible}
    <div class="right-panel__section right-panel__section--scroll">
      <NoteDetailsPanel
        editor={activeEditorState.editor}
        fileNode={files.activeFilePath ? files.fileMap.get(files.activeFilePath) ?? null : null}
      />
      <OutlinePanel editor={activeEditorState.editor} />
    </div>

    <div class="right-panel__section right-panel__section--scroll">
      <BacklinksPanel
        currentPath={files.activeFilePath}
        currentTitle={files.activeFilePath ? (files.fileMap.get(files.activeFilePath)?.title ?? null) : null}
        currentAliases={files.activeFilePath ? (files.fileMap.get(files.activeFilePath)?.aliases ?? []) : []}
        nodes={graphState.nodes}
        edges={graphState.edges}
        onselect={onFileSelect}
      />
    </div>
  {/if}
</div>

<style>
  /* ── Right panel ── */
  .right-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-card);
    overflow: hidden;
  }

  .right-panel__section {
    border-bottom: 1px solid var(--color-border);
  }

  .right-panel__section--graph {
    flex: 1;
    min-height: 140px;
    display: flex;
    flex-direction: column;
  }

  .right-panel__section--scroll {
    flex-shrink: 0;
    max-height: 35%;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .right-panel__section--scroll::-webkit-scrollbar { display: none; }

  .right-panel__section-header {
    padding: 8px 12px;
  }

  .right-panel__section-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .right-panel__graph-body {
    flex: 1;
    min-height: 0;
    padding: 0 8px 8px;
  }
</style>
