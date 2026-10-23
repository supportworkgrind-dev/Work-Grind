'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import type { AxiosError } from 'axios';
import { AuthShell } from '@/components/auth/AuthShell';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { getAuthenticatedDestination, getSafeReturnPath } from '@/lib/authRedirect';
import { storeMfaChallenge } from '@/lib/mfaChallenge';

const errorMessages: Record<string, string> = {
  mfa_required: 'Administrator accounts must sign in through the Admin Portal and complete multi-factor authentication.',
  cancelled: 'Sign-in was cancelled. You can try again whenever you’re ready.',
  provider_unavailable: 'This sign-in provider is temporarily unavailable. Please try again later.',
  authorization_failed: 'LinkedIn authorization failed. Please start again and approve the requested access.',
  invalid_request: 'This sign-in link is invalid or expired. Please start again.',
  attempt_expired: 'Your sign-in attempt expired. Please start again.',
  account_exists: 'An account with this email already exists. Sign in with that account first, then connect this provider in Settings → Security.',
  signup_required: 'Choose an account type on the sign-up page before creating a new account with a provider.',
  identity_in_use: 'This provider account is already linked to a different WorkGrind account.',
  verified_email_required: 'The provider must confirm your email address before WorkGrind can use this account.',
  try_again: 'We could not complete secure sign-in. Please try again.',
};

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const started = useRef(false);
  const [error, setError] = useState('');
  const [supportId, setSupportId] = useState('');

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) return;
    const code = searchParams.get('code');
    const attemptId = searchParams.get('attemptId') || '';
    if (!code || started.current) {
      if (!code && !started.current && !error) setError(errorMessages.invalid_request);
      return;
    }
    started.current = true;
    window.history.replaceState({}, '', '/auth/callback');
    void api.post('/auth/oauth/exchange', { code, ...(attemptId ? { attemptId } : {}) })
      .then(async (response) => {
        const data = response.data;
        if (data?.success && data.mfaRequired && typeof data.mfaToken === 'string') {
          // The provider was the first factor; the login page asks for the code.
          storeMfaChallenge(data.mfaToken, getSafeReturnPath(data.returnTo));
          router.replace('/login?step=mfa');
          return;
        }
        if (!data?.success || !data.user?._id || !data.accessToken) {
          throw new Error('Sign-in response was incomplete.');
        }
        login(data.user, data.accessToken);
        const current = await api.get('/auth/me');
        if (!current.data?.success || !current.data?.user?._id) {
          throw new Error('The account profile was incomplete.');
        }
        login(current.data.user, data.accessToken);
        router.replace(getAuthenticatedDestination(
          current.data.user,
          getSafeReturnPath(data.returnTo),
        ));
      })
      .catch((requestError: unknown) => {
        const message = (requestError as AxiosError<{ message?: string }>).response?.data?.message;
        setError(message || errorMessages.try_again);
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)) {
          setSupportId(attemptId);
        }
      });
  }, [searchParams, router, login, error]);
  const queryError = searchParams.get('error');
  const querySupportId = searchParams.get('supportId');
  const displayedSupportId = supportId || (
    querySupportId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(querySupportId)
      ? querySupportId
      : ''
  );
  const displayedError = error || (queryError ? errorMessages[queryError] || errorMessages.try_again : '');

  return (
    <AuthShell>
      {displayedError
        ? <>
          <div className="auth-error" role="alert"><AlertCircle size={16} className="mr-2 inline" />{displayedError}</div>
          {displayedSupportId && (
            <p className="mt-3 text-center text-xs text-stone-500">Reference ID: <code>{displayedSupportId}</code></p>
          )}
          <p className="mt-5 text-center text-xs text-stone-500">
            <Link href="/login" className="auth-link">Return to sign in</Link>
            <span className="px-2">·</span>
            <Link href="/signup" className="auth-link">Create an account</Link>
          </p>
        </>
        : <div className="flex items-center gap-3 py-8 text-sm text-stone-600" role="status">
          <LoaderCircle size={18} className="animate-spin" /> Completing secure sign-in…
        </div>}
    </AuthShell>
  );
}

export default function OAuthCallbackPage() {
  return <Suspense fallback={<AuthShell><p className="py-8 text-sm text-stone-600">Completing secure sign-in…</p></AuthShell>}>
    <CallbackContent />
  </Suspense>;
}
