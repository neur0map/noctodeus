/** A command available in the command palette. */
export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

/** An item displayed in the quick-open results list. */
export interface QuickOpenItem {
  path: string;
  name: string;
  title?: string | null;
  parentPath?: string;
  snippet?: string;
}
