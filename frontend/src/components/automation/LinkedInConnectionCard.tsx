'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Unplug } from 'lucide-react';
import { api } from '@/lib/api';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';

export interface LinkedInConnection {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  identityName: string | null;
  identityEmail: string | null;
  scopes: string[];
  canPublishMemberPosts: boolean;
  expiresAt: string | null;
  errorCode: string | null;
}

export function LinkedInConnectionCard({
  onConnectionChange,
  returnTo = '/settings?tab=security',
}: {
  onConnectionChange?: (connection: LinkedInConnection | null) => void;
  returnTo?: string;
}) {
  const [connection, setConnection] = useState<LinkedInConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/social-publishing/connection');
      const next = response.data.connection as LinkedInConnection;
      setConnection(next);
      onConnectionChange?.(next);
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setConnection(null);
      onConnectionChange?.(null);
      setError(message || 'LinkedIn connection status could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const url = new URL(window.location.href);
    if (url.searchParams.get('oauth') === 'connected') {
      setNotice('LinkedIn publishing permission connected.');
      url.searchParams.delete('oauth');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    const issue = url.searchParams.get('oauth_error');
    if (issue) {
      setError(issue === 'publishing_permission_denied'
        ? 'LinkedIn did not grant member-post permission. Check app access and approve the requested permission.'
        : issue === 'cancelled'
          ? 'LinkedIn authorization was cancelled.'
          : 'LinkedIn could not be connected. Confirm account ownership and try again.');
      url.searchParams.delete('oauth_error');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  const disconnect = async () => {
    if (!window.confirm('Disconnect LinkedIn publishing for this workspace? Existing posts will remain published.')) return;
    setDisconnecting(true);
    setError('');
    try {
      await api.delete('/social-publishing/connection');
      setNotice('LinkedIn publishing was disconnected.');
      await refresh();
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'LinkedIn could not be disconnected.');
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = connection?.connected && connection.canPublishMemberPosts;

  return (
    <section className="surface rounded-2xl border p-4 sm:p-5" aria-labelledby="linkedin-connection-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="linkedin-connection-heading" className="flex items-center gap-2 text-sm font-semibold theme-text-primary">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A66C2] text-xs font-bold text-white" aria-hidden="true">in</span>
            LinkedIn publishing
          </h3>
          <p className="mt-1 text-xs theme-text-muted">
            Publish text posts to the connected member profile. Organization-page publishing and media are not enabled.
          </p>
        </div>
        {loading && <LoaderCircle className="h-4 w-4 animate-spin theme-text-muted" aria-label="Loading LinkedIn status" />}
      </div>

      {connection && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm theme-text-primary">
              {connected
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                : <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />}
              <span>{connected ? 'Publishing permission connected' : 'Publishing permission unavailable'}</span>
            </div>
            {connection.identityName && <p className="mt-1 truncate text-xs theme-text-secondary">{connection.identityName}{connection.identityEmail ? ` · ${connection.identityEmail}` : ''}</p>}
            {connection.expiresAt && (
              <p className="mt-1 text-[11px] theme-text-muted">
                Authorization expires {new Date(connection.expiresAt).toLocaleDateString()}
              </p>
            )}
            {!connected && connection.status === 'error' && (
              <p className="mt-1 text-[11px] text-amber-700">Authorization or publishing access was rejected. Reconnect to restore access.</p>
            )}
          </div>
          {connected && (
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={disconnecting}
              className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-rose-700 disabled:opacity-50"
            >
              {disconnecting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
              Disconnect
            </button>
          )}
        </div>
      )}

      {notice && <p role="status" className="mt-3 text-xs text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}
      <div className="mt-3">
        <SocialAuthButtons intent="publishing" returnTo={returnTo} />
      </div>
      <p className="mt-2 text-[11px] theme-text-muted">
        Only LinkedIn&rsquo;s granted <code>w_member_social</code> scope is used for member posts. This does not enable organization events.
      </p>
    </section>
  );
}
