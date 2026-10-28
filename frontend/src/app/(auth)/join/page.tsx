'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import {
  Building2,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  KeyRound,
  UserPlus,
  LogIn,
  Loader2,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { renderRich, useT } from '@/lib/i18n';
import { useRoleLabel } from '@/lib/useRoleLabel';
import type { OrganizationType } from '@/types';
import { passwordError, registrationErrorsFrom, type RegistrationErrors } from '@/lib/passwordPolicy';

function JoinWorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, setCompany, login } = useAuthStore();

  // Hydration guard — isAuthenticated is false on server, may be true on client
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const urlToken = searchParams.get('token') || searchParams.get('code') || searchParams.get('invite') || '';

  const [inputCode, setInputCode] = useState(urlToken);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{
    companyId: string;
    companyName: string;
    companyLogo?: string;
    organizationType?: OrganizationType;
    role: string;
    email?: string;
    inviterName: string;
  } | null>(null);
  // The role the server actually assigned when joining (it re-checks the invitation).
  const [joinedRole, setJoinedRole] = useState('');
  const [joinedEducation, setJoinedEducation] = useState(false);
  const t = useT('auth');
  // Invitations name the workspace type, so roles read "Student", "School Admin", …
  const roleLabel = useRoleLabel(inviteInfo ? { organizationType: inviteInfo.organizationType, accountType: 'company' } : null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // New user registration state (if joining and not logged in)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegistrationErrors>({});

  const validateCode = async (codeToValidate: string) => {
    if (!codeToValidate.trim()) return;
    setValidating(true);
    setError('');

    try {
      const res = await api.get(`/auth/invite/${encodeURIComponent(codeToValidate.trim())}`);
      if (res.data.success) {
        setInviteInfo(res.data.invite);
        if (res.data.invite.email) {
          setEmail(res.data.invite.email);
        }
      }
    } catch (err: any) {
      setInviteInfo(null);
      setError(err.response?.data?.message || 'Invalid or expired invitation link or code.');
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if (urlToken) {
      validateCode(urlToken);
    }
  }, [urlToken]);

  const handleJoinAsLoggedIn = async () => {
    const code = inputCode.trim() || urlToken;
    if (!code) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/join-company', {
        inviteToken: code,
        inviteCode: code,
      });

      if (res.data.success) {
        setCompany(res.data.company);
        setJoinedRole(res.data.role || '');
        setJoinedEducation(Boolean(res.data.company.organizationType && res.data.company.organizationType !== 'business'));
        if (res.data.accessToken) {
          login({ ...user!, companyId: res.data.company, role: res.data.role }, res.data.accessToken);
        }
        setSuccess(true);
        setTimeout(() => {
          router.push(res.data.company.organizationType && res.data.company.organizationType !== 'business'
            ? '/academic'
            : '/dashboard');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to join workspace. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = inputCode.trim() || urlToken;
    if (!code) return;

    // Same rules as the server, so problems show before anything is sent.
    const localErrors: RegistrationErrors = {};
    if (!fullName.trim()) localErrors.fullName = 'Enter your full name.';
    else if (fullName.trim().length > 100) localErrors.fullName = 'Your name must be 100 characters or fewer.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) localErrors.email = 'Enter a valid email address, like name@example.com.';
    else if (inviteInfo?.email && inviteInfo.email.toLowerCase() !== email.trim().toLowerCase()) {
      localErrors.email = 'This invitation was sent to a different email address. Register with the invited email address.';
    }
    const passwordProblem = passwordError(password);
    if (passwordProblem) localErrors.password = passwordProblem;
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length) return;

    setLoading(true);
    setError('');

    try {
      // The server takes the workspace type from this invitation, not from the form.
      await api.post('/auth/register', {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        inviteToken: code,
      });
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}&invite=${encodeURIComponent(code)}`);
    } catch (err: any) {
      const serverErrors = registrationErrorsFrom(err);
      setFieldErrors(serverErrors);
      // Field problems are shown beside their fields; the banner covers the rest.
      const shownBesideFields = Boolean(serverErrors.fullName || serverErrors.email || serverErrors.password);
      setError(serverErrors.invitation || (shownBesideFields ? '' : err.response?.data?.message || 'Registration or joining failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="theme-scope theme-bg-base min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Brand Header */}
      <div className="mb-8">
        <ThemeAwareLogo size="lg" showWordmark={true} />
      </div>

      <div className="w-full max-w-lg">
        {/* Success Screen */}
        {success ? (
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-xl shadow-emerald-500/5 animate-in fade-in duration-300">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {t('join.welcome', { workspace: inviteInfo?.companyName || t('join.welcomeFallback') })}
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {renderRich(t('join.activated', { role: roleLabel(joinedRole || inviteInfo?.role) }), {
                role: (chunk) => <span className="font-semibold text-slate-900" data-testid="joined-role">{chunk}</span>,
              })}{' '}
              {joinedEducation ? t('join.redirectAcademic') : t('join.redirectDashboard')}
            </p>
            <div className="mt-6 flex justify-center">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-full bg-emerald-500 animate-pulse" />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            {/* Top Banner */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-8 py-8 text-white text-center relative">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md px-3 py-1 text-xs font-semibold text-indigo-100 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
                <span>Workspace Invitation</span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                Join Your WorkGrind Workspace
              </h1>
              <p className="mt-1.5 text-xs text-indigo-100 max-w-sm mx-auto">
                Join a WorkGrind workspace to access the shared tools and information available to your role.
              </p>
            </div>

            <div className="p-8 space-y-6">
              {/* If no code was provided in URL, allow manual input */}
              {!urlToken && !inviteInfo && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Have an invite link or workspace code?
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value)}
                        placeholder="Enter 8-digit code or paste invite link..."
                        className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => validateCode(inputCode)}
                      disabled={validating || !inputCode.trim()}
                      className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all shrink-0"
                    >
                      {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find Team'}
                    </button>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-700 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                  <div>
                    <span className="font-bold">Invitation Error:</span> {error}
                  </div>
                </div>
              )}

              {/* Verified Workspace Card */}
              {inviteInfo && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-3">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-extrabold text-base shadow-sm">
                      {getInitials(inviteInfo.companyName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {inviteInfo.companyName}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">
                        Invited by <span className="font-semibold text-slate-700">{inviteInfo.inviterName}</span>
                      </p>
                    </div>
                    <span className="rounded-xl bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-700 shrink-0" data-role={inviteInfo.role}>
                      {roleLabel(inviteInfo.role)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-indigo-100/70 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-indigo-500" /> Verified Workspace
                    </span>
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Secure Invitation
                    </span>
                  </div>
                </div>
              )}

              {/* Action Section */}
              {inviteInfo && (
                <>
                  {mounted && isAuthenticated && user ? (
                    /* User is already logged in */
                    <div className="space-y-3 pt-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center justify-between">
                        <span>Joining as:</span>
                        <span className="font-bold text-slate-900">{user.fullName} ({user.email})</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleJoinAsLoggedIn}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 active:scale-[0.99] transition-all disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <span>Accept & Join {inviteInfo.companyName}</span>
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    /* User is not logged in: Offer quick signup or login */
                    <div className="space-y-4 pt-2">
                      {!showSignup ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setShowSignup(true)}
                            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-500 transition-all"
                          >
                            <UserPlus className="h-4 w-4" />
                            <span>Create Account & Join</span>
                          </button>
                          <Link
                            href={`/login?redirect=/join?token=${encodeURIComponent(inputCode || urlToken)}`}
                            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                          >
                            <LogIn className="h-4 w-4" />
                            <span>I Already Have an Account</span>
                          </Link>
                        </div>
                      ) : (
                        <form onSubmit={handleRegisterAndJoin} className="space-y-3.5 animate-in fade-in">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Create your WorkGrind Account
                          </h4>

                          <div>
                            <label htmlFor="join-full-name" className="block text-[11px] font-semibold text-slate-700 uppercase">
                              Full Name
                            </label>
                            <input
                              id="join-full-name"
                              type="text"
                              required
                              maxLength={100}
                              autoComplete="name"
                              value={fullName}
                              onChange={(e) => { setFullName(e.target.value); setFieldErrors((current) => ({ ...current, fullName: undefined })); }}
                              placeholder="e.g. Maya Chen"
                              aria-invalid={Boolean(fieldErrors.fullName)}
                              aria-describedby={fieldErrors.fullName ? 'join-full-name-error' : undefined}
                              className="mt-1 block w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                            />
                            {fieldErrors.fullName && <p id="join-full-name-error" className="mt-1 text-[11px] text-rose-600">{fieldErrors.fullName}</p>}
                          </div>

                          <div>
                            <label htmlFor="join-email" className="block text-[11px] font-semibold text-slate-700 uppercase">
                              Email Address
                            </label>
                            <input
                              id="join-email"
                              type="email"
                              required
                              autoComplete="email"
                              value={email}
                              // An invitation sent to one address can only be accepted with it.
                              readOnly={Boolean(inviteInfo?.email)}
                              onChange={(e) => { setEmail(e.target.value); setFieldErrors((current) => ({ ...current, email: undefined })); }}
                              placeholder="you@company.com"
                              aria-invalid={Boolean(fieldErrors.email)}
                              aria-describedby={fieldErrors.email ? 'join-email-error' : undefined}
                              className="mt-1 block w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                            />
                            {fieldErrors.email && <p id="join-email-error" className="mt-1 text-[11px] text-rose-600">{fieldErrors.email}</p>}
                          </div>

                          <div>
                            <label htmlFor="join-password" className="block text-[11px] font-semibold text-slate-700 uppercase">
                              Password
                            </label>
                            <input
                              id="join-password"
                              type="password"
                              required
                              minLength={8}
                              autoComplete="new-password"
                              value={password}
                              onChange={(e) => { setPassword(e.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); }}
                              placeholder="Choose a strong password"
                              aria-invalid={Boolean(fieldErrors.password)}
                              aria-describedby="join-password-help"
                              className="mt-1 block w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-600"
                            />
                            <p id="join-password-help" className={`mt-1 text-[11px] ${fieldErrors.password ? 'text-rose-600' : 'text-slate-500'}`}>
                              {fieldErrors.password ?? 'At least 8 characters with uppercase and lowercase letters, a number, and a symbol.'}
                            </p>
                          </div>

                          <div className="pt-2 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setShowSignup(false)}
                              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                            >
                              ← Back
                            </button>
                            <button
                              type="submit"
                              disabled={loading}
                              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition-all disabled:opacity-50"
                            >
                              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Register & Join'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-400">
          <p>© {new Date().getFullYear()} WorkGrind. A connected workspace for work and learning.</p>
        </div>
      </div>
    </div>
  );
}

export default function JoinWorkspacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-slate-400">Loading invitation...</div>}>
      <JoinWorkspaceContent />
    </Suspense>
  );
}
