'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AxiosError } from 'axios';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, Smartphone } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/auth/AuthShell';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import { useAuthStore } from '@/store/useAuthStore';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import type { User } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [mode, setMode] = useState<'password' | 'phone'>('password');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [developmentCode, setDevelopmentCode] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const completeLogin = (response: { data: { user: User; accessToken: string; refreshToken: string } }) => {
    login(response.data.user, response.data.accessToken, response.data.refreshToken);
    router.push(response.data.user.companyId ? '/dashboard' : '/create-company');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setNeedsVerification(false);
    setLoading(true);
    try {
      if (mode === 'phone') {
        const phoneNumber = parsePhoneNumberFromString(phone.trim());
        if (!phoneNumber?.isValid()) {
          setError('Enter a valid mobile number with its international country code, for example +1 415 555 2671.');
          return;
        }
        if (!codeSent) {
          const response = await api.post('/auth/phone-otp/request', { purpose: 'login', phone: phoneNumber.number });
          setPhone(phoneNumber.number);
          setCodeSent(true);
          setSeconds(60);
          setCode(response.data.developmentCode || '');
          setDevelopmentCode(response.data.developmentCode || '');
          return;
        }
        if (code.length !== 6) {
          setError('Enter the six-digit code sent to your mobile.');
          return;
        }
        completeLogin(await api.post('/auth/phone-otp/verify', { purpose: 'login', phone: phoneNumber.number, code }));
        return;
      }
      const response = await api.post('/auth/login', { email: email.trim(), password });
      if (!response.data.success) {
        setError('We could not sign you in. Check your details and try again.');
        return;
      }
      completeLogin(response);
    } catch (requestError: unknown) {
      const response = (requestError as AxiosError<{ code?: string; message?: string }>).response;
      const code = response?.data?.code;
      setNeedsVerification(code === 'EMAIL_NOT_VERIFIED' || code === 'PHONE_NOT_VERIFIED');
      setError(code === 'EMAIL_NOT_VERIFIED'
        ? 'Verify your email address before signing in.'
        : code === 'PHONE_NOT_VERIFIED'
          ? 'Verify your mobile number before signing in.'
        : response?.data?.message || 'Email or password is incorrect.');
    } finally {
      setLoading(false);
    }
  };

  const resendPhoneCode = async () => {
    if (seconds > 0 || resending) return;
    const phoneNumber = parsePhoneNumberFromString(phone.trim());
    if (!phoneNumber?.isValid()) {
      setError('Enter a valid mobile number with its international country code.');
      return;
    }
    setResending(true);
    setError('');
    try {
      const response = await api.post('/auth/phone-otp/request', { purpose: 'login', phone: phoneNumber.number });
      setSeconds(60);
      setCode(response.data.developmentCode || '');
      setDevelopmentCode(response.data.developmentCode || '');
    } catch {
      setError('We could not send a code right now. Please try again shortly.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell>
      <p className="auth-kicker !mb-3 !text-[9px]">YOUR WORKSPACE AWAITS</p>
      <h1 className="auth-form-title">Good to have you back.</h1>
      <p className="auth-form-subtitle">Sign in to pick up where your team left off.</p>

      <SocialAuthButtons className="mt-5" />
      <div className="my-5 flex items-center gap-3 text-[9px] font-bold uppercase tracking-[.14em] text-stone-400">
        <span className="h-px flex-1 bg-stone-200" />or sign in with email or phone<span className="h-px flex-1 bg-stone-200" />
      </div>

      {error && <div className="auth-error" role="alert">
        <AlertCircle size={15} className="mr-2 inline align-[-2px]" />{error}
        {needsVerification && <div className="mt-2"><Link className="auth-link"
          href={error.includes('mobile') ? `/verify-phone?email=${encodeURIComponent(email)}` : `/verify-email?email=${encodeURIComponent(email)}`}>
          Enter a verification code
        </Link></div>}
      </div>}

      <div className="mb-5 grid grid-cols-2 border border-stone-200 p-1 text-xs" role="group" aria-label="Sign-in method">
        <button type="button" onClick={() => { setMode('password'); setError(''); }}
          aria-pressed={mode === 'password'} className={`min-h-9 px-2 font-semibold ${mode === 'password' ? 'bg-[#edf1e9] text-[#425846]' : 'text-stone-500 hover:text-stone-800'}`}>
          Email &amp; password
        </button>
        <button type="button" onClick={() => { setMode('phone'); setError(''); }}
          aria-pressed={mode === 'phone'} className={`min-h-9 px-2 font-semibold ${mode === 'phone' ? 'bg-[#edf1e9] text-[#425846]' : 'text-stone-500 hover:text-stone-800'}`}>
          Phone code
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'password' ? <>
        <div className="auth-field">
          <label className="auth-label" htmlFor="login-email">Work email</label>
          <div className="auth-input-wrap">
            <Mail size={16} className="auth-icon" />
            <input id="login-email" className="auth-input" type="email" required autoComplete="email"
              placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
        </div>
        <div className="auth-field">
          <div className="auth-inline-row">
            <label className="auth-label !mb-0" htmlFor="login-password">Password</label>
            <Link href="/forgot-password" className="auth-link">Forgot password?</Link>
          </div>
          <div className="auth-password-wrap auth-input-wrap">
            <Lock size={16} className="auth-icon" />
            <input id="login-password" className="auth-input" type={showPassword ? 'text' : 'password'}
              required autoComplete="current-password" placeholder="Your password" value={password}
              onChange={(event) => setPassword(event.target.value)} />
            <button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((visible) => !visible)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        </> : <>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-phone">Mobile number</label>
            <div className="auth-input-wrap">
              <Smartphone size={16} className="auth-icon" />
              <input id="login-phone" className="auth-input" type="tel" required inputMode="tel" autoComplete="tel"
                placeholder="+1 415 555 2671" value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setCodeSent(false);
                  setCode('');
                  setDevelopmentCode('');
                }} />
            </div>
          </div>
          {codeSent && <>
            <div className="auth-field">
              <label className="auth-label">Verification code</label>
              <OtpCodeInput code={code} onChange={setCode} label="Sign-in verification code" disabled={loading} />
            </div>
            {developmentCode && <p className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="status">
              Local development code: <strong>{developmentCode}</strong>
            </p>}
            <div className="mb-4 flex items-center justify-between gap-3 text-xs text-stone-500">
              <span>Need another code?</span>
              <button type="button" disabled={seconds > 0 || resending} onClick={resendPhoneCode}
                className="auth-link disabled:cursor-not-allowed disabled:text-stone-400">
                {resending ? 'Sending…' : seconds > 0
                  ? `Resend in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
                  : 'Resend code'}
              </button>
            </div>
          </>}
          <p className="mb-4 text-[11px] leading-relaxed text-stone-500">
            We’ll send a one-time code only to a verified mobile number. It expires in five minutes.
          </p>
        </>}
        <button className="auth-primary" type="submit" disabled={loading}>
          {loading ? (mode === 'phone' && !codeSent ? 'Sending code…' : 'Signing in…')
            : mode === 'phone' ? codeSent ? <>Verify and sign in <ArrowRight size={16} /></> : <>Send verification code <ArrowRight size={16} /></>
              : <>Sign in to WorkGrind <ArrowRight size={16} /></>}
        </button>
      </form>
      {mode === 'phone' && <p className="mt-4 text-center text-xs text-stone-500">
        Need to reset your password? <Link href="/forgot-password" className="auth-link">Recover your account</Link>
      </p>}

      {mode === 'password' && <div className="mt-7 border-t border-stone-200 pt-4">
        <p className="mb-2 text-center text-[9px] font-bold uppercase tracking-[.14em] text-stone-400">Demo access</p>
        <div className="grid grid-cols-2 gap-2">
          {[{ name: 'Sarah · Owner', email: 'sarah@apextech.io' }, { name: 'Alex · Admin', email: 'alex@apextech.io' }].map((demo) => (
            <button key={demo.email} type="button" onClick={() => { setEmail(demo.email); setPassword('Password123!'); }}
              className="min-h-9 border border-stone-200 bg-[#fffefa] px-2 text-[10px] font-semibold text-stone-600 transition hover:border-stone-400 hover:text-stone-900">
              {demo.name}
            </button>
          ))}
        </div>
      </div>}

      <p className="mt-7 text-center text-xs text-stone-500">
        New to WorkGrind? <Link href="/signup" className="auth-link">Start your free trial</Link>
      </p>
      <p className="mt-5 text-center text-[10px] text-stone-400">Protected sign-in · Your team data stays yours</p>
    </AuthShell>
  );
}
