<script lang="ts">
  import { onMount } from "svelte";
  import { Editor } from "@tiptap/core";
  import { createEditorExtensions } from "./extensions";
  import { parseMarkdown, serializeMarkdown } from "./serializer";
  import { getEditorState } from "../stores/editor.svelte";
  import { getFilesState } from "../stores/files.svelte";
  import { getCoreState } from "../stores/core.svelte";
  import { writeFile } from "../bridge/commands";
  import { logger } from "../logger";
  import SlashCommandMenu from "./SlashCommandMenu.svelte";
  import type { SlashCommandItem } from "./extensions/slash-command";
  import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
  import "./styles/editor.css";
  import "./styles/media.css";

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
  const coreState = getCoreState();

  let editorElement: HTMLDivElement | undefined = $state();
  let editor: Editor | undefined = $state();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // Media upload — copies file to <core>/media/ and returns relative path
  async function uploadMedia(file: File): Promise<string | null> {
    const corePath = coreState.activeCore?.path;
    if (!corePath) return null;

    try {
      const { mkdir, copyFile, exists } = await import('@tauri-apps/plugin-fs');
      const mediaDir = `${corePath}/media`;
      if (!(await exists(mediaDir))) {
        await mkdir(mediaDir, { recursive: true });
      }
      const ext = file.name.split('.').pop() ?? 'bin';
      const hash = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const filename = `${hash}.${ext}`;
      const destPath = `${mediaDir}/${filename}`;

      // Write file from ArrayBuffer
      const { writeFile: tauriWriteFile } = await import('@tauri-apps/plugin-fs');
      const buffer = await file.arrayBuffer();
      await tauriWriteFile(destPath, new Uint8Array(buffer));

      return `media/${filename}`;
    } catch (err) {
      logger.error(`Media upload failed: ${err}`);
      return null;
    }
  }

  async function handleMediaUploadRequest(type: string) {
    const filters: Record<string, { name: string; extensions: string[] }[]> = {
      image: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
      video: [{ name: 'Videos', extensions: ['mp4', 'webm', 'mov'] }],
      audio: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'webm'] }],
    };

    const selected = await openFileDialog({
      multiple: false,
      filters: filters[type] ?? [],
      title: `Select ${type}`,
    });

    if (!selected) return;
    const filePath = typeof selected === 'string' ? selected : String(selected);

    // Read the file and upload
    try {
      const { readFile: tauriReadFile } = await import('@tauri-apps/plugin-fs');
      const contents = await tauriReadFile(filePath);
      const ext = filePath.split('.').pop() ?? 'bin';
      const blob = new File([contents], `upload.${ext}`, { type: `${type}/${ext}` });
      const mediaPath = await uploadMedia(blob);
      if (!mediaPath || !editor) return;

      if (type === 'image') {
        editor.chain().focus().setImage({ src: mediaPath }).run();
      } else if (type === 'video') {
        (editor.commands as any).setVideo({ src: mediaPath });
      } else if (type === 'audio') {
        (editor.commands as any).setAudio({ src: mediaPath });
      }
    } catch (err) {
      logger.error(`Failed to read file for upload: ${err}`);
    }
  }

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
  const MENU_HEIGHT = 340; // max-height from CSS

  function calcPosition(rect: DOMRect) {
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= MENU_HEIGHT + 8
      ? rect.bottom + 4        // open below
      : rect.top - MENU_HEIGHT - 4; // open above
    return { top: Math.max(4, top), left: rect.left };
  }

  function createSlashPopup() {
    return {
      onStart(props: any) {
        slashItems = props.items;
        slashCommand = props.command;
        slashSelectedIndex = 0;
        const rect = props.clientRect?.();
        if (rect) slashPosition = calcPosition(rect);
        slashVisible = true;
      },
      onUpdate(props: any) {
        slashItems = props.items;
        slashCommand = props.command;
        const rect = props.clientRect?.();
        if (rect) slashPosition = calcPosition(rect);
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
      extensions: createEditorExtensions({ slashPopup: createSlashPopup, mediaUploader: uploadMedia }),
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

    // Listen for media upload requests from slash commands
    const handleMediaRequest = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type) {
        handleMediaUploadRequest(detail.type);
      }
    };
    editorElement.addEventListener("media-upload-request", handleMediaRequest);

    return () => {
      editorElement?.removeEventListener("wiki-link-click", handleWikiLinkClick);
      editorElement?.removeEventListener("media-upload-request", handleMediaRequest);
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
