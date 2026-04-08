<script lang="ts">
  import { onMount } from 'svelte';
  import type { EditorHandle } from './blocknote/types';

  let {
    path,
    initialContent,
    onnavigate,
    oneditorready,
    oneditordestroy,
    oncontentchange,
  }: {
    path: string;
    initialContent: string;
    onnavigate: (target: string) => void;
    oneditorready?: (handle: EditorHandle) => void;
    oneditordestroy?: () => void;
    oncontentchange?: () => void;
  } = $props();

  let containerEl: HTMLDivElement | undefined = $state(undefined);
  let editorHandle: EditorHandle | undefined = $state(undefined);
  let reactRoot: { unmount(): void; render(el: unknown): void } | undefined = undefined;

  onMount(() => {
    let destroyed = false;

    async function bootstrap() {
      if (!containerEl) return;

      try {
        const React = await import('react');
        const ReactDOM = await import('react-dom/client');
        const { default: BlockNoteWrapper } = await import('./blocknote/BlockNoteWrapper');

        if (destroyed) return;

        reactRoot = ReactDOM.createRoot(containerEl);

        reactRoot.render(
          React.createElement(BlockNoteWrapper, {
            initialContent,
            onContentChange: () => {
              oncontentchange?.();
            },
            onNavigate: onnavigate,
            onEditorReady: (handle: EditorHandle) => {
              editorHandle = handle;
              oneditorready?.(handle);
            },
            onEditorDestroy: () => {
              editorHandle = undefined;
              oneditordestroy?.();
            },
            darkMode: document.documentElement.getAttribute('data-theme') === 'dark',
          }),
        );
      } catch (err) {
        console.error('[BlockNoteEditor] Failed to mount React:', err);
        if (containerEl) {
          containerEl.textContent = `Editor failed to load: ${err}`;
        }
      }
    }

    bootstrap();

    return () => {
      destroyed = true;
      if (reactRoot) {
        reactRoot.unmount();
        reactRoot = undefined;
      }
      editorHandle = undefined;
    };
  });

  export async function flush(): Promise<void> {
    // Save is handled by the parent Editor.svelte
  }

  export async function reload(newContent: string): Promise<void> {
    if (editorHandle) {
      await editorHandle.setContent(newContent);
    }
  }

  export function getEditorHandle(): EditorHandle | undefined {
    return editorHandle;
  }
</script>

<div class="blocknote-container" bind:this={containerEl}></div>

<style>
  .blocknote-container {
    width: 100%;
    min-height: 100%;
    flex: 1;
  }

  /* Map BlockNote's CSS variables to Noctodeus theme tokens.
     Use :global on the .bn-container which BlockNote always renders. */
  .blocknote-container :global(.bn-container),
  .blocknote-container :global(.bn-container[data-color-scheme="light"]),
  .blocknote-container :global(.bn-container[data-color-scheme="dark"]) {
    --bn-colors-editor-background: var(--background) !important;
    --bn-colors-editor-text: var(--foreground) !important;
    --bn-colors-menu-background: var(--popover) !important;
    --bn-colors-menu-text: var(--popover-foreground) !important;
    --bn-colors-tooltip-background: var(--popover) !important;
    --bn-colors-tooltip-text: var(--popover-foreground) !important;
    --bn-colors-hovered-background: var(--accent) !important;
    --bn-colors-hovered-text: var(--accent-foreground) !important;
    --bn-colors-selected-background: var(--accent) !important;
    --bn-colors-selected-text: var(--accent-foreground) !important;
    --bn-colors-disabled-background: var(--muted) !important;
    --bn-colors-disabled-text: var(--muted-foreground) !important;
    --bn-colors-border: var(--border) !important;
    --bn-colors-side-menu: var(--muted-foreground) !important;
    --bn-font-family: var(--font-content) !important;
    --bn-shadow-medium: var(--shadow-float) !important;
  }

  .blocknote-container :global(.bn-container) {
    min-height: 100%;
  }

  .blocknote-container :global(.bn-editor) {
    max-width: 900px;
    margin: 0 auto;
    padding: 36px 28px;
    min-height: 300px;
  }
</style>
