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

  /* Map BlockNote's CSS variables to Noctodeus theme tokens */
  .blocknote-container :global([data-color-scheme]) {
    --bn-colors-editor-background: var(--background, var(--color-background)) !important;
    --bn-colors-editor-text: var(--foreground, var(--color-foreground)) !important;
    --bn-colors-menu-background: var(--popover, var(--color-popover)) !important;
    --bn-colors-menu-text: var(--foreground, var(--color-foreground)) !important;
    --bn-colors-tooltip-background: var(--popover, var(--color-popover)) !important;
    --bn-colors-tooltip-text: var(--foreground, var(--color-foreground)) !important;
    --bn-colors-hovered-background: var(--hover, var(--color-accent)) !important;
    --bn-colors-hovered-text: var(--foreground, var(--color-foreground)) !important;
    --bn-colors-selected-background: var(--accent, var(--color-accent)) !important;
    --bn-colors-selected-text: var(--accent-foreground, var(--color-foreground)) !important;
    --bn-colors-disabled-background: var(--muted, var(--color-card)) !important;
    --bn-colors-disabled-text: var(--muted-foreground, var(--color-placeholder)) !important;
    --bn-colors-shadow: var(--shadow-float, 0 4px 16px rgba(0,0,0,0.12)) !important;
    --bn-colors-border: var(--border, var(--color-border)) !important;
    --bn-colors-side-menu: var(--text-muted, var(--color-placeholder)) !important;
    --bn-font-family: var(--font-content) !important;
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
