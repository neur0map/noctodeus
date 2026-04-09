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
    overflow: visible;
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
    max-width: 48px;
  }

  /* Slash menu and suggestion menus need high z-index to stay above everything */
  .blocknote-container :global(.bn-suggestion-menu),
  .blocknote-container :global(.bn-mantine .mantine-Menu-dropdown),
  .blocknote-container :global(.bn-panel) {
    z-index: 100 !important;
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

  /* ── Wiki links ── */
  .blocknote-container :global(.wiki-link) {
    color: var(--accent-blue, var(--color-accent, #7aa2f7));
    cursor: pointer;
    border-bottom: 1px dashed color-mix(in srgb, var(--accent-blue, #7aa2f7) 40%, transparent);
    border-radius: 2px;
    padding: 0 1px;
    transition: opacity 100ms ease;
  }

  .blocknote-container :global(.wiki-link:hover) {
    opacity: 0.8;
    border-bottom-style: solid;
  }

  /* ── Inline AI Prompt ── */
  .blocknote-container :global(.ai-prompt) {
    margin: 4px 0 8px;
    max-width: 900px;
    margin-left: auto;
    margin-right: auto;
    padding: 0 48px 0 48px;
  }

  .blocknote-container :global(.ai-prompt__bar) {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 8px;
    border-radius: 12px;
    background: var(--surface-1, var(--card));
    border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
    transition: border-color 140ms ease;
  }

  .blocknote-container :global(.ai-prompt__bar:focus-within) {
    border-color: color-mix(in srgb, var(--accent-blue, var(--color-accent)) 40%, var(--border));
  }

  .blocknote-container :global(.ai-prompt__chip) {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    color: var(--muted-foreground);
  }

  .blocknote-container :global(.ai-prompt__spinner) {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    color: color-mix(in srgb, var(--accent-blue, var(--color-accent)) 60%, var(--muted-foreground));
    animation: ai-spin 1s linear infinite;
  }

  .blocknote-container :global(.ai-prompt__input) {
    flex: 1;
    min-width: 0;
    border: none !important;
    border-width: 0 !important;
    outline: none !important;
    box-shadow: none !important;
    background: transparent;
    padding: 0;
    font-family: var(--font-content);
    font-size: 0.9rem;
    color: var(--foreground);
    caret-color: var(--accent-blue, var(--color-accent));
  }

  .blocknote-container :global(.ai-prompt__input::placeholder) {
    color: var(--muted-foreground);
  }

  .blocknote-container :global(.ai-prompt__input:disabled) {
    color: var(--muted-foreground);
  }

  .blocknote-container :global(.ai-prompt__send) {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    color: var(--muted-foreground);
    transition: background 140ms ease, color 140ms ease;
  }

  .blocknote-container :global(.ai-prompt__send:disabled) {
    cursor: default;
    opacity: 0.4;
  }

  .blocknote-container :global(.ai-prompt__send--ready) {
    background: var(--accent-blue, var(--color-accent));
    color: var(--primary-foreground, #fff);
    opacity: 1;
  }

  .blocknote-container :global(.ai-prompt__send--ready:hover) {
    filter: brightness(1.1);
  }

  .blocknote-container :global(.ai-prompt__error) {
    margin: 4px 0 0 12px;
    color: var(--accent-red, #f7768e);
    font-size: 12px;
  }

  @keyframes -global-ai-spin {
    to { transform: rotate(360deg); }
  }

</style>
