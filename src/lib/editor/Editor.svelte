<script lang="ts">
  import { onMount } from "svelte";
  import BlockNoteEditor from "./BlockNoteEditor.svelte";
  import { splitFrontmatter, joinFrontmatter } from "./blocknote/markdown";
  import type { EditorHandle, WikiItem } from "./blocknote/types";
  import { getEditorState } from "../stores/editor.svelte";
  import { getFilesState } from "../stores/files.svelte";
  import { getCoreState } from "../stores/core.svelte";
  import { getGraphState } from "../stores/graph.svelte";
  import { getActiveEditorState } from "../stores/active-editor.svelte";
  import { getSettings } from "../stores/settings.svelte";
  import { writeFile } from "../bridge/commands";
  import { logger } from "../logger";
  import EditorMinimap from "./EditorMinimap.svelte";

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
  const graphState = getGraphState();
  const activeEditorState = getActiveEditorState();
  const appSettings = getSettings();

  let editorHandle: EditorHandle | undefined = $state();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let blockNoteRef: BlockNoteEditor | undefined = $state();

  // Split frontmatter from content — BlockNote only gets the markdown body
  const [savedFrontmatter, markdownBody] = splitFrontmatter(initialContent);

  async function computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function save() {
    if (!editorHandle || !editorState.dirty) return;
    editorState.markSaving();
    try {
      let markdown = await editorHandle.getMarkdown();
      if (savedFrontmatter) {
        markdown = joinFrontmatter(savedFrontmatter, markdown);
      }
      const hash = await computeHash(markdown);
      const updated = await writeFile(path, markdown);
      filesState.updateFile(updated);
      editorState.markSaved(hash);
      if (markdown.includes('[[')) {
        graphState.scan(filesState.fileMap);
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
    const [, body] = splitFrontmatter(newContent);
    editorHandle?.setContent(body);
    editorState.setPath(path);
  }

  export function getEditorHandle(): EditorHandle | undefined {
    return editorHandle;
  }

  function handleEditorReady(handle: EditorHandle) {
    editorHandle = handle;
    editorState.setPath(path);
    activeEditorState.set(handle);
  }

  function handleEditorDestroy() {
    editorHandle = undefined;
    activeEditorState.set(null);
  }

  function handleContentChange() {
    editorState.markDirty();
    scheduleAutoSave();
  }

  function getWikiItems(): WikiItem[] {
    return Array.from(filesState.fileMap.values())
      .filter(f => !f.is_directory && !f.name.startsWith('.'))
      .map(f => ({ path: f.path, name: f.name, title: f.title ?? null }));
  }

  onMount(() => {
    return () => {
      // Flush any pending autosave before unmounting
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      if (editorState.dirty && editorHandle) {
        save();
      }
      activeEditorState.set(null);
    };
  });
</script>

<div class="editor-container">
  <BlockNoteEditor
    bind:this={blockNoteRef}
    {path}
    initialContent={markdownBody}
    {onnavigate}
    oneditorready={handleEditorReady}
    oneditordestroy={handleEditorDestroy}
    oncontentchange={handleContentChange}
    wikiitems={getWikiItems}
  />
  <EditorMinimap editor={editorHandle ?? null} />
</div>

<style>
  .editor-container {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
