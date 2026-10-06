'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/adminApi';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';
import {
  ShieldAlert,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!email.trim() || !password) {
      setErrorMessage('Please provide your admin email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await adminApi.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      if (res.data.success && res.data.mfaRequired && res.data.challengeToken) {
        setChallengeToken(res.data.challengeToken);
      } else if (res.data.success && res.data.token) {
        login(res.data.admin, res.data.token);
        router.push('/admin-portal');
      } else {
        setErrorMessage(res.data.message || 'Authorization failed.');
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || 'Access denied. Invalid administrator credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !challengeToken) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await adminApi.post('/auth/verify-mfa', { challengeToken, code: mfaCode.trim() });
      if (res.data.success && res.data.token) {
        login(res.data.admin, res.data.token);
        router.push('/admin-portal');
      } else {
        setErrorMessage(res.data.message || 'The authentication code could not be verified.');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'The authentication code could not be verified.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-auth-shell theme-scope min-h-screen flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-6 border-b border-slate-800/80">
        <Link href="/" className="flex items-center gap-2 group">
          <ThemeAwareLogo size="sm" showWordmark surface="dark" />
          <span className="ml-2 rounded-md bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
            Super Admin
          </span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Exit to Main Site</span>
        </Link>
      </div>

      {/* Center Auth Card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl animate-in fade-in duration-300">
          {/* Header Icon */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30 mb-4">
              <ShieldCheck className="h-7 w-7" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-white">
              {challengeToken ? 'Confirm it’s you' : 'Platform Operations Portal'}
            </h1>

            <p className="mt-1.5 text-xs text-slate-400 max-w-xs leading-relaxed">
              {challengeToken
                ? 'Enter your six-digit authenticator code or a one-time recovery code.'
                : 'Restricted platform console for authorized system owners. All sessions are audited.'}
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 flex items-start gap-3 text-rose-300 text-xs animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

            {challengeToken ? (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5" htmlFor="mfa-code">
                    Authentication code
                  </label>
                  <input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value)}
                    placeholder="6-digit code or recovery code"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-3 px-3.5 text-sm tracking-[0.15em] text-slate-100 placeholder:tracking-normal placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !mfaCode.trim()}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Verifying code…</span></> : <>Verify and continue <ArrowRight className="h-4 w-4" /></>}
                </button>
                <button type="button" onClick={() => { setChallengeToken(''); setMfaCode(''); setErrorMessage(''); }}
                  className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-200">
                  Back to password
                </button>
              </form>
            ) : <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Admin Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@workgrind.app"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-3.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-3.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>}

          {/* Security Disclaimer */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500/80" />
            <span>Authorized platform personnel only. IP logged.</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-xs text-slate-600">
        WorkGrind SaaS Platform &bull; Super Admin Architecture &bull; All Rights Reserved
      </div>
    </div>
  );
}
