import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';

/**
 * Option lists for currency, IANA time zone, and phone calling-code pickers.
 * Data comes from the runtime's ICU/CLDR tables (Intl) and libphonenumber's
 * metadata rather than hand-written lists, so they stay complete and current.
 */

export type LocaleOption = {
  value: string;
  label: string;
  description?: string;
  /** Extra text matched by search (codes, symbols, aliases). */
  keywords?: string;
  leading?: string;
};

type IntlWithSupportedValues = typeof Intl & { supportedValuesOf?: (key: 'currency' | 'timeZone') => string[] };

function supportedValues(key: 'currency' | 'timeZone'): string[] | null {
  const intl = Intl as IntlWithSupportedValues;
  try {
    return typeof intl.supportedValuesOf === 'function' ? intl.supportedValuesOf(key) : null;
  } catch {
    return null;
  }
}

function displayName(type: 'currency' | 'region', code: string): string | undefined {
  try {
    return new Intl.DisplayNames(['en'], { type }).of(code) ?? undefined;
  } catch {
    return undefined;
  }
}

function pinned<T extends { value: string }>(items: T[], first: string[]): T[] {
  const byValue = new Map(items.map((item) => [item.value, item]));
  const top = first.map((value) => byValue.get(value)).filter((item): item is T => Boolean(item));
  return [...top, ...items.filter((item) => !first.includes(item.value))];
}

/** Regional-indicator flag emoji; platforms without flag glyphs show the letters. */
export function flagEmoji(region: string): string {
  return /^[A-Z]{2}$/.test(region)
    ? String.fromCodePoint(...[...region].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65))
    : '';
}

// ── Currencies (ISO 4217) ────────────────────────────────────────────────────

const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'PKR', 'AED', 'SAR', 'INR', 'CAD', 'AUD'];

function currencySymbol(code: string): string | undefined {
  try {
    const symbol = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value;
    return symbol && symbol !== code ? symbol : undefined;
  } catch {
    return undefined;
  }
}

let currencyCache: LocaleOption[] | null | undefined;

/** null when the runtime cannot list currencies (very old browsers). */
export function getCurrencyOptions(): LocaleOption[] | null {
  if (currencyCache !== undefined) return currencyCache;
  const codes = supportedValues('currency');
  currencyCache = codes && pinned(codes.map((code) => {
    const name = displayName('currency', code) ?? code;
    const symbol = currencySymbol(code);
    return {
      value: code,
      label: `${code} — ${name}`,
      description: symbol,
      keywords: `${code} ${name} ${symbol ?? ''}`,
    };
  }), POPULAR_CURRENCIES);
  return currencyCache;
}

// ── IANA time zones ──────────────────────────────────────────────────────────

/** Current UTC offset of a zone, e.g. "UTC+5" or "UTC-4" (follows daylight saving). */
export function timeZoneOffsetLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((item) => item.type === 'timeZoneName')?.value ?? '';
    return part === 'GMT' || part === 'UTC' ? 'UTC' : part.replace(/^GMT/, 'UTC');
  } catch {
    return '';
  }
}

function offsetMinutes(label: string): number {
  const match = /^UTC([+-])(\d{1,2})(?::(\d{2}))?$/.exec(label);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === '-' ? -minutes : minutes;
}

let timeZoneCache: LocaleOption[] | null | undefined;

/** Sorted by current UTC offset, then city. null when the runtime cannot list zones. */
export function getTimeZoneOptions(): LocaleOption[] | null {
  if (timeZoneCache !== undefined) return timeZoneCache;
  const zones = supportedValues('timeZone');
  if (!zones) {
    timeZoneCache = null;
    return null;
  }
  // UTC is the workspace schema default but is not part of the regional list.
  const all = zones.includes('UTC') ? zones : ['UTC', ...zones];
  timeZoneCache = all
    .map((zone) => {
      const offset = timeZoneOffsetLabel(zone);
      const parts = zone.split('/');
      const city = parts[parts.length - 1].replace(/_/g, ' ');
      const region = parts.slice(0, -1).join(' / ').replace(/_/g, ' ');
      return {
        value: zone,
        label: region ? `${city} (${region})` : city,
        description: offset,
        keywords: `${zone} ${zone.replace(/_/g, ' ')} ${offset}`,
        sort: offsetMinutes(offset),
      };
    })
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
    .map(({ value, label, description, keywords }) => ({ value, label, description, keywords }));
  return timeZoneCache;
}

// ── Phone calling codes ──────────────────────────────────────────────────────

const POPULAR_PHONE_COUNTRIES = ['PK', 'US', 'GB', 'AE', 'SA', 'IN', 'CA', 'AU'];

let phoneCountryCache: LocaleOption[] | undefined;

/** Every country libphonenumber supports, labelled "Pakistan (+92)". value = ISO code. */
export function getPhoneCountryOptions(): LocaleOption[] {
  if (phoneCountryCache) return phoneCountryCache;
  const options = getCountries()
    .map((country: CountryCode) => {
      const name = displayName('region', country) ?? country;
      const callingCode = getCountryCallingCode(country);
      return {
        value: country,
        label: `${name} (+${callingCode})`,
        leading: flagEmoji(country),
        keywords: `${name} ${country} +${callingCode} ${callingCode}`,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  phoneCountryCache = pinned(options, POPULAR_PHONE_COUNTRIES);
  return phoneCountryCache;
}

/** Matches a stored country name (workspace "country" field) to an ISO region code. */
export function regionCodeForCountryName(name: string | undefined): CountryCode | undefined {
  if (!name) return undefined;
  const wanted = name.trim().toLowerCase();
  return getCountries().find((country) =>
    country.toLowerCase() === wanted || displayName('region', country)?.toLowerCase() === wanted);
}
