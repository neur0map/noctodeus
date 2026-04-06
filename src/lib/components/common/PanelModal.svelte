<script lang="ts">
  import NoteDetailsPanel from "$lib/components/panels/NoteDetailsPanel.svelte";
  import OutlinePanel from "$lib/components/panels/OutlinePanel.svelte";
  import BacklinksPanel from "$lib/components/panels/BacklinksPanel.svelte";
  import { getFilesState } from "$lib/stores/files.svelte";
  import { getGraphState } from "$lib/stores/graph.svelte";
  import { getActiveEditorState } from "$lib/stores/active-editor.svelte";

  let {
    visible,
    onclose,
    onfileselect,
  }: {
    visible: boolean;
    onclose: () => void;
    onfileselect: (path: string) => void;
  } = $props();

  const files = getFilesState();
  const graphState = getGraphState();
  const activeEditorState = getActiveEditorState();
</script>

{#if visible}
  <div class="panel-modal__backdrop" role="presentation" onclick={onclose} onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}></div>
  <div class="panel-modal">
    <div class="panel-modal__header">
      <span class="panel-modal__title">Note Panel</span>
      <button class="panel-modal__close" onclick={onclose}>&times;</button>
    </div>
    <div class="panel-modal__body">
      <div class="panel-modal__section">
        <NoteDetailsPanel
          editor={activeEditorState.editor}
          fileNode={files.activeFilePath ? files.fileMap.get(files.activeFilePath) ?? null : null}
        />
      </div>
      <div class="panel-modal__section">
        <OutlinePanel editor={activeEditorState.editor} />
      </div>
      <div class="panel-modal__section">
        <BacklinksPanel
          currentPath={files.activeFilePath}
          currentTitle={files.activeFilePath ? (files.fileMap.get(files.activeFilePath)?.title ?? null) : null}
          currentAliases={files.activeFilePath ? (files.fileMap.get(files.activeFilePath)?.aliases ?? []) : []}
          nodes={graphState.nodes}
          edges={graphState.edges}
          onselect={(path) => { onclose(); onfileselect(path); }}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  .panel-modal__backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 50;
  }

  .panel-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(80vw, 900px);
    max-height: 80vh;
    background: var(--surface-2, var(--color-popover));
    border-radius: 12px;
    box-shadow: var(--shadow-modal, 0 8px 32px rgba(0, 0, 0, 0.4));
    z-index: 51;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .panel-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md, 12px) var(--space-lg, 20px);
    border-bottom: 1px solid var(--border-subtle, var(--color-border));
  }

  .panel-modal__title {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, var(--color-foreground));
  }

  .panel-modal__close {
    background: none;
    border: none;
    color: var(--text-muted, var(--color-placeholder));
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: color 150ms ease-out, background 150ms ease-out;
  }

  .panel-modal__close:hover {
    color: var(--text-primary, var(--color-foreground));
    background: var(--surface-3, var(--color-hover));
  }

  .panel-modal__body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg, 20px);
  }

  .panel-modal__section {
    margin-bottom: var(--space-lg, 20px);
  }

  .panel-modal__section:last-child {
    margin-bottom: 0;
  }
</style>
