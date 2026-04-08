<script lang="ts">
  import Wrench from '@lucide/svelte/icons/wrench';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import CircleCheck from '@lucide/svelte/icons/circle-check';

  let {
    toolName,
    arguments: args,
    result,
    loading,
    error,
  }: {
    toolName: string;
    arguments: any;
    result: string | null;
    loading: boolean;
    error: string | null;
  } = $props();

  let expanded = $state(false);

  let argsString = $derived(() => {
    if (!args) return '';
    try {
      return typeof args === 'string' ? args : JSON.stringify(args, null, 2);
    } catch {
      return String(args);
    }
  });

  let statusIcon = $derived(() => {
    if (loading) return 'loading';
    if (error) return 'error';
    if (result !== null) return 'success';
    return 'idle';
  });
</script>

<div class="tcb" class:tcb--loading={loading} class:tcb--error={!!error}>
  <button class="tcb__header" onclick={() => expanded = !expanded}>
    <span class="tcb__status">
      {#if statusIcon() === 'loading'}
        <LoaderCircle size={12} class="tcb__spinner" />
      {:else if statusIcon() === 'error'}
        <CircleAlert size={12} />
      {:else if statusIcon() === 'success'}
        <CircleCheck size={12} />
      {:else}
        <Wrench size={12} />
      {/if}
    </span>
    <span class="tcb__label">tool</span>
    <span class="tcb__name">{toolName}</span>
    <span class="tcb__chevron" class:tcb__chevron--open={expanded}>
      <ChevronRight size={11} />
    </span>
  </button>

  {#if expanded}
    <div class="tcb__body">
      {#if argsString()}
        <div class="tcb__section">
          <span class="tcb__section-label">Arguments</span>
          <pre class="tcb__code">{argsString()}</pre>
        </div>
      {/if}

      {#if result !== null}
        <div class="tcb__section">
          <span class="tcb__section-label">Result</span>
          <pre class="tcb__code tcb__code--result">{result}</pre>
        </div>
      {/if}

      {#if error}
        <div class="tcb__section">
          <span class="tcb__section-label">Error</span>
          <pre class="tcb__code tcb__code--error">{error}</pre>
        </div>
      {/if}
    </div>
  {/if}

  {#if loading}
    <div class="tcb__progress"></div>
  {/if}
</div>

<style lang="scss">
  .tcb {
    margin: 4px 16px;
    border: 1px solid rgba(122, 162, 247, 0.12);
    border-radius: 6px;
    background: rgba(122, 162, 247, 0.04);
    overflow: hidden;
    animation: tcb-in 200ms ease both;
    position: relative;
  }

  @keyframes tcb-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .tcb--loading {
    border-color: rgba(122, 162, 247, 0.2);
  }

  .tcb--error {
    border-color: rgba(247, 118, 142, 0.2);
    background: rgba(247, 118, 142, 0.04);
  }

  .tcb__header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-muted-foreground);
    text-align: left;
    transition: background 150ms;

    &:hover {
      background: rgba(255, 255, 255, 0.03);
    }
  }

  .tcb__status {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--color-accent, #7AA2F7);
  }

  .tcb--error .tcb__status {
    color: #f7768e;
  }

  .tcb__status :global(.tcb__spinner) {
    animation: tcb-spin 1s linear infinite;
  }

  // Fallback: target the svg directly inside status when loading
  .tcb--loading .tcb__status :global(svg) {
    animation: tcb-spin 1s linear infinite;
  }

  @keyframes tcb-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .tcb__label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-placeholder);
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 5px;
    border-radius: 3px;
  }

  .tcb__name {
    color: var(--color-accent, #7AA2F7);
    font-weight: 500;
  }

  .tcb--error .tcb__name {
    color: #f7768e;
  }

  .tcb__chevron {
    margin-left: auto;
    display: flex;
    align-items: center;
    transition: transform 150ms;
  }

  .tcb__chevron--open {
    transform: rotate(90deg);
  }

  .tcb__body {
    padding: 0 10px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tcb__section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tcb__section-label {
    font-family: var(--font-mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-placeholder);
  }

  .tcb__code {
    margin: 0;
    padding: 8px 10px;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.5;
    color: var(--color-muted-foreground);
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
    max-height: 200px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.06) transparent;
  }

  .tcb__code--result {
    color: #9ece6a;
  }

  .tcb__code--error {
    color: #f7768e;
  }

  .tcb__progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba(122, 162, 247, 0.15);
    overflow: hidden;

    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: -40%;
      width: 40%;
      height: 100%;
      background: var(--color-accent, #7AA2F7);
      animation: tcb-progress 1.2s ease-in-out infinite;
    }
  }

  @keyframes tcb-progress {
    0% { left: -40%; }
    100% { left: 100%; }
  }

  @media (prefers-reduced-motion: reduce) {
    .tcb { animation: none; }
    .tcb--loading .tcb__status :global(svg) { animation: none; }
    .tcb__progress::after { animation: none; left: 0; width: 100%; }
  }
</style>
