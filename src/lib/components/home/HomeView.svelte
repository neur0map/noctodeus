<script lang="ts">
  import type { FileNode } from '../../types/core';

  let {
    coreName = 'Noctodeus',
    recentFiles = [],
    pinnedFiles = [],
    onfileopen,
    onnewnote,
    onquickopen,
  }: {
    coreName?: string;
    recentFiles?: FileNode[];
    pinnedFiles?: FileNode[];
    onfileopen: (path: string) => void;
    onnewnote: () => void;
    onquickopen: () => void;
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

<div class="home-view">
  <div class="home-view__content">
    <h1 class="home-view__title">{coreName}</h1>

    {#if pinnedFiles.length > 0}
      <section class="home-view__section">
        <h2 class="home-view__section-title">Pinned</h2>
        <ul class="home-view__list">
          {#each pinnedFiles as file (file.path)}
            <li>
              <button class="home-view__file" onclick={() => onfileopen(file.path)}>
                <span class="home-view__file-name">{getDisplayName(file)}</span>
                <span class="home-view__file-path">{file.path}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if recentFiles.length > 0}
      <section class="home-view__section">
        <h2 class="home-view__section-title">Recent</h2>
        <ul class="home-view__list">
          {#each recentFiles.slice(0, 8) as file (file.path)}
            <li>
              <button class="home-view__file" onclick={() => onfileopen(file.path)}>
                <span class="home-view__file-name">{getDisplayName(file)}</span>
                <span class="home-view__file-time">{formatRelativeTime(file.modified_at)}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="home-view__actions">
      <button class="home-view__action" onclick={onnewnote}>
        <span class="home-view__action-label">New Note</span>
        <kbd class="home-view__action-hint">{'\u2318'}N</kbd>
      </button>
      <button class="home-view__action" onclick={onquickopen}>
        <span class="home-view__action-label">Open File</span>
        <kbd class="home-view__action-hint">{'\u2318'}P</kbd>
      </button>
    </section>
  </div>
</div>

<style>
  .home-view {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: var(--color-bg-base);
  }

  .home-view__content {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    max-width: 480px;
    width: 100%;
    padding: var(--space-6);
  }

  .home-view__title {
    font-family: var(--font-mono);
    font-size: var(--text-2xl);
    line-height: var(--text-2xl-leading);
    color: var(--color-text-primary);
    font-weight: 400;
  }

  .home-view__section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .home-view__section-title {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--text-xs-leading);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .home-view__list {
    display: flex;
    flex-direction: column;
  }

  .home-view__file {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    margin: 0 calc(-1 * var(--space-3));
    width: calc(100% + var(--space-3) * 2);
    border-radius: 6px;
    text-align: left;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .home-view__file:hover {
    background: var(--color-bg-hover);
  }

  .home-view__file-name {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: var(--text-sm-leading);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .home-view__file-path {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--text-xs-leading);
    color: var(--color-text-muted);
    flex-shrink: 0;
    margin-left: var(--space-3);
  }

  .home-view__file-time {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--text-xs-leading);
    color: var(--color-text-muted);
    flex-shrink: 0;
    margin-left: var(--space-3);
  }

  .home-view__actions {
    display: flex;
    gap: var(--space-3);
  }

  .home-view__action {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    background: var(--color-bg-hover);
    border-radius: 6px;
    transition:
      color var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out);
  }

  .home-view__action:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-active);
  }

  .home-view__action-hint {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    background: var(--color-bg-surface);
    padding: 1px var(--space-2);
    border-radius: 4px;
  }
</style>
