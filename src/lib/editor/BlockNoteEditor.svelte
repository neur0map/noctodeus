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

      const [
        { createElement },
        { createRoot },
        { default: BlockNoteWrapper },
      ] = await Promise.all([
        import('react'),
        import('react-dom/client'),
        import('./blocknote/BlockNoteWrapper'),
      ]);

      if (destroyed) return;

      reactRoot = createRoot(containerEl);

      reactRoot.render(
        createElement(BlockNoteWrapper, {
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
          darkMode: document.documentElement.classList.contains('dark'),
        }),
      );
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
    height: 100%;
    overflow: auto;
  }

  .blocknote-container :global(.bn-container) {
    height: 100%;
    font-family: var(--font-content);
  }

  .blocknote-container :global(.bn-editor) {
    max-width: 900px;
    margin: 0 auto;
    padding: 36px 28px;
  }
</style>
