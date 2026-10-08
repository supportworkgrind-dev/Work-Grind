'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AxiosError } from 'axios';
import { AlertCircle, ArrowLeft, ArrowRight, Check, LoaderCircle, MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/auth/AuthShell';
import { useAuthStore } from '@/store/useAuthStore';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = (searchParams.get('email') || '').trim();
  const legacyToken = searchParams.get('token');
  const invite = searchParams.get('invite');
  const { login, setCompany } = useAuthStore();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'entry' | 'checking' | 'success' | 'legacy' | 'error'>(legacyToken ? 'checking' : 'entry');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!legacyToken) return;
    let active = true;
    api.get(`/auth/verify-email?token=${encodeURIComponent(legacyToken)}`)
      .then(() => { if (active) setStatus('legacy'); })
      .catch((requestError: unknown) => {
        if (active) {
          setStatus('error');
          setError((requestError as AxiosError<{ message?: string }>).response?.data?.message || 'This verification link is invalid or has expired.');
        }
      });
    return () => { active = false; };
  }, [legacyToken]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || code.length !== 6 || status === 'checking') return;
    setError('');
    setStatus('checking');
    try {
      const response = await api.post('/auth/verify-registration-code', { email, code });
      login(response.data.user, response.data.accessToken, response.data.refreshToken);
      if (invite) {
        try {
          const joined = await api.post('/auth/join-company', { inviteToken: invite, inviteCode: invite });
          setCompany(joined.data.company);
          login(
            { ...response.data.user, companyId: joined.data.company, role: joined.data.role },
            joined.data.accessToken,
            joined.data.refreshToken,
          );
          setStatus('success');
          window.setTimeout(() => router.push('/dashboard'), 700);
        } catch {
          router.replace(`/join?token=${encodeURIComponent(invite)}`);
        }
      } else {
        setStatus('success');
        window.setTimeout(() => router.push(response.data.user.companyId ? '/dashboard' : '/create-company'), 700);
      }
    } catch (requestError: unknown) {
      setStatus('entry');
      setError((requestError as AxiosError<{ message?: string }>).response?.data?.message || 'We could not verify that code. Please try again.');
    }
  };

  const handleResend = async () => {
    if (!email || seconds > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      await api.post('/auth/resend-registration-code', { email });
      setSeconds(60);
      setCode('');
    } catch (requestError: unknown) {
      setError((requestError as AxiosError<{ message?: string }>).response?.data?.message || 'A new code could not be sent. Please try again shortly.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell>
      {status === 'checking' && !legacyToken ? (
        <div className="py-10 text-center" role="status">
          <LoaderCircle size={26} className="mx-auto animate-spin text-[#526b58]" />
          <p className="mt-4 text-sm text-stone-600">Securing your account…</p>
        </div>
      ) : status === 'success' || status === 'legacy' ? (
        <div className="py-5">
          <div className="mb-5 grid h-11 w-11 place-items-center border border-[#cbd5c2] bg-[#edf1e9] text-[#526b58]">
            <Check size={20} />
          </div>
          <h1 className="auth-form-title">Email verified.</h1>
          <p className="auth-form-subtitle">
            {status === 'legacy'
              ? 'Your email is confirmed. Sign in to continue to your workspace.'
              : invite ? 'Your account is ready. Joining the invited workspace…' : 'Your email is confirmed. Sign in to continue to your workspace.'}
          </p>
          {status === 'legacy' && <Link href="/login" className="auth-primary no-underline">Continue to sign in <ArrowRight size={16} /></Link>}
        </div>
      ) : status === 'error' && legacyToken ? (
        <div className="py-5">
          <div className="auth-error" role="alert"><AlertCircle size={15} className="mr-2 inline" />{error}</div>
          <Link href="/login" className="auth-primary no-underline">Back to sign in <ArrowRight size={16} /></Link>
        </div>
      ) : !email ? (
        <div className="py-5">
          <div className="auth-error" role="alert">A signup email is needed to verify your account. Start signup again to request a code.</div>
          <Link href="/signup" className="auth-primary no-underline">Return to signup <ArrowRight size={16} /></Link>
        </div>
      ) : (
        <>
          <p className="auth-kicker !mb-3 !text-[9px]">ONE LAST STEP</p>
          <h1 className="auth-form-title">Check your inbox.</h1>
          <p className="auth-form-subtitle">
            We sent a six-digit code to <strong className="font-semibold text-stone-800">{email}</strong>. It expires in 10 minutes.
          </p>
          {error && <div className="auth-error" role="alert"><AlertCircle size={15} className="mr-2 inline align-[-2px]" />{error}</div>}

          <form onSubmit={handleVerify}>
            <p className="auth-label">Verification code</p>
            <OtpCodeInput code={code} onChange={setCode} label="Email verification code" disabled={status === 'checking'} />
            <button className="auth-primary" type="submit" disabled={code.length !== 6 || status === 'checking'}>
              Verify and continue <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-3 text-xs text-stone-500">
            <span>Didn’t receive it?</span>
            <button type="button" disabled={seconds > 0 || resending} onClick={handleResend} className="auth-link disabled:cursor-not-allowed disabled:text-stone-400">
              {resending ? 'Sending…' : seconds > 0
                ? `Resend in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
                : 'Send a new code'}
            </button>
          </div>
          <p className="mt-6 border-t border-stone-200 pt-5 text-xs text-stone-500">
            <MailCheck size={15} className="mr-2 inline text-[#71836a]" />
            The code is single-use and stays valid for 10 minutes.
          </p>
          <Link className="mt-5 inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800" href="/signup">
            <ArrowLeft size={13} /> Back to signup
          </Link>
          <p className="mt-5 text-xs text-stone-500">
            Already registered? <Link className="auth-link" href="/login">Sign in instead</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<main className="auth-shell" />}><VerifyEmailContent /></Suspense>;
}
