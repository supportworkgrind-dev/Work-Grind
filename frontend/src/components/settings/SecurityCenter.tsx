'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, CheckCircle2, Copy, Download, KeyRound, LogOut, MailCheck, ShieldCheck, Smartphone } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';

type Provider = 'google' | 'linkedin';

type SecurityOverview = {
  email: string;
  emailVerified: boolean;
  signInMethods: { password: boolean; google: boolean; linkedin: boolean; apple: boolean };
  providersAvailable: Record<Provider, boolean>;
  mfa: { enabled: boolean; enabledAt: string | null; recoveryCodesRemaining: number };
  activeSessions: number;
  lastLogin: string | null;
};

type SecurityEvent = { _id: string; action: string; createdAt: string; method?: string; provider?: string; revoked?: number };

type Notice = { tone: 'success' | 'error'; text: string } | null;

type Dialog =
  | { kind: 'mfa-setup-password' }
  | { kind: 'mfa-setup-verify'; qrCodeUrl: string; manualKey: string }
  | { kind: 'mfa-disable' }
  | { kind: 'mfa-regenerate' }
  | { kind: 'unlink'; provider: Provider }
  | { kind: 'revoke-sessions' }
  | null;

const PROVIDER_LABEL: Record<Provider, string> = { google: 'Google', linkedin: 'LinkedIn' };

const EVENT_LABEL: Record<string, string> = {
  LOGIN_SUCCEEDED: 'Signed in',
  LOGIN_MFA_FAILED: 'Incorrect two-factor code entered',
  PASSWORD_CHANGED: 'Password changed',
  MFA_ENABLED: 'Two-factor authentication turned on',
  MFA_DISABLED: 'Two-factor authentication turned off',
  MFA_RECOVERY_CODES_REGENERATED: 'Recovery codes regenerated',
  SESSIONS_REVOKED: 'Signed out of other sessions',
  SIGN_IN_PROVIDER_UNLINKED: 'Sign-in provider disconnected',
  DATA_EXPORTED: 'Account data exported',
};

function describeEvent(event: SecurityEvent): string {
  const base = EVENT_LABEL[event.action] ?? event.action;
  if (event.action === 'LOGIN_SUCCEEDED' && event.method) {
    return `${base} ${event.method === 'mfa' ? 'with a two-factor code' : event.method === 'oauth' ? 'with Google or LinkedIn' : 'with email and password'}`;
  }
  if (event.provider) return `${base} (${PROVIDER_LABEL[event.provider as Provider] ?? event.provider})`;
  if (typeof event.revoked === 'number') return `${base} (${event.revoked} ended)`;
  return base;
}

function errorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' && message ? message : fallback;
}

const inputClass = 'mt-1.5 block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600';
const cardClass = 'rounded-xl border border-slate-200 bg-white p-4';

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return notice.tone === 'error' ? (
    <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
      <AlertCircle className="h-4 w-4 shrink-0" /><span>{notice.text}</span>
    </div>
  ) : (
    <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
      <Check className="h-4 w-4 shrink-0" /><span>{notice.text}</span>
    </div>
  );
}

/**
 * Sign-in methods, two-factor authentication, sessions, and recent security
 * activity. Every status shown here comes from GET /auth/security; nothing is
 * marked enabled until the server confirms it.
 */
