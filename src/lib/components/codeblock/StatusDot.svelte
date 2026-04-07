<script lang="ts">
  let {
    status,
  }: {
    status: 'idle' | 'running' | 'success' | 'error';
  } = $props();
</script>

<span
  class="status-dot"
  class:status-dot--idle={status === 'idle'}
  class:status-dot--running={status === 'running'}
  class:status-dot--success={status === 'success'}
  class:status-dot--error={status === 'error'}
></span>

<style>
  .status-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-dot--idle {
    background: var(--text-faint, #3b4261);
  }

  .status-dot--running {
    background: var(--accent-blue, #7aa2f7);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .status-dot--success {
    background: var(--accent-green, #9ece6a);
  }

  .status-dot--error {
    background: var(--accent-red, #f7768e);
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }
</style>
