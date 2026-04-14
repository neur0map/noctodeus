<script lang="ts">
  import { getWikiState } from '../../stores/wiki.svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import X from '@lucide/svelte/icons/x';
  import Loader from '@lucide/svelte/icons/loader';
  import Check from '@lucide/svelte/icons/check';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';

  const wiki = getWikiState();
  let expanded = $state(false);
  let logContainer: HTMLDivElement | undefined = $state();

  let phase = $derived(wiki.progress?.phase ?? 'collecting');
  let isDone = $derived(phase === 'done');
  let isError = $derived(phase === 'error');
  let isActive = $derived(!isDone && !isError);
  let pct = $derived(
    wiki.progress && wiki.progress.totalSources > 0
      ? Math.round((wiki.progress.processedSources / wiki.progress.totalSources) * 100)
      : 0
  );

  $effect(() => {
    // Auto-scroll log to bottom
    if (expanded && logContainer && wiki.progress?.log) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  });
</script>

{#if wiki.progressVisible && wiki.progress}
  <div class="ingest-bar" class:ingest-bar--done={isDone} class:ingest-bar--error={isError}>
    <!-- Main row -->
    <div class="ingest-bar__main">
      <div class="ingest-bar__icon">
        {#if isActive}
          <Loader size={14} class="ingest-bar__spinner" />
        {:else if isDone}
          <Check size={14} />
        {:else}
          <AlertTriangle size={14} />
        {/if}
      </div>

      <div class="ingest-bar__info">
        <span class="ingest-bar__status">
          {#if isActive}
            Wiki: Ingesting {wiki.progress.processedSources}/{wiki.progress.totalSources} sources
          {:else if isDone}
            Wiki: {wiki.progress.currentAction}
          {:else}
            Wiki: {wiki.progress.currentAction}
          {/if}
        </span>
        {#if isActive && wiki.progress.currentAction}
          <span class="ingest-bar__detail">{wiki.progress.currentAction}</span>
        {/if}
      </div>

      {#if isActive && wiki.progress.totalSources > 0}
        <div class="ingest-bar__progress">
          <div class="ingest-bar__progress-fill" style:width="{pct}%"></div>
        </div>
      {/if}

      <button
        class="ingest-bar__expand"
        onclick={() => expanded = !expanded}
        title={expanded ? 'Collapse log' : 'Show log'}
      >
        <ChevronDown size={12} style={expanded ? 'transform: rotate(180deg)' : ''} />
      </button>

      {#if !isActive}
        <button
          class="ingest-bar__dismiss"
          onclick={() => wiki.dismissProgress()}
          title="Dismiss"
        >
          <X size={12} />
        </button>
      {/if}
    </div>

    <!-- Expandable log -->
    {#if expanded}
      <div class="ingest-bar__log" bind:this={logContainer}>
        {#each wiki.progress.log as entry}
          <div class="ingest-bar__log-entry" class:ingest-bar__log-entry--error={entry.startsWith('Error')}>
            {entry}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .ingest-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 400;
    background: var(--surface-2, var(--color-popover));
    border-top: 1px solid rgba(187, 154, 247, 0.2);
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.3);
    animation: slide-up 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ingest-bar--done {
    border-top-color: rgba(158, 206, 106, 0.3);
  }

  .ingest-bar--error {
    border-top-color: rgba(247, 118, 142, 0.3);
  }

  @keyframes slide-up {
    from { transform: translateY(100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .ingest-bar__main {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    min-height: 36px;
  }

  .ingest-bar__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--accent-purple, #bb9af7);
  }

  .ingest-bar--done .ingest-bar__icon {
    color: var(--accent-green, #9ece6a);
  }

  .ingest-bar--error .ingest-bar__icon {
    color: var(--accent-red, #f7768e);
  }

  .ingest-bar__icon :global(.ingest-bar__spinner) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .ingest-bar__info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }

  .ingest-bar__status {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--color-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ingest-bar__detail {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ingest-bar__progress {
    width: 80px;
    height: 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .ingest-bar__progress-fill {
    height: 100%;
    background: var(--accent-purple, #bb9af7);
    border-radius: 2px;
    transition: width 300ms ease-out;
  }

  .ingest-bar__expand,
  .ingest-bar__dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 150ms ease-out, background 150ms ease-out;
  }

  .ingest-bar__expand:hover,
  .ingest-bar__dismiss:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  .ingest-bar__log {
    max-height: 180px;
    overflow-y: auto;
    padding: 0 16px 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
  }

  .ingest-bar__log-entry {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-muted-foreground);
    padding: 2px 0;
    line-height: 1.5;
  }

  .ingest-bar__log-entry--error {
    color: var(--accent-red, #f7768e);
  }
</style>
