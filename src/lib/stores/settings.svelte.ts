const STORAGE_KEY = 'noctodeus-settings';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface AppSettings {
  // General
  restoreLastSession: boolean;
  // Editor
  autoSave: boolean;
  // Appearance
  theme: ThemeMode;
  fontSize: number;
  showCharCount: boolean;
  // Files
  defaultExtension: string;
  confirmBeforeDelete: boolean;
  wikiStyleLinks: boolean;
}

const DEFAULTS: AppSettings = {
  restoreLastSession: true,
  autoSave: true,
  theme: 'dark' as ThemeMode,
  fontSize: 16,
  showCharCount: true,
  defaultExtension: '.md',
  confirmBeforeDelete: true,
  wikiStyleLinks: true,
};

function loadFromStorage(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

function saveToStorage(s: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

let settings = $state<AppSettings>(loadFromStorage());

export function getSettings() {
  return {
    get restoreLastSession() { return settings.restoreLastSession; },
    get autoSave() { return settings.autoSave; },
    get theme() { return settings.theme; },
    get fontSize() { return settings.fontSize; },
    get showCharCount() { return settings.showCharCount; },
    get defaultExtension() { return settings.defaultExtension; },
    get confirmBeforeDelete() { return settings.confirmBeforeDelete; },
    get wikiStyleLinks() { return settings.wikiStyleLinks; },

    update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
      // Mutate the property directly on the $state proxy for granular reactivity
      (settings as unknown as Record<string, unknown>)[key] = value;
      saveToStorage({ ...settings });
    },
  };
}
