<script lang="ts">
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
</script>

<div class="output-drawer">
  {#if open && (output || stderr)}
    <pre>{output}{stderr}</pre>
  {/if}
</div>

<style>
  .output-drawer {
    border-top: 1px solid rgba(255, 255, 255, 0.03);
  }

  pre {
    margin: 0;
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-primary, #c0caf5);
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
