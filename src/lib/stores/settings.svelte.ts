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
  /** "Active" flattened view — mirrors aiCredentials[aiProviderId]. */
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiSystemPrompt: string;
  /** Max tokens for AI completions. 0 = let the provider decide. */
  aiMaxTokens: number;
  /** Per-provider credentials. Keyed by providerId. */
  aiCredentials: Record<string, { baseUrl: string; apiKey: string; model: string }>;
  // MCP
  mcpServers: { name: string; command: string; args: string[]; env?: Record<string, string> }[];
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
  aiMaxTokens: 4000,
  aiCredentials: {},
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

      // Seed aiCredentials from the flat fields for users who predate
      // per-provider storage. This prevents any existing key from being
      // lost on first load of the new code.
      if (!merged.aiCredentials || typeof merged.aiCredentials !== 'object') {
        merged.aiCredentials = {};
      }
      if (
        merged.aiProviderId &&
        !merged.aiCredentials[merged.aiProviderId] &&
        (merged.aiBaseUrl || merged.aiApiKey || merged.aiModel)
      ) {
        merged.aiCredentials[merged.aiProviderId] = {
          baseUrl: merged.aiBaseUrl ?? '',
          apiKey: merged.aiApiKey ?? '',
          model: merged.aiModel ?? '',
        };
      }

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
    get aiMaxTokens() { return settings.aiMaxTokens; },
    get aiCredentials() { return settings.aiCredentials; },
    get mcpServers() { return settings.mcpServers; },

    update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
      // Mutate the property directly on the $state proxy for granular reactivity
      (settings as unknown as Record<string, unknown>)[key] = value;

      // Mirror the active AI fields into aiCredentials[aiProviderId] so each
      // provider remembers its own baseUrl / apiKey / model. This keeps the
      // top-level fields hot (they're what aiChat reads) while preserving
      // per-provider state in the background.
      if (
        (key === 'aiBaseUrl' || key === 'aiApiKey' || key === 'aiModel') &&
        settings.aiProviderId
      ) {
        const id = settings.aiProviderId;
        if (!settings.aiCredentials[id]) {
          settings.aiCredentials[id] = { baseUrl: '', apiKey: '', model: '' };
        }
        const field = key === 'aiBaseUrl' ? 'baseUrl' : key === 'aiApiKey' ? 'apiKey' : 'model';
        settings.aiCredentials[id][field] = value as string;
      }

      saveToStorage({ ...settings });
    },

    /**
     * Switch the active AI provider. Saves the current flat fields to the
     * previous provider's slot (via the mirror in `update`) and restores
     * the new provider's stored credentials — or falls back to the preset
     * defaults if none are stored yet.
     */
    switchAiProvider(
      newId: string,
      presetDefaults?: { baseUrl?: string; apiKey?: string; model?: string },
    ) {
      // 1. Flip the active provider id
      settings.aiProviderId = newId;

      // 2. Load stored credentials for the new provider if present,
      //    otherwise seed from the preset defaults.
      const stored = settings.aiCredentials[newId];
      const nextBaseUrl = stored?.baseUrl ?? presetDefaults?.baseUrl ?? '';
      const nextApiKey  = stored?.apiKey  ?? presetDefaults?.apiKey  ?? '';
      const nextModel   = stored?.model   ?? presetDefaults?.model   ?? '';

      settings.aiBaseUrl = nextBaseUrl;
      settings.aiApiKey  = nextApiKey;
      settings.aiModel   = nextModel;

      // 3. Make sure the slot exists so future edits have somewhere to land.
      if (!settings.aiCredentials[newId]) {
        settings.aiCredentials[newId] = {
          baseUrl: nextBaseUrl,
          apiKey: nextApiKey,
          model: nextModel,
        };
      }

      saveToStorage({ ...settings });
    },
  };
}
