<script lang="ts">
  import type { FileNode } from '../../types/core';

  let {
    pinnedFiles = [],
    recentFiles = [],
    onfileopen,
  }: {
    pinnedFiles?: FileNode[];
    recentFiles?: FileNode[];
    onfileopen: (path: string) => void;
  } = $props();

  function getDisplayName(file: FileNode): string {
    return file.title || file.name;
  }
</script>

<section class="quick-access-section">
  <h2 class="section-title">Quick Access</h2>

  {#if pinnedFiles.length > 0}
    <div class="pinned-grid">
      {#each pinnedFiles as file (file.path)}
        <button class="pinned-card" onclick={() => onfileopen(file.path)}>
          <span class="pinned-card__icon">&#9671;</span>
          <span class="pinned-card__title">{getDisplayName(file)}</span>
          <span class="pinned-card__path">{file.path}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if recentFiles.length > 0}
    <div class="recent-chips">
      <h3 class="subsection-title">Recently Opened</h3>
      <div class="chips-row">
        {#each recentFiles.slice(0, 8) as file (file.path)}
          <button class="chip" onclick={() => onfileopen(file.path)}>
            {getDisplayName(file)}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .quick-access-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .section-title {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .subsection-title {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: rgba(255, 255, 255, 0.36);
    letter-spacing: 0.03em;
    margin-bottom: var(--space-2);
  }

  .pinned-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-3);
  }

  .pinned-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4);
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    text-align: left;
    cursor: pointer;
    transition:
      background var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      transform var(--duration-normal) var(--ease-out),
      box-shadow var(--duration-normal) var(--ease-out);
  }

  .pinned-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .pinned-card__icon {
    font-size: 10px;
    color: var(--color-accent);
    opacity: 0.7;
  }

  .pinned-card__title {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pinned-card__path {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chips-row {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    padding-bottom: var(--space-1);
    scrollbar-width: none;
  }

  .chips-row::-webkit-scrollbar {
    display: none;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    padding: var(--space-1) var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: rgba(255, 255, 255, 0.64);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition:
      color var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .chip:hover {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
  }
</style>
