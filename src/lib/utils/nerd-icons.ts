/**
 * Nerd Font glyph mapping for file types and UI elements.
 * Unicode codepoints from: https://www.nerdfonts.com/cheat-sheet
 */

const NERD_GLYPHS: Record<string, string> = {
  // File types
  'md': '\ue73e',
  'json': '\ue60b',
  'ts': '\ue628',
  'js': '\ue74e',
  'svelte': '\ue6b4',
  'css': '\ue749',
  'scss': '\ue74b',
  'html': '\ue736',
  'rs': '\ue7a8',
  'toml': '\ue6b2',
  'yaml': '\ue6a8',
  'yml': '\ue6a8',
  'png': '\uf1c5',
  'jpg': '\uf1c5',
  'svg': '\uf1c5',
  'default': '\uf15b',

  // Folders
  'folder-closed': '\uf07b',
  'folder-open': '\uf07c',

  // UI elements
  'home': '\uf015',
  'search': '\uf002',
  'vault': '\udb80\udf43',
  'outline': '\uf0cb',
  'graph': '\udb81\ude1a',
  'links': '\uf0c1',
  'tasks': '\uf0ae',
  'info': '\uf05a',
  'recent': '\uf017',
  'most-linked': '\uf0c1',
  'gear': '\uf013',
};

/** Get a Nerd Font glyph for a key (file extension or UI element). */
export function nerdIcon(key: string): string {
  return NERD_GLYPHS[key] ?? NERD_GLYPHS['default'];
}

/** Get the Nerd Font glyph for a file based on its extension. */
export function fileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return NERD_GLYPHS[ext] ?? NERD_GLYPHS['default'];
}
