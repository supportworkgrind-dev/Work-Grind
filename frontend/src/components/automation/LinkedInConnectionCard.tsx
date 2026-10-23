'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, RotateCw, Unplug } from 'lucide-react';
import { api } from '@/lib/api';
import { describeApiError, type ApiErrorInfo } from '@/lib/apiError';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';

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

/** Messages for LinkedIn's return to WorkGrind after the consent screen. */
const OAUTH_ERRORS: Record<string, string> = {
  cancelled: 'LinkedIn authorization was cancelled. Nothing was changed.',
  publishing_permission_denied: 'LinkedIn did not grant permission to post on your behalf (w_member_social). Reconnect and allow posting when LinkedIn asks.',
  publishing_scope_not_approved: 'LinkedIn has not approved WorkGrind\'s LinkedIn app for member posting (w_member_social). This needs the "Share on LinkedIn" product on WorkGrind\'s LinkedIn app — contact WorkGrind support.',
  provider_credentials_rejected: 'LinkedIn rejected WorkGrind\'s app credentials, so no connection was made. This is a WorkGrind configuration issue, not your LinkedIn account — contact WorkGrind support.',
  provider_unavailable: 'LinkedIn is unavailable on this server right now. Try again later.',
  provider_already_linked: 'A different LinkedIn profile is already connected for this workspace. Disconnect it before connecting another.',
  account_unavailable: 'Your WorkGrind role cannot manage the LinkedIn connection for this workspace.',
};

function stateOf(connection: LinkedInConnection): LinkedInConnectionState {
  // Older backends return no state; derive it from the same fields.
  if (connection.state) return connection.state;
  if (connection.canPublishMemberPosts) return 'connected';
  if (connection.status === 'error') return 'reauthorization_required';
  return connection.status === 'connected' ? 'permission_missing' : 'not_connected';
}

function stateCopy(connection: LinkedInConnection): { title: string; detail?: string; tone: 'ok' | 'warn' | 'muted' } {
  const scope = connection.requiredScope ?? 'w_member_social';
  const expired = connection.expiresAt && new Date(connection.expiresAt).getTime() <= Date.now();
  switch (stateOf(connection)) {
    case 'connected':
      return { title: 'Connected — ready to publish', tone: 'ok' };
    case 'reauthorization_required':
      return {
        title: 'Reauthorization required',
        detail: expired
          ? `This LinkedIn authorization expired on ${new Date(connection.expiresAt!).toLocaleDateString()} (LinkedIn authorizations last about 60 days). Reconnect to keep publishing.`
          : 'LinkedIn revoked or rejected this authorization. Reconnect to restore publishing.',
        tone: 'warn',
      };
    case 'permission_missing':
      return {
        title: 'Posting permission missing',
        detail: `LinkedIn did not allow posting (${scope}) for this connection. Reconnect and approve posting. If LinkedIn does not offer it, WorkGrind's LinkedIn app is missing the "Share on LinkedIn" product — contact WorkGrind support.`,
        tone: 'warn',
      };
    case 'configuration_required':
      return {
        title: 'Setup required',
        detail: 'LinkedIn is not configured on this WorkGrind server, so it cannot be connected yet. Contact WorkGrind support.',
        tone: 'warn',
      };
    default:
      return {
        title: 'Not connected',
        detail: `Connect the LinkedIn profile WorkGrind should post to. LinkedIn will ask you to allow posting on your behalf (${scope}).`,
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
        setNotice('LinkedIn connected. WorkGrind confirmed permission to post to this profile.');
      } else {
        setError(`LinkedIn returned to WorkGrind, but publishing is still unavailable: ${stateCopy(next).title.toLowerCase()}.`);
      }
    }
  }, [onConnectionChange]);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/social-publishing/connection');
      applyConnection(response.data.connection as LinkedInConnection);
    } catch (requestError) {
      setConnection(null);
      onConnectionChange?.(null);
      setLoadError(describeApiError(requestError, 'LinkedIn connection status could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [applyConnection, onConnectionChange]);

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
    const timer = window.setTimeout(() => {
      if (issue) setError(OAUTH_ERRORS[issue] ?? 'LinkedIn could not be connected. Try again.');
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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
      setNotice('LinkedIn publishing was disconnected.');
      await load();
    } catch (requestError) {
      setError(describeApiError(requestError, 'LinkedIn could not be disconnected.').message);
    } finally {
      setDisconnecting(false);
    }
  };

  const state = connection ? stateOf(connection) : null;
  const copy = connection ? stateCopy(connection) : null;
  const canStartConsent = state !== null && state !== 'configuration_required';
  const connectLabel = state === 'not_connected' ? 'Connect LinkedIn' : 'Reconnect LinkedIn';

  return (
    <section className="surface rounded-2xl border p-4 sm:p-5" aria-labelledby="linkedin-connection-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="linkedin-connection-heading" className="flex items-center gap-2 text-sm font-semibold theme-text-primary">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A66C2] text-xs font-bold text-white" aria-hidden="true">in</span>
            LinkedIn publishing
          </h3>
          <p className="mt-1 text-xs theme-text-muted">
            Publish text, image (JPEG/PNG), and MP4 video posts to the LinkedIn profile you connect. Company-page publishing is not available.
          </p>
        </div>
        {loading && <LoaderCircle className="h-4 w-4 animate-spin theme-text-muted" aria-label="Loading LinkedIn status" />}
      </div>

      {connection && copy && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm theme-text-primary" role="status" aria-label={`LinkedIn: ${copy.title}`}>
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
                Authorization expires {new Date(connection.expiresAt).toLocaleDateString()}
              </p>
            )}
            {copy.detail && <p className={`mt-1 text-[11px] ${copy.tone === 'warn' ? 'text-amber-700' : 'theme-text-muted'}`}>{copy.detail}</p>}
          </div>
          {canDisconnect && connection.status !== 'disconnected' && state !== 'not_connected' && (
            confirmingDisconnect ? (
              <div className="flex items-center gap-2" role="group" aria-label="Confirm disconnect">
                <span className="text-xs theme-text-secondary">Disconnect? Published posts stay on LinkedIn.</span>
                <button type="button" onClick={() => setConfirmingDisconnect(false)} className="btn-ghost h-8 rounded-lg px-2 text-xs">Cancel</button>
                <button type="button" onClick={() => void disconnect()} className="btn-ghost h-8 rounded-lg px-2 text-xs font-semibold text-rose-700">Disconnect</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDisconnect(true)}
                disabled={disconnecting}
                className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-rose-700 disabled:opacity-50"
              >
                {disconnecting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                Disconnect
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
              <RotateCw className="h-3 w-3" />Retry
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
