// Legacy theme utilities — superseded by $lib/themes/apply.ts
// Kept temporarily for reference; nothing imports this file.

type ThemeMode = 'dark' | 'light' | 'system';

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(mode: ThemeMode) {
  const resolved = mode === 'system' ? getSystemTheme() : mode;
  const html = document.documentElement;
  html.classList.remove('dark', 'light');
  html.classList.add(resolved);
  html.setAttribute('data-theme', resolved);
}

export function watchSystemTheme(mode: ThemeMode, callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (mode === 'system') callback();
  };
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}
