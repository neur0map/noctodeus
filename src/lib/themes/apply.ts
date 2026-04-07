import { THEMES, type Theme } from './themes';

/**
 * Apply a theme by ID to the document root.
 * Sets color-scheme, dark/light class, data-theme attribute,
 * and all CSS custom properties.
 */
export function applyTheme(themeId: string): void {
  const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0];
  const root = document.documentElement;

  // Color scheme
  root.style.setProperty('color-scheme', theme.colorScheme);
  root.classList.remove('dark', 'light');
  root.classList.add(theme.colorScheme);
  root.setAttribute('data-theme', theme.colorScheme);

  // Set every CSS custom property from the theme
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--${key}`, value);
  }
}

/**
 * Look up a theme by ID, falling back to the first theme.
 */
export function getTheme(id: string): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}
