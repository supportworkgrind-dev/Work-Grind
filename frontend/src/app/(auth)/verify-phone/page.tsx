'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AxiosError } from 'axios';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { AlertCircle, ArrowLeft, ArrowRight, Check, LoaderCircle, Smartphone } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/auth/AuthShell';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { useAuthStore } from '@/store/useAuthStore';

function VerifyPhoneContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = (searchParams.get('email') || '').trim().toLowerCase();
  const purpose = searchParams.get('purpose') === 'change' ? 'change' : 'signup';
  const socialMode = searchParams.get('social') === '1';
  const invite = searchParams.get('invite');
  const { login, setCompany, user } = useAuthStore();
  const userPhone = user?.phone;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'entry' | 'sending' | 'verifying' | 'success'>('entry');
  const [seconds, setSeconds] = useState(0);
  const [resending, setResending] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [socialPhone, setSocialPhone] = useState('');
  const [startingPhone, setStartingPhone] = useState(false);
  const [phoneChallengeToken, setPhoneChallengeToken] = useState('');
  const [socialPhoneExists, setSocialPhoneExists] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (purpose === 'change') {
        if (!userPhone) {
          router.replace('/login');
          return;
        }
        setMaskedPhone(`${userPhone.slice(0, 3)}••••${userPhone.slice(-3)}`);
        api.post('/auth/phone-otp/request-change')
          .then(() => {
            setSeconds(60);
          })
          .catch((requestError: unknown) => setError(
            (requestError as AxiosError<{ message?: string }>).response?.data?.message ||
              'We could not send a code right now. Please try again shortly.',
          ));
        return;
      }
      if (socialMode) {
        const challenge = sessionStorage.getItem('workgrind_phone_verification_token') || '';
        const hasPhone = sessionStorage.getItem('workgrind_social_phone_exists') === 'true';
        sessionStorage.removeItem('workgrind_social_phone_exists');
        setPhoneChallengeToken(challenge);
        setSocialPhoneExists(hasPhone);
        if (!challenge) {
          setError('Your phone verification session expired. Sign in with Google or Apple again to continue.');
          return;
        }
        if (hasPhone) {
          api.post('/auth/phone-otp/start-social-signup', {}, {
            headers: { Authorization: `Bearer ${challenge}` },
            withCredentials: true,
          })
            .then((response) => {
              setMaskedPhone(response.data.phone || '');
              setSeconds(60);
            })
            .catch((requestError: unknown) => setError(
              (requestError as AxiosError<{ message?: string }>).response?.data?.message ||
                'We could not send a code right now. Please try again shortly.',
            ));
        }
        return;
      }
      const phone = sessionStorage.getItem('workgrind_signup_phone_masked') || '';
      const sent = sessionStorage.getItem('workgrind_signup_phone_code_sent') !== 'false';
      sessionStorage.removeItem('workgrind_dev_phone_otp');
      sessionStorage.removeItem('workgrind_signup_phone_masked');
      sessionStorage.removeItem('workgrind_signup_phone_code_sent');
      if (phone) setMaskedPhone(phone);
      if (!sent) setSeconds(0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [purpose, userPhone, socialMode, email, user?.email, router]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((purpose === 'signup' && !email && !socialMode) || code.length !== 6 || status === 'verifying') return;
    setError('');
    setStatus('verifying');
    try {
      const response = socialMode
        ? await api.post('/auth/phone-otp/verify-social-signup', { code }, {
          headers: { Authorization: `Bearer ${phoneChallengeToken}` },
          withCredentials: true,
        })
        : purpose === 'change'
          ? await api.post('/auth/phone-otp/verify-change', { code })
          : await api.post('/auth/phone-otp/verify', { purpose: 'signup', email, code });
      login(response.data.user, response.data.accessToken, response.data.refreshToken);
      if (socialMode) {
        sessionStorage.removeItem('workgrind_phone_verification_token');
        const destination = sessionStorage.getItem('workgrind_oauth_return_to');
        sessionStorage.removeItem('workgrind_oauth_return_to');
        setStatus('success');
        window.setTimeout(
          () => {
            const safeDestination = destination && destination.startsWith('/') &&
              !destination.startsWith('//') && !destination.includes('\\')
              ? destination
              : '/dashboard';
            router.replace(!response.data.user.companyId && safeDestination === '/dashboard'
              ? '/create-company'
              : safeDestination);
          },
          700,
        );
        return;
      }
      if (purpose === 'change') {
        setStatus('success');
        window.setTimeout(() => router.replace('/settings'), 700);
        return;
      }
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
        return;
      }
      setStatus('success');
      window.setTimeout(() => router.replace(response.data.user.companyId ? '/dashboard' : '/create-company'), 700);
    } catch (requestError: unknown) {
      setStatus('entry');
      setError((requestError as AxiosError<{ message?: string }>).response?.data?.message || 'That code is invalid or expired. Request another and try again.');
    }
  };

  const handleResend = async () => {
    if ((purpose === 'signup' && !email && !socialMode) || seconds > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      purpose === 'change'
        ? await api.post('/auth/phone-otp/request-change')
        : socialMode
          ? await api.post('/auth/phone-otp/start-social-signup', {}, {
            headers: { Authorization: `Bearer ${phoneChallengeToken}` },
            withCredentials: true,
          })
        : await api.post('/auth/phone-otp/request', { purpose: 'signup', email: email || user?.email });
      setSeconds(60);
    } catch {
      setError('We could not send a code right now. Please try again shortly.');
    } finally {
      setResending(false);
    }
  };

  const handleStartSocialVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (startingPhone) return;
    const phoneNumber = parsePhoneNumberFromString(socialPhone.trim());
    if (!phoneNumber?.isValid()) {
      setError('Enter a valid mobile number with its international country code, for example +1 415 555 2671.');
      return;
    }
    setStartingPhone(true);
    setError('');
    try {
      const response = await api.post('/auth/phone-otp/start-social-signup', { phone: phoneNumber.number }, {
        headers: { Authorization: `Bearer ${phoneChallengeToken}` },
        withCredentials: true,
      });
      setMaskedPhone(response.data.phone || `${phoneNumber.number.slice(0, 3)}••••${phoneNumber.number.slice(-3)}`);
      setSocialPhoneExists(true);
      setSeconds(60);
    } catch (requestError: unknown) {
      setError((requestError as AxiosError<{ message?: string }>).response?.data?.message || 'We could not send a code right now. Please try again shortly.');
    } finally {
      setStartingPhone(false);
    }
  };

  if (purpose === 'signup' && !email && !socialMode) {
    return <AuthShell><div className="auth-error" role="alert">A signup email is required. Start signup again to continue.</div>
      <Link href="/signup" className="auth-primary no-underline">Return to signup <ArrowRight size={16} /></Link></AuthShell>;
  }

  return (
    <AuthShell>
      {status === 'success' ? (
        <div className="py-5" role="status">
          <div className="mb-5 grid h-11 w-11 place-items-center border border-[#cbd5c2] bg-[#edf1e9] text-[#526b58]"><Check size={20} /></div>
          <h1 className="auth-form-title">Mobile number verified.</h1>
          <p className="auth-form-subtitle">{purpose === 'change'
            ? 'Your profile is updated. Returning to settings…'
            : 'Your account is ready. Taking you to your workspace setup…'}</p>
        </div>
      ) : (
        <>
          <p className="auth-kicker !mb-3 !text-[9px]">SECURE YOUR ACCOUNT</p>
          <h1 className="auth-form-title">{purpose === 'change' ? 'Confirm your new mobile.' : socialMode && !socialPhoneExists ? 'Add your mobile number.' : 'Verify your mobile.'}</h1>
          <p className="auth-form-subtitle">
            {socialMode && !socialPhoneExists
              ? 'Add a mobile number to secure your new account. We’ll text a one-time verification code.'
              : <>Enter the six-digit code we sent to {maskedPhone ? <strong className="font-semibold text-stone-800">{maskedPhone}</strong> : 'your mobile number'}. It expires in five minutes.</>}
          </p>
          {error && <div className="auth-error" role="alert"><AlertCircle size={15} className="mr-2 inline align-[-2px]" />{error}</div>}
          {socialMode && !socialPhoneExists ? <form onSubmit={handleStartSocialVerification}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="social-phone">Mobile number</label>
              <div className="auth-input-wrap">
                <Smartphone size={16} className="auth-icon" />
                <input id="social-phone" className="auth-input" type="tel" required inputMode="tel"
                  autoComplete="tel" placeholder="+1 415 555 2671" value={socialPhone}
                  onChange={(event) => setSocialPhone(event.target.value)} />
              </div>
            </div>
            <button className="auth-primary" type="submit" disabled={startingPhone}>
              {startingPhone ? <><LoaderCircle size={16} className="animate-spin" /> Sending code…</> : <>Send verification code <ArrowRight size={16} /></>}
            </button>
          </form> : <form onSubmit={handleVerify}>
            <p className="auth-label">Verification code</p>
            <OtpCodeInput code={code} onChange={setCode} label="Mobile verification code" disabled={status === 'verifying'} />
            <button className="auth-primary" type="submit" disabled={code.length !== 6 || status === 'verifying'}>
              {status === 'verifying' ? <><LoaderCircle size={16} className="animate-spin" /> Verifying…</> : <>Verify mobile <ArrowRight size={16} /></>}
            </button>
          </form>}
          {(maskedPhone || purpose === 'change') && <div className="mt-6 flex items-center justify-between gap-3 text-xs text-stone-500">
            <span>Didn’t receive a text?</span>
            <button type="button" disabled={seconds > 0 || resending} onClick={handleResend}
              className="auth-link disabled:cursor-not-allowed disabled:text-stone-400">
              {resending ? 'Sending…' : seconds > 0
                ? `Resend in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
                : 'Send a new code'}
            </button>
          </div>}
          <Link className="mt-7 inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800" href={purpose === 'change' ? '/settings' : '/login'}>
            <ArrowLeft size={13} /> {purpose === 'change' ? 'Back to settings' : 'Back to sign in'}
          </Link>
        </>
      )}
    </AuthShell>
  );
}

export default function VerifyPhonePage() {
  return <Suspense fallback={<main className="auth-shell" />}><VerifyPhoneContent /></Suspense>;
}
