'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { api } from '@/lib/api';
import { describeApiError } from '@/lib/apiError';
import { renderRich, useI18n, useT } from '@/lib/i18n';

function ClientOAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT('clientPortal');
  const { tOptional } = useI18n();
  const started = useRef(false);
  const [error, setError] = useState('');
  const [supportId, setSupportId] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const attemptId = searchParams.get('attemptId') || '';
    if (searchParams.has('error')) return;
    if (!code || started.current) {
      if (!code && !started.current) setError(t('oauth.errors.invalid_request'));
      return;
    }
    started.current = true;
    window.history.replaceState({}, '', '/client-portal/oauth/callback');
    void api.post('/auth/oauth/exchange', { code, ...(attemptId ? { attemptId } : {}) })
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
        // An incomplete success response is not an HTTP failure: show the generic message.
        const fallback = t('oauth.errors.try_again');
        setError(axios.isAxiosError(requestError) ? describeApiError(requestError, fallback).message : fallback);
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)) {
          setSupportId(attemptId);
        }
      });
  }, [router, searchParams, t]);

  const errorCode = searchParams.get('error');
  const querySupportId = searchParams.get('supportId');
  const displayedSupportId = supportId || (
    querySupportId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(querySupportId)
      ? querySupportId
      : ''
  );
  const displayedError = error || (errorCode
    ? tOptional(`clientPortal.oauth.errors.${errorCode}`) || t('oauth.errors.try_again')
    : '');

  return (
    <AuthShell>
      {displayedError
        ? <>
          <div className="auth-error" role="alert">
            <AlertCircle size={16} className="me-2 inline" />{displayedError}
          </div>
          {displayedSupportId && (
            <p className="mt-3 text-center text-xs text-stone-500">
              {renderRich(t('oauth.referenceId', { id: displayedSupportId }), { code: (chunk) => <code>{chunk}</code> })}
            </p>
          )}
          <p className="mt-5 text-center text-xs text-stone-500">
            <Link href="/client-portal" className="auth-link">{t('oauth.returnToSignIn')}</Link>
          </p>
        </>
        : <div className="flex items-center gap-3 py-8 text-sm text-stone-600" role="status">
          <LoaderCircle size={18} className="animate-spin" /> {t('oauth.completing')}
        </div>}
    </AuthShell>
  );
}

export default function ClientOAuthCallbackPage() {
  const t = useT('clientPortal');
  return (
    <Suspense fallback={<AuthShell><p className="py-8 text-sm text-stone-600">{t('oauth.completing')}</p></AuthShell>}>
      <ClientOAuthCallbackContent />
    </Suspense>
  );
}
