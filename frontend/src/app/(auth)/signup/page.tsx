'use client';

import { FormEvent, Suspense, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AxiosError } from 'axios';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  GraduationCap,
  Landmark,
  Lock,
  Mail,
  School,
  UserRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/auth/AuthShell';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import type { OrganizationType } from '@/types';

type SignupSelection = {
  id: 'solo' | 'business' | 'school' | 'college' | 'university';
  label: string;
  description: string;
  accountType: 'company' | 'individual';
  organizationType: OrganizationType;
  Icon: typeof UserRound;
};

const signupOptions: SignupSelection[] = [
  { id: 'solo', label: 'Solo / Individual', description: 'Plan personal work, projects, and documents. Tavro AI assistance is available where supported.', accountType: 'individual', organizationType: 'business', Icon: UserRound },
  { id: 'business', label: 'Company / Business', description: 'Coordinate office teams across chat, meetings, tasks, projects, CRM, client portal, files, workflows, and analytics.', accountType: 'company', organizationType: 'business', Icon: Building2 },
  { id: 'school', label: 'School / Academy', description: 'Manage classes, timetables, attendance, assignments, communication, online classes, exams, results, and fee records.', accountType: 'company', organizationType: 'school', Icon: School },
  { id: 'college', label: 'College', description: 'Coordinate courses, departments, schedules, attendance, assignments, communication, assessments, results, and fee records.', accountType: 'company', organizationType: 'college', Icon: GraduationCap },
  { id: 'university', label: 'University', description: 'Support faculty, students, and administrators with departments, courses, schedules, attendance, communication, exams, and results.', accountType: 'company', organizationType: 'university', Icon: Landmark },
];

const signupErrorMessages: Record<string, string> = {
  account_exists: 'An account with this email already exists. Sign in with that account instead.',
  attempt_expired: 'Your sign-up attempt expired. Choose your account type and try again.',
  authorization_failed: 'Provider authorization failed. Please try again.',
  cancelled: 'Sign-up was cancelled. You can continue whenever you’re ready.',
  identity_in_use: 'This provider account is already linked to another WorkGrind account.',
  provider_unavailable: 'This sign-in provider is temporarily unavailable. Please try again later.',
  try_again: 'We could not complete secure sign-up. Please try again.',
  verified_email_required: 'The provider must confirm your email address before WorkGrind can use this account.',
};

