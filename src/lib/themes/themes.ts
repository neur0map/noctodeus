// ── Theme definitions for Nodeus ──
// Keys are kebab-case matching CSS custom properties (without the -- prefix).
// applyTheme() sets `--${key}: value` on :root.

export type ThemeColors = Record<string, string>;

export interface Theme {
  id: string;
  name: string;
  group: 'dark' | 'light' | 'warm';
  colorScheme: 'dark' | 'light';
  colors: ThemeColors;
  preview: { bg: string; text: string; textMuted: string; link: string };
}

// ── Shared non-color tokens (spacing, radius, shadows reused across themes) ──

const SHARED_SPACING: ThemeColors = {
  'radius': '0.375rem',
  'space-xs': '4px',
  'space-sm': '8px',
  'space-md': '12px',
  'space-lg': '20px',
  'space-xl': '32px',
};

// ── Dark shadow set ──

function darkShadows(glowColor = 'rgba(122, 162, 247, 0.15)'): ThemeColors {
  return {
    'shadow-float': '0 4px 16px rgba(0, 0, 0, 0.4)',
    'shadow-elevated': '0 2px 8px rgba(0, 0, 0, 0.25)',
    'shadow-modal': '0 8px 32px rgba(0, 0, 0, 0.4)',
    'glow-focus': `0 0 0 2px ${glowColor}`,
    'float-shadow': '0 4px 16px rgba(0, 0, 0, 0.5)',
  };
}

// ── Light shadow set ──

function lightShadows(glowColor = 'rgba(79, 107, 237, 0.15)'): ThemeColors {
  return {
    'shadow-float': '0 4px 16px rgba(0, 0, 0, 0.08)',
    'shadow-elevated': '0 2px 8px rgba(0, 0, 0, 0.06)',
    'shadow-modal': '0 8px 32px rgba(0, 0, 0, 0.12)',
    'glow-focus': `0 0 0 2px ${glowColor}`,
    'float-shadow': '0 4px 16px rgba(0, 0, 0, 0.1)',
  };
}

// ════════════════════════════════════════════════════════════════════════════
// 1. Midnight Tokyo (dark) — current default, copied exactly from app.css
// ════════════════════════════════════════════════════════════════════════════

