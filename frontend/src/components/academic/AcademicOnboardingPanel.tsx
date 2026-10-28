'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MailPlus, RotateCw } from 'lucide-react';
import { api } from '@/lib/api';
import { describeApiError } from '@/lib/apiError';
import { useI18n, useT } from '@/lib/i18n';
import { InvitationSummary, skippedInvitations } from './academicImportTypes';

type PersonType = 'student' | 'teacher' | 'parent';
type OnboardingStatus = 'not_invited' | 'no_email' | 'pending' | 'sent' | 'failed' | 'expired' | 'accepted' | 'revoked' | 'linked';
type OnboardingRow = {
  personId: string;
  externalId?: string;
  name: string;
  email?: string;
  recordStatus: 'active' | 'inactive';
  accountLinked: boolean;
  invitationId?: string;
  status: OnboardingStatus;
  retryable: boolean;
  sendAttempts: number;
  sentAt?: string;
  expiresAt?: string;
  acceptedAt?: string;
  lastError?: string;
};

const STATUSES: OnboardingStatus[] = ['not_invited', 'pending', 'sent', 'failed', 'expired', 'accepted', 'revoked', 'linked', 'no_email'];
const STATUS_STYLES: Partial<Record<OnboardingStatus, string>> = {
  sent: 'bg-sky-50 text-sky-800 border-sky-200',
  accepted: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  linked: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  failed: 'bg-rose-50 text-rose-800 border-rose-200',
  expired: 'bg-amber-50 text-amber-900 border-amber-200',
  pending: 'bg-amber-50 text-amber-900 border-amber-200',
};

