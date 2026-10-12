'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { getApiEndpointUrl } from '@/lib/apiConfig';

type SocialAuthButtonsProps = {
  intent?: 'login' | 'link' | 'signup';
  audience?: 'user' | 'client';
  signupSelection?: { accountType: 'company' | 'individual'; organizationType: 'business' | 'school' | 'college' | 'university' } | null;
  className?: string;
};

const providers = [
  { id: 'google', label: 'Google', className: 'border-stone-300 bg-white text-stone-800 hover:bg-stone-50' },
  { id: 'linkedin', label: 'LinkedIn', className: 'border-[#0A66C2] bg-[#0A66C2] text-white hover:bg-[#004182]' },
] as const;

export function SocialAuthButtons({
  intent = 'login',
  audience = 'user',
  signupSelection,
  className = '',
}: SocialAuthButtonsProps) {
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
        ? audience === 'client' ? '/client-portal/portal' : '/settings?tab=security'
        : audience === 'client'
          ? '/client-portal/oauth/callback'
        : intent === 'signup'
          ? '/create-company'
        : requestedReturnTo && requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//')
          ? requestedReturnTo
          : '/dashboard';
      if (intent !== 'link') {
        const startUrl = getApiEndpointUrl(`/auth/oauth/${provider}/start`, {
          returnTo,
          ...(audience === 'client' ? { audience: 'client' } : {}),
          ...(intent === 'signup' && signupSelection
            ? { intent: 'signup', ...signupSelection }
            : {}),
        });
        window.location.assign(startUrl);
        return;
      }

      const response = await api.get(`/auth/oauth/${provider}/start`, {
        withCredentials: true,
        params: {
          returnTo,
          ...(audience === 'client' ? { audience: 'client' } : {}),
          ...(intent === 'link' ? { intent: 'link' } : {}),
        },
        ...(audience === 'client'
          ? { headers: { Authorization: `Bearer ${localStorage.getItem('workgrind_client_token') || ''}` } }
          : {}),
      });
      const authUrl = response.data?.authUrl;
      if (typeof authUrl !== 'string' || !/^https:\/\/(accounts\.google\.com|www\.linkedin\.com|appleid\.apple\.com)\//.test(authUrl)) {
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            disabled={busyProvider !== null || (intent === 'signup' && !signupSelection)}
            onClick={() => void connect(provider.id)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${provider.className}`}
            aria-label={`${intent === 'link' ? 'Link' : 'Continue with'} ${provider.label}`}
            aria-busy={busyProvider === provider.id}
          >
            {busyProvider === provider.id
              ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
              : provider.id === 'google'
                ? <svg aria-hidden="true" viewBox="0 0 48 48" className="h-4 w-4">
                  <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z" />
                  <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4h-6.8v5.2A20 20 0 0 0 24 44Z" />
                  <path fill="#FBBC05" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 17.9l6.8-5.1Z" />
                  <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8A19.5 19.5 0 0 0 24 4 20 20 0 0 0 5.8 15l6.8 5.2C14.2 15.6 18.7 12 24 12Z" />
                </svg>
                : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.26 2.37 4.26 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" />
                </svg>}
            {busyProvider === provider.id
              ? `Connecting to ${provider.label}…`
              : `${intent === 'link' ? 'Link' : 'Continue with'} ${provider.label}`}
          </button>
        ))}
      </div>
      {intent === 'signup' && !signupSelection && (
        <p className="mt-2 text-center text-xs text-stone-500">Choose an account type above to continue.</p>
      )}
      {notice && <p className="mt-3 text-xs text-emerald-700" role="status">{notice}</p>}
      {error && <p className="auth-error mt-3" role="alert"><AlertCircle size={15} className="mr-2 inline" />{error}</p>}
    </div>
  );
}
