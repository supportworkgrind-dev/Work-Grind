'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n, type LangCode } from '@/lib/i18n';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Changes the interface language. Signed-in members also save it to their
 * profile (the source the app layout applies on every device); visitors keep
 * it on this device only. A failed profile save restores the previous language.
 */
export function useLanguagePreference() {
  const { lang, setLang } = useI18n();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const changeLanguage = useCallback(async (code: LangCode): Promise<boolean> => {
    const previous = lang;
    setLang(code);
    setError(null);
    const { user, setUser } = useAuthStore.getState();
    if (!user || user.preferredLanguage === code) return true;
    setSaving(true);
    try {
      const res = await api.patch('/users/me', { preferredLanguage: code });
      if (!res.data?.success || !res.data.user) throw new Error('Language preference was not saved.');
      setUser(res.data.user);
      return true;
    } catch (err) {
      setLang(previous);
      setError(err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [lang, setLang]);

  return { lang, changeLanguage, saving, error };
}
