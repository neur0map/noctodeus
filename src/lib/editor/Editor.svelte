<script lang="ts">
  import { onMount } from "svelte";
  import { Editor } from "@tiptap/core";
  import { createEditorExtensions } from "./extensions";
  import { parseMarkdown, serializeMarkdown, extractFrontmatter } from "./serializer";
  import FindReplaceBar from "./FindReplaceBar.svelte";
  import { getEditorState } from "../stores/editor.svelte";
  import { getFilesState } from "../stores/files.svelte";
  import { getCoreState } from "../stores/core.svelte";
  import { getGraphState } from "../stores/graph.svelte";
  import { getActiveEditorState } from "../stores/active-editor.svelte";
  import { getSettings } from "../stores/settings.svelte";
  import { writeFile, readFile } from "../bridge/commands";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { logger } from "../logger";
  import SlashCommandMenu from "./SlashCommandMenu.svelte";
  import MediaPanel from "./MediaPanel.svelte";
  import BubbleToolbar from "./BubbleToolbar.svelte";
  import EditorMinimap from "./EditorMinimap.svelte";
  import type { SlashCommandItem } from "./extensions/slash-command";
  import { detectEmbed } from "./extensions/embed-block";
  import type { WikiSuggestItem } from "./extensions/wiki-link-suggest";
  import WikiLinkSuggest from "./WikiLinkSuggest.svelte";
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
  const graphState = getGraphState();
  const activeEditorState = getActiveEditorState();
  const appSettings = getSettings();

  let editorElement: HTMLDivElement | undefined = $state();
  let findBarVisible = $state(false);
  let editor: Editor | undefined = $state();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let savedFrontmatter: string | null = extractFrontmatter(initialContent);

  // --- Media ---
  function insertMediaByType(type: string, filePath: string) {
    if (!editor) return;
    // Convert local paths to Tauri asset protocol URLs so WebView can load them
    const src = filePath.startsWith('http') ? filePath : convertFileSrc(filePath);
    if (type === 'image') {
      (editor.commands as any).setImage({ src });
    } else if (type === 'video') {
      (editor.commands as any).setVideo({ src });
    } else if (type === 'audio') {
      (editor.commands as any).setAudio({ src });
    }
  }

  // Media panel state
  let mediaPanelVisible = $state(false);
  let mediaPanelPosition = $state({ top: 0, left: 0 });
  let mediaPanelType = $state('image');

  function showMediaPanel(type: string) {
    mediaPanelType = type;
    if (editor) {
      const { from } = editor.state.selection;
      const coords = editor.view.coordsAtPos(from);
      const panelHeight = 140;
      const panelWidth = 260;
      const spaceBelow = window.innerHeight - coords.bottom;
      const top = spaceBelow >= panelHeight + 8
        ? coords.bottom + 4
        : coords.top - panelHeight - 4;
      mediaPanelPosition = {
        top: Math.max(4, Math.min(top, window.innerHeight - 40)),
        left: Math.max(4, Math.min(coords.left, window.innerWidth - panelWidth - 8)),
      };
    }
    mediaPanelVisible = true;
  }

  async function handleMediaPanelUpload() {
    const filters: Record<string, { name: string; extensions: string[] }[]> = {
      image: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
      video: [{ name: 'Videos', extensions: ['mp4', 'webm', 'mov'] }],
      audio: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }],
    };

    try {
      const selected = await openFileDialog({
        multiple: false,
        filters: filters[mediaPanelType] ?? [],
        title: `Choose ${mediaPanelType}`,
      });

      if (!selected) return;
      // Reference the file by its absolute path — no copying, no duplication
      const filePath = typeof selected === 'string' ? selected : String(selected);
      insertMediaByType(mediaPanelType, filePath);
    } catch (err) {
      logger.error(`Media select failed: ${err}`);
    }

    mediaPanelVisible = false;
    editor?.chain().focus().run();
  }

  function handleMediaPanelLink(url: string) {
    if (!editor) return;
    if (mediaPanelType === 'image') {
      (editor.commands as any).setImage({ src: url });
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

  // --- Bubble toolbar state ---
  let bubbleVisible = $state(false);
  let bubblePosition = $state({ top: 0, left: 0 });

  function updateBubbleToolbar() {
    if (!editor) { bubbleVisible = false; return; }
    const { from, to, empty } = editor.state.selection;
    if (empty || slashVisible || mediaPanelVisible) {
      bubbleVisible = false;
      return;
    }
    try {
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const midX = (start.left + end.right) / 2;
      const toolbarWidth = 240;
      const toolbarHeight = 40;
      // Position well above the selection start
      const top = start.top - toolbarHeight - 10;
      bubblePosition = {
        top: Math.max(4, top),
        left: Math.max(8, Math.min(midX - toolbarWidth / 2, window.innerWidth - toolbarWidth - 8)),
      };
      bubbleVisible = true;
    } catch {
      bubbleVisible = false;
    }
  }

  // --- Wiki link suggest state ---
  let wikiVisible = $state(false);
  let wikiItems = $state<WikiSuggestItem[]>([]);
  let wikiPosition = $state({ top: 0, left: 0 });
  let wikiQuery = $state('');
  let wikiCommand: ((item: WikiSuggestItem) => void) | null = null;

  function getWikiSuggestItems(): WikiSuggestItem[] {
    return Array.from(filesState.fileMap.values())
      .filter(f => !f.is_directory && !f.name.startsWith('.'))
      .map(f => ({ path: f.path, name: f.name, title: f.title }));
  }

  function createWikiPopup() {
    return {
      onStart(props: any) {
        wikiItems = props.items;
        wikiCommand = props.command;
        wikiQuery = '';
        const rect = props.clientRect?.();
        if (rect) {
          const spaceBelow = window.innerHeight - rect.bottom;
          wikiPosition = {
            top: spaceBelow >= 260 ? rect.bottom + 4 : rect.top - 260,
            left: Math.max(4, Math.min(rect.left, window.innerWidth - 320)),
          };
        }
        wikiVisible = true;
      },
      onUpdate(props: any) {
        wikiItems = props.items;
        wikiCommand = props.command;
        wikiQuery = props.query ?? '';
        const rect = props.clientRect?.();
        if (rect) {
          const spaceBelow = window.innerHeight - rect.bottom;
          wikiPosition = {
            top: spaceBelow >= 260 ? rect.bottom + 4 : rect.top - 260,
            left: Math.max(4, Math.min(rect.left, window.innerWidth - 320)),
          };
        }
      },
      onKeyDown(props: any) {
        const e = props.event as KeyboardEvent;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          return true;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          return true;
        }
        if (e.key === 'Escape') {
          wikiVisible = false;
          return true;
        }
        if (e.key === 'Enter') {
          // Don't handle here — let WikiLinkSuggest component handle via onselect
          return true;
        }
        return false;
      },
      onExit() {
        wikiVisible = false;
        wikiCommand = null;
      },
    };
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
    let markdown = serializeMarkdown(editor.getJSON());
    // Re-attach frontmatter that was stripped on load
    if (savedFrontmatter) {
      markdown = savedFrontmatter + markdown;
    }
    const hash = await computeHash(markdown);
    try {
      const updated = await writeFile(path, markdown);
      filesState.updateFile(updated);
      editorState.markSaved(hash);
      // Re-scan graph if content has wiki-links
      if (markdown.includes('[[')) {
        graphState.scan(filesState.fileMap, readFile);
      }
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
    if (!appSettings.autoSave) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { save(); }, 400);
  }

  export function reload(newContent: string) {
    if (!editor) return;
    const html = parseMarkdown(newContent);
    editor.commands.setContent(html, { emitUpdate: false });
    editorState.setPath(path);
  }

  const MENU_HEIGHT = 380;
  const MENU_WIDTH = 280;

  function getCursorViewportPosition(): { top: number; left: number; bottom: number } | null {
    if (!editor) return null;
    const { from } = editor.state.selection;
    try {
      const coords = editor.view.coordsAtPos(from);
      return { top: coords.top, left: coords.left, bottom: coords.bottom };
    } catch {
      return null;
    }
  }

  function calcMenuPosition(props: any) {
    // Prefer coordsAtPos — always returns correct viewport coordinates
    // clientRect from suggestion can be unreliable after scrolling
    const cursor = getCursorViewportPosition();
    const rectFn = props.clientRect;
    const suggestionRect = rectFn?.();

    const rect = cursor ?? suggestionRect;
    if (!rect) return null;

    const bottom = rect.bottom ?? rect.top + 20;
    const spaceBelow = window.innerHeight - bottom;
    const top = spaceBelow >= MENU_HEIGHT + 8
      ? bottom + 4
      : rect.top - MENU_HEIGHT - 4;

    const left = Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8);

    return {
      top: Math.max(4, Math.min(top, window.innerHeight - 40)),
      left: Math.max(4, left),
    };
  }

  function createSlashPopup() {
    return {
      onStart(props: any) {
        slashItems = props.items;
        slashCommand = props.command;
        slashSelectedIndex = 0;
        const pos = calcMenuPosition(props);
        if (pos) slashPosition = pos;
        slashVisible = true;
      },
      onUpdate(props: any) {
        slashItems = props.items;
        slashCommand = props.command;
        const pos = calcMenuPosition(props);
        if (pos) slashPosition = pos;
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
      extensions: createEditorExtensions({ slashPopup: createSlashPopup, wikiPopup: createWikiPopup, wikiItems: getWikiSuggestItems }),
      content: html,
      onUpdate: () => {
        if (!mounted) return;
        editorState.markDirty();
        scheduleAutoSave();
      },
      onSelectionUpdate: () => {
        updateBubbleToolbar();
      },
      autofocus: true,
    });

    requestAnimationFrame(() => { mounted = true; });
    editorState.setPath(path);
    activeEditorState.set(editor);

    const handleWikiLinkClick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.target) onnavigate(detail.target);
    };
    editorElement.addEventListener("wiki-link-click", handleWikiLinkClick);

    const handleFindShortcut = (e: KeyboardEvent) => {
      const mod = navigator.platform?.includes('Mac') ? e.metaKey : e.ctrlKey;
      if (mod && e.key === 'f') {
        e.preventDefault();
        findBarVisible = true;
      }
      if (mod && e.key === 'h') {
        e.preventDefault();
        findBarVisible = true;
      }
    };
    document.addEventListener('keydown', handleFindShortcut);

    return () => {
      document.removeEventListener('keydown', handleFindShortcut);
      editorElement?.removeEventListener("wiki-link-click", handleWikiLinkClick);
      if (debounceTimer) clearTimeout(debounceTimer);
      activeEditorState.set(null);
      editor?.destroy();
      editor = undefined;
    };
  });

  // ── Font size ──
  $effect(() => {
    if (!editor) return;
    const el = editor.view.dom as HTMLElement;
    el.style.fontSize = `${appSettings.fontSize}px`;
  });

  export function getEditor(): Editor | undefined {
    return editor;
  }
</script>

<FindReplaceBar
  editor={editor ?? null}
  visible={findBarVisible}
  onclose={() => { findBarVisible = false; (editor?.commands as any)?.clearSearch?.(); editor?.chain().focus().run(); }}
/>

<div class="editor-container" bind:this={editorElement}>
  <EditorMinimap {editor} />
</div>

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
  onupload={() => handleMediaPanelUpload()}
  onlinksubmit={handleMediaPanelLink}
  onclose={() => { mediaPanelVisible = false; editor?.chain().focus().run(); }}
/>

<WikiLinkSuggest
  query={''}
  items={wikiItems}
  visible={wikiVisible}
  position={wikiPosition}
  onselect={(name) => {
    const item = wikiItems.find(i => i.name === name || i.name.replace(/\.(md|markdown)$/i, '') === name);
    if (item && wikiCommand) wikiCommand(item);
    wikiVisible = false;
  }}
  onclose={() => { wikiVisible = false; }}
/>

<BubbleToolbar
  editor={editor ?? null}
  visible={bubbleVisible}
  position={bubblePosition}
/>

<style>
  .editor-container {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
