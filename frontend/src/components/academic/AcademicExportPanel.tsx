'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { describeApiError } from '@/lib/apiError';
import { useT } from '@/lib/i18n';
import { ImportModule, saveDownload } from './academicImportTypes';

export function AcademicExportPanel({ modules }: { modules: ImportModule[] }) {
  const t = useT('academic');
  const exportable = modules.filter((item) => item.exportable);
  const [moduleId, setModuleId] = useState('');
  const [busy, setBusy] = useState<'' | 'csv' | 'xlsx'>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const selected = moduleId || exportable[0]?.id || '';

  const download = async (format: 'csv' | 'xlsx') => {
    if (!selected) return;
    setBusy(format); setError(''); setMessage('');
    try {
      const response = await api.get<Blob>(`/academic/exports/${selected}?format=${format}`, { responseType: 'blob' });
      saveDownload(response, `workgrind-${selected}.${format}`);
      setMessage(t('imports.export.done'));
    } catch (requestError) {
      setError(describeApiError(requestError, 'Unable to export these records.').message);
    } finally { setBusy(''); }
  };

  return (
    <div role="tabpanel" className="mt-5">
      <h3 className="text-sm font-semibold">{t('imports.export.heading')}</h3>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{t('imports.export.description')}</p>
      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <label className="academic-form text-xs font-medium">{t('imports.export.module')}
          <select value={selected} onChange={(event) => setModuleId(event.target.value)}>
            {exportable.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2 lg:col-span-2">
          <button type="button" className="btn-secondary" disabled={Boolean(busy) || !selected} onClick={() => void download('csv')}>{busy === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{t('imports.export.csv')}</button>
          <button type="button" className="btn-secondary" disabled={Boolean(busy) || !selected} onClick={() => void download('xlsx')}>{busy === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{t('imports.export.xlsx')}</button>
        </div>
      </div>
    </div>
  );
}
