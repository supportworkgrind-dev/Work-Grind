/**
 * Framework-free core of WorkGrind i18n: dictionaries, key resolution with an
 * English fallback, plural selection, and locale-aware formatting.
 *
 * React components use the hooks in ./index.tsx. Code that runs outside
 * render (event handlers, stores, API interceptors) can use translate() and
 * the format* helpers, which follow the language the provider last applied.
 * During server rendering those module-level helpers always use English, so
 * call them from render only in client-only screens.
 */

export type LangCode = 'en' | 'ur' | 'ar' | 'fr' | 'de' | 'es' | 'zh' | 'hi';

export const LANG_CODES: readonly LangCode[] = ['en', 'ur', 'ar', 'fr', 'de', 'es', 'zh', 'hi'];
export const DEFAULT_LANG: LangCode = 'en';
export const RTL_LANGS: readonly LangCode[] = ['ur', 'ar'];

/** Cookie read by the root layout so the server renders the chosen language. */
export const LANG_COOKIE = 'workgrind_lang';
/** Earlier releases kept the choice only in localStorage under this key. */
export const LANG_STORAGE_KEY = 'wg_lang';

/** BCP 47 tags for Intl formatting. */
export const LOCALE_TAGS: Record<LangCode, string> = {
  en: 'en-US',
  ur: 'ur-PK',
  ar: 'ar',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  zh: 'zh-CN',
  hi: 'hi-IN',
};

export function isLangCode(value: unknown): value is LangCode {
  return typeof value === 'string' && (LANG_CODES as readonly string[]).includes(value);
}

export function directionOf(lang: LangCode): 'ltr' | 'rtl' {
  return RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
}

// ── Message definitions ─────────────────────────────────────────────────────

export type MessageTree = { readonly [key: string]: string | MessageTree };

/** Same keys as T, any string values: a translation must cover every key. */
export type Mirror<T> = { readonly [K in keyof T]: T[K] extends string ? string : Mirror<T[K]> };

/**
 * Every dot-path in T that ends in a string, e.g. "actions.save". A plural
 * group ({ one, other }) is also addressable by its own path, with `count`.
 */
export type MessagePath<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : (T[K] extends { readonly other: string } ? K : never) | `${K}.${MessagePath<T[K]>}`;
}[keyof T & string];

/**
 * Declares one namespace of interface text. English is the source of truth;
 * its Urdu mirror lives in messages/ur/<namespace>.ts, typed as
 * Mirror<typeof namespace.en> so it must have exactly the same keys, and is
 * loaded only when Urdu is the active language.
 * Plurals are objects with `one` and `other` keys, chosen by the `count` variable.
 */
export function defineMessages<const T extends MessageTree>(en: T): { en: T } {
  return { en };
}

export type TranslateVars = Record<string, string | number>;

// ── Resolution ──────────────────────────────────────────────────────────────

function lookup(tree: unknown, key: string): unknown {
  let node = tree;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function selectPlural(node: unknown, lang: LangCode, vars?: TranslateVars): unknown {
  if (!node || typeof node !== 'object' || typeof vars?.count !== 'number') return node;
  const forms = node as Record<string, unknown>;
  if (typeof forms.other !== 'string') return node;
  const category = new Intl.PluralRules(LOCALE_TAGS[lang]).select(vars.count);
  if (vars.count === 0 && typeof forms.zero === 'string') return forms.zero;
  return typeof forms[category] === 'string' ? forms[category] : forms.other;
}

function interpolate(text: string, lang: LangCode, vars?: TranslateVars): string {
  if (!vars) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    if (!(name in vars)) return match;
    const value = vars[name];
    return typeof value === 'number' ? formatNumber(value, undefined, lang) : String(value);
  });
}

