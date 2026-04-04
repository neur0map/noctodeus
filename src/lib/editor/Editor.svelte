<script lang="ts">
  import { onMount } from "svelte";
  import { Editor } from "@tiptap/core";
  import { createEditorExtensions } from "./extensions";
  import { parseMarkdown, serializeMarkdown } from "./serializer";
  import { getEditorState } from "../stores/editor.svelte";
  import { getFilesState } from "../stores/files.svelte";
  import { writeFile } from "../bridge/commands";
  import { logger } from "../logger";
  import SlashCommandMenu from "./SlashCommandMenu.svelte";
  import type { SlashCommandItem } from "./extensions/slash-command";
  import "./styles/editor.css";

  let {
    path,
    initialContent,
    onnavigate,
  }: {
    path: string;
    initialContent: string;
    onnavigate: (target: string) => void;
  } = $props();

  const editorState = getEditorState();
  const filesState = getFilesState();

  let editorElement: HTMLDivElement | undefined = $state();
  let editor: Editor | undefined = $state();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // Slash command menu state
  let slashVisible = $state(false);
  let slashItems = $state<SlashCommandItem[]>([]);
  let slashPosition = $state({ top: 0, left: 0 });
  let slashSelectedIndex = $state(0);
  let slashCommand: ((item: SlashCommandItem) => void) | null = null;

  async function computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function save() {
    if (!editor || !editorState.dirty) return;

    editorState.markSaving();
    const markdown = serializeMarkdown(editor.getJSON());
    const hash = await computeHash(markdown);

    try {
      const updated = await writeFile(path, markdown);
      filesState.updateFile(updated);
      editorState.markSaved(hash);
    } catch (err) {
      logger.error(`Failed to save ${path}: ${err}`);
      editorState.markDirty();
    }
  }

  /** Flush any pending save. Called by parent before switching files. */
  export async function flush() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    await save();
  }

  function scheduleAutoSave() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      save();
    }, 1000);
  }

  /** Reload editor content (for external file changes). */
  export function reload(newContent: string) {
    if (!editor) return;
    const html = parseMarkdown(newContent);
    editor.commands.setContent(html, { emitUpdate: false });
    editorState.setPath(path);
  }

  // Bridge TipTap suggestion callbacks → Svelte reactive state
  function createSlashPopup() {
    return {
      onStart(props: any) {
        slashItems = props.items;
        slashCommand = props.command;
        slashSelectedIndex = 0;
        const rect = props.clientRect?.();
        if (rect) {
          slashPosition = { top: rect.bottom + 4, left: rect.left };
        }
        slashVisible = true;
      },
      onUpdate(props: any) {
        slashItems = props.items;
        slashCommand = props.command;
        const rect = props.clientRect?.();
        if (rect) {
          slashPosition = { top: rect.bottom + 4, left: rect.left };
        }
        // Reset selection if items changed
        if (slashSelectedIndex >= props.items.length) {
          slashSelectedIndex = 0;
        }
      },
      onKeyDown(props: any) {
        const event = props.event as KeyboardEvent;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          slashSelectedIndex = (slashSelectedIndex + 1) % slashItems.length;
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          slashSelectedIndex = (slashSelectedIndex - 1 + slashItems.length) % slashItems.length;
          return true;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          if (slashItems[slashSelectedIndex] && slashCommand) {
            slashCommand(slashItems[slashSelectedIndex]);
          }
          slashVisible = false;
          return true;
        }
        if (event.key === 'Escape') {
          slashVisible = false;
          return true;
        }
        return false;
      },
      onExit() {
        slashVisible = false;
        slashCommand = null;
      },
    };
  }

  function handleSlashSelect(item: SlashCommandItem) {
    if (slashCommand) {
      slashCommand(item);
    }
    slashVisible = false;
  }

  onMount(() => {
    if (!editorElement) return;

    const html = parseMarkdown(initialContent);
    let mounted = false;

    editor = new Editor({
      element: editorElement,
      extensions: createEditorExtensions({ slashPopup: createSlashPopup }),
      content: html,
      onUpdate: () => {
        // TipTap normalizes HTML on load, firing a spurious update.
        // Ignore updates until after the initial content is settled.
        if (!mounted) return;
        editorState.markDirty();
        scheduleAutoSave();
      },
      autofocus: true,
    });

    // Allow the editor to settle before tracking changes
    requestAnimationFrame(() => { mounted = true; });

    editorState.setPath(path);

    // Listen for wiki-link clicks
    const handleWikiLinkClick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.target) {
        onnavigate(detail.target);
      }
    };
    editorElement.addEventListener("wiki-link-click", handleWikiLinkClick);

    return () => {
      editorElement?.removeEventListener(
        "wiki-link-click",
        handleWikiLinkClick,
      );
      if (debounceTimer) clearTimeout(debounceTimer);
      editor?.destroy();
      editor = undefined;
    };
  });

  // Export editor instance for toolbar
  export function getEditor(): Editor | undefined {
    return editor;
  }
</script>

<div class="editor-container" bind:this={editorElement}></div>

<SlashCommandMenu
  items={slashItems}
  visible={slashVisible}
  position={slashPosition}
  selectedIndex={slashSelectedIndex}
  onselect={handleSlashSelect}
/>

<style>
  .editor-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
