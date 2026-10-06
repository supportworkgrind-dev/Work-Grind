'use client';

/**
 * WorkGrind i18n — lightweight React context + hook.
 *
 * Architecture:
 *  - I18nProvider wraps the entire app (added to root layout)
 *  - useI18n() returns { t, lang, setLang, dir }
 *  - t(key) resolves dot-path keys against the active translation object
 *  - Selected language is persisted to localStorage under 'wg_lang'
 *  - RTL is applied via document.documentElement.dir and the CSS class 'rtl'
 *  - On first render, server always gets 'en' (no hydration mismatch)
 *  - Client reads localStorage after mount and updates instantly
 */

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, type ReactNode,
} from 'react';
import { en, type Translations } from './translations';
import { ar } from './translations/ar';
import { de } from './translations/de';
import { es } from './translations/es';
import { fr } from './translations/fr';
import { hi } from './translations/hi';
import { ur } from './translations/ur';
import { zh } from './translations/zh';

// Keep the translation graph in the same client module instead of generating
// lazy RSC chunks for the RootLayout provider.
const TRANSLATIONS: Record<string, Translations> = {
  en, ur, ar, fr, de, es, zh, hi,
};

export type LangCode = 'en' | 'ur' | 'ar' | 'fr' | 'de' | 'es' | 'zh' | 'hi';

export const LANGUAGES: { code: LangCode; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English'  },
  { code: 'ur', label: 'Urdu',    native: 'اردو'      },
  { code: 'ar', label: 'Arabic',  native: 'العربية'   },
  { code: 'zh', label: 'Chinese', native: '中文'       },
  { code: 'fr', label: 'French',  native: 'Français'  },
  { code: 'de', label: 'German',  native: 'Deutsch'   },
  { code: 'es', label: 'Spanish', native: 'Español'   },
  { code: 'hi', label: 'Hindi',   native: 'हिन्दी'    },
];

const STORAGE_KEY = 'wg_lang';
const DEFAULT_LANG: LangCode = 'en';

// ── Translation resolution ─────────────────────────────────────────────────

/**
 * Resolve a dot-notation key against a translation object.
 * Supports simple template interpolation: {{year}}, {{email}} etc.
 */
function resolve(
  obj: Record<string, unknown>,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const parts = key.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return key;
    cur = (cur as Record<string, unknown>)[p];
  }
  if (typeof cur !== 'string') return key;
  if (!vars) return cur;
  return cur.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{{${k}}}`,
  );
}

// ── Context ────────────────────────────────────────────────────────────────

interface I18nContextValue {
  lang: LangCode;
  dir: 'ltr' | 'rtl';
  setLang: (code: LangCode) => void;
  /** Translate a dot-path key, with optional variable interpolation */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Raw translations object — use t() instead where possible */
  translations: Translations;
}

const I18nContext = createContext<I18nContextValue>({
  lang:         DEFAULT_LANG,
  dir:          'ltr',
  setLang:      () => {},
  t:            (k) => k,
  translations: en,
});

// ── Provider ───────────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: ReactNode }) {
  // Always start with English so SSR and first client paint match exactly
  const [lang, setLangState] = useState<LangCode>(DEFAULT_LANG);
  const [translations, setTranslations] = useState<Translations>(en);
  const [mounted, setMounted] = useState(false);

  // After hydration: read localStorage and load the persisted language
  useEffect(() => {
    setMounted(true);
    let stored = DEFAULT_LANG;
    try {
      const v = localStorage.getItem(STORAGE_KEY) as LangCode | null;
      if (v && v in TRANSLATIONS) stored = v as LangCode;
    } catch {}
    if (stored !== DEFAULT_LANG) {
      loadAndApply(stored);
    } else {
      applyToDocument(DEFAULT_LANG, 'ltr');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyToDocument = (code: LangCode, dir: 'ltr' | 'rtl') => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = code;
    document.documentElement.dir  = dir;
    if (dir === 'rtl') {
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.classList.remove('rtl');
    }
  };

  const loadAndApply = useCallback(async (code: LangCode) => {
    try {
      const trans = TRANSLATIONS[code];
      if (!trans) return;
      setTranslations(trans);
      setLangState(code);
      applyToDocument(code, trans.dir);
    } catch (e) {
      console.error('[i18n] Failed to load language:', code, e);
    }
  }, []);

  const setLang = useCallback((code: LangCode) => {
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
    loadAndApply(code);
  }, [loadAndApply]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      resolve(translations as unknown as Record<string, unknown>, key, vars),
    [translations],
  );

  const dir: 'ltr' | 'rtl' = translations.dir;

  return (
    <I18nContext.Provider value={{ lang, dir, setLang, t, translations }}>
      {children}
    </I18nContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
