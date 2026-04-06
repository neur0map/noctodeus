export interface AppShortcuts {
  quick_open: string;
  search: string;
  command_palette: string;
  new_note: string;
  toggle_sidebar: string;
  toggle_right_panel: string;
  collapse_sidebar: string;
  delete_file: string;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? '');

/** Primary modifier: Cmd on macOS, Ctrl on Windows/Linux */
const MOD = isMac ? "Meta" : "Ctrl";

export const APP_SHORTCUTS: AppShortcuts = {
  quick_open: `${MOD}+P`,
  search: `${MOD}+K`,
  command_palette: `${MOD}+Shift+P`,
  new_note: `${MOD}+N`,
  toggle_sidebar: `${MOD}+B`,
  toggle_right_panel: `${MOD}+\\`,
  collapse_sidebar: `${MOD}+Shift+B`,
  delete_file: `${MOD}+Backspace`,
};

const MAC_DISPLAY: Record<string, string> = {
  meta: "\u2318",
  ctrl: "\u2303",
  shift: "\u21e7",
  alt: "\u2325",
  enter: "\u23ce",
  escape: "Esc",
  backspace: "\u232b",
  delete: "Del",
  tab: "\u21e5",
  space: "Space",
  up: "\u2191",
  down: "\u2193",
  left: "\u2190",
  right: "\u2192",
};

const PC_DISPLAY: Record<string, string> = {
  ctrl: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  meta: "Win",
  enter: "Enter",
  escape: "Esc",
  backspace: "Backspace",
  delete: "Del",
  tab: "Tab",
  space: "Space",
  up: "\u2191",
  down: "\u2193",
  left: "\u2190",
  right: "\u2192",
};

export function formatShortcutLabel(shortcut: string): string {
  const display = isMac ? MAC_DISPLAY : PC_DISPLAY;
  const parts = shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => display[part.toLowerCase()] ?? part.toUpperCase());

  return isMac ? parts.join("") : parts.join("+");
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