const warned = new Set<string>();
function warnMissing(lang: LangCode, key: string, missingInEnglish: boolean) {
  if (process.env.NODE_ENV === 'production') return;
  const id = `${lang}:${key}`;
  if (warned.has(id)) return;
  warned.add(id);
  console.warn(missingInEnglish
    ? `[i18n] Missing message "${key}" (not defined in English either).`
    : `[i18n] Missing ${lang} message "${key}"; showing English.`);
}

/**
 * Resolves a key in `dictionaries[lang]`, then in English. Returns the key
 * itself only when English lacks it too (a programming error, warned in dev).
 */
export function resolveMessage(
  dictionaries: Partial<Record<LangCode, unknown>>,
  lang: LangCode,
  key: string,
  vars?: TranslateVars,
): string {
  let node = selectPlural(lookup(dictionaries[lang], key), lang, vars);
  let used = lang;
  if (typeof node !== 'string') {
    if (lang !== DEFAULT_LANG) warnMissing(lang, key, false);
    node = selectPlural(lookup(dictionaries[DEFAULT_LANG], key), DEFAULT_LANG, vars);
    used = DEFAULT_LANG;
  }
  if (typeof node !== 'string') {
    warnMissing(lang, key, true);
    return key;
  }
  return interpolate(node, used, vars);
}

/**
 * Like resolveMessage, but returns undefined when no language defines the key.
 * For labels of values that come from the server (roles, statuses), where an
 * unknown value should show as-is rather than as a key.
 */
export function resolveOptionalMessage(
  dictionaries: Partial<Record<LangCode, unknown>>,
  lang: LangCode,
  key: string,
  vars?: TranslateVars,
): string | undefined {
  const known = [lang, DEFAULT_LANG].some((code) => {
    const node = selectPlural(lookup(dictionaries[code], key), code, vars);
    return typeof node === 'string';
  });
  return known ? resolveMessage(dictionaries, lang, key, vars) : undefined;
}

// ── Active language for code outside React render ──────────────────────────

let activeLang: LangCode = DEFAULT_LANG;
let activeDictionaries: Partial<Record<LangCode, unknown>> = {};

/** Called by I18nProvider; not for components. */
export function setActiveLanguage(lang: LangCode, dictionaries: Partial<Record<LangCode, unknown>>) {
  activeLang = lang;
  activeDictionaries = dictionaries;
}

export function getActiveLanguage(): LangCode {
  return typeof window === 'undefined' ? DEFAULT_LANG : activeLang;
}

/** Translate outside React render (handlers, stores, interceptors). */
export function translate(key: string, vars?: TranslateVars): string {
  return resolveMessage(activeDictionaries, getActiveLanguage(), key, vars);
}

// ── Locale-aware formatting ────────────────────────────────────────────────

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  lang: LangCode = getActiveLanguage(),
): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(LOCALE_TAGS[lang], options).format(date) : '';
}

export function formatTime(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' },
  lang: LangCode = getActiveLanguage(),
): string {
  return formatDate(value, options, lang);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions, lang: LangCode = getActiveLanguage()): string {
  return Number.isFinite(value) ? new Intl.NumberFormat(LOCALE_TAGS[lang], options).format(value) : '';
}

/** `amount` is in major units (e.g. dollars), `currency` an ISO 4217 code. */
export function formatCurrency(amount: number, currency = 'USD', lang: LangCode = getActiveLanguage()): string {
  try {
    return formatNumber(amount, { style: 'currency', currency }, lang);
  } catch {
    return `${formatNumber(amount, { maximumFractionDigits: 2 }, lang)} ${currency}`;
  }
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

/** "3 hours ago" / "in 2 days" in the given language. */
export function formatRelativeTime(
  value: string | number | Date | null | undefined,
  lang: LangCode = getActiveLanguage(),
  now: number = Date.now(),
): string {
  const date = toDate(value);
  if (!date) return '';
  const seconds = Math.round((date.getTime() - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat(LOCALE_TAGS[lang], { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size || unit === 'second') {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return '';
}
