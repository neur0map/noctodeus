const STORAGE_KEY = 'noctodeus-settings';

export interface AppSettings {
  // General
  restoreLastSession: boolean;
  // Editor
  autoSave: boolean;
  // Appearance
  theme: string;
  fontSize: number;
  fontMono: string;
  fontSans: string;
  fontContent: string;
  editorWidth: number;
  showCharCount: boolean;
  customCSS: string;
  // Files
  defaultExtension: string;
  confirmBeforeDelete: boolean;
  wikiStyleLinks: boolean;
  // Sharing
  cryptgeonServer: string;
  // Hotkeys
  keybinds: Record<string, string>;
  // AI
  aiProviderId: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiSystemPrompt: string;
  // MCP
  mcpServers: { name: string; command: string; args: string[] }[];
}

const DEFAULTS: AppSettings = {
  restoreLastSession: true,
  autoSave: true,
  theme: 'midnight-tokyo',
  fontSize: 16,
  fontMono: 'JetBrainsMono Nerd Font',
  fontSans: 'IBM Plex Sans',
  fontContent: 'IBM Plex Sans',
  editorWidth: 780,
  showCharCount: true,
  customCSS: '',
  defaultExtension: '.md',
  confirmBeforeDelete: true,
  wikiStyleLinks: true,
  cryptgeonServer: 'https://cryptgeon.org',
  keybinds: {},
  aiProviderId: '',
  aiBaseUrl: '',
  aiApiKey: '',
  aiModel: '',
  aiSystemPrompt: 'You are a helpful writing assistant. You help with notes, research, and creative thinking.',
  mcpServers: [],
};

function loadFromStorage(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = { ...DEFAULTS, ...parsed };

      // Migrate legacy theme values
      if (merged.theme === 'dark' || merged.theme === 'system') {
        merged.theme = 'midnight-tokyo';
      } else if (merged.theme === 'light') {
        merged.theme = 'dawn';
      }

      // Drop legacy accentColor if present
      delete merged.accentColor;

      return merged;
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
    get fontMono() { return settings.fontMono; },
    get fontSans() { return settings.fontSans; },
    get fontContent() { return settings.fontContent; },
    get editorWidth() { return settings.editorWidth; },
    get showCharCount() { return settings.showCharCount; },
    get customCSS() { return settings.customCSS; },
    get defaultExtension() { return settings.defaultExtension; },
    get confirmBeforeDelete() { return settings.confirmBeforeDelete; },
    get wikiStyleLinks() { return settings.wikiStyleLinks; },
    get cryptgeonServer() { return settings.cryptgeonServer; },
    get keybinds() { return settings.keybinds; },
    get aiProviderId() { return settings.aiProviderId; },
    get aiBaseUrl() { return settings.aiBaseUrl; },
    get aiApiKey() { return settings.aiApiKey; },
    get aiModel() { return settings.aiModel; },
    get aiSystemPrompt() { return settings.aiSystemPrompt; },
    get mcpServers() { return settings.mcpServers; },

    update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
      // Mutate the property directly on the $state proxy for granular reactivity
      (settings as unknown as Record<string, unknown>)[key] = value;
      saveToStorage({ ...settings });
    },
  };
}
