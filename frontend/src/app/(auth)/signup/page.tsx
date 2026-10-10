'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  { id: 'solo', label: 'Solo / Individual', description: 'A personal workspace for your projects, focus, and goals.', accountType: 'individual', organizationType: 'business', Icon: UserRound },
  { id: 'business', label: 'Company / Business', description: 'Coordinate a team, projects, operations, and collaboration.', accountType: 'company', organizationType: 'business', Icon: Building2 },
  { id: 'school', label: 'School', description: 'Organize students, teachers, classes, attendance, and fees.', accountType: 'company', organizationType: 'school', Icon: School },
  { id: 'college', label: 'College', description: 'Manage academic departments, courses, schedules, and results.', accountType: 'company', organizationType: 'college', Icon: GraduationCap },
  { id: 'university', label: 'University', description: 'Bring academic programs, faculty, and campus operations together.', accountType: 'company', organizationType: 'university', Icon: Landmark },
];

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedOption, setSelectedOption] = useState<SignupSelection | null>(null);

  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  ];
  const strength = checks.filter(Boolean).length;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    if (!selectedOption) {
      setError('Choose an account type to continue.');
      return;
    }
    if (fullName.trim().length > 100) {
      setError('Your name must be 100 characters or fewer.');
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

    setLoading(true);
    try {
      await api.post('/auth/register', {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        accountType: selectedOption.accountType,
        organizationType: selectedOption.organizationType,
      });
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch (requestError: unknown) {
      setError((requestError as AxiosError<{ message?: string }>).response?.data?.message || 'We could not start your signup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-step"><b>01&nbsp; DETAILS</b><i /><span>02&nbsp; VERIFY EMAIL</span><i /><span>03&nbsp; WORKSPACE</span></div>
      <h1 className="auth-form-title">Start with a clear slate.</h1>
      <p className="auth-form-subtitle">Create your account. We’ll email you a verification code before your workspace is activated.</p>

      <fieldset className="mt-6">
        <legend className="mb-2 text-xs font-semibold text-stone-800">What are you setting up?</legend>
        <p className="mb-3 text-xs text-stone-500">Choose an account type to personalize your workspace.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Account type">
          {signupOptions.map(({ id, label, description, Icon, ...selection }) => {
            const isSelected = selectedOption?.id === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedOption({ id, label, description, Icon, ...selection })}
                className={`flex min-h-20 items-start gap-3 rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? 'border-[#526b58] bg-[#edf1e9] ring-2 ring-[#526b58]/15'
                    : 'border-stone-200 bg-white hover:border-stone-400'
                }`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                  isSelected ? 'bg-[#526b58] text-white' : 'bg-stone-100 text-stone-600'
                }`}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-stone-900">{label}</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-stone-500">{description}</span>
                </span>
                <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                  isSelected ? 'border-[#526b58] bg-[#526b58] text-white' : 'border-stone-300'
                }`} aria-hidden="true">
                  {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <SocialAuthButtons
        intent="signup"
        signupSelection={selectedOption}
        className="mt-5"
      />
      <div className="my-5 flex items-center gap-3 text-[9px] font-bold uppercase tracking-[.14em] text-stone-400">
        <span className="h-px flex-1 bg-stone-200" />or create with email<span className="h-px flex-1 bg-stone-200" />
      </div>

      {error && <div className="auth-error" role="alert"><AlertCircle size={15} className="mr-2 inline" />{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="signup-name">Your name</label>
          <div className="auth-input-wrap">
            <UserRound size={16} className="auth-icon" />
            <input id="signup-name" className="auth-input" type="text" required maxLength={100}
              autoComplete="name" placeholder="Jordan Lee" value={fullName}
              onChange={(event) => setFullName(event.target.value)} />
          </div>
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="signup-email">Work email</label>
          <div className="auth-input-wrap">
            <Mail size={16} className="auth-icon" />
            <input id="signup-email" className="auth-input" type="email" required autoComplete="email"
              placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="signup-password">Password</label>
          <div className="auth-password-wrap auth-input-wrap">
            <Lock size={16} className="auth-icon" />
            <input id="signup-password" className="auth-input" type={showPassword ? 'text' : 'password'}
              required autoComplete="new-password" placeholder="Create a strong password" value={password}
              onChange={(event) => setPassword(event.target.value)} />
            <button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((visible) => !visible)}>
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
              autoComplete="new-password" placeholder="Enter it once more" value={confirm}
              onChange={(event) => setConfirm(event.target.value)} />
            <button type="button" className="auth-password-toggle" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowConfirmPassword((visible) => !visible)}>
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button className="auth-primary" type="submit" disabled={loading || !selectedOption}>
          {loading ? 'Sending verification code…' : <>Create account <ArrowRight size={16} /></>}
        </button>
      </form>

      <p className="mt-7 text-center text-xs text-stone-500">
        Already have an account? <Link href="/login" className="auth-link">Sign in</Link>
      </p>
      <p className="mt-5 text-center text-[10px] leading-relaxed text-stone-400">
        By continuing, you agree to WorkGrind’s terms and privacy policy.
      </p>
    </AuthShell>
  );
}