export function SecurityCenter() {
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);
  const authProviders = useAuthStore((state) => state.user?.authProviders);
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [codesCopied, setCodesCopied] = useState(false);

  // State is only set after each request settles (loads are triggered one at a
  // time: on mount, after a confirmed change, or from Retry).
  const loadOverview = useCallback(async () => {
    try {
      const res = await api.get('/auth/security');
      if (!res.data.success) throw new Error();
      setOverview(res.data.security);
      setOverviewError('');
    } catch (error) {
      setOverviewError(errorMessage(error, 'Security settings could not be loaded.'));
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.get('/auth/security/events');
      if (!res.data.success) throw new Error();
      setEvents(res.data.events ?? []);
      setEventsError('');
    } catch (error) {
      setEventsError(errorMessage(error, 'Security activity could not be loaded.'));
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const retryEvents = () => {
    setEventsLoading(true);
    setEventsError('');
    void loadEvents();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOverview();
      void loadEvents();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOverview, loadEvents]);

  const openDialog = (next: Dialog) => {
    setDialog(next);
    setPassword('');
    setCode('');
    setDialogError('');
    setNotice(null);
  };

  const closeDialog = () => openDialog(null);

  const afterChange = async (text: string) => {
    setDialog(null);
    setPassword('');
    setCode('');
    setNotice({ tone: 'success', text });
    await Promise.all([loadOverview(), loadEvents()]);
  };

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setDialogError('');
    try {
      await action();
    } catch (error) {
      setDialogError(errorMessage(error, fallback));
    } finally {
      setBusy(false);
    }
  };

  const hasPassword = Boolean(overview?.signInMethods.password);

  const startMfaSetup = () => run(async () => {
    const res = await api.post('/auth/mfa/setup', hasPassword ? { currentPassword: password } : {});
    if (!res.data.success) throw new Error(res.data.message);
    setPassword('');
    setDialog({ kind: 'mfa-setup-verify', qrCodeUrl: res.data.qrCodeUrl, manualKey: res.data.manualKey });
  }, 'Two-factor setup could not be started.');

  const enableMfa = () => run(async () => {
    const res = await api.post('/auth/mfa/enable', { code });
    if (!res.data.success || !Array.isArray(res.data.recoveryCodes)) throw new Error(res.data.message);
    setRecoveryCodes(res.data.recoveryCodes);
    await afterChange('Two-factor authentication is on. Save your recovery codes now.');
  }, 'Two-factor authentication could not be turned on.');

  const disableMfa = () => run(async () => {
    const res = await api.post('/auth/mfa/disable', { ...(hasPassword ? { currentPassword: password } : {}), code });
    if (!res.data.success) throw new Error(res.data.message);
    setRecoveryCodes(null);
    await afterChange('Two-factor authentication is off.');
  }, 'Two-factor authentication could not be turned off.');

  const regenerateCodes = () => run(async () => {
    const res = await api.post('/auth/mfa/recovery-codes', { ...(hasPassword ? { currentPassword: password } : {}), code });
    if (!res.data.success || !Array.isArray(res.data.recoveryCodes)) throw new Error(res.data.message);
    setRecoveryCodes(res.data.recoveryCodes);
    await afterChange('New recovery codes were generated. The old codes no longer work.');
  }, 'New recovery codes could not be generated.');

  const unlink = (provider: Provider) => run(async () => {
    const res = await api.delete(`/auth/oauth/${provider}/link`, {
      data: { ...(hasPassword ? { currentPassword: password } : {}), ...(overview?.mfa.enabled ? { code } : {}) },
    });
    if (!res.data.success) throw new Error(res.data.message);
    await fetchCurrentUser();
    await afterChange(`${PROVIDER_LABEL[provider]} is no longer connected for sign-in.`);
  }, 'The provider could not be disconnected.');

  const revokeSessions = () => run(async () => {
    const res = await api.post('/auth/sessions/revoke-others');
    if (!res.data.success) throw new Error(res.data.message);
    await afterChange(res.data.revoked
      ? `Signed out of ${res.data.revoked} other session${res.data.revoked === 1 ? '' : 's'}.`
      : 'There were no other sessions to sign out.');
  }, 'Other sessions could not be signed out.');

  const copyCodes = async () => {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCodesCopied(true);
      window.setTimeout(() => setCodesCopied(false), 2000);
    } catch {
      setNotice({ tone: 'error', text: 'Clipboard access was denied. Write the codes down instead.' });
    }
  };

  const downloadCodes = () => {
    if (!recoveryCodes) return;
    const blob = new Blob([`WorkGrind recovery codes\nEach code works once.\n\n${recoveryCodes.join('\n')}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'workgrind-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const remainingMethods = overview
    ? Object.values(overview.signInMethods).filter(Boolean).length
    : 0;

  const passwordField = hasPassword && (
    <div>
      <label htmlFor="security-confirm-password" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">Current password</label>
      <input id="security-confirm-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
    </div>
  );

  const codeField = (label: string, allowRecovery: boolean) => (
    <div>
      <label htmlFor="security-confirm-code" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">{label}</label>
      <input
        id="security-confirm-code"
        inputMode={allowRecovery ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        maxLength={allowRecovery ? 16 : 6}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={allowRecovery ? '123456 or XXXX-XXXX' : '123456'}
        className={inputClass}
      />
    </div>
  );

  const dialogActions = (confirmLabel: string, onConfirm: () => void, disabled = false) => (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={closeDialog} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
      <button type="button" onClick={onConfirm} disabled={busy || disabled} className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        {busy ? 'Working…' : confirmLabel}
      </button>
    </div>
  );

  const dialogPanel = (title: string, body: React.ReactNode) => (
    <div role="dialog" aria-labelledby="security-dialog-title" className="mt-3 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <p id="security-dialog-title" className="text-xs font-bold text-slate-900">{title}</p>
      {dialogError && <p role="alert" className="text-xs font-medium text-rose-600">{dialogError}</p>}
      {body}
    </div>
  );

  if (overviewError && !overview) {
    return (
      <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
        <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{overviewError}</span>
        <button type="button" onClick={() => void loadOverview()} className="font-semibold underline">Retry</button>
      </div>
    );
  }
  if (!overview) return <p className="text-xs text-slate-400">Loading security settings…</p>;

  return (
    <div className="space-y-4">
      <NoticeBanner notice={notice} />

      {recoveryCodes && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" aria-labelledby="recovery-codes-heading">
          <h4 id="recovery-codes-heading" className="text-xs font-bold text-slate-900">Your recovery codes</h4>
          <p className="mt-1 text-[11px] text-slate-600">Each code signs you in once if you lose your authenticator. They are shown only now — store them somewhere safe.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-slate-800 sm:grid-cols-4">
            {recoveryCodes.map((recoveryCode) => <li key={recoveryCode} className="rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-center">{recoveryCode}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void copyCodes()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              {codesCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{codesCopied ? 'Copied' : 'Copy codes'}
            </button>
            <button type="button" onClick={downloadCodes} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Download className="h-3.5 w-3.5" />Download
            </button>
            <button type="button" onClick={() => setRecoveryCodes(null)} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white">I have saved them</button>
          </div>
        </section>
      )}

      <section className={cardClass} aria-labelledby="security-email-heading">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <MailCheck className="mt-0.5 h-4 w-4 text-indigo-600" />
            <div>
              <h4 id="security-email-heading" className="text-xs font-bold text-slate-900">Email address</h4>
              <p className="mt-0.5 text-xs text-slate-600">{overview.email}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Forgot your password? <Link href="/forgot-password" className="font-semibold text-indigo-600 underline">Reset it by email</Link>.
              </p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${overview.emailVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {overview.emailVerified ? 'Verified' : 'Not verified'}
          </span>
        </div>
      </section>

      <section className={cardClass} aria-labelledby="security-methods-heading">
        <div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-indigo-600" /><h4 id="security-methods-heading" className="text-xs font-bold text-slate-900">Sign-in methods</h4></div>
        <ul className="mt-3 divide-y divide-slate-100 text-xs">
          <li className="flex items-center justify-between gap-3 py-2.5">
            <span className="font-semibold text-slate-800">Email and password</span>
            <span className="text-slate-500">
              {overview.signInMethods.password ? 'Set' : <>Not set · <Link href="/forgot-password" className="font-semibold text-indigo-600 underline">Create a password</Link></>}
            </span>
          </li>
          {(['google', 'linkedin'] as const).map((provider) => {
            const connected = overview.signInMethods[provider];
            const isLast = connected && remainingMethods <= 1;
            return (
              <li key={provider} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="font-semibold text-slate-800">{PROVIDER_LABEL[provider]}</span>
                <span className="flex items-center gap-2 text-slate-500">
                  {connected ? 'Connected' : overview.providersAvailable[provider] ? 'Not connected' : 'Not available on this server'}
                  {connected && (
                    <button
                      type="button"
                      onClick={() => openDialog({ kind: 'unlink', provider })}
                      disabled={isLast}
                      title={isLast ? 'This is your only sign-in method' : undefined}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {remainingMethods <= 1 && (
          <p className="mt-1 text-[11px] text-slate-500">You have one sign-in method, so it can&apos;t be removed.</p>
        )}
        {dialog?.kind === 'unlink' && dialogPanel(`Disconnect ${PROVIDER_LABEL[dialog.provider]}?`, <>
          <p className="text-[11px] text-slate-600">You will no longer be able to sign in with {PROVIDER_LABEL[dialog.provider]}. Your other sign-in methods keep working.</p>
          {passwordField}
          {overview.mfa.enabled && codeField('Authenticator code', false)}
          {dialogActions('Disconnect', () => void unlink(dialog.provider), (hasPassword && !password) || (overview.mfa.enabled && !code))}
        </>)}
        {(overview.providersAvailable.google || overview.providersAvailable.linkedin) && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-[11px] text-slate-500">Connect a provider for WorkGrind sign-in. This does not connect Google Drive, Calendar, or other Google services.</p>
            <SocialAuthButtons intent="link" connectedProviders={authProviders} />
          </div>
        )}
      </section>

      <section className={cardClass} aria-labelledby="security-mfa-heading">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-4 w-4 text-indigo-600" />
            <div>
              <h4 id="security-mfa-heading" className="text-xs font-bold text-slate-900">Two-factor authentication</h4>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {overview.mfa.enabled
                  ? `On${overview.mfa.enabledAt ? ` since ${formatDate(overview.mfa.enabledAt)}` : ''} · ${overview.mfa.recoveryCodesRemaining} recovery code${overview.mfa.recoveryCodesRemaining === 1 ? '' : 's'} left`
                  : 'Require a code from an authenticator app (such as Google Authenticator or 1Password) after your password or Google/LinkedIn sign-in.'}
              </p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${overview.mfa.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {overview.mfa.enabled ? 'On' : 'Off'}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {overview.mfa.enabled ? (
            <>
              <button type="button" onClick={() => openDialog({ kind: 'mfa-regenerate' })} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Regenerate recovery codes</button>
              <button type="button" onClick={() => openDialog({ kind: 'mfa-disable' })} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">Turn off</button>
            </>
          ) : (
            dialog?.kind !== 'mfa-setup-verify' && (
              <button
                type="button"
                onClick={() => (hasPassword ? openDialog({ kind: 'mfa-setup-password' }) : void startMfaSetup())}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" />Set up two-factor authentication
              </button>
            )
          )}
        </div>
        {!dialog && dialogError && <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{dialogError}</p>}
        {dialog?.kind === 'mfa-setup-password' && dialogPanel('Confirm it is you', <>
          {passwordField}
          {dialogActions('Continue', () => void startMfaSetup(), !password)}
        </>)}
        {dialog?.kind === 'mfa-setup-verify' && dialogPanel('Scan this code with your authenticator app', <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data URL */}
            <img src={dialog.qrCodeUrl} alt="QR code for your authenticator app" width={160} height={160} className="h-40 w-40 rounded-lg border border-slate-200 bg-white p-1" />
            <div className="min-w-0 space-y-2 text-[11px] text-slate-600">
              <p>Can&apos;t scan? Enter this key manually:</p>
              <code className="block break-all rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-800">{dialog.manualKey}</code>
              <p>Then enter the 6-digit code the app shows to finish.</p>
            </div>
          </div>
          {codeField('6-digit code', false)}
          {dialogActions('Turn on', () => void enableMfa(), code.trim().length !== 6)}
        </>)}
        {dialog?.kind === 'mfa-disable' && dialogPanel('Turn off two-factor authentication?', <>
          <p className="text-[11px] text-slate-600">Your account will be protected by your password or provider sign-in only.</p>
          {passwordField}
          {codeField('Authenticator or recovery code', true)}
          {dialogActions('Turn off', () => void disableMfa(), (hasPassword && !password) || !code)}
        </>)}
        {dialog?.kind === 'mfa-regenerate' && dialogPanel('Generate new recovery codes?', <>
          <p className="text-[11px] text-slate-600">Your current recovery codes will stop working.</p>
          {passwordField}
          {codeField('Authenticator code', false)}
          {dialogActions('Generate codes', () => void regenerateCodes(), (hasPassword && !password) || code.trim().length !== 6)}
        </>)}
      </section>

      <section className={cardClass} aria-labelledby="security-sessions-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <LogOut className="mt-0.5 h-4 w-4 text-indigo-600" />
            <div>
              <h4 id="security-sessions-heading" className="text-xs font-bold text-slate-900">Sessions</h4>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {overview.activeSessions} signed-in session{overview.activeSessions === 1 ? '' : 's'}, including this one.
                {overview.lastLogin ? ` Last sign-in ${formatDate(overview.lastLogin, 'MMM d, yyyy h:mm a')}.` : ''}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">WorkGrind does not record device or location details for sessions.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openDialog({ kind: 'revoke-sessions' })}
            disabled={overview.activeSessions <= 1}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sign out other sessions
          </button>
        </div>
        {dialog?.kind === 'revoke-sessions' && dialogPanel('Sign out every other session?', <>
          <p className="text-[11px] text-slate-600">Other browsers and devices will need to sign in again. This browser stays signed in.</p>
          {dialogActions('Sign out others', () => void revokeSessions())}
        </>)}
      </section>

      <section className={cardClass} aria-labelledby="security-activity-heading">
        <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-600" /><h4 id="security-activity-heading" className="text-xs font-bold text-slate-900">Recent security activity</h4></div>
        {eventsError ? (
          <div role="alert" className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
            <span>{eventsError}</span>
            <button type="button" onClick={retryEvents} className="font-semibold underline">Retry</button>
          </div>
        ) : eventsLoading ? (
          <p className="mt-3 text-xs text-slate-400">Loading activity…</p>
        ) : events.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">No security activity recorded yet. Sign-ins and security changes appear here from now on.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 text-xs">
            {events.map((event) => (
              <li key={event._id} className="flex items-center justify-between gap-3 py-2">
                <span className={event.action === 'LOGIN_MFA_FAILED' ? 'text-rose-700' : 'text-slate-700'}>{describeEvent(event)}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{formatDate(event.createdAt, 'MMM d, yyyy h:mm a')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
