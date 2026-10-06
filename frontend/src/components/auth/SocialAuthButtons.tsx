'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api';

type SocialAuthButtonsProps = {
  intent?: 'login' | 'link';
  className?: string;
};

const providers = [
  { id: 'google', label: 'Google', className: 'bg-white text-stone-800 hover:bg-stone-50' },
] as const;

export function SocialAuthButtons({ intent = 'login', className = '' }: SocialAuthButtonsProps) {
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const requestStarted = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (intent !== 'link') return;
    const url = new URL(window.location.href);
    const result = url.searchParams.get('oauth');
    const issue = url.searchParams.get('oauth_error');
    if (result || issue) {
      const timer = window.setTimeout(() => {
        if (result === 'linked') setNotice('Sign-in provider linked successfully.');
        if (issue) setError(issue === 'cancelled'
          ? 'Provider linking was cancelled.'
          : 'We could not link that provider. Confirm it belongs to this account and try again.');
      }, 0);
      url.searchParams.delete('oauth');
      url.searchParams.delete('oauth_error');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      return () => window.clearTimeout(timer);
    }
  }, [intent]);

  const connect = async (provider: string) => {
    if (requestStarted.current) return;
    requestStarted.current = true;
    setBusyProvider(provider);
    setError('');
    try {
      const requestedReturnTo = new URLSearchParams(window.location.search).get('redirect');
      const returnTo = intent === 'link'
        ? '/settings?tab=security'
        : requestedReturnTo && requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//')
          ? requestedReturnTo
          : '/dashboard';
      if (intent !== 'link') {
        const startUrl = api.getUri({
          url: `/auth/oauth/${provider}/start`,
          params: { returnTo },
        });
        window.location.assign(startUrl);
        return;
      }

      const response = await api.get(`/auth/oauth/${provider}/start`, {
        withCredentials: true,
        params: {
          returnTo,
          ...(intent === 'link' ? { intent: 'link' } : {}),
        },
      });
      const authUrl = response.data?.authUrl;
      if (typeof authUrl !== 'string' || !/^https:\/\/(accounts\.google\.com|appleid\.apple\.com)\//.test(authUrl)) {
        throw new Error('The sign-in provider returned an invalid destination.');
      }
      window.location.assign(authUrl);
    } catch (requestError: unknown) {
      const response = (requestError as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message || 'We could not start secure sign-in. Please try again.');
      requestStarted.current = false;
      setBusyProvider(null);
    }
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-3">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            disabled={busyProvider !== null}
            onClick={() => void connect(provider.id)}
            className={`flex min-h-11 items-center justify-center gap-2 border border-stone-300 px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${provider.className}`}
            aria-label={`${intent === 'link' ? 'Link' : 'Continue with'} ${provider.label}`}
            aria-busy={busyProvider === provider.id}
          >
            {busyProvider === provider.id
              ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
              : <svg aria-hidden="true" viewBox="0 0 48 48" className="h-4 w-4">
                  <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z" />
                  <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4h-6.8v5.2A20 20 0 0 0 24 44Z" />
                  <path fill="#FBBC05" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 17.9l6.8-5.1Z" />
                  <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8A19.5 19.5 0 0 0 24 4 20 20 0 0 0 5.8 15l6.8 5.2C14.2 15.6 18.7 12 24 12Z" />
                </svg>}
            {busyProvider === provider.id
              ? `Connecting to ${provider.label}…`
              : `${intent === 'link' ? 'Link' : 'Continue with'} ${provider.label}`}
          </button>
        ))}
      </div>
      {notice && <p className="mt-3 text-xs text-emerald-700" role="status">{notice}</p>}
      {error && <p className="auth-error mt-3" role="alert"><AlertCircle size={15} className="mr-2 inline" />{error}</p>}
    </div>
  );
}
