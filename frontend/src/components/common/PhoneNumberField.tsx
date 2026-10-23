'use client';

import { useMemo, useState } from 'react';
import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { getPhoneCountryOptions } from '@/lib/localeOptions';

export type PhoneValue = {
  /** E.164 (e.g. +923001234567), '' when cleared, or the typed text when it cannot be parsed. */
  value: string;
  valid: boolean;
};

/** Combines the selected calling-code country with the national number. */
export function composePhoneNumber(country: CountryCode | undefined, national: string): PhoneValue {
  const trimmed = national.trim();
  if (!trimmed) return { value: '', valid: true };
  // A full international number typed into the field wins over the picker.
  const parsed = trimmed.startsWith('+')
    ? parsePhoneNumberFromString(trimmed)
    : country ? parsePhoneNumberFromString(trimmed, country) : undefined;
  if (parsed?.isValid()) return { value: parsed.number, valid: true };
  if (!country || trimmed.startsWith('+')) return { value: trimmed, valid: false };
  return { value: `+${getCountryCallingCode(country)}${trimmed.replace(/\D/g, '')}`, valid: false };
}

function splitStoredNumber(stored: string, fallbackCountry?: CountryCode): { country?: CountryCode; national: string } {
  if (!stored) return { country: fallbackCountry, national: '' };
  const parsed = parsePhoneNumberFromString(stored);
  // Shared calling codes (e.g. +1 for US and Canada) resolve from the number itself.
  if (parsed?.country) return { country: parsed.country, national: parsed.formatNational() };
  // Saved before numbers were normalized, or non-geographic: show it unchanged.
  return { country: undefined, national: stored };
}

type PhoneNumberFieldProps = {
  id: string;
  defaultValue: string;
  defaultCountry?: CountryCode;
  onChange: (phone: PhoneValue) => void;
  invalid?: boolean;
};

/**
 * Calling-code picker (flag, country name, +code; searchable by name or code)
 * beside a separate national-number input. Uncontrolled after mount: re-key it
 * to load a different saved number.
 */
export function PhoneNumberField({ id, defaultValue, defaultCountry, onChange, invalid = false }: PhoneNumberFieldProps) {
  const initial = useMemo(() => splitStoredNumber(defaultValue, defaultCountry), [defaultValue, defaultCountry]);
  const [country, setCountry] = useState<CountryCode | undefined>(initial.country);
  const [national, setNational] = useState(initial.national);
  const options = getPhoneCountryOptions();

  const update = (nextCountry: CountryCode | undefined, nextNational: string) => {
    setCountry(nextCountry);
    setNational(nextNational);
    onChange(composePhoneNumber(nextCountry, nextNational));
  };

  return (
    <div className="mt-1.5 flex gap-2">
      <SearchableSelect
        className="w-36 shrink-0 sm:w-40"
        value={country ?? ''}
        onChange={(code) => update(code as CountryCode, national)}
        options={options}
        placeholder="Code"
        searchPlaceholder="Search country or code (e.g. +92)"
        ariaLabel="Country calling code"
        renderValue={(option) => `${option.leading ? `${option.leading} ` : ''}+${getCountryCallingCode(option.value as CountryCode)}`}
      />
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={national}
        onChange={(event) => update(country, event.target.value)}
        aria-invalid={invalid || undefined}
        placeholder={country ? 'Phone number' : 'Choose a country code first'}
        className={`block w-full min-w-0 rounded-xl border py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600 ${invalid ? 'border-rose-300' : 'border-slate-200'}`}
      />
    </div>
  );
}
