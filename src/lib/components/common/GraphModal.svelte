<script lang="ts">
  import GraphView from "$lib/components/graph/GraphView.svelte";
  import { getFilesState } from "$lib/stores/files.svelte";
  import { getGraphState } from "$lib/stores/graph.svelte";

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
</script>

{#if visible}
  <div class="graph-modal__backdrop" role="presentation" onclick={onclose} onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}></div>
  <div class="graph-modal">
    <div class="graph-modal__header">
      <span class="graph-modal__title">Knowledge Graph</span>
      <button class="graph-modal__close" onclick={onclose}>&times;</button>
    </div>
    <div class="graph-modal__body">
      <GraphView
        nodes={graphState.nodes}
        edges={graphState.edges}
        activeFilePath={files.activeFilePath}
        onselect={(path) => { onclose(); onfileselect(path); }}
      />
    </div>
  </div>
{/if}

<style>
  .graph-modal__backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 50;
  }

  .graph-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(85vw, 1000px);
    height: min(80vh, 700px);
    background: var(--surface-2, var(--color-popover));
    border-radius: 12px;
    box-shadow: var(--shadow-modal, 0 8px 32px rgba(0, 0, 0, 0.4));
    z-index: 51;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .graph-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md, 12px) var(--space-lg, 20px);
    border-bottom: 1px solid var(--border-subtle, var(--color-border));
  }

  .graph-modal__title {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, var(--color-foreground));
  }

  .graph-modal__close {
    background: none;
    border: none;
    color: var(--text-muted, var(--color-placeholder));
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: color 150ms ease-out, background 150ms ease-out;
  }

  .graph-modal__close:hover {
    color: var(--text-primary, var(--color-foreground));
    background: var(--surface-3, var(--color-hover));
  }

  .graph-modal__body {
    flex: 1;
    min-height: 0;
    padding: var(--space-sm, 8px);
  }
</style>