function setSignupUrl(selection: SignupSelection, step: 'account-type' | 'details') {
  const url = new URL(window.location.href);
  url.searchParams.set('workspace', selection.id);
  url.searchParams.delete('oauth_error');
  if (step === 'details') url.searchParams.set('step', step);
  else url.searchParams.delete('step');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submitting = useRef(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedOptionOverride, setSelectedOptionOverride] = useState<SignupSelection | null>(null);
  const [stepOverride, setStepOverride] = useState<'account-type' | 'details' | null>(null);
  const selectedOption = selectedOptionOverride ??
    signupOptions.find(({ id }) => id === searchParams.get('workspace')) ?? null;
  const step = stepOverride ?? (searchParams.get('step') === 'details' ? 'details' : 'account-type');
  const displayedError = error || signupErrorMessages[searchParams.get('oauth_error') || ''] || '';

  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  ];
  const strength = checks.filter(Boolean).length;

  const selectOption = (option: SignupSelection) => {
    setSelectedOptionOverride(option);
    setError('');
    setSignupUrl(option, 'account-type');
  };

  const continueToDetails = () => {
    if (!selectedOption) return;
    setError('');
    setStepOverride('details');
    setSignupUrl(selectedOption, 'details');
  };

  const returnToAccountType = () => {
    setError('');
    setStepOverride('account-type');
    if (selectedOption) setSignupUrl(selectedOption, 'account-type');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (!selectedOption) {
      setError('Choose an account type to continue.');
      return;
    }
    if (!fullName.trim()) {
      setError('Enter your name to continue.');
      return;
    }
    if (password !== confirm) {
      setError('Your passwords do not match.');
      return;
    }
    if (!checks.every(Boolean)) {
      setError('Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.');
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      await api.post('/auth/register', {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        accountType: selectedOption.accountType,
        organizationType: selectedOption.organizationType,
      });
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}&workspace=${selectedOption.id}`);
    } catch (requestError: unknown) {
      setError((requestError as AxiosError<{ message?: string }>).response?.data?.message || 'We could not start your signup. Please try again.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthShell className="signup-shell" contentClassName="signup-content">
      <ol className="auth-step signup-steps" aria-label="Signup progress">
        <li aria-current={step === 'account-type' ? 'step' : undefined}>01&nbsp; ACCOUNT TYPE</li>
        <i aria-hidden="true" />
        <li aria-current={step === 'details' ? 'step' : undefined}>02&nbsp; DETAILS</li>
      </ol>

      {step === 'account-type' ? (
        <>
          <h1 className="auth-form-title">Choose your workspace.</h1>
          <p className="auth-form-subtitle">
            WorkGrind brings individual work, business teams, and education into one workspace. Tavro AI can assist with productivity and learning where available.
          </p>
          {displayedError && <div className="auth-error" role="alert"><AlertCircle size={15} className="mr-2 inline" />{displayedError}</div>}

          <fieldset className="signup-option-fieldset">
            <legend className="mb-2 text-xs font-semibold text-stone-800">What are you setting up?</legend>
            <div className="signup-options">
              {signupOptions.map((option) => {
                const { id, label, description, Icon } = option;
                const isSelected = selectedOption?.id === id;
                return (
                  <label
                    key={id}
                    className={`signup-option ${isSelected ? 'is-selected' : ''}`}
                    htmlFor={`signup-workspace-${id}`}
                  >
                    <input
                      id={`signup-workspace-${id}`}
                      className="signup-option-radio"
                      type="radio"
                      name="signup-workspace"
                      value={id}
                      checked={isSelected}
                      onChange={() => selectOption(option)}
                    />
                    <span className="signup-option-icon" aria-hidden="true"><Icon size={19} /></span>
                    <span className="signup-option-copy">
                      <span className="signup-option-title">{label}</span>
                      <span className="signup-option-description">{description}</span>
                    </span>
                    <span className="signup-option-indicator" aria-hidden="true" />
                  </label>
                );
              })}
            </div>
          </fieldset>

          <button className="auth-primary signup-continue" type="button" disabled={!selectedOption} onClick={continueToDetails}>
            Continue <ArrowRight size={16} />
          </button>
        </>
      ) : selectedOption ? (
        <>
          <div className="signup-selected-type">
            <span>Creating a {selectedOption.label} account</span>
            <button type="button" className="auth-link" onClick={returnToAccountType}>Change</button>
          </div>
          <h1 className="auth-form-title">Create your account.</h1>
          <p className="auth-form-subtitle">
            Use Google or LinkedIn, or enter your details. Email signup requires a verification code before workspace setup.
          </p>
          {displayedError && <div className="auth-error" role="alert"><AlertCircle size={15} className="mr-2 inline" />{displayedError}</div>}

          <SocialAuthButtons intent="signup" signupSelection={selectedOption} className="signup-social" />
          <p className="signup-social-note">Google and LinkedIn confirm your email with the provider.</p>
          <div className="signup-divider">
            <span />or create with email<span />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-name">Your name</label>
              <div className="auth-input-wrap">
                <UserRound size={16} className="auth-icon" />
                <input id="signup-name" className="auth-input" type="text" required maxLength={100}
                  autoComplete="name" placeholder="Jordan Lee" value={fullName}
                  disabled={loading} onChange={(event) => setFullName(event.target.value)} />
              </div>
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-email">Email address</label>
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-icon" />
                <input id="signup-email" className="auth-input" type="email" required autoComplete="email"
                  placeholder="you@example.com" value={email} disabled={loading}
                  onChange={(event) => setEmail(event.target.value)} />
              </div>
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-password">Password</label>
              <div className="auth-password-wrap auth-input-wrap">
                <Lock size={16} className="auth-icon" />
                <input id="signup-password" className="auth-input" type={showPassword ? 'text' : 'password'}
                  required minLength={8} autoComplete="new-password" placeholder="Create a strong password" value={password}
                  disabled={loading} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={loading} onClick={() => setShowPassword((visible) => !visible)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password && <div className="auth-strength" aria-label={`Password strength ${strength} out of 4`}>
                {checks.map((met, index) => <i key={index} data-on={met} />)}
                <span>{strength <= 1 ? 'Needs work' : strength < 4 ? 'Getting stronger' : 'Strong'}</span>
              </div>}
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-confirm">Confirm password</label>
              <div className="auth-password-wrap auth-input-wrap">
                <Lock size={16} className="auth-icon" />
                <input id="signup-confirm" className="auth-input" type={showConfirmPassword ? 'text' : 'password'} required
                  autoComplete="new-password" placeholder="Enter it once more" value={confirm} disabled={loading}
                  onChange={(event) => setConfirm(event.target.value)} />
                <button type="button" className="auth-password-toggle"
                  aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                  disabled={loading} onClick={() => setShowConfirmPassword((visible) => !visible)}>
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button className="auth-primary" type="submit" disabled={loading}>
              {loading ? 'Sending verification code…' : <>Create account <ArrowRight size={16} /></>}
            </button>
          </form>
        </>
      ) : null}

      <p className="signup-signin">
        Already have an account? <Link href="/login" className="auth-link">Sign in</Link>
      </p>
      <p className="signup-terms">By continuing, you agree to WorkGrind’s terms and privacy policy.</p>
    </AuthShell>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <AuthShell className="signup-shell" contentClassName="signup-content">
        <p className="py-8 text-sm text-stone-600" role="status">Preparing signup…</p>
      </AuthShell>
    }>
      <SignUpContent />
    </Suspense>
  );
}
