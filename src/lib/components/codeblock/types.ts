export interface CodeTab {
  id: string;
  name: string;
  language: SupportedLanguage;
  content: string;
}

export type SupportedLanguage = 'python' | 'html' | 'css' | 'js';

export const SUPPORTED_LANGUAGES: { id: SupportedLanguage; label: string; ext: string }[] = [
  { id: 'python', label: 'Python', ext: '.py' },
  { id: 'html', label: 'HTML', ext: '.html' },
  { id: 'css', label: 'CSS', ext: '.css' },
  { id: 'js', label: 'JavaScript', ext: '.js' },
];

export function defaultTabName(lang: SupportedLanguage): string {
  switch (lang) {
    case 'python': return 'main.py';
    case 'html': return 'index.html';
    case 'css': return 'style.css';
    case 'js': return 'app.js';
    default: return `untitled.${lang}`;
  }
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
