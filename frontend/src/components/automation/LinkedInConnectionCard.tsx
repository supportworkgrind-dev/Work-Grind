'use client';

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, RotateCw, Unplug } from 'lucide-react';
import { api } from '@/lib/api';
import { describeApiError, type ApiErrorInfo } from '@/lib/apiError';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import { useI18n, useT, type NamespaceKey, type Translator } from '@/lib/i18n';

export type LinkedInConnectionState =
  | 'not_connected'
  | 'connected'
  | 'reauthorization_required'
  | 'permission_missing'
  | 'configuration_required';

export interface LinkedInConnection {
  state?: LinkedInConnectionState;
  providerConfigured?: boolean;
  requiredScope?: string;
  formats?: { text: boolean; image: string[]; video: string[] };
  connected: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  identityName: string | null;
  identityEmail: string | null;
  scopes: string[];
  canPublishMemberPosts: boolean;
  expiresAt: string | null;
  errorCode: string | null;
}

/** Messages for LinkedIn's return to WorkGrind after the consent screen, by `oauth_error` code. */
const OAUTH_ERRORS: Record<string, NamespaceKey<'socialPublishing'>> = {
  cancelled: 'linkedIn.oauthErrors.cancelled',
  publishing_permission_denied: 'linkedIn.oauthErrors.publishingPermissionDenied',
  publishing_scope_not_approved: 'linkedIn.oauthErrors.publishingScopeNotApproved',
  provider_credentials_rejected: 'linkedIn.oauthErrors.providerCredentialsRejected',
  provider_unavailable: 'linkedIn.oauthErrors.providerUnavailable',
  provider_already_linked: 'linkedIn.oauthErrors.providerAlreadyLinked',
  account_unavailable: 'linkedIn.oauthErrors.accountUnavailable',
};

/** In English this matches toLocaleDateString() (e.g. 10/24/2026). */
const NUMERIC_DATE: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };

type DateFormatter = (value: string, options: Intl.DateTimeFormatOptions) => string;

function stateOf(connection: LinkedInConnection): LinkedInConnectionState {
  // Older backends return no state; derive it from the same fields.
  if (connection.state) return connection.state;
  if (connection.canPublishMemberPosts) return 'connected';
  if (connection.status === 'error') return 'reauthorization_required';
  return connection.status === 'connected' ? 'permission_missing' : 'not_connected';
}

function stateCopy(
  connection: LinkedInConnection,
  t: Translator<'socialPublishing'>,
  formatDate: DateFormatter,
): { title: string; detail?: string; tone: 'ok' | 'warn' | 'muted' } {
  const scope = connection.requiredScope ?? 'w_member_social';
  const expired = connection.expiresAt && new Date(connection.expiresAt).getTime() <= Date.now();
  switch (stateOf(connection)) {
    case 'connected':
      return { title: t('linkedIn.states.connected'), tone: 'ok' };
    case 'reauthorization_required':
      return {
        title: t('linkedIn.states.reauthorizationRequired'),
        detail: expired
          ? t('linkedIn.details.expired', { date: formatDate(connection.expiresAt!, NUMERIC_DATE) })
          : t('linkedIn.details.revoked'),
        tone: 'warn',
      };
    case 'permission_missing':
      return {
        title: t('linkedIn.states.permissionMissing'),
        detail: t('linkedIn.details.permissionMissing', { scope }),
        tone: 'warn',
      };
    case 'configuration_required':
      return {
        title: t('linkedIn.states.configurationRequired'),
        detail: t('linkedIn.details.configurationRequired'),
        tone: 'warn',
      };
    default:
      return {
        title: t('linkedIn.states.notConnected'),
        detail: t('linkedIn.details.notConnected', { scope }),
        tone: 'muted',
      };
  }
}

