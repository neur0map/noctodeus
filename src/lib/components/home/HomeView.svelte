<script lang="ts">
  import type { FileNode } from "../../types/core";

  let {
    coreName = "Noctodeus",
    recentFiles = [],
    pinnedFiles = [],
    newNoteShortcut = "",
    quickOpenShortcut = "",
    onfileopen,
    onnewnote,
    onquickopen,
    onopencore,
  }: {
    coreName?: string;
    recentFiles?: FileNode[];
    pinnedFiles?: FileNode[];
    newNoteShortcut?: string;
    quickOpenShortcut?: string;
    onfileopen: (path: string) => void;
    onnewnote: () => void;
    onquickopen: () => void;
    onopencore?: () => void;
  } = $props();

  function formatRelativeTime(unixSeconds: number): string {
    const now = Date.now() / 1000;
    const diff = now - unixSeconds;

    if (diff < 60) return "just now";
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
              <button
                class="home-view__file"
                onclick={() => onfileopen(file.path)}
              >
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
              <button
                class="home-view__file"
                onclick={() => onfileopen(file.path)}
              >
                <span class="home-view__file-name">{getDisplayName(file)}</span>
                <span class="home-view__file-time"
                  >{formatRelativeTime(file.modified_at)}</span
                >
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="home-view__actions">
      {#if onopencore}
        <button
          class="home-view__action home-view__action--primary"
          onclick={onopencore}
        >
          <span class="home-view__action-label">Open Core</span>
        </button>
      {/if}
      <button class="home-view__action" onclick={onnewnote}>
        <span class="home-view__action-label">New Note</span>
        {#if newNoteShortcut}
          <kbd class="home-view__action-hint">{newNoteShortcut}</kbd>
        {/if}
      </button>
      <button class="home-view__action" onclick={onquickopen}>
        <span class="home-view__action-label">Open File</span>
        {#if quickOpenShortcut}
          <kbd class="home-view__action-hint">{quickOpenShortcut}</kbd>
        {/if}
      </button>
    </section>
  </div>
</div>

<style>
  .home-view {
    display: flex;
    height: 100%;
  }

  .home-view__content {
    display: flex;
    flex-direction: column;
    gap: calc(var(--space-8) * var(--density-scale));
    max-width: 920px;
    width: 100%;
    padding: calc(var(--stage-inner-padding) * var(--density-scale));
  }

  .home-view__title {
    font-family: var(--font-sans);
    font-size: clamp(2rem, 3vw, 3rem);
    line-height: var(--text-2xl-leading);
    color: var(--color-text-primary);
    font-weight: 600;
    letter-spacing: -0.04em;
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
    padding: calc(var(--space-2) + 1px) var(--space-3);
    margin: 0 calc(-1 * var(--space-2));
    width: calc(100% + var(--space-2) * 2);
    border-radius: 4px;
    border-left: 1px solid transparent;
    text-align: left;
    transition:
      background var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .home-view__file:hover {
    background: rgba(255, 255, 255, 0.04);
    border-left-color: rgba(255, 255, 255, 0.12);
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
    gap: calc(var(--space-3) * var(--density-scale));
    flex-wrap: wrap;
    margin-top: auto;
    padding-top: var(--space-8);
  }

  .home-view__action {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 46px;
    padding: 0 var(--space-4);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: rgba(255, 255, 255, 0.72);
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    transition:
      color var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .home-view__action:hover {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .home-view__action-hint {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: rgba(255, 255, 255, 0.48);
    margin-left: var(--space-1);
    padding-left: var(--space-3);
    border-left: 1px solid rgba(255, 255, 255, 0.08);
    background: none;
    border-radius: 0;
  }
</style>
