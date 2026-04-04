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
  import MediaPanel from "./MediaPanel.svelte";
  import type { SlashCommandItem } from "./extensions/slash-command";
  import { detectEmbed } from "./extensions/embed-block";
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

  // --- Media upload ---
  async function uploadMedia(file: File): Promise<string | null> {
    const corePath = coreState.activeCore?.path;
    if (!corePath) return null;

    try {
      const { mkdir, exists, writeFile: tauriWriteFile } = await import('@tauri-apps/plugin-fs');
      const mediaDir = `${corePath}/media`;
      if (!(await exists(mediaDir))) {
        await mkdir(mediaDir, { recursive: true });
      }
      const ext = file.name.split('.').pop() ?? 'bin';
      const hash = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const filename = `${hash}.${ext}`;
      const destPath = `${mediaDir}/${filename}`;
      const buffer = await file.arrayBuffer();
      await tauriWriteFile(destPath, new Uint8Array(buffer));
      return `media/${filename}`;
    } catch (err) {
      logger.error(`Media upload failed: ${err}`);
      return null;
    }
  }

  function insertMediaByType(type: string, mediaPath: string) {
    if (!editor) return;
    if (type === 'image') {
      editor.chain().focus().setImage({ src: mediaPath }).run();
    } else if (type === 'video') {
      (editor.commands as any).setVideo({ src: mediaPath });
    } else if (type === 'audio') {
      (editor.commands as any).setAudio({ src: mediaPath });
    }
  }

  // --- Media panel state ---
  let mediaPanelVisible = $state(false);
  let mediaPanelPosition = $state({ top: 0, left: 0 });
  let mediaPanelType = $state('image');

  function showMediaPanel(type: string) {
    mediaPanelType = type;
    // Position at cursor
    if (editor) {
      const { from } = editor.state.selection;
      const coords = editor.view.coordsAtPos(from);
      const spaceBelow = window.innerHeight - coords.bottom;
      const panelHeight = 200;
      mediaPanelPosition = {
        top: spaceBelow >= panelHeight + 8 ? coords.bottom + 4 : coords.top - panelHeight - 4,
        left: Math.min(coords.left, window.innerWidth - 340),
      };
    }
    mediaPanelVisible = true;
  }

  async function handleMediaPanelUpload(files: FileList) {
    const file = files[0];
    if (!file) return;
    const mediaPath = await uploadMedia(file);
    if (mediaPath) {
      insertMediaByType(mediaPanelType, mediaPath);
    }
    mediaPanelVisible = false;
    editor?.chain().focus().run();
  }

  function handleMediaPanelLink(url: string) {
    if (!editor) return;
    if (mediaPanelType === 'image') {
      editor.chain().focus().setImage({ src: url }).run();
    } else {
      const embed = detectEmbed(url);
      (editor.commands as any).setEmbed({
        url,
        embedType: embed.type,
        embedUrl: embed.embedUrl ?? null,
        provider: embed.provider ?? null,
      });
    }
    mediaPanelVisible = false;
    editor?.chain().focus().run();
  }

  // --- Slash command menu state ---
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

  export async function flush() {
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = undefined; }
    await save();
  }

  function scheduleAutoSave() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { save(); }, 1000);
  }

  export function reload(newContent: string) {
    if (!editor) return;
    const html = parseMarkdown(newContent);
    editor.commands.setContent(html, { emitUpdate: false });
    editorState.setPath(path);
  }

  const MENU_HEIGHT = 380;

  function calcPosition(rect: DOMRect) {
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= MENU_HEIGHT + 8
      ? rect.bottom + 4
      : rect.top - MENU_HEIGHT - 4;
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
        if (slashSelectedIndex >= props.items.length) slashSelectedIndex = 0;
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
          if (slashItems[slashSelectedIndex] && slashCommand) slashCommand(slashItems[slashSelectedIndex]);
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
    if (slashCommand) slashCommand(item);
    slashVisible = false;
  }

  // Expose showMediaPanel so slash commands can call it
  (globalThis as any).__noctodeusShowMediaPanel = showMediaPanel;

  onMount(() => {
    if (!editorElement) return;

    const html = parseMarkdown(initialContent);
    let mounted = false;

    editor = new Editor({
      element: editorElement,
      extensions: createEditorExtensions({ slashPopup: createSlashPopup, mediaUploader: uploadMedia }),
      content: html,
      onUpdate: () => {
        if (!mounted) return;
        editorState.markDirty();
        scheduleAutoSave();
      },
      autofocus: true,
    });

    requestAnimationFrame(() => { mounted = true; });
    editorState.setPath(path);

    const handleWikiLinkClick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.target) onnavigate(detail.target);
    };
    editorElement.addEventListener("wiki-link-click", handleWikiLinkClick);

    return () => {
      editorElement?.removeEventListener("wiki-link-click", handleWikiLinkClick);
      if (debounceTimer) clearTimeout(debounceTimer);
      editor?.destroy();
      editor = undefined;
    };
  });

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

<MediaPanel
  visible={mediaPanelVisible}
  position={mediaPanelPosition}
  mediaType={mediaPanelType}
  onupload={handleMediaPanelUpload}
  onlinksubmit={handleMediaPanelLink}
  onclose={() => { mediaPanelVisible = false; editor?.chain().focus().run(); }}
/>

<style>
  .editor-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
