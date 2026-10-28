'use client';

import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, FileSpreadsheet, Loader2, MailPlus, UploadCloud } from 'lucide-react';
import { api } from '@/lib/api';
import { describeApiError } from '@/lib/apiError';
import { useI18n, useT } from '@/lib/i18n';
import { AcademicExportPanel } from './AcademicExportPanel';
import { AcademicIdSettingsPanel } from './AcademicIdSettingsPanel';
import { AcademicOnboardingPanel } from './AcademicOnboardingPanel';
import {
  ImportJob,
  ImportMapping,
  ImportModule,
  ImportPreview,
  InvitationSummary,
  saveDownload,
  skippedInvitations,
} from './academicImportTypes';

const MODES = ['create_only', 'update_only', 'upsert', 'skip_duplicates'] as const;
const TABS = ['import', 'export', 'onboarding', 'settings'] as const;
type Tab = (typeof TABS)[number];
type Progress = { processedRows: number; totalRows: number };

const ACTION_STYLES: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  update: 'bg-sky-50 text-sky-800 border-sky-200',
  skip: 'bg-slate-50 text-slate-700 border-slate-200',
  error: 'bg-rose-50 text-rose-800 border-rose-200',
};

export function AcademicImportPanel() {
  const t = useT('academic');
  const { formatDate } = useI18n();
  const searchParams = useSearchParams();
  const requestedModule = searchParams.get('module');
  const [tab, setTab] = useState<Tab>('import');
  const [modules, setModules] = useState<ImportModule[]>([]);
  const [moduleId, setModuleId] = useState('');
  const [mode, setMode] = useState<(typeof MODES)[number]>('create_only');
  const [worksheet, setWorksheet] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [stale, setStale] = useState(false);
  const [allowReimport, setAllowReimport] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [lastJob, setLastJob] = useState<ImportJob | null>(null);
  const [inviteSummary, setInviteSummary] = useState<InvitationSummary | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedModule = useMemo(() => modules.find((item) => item.id === moduleId), [moduleId, modules]);

  const loadHistory = useCallback(async () => {
    const response = await api.get('/academic/imports/history');
    setHistory(response.data.jobs ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([api.get('/academic/imports/modules'), api.get('/academic/imports/history')])
      .then(([moduleResponse, historyResponse]) => {
        if (!active) return;
        const nextModules: ImportModule[] = moduleResponse.data.modules ?? [];
        setModules(nextModules);
        setModuleId((current) => current || nextModules.find((item) => item.id === requestedModule)?.id || nextModules[0]?.id || '');
        setHistory(historyResponse.data.jobs ?? []);
      })
      .catch((requestError) => { if (active) setError(describeApiError(requestError, 'Unable to load import options.').message); });
    return () => { active = false; };
  }, [requestedModule]);

  const resetPreview = () => {
    setPreview(null);
    setMapping({});
    setStale(false);
    setAllowReimport(false);
    setIdempotencyKey('');
  };

  const chooseFile = (nextFile: File | null) => {
    setError('');
    setMessage('');
    resetPreview();
    setWorksheet('');
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
      const response = await api.get<Blob>(`/academic/imports/templates/${moduleId}?format=${format}`, { responseType: 'blob' });
      saveDownload(response, `workgrind-${moduleId}-template.${format}`);
    } catch (requestError) {
      setError(describeApiError(requestError, 'Unable to download the template.').message);
    } finally { setBusy(false); }
  };

  const previewFile = async () => {
    if (!file || !moduleId) return;
    setBusy(true); setError(''); setMessage(''); setLastJob(null); setInviteSummary(null);
    try {
      const body = new FormData();
      body.append('module', moduleId);
      body.append('mode', mode);
      if (worksheet) body.append('worksheet', worksheet);
      // The first validation uses the server's suggested mapping; later ones send the administrator's choices.
      if (preview) body.append('mapping', JSON.stringify(mapping));
      body.append('file', file);
      const response = await api.post('/academic/imports/preview', body);
      const nextPreview: ImportPreview = response.data.preview;
      setPreview(nextPreview);
      setMapping(nextPreview.mapping ?? {});
      setStale(false);
      // Each validated mapping is a distinct import request.
      setIdempotencyKey(window.crypto.randomUUID());
      if (!worksheet && nextPreview.worksheet) setWorksheet(nextPreview.worksheet);
    } catch (requestError) {
      setError(describeApiError(requestError, 'Unable to parse this file.').message);
    } finally { setBusy(false); }
  };

  const confirmImport = async () => {
    if (!file || !moduleId || !preview || stale) return;
    if (!window.confirm(t('imports.confirmPrompt', { count: String(preview.validRows), module: selectedModule?.label ?? moduleId }))) return;
    const key = idempotencyKey || window.crypto.randomUUID();
    setBusy(true); setError(''); setMessage(''); setProgress(null);
    // The import runs inside this request; its saved progress is polled until it returns.
    const poll = window.setInterval(() => {
      void api.get(`/academic/imports/progress/${key}`)
        .then((response) => setProgress(response.data.progress))
        .catch(() => undefined);
    }, 1000);
    try {
      const body = new FormData();
      body.append('module', moduleId);
      body.append('mode', mode);
      body.append('confirmed', 'true');
      body.append('idempotencyKey', key);
      body.append('mapping', JSON.stringify(mapping));
      if (allowReimport) body.append('allowReimport', 'true');
      if (worksheet) body.append('worksheet', worksheet);
      body.append('file', file);
      const response = await api.post('/academic/imports/jobs', body);
      const job = response.data.job as ImportJob;
      setLastJob(job);
      setMessage([
        t('imports.resultSummary', { imported: String(job.successfulRows), skipped: String(job.skippedRows), failed: String(job.failedRows) }),
        job.generatedIdCount ? t('imports.resultGenerated', { count: String(job.generatedIdCount) }) : '',
      ].filter(Boolean).join(' '));
      resetPreview(); setFile(null); setWorksheet('');
      if (inputRef.current) inputRef.current.value = '';
      await loadHistory();
    } catch (requestError) {
      setError(describeApiError(requestError, 'The import could not be completed.').message);
      await loadHistory().catch(() => undefined);
    } finally {
      window.clearInterval(poll);
      setProgress(null);
      setBusy(false);
    }
  };

  const sendJobInvitations = async (job: ImportJob) => {
    if (!window.confirm(t('imports.invite.confirm', { count: String(job.personCount ?? 0) }))) return;
    setBusy(true); setError(''); setInviteSummary(null);
    try {
      const response = await api.post('/academic/invitations/send', { importJobId: job.id, confirmed: true });
      setInviteSummary(response.data.summary);
    } catch (requestError) {
      setError(describeApiError(requestError, 'Unable to send invitations.').message);
    } finally { setBusy(false); }
  };

  const downloadErrors = async (job: ImportJob) => {
    try {
      const response = await api.get<Blob>(`/academic/imports/jobs/${job.id}/errors.csv`, { responseType: 'blob' });
      saveDownload(response, `${job.module}-import-errors.csv`);
    } catch (requestError) { setError(describeApiError(requestError, 'Unable to download the error report.').message); }
  };

  const updateMapping = (fieldKey: string, source: string) => {
    setMapping((current) => ({ ...current, [fieldKey]: source || null }));
    setStale(true);
  };

  const columnLabel = (header: string) => {
    const index = preview?.headers.indexOf(header) ?? -1;
    return (index >= 0 && preview?.headerLabels[index]) || header;
  };
  const shownFields = (preview?.fields ?? []).filter((field) => typeof mapping[field.key] === 'string' || preview?.previewRows.some((row) => row.generated.includes(field.key))).slice(0, 8);
  const progressPercent = progress && progress.totalRows ? Math.min(100, Math.round((progress.processedRows / progress.totalRows) * 100)) : 0;
  const invitableJob = lastJob && modules.find((item) => item.id === lastJob.module)?.invitable && (lastJob.personCount ?? 0) > 0 ? lastJob : null;

  return (
    <section className="academic-card xl:col-span-2" aria-busy={busy}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="academic-heading mb-1">{t('imports.panelHeading')}</h2><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('imports.description')}</p></div>
        <FileSpreadsheet className="h-5 w-5 shrink-0" style={{ color: 'var(--accent)' }} aria-hidden="true" />
      </div>
      <div role="tablist" aria-label={t('imports.panelHeading')} className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}
            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-medium ${tab === item ? 'border-[var(--accent)] bg-[var(--accent-subtle)]' : 'theme-border'}`}>
            {t(`imports.tabs.${item}`)}
          </button>
        ))}
      </div>

      {tab === 'export' && <AcademicExportPanel modules={modules} />}
      {tab === 'onboarding' && <AcademicOnboardingPanel />}
      {tab === 'settings' && <AcademicIdSettingsPanel />}

      {tab === 'import' && <div role="tabpanel">
        <h3 className="mt-5 text-sm font-semibold">{t('imports.heading')}</h3>
        <p className="mt-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>{t('imports.instructions')}</p>
        {error && <p role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        {message && <p role="status" className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}

        {invitableJob && <div className="mt-3 flex flex-col gap-3 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <p className="text-sm">{t('imports.invite.offer', { count: String(invitableJob.personCount ?? 0) })}</p>
          <button type="button" className="btn-primary shrink-0" disabled={busy} onClick={() => void sendJobInvitations(invitableJob)}><MailPlus className="h-4 w-4" />{t('imports.invite.button')}</button>
        </div>}
        {inviteSummary && <p role="status" className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {t('imports.invite.result', { sent: String(inviteSummary.sent), failed: String(inviteSummary.failed), skipped: String(skippedInvitations(inviteSummary)) })}
        </p>}

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <label className="academic-form text-xs font-medium">{t('imports.module')}
            <select value={moduleId} onChange={(event) => { setModuleId(event.target.value); resetPreview(); }}>
              {modules.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="academic-form text-xs font-medium">{t('imports.mode')}
            <select value={mode} onChange={(event) => { setMode(event.target.value as typeof mode); if (preview) setStale(true); }}>
              {MODES.map((item) => <option key={item} value={item}>{t(`imports.modes.${item}`)}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="button" className="btn-secondary flex-1" disabled={busy || !moduleId} onClick={() => void downloadTemplate('csv')}><Download className="h-4 w-4" />{t('imports.downloadCsv')}</button>
            <button type="button" className="btn-secondary flex-1" disabled={busy || !moduleId} onClick={() => void downloadTemplate('xlsx')}><Download className="h-4 w-4" />{t('imports.downloadXlsx')}</button>
          </div>
        </div>
        {selectedModule && <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{selectedModule.description}{selectedModule.requirementNote ? ` ${selectedModule.requirementNote}` : ''}</p>}

        <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="mt-5 flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition hover:border-[var(--accent)]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
          <UploadCloud className="h-7 w-7" style={{ color: 'var(--accent)' }} aria-hidden="true" />
          <span className="text-sm font-semibold">{file?.name ?? t('imports.chooseFile')}</span>
          <span className="text-xs">{t('imports.fileLimits')}</span>
        </button>
        <input ref={inputRef} className="sr-only" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />

        {preview?.sheets && preview.sheets.length > 1 && <label className="academic-form mt-4 max-w-sm text-xs font-medium">{t('imports.worksheet')}
          <select value={worksheet || preview.worksheet || preview.sheets[0]} onChange={(event) => { setWorksheet(event.target.value); resetPreview(); }}>
            {preview.sheets.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
          </select>
        </label>}

        {preview && preview.fields.length > 0 && <div className="mt-5">
          <h3 className="text-sm font-semibold">{t('imports.mappingHeading')}</h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{t('imports.mappingHelp')}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {preview.fields.map((field) => (
              <label key={field.key} className="academic-form text-xs font-medium" title={field.help}>
                <span>{field.label} <span className="font-mono" style={{ color: 'var(--text-muted)' }}>({field.key})</span>{field.required && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-900">{t('imports.required')}</span>}</span>
                <select aria-label={`${field.label} column`} value={mapping[field.key] ?? ''} onChange={(event) => updateMapping(field.key, event.target.value)}>
                  <option value="">{t('imports.notImported')}</option>
                  {preview.headers.filter(Boolean).map((header) => <option key={header} value={header}>{columnLabel(header)}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={busy || !file || !moduleId} onClick={() => void previewFile()}>{busy && !progress ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{preview ? t('imports.revalidate') : t('imports.preview')}</button>
          <button type="button" className="btn-secondary" disabled={busy || !preview || stale || preview.validRows === 0 || Boolean(preview.previousImport && !allowReimport)} onClick={() => void confirmImport()}>{busy && progress ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t('imports.confirm')}</button>
        </div>
        {stale && <p role="status" className="mt-2 text-xs text-amber-800">{t('imports.mappingChanged')}</p>}
        {busy && <div className="mt-3" role="status">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{progress ? t('imports.progress', { processed: String(progress.processedRows), total: String(progress.totalRows) }) : t('imports.processing')}</p>
          {progress && <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: 'var(--bg-base)' }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, background: 'var(--accent)' }} />
          </div>}
        </div>}

        {preview ? <div className="mt-5 space-y-3">
          <p className="text-sm font-semibold">{t('imports.previewSummary', { total: String(preview.totalRows), valid: String(preview.validRows), invalid: String(preview.invalidRows) })}</p>
          {selectedModule?.invitable && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('imports.actionsSummary', { create: String(preview.actions.create), update: String(preview.actions.update), skip: String(preview.actions.skip) })}</p>}
          {preview.generatedIds > 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('imports.generatedSummary', { count: String(preview.generatedIds) })}</p>}
          {preview.warningCount > 0 && <p className="text-xs text-amber-800">{t('imports.warningSummary', { count: String(preview.warningCount) })}</p>}
          {preview.previousImport && <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>{t('imports.previousImport', { date: formatDate(preview.previousImport.createdAt), file: preview.previousImport.originalFilename })}</p>
            <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={allowReimport} onChange={(event) => setAllowReimport(event.target.checked)} />{t('imports.allowReimport')}</label>
          </div>}
          {preview.issues.length > 0 && <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-color)' }}><table className="min-w-full text-left text-xs"><thead><tr style={{ background: 'var(--bg-base)' }}><th className="px-3 py-2">{t('imports.issueTable.row')}</th><th className="px-3 py-2">{t('imports.issueTable.field')}</th><th className="px-3 py-2">{t('imports.issueTable.reason')}</th></tr></thead><tbody>{preview.issues.slice(0, 20).map((item, index) => <tr key={`${item.rowNumber}-${item.code}-${index}`} className={`border-t ${item.severity === 'warning' ? 'text-amber-800' : ''}`} style={{ borderColor: 'var(--border-subtle)' }}><td className="px-3 py-2">{item.rowNumber}</td><td className="px-3 py-2">{item.field ?? '—'}</td><td className="px-3 py-2">{item.message}</td></tr>)}</tbody></table></div>}
          {preview.issues.length > 20 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('imports.moreIssues', { count: String(preview.issues.length) })}</p>}
          {preview.previewRows.length > 0 && <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-color)' }}><table className="min-w-full text-left text-xs"><thead><tr style={{ background: 'var(--bg-base)' }}><th className="px-3 py-2">{t('imports.issueTable.row')}</th><th className="px-3 py-2">{t('imports.action')}</th>{shownFields.map((field) => <th key={field.key} className="whitespace-nowrap px-3 py-2">{field.label}</th>)}</tr></thead><tbody>{preview.previewRows.slice(0, 10).map((row) => <tr key={row.rowNumber} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2"><span className={`rounded-full border px-2 py-0.5 ${ACTION_STYLES[row.action]}`}>{t(`imports.rowAction.${row.action}`)}</span></td>{shownFields.map((field) => <td key={field.key} className="max-w-48 truncate px-3 py-2">{row.values[field.key] || (row.generated.includes(field.key) ? <em style={{ color: 'var(--text-muted)' }}>{t('imports.autoValue')}</em> : '')}</td>)}</tr>)}</tbody></table></div>}
        </div> : <p className="mt-5 text-sm" style={{ color: 'var(--text-muted)' }}>{t('imports.noPreview')}</p>}

        <div className="mt-8 border-t pt-5" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="mb-3 text-sm font-semibold">{t('imports.history')}</h3>
          {history.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('imports.noHistory')}</p> : <div className="space-y-2">{history.map((job) => {
            const invitable = modules.find((item) => item.id === job.module)?.invitable && (job.personCount ?? 0) > 0;
            return <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-3" style={{ background: 'var(--bg-base)' }}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{job.originalFilename}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('imports.historyDetail', { module: modules.find((item) => item.id === job.module)?.label ?? job.module, status: t(`imports.status.${job.status}`), ok: String(job.successfulRows), skipped: String(job.skippedRows), failed: String(job.failedRows) })} · {formatDate(job.createdAt)}</p>
              </div>
              <div className="flex gap-2">
                {invitable && <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void sendJobInvitations(job)}>{t('imports.inviteFromHistory')}</button>}
                {job.issueCount > 0 && <button type="button" className="btn-secondary text-xs" onClick={() => void downloadErrors(job)}>{t('imports.downloadErrors')}</button>}
              </div>
            </div>;
          })}</div>}
        </div>
        <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>{t('imports.googlePending')}</p>
      </div>}
    </section>
  );
}
