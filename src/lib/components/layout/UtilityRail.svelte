<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import { getUiState } from "$lib/stores/ui.svelte";
  import { nerdIcon } from "$lib/utils/nerd-icons";

  let { onNewNote }: { onNewNote: () => void } = $props();

  const ui = getUiState();
</script>

<div class="utility-rail">
  <button
    class="utility-rail__button"
    class:utility-rail__button--active={ui.commandPaletteVisible}
    onclick={() => ui.showCommandPalette()}
    title="Command palette"
  >
    <span class="utility-rail__icon">{nerdIcon('search')}</span>
    <span class="utility-rail__label">cmd</span>
  </button>
  <button
    class="utility-rail__button"
    class:utility-rail__button--active={ui.tasksVisible}
    onclick={() => ui.showTasks()}
    title="Tasks"
  >
    <span class="utility-rail__icon">{nerdIcon('tasks')}</span>
    <span class="utility-rail__label">tasks</span>
  </button>
  <button
    class="utility-rail__button"
    class:utility-rail__button--active={ui.graphPanelVisible}
    onclick={() => ui.toggleGraphPanel()}
    title="Toggle graph"
  >
    <span class="utility-rail__icon">{nerdIcon('graph')}</span>
    <span class="utility-rail__label">graph</span>
  </button>
  <button
    class="utility-rail__button"
    class:utility-rail__button--active={ui.rightPanelVisible}
    onclick={() => ui.toggleRightPanel()}
    title="Toggle detail rail"
  >
    <span class="utility-rail__icon">{nerdIcon('info')}</span>
    <span class="utility-rail__label">panel</span>
  </button>
  <button
    class="utility-rail__button"
    onclick={onNewNote}
    title="New note"
  >
    <Plus size={16} />
    <span class="utility-rail__label">new</span>
  </button>
</div>

<style>
  /* ── Utility rail ── */
  .utility-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm, 8px);
    padding-top: var(--space-lg, 20px);
  }

  .utility-rail__button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs, 4px);
    padding: 10px 6px;
    color: var(--text-muted, var(--color-placeholder));
    transition: color 150ms ease-out;
    cursor: pointer;
    background: none;
    border: none;
    width: 100%;
  }

  .utility-rail__button:hover {
    color: var(--text-secondary, var(--color-muted-foreground));
  }

  .utility-rail__button--active {
    color: var(--accent-blue, var(--color-accent));
  }

  .utility-rail__icon {
    font-family: var(--font-mono);
    font-size: 16px;
    line-height: 1;
  }

  .utility-rail__label {
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1;
  }
</style>
