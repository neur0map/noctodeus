<script lang="ts">
  import { onMount } from 'svelte';
  import type { EditorHandle, WikiItem } from './blocknote/types';

  let {
    path,
    initialContent,
    onnavigate,
    oneditorready,
    oneditordestroy,
    oncontentchange,
    wikiitems,
  }: {
    path: string;
    initialContent: string;
    onnavigate: (target: string) => void;
    oneditorready?: (handle: EditorHandle) => void;
    oneditordestroy?: () => void;
    oncontentchange?: () => void;
    wikiitems?: () => WikiItem[];
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
            wikiItems: wikiitems,
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
    overflow: hidden;
    position: relative;
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
    padding: 36px 28px 36px 48px;
    min-height: 300px;
  }

  /* Keep side menu (drag handle + add button) within the editor bounds */
  .blocknote-container :global(.bn-side-menu) {
    left: 4px !important;
  }

  /* Hide the colored left-edge indicator that bleeds outside */
  .blocknote-container :global(.bn-block-group > [class*="before"]),
  .blocknote-container :global(.ProseMirror > .bn-block-outer::before) {
    display: none !important;
  }

  /* ── File/media placeholder blocks ── */
  /* BlockNote hardcodes rgb(242,241,238) — override with theme */
  .blocknote-container :global([data-file-block] .bn-add-file-button) {
    background-color: var(--surface-1, var(--card)) !important;
    color: var(--muted-foreground) !important;
    border: 1px solid var(--border) !important;
    border-radius: 8px !important;
    width: fit-content !important;
    padding: 8px 20px !important;
  }

  .blocknote-container :global([data-file-block] .bn-file-block-content-wrapper) {
    width: fit-content !important;
  }

  .blocknote-container :global(.bn-editor[contenteditable="true"] [data-file-block] .bn-add-file-button:hover),
  .blocknote-container :global([data-file-block] .bn-file-name-with-icon:hover),
  .blocknote-container :global(.ProseMirror-selectednode .bn-file-name-with-icon) {
    background-color: var(--surface-2, var(--accent)) !important;
  }

  .blocknote-container :global([data-file-block] .bn-file-name-with-icon) {
    background-color: var(--surface-1, var(--card)) !important;
    color: var(--foreground) !important;
    border: 1px solid var(--border) !important;
    border-radius: 8px !important;
  }

  /* ── File panel (upload/embed popup) ── */
  .blocknote-container :global(.bn-panel) {
    background-color: var(--popover) !important;
    border: 1px solid var(--border) !important;
    border-radius: 10px !important;
    box-shadow: var(--shadow-float) !important;
    max-width: 320px !important;
    width: 320px !important;
  }

  /* Mantine tabs in file panel */
  .blocknote-container :global(.bn-panel .mantine-Tabs-tab) {
    color: var(--muted-foreground) !important;
  }

  .blocknote-container :global(.bn-panel .mantine-Tabs-tab[data-active]),
  .blocknote-container :global(.bn-panel .mantine-Tabs-tab[data-active]:hover) {
    color: var(--foreground) !important;
    border-color: var(--foreground) !important;
  }

  .blocknote-container :global(.bn-panel .mantine-Tabs-list::before) {
    border-color: var(--border) !important;
  }

  /* Upload / embed button inside panel */
  .blocknote-container :global(.bn-panel .mantine-Button-root) {
    background-color: var(--surface-2, var(--card)) !important;
    color: var(--foreground) !important;
    border: 1px solid var(--border) !important;
    border-radius: 6px !important;
  }

  .blocknote-container :global(.bn-panel .mantine-Button-root:hover) {
    background-color: var(--accent) !important;
    color: var(--accent-foreground) !important;
  }

  /* Embed URL input */
  .blocknote-container :global(.bn-panel .mantine-TextInput-input),
  .blocknote-container :global(.bn-panel .mantine-FileInput-input) {
    background-color: var(--surface-1, var(--card)) !important;
    color: var(--foreground) !important;
    border: 1px solid var(--border) !important;
    border-radius: 6px !important;
  }

  .blocknote-container :global(.bn-panel .mantine-FileInput-wrapper) {
    border-color: var(--border) !important;
  }

  .blocknote-container :global(.bn-panel .mantine-InputPlaceholder-placeholder) {
    color: var(--muted-foreground) !important;
  }

</style>
