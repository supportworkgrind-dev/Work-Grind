'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowRight, CheckCircle2, GraduationCap, Loader2, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { describeApiError } from '@/lib/apiError';
import { useAuthStore } from '@/store/useAuthStore';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';
import { getInitials } from '@/lib/utils';
import type { OrganizationType } from '@/types';
import { passwordError, registrationErrorsFrom, type RegistrationErrors } from '@/lib/passwordPolicy';

type AcademicInvitation = {
  institutionName: string;
  institutionLogo?: string;
  organizationType: OrganizationType;
  role: 'student' | 'teacher' | 'parent';
  firstName: string;
  email: string;
  expiresAt: string;
};

const ROLE_LABELS: Record<AcademicInvitation['role'], string> = {
  student: 'Student',
  teacher: 'Teacher',
  parent: 'Parent / guardian',
};


/**
 * Accepts an academic onboarding invitation: the recipient signs in or creates
 * an account with the invited (verified) email, and the server links that
 * account to their institution record.
 */
function AcademicInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { user, isAuthenticated, login, setCompany } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [invitation, setInvitation] = useState<AcademicInvitation | null>(null);
  const [checking, setChecking] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegistrationErrors>({});
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let active = true;
    if (!token) {
      setChecking(false);
      setError('This invitation link is incomplete. Open the link from your invitation email again.');
      return;
    }
    api.get(`/academic-invitations/${encodeURIComponent(token)}`)
      .then((response) => {
        if (!active) return;
        setInvitation(response.data.invitation);
        setFullName(response.data.invitation.firstName ?? '');
      })
      .catch((requestError) => { if (active) setError(describeApiError(requestError, 'This invitation link is invalid, expired, or has already been used.').message); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    setError('');
    try {
      const response = await api.post('/academic-invitations/accept', { token });
      setCompany(response.data.company);
      login({ ...response.data.user, companyId: response.data.company, role: response.data.role }, response.data.accessToken);
      setDone(true);
      window.setTimeout(() => router.push('/academic'), 1200);
    } catch (requestError) {
      setError(describeApiError(requestError, 'The invitation could not be accepted.').message);
    } finally {
      setAccepting(false);
    }
  };

  const register = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!invitation) return;
    // Same rules as the server, so problems show before anything is sent.
    const localErrors: RegistrationErrors = {};
    if (!fullName.trim()) localErrors.fullName = 'Enter your full name.';
    const passwordProblem = passwordError(password);
    if (passwordProblem) localErrors.password = passwordProblem;
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length) return;
    setRegistering(true);
    setError('');
    try {
      // The server takes the institution type from this invitation, not from the form.
      await api.post('/auth/register', {
        fullName: fullName.trim(),
        email: invitation.email,
        password,
        academicInviteToken: token,
      });
      router.push(`/verify-email?email=${encodeURIComponent(invitation.email)}&academicInvite=${encodeURIComponent(token)}`);
    } catch (requestError) {
      const serverErrors = registrationErrorsFrom(requestError);
      setFieldErrors(serverErrors);
      const shownBesideFields = Boolean(serverErrors.fullName || serverErrors.password);
      setError(serverErrors.invitation || serverErrors.email || (shownBesideFields ? '' : describeApiError(requestError, 'Your account could not be created. Please try again.').message));
    } finally {
      setRegistering(false);
    }
  };

  const signedInEmail = mounted && isAuthenticated && user ? user.email : '';
  const emailMatches = Boolean(signedInEmail && invitation && signedInEmail.toLowerCase() === invitation.email.toLowerCase());

  return (
    <div className="theme-scope theme-bg-base min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="mb-8"><ThemeAwareLogo size="lg" showWordmark={true} /></div>
      <div className="w-full max-w-lg">
        {done ? (
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-xl" role="status">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your account is linked</h1>
            <p className="mt-2 text-sm text-slate-600">You now have access to {invitation?.institutionName} as a {ROLE_LABELS[invitation?.role ?? 'student'].toLowerCase()}. Opening your academic workspace…</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50">
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-8 py-8 text-center text-white">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-100"><GraduationCap className="h-3.5 w-3.5" /><span>Institution invitation</span></div>
              <h1 className="text-2xl font-extrabold tracking-tight">Join your institution on WorkGrind</h1>
              <p className="mx-auto mt-1.5 max-w-sm text-xs text-indigo-100">Verify your email and create or link your account to see your classes, timetable, and results.</p>
            </div>
            <div className="space-y-6 p-8">
              {checking && <p className="flex items-center justify-center gap-2 text-sm text-slate-500" role="status"><Loader2 className="h-4 w-4 animate-spin" />Checking your invitation…</p>}
              {error && <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /><div>{error}</div></div>}

              {invitation && <>
                <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-base font-extrabold text-white">{getInitials(invitation.institutionName)}</div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-bold text-slate-900">{invitation.institutionName}</h2>
                      <p className="truncate text-xs text-slate-500">Invitation for <span className="font-semibold text-slate-700">{invitation.email}</span></p>
                    </div>
                    <span className="shrink-0 rounded-xl bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-700">{ROLE_LABELS[invitation.role]}</span>
                  </div>
                  <p className="flex items-center gap-1 border-t border-indigo-100/70 pt-2 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />Single-use link · expires {new Date(invitation.expiresAt).toLocaleDateString()}</p>
                </div>

                {signedInEmail ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><span>Signed in as</span><span className="font-bold text-slate-900">{signedInEmail}</span></div>
                    {emailMatches ? (
                      <button type="button" onClick={() => void accept()} disabled={accepting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50">
                        {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Link my account to {invitation.institutionName}</span><ArrowRight className="h-4 w-4" /></>}
                      </button>
                    ) : (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">This invitation was sent to {invitation.email}. Sign out and sign in with that email to accept it.</p>
                    )}
                  </div>
                ) : !showSignup ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => setShowSignup(true)} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-500"><UserPlus className="h-4 w-4" />Create my account</button>
                    <Link href={`/login?redirect=${encodeURIComponent(`/academic-invite?token=${token}`)}`} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 no-underline hover:bg-slate-50"><LogIn className="h-4 w-4" />I already have an account</Link>
                  </div>
                ) : (
                  <form onSubmit={(event) => void register(event)} className="space-y-3.5">
                    <label className="block text-[11px] font-semibold uppercase text-slate-700">Full name
                      <input type="text" required maxLength={100} autoComplete="name" value={fullName} onChange={(event) => { setFullName(event.target.value); setFieldErrors((current) => ({ ...current, fullName: undefined })); }} aria-invalid={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? 'invite-full-name-error' : undefined} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-xs normal-case text-slate-900" />
                    </label>
                    {fieldErrors.fullName && <p id="invite-full-name-error" className="-mt-2 text-[11px] text-rose-600">{fieldErrors.fullName}</p>}
                    <label className="block text-[11px] font-semibold uppercase text-slate-700">Email address
                      <input type="email" value={invitation.email} readOnly aria-readonly="true" className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs normal-case text-slate-600" />
                    </label>
                    <label className="block text-[11px] font-semibold uppercase text-slate-700">Password
                      <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); }} aria-invalid={Boolean(fieldErrors.password)} aria-describedby="invite-password-help" className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-xs normal-case text-slate-900" />
                    </label>
                    <p id="invite-password-help" className={`-mt-2 text-[11px] ${fieldErrors.password ? 'text-rose-600' : 'text-slate-500'}`}>
                      {fieldErrors.password ?? 'At least 8 characters with uppercase and lowercase letters, a number, and a symbol.'}
                    </p>
                    <p className="text-[11px] text-slate-500">We will email a six-digit code to verify this address before linking your account.</p>
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <button type="button" onClick={() => setShowSignup(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">← Back</button>
                      <button type="submit" disabled={registering} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50">{registering ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account and verify email'}</button>
                    </div>
                  </form>
                )}
              </>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AcademicInvitePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-xs text-slate-400">Loading invitation…</div>}>
      <AcademicInviteContent />
    </Suspense>
  );
}
