<script lang="ts">
  import type { FileNode } from '../../types/core';

  let {
    recentFiles = [],
    totalNotes = 0,
    onfileopen,
  }: {
    recentFiles?: FileNode[];
    totalNotes?: number;
    onfileopen: (path: string) => void;
  } = $props();

  function formatRelativeTime(unixSeconds: number): string {
    const now = Date.now() / 1000;
    const diff = now - unixSeconds;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 604800)}w ago`;
  }

  function getDisplayName(file: FileNode): string {
    return file.title || file.name;
  }
</script>

<section class="activity-section">
  <h2 class="section-title">Activity</h2>

  <div class="stat-blocks">
    <div class="stat-block">
      <span class="stat-block__value">{totalNotes}</span>
      <span class="stat-block__label">Notes</span>
    </div>
  </div>

  {#if recentFiles.length > 0}
    <div class="recent-list">
      <h3 class="subsection-title">Recent Edits</h3>
      {#each recentFiles.slice(0, 10) as file (file.path)}
        <button class="recent-item" onclick={() => onfileopen(file.path)}>
          <span class="recent-item__name">{getDisplayName(file)}</span>
          <span class="recent-item__time">{formatRelativeTime(file.modified_at)}</span>
        </button>
      {/each}
    </div>
  {/if}
</section>

<style>
  .activity-section {
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
    margin-bottom: var(--space-1);
  }

  .stat-blocks {
    display: flex;
    gap: var(--space-3);
  }

  .stat-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3) var(--space-4);
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    min-width: 80px;
  }

  .stat-block__value {
    font-family: var(--font-mono);
    font-size: var(--text-lg);
    color: var(--color-text-primary);
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .stat-block__label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .recent-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    margin: 0 calc(-1 * var(--space-2));
    width: calc(100% + var(--space-2) * 2);
    border-radius: 6px;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    transition:
      background var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .recent-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .recent-item__name {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recent-item__time {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    flex-shrink: 0;
    margin-left: var(--space-3);
  }
</style>
