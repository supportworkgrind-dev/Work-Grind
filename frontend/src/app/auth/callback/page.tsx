'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import type { AxiosError } from 'axios';
import { AuthShell } from '@/components/auth/AuthShell';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

const errorMessages: Record<string, string> = {
  mfa_required: 'Administrator accounts must sign in through the Admin Portal and complete multi-factor authentication.',
  cancelled: 'Sign-in was cancelled. You can try again whenever you’re ready.',
  provider_unavailable: 'This sign-in provider is temporarily unavailable. Please try again later.',
  invalid_request: 'This sign-in link is invalid or expired. Please start again.',
  account_exists: 'An account with this email already exists. Sign in with your existing method instead.',
  identity_in_use: 'This Google account is already linked to a different WorkGrind account.',
  verified_email_required: 'Google must confirm your email address before WorkGrind can use this account.',
  try_again: 'We could not complete secure sign-in. Please try again.',
};

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const started = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) return;
    const code = searchParams.get('code');
    if (!code || started.current) {
      if (!code && !started.current && !error) setError(errorMessages.invalid_request);
      return;
    }
    started.current = true;
    window.history.replaceState({}, '', '/auth/callback');
    void api.post('/auth/oauth/exchange', { code })
      .then((response) => {
        const data = response.data;
        if (!data?.success || !data.user?._id || !data.accessToken || !data.refreshToken) {
          if (data?.success && data.phoneRequired && data.phoneVerificationToken) {
            sessionStorage.setItem('workgrind_phone_verification_token', data.phoneVerificationToken);
            sessionStorage.setItem('workgrind_social_phone_exists', data.phoneExists ? 'true' : 'false');
            const returnTo = typeof data.returnTo === 'string' &&
              data.returnTo.startsWith('/') &&
              !data.returnTo.startsWith('//') &&
              !data.returnTo.includes('\\')
              ? data.returnTo
              : '/dashboard';
            sessionStorage.setItem('workgrind_oauth_return_to', returnTo);
            router.replace('/verify-phone?social=1');
            return;
          }
          throw new Error('Sign-in response was incomplete.');
        }
        login(data.user, data.accessToken, data.refreshToken);
        const returnTo = typeof data.returnTo === 'string' &&
          data.returnTo.startsWith('/') &&
          !data.returnTo.startsWith('//') &&
          !data.returnTo.includes('\\')
          ? data.returnTo
          : (data.user.companyId ? '/dashboard' : '/create-company');
        router.replace(!data.user.companyId && returnTo === '/dashboard' ? '/create-company' : returnTo);
      })
      .catch((requestError: unknown) => {
        const message = (requestError as AxiosError<{ message?: string }>).response?.data?.message;
        setError(message || errorMessages.try_again);
      });
  }, [searchParams, router, login, error]);
  const queryError = searchParams.get('error');
  const displayedError = error || (queryError ? errorMessages[queryError] || errorMessages.try_again : '');

  return (
    <AuthShell>
      {displayedError
        ? <>
          <div className="auth-error" role="alert"><AlertCircle size={16} className="mr-2 inline" />{displayedError}</div>
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