export function AcademicOnboardingPanel() {
  const t = useT('academic');
  const { formatDate } = useI18n();
  const [type, setType] = useState<PersonType>('student');
  const [status, setStatus] = useState<OnboardingStatus | ''>('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [summary, setSummary] = useState<Partial<Record<OnboardingStatus, number>>>({});
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/academic/invitations', { params: { type, page, ...(status ? { status } : {}) } });
      setRows(response.data.invitations ?? []);
      setSummary(response.data.summary ?? {});
      setTotal(response.data.total ?? 0);
      setPageSize(response.data.pageSize ?? 50);
    } catch (requestError) {
      setError(describeApiError(requestError, 'Unable to load onboarding status.').message);
    } finally { setLoading(false); }
  }, [page, status, type]);

  useEffect(() => { void load(); }, [load]);

  const send = async (body: Record<string, unknown>, prompt: string) => {
    if (!window.confirm(prompt)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await api.post('/academic/invitations/send', { ...body, confirmed: true });
      const result = response.data.summary as InvitationSummary;
      setMessage(t('imports.invite.result', { sent: String(result.sent), failed: String(result.failed), skipped: String(skippedInvitations(result)) }));
    } catch (requestError) {
      setError(describeApiError(requestError, 'Unable to send invitations.').message);
    } finally {
      setBusy(false);
      await load();
    }
  };

  const revoke = async (row: OnboardingRow) => {
    if (!row.invitationId || !window.confirm(t('imports.onboarding.confirmRevoke', { name: row.name }))) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api.post(`/academic/invitations/${row.invitationId}/revoke`);
      setMessage(t('imports.onboarding.revoked'));
    } catch (requestError) {
      setError(describeApiError(requestError, 'Unable to revoke the invitation.').message);
    } finally {
      setBusy(false);
      await load();
    }
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const uninvited = summary.not_invited ?? 0;
  const retryable = (summary.failed ?? 0) + (summary.expired ?? 0) + (summary.revoked ?? 0) + (summary.pending ?? 0);
  const detail = (row: OnboardingRow) => {
    if (row.status === 'failed') return row.lastError ?? '';
    if (row.status === 'sent' && row.expiresAt) return t('imports.onboarding.expires', { date: formatDate(row.expiresAt) });
    if (row.status === 'accepted' && row.acceptedAt) return formatDate(row.acceptedAt);
    return row.sendAttempts ? t('imports.onboarding.attempts', { count: String(row.sendAttempts) }) : '';
  };

  return (
    <div role="tabpanel" className="mt-5" aria-busy={busy || loading}>
      <h3 className="text-sm font-semibold">{t('imports.onboarding.heading')}</h3>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{t('imports.onboarding.description')}</p>
      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <label className="academic-form text-xs font-medium">{t('imports.onboarding.type')}
          <select value={type} onChange={(event) => { setType(event.target.value as PersonType); setPage(1); }}>
            {(['student', 'teacher', 'parent'] as const).map((item) => <option key={item} value={item}>{t(`imports.onboarding.types.${item}`)}</option>)}
          </select>
        </label>
        <label className="academic-form text-xs font-medium">{t('imports.onboarding.status')}
          <select value={status} onChange={(event) => { setStatus(event.target.value as OnboardingStatus | ''); setPage(1); }}>
            <option value="">{t('imports.onboarding.allStatuses')}</option>
            {STATUSES.map((item) => <option key={item} value={item}>{t(`imports.onboarding.statuses.${item}`)}{summary[item] ? ` (${summary[item]})` : ''}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" className="btn-primary" disabled={busy || !uninvited} onClick={() => void send({ scope: 'uninvited', type }, t('imports.onboarding.confirmUninvited'))}><MailPlus className="h-4 w-4" />{t('imports.onboarding.inviteUninvited')} ({uninvited})</button>
          <button type="button" className="btn-secondary" disabled={busy || !retryable} onClick={() => void send({ scope: 'retryable', type }, t('imports.onboarding.confirmRetry'))}><RotateCw className="h-4 w-4" />{t('imports.onboarding.retry')} ({retryable})</button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {STATUSES.filter((item) => summary[item]).map((item) => <span key={item} className={`rounded-full border px-2 py-1 ${STATUS_STYLES[item] ?? 'theme-border'}`}>{t(`imports.onboarding.statuses.${item}`)}: {summary[item]}</span>)}
      </div>

      {loading ? <p className="mt-4 flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}><Loader2 className="h-4 w-4 animate-spin" />{t('loading')}</p>
        : rows.length === 0 ? <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>{t('imports.onboarding.empty')}</p>
          : <div className="mt-4 overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-color)' }}>
            <table className="min-w-full text-left text-xs">
              <thead><tr style={{ background: 'var(--bg-base)' }}>
                <th className="px-3 py-2">{t('imports.onboarding.columns.person')}</th>
                <th className="px-3 py-2">{t('imports.onboarding.columns.email')}</th>
                <th className="px-3 py-2">{t('imports.onboarding.columns.status')}</th>
                <th className="px-3 py-2">{t('imports.onboarding.columns.detail')}</th>
                <th className="px-3 py-2">{t('imports.onboarding.columns.actions')}</th>
              </tr></thead>
              <tbody>{rows.map((row) => {
                const canSend = !row.accountLinked && row.recordStatus === 'active' && Boolean(row.email) && (row.status === 'not_invited' || row.retryable || row.status === 'sent');
                return <tr key={row.personId} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-3 py-2"><p className="font-medium">{row.name}</p><p style={{ color: 'var(--text-muted)' }}>{row.externalId ?? '—'}</p></td>
                  <td className="max-w-56 truncate px-3 py-2">{row.email ?? '—'}</td>
                  <td className="px-3 py-2"><span className={`rounded-full border px-2 py-0.5 ${STATUS_STYLES[row.status] ?? 'theme-border'}`}>{t(`imports.onboarding.statuses.${row.status}`)}</span></td>
                  <td className="max-w-64 px-3 py-2" style={{ color: 'var(--text-muted)' }}>{detail(row)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex gap-2">
                      {canSend && <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void send({ personIds: [row.personId] }, t('imports.onboarding.confirmOne', { name: row.name }))}>{row.status === 'not_invited' ? t('imports.onboarding.send') : t('imports.onboarding.resend')}</button>}
                      {(row.status === 'sent' || row.status === 'pending' || row.status === 'failed' || row.status === 'expired') && <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void revoke(row)}>{t('imports.onboarding.revoke')}</button>}
                    </div>
                  </td>
                </tr>;
              })}</tbody>
            </table>
          </div>}

      {pages > 1 && <div className="mt-3 flex items-center gap-3 text-xs">
        <button type="button" className="btn-secondary text-xs" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>{t('imports.onboarding.previous')}</button>
        <span>{t('imports.onboarding.page', { page: String(page), pages: String(pages) })}</span>
        <button type="button" className="btn-secondary text-xs" disabled={page >= pages || loading} onClick={() => setPage((current) => current + 1)}>{t('imports.onboarding.next')}</button>
      </div>}
    </div>
  );
}
