'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { AxiosError } from 'axios';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { api } from '@/lib/api';

const errorMessages: Record<string, string> = {
  account_exists: 'This email already has a client portal account. Sign in with its password, then link the provider from your portal.',
  client_invitation_required: 'This provider account is not linked to an active client invitation. Ask your account manager for portal access.',
  cancelled: 'Sign-in was cancelled. You can try again whenever you’re ready.',
  invalid_request: 'This sign-in link is invalid or expired. Please start again.',
  provider_unavailable: 'This sign-in provider is temporarily unavailable. Please try again later.',
  verified_email_required: 'The provider must confirm your email address before it can be used here.',
  try_again: 'We could not complete secure sign-in. Please try again.',
};

function ClientOAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const started = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (searchParams.has('error')) return;
    if (!code || started.current) {
      if (!code && !started.current) setError(errorMessages.invalid_request);
      return;
    }
    started.current = true;
    window.history.replaceState({}, '', '/client-portal/oauth/callback');
    void api.post('/auth/oauth/exchange', { code })
      .then((response) => {
        const data = response.data;
        if (!data?.success || data.audience !== 'client' || !data.client?._id || !data.accessToken) {
          throw new Error('Client portal sign-in response was incomplete.');
        }
        localStorage.setItem('workgrind_client_token', data.accessToken);
        localStorage.setItem('workgrind_client_user', JSON.stringify(data.client));
        router.replace('/client-portal/portal');
      })
      .catch((requestError: unknown) => {
        const message = (requestError as AxiosError<{ message?: string }>).response?.data?.message;
        setError(message || errorMessages.try_again);
      });
  }, [router, searchParams]);

  const errorCode = searchParams.get('error');
  const displayedError = error || (errorCode ? errorMessages[errorCode] || errorMessages.try_again : '');

  return (
    <AuthShell>
      {displayedError
        ? <>
          <div className="auth-error" role="alert">
            <AlertCircle size={16} className="mr-2 inline" />{displayedError}
          </div>
          <p className="mt-5 text-center text-xs text-stone-500">
            <Link href="/client-portal" className="auth-link">Return to client portal sign in</Link>
          </p>
        </>
        : <div className="flex items-center gap-3 py-8 text-sm text-stone-600" role="status">
          <LoaderCircle size={18} className="animate-spin" /> Completing secure sign-in…
        </div>}
    </AuthShell>
  );
}

export default function ClientOAuthCallbackPage() {
  return (
    <Suspense fallback={<AuthShell><p className="py-8 text-sm text-stone-600">Completing secure sign-in…</p></AuthShell>}>
      <ClientOAuthCallbackContent />
    </Suspense>
  );
}
