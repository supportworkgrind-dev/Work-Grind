'use client';

import { useState } from 'react';
import { AlertCircle, Check, Download } from 'lucide-react';
import { api } from '@/lib/api';

/** Downloads the caller's own account data from GET /users/me/export. */
export function DataExportCard() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const exportData = async () => {
    setExporting(true);
    setError('');
    setDone(false);
    try {
      const res = await api.get('/users/me/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'workgrind-account-data.json';
      link.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      setError('Your data could not be exported. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="data-export-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 id="data-export-heading" className="text-xs font-bold text-slate-900">Download your account data</h4>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-slate-500">
            A JSON file with your profile, preferences, workspace membership, and security settings. It does not include
            workspace content (tasks, files, messages), which belongs to the workspace and is managed by its administrators.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void exportData()}
          disabled={exporting}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />{exporting ? 'Preparing…' : 'Download data'}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
      {done && <p role="status" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700"><Check className="h-3.5 w-3.5" />Your download has started.</p>}
    </section>
  );
}
