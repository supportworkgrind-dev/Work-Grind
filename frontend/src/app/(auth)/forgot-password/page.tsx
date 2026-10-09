'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import type { AxiosError } from 'axios';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/auth/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch (requestError: unknown) {
      setError((requestError as AxiosError<{ message?: string }>).response?.data?.message ||
        'We could not process that request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      {submitted ? (
        <>
          <div className="mb-5 grid h-11 w-11 place-items-center border border-[#cbd5c2] bg-[#edf1e9] text-[#526b58]"><Check size={20} /></div>
          <h1 className="auth-form-title">Check your inbox.</h1>
          <p className="auth-form-subtitle">
            If an account exists for <strong className="font-semibold text-stone-800">{email}</strong>, check for a reset message. For account security, this page does not confirm whether an email was sent.
          </p>
          <Link href="/login" className="auth-primary no-underline"><ArrowLeft size={15} /> Back to sign in</Link>
        </>
      ) : (
        <>
          <p className="auth-kicker !mb-3 !text-[9px]">ACCOUNT RECOVERY</p>
          <h1 className="auth-form-title">Let’s get you back in.</h1>
          <p className="auth-form-subtitle">Enter the address on your account. If it is registered, we’ll process a secure reset email request.</p>
          {error && <div className="auth-error" role="alert"><AlertCircle size={15} className="mr-2 inline" />{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="recovery-email">Account email</label>
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-icon" />
                <input id="recovery-email" className="auth-input" type="email" required autoComplete="email"
                  placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            </div>
            <button className="auth-primary" type="submit" disabled={loading}>
              {loading ? 'Sending secure link…' : <>Send reset link <ArrowRight size={16} /></>}
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
