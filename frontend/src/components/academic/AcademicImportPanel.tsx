'use client';

import { DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react';
import { api } from '@/lib/api';
import { describeApiError } from '@/lib/apiError';
import { useT } from '@/lib/i18n';

type ImportModule = { id: string; label: string; description: string; headers: string[]; required: string[] };
type ImportIssue = { rowNumber: number; field?: string; code: string; message: string };
type ImportPreview = {
  sheets: string[];
  worksheet?: string;
  headers: string[];
  totalRows: number;
  preview: Array<Record<string, string>>;
  issues: ImportIssue[];
  validRows: number;
  invalidRows: number;
};
type ImportJob = {
  id: string;
  module: string;
  mode: string;
  originalFilename: string;
  status: 'queued' | 'processing' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  skippedRows: number;
  failedRows: number;
  issueCount: number;
  createdAt: string;
  completedAt?: string;
};

const MODES = ['create_only', 'update_only', 'upsert', 'skip_duplicates'] as const;

export function AcademicImportPanel() {
  const t = useT('academic');
  const [modules, setModules] = useState<ImportModule[]>([]);
  const [moduleId, setModuleId] = useState('');
  const [mode, setMode] = useState<(typeof MODES)[number]>('create_only');
  const [worksheet, setWorksheet] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedModule = useMemo(() => modules.find((item) => item.id === moduleId), [moduleId, modules]);

  const loadHistory = async () => {
    const response = await api.get('/academic/imports/history');
    setHistory(response.data.jobs ?? []);
  };

  useEffect(() => {
    let active = true;
    void Promise.all([api.get('/academic/imports/modules'), api.get('/academic/imports/history')])
      .then(([moduleResponse, historyResponse]) => {
        if (!active) return;
        const nextModules = moduleResponse.data.modules ?? [];
        setModules(nextModules);
        setModuleId((current) => current || nextModules[0]?.id || '');
        setHistory(historyResponse.data.jobs ?? []);
      })
      .catch((requestError) => { if (active) setError(describeApiError(requestError, 'Unable to load import options.').message); });
    return () => { active = false; };
  }, []);

  const chooseFile = (nextFile: File | null) => {
    setError('');
    setMessage('');
    setPreview(null);
    setIdempotencyKey('');
    if (!nextFile) return;
    const name = nextFile.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
      setError('Only CSV and XLSX files are supported.');
      return;
    }
    setFile(nextFile);
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    chooseFile(event.dataTransfer.files[0] ?? null);
  };

  const downloadTemplate = async (format: 'csv' | 'xlsx') => {
    if (!moduleId) return;
    setBusy(true); setError('');
    try {
      const response = await api.get(`/academic/imports/templates/${moduleId}?format=${format}`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `workgrind-${moduleId}-template.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(describeApiError(requestError, 'Unable to download the template.').message);
    } finally { setBusy(false); }
  };

  const previewFile = async () => {
    if (!file || !moduleId) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const body = new FormData();
      body.append('module', moduleId);
      if (worksheet) body.append('worksheet', worksheet);
      body.append('file', file);
      const response = await api.post('/academic/imports/preview', body);
      setPreview(response.data.preview);
      setIdempotencyKey((current) => current || window.crypto.randomUUID());
      if (!worksheet && response.data.preview?.worksheet) setWorksheet(response.data.preview.worksheet);
    } catch (requestError) {
      setError(describeApiError(requestError, 'Unable to parse this file.').message);
    } finally { setBusy(false); }
  };

  const confirmImport = async () => {
    if (!file || !moduleId || !preview) return;
    if (!window.confirm(`Import ${preview.validRows} valid row(s) into ${selectedModule?.label ?? moduleId}? Existing records follow the selected import behavior.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const body = new FormData();
      body.append('module', moduleId);
      body.append('mode', mode);
      body.append('confirmed', 'true');
      body.append('idempotencyKey', idempotencyKey || window.crypto.randomUUID());
      if (worksheet) body.append('worksheet', worksheet);
      body.append('file', file);
      const response = await api.post('/academic/imports/jobs', body);
      const job = response.data.job as ImportJob;
      setMessage(`${job.successfulRows} imported, ${job.skippedRows} skipped, ${job.failedRows} failed.`);
      setPreview(null); setFile(null); setWorksheet(''); setIdempotencyKey('');
      if (inputRef.current) inputRef.current.value = '';
      await loadHistory();
    } catch (requestError) {
      setError(describeApiError(requestError, 'The import could not be completed.').message);
      await loadHistory().catch(() => undefined);
    } finally { setBusy(false); }
  };

  const downloadErrors = async (job: ImportJob) => {
    try {
      const response = await api.get(`/academic/imports/jobs/${job.id}/errors.csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a'); link.href = url; link.download = `${job.module}-import-errors.csv`; link.click(); URL.revokeObjectURL(url);
    } catch (requestError) { setError(describeApiError(requestError, 'Unable to download the error report.').message); }
  };

  return (
    <section className="academic-card xl:col-span-2" aria-busy={busy}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="academic-heading mb-1">{t('imports.heading')}</h2><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('imports.description')}</p></div>
        <FileSpreadsheet className="h-5 w-5 shrink-0" style={{ color: 'var(--accent)' }} aria-hidden="true" />
      </div>
      <p className="mt-4 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>{t('imports.instructions')}</p>
      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="academic-form text-xs font-medium">{t('imports.module')}
          <select value={moduleId} onChange={(event) => { setModuleId(event.target.value); setPreview(null); }}>
            {modules.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="academic-form text-xs font-medium">{t('imports.mode')}
          <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
            {MODES.map((item) => <option key={item} value={item}>{t(`imports.modes.${item}`)}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="button" className="btn-secondary flex-1" disabled={busy || !moduleId} onClick={() => void downloadTemplate('csv')}><Download className="h-4 w-4" />{t('imports.downloadCsv')}</button>
          <button type="button" className="btn-secondary flex-1" disabled={busy || !moduleId} onClick={() => void downloadTemplate('xlsx')}><Download className="h-4 w-4" />{t('imports.downloadXlsx')}</button>
        </div>
      </div>

      <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="mt-5 flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition hover:border-[var(--accent)]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
        <UploadCloud className="h-7 w-7" style={{ color: 'var(--accent)' }} aria-hidden="true" />
        <span className="text-sm font-semibold">{file?.name ?? t('imports.chooseFile')}</span>
        <span className="text-xs">CSV or XLSX · 50 MB maximum · 10,000 rows maximum</span>
      </button>
      <input ref={inputRef} className="sr-only" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />

      {preview?.sheets && preview.sheets.length > 1 && <label className="academic-form mt-4 max-w-sm text-xs font-medium">{t('imports.worksheet')}
        <select value={worksheet || preview.worksheet || preview.sheets[0]} onChange={(event) => { setWorksheet(event.target.value); setPreview(null); }}>
          {preview.sheets.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
        </select>
      </label>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={busy || !file || !moduleId} onClick={() => void previewFile()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t('imports.preview')}</button>
        <button type="button" className="btn-secondary" disabled={busy || !preview || preview.validRows === 0} onClick={() => void confirmImport()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t('imports.confirm')}</button>
      </div>
      {busy && <p role="status" className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{t('imports.processing')}</p>}

      {preview ? <div className="mt-5 space-y-3">
        <p className="text-sm font-semibold">{t('imports.previewSummary', { total: String(preview.totalRows), valid: String(preview.validRows), invalid: String(preview.invalidRows) })}</p>
        {preview.issues.length > 0 && <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-color)' }}><table className="min-w-full text-left text-xs"><thead><tr style={{ background: 'var(--bg-base)' }}><th className="px-3 py-2">{t('imports.issueTable.row')}</th><th className="px-3 py-2">{t('imports.issueTable.field')}</th><th className="px-3 py-2">{t('imports.issueTable.reason')}</th></tr></thead><tbody>{preview.issues.slice(0, 20).map((item, index) => <tr key={`${item.rowNumber}-${item.code}-${index}`} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}><td className="px-3 py-2">{item.rowNumber}</td><td className="px-3 py-2">{item.field ?? '—'}</td><td className="px-3 py-2">{item.message}</td></tr>)}</tbody></table></div>}
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-color)' }}><table className="min-w-full text-left text-xs"><thead><tr style={{ background: 'var(--bg-base)' }}>{preview.headers.slice(0, 8).map((header) => <th key={header} className="whitespace-nowrap px-3 py-2">{header}</th>)}</tr></thead><tbody>{preview.preview.slice(0, 5).map((row, index) => <tr key={index} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>{preview.headers.slice(0, 8).map((header) => <td key={header} className="max-w-48 truncate px-3 py-2">{row[header]}</td>)}</tr>)}</tbody></table></div>
      </div> : <p className="mt-5 text-sm" style={{ color: 'var(--text-muted)' }}>{t('imports.noPreview')}</p>}

      <div className="mt-8 border-t pt-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h3 className="mb-3 text-sm font-semibold">{t('imports.history')}</h3>
        {history.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('imports.noHistory')}</p> : <div className="space-y-2">{history.map((job) => <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-3" style={{ background: 'var(--bg-base)' }}><div className="min-w-0"><p className="truncate text-sm font-medium">{job.originalFilename}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{job.module} · {t(`imports.status.${job.status}`)} · {job.successfulRows} ok · {job.skippedRows} skipped · {job.failedRows} failed</p></div>{job.issueCount > 0 && <button type="button" className="btn-secondary text-xs" onClick={() => void downloadErrors(job)}>{t('imports.downloadErrors')}</button>}</div>)}</div>}
      </div>
      <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>{t('imports.googlePending')}</p>
    </section>
  );
}
