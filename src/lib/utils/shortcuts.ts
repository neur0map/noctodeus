export interface AppShortcuts {
  quick_open: string;
  command_palette: string;
  new_note: string;
  toggle_sidebar: string;
  toggle_right_panel: string;
  collapse_sidebar: string;
  delete_file: string;
}

export const APP_SHORTCUTS: AppShortcuts = {
  quick_open: "Meta+P",
  command_palette: "Meta+Shift+P",
  new_note: "Meta+N",
  toggle_sidebar: "Meta+B",
  toggle_right_panel: "Meta+\\",
  collapse_sidebar: "Meta+Shift+B",
  delete_file: "Meta+Backspace",
};

const DISPLAY_PARTS: Record<string, string> = {
  meta: "\u2318",
  cmd: "\u2318",
  command: "\u2318",
  ctrl: "\u2303",
  control: "\u2303",
  shift: "\u21e7",
  alt: "\u2325",
  option: "\u2325",
  enter: "\u23ce",
  return: "\u23ce",
  escape: "Esc",
  esc: "Esc",
  backspace: "\u232b",
  delete: "Del",
  tab: "\u21e5",
  space: "Space",
  up: "\u2191",
  down: "\u2193",
  left: "\u2190",
  right: "\u2192",
};

export function formatShortcutLabel(shortcut: string): string {
  return shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => DISPLAY_PARTS[part.toLowerCase()] ?? part.toUpperCase())
    .join("");
}

export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: string,
): boolean {
  const parts = shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(normalizeToken);

  if (parts.length === 0) return false;

  const key = parts[parts.length - 1];
  const modifiers = new Set(parts.slice(0, -1));

  if (event.metaKey !== modifiers.has("meta")) return false;
  if (event.ctrlKey !== modifiers.has("ctrl")) return false;
  if (event.shiftKey !== modifiers.has("shift")) return false;
  if (event.altKey !== modifiers.has("alt")) return false;

  return normalizeKey(event.key) === key;
}

function normalizeToken(token: string): string {
  switch (token.toLowerCase()) {
    case "cmd":
    case "command":
      return "meta";
    case "control":
      return "ctrl";
    case "option":
      return "alt";
    case "esc":
      return "escape";
    case "return":
      return "enter";
    default:
      return token.toLowerCase();
  }
}

function normalizeKey(key: string): string {
  switch (key) {
    case " ":
      return "space";
    default:
      return normalizeToken(key);
  }
}
