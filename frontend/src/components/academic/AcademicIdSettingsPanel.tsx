'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { describeApiError } from '@/lib/apiError';
import { useT } from '@/lib/i18n';

type IdentifierSettings = {
  studentIdPrefix: string;
  teacherIdPrefix: string;
  parentIdPrefix: string;
  idPadding: number;
  rollNumberMode: 'manual' | 'sequential_per_class';
  rollNumberPadding: number;
};

export function AcademicIdSettingsPanel() {
  const t = useT('academic');
  const [settings, setSettings] = useState<IdentifierSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/academic/imports/settings')
      .then((response) => { if (active) setSettings(response.data.settings); })
      .catch((requestError) => { if (active) setError(describeApiError(requestError, 'Unable to load identifier settings.').message); });
    return () => { active = false; };
  }, []);

  const update = <K extends keyof IdentifierSettings>(key: K, value: IdentifierSettings[K]) => {
    setSettings((current) => current ? { ...current, [key]: value } : current);
    setMessage('');
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await api.put('/academic/imports/settings', settings);
      setSettings(response.data.settings);
      setMessage(t('imports.settings.saved'));
    } catch (requestError) {
      setError(describeApiError(requestError, 'Unable to save identifier settings.').message);
    } finally { setSaving(false); }
  };

  return (
    <div role="tabpanel" className="mt-5">
      <h3 className="text-sm font-semibold">{t('imports.settings.heading')}</h3>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{t('imports.settings.description')}</p>
      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {settings ? <form className="academic-form mt-4" onSubmit={(event) => void save(event)}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label>{t('imports.settings.studentPrefix')}<input required maxLength={12} pattern="[A-Za-z0-9-]{1,12}" value={settings.studentIdPrefix} onChange={(event) => update('studentIdPrefix', event.target.value.toUpperCase())} /></label>
          <label>{t('imports.settings.teacherPrefix')}<input required maxLength={12} pattern="[A-Za-z0-9-]{1,12}" value={settings.teacherIdPrefix} onChange={(event) => update('teacherIdPrefix', event.target.value.toUpperCase())} /></label>
          <label>{t('imports.settings.parentPrefix')}<input required maxLength={12} pattern="[A-Za-z0-9-]{1,12}" value={settings.parentIdPrefix} onChange={(event) => update('parentIdPrefix', event.target.value.toUpperCase())} /></label>
          <label>{t('imports.settings.idDigits')}<input type="number" min={4} max={10} required value={settings.idPadding} onChange={(event) => update('idPadding', Number(event.target.value))} /></label>
          <label>{t('imports.settings.rollMode')}<select value={settings.rollNumberMode} onChange={(event) => update('rollNumberMode', event.target.value as IdentifierSettings['rollNumberMode'])}>
            <option value="manual">{t('imports.settings.rollModes.manual')}</option>
            <option value="sequential_per_class">{t('imports.settings.rollModes.sequential_per_class')}</option>
          </select></label>
          <label>{t('imports.settings.rollDigits')}<input type="number" min={1} max={6} required value={settings.rollNumberPadding} onChange={(event) => update('rollNumberPadding', Number(event.target.value))} /></label>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('imports.settings.example', { example: `${settings.studentIdPrefix}-${'1'.padStart(settings.idPadding || 6, '0')}` })}</p>
        <button type="submit" className="btn-primary w-fit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t('imports.settings.save')}</button>
      </form> : !error && <p className="mt-4 flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}><Loader2 className="h-4 w-4 animate-spin" />{t('loading')}</p>}
    </div>
  );
}
