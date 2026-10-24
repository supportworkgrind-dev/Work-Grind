'use client';

/**
 * WorkGrind i18n — React provider and hooks.
 *
 *  - The root layout reads the `workgrind_lang` cookie and passes it as
 *    `initialLang`, so the server renders the chosen language and direction
 *    and the first paint never flips from English.
 *  - useT('tasks') returns a translator typed to that namespace's keys;
 *    useI18n().t accepts any dot-path (marketing dictionaries included).
 *  - Missing translations fall back to English, with a console warning in
 *    development. English is the source of truth for every key.
 *  - Signed-in members' language is their profile's `preferredLanguage`
 *    (applied by the app layout); see useLanguagePreference for changing it.
 */

import React, {
  createContext, useContext, useState, useEffect, useLayoutEffect,
  useCallback, useMemo, type ReactNode,
} from 'react';
import { en, type Translations } from './translations';
import { ar } from './translations/ar';
import { de } from './translations/de';
import { es } from './translations/es';
import { fr } from './translations/fr';
import { hi } from './translations/hi';
import { ur } from './translations/ur';
import { zh } from './translations/zh';
import { appMessagesEn, appMessagesUr, type NamespaceMessages, type NamespaceName } from './messages';
import {
  DEFAULT_LANG, LANG_COOKIE, LANG_STORAGE_KEY, LOCALE_TAGS,
  directionOf, isLangCode, resolveMessage, resolveOptionalMessage, setActiveLanguage,
  formatCurrency as formatCurrencyIn, formatDate as formatDateIn, formatNumber as formatNumberIn,
  formatRelativeTime as formatRelativeTimeIn, formatTime as formatTimeIn,
  type LangCode, type MessagePath, type TranslateVars,
} from './core';

export type { LangCode, TranslateVars } from './core';
export { LANG_COOKIE, isLangCode, directionOf, translate, getActiveLanguage } from './core';