const midnightTokyo: Theme = {
  id: 'midnight-tokyo',
  name: 'Midnight Tokyo',
  group: 'dark',
  colorScheme: 'dark',
  colors: {
    ...SHARED_SPACING,
    ...darkShadows('rgba(122, 162, 247, 0.15)'),

    // shadcn base
    'background': '#0A0E1A',
    'foreground': '#C0CAF5',
    'card': '#13161F',
    'card-foreground': '#C0CAF5',
    'popover': '#1A1E2E',
    'popover-foreground': '#C0CAF5',
    'primary': '#7AA2F7',
    'primary-foreground': '#0A0E1A',
    'secondary': '#1A1E2E',
    'secondary-foreground': '#A9B1D6',
    'muted': '#13161F',
    'muted-foreground': '#6B7394',
    'accent': '#212537',
    'accent-foreground': '#C0CAF5',
    'destructive': '#F7768E',
    'border': '#1E2336',
    'input': '#2A2F45',
    'ring': '#7AA2F7',

    // Extended surfaces
    'base': '#0A0E1A',
    'surface-1': '#13161F',
    'surface-2': '#1A1E2E',
    'surface-3': '#212537',
    'border-subtle': '#1E2336',
    'border-active': '#2A2F45',

    // Accent palette
    'accent-blue': '#7AA2F7',
    'accent-purple': '#BB9AF7',
    'accent-cyan': '#7DCFFF',
    'accent-green': '#9ECE6A',
    'accent-red': '#F7768E',
    'accent-orange': '#FF9E64',
    'accent-yellow': '#E0AF68',

    // Text hierarchy
    'text-primary': '#C0CAF5',
    'text-secondary': '#A9B1D6',
    'text-muted': '#6B7394',
    'text-faint': '#3B4261',

    // Sidebar
    'sidebar': '#13161F',
    'sidebar-foreground': '#C0CAF5',
    'sidebar-primary': '#7AA2F7',
    'sidebar-primary-foreground': '#0A0E1A',
    'sidebar-accent': '#1A1E2E',
    'sidebar-accent-foreground': '#C0CAF5',
    'sidebar-border': '#1E2336',
    'sidebar-ring': '#7AA2F7',

    // UI states
    'hover': '#212537',
    'placeholder': '#6B7394',
    'accent-hover': '#9BABF8',
  },
  preview: {
    bg: '#0A0E1A',
    text: '#C0CAF5',
    textMuted: '#6B7394',
    link: '#7AA2F7',
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 2. Obsidian (dark) — true black, no color accent
// ════════════════════════════════════════════════════════════════════════════

const obsidian: Theme = {
  id: 'obsidian',
  name: 'Obsidian',
  group: 'dark',
  colorScheme: 'dark',
  colors: {
    ...SHARED_SPACING,
    ...darkShadows('rgba(255, 255, 255, 0.08)'),

    'background': '#000000',
    'foreground': '#E0E0E0',
    'card': '#0A0A0A',
    'card-foreground': '#E0E0E0',
    'popover': '#141414',
    'popover-foreground': '#E0E0E0',
    'primary': '#FFFFFF',
    'primary-foreground': '#000000',
    'secondary': '#141414',
    'secondary-foreground': '#B0B0B0',
    'muted': '#0A0A0A',
    'muted-foreground': '#666666',
    'accent': '#1E1E1E',
    'accent-foreground': '#E0E0E0',
    'destructive': '#E54545',
    'border': '#1A1A1A',
    'input': '#2A2A2A',
    'ring': '#FFFFFF',

    'base': '#000000',
    'surface-1': '#0A0A0A',
    'surface-2': '#141414',
    'surface-3': '#1E1E1E',
    'border-subtle': '#1A1A1A',
    'border-active': '#2A2A2A',

    'accent-blue': '#8A8A8A',
    'accent-purple': '#9A9A9A',
    'accent-cyan': '#AAAAAA',
    'accent-green': '#7A7A7A',
    'accent-red': '#E54545',
    'accent-orange': '#C0C0C0',
    'accent-yellow': '#D0D0D0',

    'text-primary': '#E0E0E0',
    'text-secondary': '#B0B0B0',
    'text-muted': '#666666',
    'text-faint': '#333333',

    'sidebar': '#0A0A0A',
    'sidebar-foreground': '#E0E0E0',
    'sidebar-primary': '#FFFFFF',
    'sidebar-primary-foreground': '#000000',
    'sidebar-accent': '#141414',
    'sidebar-accent-foreground': '#E0E0E0',
    'sidebar-border': '#1A1A1A',
    'sidebar-ring': '#FFFFFF',

    'hover': '#1E1E1E',
    'placeholder': '#666666',
    'accent-hover': '#FFFFFF',
  },
  preview: {
    bg: '#000000',
    text: '#E0E0E0',
    textMuted: '#666666',
    link: '#FFFFFF',
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 3. Nord Frost (dark) — Nord palette
// ════════════════════════════════════════════════════════════════════════════

const nordFrost: Theme = {
  id: 'nord-frost',
  name: 'Nord Frost',
  group: 'dark',
  colorScheme: 'dark',
  colors: {
    ...SHARED_SPACING,
    ...darkShadows('rgba(136, 192, 208, 0.15)'),

    'background': '#2E3440',
    'foreground': '#ECEFF4',
    'card': '#3B4252',
    'card-foreground': '#ECEFF4',
    'popover': '#434C5E',
    'popover-foreground': '#ECEFF4',
    'primary': '#88C0D0',
    'primary-foreground': '#2E3440',
    'secondary': '#434C5E',
    'secondary-foreground': '#D8DEE9',
    'muted': '#3B4252',
    'muted-foreground': '#7B88A1',
    'accent': '#4C566A',
    'accent-foreground': '#ECEFF4',
    'destructive': '#BF616A',
    'border': '#3B4252',
    'input': '#4C566A',
    'ring': '#88C0D0',

    'base': '#2E3440',
    'surface-1': '#3B4252',
    'surface-2': '#434C5E',
    'surface-3': '#4C566A',
    'border-subtle': '#3B4252',
    'border-active': '#4C566A',

    'accent-blue': '#88C0D0',
    'accent-purple': '#B48EAD',
    'accent-cyan': '#8FBCBB',
    'accent-green': '#A3BE8C',
    'accent-red': '#BF616A',
    'accent-orange': '#D08770',
    'accent-yellow': '#EBCB8B',

    'text-primary': '#ECEFF4',
    'text-secondary': '#D8DEE9',
    'text-muted': '#7B88A1',
    'text-faint': '#4C566A',

    'sidebar': '#3B4252',
    'sidebar-foreground': '#ECEFF4',
    'sidebar-primary': '#88C0D0',
    'sidebar-primary-foreground': '#2E3440',
    'sidebar-accent': '#434C5E',
    'sidebar-accent-foreground': '#ECEFF4',
    'sidebar-border': '#3B4252',
    'sidebar-ring': '#88C0D0',

    'hover': '#4C566A',
    'placeholder': '#7B88A1',
    'accent-hover': '#9DD0DE',
  },
  preview: {
    bg: '#2E3440',
    text: '#ECEFF4',
    textMuted: '#7B88A1',
    link: '#88C0D0',
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 4. Dawn (light) — clean white
// ════════════════════════════════════════════════════════════════════════════

const dawn: Theme = {
  id: 'dawn',
  name: 'Dawn',
  group: 'light',
  colorScheme: 'light',
  colors: {
    ...SHARED_SPACING,
    ...lightShadows('rgba(79, 107, 237, 0.15)'),

    'background': '#FFFFFF',
    'foreground': '#1A1A2E',
    'card': '#F5F5F7',
    'card-foreground': '#1A1A2E',
    'popover': '#EBEBEF',
    'popover-foreground': '#1A1A2E',
    'primary': '#4F6BED',
    'primary-foreground': '#FFFFFF',
    'secondary': '#EBEBEF',
    'secondary-foreground': '#2A2A3E',
    'muted': '#F5F5F7',
    'muted-foreground': '#6E6E8A',
    'accent': '#E0E0E4',
    'accent-foreground': '#1A1A2E',
    'destructive': '#DC2626',
    'border': '#DCDCE0',
    'input': '#C8C8CE',
    'ring': '#4F6BED',

    'base': '#FFFFFF',
    'surface-1': '#F5F5F7',
    'surface-2': '#EBEBEF',
    'surface-3': '#E0E0E4',
    'border-subtle': '#DCDCE0',
    'border-active': '#C8C8CE',

    'accent-blue': '#4F6BED',
    'accent-purple': '#7C5CFC',
    'accent-cyan': '#0EA5E9',
    'accent-green': '#16A34A',
    'accent-red': '#DC2626',
    'accent-orange': '#EA580C',
    'accent-yellow': '#CA8A04',

    'text-primary': '#1A1A2E',
    'text-secondary': '#3A3A52',
    'text-muted': '#6E6E8A',
    'text-faint': '#ABABC0',

    'sidebar': '#F5F5F7',
    'sidebar-foreground': '#1A1A2E',
    'sidebar-primary': '#4F6BED',
    'sidebar-primary-foreground': '#FFFFFF',
    'sidebar-accent': '#EBEBEF',
    'sidebar-accent-foreground': '#1A1A2E',
    'sidebar-border': '#DCDCE0',
    'sidebar-ring': '#4F6BED',

    'hover': '#E0E0E4',
    'placeholder': '#6E6E8A',
    'accent-hover': '#6B83F0',
  },
  preview: {
    bg: '#FFFFFF',
    text: '#1A1A2E',
    textMuted: '#6E6E8A',
    link: '#4F6BED',
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 5. Paper (light) — off-white, no color accent
// ════════════════════════════════════════════════════════════════════════════

const paper: Theme = {
  id: 'paper',
  name: 'Paper',
  group: 'light',
  colorScheme: 'light',
  colors: {
    ...SHARED_SPACING,
    ...lightShadows('rgba(44, 44, 44, 0.1)'),

    'background': '#FAFAF8',
    'foreground': '#1C1C1C',
    'card': '#F0F0EE',
    'card-foreground': '#1C1C1C',
    'popover': '#E6E6E4',
    'popover-foreground': '#1C1C1C',
    'primary': '#2C2C2C',
    'primary-foreground': '#FAFAF8',
    'secondary': '#E6E6E4',
    'secondary-foreground': '#333333',
    'muted': '#F0F0EE',
    'muted-foreground': '#777777',
    'accent': '#DCDCDA',
    'accent-foreground': '#1C1C1C',
    'destructive': '#C53030',
    'border': '#D8D8D6',
    'input': '#C4C4C2',
    'ring': '#2C2C2C',

    'base': '#FAFAF8',
    'surface-1': '#F0F0EE',
    'surface-2': '#E6E6E4',
    'surface-3': '#DCDCDA',
    'border-subtle': '#D8D8D6',
    'border-active': '#C4C4C2',

    'accent-blue': '#555555',
    'accent-purple': '#666666',
    'accent-cyan': '#4A4A4A',
    'accent-green': '#3D3D3D',
    'accent-red': '#C53030',
    'accent-orange': '#888888',
    'accent-yellow': '#999999',

    'text-primary': '#1C1C1C',
    'text-secondary': '#444444',
    'text-muted': '#777777',
    'text-faint': '#B0B0AE',

    'sidebar': '#F0F0EE',
    'sidebar-foreground': '#1C1C1C',
    'sidebar-primary': '#2C2C2C',
    'sidebar-primary-foreground': '#FAFAF8',
    'sidebar-accent': '#E6E6E4',
    'sidebar-accent-foreground': '#1C1C1C',
    'sidebar-border': '#D8D8D6',
    'sidebar-ring': '#2C2C2C',

    'hover': '#DCDCDA',
    'placeholder': '#777777',
    'accent-hover': '#444444',
  },
  preview: {
    bg: '#FAFAF8',
    text: '#1C1C1C',
    textMuted: '#777777',
    link: '#2C2C2C',
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 6. Solarized Light — official Solarized palette
// ════════════════════════════════════════════════════════════════════════════

const solarizedLight: Theme = {
  id: 'solarized-light',
  name: 'Solarized Light',
  group: 'light',
  colorScheme: 'light',
  colors: {
    ...SHARED_SPACING,
    ...lightShadows('rgba(38, 139, 210, 0.15)'),

    'background': '#FDF6E3',
    'foreground': '#657B83',
    'card': '#EEE8D5',
    'card-foreground': '#657B83',
    'popover': '#E8E2CF',
    'popover-foreground': '#657B83',
    'primary': '#268BD2',
    'primary-foreground': '#FDF6E3',
    'secondary': '#E8E2CF',
    'secondary-foreground': '#586E75',
    'muted': '#EEE8D5',
    'muted-foreground': '#93A1A1',
    'accent': '#DDD6C1',
    'accent-foreground': '#657B83',
    'destructive': '#DC322F',
    'border': '#D6CFB7',
    'input': '#C9C2AB',
    'ring': '#268BD2',

    'base': '#FDF6E3',
    'surface-1': '#EEE8D5',
    'surface-2': '#E8E2CF',
    'surface-3': '#DDD6C1',
    'border-subtle': '#D6CFB7',
    'border-active': '#C9C2AB',

    'accent-blue': '#268BD2',
    'accent-purple': '#6C71C4',
    'accent-cyan': '#2AA198',
    'accent-green': '#859900',
    'accent-red': '#DC322F',
    'accent-orange': '#CB4B16',
    'accent-yellow': '#B58900',

    'text-primary': '#657B83',
    'text-secondary': '#586E75',
    'text-muted': '#93A1A1',
    'text-faint': '#C5BFA7',

    'sidebar': '#EEE8D5',
    'sidebar-foreground': '#657B83',
    'sidebar-primary': '#268BD2',
    'sidebar-primary-foreground': '#FDF6E3',
    'sidebar-accent': '#E8E2CF',
    'sidebar-accent-foreground': '#657B83',
    'sidebar-border': '#D6CFB7',
    'sidebar-ring': '#268BD2',

    'hover': '#DDD6C1',
    'placeholder': '#93A1A1',
    'accent-hover': '#469BD6',
  },
  preview: {
    bg: '#FDF6E3',
    text: '#657B83',
    textMuted: '#93A1A1',
    link: '#268BD2',
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 7. Khaki (warm, light) — sepia / parchment
// ════════════════════════════════════════════════════════════════════════════

const khaki: Theme = {
  id: 'khaki',
  name: 'Khaki',
  group: 'warm',
  colorScheme: 'light',
  colors: {
    ...SHARED_SPACING,
    ...lightShadows('rgba(166, 124, 82, 0.15)'),

    'background': '#F5F0E8',
    'foreground': '#3D3529',
    'card': '#ECE7DF',
    'card-foreground': '#3D3529',
    'popover': '#E3DED6',
    'popover-foreground': '#3D3529',
    'primary': '#A67C52',
    'primary-foreground': '#F5F0E8',
    'secondary': '#E3DED6',
    'secondary-foreground': '#4D4539',
    'muted': '#ECE7DF',
    'muted-foreground': '#8A7E6E',
    'accent': '#DAD5CD',
    'accent-foreground': '#3D3529',
    'destructive': '#C0392B',
    'border': '#D4CFC7',
    'input': '#C5C0B8',
    'ring': '#A67C52',

    'base': '#F5F0E8',
    'surface-1': '#ECE7DF',
    'surface-2': '#E3DED6',
    'surface-3': '#DAD5CD',
    'border-subtle': '#D4CFC7',
    'border-active': '#C5C0B8',

    'accent-blue': '#7C9ABF',
    'accent-purple': '#9B7DB8',
    'accent-cyan': '#5F9EA0',
    'accent-green': '#6B8E4E',
    'accent-red': '#C0392B',
    'accent-orange': '#C97D3A',
    'accent-yellow': '#B8941F',

    'text-primary': '#3D3529',
    'text-secondary': '#5A5145',
    'text-muted': '#8A7E6E',
    'text-faint': '#C0BAB0',

    'sidebar': '#ECE7DF',
    'sidebar-foreground': '#3D3529',
    'sidebar-primary': '#A67C52',
    'sidebar-primary-foreground': '#F5F0E8',
    'sidebar-accent': '#E3DED6',
    'sidebar-accent-foreground': '#3D3529',
    'sidebar-border': '#D4CFC7',
    'sidebar-ring': '#A67C52',

    'hover': '#DAD5CD',
    'placeholder': '#8A7E6E',
    'accent-hover': '#BB9268',
  },
  preview: {
    bg: '#F5F0E8',
    text: '#3D3529',
    textMuted: '#8A7E6E',
    link: '#A67C52',
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 8. Rose Pine (warm, dark) — official Rose Pine palette
// ════════════════════════════════════════════════════════════════════════════

const rosePine: Theme = {
  id: 'rose-pine',
  name: 'Ros\u00e9 Pine',
  group: 'warm',
  colorScheme: 'dark',
  colors: {
    ...SHARED_SPACING,
    ...darkShadows('rgba(235, 111, 146, 0.15)'),

    'background': '#191724',
    'foreground': '#E0DEF4',
    'card': '#1F1D2E',
    'card-foreground': '#E0DEF4',
    'popover': '#26233A',
    'popover-foreground': '#E0DEF4',
    'primary': '#EB6F92',
    'primary-foreground': '#191724',
    'secondary': '#26233A',
    'secondary-foreground': '#E0DEF4',
    'muted': '#1F1D2E',
    'muted-foreground': '#908CAA',
    'accent': '#393552',
    'accent-foreground': '#E0DEF4',
    'destructive': '#EB6F92',
    'border': '#26233A',
    'input': '#393552',
    'ring': '#EB6F92',

    'base': '#191724',
    'surface-1': '#1F1D2E',
    'surface-2': '#26233A',
    'surface-3': '#393552',
    'border-subtle': '#26233A',
    'border-active': '#393552',

    'accent-blue': '#31748F',
    'accent-purple': '#C4A7E7',
    'accent-cyan': '#9CCFD8',
    'accent-green': '#9CCFD8',
    'accent-red': '#EB6F92',
    'accent-orange': '#F6C177',
    'accent-yellow': '#F6C177',

    'text-primary': '#E0DEF4',
    'text-secondary': '#E0DEF4',
    'text-muted': '#908CAA',
    'text-faint': '#6E6A86',

    'sidebar': '#1F1D2E',
    'sidebar-foreground': '#E0DEF4',
    'sidebar-primary': '#EB6F92',
    'sidebar-primary-foreground': '#191724',
    'sidebar-accent': '#26233A',
    'sidebar-accent-foreground': '#E0DEF4',
    'sidebar-border': '#26233A',
    'sidebar-ring': '#EB6F92',

    'hover': '#393552',
    'placeholder': '#908CAA',
    'accent-hover': '#F09AAF',
  },
  preview: {
    bg: '#191724',
    text: '#E0DEF4',
    textMuted: '#908CAA',
    link: '#EB6F92',
  },
};

// ── Export all themes ──

export const THEMES: Theme[] = [
  midnightTokyo,
  obsidian,
  nordFrost,
  dawn,
  paper,
  solarizedLight,
  khaki,
  rosePine,
];
