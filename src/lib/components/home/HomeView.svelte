<script lang="ts">
  import { onMount } from "svelte";
  import type { FileNode } from "../../types/core";
  import { presets } from "../../utils/motion";

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

  let viewEl: HTMLDivElement | undefined = $state();
  let titleAnimated = false;
  let filesAnimated = false;
  let actionsAnimated = false;

  onMount(() => {
    if (!viewEl) return;
    const title = viewEl.querySelector('.home-view__title');
    if (title && !titleAnimated) {
      titleAnimated = true;
      presets.fadeInUp(title, { duration: 400 });
    }

    // Actions exist at mount (they're static)
    const actions = viewEl.querySelectorAll('.home-view__action');
    if (actions.length && !actionsAnimated) {
      actionsAnimated = true;
      presets.staggerIn(Array.from(actions), { delay: 200, staggerDelay: 50 });
    }
  });

  // Files may load async
  $effect(() => {
    const _recent = recentFiles;
    const _pinned = pinnedFiles;

    if (!viewEl || filesAnimated) return;

    requestAnimationFrame(() => {
      const files = viewEl!.querySelectorAll('.home-view__file');
      if (files.length > 0) {
        filesAnimated = true;
        presets.staggerIn(Array.from(files), { delay: 50, staggerDelay: 30 });
      }
    });
  });
</script>

<div class="home-view" bind:this={viewEl}>
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
    gap: 32px;
    max-width: 680px;
    width: 100%;
    padding: 40px 28px;
  }

  .home-view__title {
    font-family: var(--font-sans);
    font-size: clamp(1.8rem, 2.5vw, 2.4rem);
    line-height: 1.3;
    color: var(--color-foreground);
    font-weight: 600;
    letter-spacing: -0.03em;
    opacity: 0;
  }

  .home-view__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .home-view__section-title {
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1.4;
    color: var(--color-placeholder);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .home-view__list {
    display: flex;
    flex-direction: column;
  }

  .home-view__file {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    margin: 0 -8px;
    width: calc(100% + 16px);
    border-radius: 4px;
    border: none;
    opacity: 0;
    text-align: left;
    transition: background 150ms ease;
  }

  .home-view__file:hover {
    background: var(--color-hover);
  }

  .home-view__file-name {
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .home-view__file-path {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.4;
    color: var(--color-placeholder);
    flex-shrink: 0;
    margin-left: 12px;
  }

  .home-view__file-time {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.4;
    color: var(--color-placeholder);
    flex-shrink: 0;
    margin-left: 12px;
  }

  .home-view__actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: auto;
    padding-top: 32px;
  }

  .home-view__action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 38px;
    padding: 0 16px;
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--color-muted-foreground);
    background: transparent;
    border: 1px solid var(--color-border);
    opacity: 0;
    border-radius: 6px;
    cursor: pointer;
    transition:
      color 150ms ease,
      background 150ms ease,
      border-color 150ms ease;
  }

  .home-view__action:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
    border-color: var(--color-border);
  }

  .home-view__action-hint {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-placeholder);
    margin-left: 4px;
    padding-left: 12px;
    border-left: 1px solid var(--color-border);
    background: none;
    border-radius: 0;
  }
</style>
