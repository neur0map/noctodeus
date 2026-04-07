<script lang="ts">
  import { animate, springs } from '$lib/utils/motion';

  let {
    output,
    stderr,
    status,
    open = $bindable(false),
    isWeb = false,
    onclear,
  }: {
    output: string;
    stderr: string;
    status: 'idle' | 'running' | 'success' | 'error';
    open: boolean;
    isWeb: boolean;
    onclear: () => void;
  } = $props();

  let contentEl: HTMLDivElement | undefined = $state();
  let consoleLines = $state<{ method: string; text: string }[]>([]);

  let hasContent = $derived(!!(output || stderr));

  function toggle() {
    open = !open;
  }

  // Listen for console messages from web iframe
  function handleIframeMessage(e: MessageEvent) {
    if (e.data?.type === 'console') {
      const { method, args } = e.data as { method: string; args: string[] };
      consoleLines = [...consoleLines, { method, text: args.join(' ') }];
    }
  }

  $effect(() => {
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  });

  // Clear console lines when output clears
  $effect(() => {
    if (!output && !stderr) {
      consoleLines = [];
    }
  });

  // Animate content height on open/close
  $effect(() => {
    if (contentEl) {
      if (open && hasContent) {
        contentEl.style.display = 'block';
        const targetHeight = contentEl.scrollHeight;
        animate(contentEl, {
          height: [0, targetHeight],
          opacity: [0, 1],
          duration: 300,
          ease: springs.snappy,
        });
      } else {
        animate(contentEl, {
          height: 0,
          opacity: 0,
          duration: 200,
          ease: 'outQuint',
          onComplete: () => {
            if (contentEl) contentEl.style.display = 'none';
          },
        });
      }
    }
  });
</script>

<div class="output-drawer">
  <div class="output-drawer__header">
    <button class="output-drawer__toggle" onclick={toggle}>
      <span class="output-drawer__arrow" class:output-drawer__arrow--open={open}>&#x25B8;</span>
      <span class="output-drawer__label">Output</span>
      {#if status === 'running'}
        <span class="output-drawer__running">running...</span>
      {/if}
    </button>
    {#if hasContent && open}
      <button
        class="output-drawer__clear"
        onclick={onclear}
        title="Clear output"
      >
        Clear
      </button>
    {/if}
  </div>

  <div class="output-drawer__content" bind:this={contentEl} style="display: none; height: 0; overflow: hidden;">
    {#if isWeb && output}
      <div class="output-drawer__web">
        <iframe
          class="output-drawer__iframe"
          srcdoc={output}
          sandbox="allow-scripts"
          title="Web preview"
        ></iframe>
        {#if consoleLines.length > 0}
          <div class="output-drawer__console">
            <div class="output-drawer__console-header">Console</div>
            {#each consoleLines as line}
              <div class="output-drawer__console-line" class:output-drawer__console-line--error={line.method === 'error'} class:output-drawer__console-line--warn={line.method === 'warn'}>
                {line.text}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="output-drawer__text">
        {#if output}
          <pre class="output-drawer__stdout">{output}</pre>
        {/if}
        {#if stderr}
          <pre class="output-drawer__stderr">{stderr}</pre>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .output-drawer {
    border-top: 1px solid rgba(255, 255, 255, 0.03);
  }

  .output-drawer__header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .output-drawer__toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    padding: 5px 12px;
    border: none;
    background: none;
    color: var(--text-muted, #6b7394);
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
    text-align: left;
    transition: color 120ms;
  }

  .output-drawer__toggle:hover {
    color: var(--text-primary, #c0caf5);
  }

  .output-drawer__arrow {
    display: inline-block;
    font-size: 10px;
    transition: transform 150ms ease-out;
  }

  .output-drawer__arrow--open {
    transform: rotate(90deg);
  }

  .output-drawer__label {
    user-select: none;
  }

  .output-drawer__running {
    color: var(--accent-blue, #7aa2f7);
    font-size: 10px;
    animation: pulse-text 1.5s ease-in-out infinite;
  }

  @keyframes pulse-text {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }

  .output-drawer__clear {
    margin-left: auto;
    padding: 2px 8px;
    border: none;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-faint, #3b4261);
    font-size: 10px;
    cursor: pointer;
    transition: color 120ms;
  }

  .output-drawer__clear:hover {
    color: var(--text-muted, #6b7394);
  }

  .output-drawer__content {
    overflow: hidden;
  }

  .output-drawer__text {
    max-height: 300px;
    overflow-y: auto;
  }

  .output-drawer__stdout {
    margin: 0;
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 18px;
    color: var(--text-primary, #c0caf5);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .output-drawer__stderr {
    margin: 0;
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 18px;
    color: var(--accent-red, #f7768e);
    white-space: pre-wrap;
    word-break: break-all;
    background: rgba(247, 118, 142, 0.04);
  }

  .output-drawer__web {
    display: flex;
    flex-direction: column;
  }

  .output-drawer__iframe {
    width: 100%;
    height: 200px;
    border: none;
    background: white;
    border-radius: 0;
  }

  .output-drawer__console {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    max-height: 150px;
    overflow-y: auto;
  }

  .output-drawer__console-header {
    padding: 4px 12px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-faint, #3b4261);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: rgba(0, 0, 0, 0.1);
  }

  .output-drawer__console-line {
    padding: 2px 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-primary, #c0caf5);
    line-height: 18px;
  }

  .output-drawer__console-line--error {
    color: var(--accent-red, #f7768e);
  }

  .output-drawer__console-line--warn {
    color: var(--accent-yellow, #e0af68);
  }
</style>
