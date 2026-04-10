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
    animation: -global-ai-prompt-in 280ms cubic-bezier(0.16, 1, 0.3, 1);
    transform-origin: left center;
  }

  .blocknote-container :global(.ai-prompt--closing) {
    animation: -global-ai-prompt-out 220ms cubic-bezier(0.4, 0, 1, 1) forwards;
    pointer-events: none;
  }

  @keyframes -global-ai-prompt-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes -global-ai-prompt-out {
    from { opacity: 1; transform: translateY(0) scale(1); }
    to   { opacity: 0; transform: translateY(-4px) scale(0.985); }
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
    transition:
      background 140ms ease,
      color 140ms ease,
      transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .blocknote-container :global(.ai-prompt__send--ready:active) {
    transform: scale(0.92);
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

  .blocknote-container :global(.ai-prompt__preview) {
    margin-top: 8px;
    padding: 12px 14px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--foreground) 5%, transparent);
    color: var(--muted-foreground);
    font-family: var(--font-content);
    font-size: 0.85rem;
    line-height: 1.6;
    max-height: 200px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    scrollbar-width: thin;
  }

  .blocknote-container :global(.ai-prompt__error) {
    margin: 4px 0 0 12px;
    color: var(--accent-red, #f7768e);
    font-size: 12px;
  }

  @keyframes -global-ai-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Fabric Pattern Executor overlay ── */
  .blocknote-container :global(.pattern-executor) {
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 80;
    width: min(560px, calc(100vw - 48px));
    pointer-events: auto;
    animation: -global-pattern-rise 340ms cubic-bezier(0.2, 0.9, 0.3, 1);
  }

  .blocknote-container :global(.pattern-executor--closing) {
    animation: -global-pattern-fall 240ms cubic-bezier(0.4, 0, 1, 1) forwards;
    pointer-events: none;
  }

  .blocknote-container :global(.pattern-executor__inner) {
    display: flex;
    flex-direction: column;
    background: var(--popover);
    border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    border-radius: 12px;
    box-shadow:
      0 1px 0 0 color-mix(in srgb, var(--foreground) 3%, transparent) inset,
      0 12px 40px -8px color-mix(in srgb, #000 55%, transparent),
      0 2px 8px -2px color-mix(in srgb, #000 30%, transparent);
    overflow: hidden;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .blocknote-container :global(.pattern-executor__header) {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
    background: color-mix(in srgb, var(--foreground) 3%, transparent);
  }

  .blocknote-container :global(.pattern-executor__icon) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--accent-blue, var(--color-accent, #7aa2f7)) 14%, transparent);
    color: var(--accent-blue, var(--color-accent, #7aa2f7));
    flex-shrink: 0;
  }

  .blocknote-container :global(.pattern-executor__meta) {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  .blocknote-container :global(.pattern-executor__category) {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted-foreground);
    line-height: 1;
  }

  .blocknote-container :global(.pattern-executor__name) {
    font-family: var(--font-content);
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .blocknote-container :global(.pattern-executor__status) {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-foreground);
    flex-shrink: 0;
  }

  .blocknote-container :global(.pattern-executor__status--error) {
    color: var(--accent-red, #f7768e);
  }

  .blocknote-container :global(.pattern-executor__pulse) {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-blue, var(--color-accent, #7aa2f7));
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-blue, #7aa2f7) 60%, transparent);
    animation: -global-pattern-pulse 1.4s ease-out infinite;
  }

  .blocknote-container :global(.pattern-executor__feed) {
    padding: 14px 16px;
    max-height: 260px;
    overflow-y: auto;
    font-family: var(--font-content);
    font-size: 13px;
    line-height: 1.6;
    color: var(--foreground);
    white-space: pre-wrap;
    word-break: break-word;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--foreground) 20%, transparent) transparent;
  }

  .blocknote-container :global(.pattern-executor__feed::-webkit-scrollbar) {
    width: 6px;
  }

  .blocknote-container :global(.pattern-executor__feed::-webkit-scrollbar-thumb) {
    background: color-mix(in srgb, var(--foreground) 20%, transparent);
    border-radius: 3px;
  }

  .blocknote-container :global(.pattern-executor__placeholder) {
    color: var(--muted-foreground);
    font-style: italic;
  }

  /* Rendered markdown inside the streaming preview */
  .blocknote-container :global(.pattern-executor__feed > *:first-child) {
    margin-top: 0;
  }
  .blocknote-container :global(.pattern-executor__feed > *:last-child) {
    margin-bottom: 0;
  }
  .blocknote-container :global(.pattern-executor__feed p) {
    margin: 0 0 10px;
  }
  .blocknote-container :global(.pattern-executor__feed h1),
  .blocknote-container :global(.pattern-executor__feed h2),
  .blocknote-container :global(.pattern-executor__feed h3),
  .blocknote-container :global(.pattern-executor__feed h4) {
    margin: 16px 0 6px;
    font-weight: 600;
    color: var(--foreground);
    letter-spacing: -0.005em;
  }
  .blocknote-container :global(.pattern-executor__feed h1) { font-size: 16px; }
  .blocknote-container :global(.pattern-executor__feed h2) { font-size: 14px; }
  .blocknote-container :global(.pattern-executor__feed h3),
  .blocknote-container :global(.pattern-executor__feed h4) { font-size: 13px; }
  .blocknote-container :global(.pattern-executor__feed ul),
  .blocknote-container :global(.pattern-executor__feed ol) {
    margin: 0 0 10px;
    padding-left: 20px;
  }
  .blocknote-container :global(.pattern-executor__feed li) {
    margin: 3px 0;
  }
  .blocknote-container :global(.pattern-executor__feed li::marker) {
    color: color-mix(in srgb, var(--accent-blue, var(--color-accent, #7aa2f7)) 80%, transparent);
  }
  .blocknote-container :global(.pattern-executor__feed code) {
    font-family: var(--font-mono);
    font-size: 0.88em;
    padding: 1px 5px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
  }
  .blocknote-container :global(.pattern-executor__feed pre) {
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 10px 12px;
    margin: 10px 0;
    border-radius: 7px;
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
    overflow-x: auto;
  }
  .blocknote-container :global(.pattern-executor__feed pre code) {
    padding: 0;
    background: transparent;
  }
  .blocknote-container :global(.pattern-executor__feed strong) {
    font-weight: 600;
    color: var(--foreground);
  }
  .blocknote-container :global(.pattern-executor__feed em) {
    font-style: italic;
  }
  .blocknote-container :global(.pattern-executor__feed blockquote) {
    margin: 8px 0;
    padding: 2px 0 2px 12px;
    border-left: 2px solid color-mix(in srgb, var(--accent-blue, #7aa2f7) 60%, transparent);
    color: var(--muted-foreground);
    font-style: italic;
  }
  .blocknote-container :global(.pattern-executor__feed hr) {
    border: none;
    border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    margin: 12px 0;
  }
  .blocknote-container :global(.pattern-executor__feed a) {
    color: var(--accent-blue, var(--color-accent, #7aa2f7));
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .blocknote-container :global(.pattern-executor__error) {
    padding: 18px 16px;
    font-family: var(--font-content);
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--accent-red, #f7768e);
    background: color-mix(in srgb, var(--accent-red, #f7768e) 6%, transparent);
  }

  .blocknote-container :global(.pattern-executor__footer) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-top: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
    background: color-mix(in srgb, var(--foreground) 2%, transparent);
  }

  .blocknote-container :global(.pattern-executor__hint) {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-foreground);
  }

  .blocknote-container :global(.pattern-executor__actions) {
    display: flex;
    gap: 8px;
  }

  .blocknote-container :global(.pattern-executor__btn) {
    font-family: var(--font-content);
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    padding: 8px 14px;
    border-radius: 7px;
    border: 1px solid transparent;
    cursor: pointer;
    transition:
      background 140ms ease,
      color 140ms ease,
      border-color 140ms ease,
      opacity 140ms ease,
      transform 120ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .blocknote-container :global(.pattern-executor__btn:active:not(:disabled)) {
    transform: scale(0.96);
  }

  .blocknote-container :global(.pattern-executor__btn--ghost) {
    background: transparent;
    color: var(--muted-foreground);
    border-color: color-mix(in srgb, var(--border) 60%, transparent);
  }

  .blocknote-container :global(.pattern-executor__btn--ghost:hover) {
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    border-color: var(--border);
  }

  .blocknote-container :global(.pattern-executor__btn--primary) {
    background: var(--accent-blue, var(--color-accent, #7aa2f7));
    color: var(--primary-foreground, #0b0d12);
  }

  .blocknote-container :global(.pattern-executor__btn--primary:hover:not(:disabled)) {
    filter: brightness(1.08);
  }

  .blocknote-container :global(.pattern-executor__btn--primary:disabled) {
    background: color-mix(in srgb, var(--foreground) 12%, transparent);
    color: var(--muted-foreground);
    cursor: default;
  }

  @keyframes -global-pattern-rise {
    from {
      opacity: 0;
      transform: translate(-50%, 16px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  @keyframes -global-pattern-fall {
    from {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    to {
      opacity: 0;
      transform: translate(-50%, 12px);
    }
  }

  @keyframes -global-pattern-pulse {
    0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-blue, #7aa2f7) 55%, transparent); }
    70%  { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent-blue, #7aa2f7) 0%, transparent); }
    100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-blue, #7aa2f7) 0%, transparent); }
  }

  /* ── Slash menu AI icon accent ── */
  /* Tint the Fabric pattern icons blue so users can tell at a glance
     that they're AI actions, without breaking the default menu layout. */
  .blocknote-container :global(.bn-ai-slash-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-blue, var(--color-accent, #7aa2f7));
  }

</style>
