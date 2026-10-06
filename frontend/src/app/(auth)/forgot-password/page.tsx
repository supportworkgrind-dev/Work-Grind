'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AxiosError } from 'axios';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Lock, Mail, Smartphone } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/auth/AuthShell';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phoneCodeRequested, setPhoneCodeRequested] = useState(false);
  const [developmentCode, setDevelopmentCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      if (mode === 'phone') {
        const phoneNumber = parsePhoneNumberFromString(phone.trim());
        if (!phoneNumber?.isValid()) {
          setError('Enter a valid mobile number with its international country code, for example +1 415 555 2671.');
          return;
        }
        if (!phoneCodeRequested) {
          const response = await api.post('/auth/phone-otp/request', { purpose: 'recovery', phone: phoneNumber.number });
          setPhone(phoneNumber.number);
          setPhoneCodeRequested(true);
          setSeconds(60);
          setDevelopmentCode(response.data.developmentCode || '');
          setCode(response.data.developmentCode || '');
          return;
        }
        if (code.length !== 6) {
          setError('Enter the six-digit code sent to your mobile.');
          return;
        }
        if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) ||
            !/[0-9]/.test(newPassword) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
          setError('Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.');
          return;
        }
        if (newPassword !== confirmPassword) {
          setError('Your passwords do not match.');
          return;
        }
        await api.post('/auth/phone-otp/recover', { phone: phoneNumber.number, code, password: newPassword });
        setSubmitted(true);
        return;
      }
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch (requestError: unknown) {
      setError((requestError as AxiosError<{ message?: string }>).response?.data?.message || 'We could not process that request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resendPhoneCode = async () => {
    if (seconds > 0 || resending || !phone.trim()) return;
    const phoneNumber = parsePhoneNumberFromString(phone.trim());
    if (!phoneNumber?.isValid()) {
      setError('Enter a valid mobile number with its international country code.');
      return;
    }
    setResending(true);
    setError('');
    try {
      const response = await api.post('/auth/phone-otp/request', { purpose: 'recovery', phone: phoneNumber.number });
      setSeconds(60);
      setDevelopmentCode(response.data.developmentCode || '');
      setCode(response.data.developmentCode || '');
    } catch {
      setError('We could not send a code right now. Please try again shortly.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell>
      {submitted ? (
        <>
          <div className="mb-5 grid h-11 w-11 place-items-center border border-[#cbd5c2] bg-[#edf1e9] text-[#526b58]"><Check size={20} /></div>
          <h1 className="auth-form-title">{mode === 'email' ? 'Check your inbox.' : 'Password updated.'}</h1>
          <p className="auth-form-subtitle">
            {mode === 'email'
              ? <>If an account exists for <strong className="font-semibold text-stone-800">{email}</strong>, a secure password reset link is on its way.</>
              : 'Your password was reset. Sign in with your new password.'}
          </p>
          <Link href="/login" className="auth-primary no-underline"><ArrowLeft size={15} /> Back to sign in</Link>
        </>
      ) : (
        <>
          <p className="auth-kicker !mb-3 !text-[9px]">ACCOUNT RECOVERY</p>
          <h1 className="auth-form-title">Let’s get you back in.</h1>
          <p className="auth-form-subtitle">{mode === 'email'
            ? 'Enter the address on your account. We’ll email you a secure reset link.'
            : 'Verify your mobile number with a one-time code that expires in five minutes, then choose a new password.'}</p>
          {error && <div className="auth-error" role="alert"><AlertCircle size={15} className="mr-2 inline" />{error}</div>}
          <div className="mb-5 grid grid-cols-2 border border-stone-200 p-1 text-xs" role="group" aria-label="Password recovery method">
            <button type="button" onClick={() => { setMode('email'); setError(''); }} aria-pressed={mode === 'email'}
              className={`min-h-9 px-2 font-semibold ${mode === 'email' ? 'bg-[#edf1e9] text-[#425846]' : 'text-stone-500 hover:text-stone-800'}`}>
              Email link
            </button>
            <button type="button" onClick={() => { setMode('phone'); setError(''); }} aria-pressed={mode === 'phone'}
              className={`min-h-9 px-2 font-semibold ${mode === 'phone' ? 'bg-[#edf1e9] text-[#425846]' : 'text-stone-500 hover:text-stone-800'}`}>
              Phone code
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            {mode === 'email' ? <div className="auth-field">
              <label className="auth-label" htmlFor="recovery-email">Account email</label>
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-icon" />
                <input id="recovery-email" className="auth-input" type="email" required autoComplete="email"
                  placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            </div> : <>
              <div className="auth-field">
                <label className="auth-label" htmlFor="recovery-phone">Mobile number</label>
                <div className="auth-input-wrap">
                  <Smartphone size={16} className="auth-icon" />
                  <input id="recovery-phone" className="auth-input" type="tel" required inputMode="tel" autoComplete="tel"
                    placeholder="+1 415 555 2671" value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      setPhoneCodeRequested(false);
                      setCode('');
                      setDevelopmentCode('');
                    }} />
                </div>
              </div>
              {phoneCodeRequested && <>
                <div className="auth-field">
                  <label className="auth-label">Verification code</label>
                  <OtpCodeInput code={code} onChange={setCode} label="Password recovery code" disabled={loading} />
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
                <div className="auth-field">
                  <label className="auth-label" htmlFor="recovery-new-password">New password</label>
                  <div className="auth-input-wrap">
                    <Lock size={16} className="auth-icon" />
                    <input id="recovery-new-password" className="auth-input" type="password" required autoComplete="new-password"
                      value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                  </div>
                </div>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="recovery-confirm-password">Confirm new password</label>
                  <div className="auth-input-wrap">
                    <Lock size={16} className="auth-icon" />
                    <input id="recovery-confirm-password" className="auth-input" type="password" required autoComplete="new-password"
                      value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                  </div>
                </div>
              </>}
            </>}
            <button className="auth-primary" type="submit" disabled={loading}>
              {loading ? (mode === 'email' ? 'Sending secure link…' : phoneCodeRequested ? 'Resetting password…' : 'Sending code…')
                : mode === 'email' ? <>Send reset link <ArrowRight size={16} /></>
                  : phoneCodeRequested ? <>Reset password <ArrowRight size={16} /></> : <>Send recovery code <ArrowRight size={16} /></>}
            </button>
          </form>
          <Link className="mt-7 inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800" href="/login">
            <ArrowLeft size={13} /> Back to sign in
          </Link>
        </>
      )}
    </AuthShell>
  );
}