export function LinkedInConnectionCard({
  onConnectionChange,
  returnTo = '/settings?tab=security',
  canDisconnect = false,
}: {
  onConnectionChange?: (connection: LinkedInConnection | null) => void;
  returnTo?: string;
  canDisconnect?: boolean;
}) {
  const t = useT('socialPublishing');
  const tc = useT('common');
  const { formatDate } = useI18n();
  const [connection, setConnection] = useState<LinkedInConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [loadError, setLoadError] = useState<ApiErrorInfo | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Set when LinkedIn redirected back with oauth=connected; reported only once
  // the backend confirms the grant.
  const awaitingConfirmation = useRef(false);

  const applyConnection = useCallback((next: LinkedInConnection) => {
    setConnection(next);
    onConnectionChange?.(next);
    setLoadError(null);
    if (awaitingConfirmation.current) {
      awaitingConfirmation.current = false;
      if (stateOf(next) === 'connected') {
        setNotice(t('linkedIn.notices.connected'));
      } else {
        setError(t('linkedIn.errors.stillUnavailable', { state: stateCopy(next, t, formatDate).title.toLowerCase() }));
      }
    }
  }, [onConnectionChange, t, formatDate]);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/social-publishing/connection');
      applyConnection(response.data.connection as LinkedInConnection);
    } catch (requestError) {
      setConnection(null);
      onConnectionChange?.(null);
      setLoadError(describeApiError(requestError, t('linkedIn.errors.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [applyConnection, onConnectionChange, t]);

  // An Effect Event, so a language change after mount does not re-run the consent handling below.
  const reportConsentResult = useEffectEvent((issue: string | null) => {
    if (issue) setError(t(OAUTH_ERRORS[issue] ?? 'linkedIn.errors.connectFailed'));
    void load();
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    // YouTube consent results are handled by the YouTube connection card.
    const ownsResult = url.searchParams.get('oauth_provider') !== 'youtube';
    const result = ownsResult ? url.searchParams.get('oauth') : null;
    const issue = ownsResult ? url.searchParams.get('oauth_error') : null;
    if (result === 'connected') awaitingConfirmation.current = true;
    if (result || issue) {
      url.searchParams.delete('oauth');
      url.searchParams.delete('oauth_error');
      url.searchParams.delete('attemptId');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    const timer = window.setTimeout(() => reportConsentResult(issue), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    void load();
  };

  const disconnect = async () => {
    setConfirmingDisconnect(false);
    setDisconnecting(true);
    setError('');
    setNotice('');
    try {
      await api.delete('/social-publishing/connection');
      setNotice(t('linkedIn.notices.disconnected'));
      await load();
    } catch (requestError) {
      setError(describeApiError(requestError, t('linkedIn.errors.disconnectFailed')).message);
    } finally {
      setDisconnecting(false);
    }
  };

  const state = connection ? stateOf(connection) : null;
  const copy = connection ? stateCopy(connection, t, formatDate) : null;
  const canStartConsent = state !== null && state !== 'configuration_required';
  const connectLabel = state === 'not_connected' ? t('linkedIn.connect') : t('linkedIn.reconnect');

  return (
    <section className="surface rounded-2xl border p-4 sm:p-5" aria-labelledby="linkedin-connection-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="linkedin-connection-heading" className="flex items-center gap-2 text-sm font-semibold theme-text-primary">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A66C2] text-xs font-bold text-white" aria-hidden="true">in</span>
            {t('linkedIn.heading')}
          </h3>
          <p className="mt-1 text-xs theme-text-muted">
            {t('linkedIn.description')}
          </p>
        </div>
        {loading && <LoaderCircle className="h-4 w-4 animate-spin theme-text-muted" aria-label={t('linkedIn.loadingStatus')} />}
      </div>

      {connection && copy && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm theme-text-primary" role="status" aria-label={t('linkedIn.statusLabel', { state: copy.title })}>
              {copy.tone === 'ok'
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                : <AlertCircle className={`h-4 w-4 shrink-0 ${copy.tone === 'warn' ? 'text-amber-600' : 'theme-text-muted'}`} aria-hidden="true" />}
              <span>{copy.title}</span>
            </div>
            {connection.identityName && state !== 'not_connected' && (
              <p className="mt-1 truncate text-xs theme-text-secondary">{connection.identityName}{connection.identityEmail ? ` · ${connection.identityEmail}` : ''}</p>
            )}
            {state === 'connected' && connection.expiresAt && (
              <p className="mt-1 text-[11px] theme-text-muted">
                {t('linkedIn.expires', { date: formatDate(connection.expiresAt, NUMERIC_DATE) })}
              </p>
            )}
            {copy.detail && <p className={`mt-1 text-[11px] ${copy.tone === 'warn' ? 'text-amber-700' : 'theme-text-muted'}`}>{copy.detail}</p>}
          </div>
          {canDisconnect && connection.status !== 'disconnected' && state !== 'not_connected' && (
            confirmingDisconnect ? (
              <div className="flex items-center gap-2" role="group" aria-label={t('linkedIn.confirmDisconnectLabel')}>
                <span className="text-xs theme-text-secondary">{t('linkedIn.confirmDisconnect')}</span>
                <button type="button" onClick={() => setConfirmingDisconnect(false)} className="btn-ghost h-8 rounded-lg px-2 text-xs">{tc('actions.cancel')}</button>
                <button type="button" onClick={() => void disconnect()} className="btn-ghost h-8 rounded-lg px-2 text-xs font-semibold text-rose-700">{tc('actions.disconnect')}</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDisconnect(true)}
                disabled={disconnecting}
                className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-rose-700 disabled:opacity-50"
              >
                {disconnecting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                {tc('actions.disconnect')}
              </button>
            )
          )}
        </div>
      )}

      {loadError && (
        <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-700">
          <span>{loadError.message}</span>
          {loadError.retryable && (
            <button type="button" onClick={retry} className="inline-flex items-center gap-1 font-semibold underline">
              <RotateCw className="h-3 w-3" />{tc('actions.retry')}
            </button>
          )}
        </div>
      )}
      {notice && <p role="status" className="mt-3 text-xs text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}
      {canStartConsent && (
        <div className="mt-3">
          <SocialAuthButtons intent="publishing" returnTo={returnTo} publishingLabel={connectLabel} />
        </div>
      )}
    </section>
  );
}
