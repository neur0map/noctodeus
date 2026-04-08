/**
 * Framework-agnostic editor interface.
 * Svelte components use this instead of TipTap's Editor type directly.
 */
export interface EditorHandle {
  /** Get all headings in the document for outline/minimap */
  getHeadings(): Array<{ level: number; text: string; id: string }>;

  /** Get document stats */
  getStats(): { charCount: number; wordCount: number; paragraphCount: number };

  /** Get markdown content (async — BlockNote serialization is async) */
  getMarkdown(): Promise<string>;

  /** Replace entire content with new markdown */
  setContent(markdown: string): Promise<void>;

  /** Focus the editor */
  focus(): void;

  /** Subscribe to content changes. Returns unsubscribe function. */
  onChange(callback: () => void): () => void;
}

/**
 * Props passed from Svelte into the React editor.
 */
export interface BlockNoteEditorProps {
  initialContent: string;
  onContentChange?: () => void;
  onNavigate?: (target: string) => void;
  onEditorReady?: (handle: EditorHandle) => void;
  onEditorDestroy?: () => void;
  darkMode?: boolean;
}
