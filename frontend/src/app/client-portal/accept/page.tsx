'use client';

/**
 * /client-portal/accept
 *
 * Landing page for client invitation links sent by email.
 * Reads the `token` query parameter, validates it against the backend,
 * and lets the client set a password to activate their account.
 *
 * This page lives OUTSIDE the authenticated (app) layout — it is a
 * public page accessible without any existing session.
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import { getApiBaseUrl } from '@/lib/apiConfig';
import {
  Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, Loader2,
} from 'lucide-react';

const API_BASE = getApiBaseUrl();

// Separate component so useSearchParams is inside <Suspense>
function AcceptInviteForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token') ?? '';

  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [showConf,    setShowConf]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [validating,  setValidating]  = useState(true);
  const [tokenValid,  setTokenValid]  = useState<boolean | null>(null);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);

  // Quick token presence check — full validation happens on submit
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setValidating(false);
      return;
    }
    // Token exists — assume valid until submit proves otherwise
    setTokenValid(true);
    setValidating(false);
  }, [token]);

  const passwordsMatch  = password && confirm && password === confirm;
  const strengthLevel   = password.length === 0 ? 0 : password.length < 5 ? 1 : password.length < 8 ? 2 : 3;
  const strengthColors  = ['#e2e8f0', '#f87171', '#fbbf24', '#34d399'];
  const strengthLabels  = ['', 'Weak', 'Fair', 'Strong'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/client-portal/auth/accept-invite`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message ?? 'Invalid or expired invitation link.');
        setTokenValid(false);
        return;
      }

      // Store client session and redirect to portal
      localStorage.setItem('workgrind_client_token', data.accessToken);
      localStorage.setItem('workgrind_client_user',  JSON.stringify(data.client));
      setSuccess(true);
      setTimeout(() => router.push('/client-portal/portal'), 1800);
    } catch {
      setError('Something went wrong. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (validating) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-500">Validating your invitation…</p>
      </div>
    );
  }

  // ── Invalid / missing token ────────────────────────────────────────────────
  if (tokenValid === false && !error) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
          <AlertCircle className="h-7 w-7 text-rose-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Invalid invitation</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          This invitation link is missing, invalid, or has already been used.
          Ask your account manager to resend the invitation.
        </p>
        <a
          href="/client-portal"
          className="mt-2 text-sm font-semibold text-indigo-600 hover:underline"
        >
          Go to login →
        </a>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Account created!</h2>
        <p className="text-sm text-slate-500">
          Redirecting you to your portal…
        </p>
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500 mt-2" />
      </div>
    );
  }

  // ── Set password form ──────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          Set up your account
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose a password to activate your client portal access.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Password */}
      <div>
        <label className="form-label" htmlFor="cp-pass">Password</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="cp-pass"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Minimum 6 characters"
            className="input-premium w-full pl-10 pr-11"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPass(p => !p)}
            aria-label={showPass ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {/* Strength bar */}
        {password && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex gap-1 flex-1">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{ background: i <= strengthLevel ? strengthColors[strengthLevel] : strengthColors[0] }}
                />
              ))}
            </div>
            <span className="text-[11px] font-semibold text-slate-400">
              {strengthLabels[strengthLevel]}
            </span>
          </div>
        )}
      </div>

      {/* Confirm password */}
      <div>
        <label className="form-label" htmlFor="cp-conf">Confirm Password</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="cp-conf"
            type={showConf ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            className={`input-premium w-full pl-10 pr-11 ${
              confirm
                ? passwordsMatch
                  ? 'border-emerald-400 focus:border-emerald-400'
                  : 'border-rose-300 focus:border-rose-400'
                : ''
            }`}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConf(p => !p)}
            aria-label={showConf ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {confirm && passwordsMatch
              ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              : showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />
            }
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !password || !confirm}
        className="btn-primary w-full h-11 justify-center gap-2 rounded-xl mt-1"
        style={{ fontWeight: 600 }}
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /><span>Activating…</span></>
        ) : (
          <><span>Activate Account</span><ArrowRight className="h-4 w-4" /></>
        )}
      </button>

      <p className="text-center text-xs text-slate-500">
        Already activated?{' '}
        <a href="/client-portal" className="font-semibold text-indigo-600 hover:underline">
          Sign in
        </a>
      </p>
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'var(--bg-base, #f1f5f9)' }}
    >
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <ThemeAwareLogo size="md" showWordmark />
          <p className="text-xs text-slate-500 mt-1">Client Portal Invitation</p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl border shadow-float px-7 py-9"
          style={{ background: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-color, #e2e8f0)' }}
        >
          {/* useSearchParams must be inside Suspense */}
          <Suspense fallback={
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            </div>
          }>
            <AcceptInviteForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-slate-400">
          🔒 Secure · Encrypted · Isolated workspace access
        </p>
      </div>
    </div>
  );
}
