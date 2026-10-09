'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AxiosError } from 'axios';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/auth/AuthShell';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import { useAuthStore } from '@/store/useAuthStore';
import type { User } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const completeLogin = (response: { data: { user: User; accessToken: string } }) => {
    login(response.data.user, response.data.accessToken);
    router.push(response.data.user.companyId ? '/dashboard' : '/create-company');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email: email.trim(), password });
      if (!response.data.success) {
        setError('We could not sign you in. Check your details and try again.');
        return;
      }
      completeLogin(response);
    } catch (requestError: unknown) {
      const response = (requestError as AxiosError<{ code?: string; message?: string }>).response;
      setError(response?.data?.message || 'Email or password is incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <p className="auth-kicker !mb-3 !text-[9px]">YOUR WORKSPACE AWAITS</p>
      <h1 className="auth-form-title">Good to have you back.</h1>
      <p className="auth-form-subtitle">Sign in to pick up where your team left off.</p>

      <SocialAuthButtons className="mt-5" />
      <div className="my-5 flex items-center gap-3 text-[9px] font-bold uppercase tracking-[.14em] text-stone-400">
        <span className="h-px flex-1 bg-stone-200" />or sign in with email<span className="h-px flex-1 bg-stone-200" />
      </div>

      {error && <div className="auth-error" role="alert">
        <AlertCircle size={15} className="mr-2 inline align-[-2px]" />{error}
        {error.includes('Verify your email address') && <div className="mt-2"><Link className="auth-link"
          href={`/verify-email?email=${encodeURIComponent(email)}`}>
          Enter a verification code
        </Link></div>}
      </div>}

      <form onSubmit={handleSubmit}>
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
        <button className="auth-primary" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : <>Sign in to WorkGrind <ArrowRight size={16} /></>}
        </button>
      </form>

      <div className="mt-7 border-t border-stone-200 pt-4">
        <p className="mb-2 text-center text-[9px] font-bold uppercase tracking-[.14em] text-stone-400">Demo access</p>
        <div className="grid grid-cols-2 gap-2">
          {[{ name: 'Sarah · Owner', email: 'sarah@apextech.io' }, { name: 'Alex · Admin', email: 'alex@apextech.io' }].map((demo) => (
            <button key={demo.email} type="button" onClick={() => { setEmail(demo.email); setPassword('Password123!'); }}
              className="min-h-9 border border-stone-200 bg-[#fffefa] px-2 text-[10px] font-semibold text-stone-600 transition hover:border-stone-400 hover:text-stone-900">
              {demo.name}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-7 text-center text-xs text-stone-500">
        New to WorkGrind? <Link href="/signup" className="auth-link">Start your free trial</Link>
      </p>
      <p className="mt-5 text-center text-[10px] text-stone-400">Protected sign-in · Your team data stays yours</p>
    </AuthShell>
  );
}
