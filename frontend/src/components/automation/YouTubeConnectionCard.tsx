'use client';

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Play, Unplug } from 'lucide-react';
import { api } from '@/lib/api';
import { describeApiError } from '@/lib/apiError';
import { useT, type NamespaceKey } from '@/lib/i18n';

export interface YouTubeConnection {
  configured: boolean;
  connected: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  channelTitle: string | null;
  channelId: string | null;
  identityEmail: string | null;
  scopes: string[];
  canPublishVideos: boolean;
  errorCode: string | null;
}

/** Messages for Google's return to WorkGrind after the consent screen, by `oauth_error` code. */
const OAUTH_ERRORS: Record<string, NamespaceKey<'socialPublishing'>> = {
  cancelled: 'youTube.oauthErrors.cancelled',
  publishing_permission_denied: 'youTube.oauthErrors.publishingPermissionDenied',
  youtube_channel_required: 'youTube.oauthErrors.youtubeChannelRequired',
  provider_already_linked: 'youTube.oauthErrors.providerAlreadyLinked',
  provider_unavailable: 'youTube.oauthErrors.providerUnavailable',
};

export function YouTubeConnectionCard({
  onConnectionChange,
  returnTo = '/social-publishing',
  canDisconnect = false,
  canConnect = false,
}: {
  onConnectionChange?: (connection: YouTubeConnection | null) => void;
  returnTo?: string;
  canDisconnect?: boolean;
  canConnect?: boolean;
}) {
  const t = useT('socialPublishing');
  const tc = useT('common');
  const [connection, setConnection] = useState<YouTubeConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const connectStarted = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/social-publishing/youtube/connection');
      const next = response.data.connection as YouTubeConnection;
      setConnection(next);
      onConnectionChange?.(next);
    } catch (requestError: unknown) {
      setConnection(null);
      onConnectionChange?.(null);
      setError(describeApiError(requestError, t('youTube.errors.loadFailed')).message);
    } finally {
      setLoading(false);
    }
  }, [onConnectionChange, t]);

  // Effect Events, so a language change after mount does not re-run the initial load and consent handling.
  const loadInitialConnection = useEffectEvent(() => { void refresh(); });
  const reportConsentResult = useEffectEvent((issue: string | null, connected: boolean) => {
    if (issue) setError(t(OAUTH_ERRORS[issue] ?? 'youTube.errors.connectFailed'));
    else if (connected) setNotice(t('youTube.notices.connected'));
  });

  useEffect(() => {
    // Initial fetch is intentionally triggered from an effect; refresh only schedules the async request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInitialConnection();
    const url = new URL(window.location.href);
    if (url.searchParams.get('oauth_provider') !== 'youtube') return;
    const issue = url.searchParams.get('oauth_error');
    const connected = url.searchParams.get('oauth') === 'connected';
    url.searchParams.delete('oauth');
    url.searchParams.delete('oauth_error');
    url.searchParams.delete('oauth_provider');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    const timer = window.setTimeout(() => reportConsentResult(issue, connected), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const connect = async () => {
    if (connectStarted.current) return;
    connectStarted.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await api.get('/auth/oauth/google/start', {
        withCredentials: true,
        headers: { Accept: 'application/json' },
        params: { intent: 'publishing', returnTo },
      });
      const authUrl = response.data?.authUrl;
      if (typeof authUrl === 'string' && authUrl.startsWith('https://accounts.google.com/')) {
        window.location.assign(authUrl);
        return;
      }
      setError(t('youTube.errors.invalidDestination'));
    } catch (requestError: unknown) {
      setError(describeApiError(requestError, t('youTube.errors.startFailed')).message);
    }
    connectStarted.current = false;
    setBusy(false);
  };

  const disconnect = async () => {
    if (!window.confirm(t('youTube.confirmDisconnect'))) return;
    setBusy(true);
    setError('');
    try {
      await api.delete('/social-publishing/youtube/connection');
      setNotice(t('youTube.notices.disconnected'));
      await refresh();
    } catch (requestError: unknown) {
      setError(describeApiError(requestError, t('youTube.errors.disconnectFailed')).message);
    } finally {
      setBusy(false);
    }
  };

  const connected = Boolean(connection?.connected && connection.canPublishVideos);

  return (
    <section className="surface rounded-2xl border p-4 sm:p-5" aria-labelledby="youtube-connection-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="youtube-connection-heading" className="flex items-center gap-2 text-sm font-semibold theme-text-primary">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-red-600 text-white" aria-hidden="true">
              <Play className="h-3.5 w-3.5 fill-current" />
            </span>
            {t('youTube.heading')}
          </h3>
          <p className="mt-1 text-xs theme-text-muted">
            {t('youTube.description')}
          </p>
        </div>
        {loading && <LoaderCircle className="h-4 w-4 animate-spin theme-text-muted" aria-label={t('youTube.loadingStatus')} />}
      </div>

      {connection && !connection.configured && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" role="status">
          {t('youTube.setupRequired')}
        </p>
      )}

      {connection?.configured && connection.status !== 'disconnected' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm theme-text-primary">
              {connected
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                : <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />}
              <span>{connected ? t('youTube.uploadPermissionConnected') : t('youTube.uploadPermissionUnavailable')}</span>
            </div>
            {connection.channelTitle && (
              <p className="mt-1 truncate text-xs theme-text-secondary">
                {connection.channelTitle}{connection.identityEmail ? ` · ${connection.identityEmail}` : ''}
              </p>
            )}
            {connection.status === 'error' && (
              <p className="mt-1 text-[11px] text-amber-700">{t('youTube.revoked')}</p>
            )}
          </div>
          {canDisconnect && (
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy}
              className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-rose-700 disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
              {tc('actions.disconnect')}
            </button>
          )}
        </div>
      )}

      {notice && <p role="status" className="mt-3 text-xs text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}

      {connection?.configured && canConnect && !connected && (
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy}
          className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-600 bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          aria-busy={busy}
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
          {busy ? t('youTube.connecting') : connection.status === 'error' ? t('youTube.reconnect') : t('youTube.connect')}
        </button>
      )}
      {connection?.configured && !canConnect && !connected && (
        <p className="mt-3 text-xs theme-text-muted">{t('youTube.connectRestricted')}</p>
      )}
    </section>
  );
}
