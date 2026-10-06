'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { useThemeStore } from '@/lib/themeStore';

export function CookiePreferenceControl() {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const resetThemePreference = async () => {
    setSaving(true);
    try {
      setError('');
      const { user, setUser } = useAuthStore.getState();
      if (user) {
        await api.patch('/users/me', { theme: 'original' });
        setUser({ ...user, theme: 'original' });
        useThemeStore.getState().setTheme('original');
      } else {
        localStorage.removeItem('workgrind_theme');
        document.cookie = 'workgrind_theme=; Path=/; Max-Age=0; SameSite=Lax';
        window.location.reload();
      }
    } catch (requestError) {
      console.error('[Cookie Preferences] Could not reset the saved theme:', requestError);
      setError('The saved theme could not be reset. Try again or use your browser settings to clear site data.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-5 border-t border-slate-100 pt-5">
      <button type="button" onClick={() => void resetThemePreference()} disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
        <Trash2 className="h-4 w-4" />
        {saving ? 'Resetting…' : 'Reset theme to WorkGrind default'}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
