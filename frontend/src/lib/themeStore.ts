import { create } from 'zustand';
import { WORKSPACE_PROFILES, type WorkspaceProfile } from '@/lib/workspaceProfiles';

export const CLASSIC_THEMES = [
  { id: 'original', label: 'WorkGrind Original', description: 'Warm paper, evergreen, and a restrained clay accent.', swatches: ['#f5f2e9', '#fffdf7', '#294a38'], category: 'classic' },
  { id: 'midnight', label: 'Midnight', description: 'Quiet charcoal surfaces with a precise electric periwinkle.', swatches: ['#101216', '#1b1e24', '#a9b4ff'], category: 'classic' },
  { id: 'slate', label: 'Slate', description: 'Graphite ink, soft mineral gray, and muted blue.', swatches: ['#e9edf1', '#f8fafb', '#355574'], category: 'classic' },
  { id: 'forest', label: 'Forest', description: 'Deep evergreen with pale lichen and natural sage.', swatches: ['#101b17', '#1b2a23', '#9ac7a7'], category: 'classic' },
  { id: 'ocean', label: 'Ocean', description: 'Inky navy, cool porcelain, and clear tide-blue.', swatches: ['#0e1a25', '#192b39', '#73c9e8'], category: 'classic' },
  { id: 'sand', label: 'Sand', description: 'Sun-warmed limestone, espresso, and fired terracotta.', swatches: ['#eee5d6', '#faf5eb', '#a7472e'], category: 'classic' },
  { id: 'plum', label: 'Plum', description: 'Smoky aubergine, soft ivory, and a restrained orchid.', swatches: ['#201722', '#302333', '#c49ad7'], category: 'classic' },
  { id: 'high-contrast', label: 'High Contrast', description: 'Crisp black and white with clear focus and selection states.', swatches: ['#ffffff', '#f4f4f4', '#003b72'], category: 'classic' },
] as const;

export type ClassicTheme = (typeof CLASSIC_THEMES)[number]['id'];
const WORKSPACE_THEMES = WORKSPACE_PROFILES.map((profile) => ({
  id: profile.id,
  label: `${profile.shortLabel} workspace`,
  description: profile.description,
  swatches: profile.swatches,
  category: 'workspace',
  baseTheme: profile.baseTheme,
}));

export const THEME_OPTIONS = [...CLASSIC_THEMES, ...WORKSPACE_THEMES] as const;
export type Theme = (typeof THEME_OPTIONS)[number]['id'];

const STORAGE_KEY = 'workgrind_theme';
const DEFAULT_THEME = 'original' as const;
const LEGACY_THEMES: Record<string, ClassicTheme> = {
  light: 'original',
  dark: 'midnight',
  aurora: 'forest',
  graphite: 'midnight',
  neutral: 'sand',
};

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function persistTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Keep the theme active in memory when browser storage is unavailable.
  }
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${STORAGE_KEY}=${encodeURIComponent(theme)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  } catch {
    // Local storage remains the client-side persistence fallback.
  }
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const workspaceTheme = WORKSPACE_PROFILES.find((profile) => profile.id === theme);
  const baseTheme = normalizeClassicTheme(workspaceTheme?.baseTheme ?? theme);
  document.documentElement.setAttribute('data-theme', baseTheme);
  document.documentElement.style.colorScheme = isDarkTheme(baseTheme) ? 'dark' : 'light';
  if (workspaceTheme) {
    document.documentElement.setAttribute('data-workspace-profile', workspaceTheme.id);
  } else {
    document.documentElement.removeAttribute('data-workspace-profile');
  }
}

function normalizeClassicTheme(theme: unknown): ClassicTheme {
  if (CLASSIC_THEMES.some((option) => option.id === theme)) return theme as ClassicTheme;
  if (typeof theme === 'string' && LEGACY_THEMES[theme]) return LEGACY_THEMES[theme];
  return DEFAULT_THEME;
}

export function normalizeTheme(theme: unknown): Theme {
  if (CLASSIC_THEMES.some((option) => option.id === theme)) return theme as ClassicTheme;
  if (WORKSPACE_PROFILES.some((profile) => profile.id === theme)) return theme as WorkspaceProfile;
  return normalizeClassicTheme(theme);
}

export function getThemeBase(theme: Theme): ClassicTheme {
  const workspaceTheme = WORKSPACE_PROFILES.find((profile) => profile.id === theme);
  return normalizeClassicTheme(workspaceTheme?.baseTheme ?? theme);
}

export function isDarkTheme(theme: Theme): boolean {
  return ['midnight', 'forest', 'ocean', 'plum'].includes(getThemeBase(theme));
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: DEFAULT_THEME,
  setTheme: (theme: Theme) => {
    const normalizedTheme = normalizeTheme(theme);
    applyTheme(normalizedTheme);
    persistTheme(normalizedTheme);
    set({ theme: normalizedTheme });
  },
}));

export function hydrateThemeFromStorage(): Theme {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Fall back to the non-sensitive theme cookie when local storage is unavailable.
  }
  if (!saved && typeof document !== 'undefined') {
    saved = document.cookie
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${STORAGE_KEY}=`))
      ?.slice(STORAGE_KEY.length + 1) ?? null;
  }
  return normalizeTheme(saved);
}
