'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import {
  AlertCircle, ArrowRight, Lock, Mail, Shield, CheckCircle2,
  FolderKanban, MessageSquare, FileText, Video, BarChart3,
  Bell, ExternalLink,
} from 'lucide-react';

/* ── Features the client portal actually exposes ── */
const PORTAL_FEATURES = [
  { icon: FolderKanban,  label: 'Shared Projects',   desc: 'View projects and milestones shared with you' },
  { icon: CheckCircle2,  label: 'Tasks & Progress',   desc: 'Track tasks assigned to or shared with you' },
  { icon: MessageSquare, label: 'Team Messaging',     desc: 'Communicate directly with the team' },
  { icon: FileText,      label: 'Files & Documents',  desc: 'Access shared files and documentation' },
  { icon: Video,         label: 'Meetings & Calendar',desc: 'View meeting schedules and invitations' },
  { icon: Bell,          label: 'Live Updates',       desc: 'Receive important workspace notifications' },
];

export function ClientPortalLoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  /* Redirect if already logged in */
  useEffect(() => {
    const token = localStorage.getItem('workgrind_client_token');
    if (token) router.push('/client-portal/portal');
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await api.post('/client-portal/auth/login', { email, password });
      localStorage.setItem('workgrind_client_token', r.data.accessToken);
      localStorage.setItem('workgrind_client_user',  JSON.stringify(r.data.client));
      router.push('/client-portal/portal');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Login failed. Please check your credentials.');
    } finally { setLoading(false); }
  }

  return (
    <div className="client-auth-shell theme-scope min-h-screen flex">

      {/* ══ LEFT PANEL — features & branding ══════════════════════════════ */}
      <div className="client-portal-panel hidden lg:flex lg:w-[52%] xl:w-[48%] flex-col p-12 relative">
        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3 mb-auto">
          <ThemeAwareLogo size="sm" showWordmark surface="dark" />
          <div
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest border"
            style={{
              background: 'rgba(99,102,241,0.18)',
              color: '#a5b4fc',
              borderColor: 'rgba(99,102,241,0.3)',
            }}
          >
            Client Portal
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-md">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-6 w-fit"
            style={{
              background: 'rgba(99,102,241,0.15)',
              color: '#a5b4fc',
              border: '1px solid rgba(99,102,241,0.25)',
            }}
          >
            <Shield className="h-3 w-3" />
            Secure Access
          </div>

          <h1
            className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4"
            style={{ color: '#f1f5f9', letterSpacing: '-0.025em' }}
          >
            Your company's workspace,{' '}
            <span style={{
              background: 'linear-gradient(90deg, #a5b4fc 0%, #c4b5fd 50%, #93c5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              connected.
            </span>
          </h1>

          <p className="text-sm leading-relaxed mb-8" style={{ color: '#94a3b8' }}>
            Everything your team has shared with you — projects, tasks, files,
            messages and updates — in one secure portal.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-1 gap-3">
            {PORTAL_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="flex items-center gap-3.5 rounded-xl px-4 py-3 transition-all duration-150 hover:translate-x-0.5"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: '#e2e8f0' }}>{label}</p>
                  <p className="text-[11px] leading-snug mt-0.5" style={{ color: '#64748b' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <div className="relative z-10 mt-auto pt-8 flex items-center gap-2">
          <ExternalLink className="h-3.5 w-3.5" style={{ color: '#475569' }} />
          <p className="text-[11px]" style={{ color: '#475569' }}>
            Not a client? Visit{' '}
            <a href="/login" className="underline hover:opacity-80 transition-opacity" style={{ color: '#64748b' }}>
              WorkGrind workspace login
            </a>
          </p>
        </div>
      </div>

      {/* ══ RIGHT PANEL — login form ════════════════════════════════════ */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:px-10"
        style={{ background: 'var(--bg-base)' }}
      >
        {/* Mobile logo */}
        <div className="flex flex-col items-center gap-2 mb-8 lg:hidden">
          <ThemeAwareLogo size="md" showWordmark />
          <span
            className="rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{
              background: 'var(--accent-subtle)',
              color: 'var(--accent-text)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            Client Portal
          </span>
        </div>

        <div className="w-full max-w-sm">
          {/* Card header */}
          <div className="mb-7 text-center lg:text-left">
            <h2
              className="text-2xl font-extrabold tracking-tight mb-1.5"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.025em' }}
            >
              Welcome back
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Sign in to your client portal
            </p>
          </div>

          {/* Login card */}
          <div
            className="rounded-2xl border p-7 relative overflow-hidden"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Top gradient line */}
            <div
              className="absolute top-0 inset-x-0 h-px"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.5) 40%, rgba(124,58,237,0.4) 60%, transparent 100%)',
              }}
            />

            {error && (
              <div
                className="flex items-start gap-2.5 rounded-xl border p-3 mb-5 text-sm"
                style={{
                  borderColor: 'rgba(239,68,68,0.25)',
                  background: 'rgba(239,68,68,0.06)',
                  color: '#ef4444',
                }}
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="form-label" htmlFor="cp-email">Email address</label>
                <div className="relative mt-1">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    id="cp-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="input-premium w-full pl-10"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="cp-pass">Password</label>
                <div className="relative mt-1">
                  <Lock
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    id="cp-pass"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="input-premium w-full pl-10"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary btn-interactive w-full h-11 justify-center gap-2 rounded-xl text-sm font-semibold"
                style={{
                  background: loading
                    ? 'var(--accent)'
                    : 'linear-gradient(135deg, var(--accent) 0%, #6d28d9 100%)',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  <>
                    <span>Sign in to Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Security note */}
          <div
            className="mt-5 flex items-center justify-center gap-2 text-xs rounded-xl py-2.5 px-4"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
            }}
          >
            <Shield className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
            <span>Protected by WorkGrind — end-to-end secure</span>
          </div>

          <p className="mt-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Don't have access?{' '}
            <span style={{ color: 'var(--accent-text)' }}>
              Contact your account manager for an invitation.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