// Marketing dictionaries (all languages) plus app namespaces (English and Urdu).
// Keys a language lacks resolve to English.
const DICTIONARIES: Record<LangCode, object> = {
  en: { ...en, ...appMessagesEn },
  ur: { ...ur, ...appMessagesUr },
  ar, fr, de, es, zh, hi,
};
const MARKETING: Record<LangCode, Translations> = { en, ur, ar, fr, de, es, zh, hi };

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

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function readCookieLang(): LangCode | null {
  const value = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${LANG_COOKIE}=`))
    ?.slice(LANG_COOKIE.length + 1);
  return isLangCode(value) ? value : null;
}

function persistLang(code: LangCode) {
  try { localStorage.setItem(LANG_STORAGE_KEY, code); } catch {}
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LANG_COOKIE}=${code}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function applyToDocument(code: LangCode) {
  const dir = directionOf(code);
  document.documentElement.lang = code;
  document.documentElement.dir = dir;
  document.documentElement.classList.toggle('rtl', dir === 'rtl');
}

// ── Context ────────────────────────────────────────────────────────────────

type Formatters = {
  /** Intl.DateTimeFormat in the active language. */
  formatDate: (value: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (value: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** `amount` in major units (e.g. 29 for $29). */
  formatCurrency: (amount: number, currency?: string) => string;
  formatRelativeTime: (value: string | number | Date | null | undefined) => string;
};

interface I18nContextValue extends Formatters {
  lang: LangCode;
  dir: 'ltr' | 'rtl';
  /** BCP 47 tag for the active language, e.g. "ur-PK". */
  locale: string;
  /** Switches the interface language on this device (does not save to the profile). */
  setLang: (code: LangCode) => void;
  /** Translate any dot-path key, with optional {{variable}} interpolation. */
  t: (key: string, vars?: TranslateVars) => string;
  /** Like t(), but undefined when no language defines the key (labels for server-sent values). */
  tOptional: (key: string, vars?: TranslateVars) => string | undefined;
  /** Marketing dictionary object — prefer t() */
  translations: Translations;
}

function createFormatters(lang: LangCode): Formatters {
  return {
    formatDate: (value, options) => formatDateIn(value, options, lang),
    formatTime: (value, options) => formatTimeIn(value, options, lang),
    formatNumber: (value, options) => formatNumberIn(value, options, lang),
    formatCurrency: (amount, currency) => formatCurrencyIn(amount, currency, lang),
    formatRelativeTime: (value) => formatRelativeTimeIn(value, lang),
  };
}

const I18nContext = createContext<I18nContextValue>({
  lang: DEFAULT_LANG,
  dir: 'ltr',
  locale: LOCALE_TAGS[DEFAULT_LANG],
  setLang: () => {},
  t: (key, vars) => resolveMessage(DICTIONARIES, DEFAULT_LANG, key, vars),
  tOptional: (key, vars) => resolveOptionalMessage(DICTIONARIES, DEFAULT_LANG, key, vars),
  translations: en,
  ...createFormatters(DEFAULT_LANG),
});

// ── Provider ───────────────────────────────────────────────────────────────

export function I18nProvider({ children, initialLang = DEFAULT_LANG }: { children: ReactNode; initialLang?: LangCode }) {
  // The server rendered `initialLang` (from the cookie), so hydration matches.
  const [lang, setLangState] = useState<LangCode>(initialLang);

  // Code outside render (stores, interceptors) follows the rendered language.
  if (typeof window !== 'undefined') setActiveLanguage(lang, DICTIONARIES);

  useIsomorphicLayoutEffect(() => {
    applyToDocument(lang);
  }, [lang]);

  // One-time migration: earlier releases kept the choice only in localStorage.
  useEffect(() => {
    if (readCookieLang()) return;
    let stored: string | null = null;
    try { stored = localStorage.getItem(LANG_STORAGE_KEY); } catch {}
    if (isLangCode(stored)) {
      persistLang(stored);
      if (stored !== initialLang) setLangState(stored);
    }
  }, [initialLang]);

  const setLang = useCallback((code: LangCode) => {
    if (!isLangCode(code)) return;
    persistLang(code);
    setLangState(code);
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    dir: directionOf(lang),
    locale: LOCALE_TAGS[lang],
    setLang,
    t: (key, vars) => resolveMessage(DICTIONARIES, lang, key, vars),
    tOptional: (key, vars) => resolveOptionalMessage(DICTIONARIES, lang, key, vars),
    translations: MARKETING[lang],
    ...createFormatters(lang),
  }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export type NamespaceKey<N extends NamespaceName> = MessagePath<NamespaceMessages<N>>;
export type Translator<N extends NamespaceName> = (key: NamespaceKey<N>, vars?: TranslateVars) => string;

/**
 * Translator for one namespace with typed keys:
 *   const t = useT('tasks'); t('empty.title'); t('count', { count: 3 })
 */
export function useT<N extends NamespaceName>(namespace: N): Translator<N> {
  const { t } = useI18n();
  return useCallback((key: NamespaceKey<N>, vars?: TranslateVars) => t(`${namespace}.${key}`, vars), [t, namespace]);
}

type RichRenderers = Record<string, (chunk: ReactNode) => ReactNode>;

/**
 * Renders a message containing simple tags, e.g.
 *   "Read the <terms>Terms</terms> first" with { terms: (c) => <Link href="/terms">{c}</Link> }.
 * Tags are not nested; text outside tags is rendered as-is (never as HTML).
 */
export function renderRich(message: string, renderers: RichRenderers): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(message))) {
    if (match.index > last) nodes.push(message.slice(last, match.index));
    const render = renderers[match[1]];
    nodes.push(<React.Fragment key={`${match[1]}-${match.index}`}>{render ? render(match[2]) : match[2]}</React.Fragment>);
    last = match.index + match[0].length;
  }
  if (last < message.length) nodes.push(message.slice(last));
  return nodes;
}
